import { connectDb, disconnectDb, NotificationCredentialModel, StorageConfigModel } from "@onetap/db";
import { env } from "../env.js";
import { logger } from "../logger.js";

/**
 * Storage + notify credentials became brand-level (shared across every
 * outlet in a brand) instead of per-outlet. The code already resolves them
 * by brandId alone (see brandFilter in storage.service.js/notify.service.js),
 * so this migration isn't required for correctness — it just tidies up the
 * stale `outletId` left on documents that were saved before that change, so
 * the shape matches going forward. Idempotent: safe to run more than once,
 * any time, with no deploy-ordering requirement.
 *
 * For each (brandId[, channel]) group, keeps the most-recently-updated
 * document, unsets its outletId, and deletes any others (defensive — today
 * there's at most one per group anyway, since nothing has ever created a
 * second outlet before this feature).
 */
async function migrateModel(Model, groupKeys) {
  const docs = await Model.find({}, null, { allowGlobalQuery: true }).sort({ updatedAt: -1 }).lean();

  const groups = new Map();
  for (const doc of docs) {
    const key = groupKeys.map((k) => doc[k]).join("::");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(doc);
  }

  let kept = 0;
  let removed = 0;
  for (const [, group] of groups) {
    const [primary, ...rest] = group; // already sorted newest-first
    if (primary.outletId !== undefined) {
      await Model.updateOne({ _id: primary._id }, { $unset: { outletId: "" } }).setOptions({ allowGlobalQuery: true });
    }
    kept += 1;

    for (const dup of rest) {
      await Model.deleteOne({ _id: dup._id }).setOptions({ allowGlobalQuery: true });
      removed += 1;
    }
  }
  return { kept, removed };
}

async function run() {
  await connectDb({ uri: env.MONGODB_URI, dbName: env.MONGODB_DB });

  const storage = await migrateModel(StorageConfigModel, ["brandId"]);
  logger.info(storage, "Migrated StorageConfig to brand-level");

  const notify = await migrateModel(NotificationCredentialModel, ["brandId", "channel"]);
  logger.info(notify, "Migrated NotificationCredential to brand-level");

  await disconnectDb();
}

run().catch((err) => {
  logger.error({ err }, "Migration failed");
  process.exitCode = 1;
});
