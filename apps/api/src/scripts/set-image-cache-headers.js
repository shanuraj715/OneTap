import { connectDb, disconnectDb } from "@rasoipulse/db";
import { env } from "../env.js";
import { refreshImageCacheHeaders } from "../modules/storage/storage-cache.js";

/**
 * Pictures stored in the cloud (R2 / S3) before browser caching was added have no cache header, so browsers keep re-asking for them.
 * This gives each one `Cache-Control: public, max-age=31536000, immutable` — the same bytes, the same address, only the header
 * changes. New pictures get the header when they are uploaded. Dry run unless --apply; safe to run twice.
 *
 *   node src/scripts/set-image-cache-headers.js                 # dry run: how many pictures need it
 *   node src/scripts/set-image-cache-headers.js --apply         # do it
 *   node src/scripts/set-image-cache-headers.js --apply --limit 1   # try on ONE picture first
 */
const apply = process.argv.includes("--apply");
const limitAt = process.argv.indexOf("--limit");
const limit = limitAt > 0 ? Number(process.argv[limitAt + 1]) : Infinity;

async function run() {
  await connectDb({ uri: env.MONGODB_URI, dbName: env.MONGODB_DB });
  const r = await refreshImageCacheHeaders({ apply, limit });
  console.log(JSON.stringify({ ...r, failed: r.failed.length, firstFailures: r.failed.slice(0, 5) }, null, 2));
  if (r.skipped) console.log(r.skipped);
  else if (!apply) console.log(`\nDry run: ${r.wouldUpdate} of ${r.pictures} pictures need the header (${r.already} already have it). Run again with --apply to set it.`);
  else console.log(`\nDone: ${r.updated} set, ${r.already} already had it, ${r.failed.length} failed.`);
  await disconnectDb();
  process.exit(r.failed.length ? 1 : 0);
}
run().catch((e) => { console.error(e); process.exit(1); });
