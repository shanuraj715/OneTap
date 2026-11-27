import { timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { OrderModel, OutletModel, RiderModel, BrandModel, tenantFilter } from "@rasoipulse/db";
import { bearerToken } from "../../middleware/auth.js";
import { HttpError } from "../../middleware/error.js";
import { floodLimiter, accountBlockedError, assertAccountNotBlocked, assertNotBlocked, clearAccountFailures, failed, recordAccountFailure } from "../security/login-guard.js";
import { limiter, usesPolicy } from "../../middleware/rate-limit.js";
import { assertAppCurrent } from "../app-releases/app-releases.service.js";
import { assertStoreEnabled, requireFeature } from "../platform/plan.service.js";
import { assignRider, updateStatus } from "../orders/orders.service.js";
import { PIN_RE, checkPin, loginPhoneOf, signRiderToken } from "./rider-auth.js";
import { riderFromToken } from "./rider-session.js";
import { registerRiderPushToken, removeRiderPushToken } from "./rider-push.js";

/**
 * The rider app's own API (`/api/rider/…`). A rider is not a dashboard user: they sign in with the phone number and PIN the manager
 * set on Settings → Delivery riders, and a rider's token opens ONLY these routes — their own deliveries, nothing else of the store.
 * Every route re-checks that the rider is still on the list, still switched on, that the PIN wasn't reset, and that the store is on.
 */
export const riderAppRouter = Router();

const loginFlood = floodLimiter("login");
const WRONG_CODES_ALLOWED = 5;
const ACTIVE = ["accepted", "preparing", "ready", "out_for_delivery"];

/** The key the per-account pause counts wrong PINs under (the same guard the dashboard sign-in uses, shaped like an email). */
const guardKey = (phone) => `${phone}@rider.invalid`;

const loginBody = z.object({ phone: z.string().trim().min(6, "Enter your mobile number.").max(20), pin: z.string().regex(PIN_RE, "Your PIN is 4 to 6 digits.") });

async function describe(rider) {
  const [outlet, brand] = await Promise.all([
    OutletModel.findOne({ brandId: rider.brandId, _id: rider.outletId }).select("name config.identity.name").lean(),
    BrandModel.findById(rider.brandId).select("name").lean(),
  ]);
  return { id: String(rider._id), name: rider.name, phone: rider.phone ?? "", outletId: String(rider.outletId), outletName: outlet?.config?.identity?.name || outlet?.name || "", storeName: brand?.name || "" };
}

riderAppRouter.post("/login", loginFlood, usesPolicy("login-account"), async (req, res) => {
  await assertAppCurrent(req); // an old build is turned away (426) before any PIN is checked
  const body = loginBody.parse(req.body);
  const phone = loginPhoneOf(body.phone);
  if (!phone) throw new HttpError(400, "Enter your 10-digit mobile number.");
  await assertNotBlocked(req, "staff");
  await assertAccountNotBlocked(guardKey(phone));

  const rider = await RiderModel.findOne({ loginPhone: phone }, null, { allowGlobalQuery: true }).select("+pinHash").lean();
  const ok = await checkPin(body.pin, rider?.pinHash);
  if (!rider || !ok) {
    const account = await recordAccountFailure(guardKey(phone));
    if (account.blocked) throw accountBlockedError(account);
    await failed(req, "staff", new HttpError(401, "Incorrect phone number or PIN"));
  }
  await clearAccountFailures(guardKey(phone));
  if (!rider.isActive) throw new HttpError(403, "Your login is switched off. Ask your manager.");
  await assertStoreEnabled(rider.brandId);
  await requireFeature(rider.brandId, "delivery", "Delivery");

  const { token, expiresAt } = signRiderToken({ riderId: String(rider._id), brandId: rider.brandId, outletId: rider.outletId, pinVersion: rider.pinVersion ?? 0 });
  await RiderModel.updateOne({ _id: rider._id, brandId: rider.brandId }, { $set: { lastLoginAt: new Date() } });
  res.json({ token, expiresAt, rider: await describe(rider) });
});

/** Who is calling: the rider the token names, if they are still allowed in. → { rider, ctx } */
const riderContext = (req) => riderFromToken(bearerToken(req));

riderAppRouter.get("/me", async (req, res) => {
  const { rider } = await riderContext(req);
  res.json({ rider: await describe(rider) });
});

/** The rider's own words for an order: where to, who to call, what is in the bag. Never the delivery code, never other riders' orders. */
const shape = (o) => ({
  id: String(o._id),
  orderNumber: o.orderNumber,
  status: o.status,
  placedAt: o.createdAt,
  assignedAt: o.rider?.assignedAt ?? null,
  pickedUpAt: (o.statusHistory ?? []).find((h) => h.status === "out_for_delivery")?.at ?? null,
  deliveredAt: (o.statusHistory ?? []).find((h) => h.status === "completed")?.at ?? null,
  customer: { name: o.customer?.name ?? "", phone: o.customer?.phone ?? "" },
  address: { text: o.deliveryAddress?.text ?? "", landmark: o.deliveryAddress?.landmark ?? "", lat: o.deliveryAddress?.lat ?? null, lng: o.deliveryAddress?.lng ?? null, distanceKm: o.deliveryAddress?.distanceKm ?? null },
  items: (o.lines ?? []).map((l) => ({ name: l.name, variantLabel: l.variantLabel ?? "", quantity: l.quantity, modifiers: (l.modifiers ?? []).map((m) => m.name ?? m.label ?? "").filter(Boolean), note: l.note ?? "" })),
  note: o.note ?? "",
  payment: { gateway: o.payment?.gateway ?? "cod", status: o.payment?.status ?? "pending" },
  needsCode: Boolean(o.deliveryCode),
});

/** Today (India time) starts at midnight +05:30. */
const dayStart = () => {
  const ist = new Date(Date.now() + 5.5 * 3_600_000);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - 5.5 * 3_600_000);
};

