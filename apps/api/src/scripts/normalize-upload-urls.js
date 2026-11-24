import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { connectDb, disconnectDb, mongoose } from "@rasoipulse/db";
import { env } from "../env.js";
import { uploadPathOf } from "../modules/storage/upload-urls.js";

/**
 * Pictures used to be saved with their full web address ("http://localhost:3072/uploads/…",
 * "https://api.example.com/uploads/…"), which breaks the moment the domain, or the machine, changes. The API now
 * keeps only "/uploads/<key>" and adds the current domain when it sends data out — and it already does that for
 * the OLD saved addresses, so nothing is broken in the meantime.
 *
 * This tidies what is already stored to the same domain-free form (any collection, any field), so the database
 * holds just the picture's path. Only addresses shaped like OUR uploads are touched (see upload-urls.js); a logo
 * pasted from another site is left alone.
 *
 * Dry run unless --apply; writes a backup of every old value first; safe to run twice.
 *
 *   node src/scripts/normalize-upload-urls.js            # dry run
 *   node src/scripts/normalize-upload-urls.js --apply    # write (then restart the API: it caches in memory)
 */
const apply = process.argv.includes("--apply");
const MAX_DOCS = 50_000;

async function run() {
  await connectDb({ uri: env.MONGODB_URI, dbName: env.MONGODB_DB });
  const db = mongoose.connection.db;

  const changes = []; // { collection, id, path, old, next }
  const walk = (value, path, collection, id) => {
    if (typeof value === "string") {
      const stored = uploadPathOf(value);
      if (stored && stored !== value) changes.push({ collection, id, path, old: value, next: stored });
    } else if (Array.isArray(value)) value.forEach((v, i) => walk(v, path ? `${path}.${i}` : String(i), collection, id));
    else if (value && typeof value === "object" && !value._bsontype && !(value instanceof Date)) {
      for (const [k, v] of Object.entries(value)) {
        if (k.includes(".") || k.startsWith("$")) continue; // can't be addressed in an update
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
    console.log("Every picture address is already domain-free — nothing to do.");
    await disconnectDb();
    return;
  }

  const origins = new Map();
  for (const c of changes) {
    const origin = c.old.startsWith("/") ? "(none)" : c.old.slice(0, c.old.indexOf("/uploads/"));
    origins.set(origin, (origins.get(origin) ?? 0) + 1);
  }
  const fields = new Map();
  for (const c of changes) {
    const f = `${c.collection} · ${c.path.replace(/\.\d+/g, "[]")}`;
    fields.set(f, (fields.get(f) ?? 0) + 1);
  }
  console.log(`${changes.length} stored picture address(es) carry a domain; they would become "/uploads/<key>":`);
  for (const [f, n] of fields) console.log(`  ${String(n).padStart(4)}  ${f}`);
  console.log("domains being removed:");
  for (const [o, n] of origins) console.log(`  ${String(n).padStart(4)}  ${o}`);

  // informational: pictures are only shown if the file is on the machine that serves them
  const root = join(process.cwd(), env.UPLOADS_DIR);
  const missing = [...new Set(changes.map((c) => c.next.slice("/uploads/".length)))].filter((key) => !existsSync(join(root, key)));
  if (missing.length) {
    console.log(`note: ${missing.length} of those files are not under ${root} on THIS machine (they would not show here either way):`);
    for (const key of missing.slice(0, 200)) console.log(`  missing: ${key}`);
  }

  if (!apply) {
    console.log("\nDry run — nothing was changed. Run again with --apply to write.");
    await disconnectDb();
    return;
  }

  const backup = join(process.cwd(), `normalize-upload-urls.backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(backup, JSON.stringify(changes.map((c) => ({ collection: c.collection, id: String(c.id), path: c.path, old: c.old, next: c.next })), null, 1));
  console.log(`\nbackup of the old values: ${backup}`);

  const perDoc = new Map();
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
  console.log(`updated ${written} document(s). Restart the API now — its in-memory cache still holds the old addresses.`);
  await disconnectDb();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
