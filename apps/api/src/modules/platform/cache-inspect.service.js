import { BrandModel, OutletModel } from "@onetap/db";
import { HttpError } from "../../middleware/error.js";
import { cache } from "../cache/cache.js";
import { platformConfig } from "../cache/platform-config.js";
import { presentValue } from "./cache-present.js";
import { lifetimeOf } from "./cache.service.js";

/**
 * Looking inside the cache from the console: what is remembered right now, for which store, how big it is, how
 * old, when it reloads, how often it has been used — and the remembered data itself.
 *
 * Strictly read-only and side-effect free: listing and opening an item never counts as a use, never moves it up
 * the "recently used" order and never refreshes its age (see `TtlCache#peek`), so looking at the cache doesn't
 * change what the cache does. Secret-looking fields are hidden (see cache-present.js).
 */

const OBJECT_ID = /^[0-9a-f]{24}$/i;

/** What each kind of cached item is, in words (the "kind" is the part of the key before the first colon). */
export const KINDS = {
  host: { label: "Web address", what: "Which store a web address belongs to" },
  brandslug: { label: "Short name", what: "Which store a short name belongs to (developer addresses)" },
  outlet: { label: "Outlet's store", what: "Which store an outlet belongs to" },
  store: { label: "Store look & outlets", what: "A store's look, settings and outlets, as its visitors see them" },
  menu: { label: "Menu", what: "An outlet's menu: categories, items and option groups" },
  plan: { label: "Plan & limits", what: "A store's plan: its limits and what it unlocks" },
  pages: { label: "Store pages", what: "An outlet's published pages (About us, Contact…), as visitors see them" },
  cap: { label: "Kitchen load", what: "How many orders an outlet has in progress, to show the \"busy\" banner" },
  site: { label: "Website", what: "The TablePe website's pages, settings and pricing" },
  dash: { label: "Dashboard", what: "This console's dashboard numbers" },
};

/** The store and the outlet an entry is about, found from its tags and its key. */
function idsOf(e) {
  const tag = e.tags.find((t) => t.startsWith("brand:"));
  const brandId = tag ? tag.slice("brand:".length) : null;
  let outletId = null;
  if (e.namespace === "menu") outletId = e.key.split(":")[2] ?? null; // menu:<store>:<outlet>
  else if (e.namespace === "outlet" || e.namespace === "cap" || e.namespace === "pages") outletId = e.key.slice(e.namespace.length + 1);
  return { brandId, outletId };
}

const SITE_TITLES = { settings: "Website settings", pages: "Website page list", pricing: "Website pricing cards" };

/** A name for the entry a person would recognise, and what it is about. */
function titleOf(e, store, outlet) {
  const rest = e.key.slice(e.namespace.length + 1);
  switch (e.namespace) {
    case "host":
      return { label: "Web address", subject: rest };
    case "brandslug":
      return { label: "Short name", subject: rest };
    case "outlet":
      return { label: "Outlet's store", subject: outlet?.name ?? rest };
    case "store":
      return { label: "Store look & outlets", subject: store?.name ?? rest };
    case "menu":
      return { label: "Menu", subject: outlet?.name ?? rest };
    case "plan":
      return { label: "Plan & limits", subject: store?.name ?? rest };
    case "cap":
      return { label: "Kitchen load", subject: outlet?.name ?? rest };
    case "pages":
      return { label: "Store pages", subject: outlet?.name ?? rest };
    case "site":
      if (rest.startsWith("page:")) return { label: "Website page", subject: `/${rest.slice("page:".length)}` };
      return { label: SITE_TITLES[rest] ?? "Website", subject: rest };
    case "dash":
      return { label: "Dashboard numbers", subject: "Platform dashboard" };
    default:
      return { label: KINDS[e.namespace]?.label ?? e.namespace, subject: rest };
  }
}