riderAppRouter.get("/deliveries", async (req, res) => {
  const { rider, ctx } = await riderContext(req);
  const mine = { channel: "delivery", "rider.riderId": String(rider._id) };
  const [active, done] = await Promise.all([
    OrderModel.find(tenantFilter(ctx, { ...mine, status: { $in: ACTIVE } })).select("+deliveryCode").sort({ createdAt: 1 }).limit(50).lean(),
    OrderModel.find(tenantFilter(ctx, { ...mine, status: "completed", updatedAt: { $gte: dayStart() } })).sort({ updatedAt: -1 }).limit(30).lean(),
  ]);
  res.json({ deliveries: active.map(shape), deliveredToday: done.map(shape), now: Date.now() });
});

/** Load one of THIS rider's active deliveries (anyone else's is "not found": a rider can't even tell it exists). */
async function myOrder(ctx, rider, id) {
  if (!/^[a-f\d]{24}$/i.test(String(id))) throw new HttpError(404, "Delivery not found");
  const order = await OrderModel.findOne(tenantFilter(ctx, { _id: id, channel: "delivery", "rider.riderId": String(rider._id) })).select("+deliveryCode +deliveryCodeTries");
  if (!order) throw new HttpError(404, "Delivery not found");
  return order;
}
const asRider = (rider) => ({ _id: `rider:${rider._id}`, name: rider.name });

/** "I have the food": Ready → Out for delivery (the customer is told, with the rider's name and number). */
riderAppRouter.post("/deliveries/:id/pickup", limiter("rider-action"), async (req, res) => {
  const { rider, ctx } = await riderContext(req);
  const order = await myOrder(ctx, rider, req.params.id);
  if (order.status === "out_for_delivery") return void res.json({ delivery: shape(order.toObject()) });
  if (order.status !== "ready") throw new HttpError(409, "This order isn't ready yet. The kitchen is still making it.");
  const updated = await assignRider(ctx, String(order._id), { riderId: String(rider._id), sendOut: true }, asRider(rider));
  res.json({ delivery: shape(updated) });
});

const deliveredBody = z.object({ code: z.string().trim().max(8).optional() });

/**
 * "I handed it over": Out for delivery → Completed. An order with a delivery code needs the customer's 4 digits; after a few wrong tries the
 * rider must ask the store (a manager can still complete the order from the dashboard), so a code can't be guessed.
 */
riderAppRouter.post("/deliveries/:id/delivered", limiter("rider-action"), async (req, res) => {
  const { rider, ctx } = await riderContext(req);
  const { code } = deliveredBody.parse(req.body ?? {});
  const order = await myOrder(ctx, rider, req.params.id);
  if (order.status === "completed") return void res.json({ delivery: shape(order.toObject()) });
  if (order.status !== "out_for_delivery") throw new HttpError(409, "Mark it picked up first.");
  if (order.deliveryCode) {
    if ((order.deliveryCodeTries ?? 0) >= WRONG_CODES_ALLOWED) {
      throw new HttpError(429, "Too many wrong codes. Call the store: they can mark this order delivered.", { code: "delivery_code_locked" });
    }
    // no code typed at all is not a guess: it only asks for the code (it must not use up one of the tries)
    if (!code) throw new HttpError(409, "Ask the customer for the 4-digit delivery code on their order page.", { code: "delivery_code_wrong", triesLeft: Math.max(WRONG_CODES_ALLOWED - (order.deliveryCodeTries ?? 0), 0) });
    const given = Buffer.from(String(code ?? ""));
    const expected = Buffer.from(order.deliveryCode);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      const tries = (order.deliveryCodeTries ?? 0) + 1;
      await OrderModel.updateOne(tenantFilter(ctx, { _id: order._id }), { $set: { deliveryCodeTries: tries } });
      throw new HttpError(409, `That code isn't right. ${Math.max(WRONG_CODES_ALLOWED - tries, 0)} tries left.`, { code: "delivery_code_wrong", triesLeft: Math.max(WRONG_CODES_ALLOWED - tries, 0) });
    }
  }
  const updated = await updateStatus(ctx, String(order._id), "completed", `rider:${rider._id}`, { reason: "delivered by the rider" });
  res.json({ delivery: shape(updated) });
});

const pushTokenBody = z.object({ token: z.string().trim().min(20, "That doesn't look like a device token.").max(4096) });

/** "Send my notifications to this phone" — called each time the app opens signed in, and again whenever Google gives the phone a new token. */
riderAppRouter.put("/push-token", limiter("rider-action"), async (req, res) => {
  const { rider } = await riderContext(req);
  await registerRiderPushToken(rider, pushTokenBody.parse(req.body ?? {}).token);
  res.status(204).end();
});

/** Signing out: this phone stops getting this rider's notifications. */
riderAppRouter.delete("/push-token", limiter("rider-action"), async (req, res) => {
  const { rider } = await riderContext(req);
  await removeRiderPushToken(rider, pushTokenBody.parse(req.body ?? {}).token);
  res.status(204).end();
});

/** Nothing is kept on the server for a rider's sign-in (the token just expires), so signing out is the phone forgetting it. */
riderAppRouter.post("/logout", limiter("rider-action"), (_req, res) => res.status(204).end());
