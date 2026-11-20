import { PlatformSettingsModel } from "@onetap/db";

/**
 * The platform's settings document, kept in memory.
 *
 * Several things need these values on almost every request — how long to
 * cache, how long the grace period is — and none of them change more than a
 * few times a year. So the document is read once, then re-read at most every
 * 30 seconds and only while requests are coming in (an idle API never touches
 * the database for this). A change made through THIS process is visible
 * immediately; a change made by another API process sharing the database
 * shows up within 30 seconds.
 *
 * The same document carries "expire the cache" requests (see cache.js), which
 * is how every API process finds out about them.
 */

const REFRESH_MS = 30_000;
const DEFAULTS = { graceDays: 30, cacheTtlSeconds: 300, realtimeWebsocket: true };

let state = null;
let pending = null;
const listeners = new Set();

const iso = (d) => (d ? new Date(d).toISOString() : null);

function shape(doc) {
  return {
    graceDays: doc?.graceDays ?? DEFAULTS.graceDays,
    cacheTtlSeconds: doc?.cacheTtlSeconds ?? DEFAULTS.cacheTtlSeconds,
    realtimeWebsocket: doc?.realtimeWebsocket ?? DEFAULTS.realtimeWebsocket,
    cacheExpiredAt: iso(doc?.cacheExpiredAt),
    cacheStoreExpiredAt: Object.fromEntries(Object.entries(doc?.cacheStoreExpiredAt ?? {}).map(([id, at]) => [id, iso(at)])),
  };
}

function adopt(next) {
  const previous = state;
  state = { ...next, loadedAt: Date.now() };
  if (previous) {
    for (const listener of listeners) {
      try {
        listener(previous, state);
      } catch {
        /* a listener's trouble is not a settings problem */
      }
    }
  }
}

/** Read the document now. */
export async function refreshPlatformConfig() {
  adopt(shape(await PlatformSettingsModel.findOne({ key: "platform" }).lean()));
  return state;
}

/** The current settings (re-read in the background when older than 30 s). */
export async function platformConfig() {
  if (!state) {
    pending ??= refreshPlatformConfig().finally(() => {
      pending = null;
    });
    await pending;
    return state;
  }
  if (Date.now() - state.loadedAt > REFRESH_MS && !pending) {
    // if the read fails, try again in a few seconds rather than on every request
    state.loadedAt = Date.now() - REFRESH_MS + 5_000;
    pending = refreshPlatformConfig()
      .catch(() => {})
      .finally(() => {
        pending = null;
      });
  }
  return state;
}

/** Save a change to the settings document. Visible to this process immediately. */
export async function savePlatformConfig(patch, { unset = [] } = {}) {
  const update = { $set: patch, $setOnInsert: { key: "platform" } };
  if (unset.length) update.$unset = Object.fromEntries(unset.map((path) => [path, ""]));
  const doc = await PlatformSettingsModel.findOneAndUpdate({ key: "platform" }, update, { upsert: true, new: true }).lean();
  adopt(shape(doc));
  return state;
}

/** Be told when a re-read finds something different. `(previous, next) => void` */
export function onPlatformConfigChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** For tests: forget everything so the next call reads the database again. */
export function resetPlatformConfig() {
  state = null;
  pending = null;
}
