import { BrandModel, OutletModel } from "@rasoipulse/db";
import { HttpError } from "../../middleware/error.js";
import { cache, expireEverything, expireStore } from "../cache/cache.js";
import { platformConfig, savePlatformConfig } from "../cache/platform-config.js";
import { notifyWebsite } from "../site/revalidate.js";

/**
 * The console's controls over the API's cache: see what is cached, change how
 * long it is kept, and expire it — the admin panel's own, one outlet, one store, or everything.
 */

const NEGATIVE_MS = 60_000;

/**
 * Who is signed in (staff and customers) is kept too, but never shown here: the keys are derived from session tokens and
 * the data is about people. They still count in the totals.
 */
export const HIDDEN_KINDS = new Set(["auth", "cauth"]);
export const visibleEntries = (items) => items.filter((e) => !HIDDEN_KINDS.has(e.namespace));


/** The store and the outlet an entry is about, found from its tags and its key. */
export function idsOf(e) {
  const tag = e.tags.find((t) => t.startsWith("brand:"));
  const brandId = tag ? tag.slice("brand:".length) : null;
  let outletId = null;
  if (e.namespace === "menu") outletId = e.key.split(":")[2] ?? null; // menu:<store>:<outlet>
  else if (["outlet", "cap", "pages", "cfg", "outletaccess", "coupons"].includes(e.namespace)) outletId = e.key.slice(e.namespace.length + 1);
  return { brandId, outletId };
}

/**
 * What an expiry would drop, by the SAME rule the expiry uses (so the lists the console shows, the words in its confirmation and the number
 * it reports afterwards cannot disagree):
 *   admin   the remembered items that belong to no store: the console's dashboard numbers, the marketing website's pages and prices, and the
 *           "no store has this address" answers
 *   store   everything tagged with the store (its outlets' items too)
 *   outlet  only that outlet's own items (menu, settings, pages, offers, kitchen load, access check) — not the store's look, plan or addresses
 */
export function entriesFor({ scope, storeId, outletId }) {
  if (scope === "admin") return visibleEntries(cache.describe()).filter((e) => !e.tags.some((t) => t.startsWith("brand:")));
  if (scope === "store") return visibleEntries(cache.describe(`brand:${storeId}`));
  if (scope === "outlet") return visibleEntries(cache.describe(`brand:${storeId}`)).filter((e) => idsOf(e).outletId === String(outletId));
  return visibleEntries(cache.describe());
}

/** How long an entry may live right now, in ms. */
export const lifetimeOf = (entry, ttlSeconds) => entry.fixedMs ?? (entry.negative ? Math.min(ttlSeconds * 1000, NEGATIVE_MS) : ttlSeconds * 1000);

export async function cacheOverview() {
  const config = await platformConfig();
  const stats = cache.stats();

  // entries per store
  const perStore = new Map();
  for (const entry of visibleEntries(cache.describe())) {
    const brandTag = entry.tags.find((t) => t.startsWith("brand:"));
    if (!brandTag) continue;
    const id = brandTag.slice("brand:".length);
    const row = perStore.get(id) ?? { id, entries: 0, bytes: 0 };
    row.entries++;
    row.bytes += entry.bytes;
    perStore.set(id, row);
  }
  const ids = [...new Set([...perStore.keys(), ...Object.keys(config.cacheStoreExpiredAt)])].filter((id) => /^[0-9a-f]{24}$/i.test(id));
  const brands = ids.length ? await BrandModel.find({ _id: { $in: ids } }).select("name").lean() : [];
  const names = new Map(brands.map((b) => [String(b._id), b.name]));

  return {
    ttlSeconds: config.cacheTtlSeconds,
    enabled: config.cacheTtlSeconds > 0,
    lastExpiredAt: config.cacheExpiredAt,
    stats: {
      entries: stats.entries,
      bytes: stats.bytes,
      hits: stats.hits,
      misses: stats.misses,
      hitRate: stats.hitRate,
      coalesced: stats.coalesced,
      bypassed: stats.bypassed,
      evictions: stats.evictions,
      since: new Date(stats.startedAt).toISOString(),
      namespaces: stats.namespaces,
    },
    stores: ids
      .filter((id) => names.has(id))
      .map((id) => ({
        id,
        name: names.get(id),
        entries: perStore.get(id)?.entries ?? 0,
        bytes: perStore.get(id)?.bytes ?? 0,
        lastExpiredAt: config.cacheStoreExpiredAt[id] ?? null,
      }))
      .sort((a, b) => b.entries - a.entries || a.name.localeCompare(b.name)),
  };
}

