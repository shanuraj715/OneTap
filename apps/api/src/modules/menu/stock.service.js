import { istDayKey } from "@rasoipulse/config-schema";
import { MenuItemModel, OrderModel, tenantFilter } from "@rasoipulse/db";
import { logger } from "../../logger.js";
import { HttpError } from "../../middleware/error.js";

/**
 * Counted stock ("only 3 left"). The menu says how many of a dish are left; an order takes them off the moment it is
 * placed (so two people can't both buy the last plate), and they go back if the order is cancelled, deleted before it
 * was made, or never paid for. Every change is a single atomic database update — `left` can never go below zero.
 *
 * A dish with a daily number is refilled to it the first time anything looks at the outlet's menu on a new day (India
 * time) — no clock job needed.
 */

/** outletId → the India-time day its daily refill last ran in THIS process (a cheap guard; the update itself is idempotent) */
const refilledOn = new Map();

/** Refill every daily-counted dish of the outlet to its daily number, once per India-time day. */
export async function refillDailyStock(ctx) {
  const today = istDayKey();
  if (refilledOn.get(ctx.outletId) === today) return;
  const due = await MenuItemModel.find(tenantFilter(ctx, { "stock.tracked": true, "stock.daily": { $ne: null }, "stock.resetDay": { $ne: today } }))
    .select("stock")
    .lean();
  for (const item of due) {
    // the resetDay condition makes a second process (or a second request) doing the same a no-op
    await MenuItemModel.updateOne(tenantFilter(ctx, { _id: item._id, "stock.resetDay": { $ne: today } }), { $set: { "stock.left": item.stock.daily, "stock.resetDay": today } });
  }
  refilledOn.set(ctx.outletId, today);
}

/** For tests: forget which outlets were refilled today. */
export const __resetRefillMemo = () => refilledOn.clear();

/**
 * Take `needs` (itemId → units) off the menu, all or nothing. A dish that no longer has enough left undoes what was
 * already taken and answers 409 with how many are left.
 * @returns {{ itemId: string, quantity: number }[]} what was taken — to be stored on the order as its stock hold
 */
export async function holdStock(ctx, needs) {
  const taken = [];
  for (const [itemId, quantity] of needs) {
    if (quantity <= 0) continue;
    const res = await MenuItemModel.updateOne(tenantFilter(ctx, { _id: itemId, "stock.tracked": true, "stock.left": { $gte: quantity } }), { $inc: { "stock.left": -quantity } });
    if (res.modifiedCount !== 1) {
      const item = await MenuItemModel.findOne(tenantFilter(ctx, { _id: itemId })).select("name stock").lean();
      // the owner switched counting off for this dish a moment ago: nothing to take, not a reason to refuse the order
      if (item && !item.stock?.tracked) continue;
      await returnStock(ctx, taken);
      const left = Math.max(0, item?.stock?.left ?? 0);
      throw new HttpError(409, left <= 0 ? `Sorry — ${item?.name ?? "a dish in your cart"} just sold out.` : `Sorry — only ${left} ${item?.name ?? "of a dish"} left now. Reduce the quantity and try again.`, { code: "out_of_stock", itemId, left });
    }
    taken.push({ itemId, quantity });
  }
  return taken;
}

/** Put stock back (dishes that are no longer counted are left alone). */
export async function returnStock(ctx, lines) {
  for (const { itemId, quantity } of lines ?? []) {
    if (quantity > 0) await MenuItemModel.updateOne(tenantFilter(ctx, { _id: itemId, "stock.tracked": true }), { $inc: { "stock.left": quantity } });
  }
}

/**
 * Give an order's stock back — once. The order is flipped from held to released first (atomically), so two cancels
 * racing each other (or a cancel and the unpaid-order sweep) can never return the same plates twice.
 */
export async function releaseStock(ctx, order) {
  if (!order?.stockHold?.held || !order.stockHold.lines?.length) return false;
  const res = await OrderModel.updateOne(tenantFilter(ctx, { _id: order._id, "stockHold.held": true }), { $set: { "stockHold.held": false } });
  if (res.modifiedCount !== 1) return false;
  await returnStock(ctx, order.stockHold.lines);
  if (typeof order.set === "function") order.set("stockHold.held", false);
  else order.stockHold.held = false;
  return true;
}

/**
 * An edited order: give back what it held and take what it needs now — all or nothing. If the new amounts can't be
 * had (someone else bought the last ones in between) the old hold is put back exactly as it was and the edit fails.
 * @returns the new hold lines (to store on the order)
 */
export async function reholdStock(ctx, order, needs) {
  const before = order.stockHold?.held ? order.stockHold.lines ?? [] : [];
  await returnStock(ctx, before);
  try {
    return await holdStock(ctx, needs);
  } catch (e) {
    // put the original hold back (it was there a moment ago, so it fits unless the owner changed the count meanwhile)
    for (const { itemId, quantity } of before) {
      await MenuItemModel.updateOne(tenantFilter(ctx, { _id: itemId, "stock.tracked": true }), { $inc: { "stock.left": -quantity } });
    }
    throw e;
  }
}

/** An order paid online that hasn't been paid this long after it was placed gives its stock back. */
export const UNPAID_HOLD_MINUTES = 30;

/** Give back the stock of online orders nobody paid for (an abandoned payment page). Safe to run in every process. */
export async function sweepUnpaidHolds(now = Date.now()) {
  const stale = await OrderModel.find(
    { "stockHold.held": true, "payment.gateway": { $ne: "cod" }, "payment.status": { $in: ["pending", "failed"] }, createdAt: { $lt: new Date(now - UNPAID_HOLD_MINUTES * 60_000) } },
    null,
    { allowGlobalQuery: true },
  )
    .select("brandId outletId stockHold")
    .limit(200)
    .lean();
  let released = 0;
  for (const o of stale) {
    try {
      if (await releaseStock({ brandId: o.brandId, outletId: o.outletId }, o)) released += 1;
    } catch (err) {
      logger.error({ err, orderId: String(o._id) }, "stock: couldn't release an unpaid order's hold");
    }
  }
  return released;
}

let sweeper = null;
/** Every 5 minutes, in every API process (the release is atomic, so more than one sweeping is harmless). */
export function startStockSweeper() {
  if (sweeper) return;
  sweeper = setInterval(() => {
    sweepUnpaidHolds().catch((err) => logger.error({ err }, "stock sweep failed"));
  }, 5 * 60_000);
  sweeper.unref();
}
