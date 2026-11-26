#!/usr/bin/env node
/**
 * API speed test — how fast the API answers, where the time goes, and how fast the database is.
 * Meant to be run ON THE SERVER, so the network between a phone and the server is not part of the numbers.
 *
 *   cd apps/api
 *   SPEED_EMAIL=you@example.com SPEED_PASSWORD='…' node src/scripts/speed-test.js       everything
 *   node src/scripts/speed-test.js --only db                  just the database
 *   node src/scripts/speed-test.js --runs 50 --json before.json
 *   node src/scripts/speed-test.js --load 10 --duration 15    also: 10 requests at a time for 15 seconds
 *   node src/scripts/speed-test.js --url http://127.0.0.1:3092   measure the LIVE API instead of a private copy
 *   node src/scripts/speed-test.js --compare before.json after.json   how two saved runs differ (no test is run)
 *   node src/scripts/speed-test.js --compare before.json      run now, then compare with the saved run
 *
 * HOW IT MEASURES
 *   By default it starts a private copy of the API inside this script (same code, same database from .env, a free
 *   local port, none of the background workers) and sends requests to it from 127.0.0.1. Because the copy runs here, the
 *   script can see inside each request:
 *     server  the time the API spent on the request, from "request arrived" to "answer sent" — no network at all
 *     db      the time spent waiting for the database during that (queries that run side by side are counted once)
 *     app     the rest: the API's own work (JavaScript, JSON, checking who you are)
 *     q       how many database queries the request made
 *   With --url it measures the live API from outside: only the total time is known, not the inside.
 *
 * WHAT IT TOUCHES
 *   It only READS. Every request it sends is a GET, except one sign-in and one sign-out (only when SPEED_EMAIL and
 *   SPEED_PASSWORD are set — a sign-in is how a person gets in, so it leaves one sign-in record). It creates no indexes
 *   and no collections. The database queries it explains are run as read-only `explain`.
 *   It uses about as much memory as one more API process (~150 MB) while it runs.
 *
 * tests/e2e/suites/api-speed-test.mjs (t106) runs this against a throwaway database.
 */
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import os from "node:os";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { monitorEventLoopDelay, performance } from "node:perf_hooks";
import { isMainThread, parentPort, Worker, workerData } from "node:worker_threads";

/* ================================================================== small pure helpers (exported for the tests) */

/** The p-th percentile (nearest rank) of an ascending list. */
export function percentile(sorted, p) {
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))];
}

/** n / min / avg / p50 / p95 / p99 / max of a list of numbers (null when empty). */
export function stats(values) {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const sum = v.reduce((a, b) => a + b, 0);
  return { n: v.length, min: v[0], avg: sum / v.length, p50: percentile(v, 50), p95: percentile(v, 95), p99: percentile(v, 99), max: v[v.length - 1] };
}

/** Total length of a set of [start, end] intervals, overlaps counted once (queries that ran side by side). */
export function mergedMs(intervals) {
  const sorted = intervals.map(([a, b]) => [a, Math.max(a, b)]).sort((x, y) => x[0] - y[0]);
  let total = 0;
  let curStart = null;
  let curEnd = null;
  for (const [a, b] of sorted) {
    if (curEnd === null || a > curEnd) {
      if (curEnd !== null) total += curEnd - curStart;
      curStart = a;
      curEnd = b;
    } else if (b > curEnd) curEnd = b;
  }
  if (curEnd !== null) total += curEnd - curStart;
  return total;
}

const isPlain = (v) => v !== null && typeof v === "object" && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);

/** A query with its values taken out: which fields and operators it uses, not which ids (so the same query groups together). */
const entriesOf = (v) => (v instanceof Map ? [...v.entries()] : v && typeof v === "object" ? Object.entries(v) : []);

export function skeleton(value) {
  if (value instanceof Map) return skeleton(Object.fromEntries(value)); // Mongoose sends a sort as a Map
  // a list of plain values ($in: [a, b, c]) is one shape whatever its length; a list of conditions ($or, a pipeline) keeps its parts
  if (Array.isArray(value)) return value.every((v) => v !== null && typeof v === "object") ? value.map(skeleton) : [1];
  if (isPlain(value)) return Object.fromEntries(Object.keys(value).sort().map((k) => [k, skeleton(value[k])]));
  return 1;
}

/** A short name for a query: collection · command · what it filters / sorts on. */
export function shapeOf(commandName, command) {
  const coll = typeof command?.[commandName] === "string" ? command[commandName] : "?";
  let body;
  if (commandName === "find") {
    const sort = entriesOf(command.sort).map(([k, d]) => `${k}:${d}`);
    body = { filter: skeleton(command.filter ?? {}), sort: sort.length ? sort : undefined, limit: command.limit ? true : undefined };
  }
  else if (commandName === "aggregate") body = { pipeline: (command.pipeline ?? []).map(skeleton) };
  else if (commandName === "count") body = { query: skeleton(command.query ?? {}) };
  else if (commandName === "distinct") body = { key: command.key, query: skeleton(command.query ?? {}) };
  else body = {};
  return { coll, text: `${coll} · ${commandName} · ${JSON.stringify(body)}`, key: `${coll}|${commandName}|${JSON.stringify(body)}` };
}

