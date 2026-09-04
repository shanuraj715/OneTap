import { Router } from "express";
import { z } from "zod";
import { cartSchema, gatewaySchema, orderChannelSchema, orderStatusSchema } from "@onetap/config-schema";
import { OrderModel, OutletModel,                    } from "@onetap/db";
import { requireOutletContext, requireUser } from "../../middleware/auth.js";
import { HttpError } from "../../middleware/error.js";
import { currentCustomer } from "../customer/customer.routes.js";
import {
  editOrder,
  getCapacityStatus,
  getOrder,
  listOrders,
  placeOrder,
  quote,
  setStatusManual,
  updateStatus,
} from "./orders.service.js";

export const ordersRouter         = Router();

/** Public context — a storefront visitor pricing a cart for a given outlet. */
async function publicContext(outletId        )                         {
  const outlet = await OutletModel.findOne({ _id: outletId }, null, { allowGlobalQuery: true }).lean();
  if (!outlet) throw new HttpError(404, "Outlet not found");
  return { brandId: outlet.brandId, outletId: String(outlet._id) };
}

/* -------------------------------------------------------------------- quote */

const quoteBody = z.object({
  outletId: z.string().min(1),
  cart: cartSchema,
  channel: orderChannelSchema.optional(),
  /** for a delivery quote — the fee is computed from this */
  deliveryPoint: z.object({ lat: z.number(), lng: z.number() }).optional(),
});

ordersRouter.post("/quote", async (req, res) => {
  const body = quoteBody.parse(req.body);
  const ctx = await publicContext(body.outletId);
  const customer = await currentCustomer(req);
  res.json(
    await quote(ctx, body.cart, {
      channel: body.channel,
      customerId: customer ? String(customer._id) : null,
      deliveryPoint: body.deliveryPoint,
    }),
  );
});

/**
 * Public: the live load-management read. Used by the storefront (to show the
 * banner and grey out delivery before the customer even tries) and by the
 * admin Orders page (a small badge) — same numbers either way, no auth
 * needed since nothing here is sensitive (no thresholds, just the current
 * level + message).
 */
ordersRouter.get("/capacity", async (req, res) => {
  const outletId = typeof req.query.outletId === "string" ? req.query.outletId : "";
  if (!outletId) throw new HttpError(400, "outletId is required");
  const ctx = await publicContext(outletId);
  res.json(await getCapacityStatus(ctx));
});

/* -------------------------------------------------------------------- place */

