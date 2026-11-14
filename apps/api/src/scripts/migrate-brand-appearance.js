import { outletConfigSchema } from "@onetap/config-schema";
import { BrandModel, connectDb, disconnectDb, OutletModel } from "@onetap/db";
import { env } from "../env.js";
import { logger } from "../logger.js";

/**
 * Appearance (theme, typography, effect, component styles) became shared by
 * every outlet of a store — stored once on `Brand.appearance` instead of on
 * each outlet.
 *
 * Not required for correctness: until a brand has an appearance, each outlet
 * keeps using its own (see config.service.js), and the first theme save
 * creates it. This just makes it explicit, by copying the look of each brand's
 * FIRST outlet (the one created earliest) — so a store whose outlets had
 * drifted apart ends up looking like its main outlet everywhere.
 *
 * Idempotent: brands that already have an appearance are skipped. Copies
 * only — the outlets' own values are left in place, untouched.
 *
 *   node src/scripts/migrate-brand-appearance.js           # dry run, changes nothing
 *   node src/scripts/migrate-brand-appearance.js --apply   # write
 */
const AREAS = ["theme", "typography", "effect", "layout"];
const apply = process.argv.includes("--apply");

async function run() {
  await connectDb({ uri: env.MONGODB_URI, dbName: env.MONGODB_DB });

  const brands = await BrandModel.find({ appearance: null }).lean();
  let copied = 0;
  for (const brand of brands) {
    const first = await OutletModel.findOne({ brandId: String(brand._id) }).sort({ createdAt: 1 }).lean();
    if (!first) continue;
    const config = outletConfigSchema.parse(first.config ?? {});
    const appearance = Object.fromEntries(AREAS.map((k) => [k, config[k]]));
    logger.info({ brand: brand.name, fromOutlet: first.slug, effect: appearance.effect.style }, apply ? "Copying appearance" : "Would copy appearance");
    if (apply) await BrandModel.updateOne({ _id: brand._id, appearance: null }, { $set: { appearance } });
    copied += 1;
  }

  logger.info({ copied, apply }, apply ? "Brand appearance migrated" : "Dry run — nothing written. Re-run with --apply.");
  await disconnectDb();
}

run().catch((err) => {
  logger.error({ err }, "Migration failed");
  process.exitCode = 1;
});
