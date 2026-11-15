import { TtlCache } from "../../lib/ttl-cache.js";
import { onPlatformConfigChange, platformConfig, savePlatformConfig } from "./platform-config.js";

/**
 * The API's one shared cache. How long entries live is a platform setting
 * (Settings → Cache in the console), read from the database settings document.
 *
 * Keys are "<namespace>:<what>" and carry tags so they can be dropped in
 * groups:
 *   brand:<id>    everything about one store          ← "expire this store"
 *   menu:<id>     one outlet's menu
 *   ns:<name>     every entry of one kind (ns:store, ns:menu, ns:site, …)
 *   neg:host      "no store has this address" answers
 */
export const cache = new TtlCache({
  ttlMs: async () => (await platformConfig()).cacheTtlSeconds * 1000,
});

/* ----------------------------------------------------------- expiring on demand */

// Expiries this process asked for itself — it has already acted on them, so it
// must not act a second time when it re-reads them from the settings document.
const issued = new Set();
const remember = (token) => {
  issued.add(token);
  if (issued.size > 100) issued.delete(issued.values().next().value);
};

// Another API process (sharing this database) may have been asked to expire the
// cache. Its request is in the settings document; when we notice it, act on it.
onPlatformConfigChange((previous, next) => {
  if (next.cacheExpiredAt && next.cacheExpiredAt !== previous.cacheExpiredAt && !issued.has(`all@${next.cacheExpiredAt}`)) {
    cache.expireAll();
  }
  for (const [brandId, at] of Object.entries(next.cacheStoreExpiredAt)) {
    if (at !== previous.cacheStoreExpiredAt[brandId] && !issued.has(`${brandId}@${at}`)) {
      cache.expireTag(`brand:${brandId}`);
    }
  }
});

/** Throw away everything cached, here and (within ~30 s) in every other API process. */
export async function expireEverything() {
  const at = new Date();
  remember(`all@${at.toISOString()}`);
  const removed = cache.expireAll();
  await savePlatformConfig({ cacheExpiredAt: at });
  return { removed, at: at.toISOString() };
}

/** Throw away everything cached for one store: its look, menu, addresses and plan. */
export async function expireStore(brandId) {
  const id = String(brandId);
  const at = new Date();
  remember(`${id}@${at.toISOString()}`);
  const removed = cache.expireTag(`brand:${id}`);
  // other processes only need to hear about it for a little while — forget old stamps (and those of deleted stores) as we go
  const current = (await platformConfig()).cacheStoreExpiredAt;
  const old = Object.entries(current)
    .filter(([otherId, when]) => otherId !== id && Date.now() - new Date(when).getTime() > 24 * 3_600_000)
    .map(([otherId]) => `cacheStoreExpiredAt.${otherId}`);
  await savePlatformConfig({ [`cacheStoreExpiredAt.${id}`]: at }, { unset: old });
  return { removed, at: at.toISOString() };
}

/** Entries that are past their lifetime but never asked for again only take up room — clear them now and then. */
export function startCacheSweeper(everyMs = 60_000) {
  const timer = setInterval(() => void cache.sweep().catch(() => {}), everyMs);
  timer.unref();
  return () => clearInterval(timer);
}