const KEYS_NOT_FOR_EXPLAIN = ["lsid", "$db", "$clusterTime", "$readPreference", "txnNumber", "readConcern", "batchSize", "singleBatch", "apiVersion", "apiStrict", "apiDeprecationErrors", "comment", "$audit", "$client"];
/** The command a driver sent, made safe to wrap in `explain` (a shallow copy: the values stay real BSON values). */
export function cleanForExplain(commandName, command) {
  const clean = { ...command };
  for (const k of KEYS_NOT_FOR_EXPLAIN) delete clean[k];
  if (commandName === "aggregate") clean.cursor = {};
  return clean;
}

function findExecution(node, depth = 0) {
  if (!node || typeof node !== "object" || depth > 6) return null;
  if (node.executionStats && node.queryPlanner) return node;
  for (const v of Array.isArray(node) ? node : Object.values(node)) {
    const hit = findExecution(v, depth + 1);
    if (hit) return hit;
  }
  return null;
}

/**
 * What a MongoDB `explain("executionStats")` answer means in plain terms: which index (if any) the query used, whether it had to read the
 * whole collection (COLLSCAN) or sort in memory (SORT), and how many documents it read to return how many.
 */
export function planSummary(explain) {
  const hit = findExecution(explain);
  if (!hit) return { ok: false };
  const stages = [];
  const indexes = [];
  const walk = (n) => {
    if (!n || typeof n !== "object") return;
    if (n.stage) stages.push(n.stage);
    if (n.indexName) indexes.push(n.indexName);
    for (const k of ["inputStage", "thenStage", "elseStage", "queryPlan"]) walk(n[k]);
    for (const s of n.inputStages ?? []) walk(s);
  };
  walk(hit.queryPlanner?.winningPlan);
  const es = hit.executionStats;
  const returned = es.nReturned ?? null;
  const docs = es.totalDocsExamined ?? null;
  return {
    ok: true,
    stages,
    indexes,
    index: indexes[0] ?? null,
    collscan: stages.includes("COLLSCAN"),
    sort: stages.includes("SORT"),
    returned,
    docsExamined: docs,
    keysExamined: es.totalKeysExamined ?? null,
    millis: es.executionTimeMillis ?? null,
    inefficient: docs !== null && returned !== null && docs >= 200 && docs > 10 * Math.max(returned, 1),
    // a scan or an in-memory sort only costs something once there is something to read: with a few documents it is harmless
    collscanMatters: stages.includes("COLLSCAN") && (docs ?? 0) >= 100,
    sortMatters: stages.includes("SORT") && (docs ?? 0) >= 100,
  };
}

/** Methods this script may send. Everything else is refused here, so a bug in the test can't change data. */
export function assertReadOnly(method, path) {
  if (method === "GET") return;
  if (method === "POST" && (path === "/api/auth/login" || path === "/api/auth/logout")) return;
  throw new Error(`The speed test only reads: refusing ${method} ${path}`);
}

const short = (t, n) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
const f1 = (n) => (n === null || n === undefined || !Number.isFinite(n) ? "—" : n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2));
const kb = (n) => (n === null || n === undefined ? "—" : n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : n >= 1024 ? `${(n / 1024).toFixed(0)} KB` : `${Math.round(n)} B`);
const pct = (a, b) => (a && b !== null && b !== undefined ? `${b >= a ? "+" : "−"}${Math.abs(((b - a) / a) * 100).toFixed(0)}%` : "");

function table(rows, columns) {
  const widths = columns.map((c) => Math.max(c.label.length, ...rows.map((r) => String(r[c.key] ?? "").length)));
  const line = (cells) => cells.map((cell, i) => (columns[i].left ? String(cell).padEnd(widths[i]) : String(cell).padStart(widths[i]))).join("  ");
  const out = [line(columns.map((c) => c.label)), line(widths.map((w) => "─".repeat(w)))];
  for (const r of rows) out.push(line(columns.map((c) => r[c.key] ?? "")));
  return out.map((l) => `   ${l}`).join("\n");
}

/* ================================================================== sending requests */

const agents = { "http:": new http.Agent({ keepAlive: true, maxSockets: 64 }), "https:": new https.Agent({ keepAlive: true, maxSockets: 64 }) };

