/**
 * How the API itself is being used: requests, failures and speed, counted per minute
 * for the last hour. Kept in memory — a restart starts the count again.
 */

const MINUTE = 60_000;
const KEEP = 60;
const EDGES = [25, 50, 100, 250, 500, 1000, 2500]; // ms; the last bucket is "slower than 2.5 s"
const buckets = new Map(); // minute → { n, e5, e4, ms, max, h:[…] }
const startedAt = Date.now();

function bucket(now) {
  const key = Math.floor(now / MINUTE);
  let b = buckets.get(key);
  if (!b) {
    b = { n: 0, e5: 0, e4: 0, ms: 0, max: 0, h: new Array(EDGES.length + 1).fill(0) };
    buckets.set(key, b);
    for (const k of buckets.keys()) if (k < key - KEEP) buckets.delete(k);
  }
  return b;
}

export function recordRequest(status, ms, now = Date.now()) {
  const b = bucket(now);
  b.n++;
  if (status >= 500) b.e5++;
  else if (status >= 400) b.e4++;
  b.ms += ms;
  if (ms > b.max) b.max = ms;
  b.h[EDGES.findIndex((e) => ms <= e) === -1 ? EDGES.length : EDGES.findIndex((e) => ms <= e)]++;
}

/** Express middleware. The monitor's own polling and the health check are left out, so watching the page doesn't make it look busy. */
export function requestStats(req, res, next) {
  if (req.path === "/health" || req.path.startsWith("/api/platform/server")) return next();
  const started = process.hrtime.bigint();
  res.on("finish", () => recordRequest(res.statusCode, Number(process.hrtime.bigint() - started) / 1e6));
  next();
}

/** Totals over the last `minutes` minutes. */
export function requestSummary(minutes = 5, now = Date.now()) {
  const from = Math.floor(now / MINUTE) - (minutes - 1);
  const t = { n: 0, e5: 0, e4: 0, ms: 0, max: 0, h: new Array(EDGES.length + 1).fill(0) };
  for (const [key, b] of buckets) {
    if (key < from) continue;
    t.n += b.n;
    t.e5 += b.e5;
    t.e4 += b.e4;
    t.ms += b.ms;
    t.max = Math.max(t.max, b.max);
    b.h.forEach((c, i) => (t.h[i] += c));
  }
  // an approximate 95th percentile: the upper edge of the bucket that holds it
  let p95 = null;
  if (t.n) {
    let seen = 0;
    for (let i = 0; i < t.h.length; i++) {
      seen += t.h[i];
      if (seen >= t.n * 0.95) {
        p95 = i < EDGES.length ? EDGES[i] : Math.max(t.max, EDGES.at(-1));
        break;
      }
    }
  }
  return {
    minutes,
    requests: t.n,
    serverErrors: t.e5,
    clientErrors: t.e4,
    errorPct: t.n ? Math.round((t.e5 / t.n) * 1000) / 10 : 0,
    avgMs: t.n ? Math.round((t.ms / t.n) * 10) / 10 : null,
    p95Ms: p95,
    maxMs: Math.round(t.max),
    perMinute: Math.round((t.n / minutes) * 10) / 10,
  };
}

export const requestStatsSince = () => startedAt;

/** For tests. */
export function resetRequestStats() {
  buckets.clear();
}
