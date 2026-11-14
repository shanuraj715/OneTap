import { sitePageSchema, siteSettingsSchema } from "@onetap/config-schema";
import { connectDb, disconnectDb, SitePageModel, SiteSettingsModel } from "@onetap/db";
import { env } from "../env.js";
import { logger } from "../logger.js";
import { starterPages, starterSettings } from "../modules/site/starter-content.js";

/**
 * The TablePe website's starter pages and settings — all editable afterwards
 * in the platform console (Website). Skips anything that already exists, so
 * it's safe to run twice and never overwrites your edits.
 *
 *   node src/scripts/seed-website.js
 */
async function run() {
  await connectDb({ uri: env.MONGODB_URI, dbName: env.MONGODB_DB });

  if (await SiteSettingsModel.exists({ key: "site" })) {
    logger.info("Website settings already exist — skipped");
  } else {
    await SiteSettingsModel.create({ key: "site", data: siteSettingsSchema.parse(starterSettings) });
    logger.info("Website settings created");
  }

  for (const p of starterPages) {
    if (await SitePageModel.exists({ slug: p.slug })) {
      logger.info({ page: p.slug }, "Page already exists — skipped");
      continue;
    }
    const data = sitePageSchema.parse(p);
    await SitePageModel.create({ ...data, system: Boolean(p.system), publishedAt: data.status === "published" ? new Date() : null });
    logger.info({ page: p.slug }, "Page created");
  }
  await disconnectDb();
}

run().catch((err) => {
  logger.error({ err }, "Seeding the website failed");
  process.exitCode = 1;
});