/** One request. Never throws: a failure comes back as status 0 with `error`. `ms` is the whole trip on this machine. */
export function send(base, path, { method = "GET", headers = {}, body, keepBody = false } = {}) {
  assertReadOnly(method, path.split("?")[0]);
  return new Promise((resolve) => {
    const u = new URL(path, base);
    const lib = u.protocol === "https:" ? https : http;
    const t0 = performance.now();
    const req = lib.request(
      { hostname: u.hostname, port: u.port, path: u.pathname + u.search, method, agent: agents[u.protocol], headers: { accept: "application/json", ...(body ? { "content-type": "application/json", "content-length": Buffer.byteLength(body) } : {}), ...headers } },
      (res) => {
        let bytes = 0;
        const chunks = [];
        res.on("data", (c) => {
          bytes += c.length;
          if (keepBody) chunks.push(c);
        });
        res.on("end", () => resolve({ status: res.statusCode, ms: performance.now() - t0, bytes, headers: res.headers, body: keepBody ? Buffer.concat(chunks).toString("utf8") : "" }));
        res.on("error", (e) => resolve({ status: 0, ms: performance.now() - t0, bytes, headers: {}, error: e.message }));
      },
    );
    req.on("error", (e) => resolve({ status: 0, ms: performance.now() - t0, bytes: 0, headers: {}, error: e.message }));
    req.setTimeout(30_000, () => req.destroy(new Error("no answer after 30 s")));
    if (body) req.write(body);
    req.end();
  });
}

/* ================================================================== load test: a worker thread sends the requests (so the API's own thread isn't also the client) */

async function workerMain() {
  const { base, endpoints, conns, durationMs } = workerData;
  const results = endpoints.map(() => ({ ms: [], statuses: {} }));
  const startedAt = performance.now();
  const endAt = startedAt + durationMs;
  let counter = 0;
  const loop = async () => {
    while (performance.now() < endAt) {
      const i = counter++ % endpoints.length;
      const r = await send(base, endpoints[i].path, { headers: endpoints[i].headers });
      results[i].ms.push(r.ms);
      results[i].statuses[r.status] = (results[i].statuses[r.status] ?? 0) + 1;
    }
  };
  await Promise.all(Array.from({ length: conns }, loop));
  parentPort.postMessage({ results, elapsedMs: performance.now() - startedAt });
}

function runLoad(base, endpoints, conns, durationMs) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(fileURLToPath(import.meta.url), { workerData: { base, endpoints, conns, durationMs } });
    worker.once("message", resolve);
    worker.once("error", reject);
  });
}

/* ================================================================== the test */

const DATA_COMMANDS = new Set(["find", "aggregate", "count", "distinct", "getMore", "insert", "update", "delete", "findAndModify"]);
const WRITE_COMMANDS = new Set(["insert", "update", "delete", "findAndModify"]);
const EXPLAINABLE = new Set(["find", "aggregate", "count", "distinct"]);

const HELP = `API speed test — run it on the server (see the top of src/scripts/speed-test.js).

  --runs N          measured requests per endpoint (default 30)
  --warmup N        requests sent first and thrown away (default 3)
  --only a,b        sections to show: db, api, plans, load (default db,api,plans)
  --load N          also send N requests at a time (1-20) for --duration seconds
  --duration S      length of the load test (1-60, default 10)
  --url URL         measure the live API at URL instead of a private copy
  --outlet ID       which outlet to test (default: the outlet with the newest order)
  --json FILE       save everything to FILE (for --compare)
  --compare A [B]   compare saved runs: two files = compare them; one file = run now and compare with it
Sign in for the dashboard endpoints with SPEED_EMAIL and SPEED_PASSWORD (environment variables, never arguments).`;

