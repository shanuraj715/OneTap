import path from "node:path";
import { UserModel, connectDb, disconnectDb } from "@rasoipulse/db";
import { env } from "../env.js";
import { publishReleaseFromFile } from "../modules/app-releases/app-releases.service.js";
import { resolveStorage } from "../modules/storage/storage.service.js";

/**
 * Adds an app release (an APK) the way the console's "New version" does — the same checks, the same storage (the Cloudflare R2 bucket the console has
 * configured), the same record — from a file that is on THIS machine. For when the file is easier to put here than to push through a browser.
 *
 *   node src/scripts/publish-app-release.js --app oma --file /path/rasoi-pulse-oma-v-26.11.28-002-release.apk --version v-26.11.28-002 \
 *        --notes "What's new, in a line or two" [--force] [--publish] [--dry-run]
 *
 *   --publish   make it available to phones and the website straight away (without it the release is saved as a DRAFT, to publish in the console)
 *   --force     make the update REQUIRED (every older build must update before it can be used) — only when an old build would break
 *   --dry-run   run every check, store nothing, save nothing
 *
 * The file is copied to the platform storage; it is not kept on this machine's disk (delete the copy you put here when this has finished).
 */
const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const flag = (name) => process.argv.includes(`--${name}`);

async function run() {
  const app = arg("app"); const file = arg("file"); const version = arg("version");
  if (!app || !file || !version) throw new Error("Usage: --app <oma|kda|rda|business|…> --file <apk> --version <v-YY.MM.DD-NNN> [--notes ...] [--force] [--publish] [--dry-run]");
  await connectDb({ uri: env.MONGODB_URI, dbName: env.MONGODB_DB });
  const cfg = await resolveStorage({});
  console.log(`${flag("dry-run") ? "DRY RUN — " : ""}${app} ${version}: ${path.basename(file)} → platform storage: ${cfg.provider === "s3" ? "an S3-compatible bucket (R2)" : cfg.provider === "local" ? "THIS SERVER'S DISK (the console has not configured a bucket)" : cfg.provider}; ${flag("publish") ? "will be PUBLISHED" : "saved as a draft"}${flag("force") ? "; update REQUIRED" : "; update optional"}`);
  const who = await UserModel.findOne({ isSuperAdmin: true }, null, { allowGlobalQuery: true }).sort({ createdAt: 1 }).select("_id email").lean();
  if (!who) throw new Error("There is no platform admin to record this under.");
  if (flag("dry-run")) {
    // the checks that need no storage: is it an APK, and is the version free? (the real run also stores the file and saves the record)
    const { inspectApk } = await import("../modules/app-releases/app-releases.service.js");
    const { AppReleaseModel } = await import("@rasoipulse/db");
    const { versionCodeOf } = await import("@rasoipulse/config-schema");
    const r = await inspectApk(file);
    const taken = await AppReleaseModel.exists({ app, platform: "android", versionCode: versionCodeOf(version) });
    console.log(r.ok ? "the file is an APK" : `NOT OK: ${r.why}`);
    if (taken) console.log(`NOT OK: version ${version} already exists for ${app}`);
    await disconnectDb();
    process.exit(r.ok && !taken ? 0 : 1);
  }
  const release = await publishReleaseFromFile({ app, filePath: file, version, notes: arg("notes") ?? "", force: flag("force"), publish: flag("publish") }, who);
  console.log(`done: ${release.app} ${release.version} (build ${release.versionCode}) is ${release.status}${release.force ? ", update required" : ""} — ${(release.size / 1024 / 1024).toFixed(1)} MB, sha256 ${release.sha256}`);
  await disconnectDb();
  process.exit(0);
}

run().catch((e) => { console.error(`failed: ${e.message ?? e}`); process.exit(1); });