/** Turn raw cache entries into rows for the console, with store and outlet names looked up in one go. */
async function describeRows(items, ttlSeconds) {
  const ids = items.map(idsOf);
  const brandIds = new Set();
  const outletIds = new Set();
  for (const { brandId, outletId } of ids) {
    if (brandId && OBJECT_ID.test(brandId)) brandIds.add(brandId);
    if (outletId && OBJECT_ID.test(outletId)) outletIds.add(outletId);
  }
  const [brands, outlets] = await Promise.all([
    brandIds.size ? BrandModel.find({ _id: { $in: [...brandIds] } }).select("name").lean() : [],
    outletIds.size ? OutletModel.find({ _id: { $in: [...outletIds] } }, null, { allowGlobalQuery: true }).select("name").lean() : [],
  ]);
  const brandName = new Map(brands.map((b) => [String(b._id), b.name]));
  const outletName = new Map(outlets.map((o) => [String(o._id), o.name]));

  return items.map((e, i) => {
    const { brandId, outletId } = ids[i];
    const store = brandId ? { id: brandId, name: brandName.get(brandId) ?? "A store that no longer exists" } : null;
    const outlet = outletId ? { id: outletId, name: outletName.get(outletId) ?? "An outlet that no longer exists" } : null;
    const lifetimeMs = lifetimeOf(e, ttlSeconds);
    return {
      key: e.key,
      kind: e.namespace,
      ...titleOf(e, store, outlet),
      store,
      outlet,
      bytes: e.bytes,
      cachedAt: new Date(e.loadedAt).toISOString(),
      ageSeconds: Math.floor(e.ageMs / 1000),
      expiresInSeconds: Math.max(0, Math.round((lifetimeMs - e.ageMs) / 1000)),
      lifetimeSeconds: Math.round(lifetimeMs / 1000),
      uses: e.hits,
      idleSeconds: Math.floor(e.idleMs / 1000),
      notFound: e.negative,
      ownLifetime: e.fixedMs !== null && e.fixedMs !== undefined,
    };
  });
}

/** Everything that is cached right now, one row each, plus the totals and the lists the console filters by. */
export async function listEntries() {
  const config = await platformConfig();
  const rows = await describeRows(cache.describe(), config.cacheTtlSeconds);
  rows.sort((a, b) => {
    if (Boolean(a.store) !== Boolean(b.store)) return a.store ? -1 : 1; // stores first, platform-wide last
    return (a.store?.name ?? "").localeCompare(b.store?.name ?? "") || a.kind.localeCompare(b.kind) || a.subject.localeCompare(b.subject);
  });

  const kinds = new Map();
  const stores = new Map();
  const platformWide = { entries: 0, bytes: 0 };
  let bytes = 0;
  let notFound = 0;
  for (const r of rows) {
    bytes += r.bytes;
    if (r.notFound) notFound++;
    const k = kinds.get(r.kind) ?? { kind: r.kind, label: KINDS[r.kind]?.label ?? r.kind, what: KINDS[r.kind]?.what ?? "", entries: 0, bytes: 0 };
    k.entries++;
    k.bytes += r.bytes;
    kinds.set(r.kind, k);
    if (r.store) {
      const s = stores.get(r.store.id) ?? { id: r.store.id, name: r.store.name, entries: 0, bytes: 0 };
      s.entries++;
      s.bytes += r.bytes;
      stores.set(r.store.id, s);
    } else {
      platformWide.entries++;
      platformWide.bytes += r.bytes;
    }
  }

  const stats = cache.stats();
  return {
    at: new Date().toISOString(),
    ttlSeconds: config.cacheTtlSeconds,
    enabled: config.cacheTtlSeconds > 0,
    lastExpiredAt: config.cacheExpiredAt,
    limits: cache.limits(),
    stats: { hits: stats.hits, misses: stats.misses, hitRate: stats.hitRate, since: new Date(stats.startedAt).toISOString() },
    totals: { entries: rows.length, bytes, notFound },
    kinds: [...kinds.values()].sort((a, b) => a.label.localeCompare(b.label)),
    stores: [...stores.values()].sort((a, b) => a.name.localeCompare(b.name)),
    platformWide,
    entries: rows,
  };
}

/** One cached item with its data (secrets hidden, very long lists cut short). */
export async function getEntry(key) {
  const found = cache.peek(key);
  if (!found) throw new HttpError(404, "That item isn't in the cache any more — it expired or was replaced. Refresh the list.");
  const config = await platformConfig();
  const [row] = await describeRows([found], config.cacheTtlSeconds);
  const shown = presentValue(found.value);
  return {
    ...row,
    what: KINDS[row.kind]?.what ?? "",
    tags: found.tags,
    value: shown.value,
    hiddenFields: shown.hidden,
    trimmed: shown.trimmed,
    shownChars: shown.chars,
  };
}