async function main() {
  const { values: opt, positionals } = parseArgs({
    options: {
      runs: { type: "string", default: "30" }, warmup: { type: "string", default: "3" }, only: { type: "string" }, load: { type: "string" }, duration: { type: "string", default: "10" },
      url: { type: "string" }, outlet: { type: "string" }, json: { type: "string" }, compare: { type: "string", multiple: true }, help: { type: "boolean", short: "h" },
    },
    allowPositionals: true, // `--compare before.json after.json`: the second file arrives as a positional
  });
  if (positionals.length && !opt.compare?.length) throw new Error(`unexpected argument "${positionals[0]}" (see --help)`);
  if (opt.compare?.length) opt.compare = [...opt.compare, ...positionals];
  if (opt.compare && opt.compare.length > 2) throw new Error("--compare takes one file (run now and compare) or two files (compare them)");
  if (opt.help) return console.log(HELP);
  const inRange = (name, v, lo, hi) => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < lo || n > hi) throw new Error(`--${name} must be a whole number from ${lo} to ${hi}`);
    return n;
  };
  if (opt.compare?.length === 2) return printComparison(readRun(opt.compare[0]), readRun(opt.compare[1]), opt.compare);
  const RUNS = inRange("runs", opt.runs, 1, 1000);
  const WARMUP = inRange("warmup", opt.warmup, 0, 50);
  const LOAD = opt.load === undefined ? 0 : inRange("load", opt.load, 1, 20);
  const DURATION = inRange("duration", opt.duration, 1, 60);
  const showing = new Set((opt.only ?? (LOAD ? "db,api,plans,load" : "db,api,plans")).split(",").map((s) => s.trim()).filter(Boolean));
  for (const s of showing) if (!["db", "api", "plans", "load"].includes(s)) throw new Error(`--only: unknown section "${s}" (use db, api, plans, load)`);
  const LIVE = !!opt.url;

  /* ---- set up: a private copy of the API unless --url (it must be configured BEFORE the app is loaded) */
  if (!LIVE) {
    process.env.RATE_LIMITS = "off"; // this copy is ours alone: no limit should slow the test (the live API keeps its own)
  }
  const { mongoose } = await import("@rasoipulse/db");
  mongoose.set("strictQuery", true);
  mongoose.set("autoIndex", false); // never create or change indexes on the real database
  mongoose.set("autoCreate", false);
  const { env } = await import("../env.js");
  const dbName = env.MONGODB_DB;

  const report = { meta: {}, db: null, endpoints: [], plans: [], load: null };
  const say = (s = "") => console.log(s);
  const mode = LIVE ? `the LIVE API at ${opt.url} (measured from outside: total time only)` : "a private copy of the API (same code, same database; time measured inside)";
  let dbHost = "unknown";
  try { dbHost = new URL(env.MONGODB_URI).host || "unknown"; } catch { /* a URI the URL parser doesn't know */ }
  const cpus = os.cpus();
  report.meta = { when: new Date().toISOString(), node: process.version, cpus: cpus.length, cpuModel: cpus[0]?.model ?? "", loadAvg: os.loadavg()[0], freeMemMb: Math.round(os.freemem() / 1048576), totalMemMb: Math.round(os.totalmem() / 1048576), database: `${dbHost} / ${dbName}`, mode: LIVE ? "live" : "private-copy", runs: RUNS, warmup: WARMUP };
  say(`API speed test · ${report.meta.when}`);
  say(`Machine   ${cpus.length} CPU · load ${os.loadavg()[0].toFixed(2)} · ${report.meta.freeMemMb} MB of ${report.meta.totalMemMb} MB memory free · Node ${process.version}`);
  say(`Database  ${report.meta.database}`);
  say(`Mode      ${mode}`);
  say(`Reads only: every request is a GET, except one sign-in and sign-out when SPEED_EMAIL / SPEED_PASSWORD are set.`);

  /* ---- the database */
  let db = null;
  let connectMs = null;
  const captureState = { sink: null };
  const inflight = new Map();
  const planPool = new Map(); // key → { shape, name, command, calls, ms, endpoints:Set }
  try {
    const t0 = performance.now();
    await mongoose.connect(env.MONGODB_URI, { dbName, serverSelectionTimeoutMS: 8000, monitorCommands: true });
    db = mongoose.connection.db;
    await db.admin().ping();
    connectMs = performance.now() - t0;
    const client = mongoose.connection.getClient();
    client.on("commandStarted", (ev) => {
      if (!captureState.sink || !DATA_COMMANDS.has(ev.commandName) || ev.databaseName !== dbName) return;
      const coll = typeof ev.command[ev.commandName] === "string" ? ev.command[ev.commandName] : ev.command.collection;
      inflight.set(ev.requestId, { name: ev.commandName, coll, t0: performance.now(), command: ev.command });
    });
    const done = (ev) => {
      const s = inflight.get(ev.requestId);
      if (!s) return;
      inflight.delete(ev.requestId);
      captureState.sink?.cmds.push({ ...s, t1: performance.now(), ms: ev.duration });
    };
    client.on("commandSucceeded", done);
    client.on("commandFailed", done);
  } catch (e) {
    say(`\nThe database can't be reached from here (${e.message}). The database section is skipped${LIVE ? "" : "; without it the private copy can't answer, so only --url tests are possible"}.`);
    if (!LIVE) process.exit(1);
  }

  if (db && showing.has("db")) {
    say("\n1. DATABASE — how fast MongoDB answers (round trip includes the network between this server and the database)");
    const N = Math.max(20, Math.min(RUNS, 100));
    const pings = [];
    for (let i = 0; i < N; i++) {
      const t = performance.now();
      await db.admin().ping();
      pings.push(performance.now() - t);
    }
    const trivial = [];
    for (let i = 0; i < N; i++) {
      const t = performance.now();
      await db.collection("outlets").findOne({}, { projection: { _id: 1 } });
      trivial.push(performance.now() - t);
    }
    let counts = [];
    try {
      const names = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name).filter((n) => !n.startsWith("system."));
      counts = (await Promise.all(names.map(async (name) => ({ name, docs: await db.collection(name).estimatedDocumentCount() })))).sort((a, b) => b.docs - a.docs);
    } catch { /* a read-only user can't list: skip */ }
    report.db = { connectMs, ping: stats(pings), trivialRead: stats(trivial), collections: counts.length, biggest: counts.slice(0, 10) };
    const range = (s) => `${f1(s.p50)} ms typical · ${f1(s.p95)} ms slow (95%) · ${f1(s.max)} ms worst`;
    say(`   connect (first time)      ${f1(connectMs)} ms`);
    say(`   ping, round trip          ${range(report.db.ping)}`);
    say(`   read one small document   ${range(report.db.trivialRead)}`);
    say("   (a ping does no work in MongoDB: it is almost all travel. A small read adds a little work on top.)");
    if (counts.length) say(`   biggest collections: ${counts.slice(0, 6).map((c) => `${c.name} ${c.docs.toLocaleString("en-IN")}`).join(" · ")} (of ${counts.length})`);
  }

  /* ---- the API */
  let base = opt.url?.replace(/\/$/, "");
  let server = null;
  let lastCapture = null;
  if (!LIVE) {
    const { logger } = await import("../logger.js");
    logger.level = "silent";
    const { createApp } = await import("../app.js");
    const app = createApp();
    server = http.createServer((req, res) => {
      if (captureState.off) return app(req, res); // load test: don't pay for watching every query
      const t0 = performance.now();
      const cap = { cmds: [], serverMs: 0 };
      captureState.sink = cap;
      res.on("finish", () => {
        cap.serverMs = performance.now() - t0;
        captureState.sink = null;
        lastCapture = cap;
      });
      app(req, res);
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${server.address().port}`;
  }
  await send(base, "/health"); // opens the connection, so the first real request isn't charged for it

  const outletOf = async () => {
    if (opt.outlet) return { id: opt.outlet, label: opt.outlet };
    if (!db) return null;
    try {
      const newest = await db.collection("orders").find({}, { projection: { outletId: 1 } }).sort({ createdAt: -1 }).limit(1).toArray();
      const id = newest[0]?.outletId ?? (await db.collection("outlets").findOne({}, { projection: { _id: 1 } }))?._id;
      if (!id) return null;
      const o = await db.collection("outlets").findOne({ _id: typeof id === "string" && /^[a-f\d]{24}$/.test(id) ? new mongoose.Types.ObjectId(id) : id }, { projection: { name: 1, slug: 1 } });
      return { id: String(id), label: o ? `${o.name ?? o.slug} (${id})` : String(id) };
    } catch { return null; }
  };
  let outlet = await outletOf();

  /* sign in (once) when asked */
  let cookie = null;
  const email = process.env.SPEED_EMAIL;
  const password = process.env.SPEED_PASSWORD;
  if (email && password) {
    const r = await send(base, "/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }), keepBody: true });
    const set = [].concat(r.headers["set-cookie"] ?? []).find((c) => c.startsWith("rasoipulse_session="));
    if (r.status === 200 && set) cookie = set.split(";")[0];
    else say(`\nSign-in as ${email} did not work (${r.status}: ${(() => { try { return JSON.parse(r.body).error; } catch { return r.error ?? "no reason given"; } })()}). Only the endpoints that need no sign-in are tested.`);
  } else if (showing.has("api") || showing.has("plans") || showing.has("load")) {
    say("\nNo sign-in (SPEED_EMAIL / SPEED_PASSWORD not set): only the public endpoints are tested. The dashboard and app endpoints need one.");
  }
  if (cookie && !outlet) {
    const r = await send(base, "/api/outlets", { headers: { cookie }, keepBody: true });
    try { const first = JSON.parse(r.body).outlets?.[0]; if (first) outlet = { id: String(first._id ?? first.id), label: first.name ?? String(first._id) }; } catch { /* leave it */ }
  }
  report.meta.outlet = outlet?.label ?? null;

  const oid = outlet ? encodeURIComponent(outlet.id) : "";
  const asUser = cookie ? { cookie, ...(outlet ? { "x-rasoipulse-outlet": outlet.id } : {}) } : null;
  const endpoints = [
    { name: "health (empty request)", path: "/health" },
    { name: "app update check", path: "/api/app-updates/check?app=oma&versionCode=1" },
    { name: "apps list (website)", path: "/api/app-updates/apps" },
    { name: "website pages", path: "/api/site/pages" },
    ...(outlet ? [
      { name: "storefront menu", path: `/api/menu?outletId=${oid}` },
      { name: "menu: what can't be ordered", path: `/api/menu/unavailable?outletId=${oid}` },
    ] : []),
    ...(asUser ? [
      { name: "who am I", path: "/api/auth/me", headers: asUser },
      { name: "my outlets", path: "/api/outlets", headers: asUser },
      ...(outlet ? [
        { name: "tables board", path: "/api/tables", headers: asUser },
        { name: "tables: active sessions", path: "/api/tables/sessions/active", headers: asUser },
        { name: "orders list (100)", path: "/api/orders?limit=100", headers: asUser },
        { name: "kitchen board", path: "/api/kitchen/orders?screen=all", headers: asUser },
        { name: "kitchen dishes", path: "/api/kitchen/items", headers: asUser },
        { name: "kitchen today's numbers", path: "/api/kitchen/summary", headers: asUser },
        { name: "dashboard stats", path: "/api/dashboard/stats", headers: asUser },
      ] : []),
    ] : []),
  ];

  const results = [];
  if (showing.has("api") || showing.has("plans") || showing.has("load")) {
    const measure = async (ep) => {
      const take = async () => {
        lastCapture = null;
        const r = await send(base, ep.path, { headers: ep.headers });
        const cap = lastCapture;
        const dbWall = cap ? mergedMs(cap.cmds.map((c) => [c.t0, c.t1])) : null;
        return { ...r, server: cap ? cap.serverMs : null, dbWall, dbSum: cap ? cap.cmds.reduce((a, c) => a + c.ms, 0) : null, queries: cap ? cap.cmds.length : null, writes: cap ? cap.cmds.filter((c) => WRITE_COMMANDS.has(c.name)).length : null, cap };
      };
      const first = await take();
      for (let i = 0; i < WARMUP; i++) await take();
      const runs = [];
      for (let i = 0; i < RUNS; i++) {
        const r = await take();
        runs.push(r);
        for (const c of r.cap?.cmds ?? []) {
          if (!EXPLAINABLE.has(c.name) || !c.command) continue;
          const shape = shapeOf(c.name, c.command);
          const e = planPool.get(shape.key) ?? { shape, name: c.name, command: c.command, calls: 0, ms: 0, endpoints: new Set() };
          e.calls++;
          e.ms += c.ms;
          e.endpoints.add(ep.name);
          planPool.set(shape.key, e);
        }
      }
      const ok = runs.filter((r) => r.status >= 200 && r.status < 300);
      const mean = (k) => (ok.length && ok[0][k] !== null ? ok.reduce((a, r) => a + r[k], 0) / ok.length : null);
      return {
        name: ep.name, path: ep.path, status: first.status, error: first.error ?? null,
        ok: ok.length === runs.length && runs.length > 0,
        first: { total: first.ms, server: first.server, queries: first.queries },
        total: stats(ok.map((r) => r.ms)), server: ok[0]?.server === null || ok[0]?.server === undefined ? null : stats(ok.map((r) => r.server)),
        dbWall: mean("dbWall"), dbSum: mean("dbSum"), app: ok.length && ok[0].server !== null && ok[0].server !== undefined ? ok.reduce((a, r) => a + Math.max(0, r.server - (r.dbWall ?? 0)), 0) / ok.length : null,
        queries: mean("queries"), writes: mean("writes"), bytes: mean("bytes"),
      };
    };
    for (const ep of endpoints) results.push(await measure(ep));
    report.endpoints = results;

    if (showing.has("api")) {
      say(`\n2. API — response time per endpoint (${WARMUP} warm-up + ${RUNS} measured requests each, one at a time; ms)`);
      say(table(results.map((r) => ({
        name: r.name, status: r.status || "ERR", first: f1(r.first.total), p50: f1(r.total?.p50), p95: f1(r.total?.p95), max: f1(r.total?.max), size: kb(r.bytes),
      })), [
        { key: "name", label: "endpoint", left: true }, { key: "status", label: "HTTP" }, { key: "first", label: "first" }, { key: "p50", label: "typical" }, { key: "p95", label: "slow 95%" }, { key: "max", label: "worst" }, { key: "size", label: "answer size" },
      ]));
      say("   first = the very first request (cold caches) · typical = the middle request · slow 95% = 19 of 20 requests were faster than this");
      for (const r of results.filter((x) => !x.ok)) say(`   ! ${r.name}: answered ${r.status || r.error} — not counted${r.status === 401 || r.status === 403 ? " (check the sign-in's role and outlet)" : ""}`);
      if (!LIVE) {
        say("\n   Where the time goes inside the API (ms, averages)");
        say(table(results.filter((r) => r.ok).map((r) => ({
          name: r.name, server: f1(r.server?.avg), db: f1(r.dbWall), app: f1(r.app), q: r.queries === null ? "—" : r.queries.toFixed(1), dbsum: f1(r.dbSum), w: r.writes ? r.writes.toFixed(1) : "",
        })), [
          { key: "name", label: "endpoint", left: true }, { key: "server", label: "server" }, { key: "db", label: "waiting for db" }, { key: "app", label: "API's own work" }, { key: "q", label: "queries" }, { key: "dbsum", label: "db sum" }, { key: "w", label: "writes" },
        ]));
        say("   server = arrival → answer sent, no network · db sum adds queries that ran side by side · writes = database writes made by this GET");
      }
    }

    /* ---- query plans */
    if (!LIVE && db && (showing.has("plans"))) {
      const top = [...planPool.values()].sort((a, b) => b.ms - a.ms).slice(0, 25);
      for (const e of top) {
        let plan;
        try {
          plan = planSummary(await db.command({ explain: cleanForExplain(e.name, e.command), verbosity: "executionStats" }));
        } catch (err) {
          plan = { ok: false, error: err.message };
        }
        report.plans.push({ query: e.shape.text, collection: e.shape.coll, command: e.name, calls: e.calls, avgMs: e.ms / e.calls, endpoints: [...e.endpoints], ...plan });
      }
      say(`\n3. QUERY PLANS — how MongoDB runs the ${report.plans.length} busiest queries (read-only explain)`);
      for (const p of report.plans) {
        const verdict = !p.ok ? `could not explain${p.error ? ` (${p.error.slice(0, 60)})` : ""}` : p.collscan ? (p.collscanMatters ? "READS THE WHOLE COLLECTION (no index)" : `reads the whole collection (only ${p.docsExamined} documents so far: harmless now, slower as it grows)`) : p.index ? `index ${p.index}` : "no index used";
        const flags = [p.sort ? "sorts in memory" : "", p.inefficient ? `reads ${p.docsExamined} documents to return ${p.returned}` : ""].filter(Boolean);
        say(`   ${short(p.query, 150)}`);
        say(`      ${verdict}${flags.length ? ` · ${flags.join(" · ")}` : ""}${p.ok ? ` · returned ${p.returned} · read ${p.docsExamined} docs / ${p.keysExamined} index keys · ${p.millis} ms in MongoDB` : ""} · ${f1(p.avgMs)} ms per call incl. network · used by ${p.endpoints.join(", ")}`);
      }
    }

    /* ---- load */
    if (LOAD) {
      const targets = results.filter((r) => r.ok).map((r) => endpoints.find((e) => e.name === r.name)).map((e) => ({ name: e.name, path: e.path, headers: e.headers ?? {} }));
      say(`\n4. LOAD — ${LOAD} requests at a time for ${DURATION} s over ${targets.length} endpoints${LIVE ? " (the live API: its own rate limits apply and are counted as errors)" : ""}`);
      if (!targets.length) say("   nothing to test: no endpoint answered successfully.");
      else {
        captureState.off = true;
        const lag = !LIVE ? monitorEventLoopDelay({ resolution: 10 }) : null;
        lag?.enable();
        const elu0 = !LIVE ? performance.eventLoopUtilization() : null;
        const out = await runLoad(base, targets, LOAD, DURATION * 1000);
        lag?.disable();
        captureState.off = false;
        const util = elu0 ? performance.eventLoopUtilization(elu0).utilization : null;
        const all = out.results.flatMap((r) => r.ms);
        const statuses = {};
        for (const r of out.results) for (const [s, n] of Object.entries(r.statuses)) statuses[s] = (statuses[s] ?? 0) + n;
        const good = Object.entries(statuses).filter(([s]) => s >= 200 && s < 300).reduce((a, [, n]) => a + n, 0);
        const secs = out.elapsedMs / 1000;
        report.load = { connections: LOAD, seconds: secs, requests: all.length, perSecond: all.length / secs, okPerSecond: good / secs, errors: all.length - good, statuses, latency: stats(all), apiBusy: util, loopLagP99: lag ? lag.percentile(99) / 1e6 : null, perEndpoint: out.results.map((r, i) => ({ name: targets[i].name, requests: r.ms.length, latency: stats(r.ms) })) };
        const L = report.load;
        say(`   ${L.requests.toLocaleString("en-IN")} requests in ${secs.toFixed(1)} s = ${f1(L.perSecond)} per second · ${L.errors} not answered with 2xx${Object.keys(statuses).filter((s) => s < 200 || s >= 300).length ? ` (${Object.entries(statuses).filter(([s]) => s < 200 || s >= 300).map(([s, n]) => `${s || "failed"} × ${n}`).join(", ")})` : ""}`);
        say(`   latency  typical ${f1(L.latency.p50)} ms · slow 95% ${f1(L.latency.p95)} ms · slow 99% ${f1(L.latency.p99)} ms · worst ${f1(L.latency.max)} ms`);
        if (L.apiBusy !== null) say(`   the API's main thread was busy ${(L.apiBusy * 100).toFixed(0)}% of the time · its event loop lagged up to ${f1(L.loopLagP99)} ms (99%)${L.apiBusy > 0.9 ? " — it is saturated: this is its limit on this machine" : ""}`);
        say(table(L.perEndpoint.map((r) => ({ name: r.name, n: r.requests.toLocaleString("en-IN"), p50: f1(r.latency?.p50), p95: f1(r.latency?.p95) })), [{ key: "name", label: "endpoint", left: true }, { key: "n", label: "requests" }, { key: "p50", label: "typical" }, { key: "p95", label: "slow 95%" }]));
      }
    }
  }

  /* ---- things to look at */
  const notes = [];
  if (report.db?.ping?.p50 >= 15) notes.push(`The database is about ${f1(report.db.ping.p50)} ms away from this server. Every query pays that: an endpoint making 10 queries spends ~${f1(report.db.ping.p50 * 10)} ms just travelling. Fewer queries, or a database closer to the server, would help more than faster queries.`);
  for (const r of results.filter((x) => x.ok)) {
    if (r.total.p95 >= 1000) notes.push(`${r.name}: very slow (95% of requests finish within ${f1(r.total.p95)} ms).`);
    else if (r.total.p95 >= 250) notes.push(`${r.name}: slow (95% of requests finish within ${f1(r.total.p95)} ms).`);
    if (r.queries >= 8) notes.push(`${r.name}: makes ${r.queries.toFixed(0)} database queries per request.`);
    if (r.app !== null && r.app >= 50) notes.push(`${r.name}: the API's own work takes ${f1(r.app)} ms (not the database).`);
    if (r.dbWall !== null && r.server && r.dbWall / r.server.avg > 0.8 && r.server.avg >= 20) notes.push(`${r.name}: ${((r.dbWall / r.server.avg) * 100).toFixed(0)}% of the time is spent waiting for the database.`);
    if (r.writes > 0) notes.push(`${r.name}: this read request also writes to the database (${r.writes.toFixed(1)} writes per request).`);
    if (r.bytes >= 200 * 1024) notes.push(`${r.name}: the answer is ${kb(r.bytes)} — large for a phone.`);
  }
  const planNotes = [];
  for (const p of report.plans) {
    if (p.collscanMatters) planNotes.push(`No index: ${short(p.query, 150)} reads the whole collection (${p.docsExamined} documents).`);
    else if (p.sortMatters) planNotes.push(`Sorts in memory: ${short(p.query, 150)} (${p.docsExamined} documents).`);
    if (p.inefficient) planNotes.push(`Reads far more than it returns (${p.docsExamined} read, ${p.returned} returned): ${short(p.query, 130)}.`);
  }
  notes.push(...planNotes.slice(0, 10));
  if (planNotes.length > 10) notes.push(`…and ${planNotes.length - 10} more query plan warnings (see section 3).`);
  if (report.load?.apiBusy > 0.9) notes.push(`Under load the API's thread was saturated at ${f1(report.load.perSecond)} requests per second.`);
  say("\nTHINGS TO LOOK AT");
  say(notes.length ? notes.map((n) => `   • ${n}`).join("\n") : "   Nothing stands out.");
  report.notes = notes;

  /* ---- clean up */
  if (cookie) await send(base, "/api/auth/logout", { method: "POST", body: "{}", headers: { cookie } });
  if (opt.json) {
    fs.writeFileSync(opt.json, `${JSON.stringify(report, null, 2)}\n`);
    say(`\nSaved to ${opt.json}. Compare a later run with:  node src/scripts/speed-test.js --compare ${opt.json}`);
  }
  if (opt.compare?.length === 1) printComparison(readRun(opt.compare[0]), report, [opt.compare[0], "this run"]);
  server?.closeAllConnections?.();
  server?.close();
  await mongoose.disconnect().catch(() => undefined);
  process.exit(0);
}

