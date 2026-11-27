import { RiderModel, tenantFilter } from "@rasoipulse/db";
import { logger } from "../../logger.js";
import { configured, sendPush } from "../notify/push.js";

/** The notification channel the rider app draws these on (the app creates it, loud, the first time it opens). */
export const DELIVERY_CHANNEL = "deliveries";
const MAX_PHONES = 5;

/**
 * The rider's phone says "send my notifications to this device token". One device belongs to one rider: if the same phone was signed in as
 * somebody else before, it is taken off them. A rider keeps up to five phones, newest last (the oldest drops off).
 */
export async function registerRiderPushToken(rider, token) {
  await RiderModel.updateMany({ "pushTokens.token": token, _id: { $ne: rider._id } }, { $pull: { pushTokens: { token } } }, { allowGlobalQuery: true });
  const scope = tenantFilter({ brandId: rider.brandId, outletId: rider.outletId }, { _id: rider._id });
  await RiderModel.updateOne(scope, { $pull: { pushTokens: { token } } });
  await RiderModel.updateOne(scope, { $push: { pushTokens: { $each: [{ token, addedAt: new Date() }], $slice: -MAX_PHONES } } });
}

export async function removeRiderPushToken(rider, token) {
  await RiderModel.updateOne(tenantFilter({ brandId: rider.brandId, outletId: rider.outletId }, { _id: rider._id }), { $pull: { pushTokens: { token } } });
}

/** Where the delivery goes and what it is worth, in one short line for a lock screen: "Sector 62 · 3.5 km · ₹440 · Karan". */
export function deliveryLine(order) {
  const where = order.deliveryAddress?.text || "";
  const km = order.deliveryAddress?.distanceKm ? `${order.deliveryAddress.distanceKm} km` : "";
  const total = order.totals?.grandTotal ? `₹${(order.totals.grandTotal / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : "";
  return [where, km, total, order.customer?.name].filter(Boolean).join(" · ").slice(0, 140);
}

/**
 * "A delivery for you", pushed to every phone the rider allowed notifications on — so they hear about it with the app closed or minimised.
 * Phones Google says are gone are forgotten. Never throws and never delays the hand-over; with no Firebase key set up it does nothing.
 */
export async function notifyRiderOfDelivery(ctx, order, riderId) {
  try {
    if (!configured()) return { sent: 0 };
    const rider = await RiderModel.findOne(tenantFilter(ctx, { _id: riderId })).select("+pushTokens").lean();
    const tokens = (rider?.pushTokens ?? []).map((t) => t.token);
    if (!tokens.length) return { sent: 0 };
    const result = await sendPush(tokens, {
      title: `New delivery #${order.orderNumber}`,
      body: deliveryLine(order) || "Open the app for the details.",
      data: { type: "delivery.assigned", orderId: String(order._id), orderNumber: order.orderNumber },
      channelId: DELIVERY_CHANNEL,
    });
    if (result.invalid.length) await RiderModel.updateOne(tenantFilter(ctx, { _id: riderId }), { $pull: { pushTokens: { token: { $in: result.invalid } } } });
    return result;
  } catch (err) {
    logger.warn({ err: String(err?.message ?? err) }, "couldn't push a delivery to the rider");
    return { sent: 0 };
  }
}
