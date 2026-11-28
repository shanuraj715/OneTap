import { AppShotModel, connectDb, disconnectDb } from "@rasoipulse/db";
import { env } from "../env.js";
import { loadApps } from "../modules/app-releases/app-registry.js";
import { SEED_VERSION, ensureShotsSeeded, retrySeedingNow } from "../modules/app-releases/app-screenshots.service.js";
import { BUILTIN_APP_SHOTS } from "../modules/app-releases/app-shots-builtin.js";
import { resolveStorage } from "../modules/storage/storage.service.js";

/**
 * Copies the screenshots that come with Rasoi Pulse (apps/api/assets/app-screens, listed in app-shots-builtin.js) into the platform's storage — the Cloudflare R2 bucket
 * when that is what the console's Storage page has configured — and records them as each app's screenshots, so no picture is ever served from a disk. Pictures an
 * earlier version recorded as paths on the website's disk are moved into storage too. Anything an admin removed stays removed. The app pages do the same on their own
 * the first time they are read; running this on every deploy simply makes it happen before the first visitor.
 *
 *   node src/scripts/seed-app-screenshots.js              copy what is missing (prints what happened)
 *   node src/scripts/seed-app-screenshots.js --dry-run    only say what would be copied (changes NOTHING)
 *
 * Safe to run twice: apps that are already done are reported as such.
 */
const dry = process.argv.includes("--dry-run");

async function run() {
  await connectDb({ uri: env.MONGODB_URI, dbName: env.MONGODB_DB });
  const cfg = await resolveStorage({ brandId: "platform", outletId: "website" });
  console.log(`${dry ? "DRY RUN (nothing is changed)" : "COPYING"} — pictures go to the platform storage: ${cfg.provider === "s3" ? "an S3-compatible bucket (R2)" : cfg.provider === "local" ? "THIS SERVER'S DISK (the console has not configured a bucket)" : cfg.provider}`);
  let problems = 0;
  for (const app of await loadApps({ fresh: true })) {
    const builtin = BUILTIN_APP_SHOTS[app.slug] ?? [];
    const rows = await AppShotModel.find({ app: app.slug }).lean();
    const legacy = rows.flatMap((r) => Object.values(r.images ?? {}).flatMap((by) => Object.values(by ?? {}))).filter((im) => im?.src?.startsWith?.("/app-screens/") && !im.key).length;
    const missing = builtin.filter((b) => !rows.some((r) => r.builtInName === b.name));
    if (app.shotsSeedVersion >= SEED_VERSION) { console.log(`${app.slug}: already done (${rows.length} screenshots)`); continue; }
    console.log(`${app.slug}: ${rows.length} screenshots now; ${missing.length} to add, ${legacy} picture(s) to move off the website's disk`);
    if (dry) continue;
    retrySeedingNow(app.slug);
    await ensureShotsSeeded(app.slug);
    const after = await loadApps({ fresh: true });
    const done = after.find((a) => a.slug === app.slug)?.shotsSeedVersion >= SEED_VERSION;
    const now = await AppShotModel.countDocuments({ app: app.slug });
    console.log(`  → ${done ? "done" : "NOT finished (see the log above; run again)"}: ${now} screenshots`);
    if (!done) problems += 1;
  }
  await disconnectDb();
  process.exit(problems ? 1 : 0);
}

run().catch((e) => { console.error(e); process.exit(1); });