/* ================================================================== comparing two saved runs */

function readRun(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    throw new Error(`can't read ${file}: ${e.message}`);
  }
}

export function printComparison(a, b, names = ["before", "after"]) {
  const say = (s = "") => console.log(s);
  say(`Comparing  ${names[0]} (${a.meta?.when ?? "?"})  →  ${names[1]} (${b.meta?.when ?? "?"})`);
  const bm = new Map((b.endpoints ?? []).map((e) => [e.name, e]));
  const rows = [];
  for (const x of a.endpoints ?? []) {
    const y = bm.get(x.name);
    if (!y || !x.total || !y.total) continue;
    rows.push({
      name: x.name,
      p50: `${f1(x.total.p50)} → ${f1(y.total.p50)}`, p50d: pct(x.total.p50, y.total.p50),
      p95: `${f1(x.total.p95)} → ${f1(y.total.p95)}`, p95d: pct(x.total.p95, y.total.p95),
      q: x.queries === null || y.queries === null ? "" : `${x.queries.toFixed(1)} → ${y.queries.toFixed(1)}`,
    });
  }
  say(rows.length ? table(rows, [{ key: "name", label: "endpoint", left: true }, { key: "p50", label: "typical ms" }, { key: "p50d", label: "" }, { key: "p95", label: "slow 95% ms" }, { key: "p95d", label: "" }, { key: "q", label: "queries" }]) : "   no endpoint appears in both runs.");
  if (a.db?.ping && b.db?.ping) say(`   database ping typical ${f1(a.db.ping.p50)} → ${f1(b.db.ping.p50)} ms ${pct(a.db.ping.p50, b.db.ping.p50)}`);
  if (a.load && b.load) say(`   load: ${f1(a.load.perSecond)} → ${f1(b.load.perSecond)} requests per second ${pct(a.load.perSecond, b.load.perSecond)} · slow 95% ${f1(a.load.latency.p95)} → ${f1(b.load.latency.p95)} ms ${pct(a.load.latency.p95, b.load.latency.p95)}`);
  say("   (lower milliseconds are better; − means faster)");
}

/* ================================================================== entry */

const entryFile = (() => { try { return process.argv[1] ? fs.realpathSync(process.argv[1]) : ""; } catch { return ""; } })();
if (!isMainThread) {
  await workerMain();
} else if (entryFile && entryFile === fs.realpathSync(fileURLToPath(import.meta.url))) {
  main().catch((e) => {
    console.error(`\nSpeed test stopped: ${e?.message ?? e}`);
    process.exit(1);
  });
}
