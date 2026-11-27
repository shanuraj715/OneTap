import { effectiveFeatures, FEATURE_KEYS, featureProblems, PLAN_PRESETS, planSchema } from "@rasoipulse/config-schema";
import { connectDb, disconnectDb, PlanModel } from "@rasoipulse/db";
import { env } from "../env.js";

/**
 * Brings the plans that already exist up to date with `PLAN_PRESETS` (packages/config-schema/src/plan-presets.js): the smallest plan gains
 * the features that suit it (pre-orders, ratings), the top plan is switched to "includes every feature" so every feature added later reaches it,
 * and a plan that has no table limit yet gets its preset's (Starter 5, Business 20 — tables are sold in fives). A limit already set is never changed.
 * A plan is found by any name the preset has had (Starter / Basic, Business / Pro). Custom plans are never touched, and nothing is removed from a plan.
 *
 *   node src/scripts/update-plans.js              show what would change (changes NOTHING)
 *   node src/scripts/update-plans.js --apply      make the changes
 *
 * Safe to run twice: a plan that is already up to date is reported as such. A store on a plan keeps its own overrides as they are.
 */
const apply = process.argv.includes("--apply");
const labelOf = (k) => k;

async function run() {
  await connectDb({ uri: env.MONGODB_URI, dbName: env.MONGODB_DB });
  console.log(`${apply ? "APPLYING" : "DRY RUN (nothing is changed; add --apply to make the changes)"} — plans in ${env.MONGODB_DB}`);
  let changed = 0;
  for (const preset of PLAN_PRESETS) {
    const plan = await PlanModel.findOne({ name: { $in: preset.names }, custom: { $ne: true } });
    if (!plan) { console.log(`\n${preset.names[0]}: no such plan here — skipped`); continue; }
    const now = planSchema.shape.entitlements.parse(plan.entitlements ?? {});
    const hadAll = effectiveFeatures(now);
    // only ever ADD: what the plan already has stays
    const features = preset.entitlements.allFeatures ? [...FEATURE_KEYS] : [...new Set([...now.features, ...preset.entitlements.features])];
    const next = { ...(plan.entitlements ?? {}), allFeatures: Boolean(preset.entitlements.allFeatures || now.allFeatures), features };
    const added = features.filter((k) => !hadAll.includes(k));
    const flagChange = next.allFeatures !== Boolean(now.allFeatures);
    const tablesNow = plan.limits?.maxTables ?? null;
    const tablesNext = tablesNow === null && preset.limits.maxTables ? preset.limits.maxTables : tablesNow;
    const tablesChange = tablesNext !== tablesNow;
    console.log(`\n${plan.name} (${plan.limits?.maxOutlets ?? "unlimited"} outlets, ${tablesNow ?? "unlimited"} tables):`);
    console.log(`  now:  ${hadAll.length}/${FEATURE_KEYS.length} features${now.allFeatures ? " (includes every feature)" : ""}`);
    if (!added.length && !flagChange && !tablesChange) { console.log("  already up to date"); continue; }
    if (added.length) console.log(`  adds: ${added.map(labelOf).join(", ")}`);
    if (flagChange) console.log("  switches on: includes every feature, also ones added later");
    if (tablesChange) console.log(`  table limit: unlimited → ${tablesNext} tables (stores on this plan with more than that keep theirs but can't add more)`);
    for (const p of featureProblems(features)) console.log(`  ! ${p.text}`);
    changed += 1;
    if (apply) {
      plan.entitlements = next;
      plan.markModified("entitlements");
      if (tablesChange) { plan.limits = { ...(plan.limits?.toObject?.() ?? plan.limits ?? {}), maxTables: tablesNext }; plan.markModified("limits"); }
      await plan.save();
      console.log("  saved");
    }
  }
  console.log(`\n${changed ? (apply ? `${changed} plan(s) updated.` : `${changed} plan(s) would change. Run again with --apply.`) : "Everything is up to date."}`);
  await disconnectDb();
}

run().catch((err) => {
  console.error("Updating plans failed:", err);
  process.exitCode = 1;
});
