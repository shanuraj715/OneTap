import { planMarketingSchema, planLimitsSchema, sitePageSchema, siteSettingsSchema } from "@onetap/config-schema";
import { connectDb, disconnectDb, PlanModel, SitePageModel, SiteSettingsModel } from "@onetap/db";
import { env } from "../env.js";
import { logger } from "../logger.js";
import { starterPages, starterSettings } from "../modules/site/starter-content.js";

/**
 * The TablePe website's starter pages and settings — all editable afterwards
 * in the platform console (Website). By default it only ADDS what's missing,
 * so it's safe to run twice and never touches your edits.
 *
 *   node src/scripts/seed-website.js
 *       add missing starter pages + settings
 *   node src/scripts/seed-website.js --refresh-unedited
 *       also replace starter pages you have never saved in the console with
 *       the latest starter version (pages you've edited are left alone)
 *   node src/scripts/seed-website.js --show-plans
 *       also put every active plan that isn't set up for the website yet on
 *       the Pricing page (no price — set one in Plans → Edit)
 */
const refreshUnedited = process.argv.includes("--refresh-unedited");
const showPlans = process.argv.includes("--show-plans");

async function run() {
  await connectDb({ uri: env.MONGODB_URI, dbName: env.MONGODB_DB });

  if (await SiteSettingsModel.exists({ key: "site" })) {
    logger.info("Website settings already exist — skipped");
  } else {
    await SiteSettingsModel.create({ key: "site", data: siteSettingsSchema.parse(starterSettings) });
    logger.info("Website settings created");
  }

  for (const p of starterPages) {
    const data = sitePageSchema.parse(p);
    const existing = await SitePageModel.findOne({ slug: p.slug });
    if (!existing) {
      await SitePageModel.create({ ...data, system: Boolean(p.system), publishedAt: data.status === "published" ? new Date() : null });
      logger.info({ page: p.slug }, "Page created");
      continue;
    }
    // `updatedBy` is set the first time a page is saved from the console
    if (refreshUnedited && !existing.updatedBy) {
      Object.assign(existing, { title: data.title, seo: data.seo, nav: data.nav, footerGroup: data.footerGroup, sections: data.sections });
      existing.markModified("sections");
      existing.markModified("seo");
      existing.markModified("nav");
      await existing.save();
      logger.info({ page: p.slug }, "Page refreshed with the latest starter content");
    } else {
      logger.info({ page: p.slug, edited: Boolean(existing.updatedBy) }, "Page already exists — skipped");
    }
  }

  if (showPlans) {
    const plans = await PlanModel.find({ archived: { $ne: true } }).sort({ createdAt: 1 });
    const fresh = plans.filter((p) => !p.marketing || p.marketing.show === undefined);
    // the plan with the most outlets is the one most restaurants grow into
    const outletsOf = (p) => {
      const l = planLimitsSchema.parse(p.limits ?? {});
      return l.multiOutlet ? (l.maxOutlets ?? 999) : 1;
    };
    const top = fresh.length > 1 ? fresh.reduce((a, b) => (outletsOf(b) > outletsOf(a) ? b : a)) : null;
    for (const [i, p] of fresh.entries()) {
      p.marketing = planMarketingSchema.parse({ show: true, pitch: p.description ?? "", highlight: p === top, order: i + 1 });
      p.markModified("marketing");
      await p.save();
      logger.info({ plan: p.name, highlight: p === top }, "Plan now shown on the website's Pricing (no price yet)");
    }
    if (!fresh.length) logger.info("Every plan already has website settings — skipped");
  }

  await disconnectDb();
}

run().catch((err) => {
  logger.error({ err }, "Seeding the website failed");
  process.exitCode = 1;
});
