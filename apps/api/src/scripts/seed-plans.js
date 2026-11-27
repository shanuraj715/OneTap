import { PLAN_PRESETS, planMarketingSchema, planSchema } from "@rasoipulse/config-schema";
import { connectDb, disconnectDb, PlanModel } from "@rasoipulse/db";
import { env } from "../env.js";
import { logger } from "../logger.js";

/**
 * Example plans to start from — editable afterwards in the platform console.
 * Assigns them to NO store: every existing store stays on "no plan"
 * (unlimited) until you choose one for it. Skips any plan name that already
 * exists, so it's safe to run twice.
 *
 * "Custom" includes nothing by itself: each store on it gets the limits and
 * features you set on that store's page. It's shown on the website's Pricing
 * as "Custom pricing".
 *
 *   node src/scripts/seed-plans.js
 */
/** What the website's Pricing shows for each plan (prices are in rupees; edit them in the console's Plans page afterwards). */
const MARKETING = {
  Starter: { show: true, monthly: 799, yearlyDiscount: 10, pitch: "Everything one outlet needs to take orders.", order: 10 },
  Business: { show: true, monthly: 2499, yearlyDiscount: 10, highlight: true, pitch: "Every feature, up to three outlets and twenty people.", order: 20 },
};

const PLANS = [
  ...PLAN_PRESETS.map((p) => ({ name: p.names[0], description: p.description, limits: p.limits, entitlements: p.entitlements, marketing: MARKETING[p.names[0]] })),
  {
    name: "Custom",
    description: "Built around one restaurant — only the features and limits you agree on.",
    custom: true,
    marketing: {
      show: true,
      price: "Custom",
      period: "",
      pitch: "Pick only what you need — we set up your account and features for you.",
      order: 90,
    },
  },
];

async function run() {
  await connectDb({ uri: env.MONGODB_URI, dbName: env.MONGODB_DB });
  for (const p of PLANS) {
    // an install that already has the plan under an older name (Basic / Pro) keeps it: `update-plans.js` brings that one up to date
    const known = PLAN_PRESETS.find((x) => x.names[0] === p.name)?.names ?? [p.name];
    if (await PlanModel.exists({ name: { $in: known } })) {
      logger.info({ plan: p.name }, "Plan already exists — skipped");
      continue;
    }
    await PlanModel.create({ ...planSchema.parse(p), ...(p.marketing ? { marketing: planMarketingSchema.parse(p.marketing) } : {}) });
    logger.info({ plan: p.name }, "Plan created");
  }
  await disconnectDb();
}

run().catch((err) => {
  logger.error({ err }, "Seeding plans failed");
  process.exitCode = 1;
});
