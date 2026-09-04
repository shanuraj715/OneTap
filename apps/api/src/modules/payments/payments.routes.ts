import { Router, type Request } from "express";
import { z } from "zod";
import { gatewaySchema } from "@onetap/config-schema";
import { OrderModel, OutletModel, type TenantContext } from "@onetap/db";
import { requireOutletContext, requireUser } from "../../middleware/auth";
import { HttpError } from "../../middleware/error";
import { currentCustomer } from "../customer/customer.routes";
import {
  clearCredentials,
  createIntent,
  handleWebhook,
  listGatewayConfig,
  listPaymentsForOrder,
  saveCredentials,
  verifyPayment,
} from "./payments.service";

export const paymentsRouter: Router = Router();

async function publicContext(outletId: string): Promise<TenantContext> {
  const outlet = await OutletModel.findOne({ _id: outletId }, null, { allowGlobalQuery: true }).lean();
  if (!outlet) throw new HttpError(404, "Outlet not found");
  return { brandId: outlet.brandId, outletId: String(outlet._id) };
}

/** The diner may only touch payments for their own order. */
async function requireOwnOrder(req: Request, ctx: TenantContext, orderId: string) {
  if (req.user) return; // staff, already scoped by requireOutletContext upstream
  const customer = await currentCustomer(req);
  if (!customer) throw new HttpError(401, "Sign in to pay for this order");
  const owns = await OrderModel.exists({
    _id: orderId,
    brandId: ctx.brandId,
    outletId: ctx.outletId,
    "customer.customerId": String(customer._id),
  });
  if (!owns) throw new HttpError(403, "That isn't your order");
}

/* ------------------------------------------------------------ admin config */

paymentsRouter.get("/config", async (req, res) => {
  const ctx = await requireOutletContext(req, "payment-config:read");
  res.json({ gateways: await listGatewayConfig(ctx) });
});

const saveBody = z.object({ values: z.record(z.string(), z.string()) });

paymentsRouter.put("/config/:gateway", async (req, res) => {
  const ctx = await requireOutletContext(req, "payment-config:manage");
  const user = requireUser(req);
  const gateway = gatewaySchema.parse(req.params.gateway);
  const { values } = saveBody.parse(req.body);
  await saveCredentials(ctx, gateway, values, String(user._id));
  res.json({ gateways: await listGatewayConfig(ctx) });
});

paymentsRouter.delete("/config/:gateway", async (req, res) => {
  const ctx = await requireOutletContext(req, "payment-config:manage");
  await clearCredentials(ctx, gatewaySchema.parse(req.params.gateway));
  res.json({ gateways: await listGatewayConfig(ctx) });
});

/* ------------------------------------------------------------------ checkout */

const intentBody = z.object({ outletId: z.string().min(1), orderId: z.string().min(1) });

paymentsRouter.post("/intent", async (req, res) => {
  const body = intentBody.parse(req.body);
  const ctx = await publicContext(body.outletId);
  await requireOwnOrder(req, ctx, body.orderId);
  res.json(await createIntent(ctx, body.orderId));
});

const verifyBody = z.object({
  outletId: z.string().min(1),
  paymentId: z.string().min(1),
  payload: z.record(z.string(), z.string()),
});

paymentsRouter.post("/verify", async (req, res) => {
  const body = verifyBody.parse(req.body);
  const ctx = await publicContext(body.outletId);
  const { orderId } = await verifyPayment(ctx, body.paymentId, body.payload);
  await requireOwnOrder(req, ctx, orderId);
  res.json({ status: "paid", orderId });
});

/* ------------------------------------------------------------------ webhooks */

/**
 * Public and unauthenticated by design — the gateway calls it. Trust comes from
 * the signature, checked inside the adapter against that outlet's webhook secret.
 */
paymentsRouter.post("/webhook/:gateway", async (req, res) => {
  const gateway = gatewaySchema.parse(req.params.gateway);
  const raw = (req as Request & { rawBody?: string }).rawBody;
  if (!raw) throw new HttpError(400, "Missing request body");

  const result = await handleWebhook(gateway, raw, req.headers as Record<string, string | undefined>);
  res.json({ received: true, ...result });
});

/* --------------------------------------------------------------- staff view */

paymentsRouter.get("/order/:orderId", async (req, res) => {
  const ctx = await requireOutletContext(req, "order:read");
  const payments = await listPaymentsForOrder(ctx, req.params.orderId);
  res.json({
    payments: payments.map((p) => ({
      id: String(p._id),
      gateway: p.gateway,
      status: p.status,
      amount: p.amount,
      gatewayOrderId: p.gatewayOrderId ?? null,
      gatewayPaymentId: p.gatewayPaymentId ?? null,
      failureReason: p.failureReason ?? null,
      events: p.events,
      createdAt: p.createdAt,
    })),
  });
});
