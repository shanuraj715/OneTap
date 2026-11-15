/**
 * A small in-memory cache for data that is read far more often than it changes.
 *
 *   const value = await cache.wrap("menu:abc", () => loadMenuFromDb(), { tags: ["brand:1", "menu:abc"] });
 *
 * - **Lifetime.** An entry is reused while it is younger than the configured
 *   lifetime (`ttlMs`, read on every access — so changing the setting takes
 *   effect at once, in both directions). Once older, the next request loads
 *   fresh data and the entry is rebuilt. Nothing is refreshed in the
 *   background: an idle cache costs nothing.
 * - **One load, many waiters.** If ten requests ask for the same missing entry
 *   together, the loader runs once and all ten get its result.
 * - **Tags.** Every entry can carry tags ("brand:<id>"). `expireTag` drops all
 *   entries with a tag, so one store's data can be thrown away without
 *   touching the others.
 * - **Never stores stale data.** A value whose tag was expired *while it was
 *   being loaded* is returned to the caller but not stored — it may have been
 *   read just before the change.
 * - **Bounded.** At most `maxEntries` entries and about `maxBytes` of data
 *   (least recently used go first). "Not found" answers live in a small
 *   separate pool so a flood of made-up addresses can't push real entries out.
 * - **Read-only values.** Cached objects are frozen, so a caller that tried to
 *   change one fails loudly instead of silently changing what everyone else sees.
 *
 * Values are cached per process. With several API processes on one database,
 * each has its own copy; they find out about "expire" requests through the
 * settings document (see modules/cache).
 */

const namespaceOf = (key) => {
  const i = key.indexOf(":");
  return i === -1 ? key : key.slice(0, i);
};

/** Freeze plain objects and arrays all the way down. Dates, ObjectIds and other class instances are left alone. */
function freezeDeep(value, seen = new Set()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  const proto = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && proto !== Object.prototype && proto !== null) return value;
  seen.add(value);
  Object.freeze(value);
  for (const key of Object.keys(value)) freezeDeep(value[key], seen);
  return value;
}

/** About how big a value is, in bytes. Only used to keep the cache within its limit. */
function sizeOf(value) {
  try {
    return (JSON.stringify(value) ?? "null").length;
  } catch {
    return 1024;
  }
}

export class TtlCache {
  #entries = new Map(); // key → entry; iteration order is least → most recently used
  #negatives = new Map(); // key → true; the "not found" entries, oldest first
  #byTag = new Map(); // tag → Set<key>
  #inflight = new Map(); // key → Promise
  #expiredAt = new Map(); // tag or "key:<key>" → clock value when last expired (stops a stale load being stored)
  #clock = 0; // ticks on every expire and every load start
  #allExpiredAt = 0;
  #bytes = 0;
  #counters = { hits: 0, misses: 0, coalesced: 0, bypassed: 0, loads: 0, loadErrors: 0, evictions: 0, expired: 0 };
  #perNamespace = new Map(); // namespace → { hits, misses }
  startedAt = Date.now();

  /**
   * @param {object} options
   * @param {() => number | Promise<number>} options.ttlMs  the configured lifetime in ms; 0 or less = caching off
   * @param {() => number} [options.now]
   */
  constructor({ ttlMs, now = Date.now, maxEntries = 1500, maxBytes = 48 * 1024 * 1024, maxNegatives = 300, negativeMs = 60_000 }) {
    this.ttlMs = ttlMs;
    this.now = now;
    this.maxEntries = maxEntries;
    this.maxBytes = maxBytes;
    this.maxNegatives = maxNegatives;
    this.negativeMs = negativeMs;
  }

