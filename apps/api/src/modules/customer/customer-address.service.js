import { CustomerAddressModel, tenantFilter } from "@rasoipulse/db";
import { logger } from "../../logger.js";

/**
 * A customer's saved delivery place, one per outlet. It is written when they place a delivery order (the pin from the map + the address they
 * typed), and read when they next choose Delivery at the same outlet so the pin is already there. They can still move it, and they can clear it.
 */

const shape = (a) => (a ? { lat: a.lat, lng: a.lng, text: a.text ?? "", landmark: a.landmark ?? "", updatedAt: a.updatedAt ?? null } : null);

export async function getSavedAddress(ctx, customerId) {
  const row = await CustomerAddressModel.findOne(tenantFilter(ctx, { customerId: String(customerId) })).lean();
  return shape(row);
}

/** Save (or replace) the place for this customer at this outlet. */
export async function saveAddress(ctx, customerId, { lat, lng, text = "", landmark = "" }) {
  const row = await CustomerAddressModel.findOneAndUpdate(
    tenantFilter(ctx, { customerId: String(customerId) }),
    {
      $set: { lat, lng, text: String(text).slice(0, 300), landmark: String(landmark ?? "").slice(0, 120), lastUsedAt: new Date() },
      $setOnInsert: { brandId: ctx.brandId, outletId: ctx.outletId, customerId: String(customerId) },
      $inc: { timesUsed: 1 },
    },
    { upsert: true, new: true },
  ).lean();
  return shape(row);
}

export async function clearSavedAddress(ctx, customerId) {
  await CustomerAddressModel.deleteOne(tenantFilter(ctx, { customerId: String(customerId) }));
}

/** From the order flow: remember where this delivery went. Never fails (or slows) the order. */
export function rememberDelivery(ctx, customerId, address) {
  if (!customerId || !address || typeof address.lat !== "number" || typeof address.lng !== "number") return;
  saveAddress(ctx, customerId, address).catch((err) => logger.warn({ err }, "couldn't save the customer's delivery address"));
}
