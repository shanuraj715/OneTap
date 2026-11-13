import { connectDb, disconnectDb, OrderModel } from "@onetap/db";
import { env } from "../env.js";
import { logger } from "../logger.js";

/**
 * `orderNumber` is issued by a per-outlet-per-day counter that resets to 1
 * every day, but the unique index that enforced it — `{brandId, outletId,
 * orderNumber}` — had no day in it, so two orders on different days were
 * always going to collide once the counter cycled back over a number an
 * earlier day had already used. That surfaced as a raw 500 ("Internal server
 * error") on `POST /api/orders` the moment it happened.
 *
 * The fix adds `orderDay` (the same `YYYYMMDD` the counter key already used)
 * to every order and re-scopes the unique index to include it — see
 * `orderDay()` in orders.service.js and the index on the Order schema.
 *
 * This migration backfills `orderDay` (from each order's own `createdAt`, so
 * historical orders land on the day they actually happened) on whatever was
 * written before that field existed, then swaps the index. Idempotent: safe
 * to run more than once — orders that already have `orderDay` are skipped,
 * and dropping an index that's already gone is a no-op.
 */
function dayOf(date       )         {
  const d = new Date(date);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

async function run() {
  await connectDb({ uri: env.MONGODB_URI, dbName: env.MONGODB_DB });

  const missing = await OrderModel.find({ orderDay: { $exists: false } }, null, { allowGlobalQuery: true })
    .select("_id createdAt")
    .lean();

  let updated = 0;
  for (const o of missing) {
    await OrderModel.updateOne({ _id: o._id }, { $set: { orderDay: dayOf(o.createdAt) } }).setOptions({ allowGlobalQuery: true });
    updated += 1;
  }
  logger.info({ updated }, "Backfilled orderDay on existing orders");

  // Drops the stale {brandId, outletId, orderNumber} index (no longer in the
  // schema) and creates the new {..., orderDay, orderNumber} one in its place.
  const dropped = await OrderModel.syncIndexes();
  logger.info({ dropped }, "Synced Order indexes");

  await disconnectDb();
}

run().catch((err) => {
  logger.error({ err }, "Migration failed");
  process.exitCode = 1;
});
