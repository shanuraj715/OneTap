import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { connectDb, disconnectDb, mongoose } from "@onetap/db";
import { env, publicApiUrl } from "../env.js";
import { notifyWebsite } from "../modules/site/revalidate.js";

/**
 * Uploaded pictures are saved with their FULL address ("<this API's address>/uploads/<key>"). An API started on a
 * developer's machine without PUBLIC_API_URL saves "http://localhost:3072/uploads/…" — fine on that machine, a broken
 * image everywhere else once the database is shared with a deployed server.
 *
 * This re-points every stored "http(s)://localhost[:port]/uploads/…" (in ANY collection, ANY field) at THIS
 * deployment's own address (PUBLIC_API_URL, or --to). Only the address part changes — the file key after /uploads/ is
 * kept — so run it on the server whose .uploads folder holds the files.
 *
 * Safety:
 *  - a DRY RUN unless --apply (prints what would change, changes nothing);
 *  - refuses to run if this machine's own address is localhost (it would change nothing useful) — set PUBLIC_API_URL or --to;
 *  - checks each file exists under this machine's uploads folder, and with --apply REFUSES while any is missing
 *    (copy them over first, or pass --allow-missing);
 *  - writes a backup of every old value to fix-upload-urls.backup-<time>.json before changing anything;
 *  - idempotent: a second run finds nothing.
 *
 * After --apply: restart the API (its in-memory cache still holds the old addresses; this script asks the website to
 * refresh by itself).
 *
 *   node src/scripts/fix-upload-urls.js                 # dry run
 *   node src/scripts/fix-upload-urls.js --apply         # write
 *   node src/scripts/fix-upload-urls.js --to https://api.example.com --apply
 */
const apply = process.argv.includes("--apply");
const allowMissing = process.argv.includes("--allow-missing");
const flag = (name) => {
  const at = process.argv.indexOf(name);
  return at > 0 ? process.argv[at + 1] : undefined;
};

const LOCAL_UPLOAD = /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(\/uploads\/.+)$/;
const isLocal = (url) => /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/.test(url);
const MAX_DOCS = 50_000; // per collection — beyond that, this is not the tool

async function run() {
  const to = String(flag("--to") ?? publicApiUrl).replace(/\/$/, "");
  if (isLocal(to)) {
    console.error(`This machine's own address is "${to}" — nothing useful to change the pictures TO.\nSet PUBLIC_API_URL for this API (or pass --to https://your-api-address) and run again.`);
    process.exitCode = 1;
    return;
  }

  await connectDb({ uri: env.MONGODB_URI, dbName: env.MONGODB_DB });
  const db = mongoose.connection.db;
  const root = join(process.cwd(), env.UPLOADS_DIR);

  const changes = []; // { collection, id, path, old, next }
  const walk = (value, path, collection, id) => {
    if (typeof value === "string") {
      const m = value.match(LOCAL_UPLOAD);
      if (m) changes.push({ collection, id, path, old: value, next: `${to}${m[1]}` });
    } else if (Array.isArray(value)) value.forEach((v, i) => walk(v, path ? `${path}.${i}` : String(i), collection, id));
    else if (value && typeof value === "object" && !value._bsontype && !(value instanceof Date)) {
      for (const [k, v] of Object.entries(value)) {
        if (k.includes(".") || k.startsWith("$")) continue; // can't be addressed in an update; none of ours are like this
        walk(v, path ? `${path}.${k}` : k, collection, id);
      }
    }
  };

  for (const { name } of await db.listCollections().toArray()) {
    if (name.startsWith("system.")) continue;
    const count = await db.collection(name).estimatedDocumentCount();
    if (count > MAX_DOCS) {
      console.warn(`skipped ${name}: ${count} documents is more than this script scans (${MAX_DOCS})`);
      continue;
    }
    for await (const doc of db.collection(name).find({})) walk(doc, "", name, doc._id);
  }

  if (changes.length === 0) {
    console.log("No stored picture address points at localhost — nothing to do.");
    await disconnectDb();
    return;
  }

  // is each file actually here?
  const keyOf = (url) => decodeURI(url.match(LOCAL_UPLOAD)[1].slice("/uploads/".length));
  const missing = [...new Set(changes.map((c) => keyOf(c.old)))].filter((key) => !existsSync(join(root, key)));
  const byField = new Map();
  for (const c of changes) byField.set(`${c.collection} · ${c.path.replace(/\.\d+/g, "[]")}`, (byField.get(`${c.collection} · ${c.path.replace(/\.\d+/g, "[]")}`) ?? 0) + 1);

  console.log(`${changes.length} stored address(es) point at localhost; they would become ${to}/uploads/…`);
  for (const [field, n] of byField) console.log(`  ${String(n).padStart(4)}  ${field}`);
  console.log(`files under ${root}: ${new Set(changes.map((c) => keyOf(c.old))).size - missing.length} present, ${missing.length} missing`);
  for (const key of missing.slice(0, 30)) console.log(`  missing: ${key}`);

  if (!apply) {
    console.log("\nDry run — nothing was changed. Run again with --apply to write.");
    await disconnectDb();
    return;
  }
  if (missing.length > 0 && !allowMissing) {
    console.error(`\nRefusing to write: ${missing.length} file(s) are not in ${root}, so those pictures would still be broken (just at a different address).\nCopy the files here first, or pass --allow-missing.`);
    process.exitCode = 1;
    await disconnectDb();
    return;
  }

  const backup = join(process.cwd(), `fix-upload-urls.backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(backup, JSON.stringify(changes.map((c) => ({ collection: c.collection, id: String(c.id), path: c.path, old: c.old, next: c.next })), null, 1));
  console.log(`\nbackup of the old values: ${backup}`);

  const perDoc = new Map(); // "collection|id" -> { collection, id, $set }
  for (const c of changes) {
    const key = `${c.collection}|${c.id}`;
    const entry = perDoc.get(key) ?? { collection: c.collection, id: c.id, $set: {} };
    entry.$set[c.path] = c.next;
    perDoc.set(key, entry);
  }
  let written = 0;
  for (const { collection, id, $set } of perDoc.values()) {
    const r = await db.collection(collection).updateOne({ _id: id }, { $set });
    written += r.modifiedCount;
  }
  console.log(`updated ${written} document(s). Restart the API now so its cache lets go of the old addresses.`);

  notifyWebsite(); // the marketing website keeps rendered pages; ask it to rebuild them
  await new Promise((r) => setTimeout(r, 1500));
  await disconnectDb();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