const deliveryAddressBody = z.object({
  text: z.string().min(4).max(300),
  landmark: z.string().max(120).optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const placeBody = z.object({
  outletId: z.string().min(1),
  cart: cartSchema,
  channel: orderChannelSchema.default("takeaway"),
  note: z.string().max(300).optional(),
  name: z.string().max(80).optional(),
  gateway: gatewaySchema.default("cod"),
  sessionId: z.string().optional(),
  deliveryAddress: deliveryAddressBody.optional(),
});

/**
 * Placing an order requires a verified diner — no anonymous orders. Staff
 * placing one on a walk-in or phoned-in customer's behalf are the exception:
 * the person standing at the till is the trusted party, whatever the order's
 * channel. That's signalled by the `x-onetap-outlet` header, which only an
 * authenticated admin call ever sends — the storefront never does, so a
 * customer request can't land here even carrying a stray staff cookie.
 */
ordersRouter.post("/", async (req, res) => {
  const body = placeBody.parse(req.body);

  if (req.header("x-onetap-outlet")) {
    const ctx = await requireOutletContext(req, "order:update");
    const user = requireUser(req);
    const order = await placeOrder({
      ctx,
      cart: body.cart,
      channel: body.channel,
      customer: { name: body.name },
      note: body.note,
      gateway: body.gateway,
      deliveryAddress: body.channel === "delivery" ? body.deliveryAddress : undefined,
      placedBy: "staff",
      staffId: String(user._id),
      staffName: user.name,
    });
    res.status(201).json({ order: shape(order, true) });
    return;
  }

  const ctx = await publicContext(body.outletId);
  const customer = await currentCustomer(req);
  if (!customer) throw new HttpError(401, "Verify your mobile or email before ordering");
  if (customer.brandId !== ctx.brandId) throw new HttpError(403, "Verify again for this restaurant");

  const order = await placeOrder({
    ctx,
    cart: body.cart,
    channel: body.channel,
    customer: {
      customerId: String(customer._id),
      name: body.name ?? customer.name ?? undefined,
      phone: customer.phone,
      email: customer.email,
    },
    note: body.note,
    gateway: body.gateway,
    deliveryAddress: body.channel === "delivery" ? body.deliveryAddress : undefined,
    placedBy: "customer",
    ...(await dineInContext(ctx, body, customer)),
  });

  res.status(201).json({ order: shape(order, true) });
});

/**
 * A dine-in order must belong to an OPEN session that this diner owns — otherwise
 * anyone could push items onto someone else's tab.
 */
async function dineInContext(
  ctx               ,
  body                                         ,
  customer                  ,
)                                                    {
  if (body.channel !== "dine-in") return {};
  if (!body.sessionId) throw new HttpError(400, "Scan your table QR before ordering");

  const { TableSessionModel } = await import("@onetap/db");
  const session = await TableSessionModel.findOne({
    _id: body.sessionId,
    brandId: ctx.brandId,
    outletId: ctx.outletId,
    customerId: String(customer._id),
    status: "open",
  }).lean();
  if (!session) throw new HttpError(403, "That table session isn't yours, or it has been closed");

  return { tableId: session.tableId, sessionId: String(session._id) };
}

/* --------------------------------------------------------------- staff views */

ordersRouter.get("/", async (req, res) => {
  const ctx = await requireOutletContext(req, "order:read");
  const status = req.query.status;
  const pp = req.query.paymentPending;
  const { orders, counts } = await listOrders(ctx, {
    status: typeof status === "string" ? orderStatusSchema.parse(status) : undefined,
    limit: Number(req.query.limit) || 50,
    paymentPending: pp === "only" || pp === "all" ? pp : "hide",
  });
  res.json({ orders: orders.map((o) => shape(o, true)), counts });
});

ordersRouter.patch("/:id/status", async (req, res) => {
  const ctx = await requireOutletContext(req, "order:update");
  const user = requireUser(req);
  const status = orderStatusSchema.parse((req.body                        ).status);
  const order = await updateStatus(ctx, req.params.id, status, String(user._id));
  res.json({ order: shape(order, true) });
});

/**
 * Force a status, ignoring the forward-only flow. This is the correction path
 * for a mis-tap — a separate endpoint so the ordinary buttons can't do it by
 * accident and the history can mark it as a human override.
 */
const manualBody = z.object({
  status: orderStatusSchema,
  reason: z.string().max(200).optional(),
});

ordersRouter.patch("/:id/status/manual", async (req, res) => {
  const ctx = await requireOutletContext(req, "order:update");
  const user = requireUser(req);
  const body = manualBody.parse(req.body);
  const order = await setStatusManual(ctx, req.params.id, body.status, String(user._id), body.reason);
  res.json({ order: shape(order, true) });
});

/* --------------------------------------------------------------- edit order */

const editBody = z.object({
  cart: cartSchema.optional(),
  note: z.string().max(300).optional(),
  customerName: z.string().max(80).optional(),
  customerPhone: z.string().max(20).optional(),
});

ordersRouter.patch("/:id", async (req, res) => {
  const ctx = await requireOutletContext(req, "order:update");
  const user = requireUser(req);
  const order = await editOrder(ctx, req.params.id, editBody.parse(req.body), String(user._id));
  res.json({ order: shape(order, true) });
});

/* ------------------------------------------------------- customer's own order */

/** The diner's confirmation page — their own order only. */
ordersRouter.get("/:id", async (req, res) => {
  const outletId = typeof req.query.outletId === "string" ? req.query.outletId : "";
  if (!outletId) throw new HttpError(400, "outletId is required");
  const ctx = await publicContext(outletId);

  if (req.user) {
    res.json({ order: shape(await getOrder(ctx, req.params.id), true) });
    return;
  }

  const customer = await currentCustomer(req);
  if (!customer) throw new HttpError(401, "Sign in to view this order");

  const order = await OrderModel.findOne({
    _id: req.params.id,
    brandId: ctx.brandId,
    outletId: ctx.outletId,
    "customer.customerId": String(customer._id),
  }).lean();
  if (!order) throw new HttpError(404, "Order not found");

  res.json({ order: shape(order, false) });
});

/* --------------------------------------------------------------------- shape */

function shape(o                     , includeCustomer         ) {
  return {
    id: String(o._id),
    orderNumber: o.orderNumber,
    channel: o.channel,
    placedBy: o.placedBy ?? "customer",
    staffName: o.staffName ?? null,
    status: o.status,
    lines: o.lines,
    totals: o.totals,
    pricesIncludeTax: o.pricesIncludeTax,
    payment: o.payment,
    note: o.note ?? null,
    customer: includeCustomer ? o.customer : undefined,
    tableId: o.tableId ?? null,
    couponCode: o.couponCode ?? null,
    deliveryAddress: o.deliveryAddress ?? null,
    etaMinutes: o.etaMinutes ?? null,
    // The admin's SLA clock measures from the last status change, not from when
    // the order was created, so the history has to travel with the order.
    statusHistory: o.statusHistory ?? [],
    createdAt: o.createdAt,
  };
}
