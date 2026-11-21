import { mongoose } from "@onetap/db";
import { UPLOAD_KEY_SOURCE } from "./upload-urls.js";

/**
 * Finding — and, when files move, rewriting — the places the database refers to a stored file.
 *
 * A picture is referred to by the address it is opened from (`/uploads/<key>` for this server's disk, a full web address
 * for a bucket) and, on menu pictures, by its `key` too. Those references sit in many collections (menu pictures, logos,
 * banners, store pages, chat attachments, the marketing website…), so — like the older normalize script — this walks every
 * collection that could hold one, rather than keeping a list that would need an update with every new feature.
 */

/** Collections that grow with every order or message and never hold a picture — skipped so a scan stays quick. */
const NEVER_HOLDS_PICTURES = new Set([
  "orders", "printjobs", "notificationlogs", "walletledgers", "couponredemptions", "sessions", "customersessions",
  "otpchallenges", "otpthrottles", "feedbacks", "carts", "cartreminders", "loginlogs", "tablesessions", "reservations",
  "customers", "loginstrikes", "loginblocks",
]);
const MAX_DOCS = 200_000;

/** every upload key that appears anywhere inside a string (a URL, a `key` field…) */
const KEY_IN_TEXT = new RegExp(UPLOAD_KEY_SOURCE, "g");
export const keysIn = (text) => (typeof text === "string" && text.length < 2000 ? (text.match(KEY_IN_TEXT) ?? []) : []);

async function* documents() {
  const db = mongoose.connection.db;
  for (const { name } of await db.listCollections().toArray()) {
    if (name.startsWith("system.") || NEVER_HOLDS_PICTURES.has(name)) continue;
    if ((await db.collection(name).estimatedDocumentCount()) > MAX_DOCS) continue;
    for await (const doc of db.collection(name).find({})) yield { collection: name, doc };
  }
}

/** Visit every string in a document with its path ("images.0.url"). Paths that can't be addressed in an update are skipped. */
function walk(value, path, visit) {
  if (typeof value === "string") visit(value, path);
  else if (Array.isArray(value)) value.forEach((v, i) => walk(v, path ? `${path}.${i}` : String(i), visit));
  else if (value && typeof value === "object" && !value._bsontype && !(value instanceof Date)) {
    for (const [k, v] of Object.entries(value)) {
      if (k.includes(".") || k.startsWith("$")) continue;
      walk(v, path ? `${path}.${k}` : k, visit);
    }
  }
}

/** Every upload key the database refers to, anywhere. */
export async function referencedKeys() {
  const keys = new Set();
  for await (const { doc } of documents()) walk(doc, "", (text) => keysIn(text).forEach((k) => keys.add(k)));
  return keys;
}

/**
 * The key a stored address stands for, if it is an address of OURS in one of the given forms — or null (another site's
 * picture, a data: URL…). `forms`: { local: true } for "/uploads/<key>" (any domain in front), `bases`: web-address
 * prefixes of a bucket, e.g. "https://pub-123.r2.dev".
 */
export function keyOfAddress(value, { local = false, bases = [] } = {}) {
  if (typeof value !== "string" || value.length > 2000) return null;
  const decode = (rest) => {
    try {
      return rest.split("/").map(decodeURIComponent).join("/");
    } catch {
      return rest;
    }
  };
  if (local) {
    const m = value.match(/^(?:https?:\/\/[^/\s]+)?\/uploads\/(.+)$/);
    if (m) return decode(m[1]);
  }
  for (const base of bases) {
    if (base && value.startsWith(`${base}/`)) return decode(value.slice(base.length + 1));
  }
  return null;
}

/**
 * Work out which stored addresses would change when the files move: any address of the OLD place (see `keyOfAddress`)
 * whose file is available in the NEW place (`available`: a Set of keys) becomes `newUrlFor(key)`. Nothing is written.
 * @returns {Promise<{ changes: Array<{ collection: string, id: any, path: string, old: string, next: string }> }>}
 */
export async function planLinkChanges({ old, available, newUrlFor, onlyBrandId }) {
  const changes = [];
  for await (const { collection, doc } of documents()) {
    walk(doc, "", (text, path) => {
      const key = keyOfAddress(text, old);
      if (!key || !available.has(key)) return;
      if (onlyBrandId && !key.startsWith(`${onlyBrandId}/`)) return;
      const next = newUrlFor(key);
      if (next && next !== text) changes.push({ collection, id: doc._id, path, old: text, next });
    });
  }
  return { changes };
}

/** Write what `planLinkChanges` found. Returns how many addresses were changed. */
export async function applyLinkChanges(changes) {
  const db = mongoose.connection.db;
  const perDoc = new Map();
  for (const c of changes) {
    const id = `${c.collection}|${c.id}`;
    const entry = perDoc.get(id) ?? { collection: c.collection, id: c.id, $set: {}, n: 0 };
    entry.$set[c.path] = c.next;
    entry.n += 1;
    perDoc.set(id, entry);
  }
  let changed = 0;
  for (const { collection, id, $set, n } of perDoc.values()) {
    const r = await db.collection(collection).updateOne({ _id: id }, { $set });
    if (r.modifiedCount) changed += n;
  }
  return changed;
}
