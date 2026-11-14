import { planMarketingSchema, planSchema } from "@onetap/config-schema";
import { connectDb, disconnectDb, PlanModel } from "@onetap/db";
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
const PLANS = [
  {
    name: "Basic",
    description: "One outlet, a small team, the essentials.",
    limits: { maxUsers: 5, multiOutlet: false, maxOutlets: 1 },
    entitlements: { features: ["takeaway", "dineInQr", "coupons", "printing"], effects: ["glass", "neumorph"], qrCardFamilies: ["minimal", "headline", "frame"] },
  },
  {
    name: "Pro",
    description: "Up to three outlets, delivery and every look.",
    limits: { maxUsers: 20, multiOutlet: true, maxOutlets: 3 },
    entitlements: {},
  },
  {
    name: "Custom",
    description: "Built around one restaurant — only the features and limits you agree on.",
    custom: true,
    marketing: {
      show: true,
      price: "",
      period: "",
      pitch: "Pick only what you need — we set up your account and features for you.",
      order: 90,
    },
  },
];

async function run() {
  await connectDb({ uri: env.MONGODB_URI, dbName: env.MONGODB_DB });
  for (const p of PLANS) {
    if (await PlanModel.exists({ name: p.name })) {
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