  #count(key, field) {
    this.#counters[field]++;
    const ns = namespaceOf(key);
    const row = this.#perNamespace.get(ns) ?? { hits: 0, misses: 0 };
    if (field === "hits" || field === "misses") row[field]++;
    this.#perNamespace.set(ns, row);
  }

  /**
   * Return the cached value for `key`, loading it with `loader` when missing or too old.
   *
   * @param {string} key
   * @param {() => Promise<any>} loader
   * @param {object} [options]
   * @param {string[] | ((value: any) => string[])} [options.tags]  what expiring should reach this entry through
   * @param {number} [options.maxAgeMs]  a fixed lifetime that ignores the setting (even when the cache is "off")
   * @param {boolean} [options.cacheNull=true]  keep a `null`/`undefined` ("not found") answer — briefly, and in the small pool
   */
  async wrap(key, loader, options = {}) {
    const setting = await this.#configuredMs();
    const fixed = options.maxAgeMs;
    if ((fixed ?? setting) <= 0) {
      this.#count(key, "bypassed");
      return loader();
    }

    const entry = this.#entries.get(key);
    if (entry) {
      const allowed = entry.fixedMs ?? (entry.negative ? Math.min(setting, this.negativeMs) : setting);
      if (this.now() - entry.loadedAt < allowed) {
        // most recently used goes to the back
        this.#entries.delete(key);
        this.#entries.set(key, entry);
        entry.hits++;
        entry.lastUsedAt = this.now();
        this.#count(key, "hits");
        return entry.value;
      }
      this.#remove(key);
    }

    const waiting = this.#inflight.get(key);
    if (waiting) {
      this.#counters.coalesced++;
      return waiting;
    }

    this.#count(key, "misses");
    const startedAt = ++this.#clock;
    const promise = (async () => {
      try {
        const value = await loader();
        this.#counters.loads++;
        const tags = typeof options.tags === "function" ? options.tags(value) : (options.tags ?? []);
        const isNull = value === null || value === undefined;
        const unchangedSince = !this.#wasExpiredSince(key, tags, startedAt);
        if (unchangedSince && !(isNull && options.cacheNull === false)) {
          this.#store(key, value, { tags, fixedMs: fixed ?? null, negative: isNull });
        }
        return value;
      } catch (err) {
        this.#counters.loadErrors++;
        throw err;
      } finally {
        this.#inflight.delete(key);
      }
    })();
    this.#inflight.set(key, promise);
    return promise;
  }

  async #configuredMs() {
    try {
      return Number(await this.ttlMs()) || 0;
    } catch {
      return 0;
    }
  }

  #wasExpiredSince(key, tags, since) {
    if (this.#allExpiredAt > since) return true;
    if ((this.#expiredAt.get(`key:${key}`) ?? 0) > since) return true;
    return tags.some((tag) => (this.#expiredAt.get(tag) ?? 0) > since);
  }

  #store(key, value, { tags, fixedMs, negative }) {
    if (this.#entries.has(key)) this.#remove(key);
    const frozen = freezeDeep(value);
    const bytes = sizeOf(frozen);
    const at = this.now();
    this.#entries.set(key, { value: frozen, loadedAt: at, lastUsedAt: at, hits: 0, fixedMs, negative, tags, bytes });
    this.#bytes += bytes;
    for (const tag of tags) {
      let keys = this.#byTag.get(tag);
      if (!keys) this.#byTag.set(tag, (keys = new Set()));
      keys.add(key);
    }
    if (negative) {
      this.#negatives.set(key, true);
      while (this.#negatives.size > this.maxNegatives) this.#evict(this.#negatives.keys().next().value);
    }
    while (this.#entries.size > this.maxEntries || this.#bytes > this.maxBytes) {
      const oldest = this.#entries.keys().next().value;
      if (oldest === undefined || oldest === key) break;
      this.#evict(oldest);
    }
  }

  #remove(key) {
    const entry = this.#entries.get(key);
    if (!entry) return false;
    this.#entries.delete(key);
    this.#negatives.delete(key);
    this.#bytes -= entry.bytes;
    for (const tag of entry.tags) {
      const keys = this.#byTag.get(tag);
      if (keys) {
        keys.delete(key);
        if (keys.size === 0) this.#byTag.delete(tag);
      }
    }
    return true;
  }

  #evict(key) {
    if (this.#remove(key)) this.#counters.evictions++;
  }

  /** Drop one entry. */
  expireKey(key) {
    this.#expiredAt.set(`key:${key}`, ++this.#clock);
    const removed = this.#remove(key) ? 1 : 0;
    this.#counters.expired += removed;
    return removed;
  }

  /** Drop every entry that carries `tag`. Returns how many were dropped. */
  expireTag(tag) {
    this.#expiredAt.set(tag, ++this.#clock);
    let removed = 0;
    for (const key of [...(this.#byTag.get(tag) ?? [])]) if (this.#remove(key)) removed++;
    this.#counters.expired += removed;
    return removed;
  }

  expireTags(tags) {
    let removed = 0;
    for (const tag of tags) removed += this.expireTag(tag);
    return removed;
  }

  /** Drop everything. */
  expireAll() {
    this.#allExpiredAt = ++this.#clock;
    const removed = this.#entries.size;
    this.#entries.clear();
    this.#negatives.clear();
    this.#byTag.clear();
    this.#bytes = 0;
    this.#counters.expired += removed;
    return removed;
  }

  /** Remove entries that are past their lifetime but never asked for again (they'd only take up room). */
  async sweep() {
    const setting = await this.#configuredMs();
    let removed = 0;
    for (const [key, entry] of [...this.#entries]) {
      const allowed = entry.fixedMs ?? (entry.negative ? Math.min(setting, this.negativeMs) : setting);
      if (this.now() - entry.loadedAt >= allowed && this.#remove(key)) removed++;
    }
    return removed;
  }

  /** What is cached — all of it, or only what carries `tag`. */
  describe(tag) {
    const keys = tag ? [...(this.#byTag.get(tag) ?? [])] : [...this.#entries.keys()];
    const now = this.now();
    return keys
      .map((key) => ({ key, entry: this.#entries.get(key) }))
      .filter(({ entry }) => entry)
      .map(({ key, entry }) => ({
        key,
        namespace: namespaceOf(key),
        negative: entry.negative,
        fixedMs: entry.fixedMs,
        loadedAt: entry.loadedAt,
        ageMs: now - entry.loadedAt,
        idleMs: now - entry.lastUsedAt,
        hits: entry.hits,
        bytes: entry.bytes,
        tags: entry.tags,
      }));
  }

  /**
   * Look at one entry — its data included — without using it: no hit is counted, it isn't moved up the
   * "recently used" order and its age isn't reset. The console can inspect the cache without changing
   * what it is inspecting. `null` when nothing is cached under `key`.
   */
  peek(key) {
    const entry = this.#entries.get(key);
    if (!entry) return null;
    const now = this.now();
    return {
      key,
      namespace: namespaceOf(key),
      value: entry.value,
      negative: entry.negative,
      fixedMs: entry.fixedMs,
      loadedAt: entry.loadedAt,
      ageMs: now - entry.loadedAt,
      idleMs: now - entry.lastUsedAt,
      hits: entry.hits,
      bytes: entry.bytes,
      tags: entry.tags,
    };
  }

  /** How much it may hold before the least recently used entries are dropped. */
  limits() {
    return { maxEntries: this.maxEntries, maxBytes: this.maxBytes };
  }

  stats() {
    const { hits, misses } = this.#counters;
    const lookups = hits + misses;
    const namespaces = {};
    for (const [ns, row] of this.#perNamespace) namespaces[ns] = { ...row, entries: 0, bytes: 0 };
    for (const [key, entry] of this.#entries) {
      const ns = namespaceOf(key);
      namespaces[ns] ??= { hits: 0, misses: 0, entries: 0, bytes: 0 };
      namespaces[ns].entries++;
      namespaces[ns].bytes += entry.bytes;
    }
    return {
      ...this.#counters,
      entries: this.#entries.size,
      bytes: this.#bytes,
      hitRate: lookups ? hits / lookups : null,
      startedAt: this.startedAt,
      namespaces,
    };
  }

  /** Forget the counters (not the data). */
  resetStats() {
    for (const key of Object.keys(this.#counters)) this.#counters[key] = 0;
    this.#perNamespace.clear();
    this.startedAt = Date.now();
  }
}
