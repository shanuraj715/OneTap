import { Router,              } from "express";
import { z } from "zod";
import { gatewaySchema } from "@rasoipulse/config-schema";
import { OrderModel, ReservationModel } from "@rasoipulse/db";
import { outletBrand } from "../outlets/outlet-cache.js";
import { requireOutletContext, requireUser } from "../../middleware/auth.js";
import { HttpError } from "../../middleware/error.js";
import { currentCustomer } from "../customer/customer.routes.js";
import {
  clearCredentials,
  createBookingIntent,
  createIntent,
  handleWebhook,
  listGatewayConfig,
  listPaymentsForOrder,
  paymentSubject,
  saveCredentials,
  verifyPayment,
} from "./payments.service.js";
import { limiter } from "../../middleware/rate-limit.js";

export const paymentsRouter         = Router();

async function publicContext(outletId        )                         {
  const ref = await outletBrand(outletId);
  if (!ref) throw new HttpError(404, "Outlet not found");
  return { brandId: ref.brandId, outletId: ref.outletId };
}

/** The diner may only touch payments for their own order. */
async function requireOwnOrder(req         , ctx               , orderId        ) {
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

/** The diner may only pay the advance of their own table booking. */
async function requireOwnBooking(req         , ctx               , reservationId        ) {
  const customer = await currentCustomer(req);
  if (!customer) throw new HttpError(401, "Sign in to pay for this booking");
  const owns = await ReservationModel.exists({
    _id: reservationId,
    brandId: ctx.brandId,
    outletId: ctx.outletId,
    "customer.customerId": String(customer._id),
  });
  if (!owns) throw new HttpError(403, "That isn't your booking");
}

/* ------------------------------------------------------------ admin config */

paymentsRouter.get("/config", async (req, res) => {
  const ctx = await requireOutletContext(req, "payment-config:read");
  res.json({ gateways: await listGatewayConfig(ctx) });
});

const saveBody = z.object({ values: z.record(z.string(), z.string()) });

paymentsRouter.put("/config/:gateway", limiter("secrets"), async (req, res) => {
  const ctx = await requireOutletContext(req, "payment-config:manage");
  const user = requireUser(req);
  const gateway = gatewaySchema.parse(req.params.gateway);
  const { values } = saveBody.parse(req.body);
  await saveCredentials(ctx, gateway, values, String(user._id));
  res.json({ gateways: await listGatewayConfig(ctx) });
});

paymentsRouter.delete("/config/:gateway", limiter("secrets"), async (req, res) => {
  const ctx = await requireOutletContext(req, "payment-config:manage");
  await clearCredentials(ctx, gatewaySchema.parse(req.params.gateway));
  res.json({ gateways: await listGatewayConfig(ctx) });
});

/* ------------------------------------------------------------------ checkout */

// pay for an order, or the advance of a table booking — one or the other
const intentBody = z
  .object({ outletId: z.string().min(1), orderId: z.string().min(1).optional(), reservationId: z.string().min(1).optional() })
  .refine((b) => Boolean(b.orderId) !== Boolean(b.reservationId), { message: "Say what is being paid for: an order or a booking." });

paymentsRouter.post("/intent", limiter("payment"), async (req, res) => {
  const body = intentBody.parse(req.body);
  const ctx = await publicContext(body.outletId);
  if (body.reservationId) {
    await requireOwnBooking(req, ctx, body.reservationId);
    res.json(await createBookingIntent(ctx, body.reservationId));
    return;
  }
  await requireOwnOrder(req, ctx, body.orderId);
  res.json(await createIntent(ctx, body.orderId));
});

const verifyBody = z.object({
  outletId: z.string().min(1),
  paymentId: z.string().min(1),
  payload: z.record(z.string(), z.string()),
});

paymentsRouter.post("/verify", limiter("payment"), async (req, res) => {
  const body = verifyBody.parse(req.body);
  const ctx = await publicContext(body.outletId);
  // whose payment is it? Only its owner may confirm it — checked BEFORE anything is verified or settled
  const what = await paymentSubject(ctx, body.paymentId);
  if (what.subject === "reservation") await requireOwnBooking(req, ctx, what.id);
  else await requireOwnOrder(req, ctx, what.id);
  const { orderId } = await verifyPayment(ctx, body.paymentId, body.payload);
  res.json({ status: "paid", orderId, subject: what.subject });
});

/* ------------------------------------------------------------------ webhooks */

/**
 * Public and unauthenticated by design — the gateway calls it. Trust comes from
 * the signature, checked inside the adapter against that outlet's webhook secret.
 */
paymentsRouter.post("/webhook/:gateway", limiter("webhook"), async (req, res) => {
  const gateway = gatewaySchema.parse(req.params.gateway);
  const raw = (req                                  ).rawBody;
  if (!raw) throw new HttpError(400, "Missing request body");

  const result = await handleWebhook(gateway, raw, req.headers                                      );
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