/** How long cached data is reused, in seconds. 0 turns the cache off. Takes effect at once. */
export async function setCacheTtl(ttlSeconds) {
  await savePlatformConfig({ cacheTtlSeconds: ttlSeconds });
  return cacheOverview();
}

async function loadStoreName(id) {
  if (!/^[0-9a-f]{24}$/i.test(String(id))) throw new HttpError(404, "Store not found");
  const brand = await BrandModel.findById(id).select("name").lean();
  if (!brand) throw new HttpError(404, "Store not found");
  return brand.name;
}

async function loadOutletName(storeId, outletId) {
  if (!/^[0-9a-f]{24}$/i.test(String(outletId))) throw new HttpError(404, "Outlet not found");
  const outlet = await OutletModel.findOne({ _id: outletId }, null, { allowGlobalQuery: true }).select("name brandId").lean();
  if (!outlet || String(outlet.brandId) !== String(storeId)) throw new HttpError(404, "Outlet not found in that store");
  return outlet.name;
}

/**
 * Throw cached data away so the next visitor loads it fresh from the database. Nothing in the database changes.
 *   { scope: "all" }                       everything: every store and the admin panel (and the marketing website is told to refresh)
 *   { scope: "admin" }                     only what belongs to no store (see `entriesFor`); no store is touched
 *   { scope: "store", storeId }            everything remembered for that store, its outlets included
 *   { scope: "outlet", storeId, outletId } only that outlet's own items; the store's look, plan and addresses stay
 * `admin` and `outlet` act on the API server you are connected to; `all` and `store` also reach other API servers sharing the database.
 */
export async function expireCache({ scope, storeId, outletId }) {
  if (scope === "store") {
    const name = await loadStoreName(storeId);
    const done = await expireStore(storeId);
    return { scope, store: { id: String(storeId), name }, removed: done.removed, at: done.at };
  }
  if (scope === "outlet") {
    const storeName = await loadStoreName(storeId);
    const outletName = await loadOutletName(storeId, outletId);
    const removed = entriesFor({ scope, storeId, outletId }).reduce((n, e) => n + cache.expireKey(e.key), 0);
    return { scope, store: { id: String(storeId), name: storeName }, outlet: { id: String(outletId), name: outletName }, removed, at: new Date().toISOString() };
  }
  if (scope === "admin") {
    const removed = entriesFor({ scope }).reduce((n, e) => n + cache.expireKey(e.key), 0);
    notifyWebsite(); // the marketing website keeps its own copies of its pages
    return { scope, removed, at: new Date().toISOString() };
  }
  const done = await expireEverything();
  notifyWebsite();
  return { scope: "all", removed: done.removed, at: done.at };
}

/** What is cached for one store right now. */
export async function storeCache(storeId) {
  const name = await loadStoreName(storeId);
  const config = await platformConfig();
  const entries = visibleEntries(cache.describe(`brand:${storeId}`))
    .map((e) => ({
      key: e.key,
      kind: e.namespace,
      bytes: e.bytes,
      ageSeconds: Math.round(e.ageMs / 1000),
      expiresInSeconds: Math.max(0, Math.round((lifetimeOf(e, config.cacheTtlSeconds) - e.ageMs) / 1000)),
    }))
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.key.localeCompare(b.key));
  return {
    store: { id: String(storeId), name },
    ttlSeconds: config.cacheTtlSeconds,
    enabled: config.cacheTtlSeconds > 0,
    lastExpiredAt: config.cacheStoreExpiredAt[String(storeId)] ?? null,
    entries,
    bytes: entries.reduce((n, e) => n + e.bytes, 0),
  };
}
