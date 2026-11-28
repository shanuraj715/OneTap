// API SCAN — evidence for the performance report (docs/api-performance-report-2026-11-28.md). Four measurements, all on a PRIVATE copy of the API:
//
//   A. QUERY PLANS   how many documents the database reads to answer the order questions the apps ask all day, with the indexes the models have today,
//                    and again after adding the small extra indexes the report proposes (they are created only in this throw-away database).
//   B. SERVER PAGE   the four calls the console's Server page makes (server, health, history, processes): time, size, size after gzip, database questions.
//   C. SIGN-IN WIPE  what one person signing in does to everybody else's next request (every remembered sign-in is thrown away on any User/Session write).
//   D. SIZES         raw / gzip / brotli size of the biggest answers (what nginx or Cloudflare would save).
//
//   node audit/api-scan.mjs                       # 40 000 orders, database next door
//   node audit/api-scan.mjs --rtt 20 --orders 80000 --json /tmp/scan.json
//
// Nothing real is touched: its own in-memory database, its own port, no .env is read (same approach as api-timing.mjs). The table goes to stderr.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import net from "node:net";
import zlib from "node:zlib";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const { values: opt } = parseArgs({ options: { rtt: { type: "string", default: "0" }, runs: { type: "string", default: "20" }, orders: { type: "string", default: "40000" }, json: { type: "string" }, port: { type: "string", default: "3124" } } });
const RTT = Number(opt.rtt);
const RUNS = Number(opt.runs);
const ORDERS = Number(opt.orders);
const PORT = Number(opt.port);

const REPO = fileURLToPath(new URL("../../..", import.meta.url)).replace(/\/$/, "");
const API = `${REPO}/apps/api`;
const RUN_DIR = fileURLToPath(new URL("../.bench/scan-run/", import.meta.url));
mkdirSync(RUN_DIR, { recursive: true });
process.chdir(RUN_DIR); // no .env here: the real database address is never read
const req = createRequire(`${API}/package.json`);

/** A TCP proxy that holds every chunk for `oneWayMs` (a database in another city). */
function delayProxy(targetPort, oneWayMs) {
  const server = net.createServer((client) => {
    const upstream = net.connect(targetPort, "127.0.0.1");
    const pipeDelayed = (from, to) => {
      let last = 0;
      from.on("data", (chunk) => {
        const at = Math.max(Date.now() + oneWayMs, last);
        last = at;
        setTimeout(() => { if (!to.destroyed) to.write(chunk); }, Math.max(0, at - Date.now()));
      });
      from.on("end", () => setTimeout(() => to.end(), oneWayMs));
      from.on("error", () => to.destroy());
    };
    pipeDelayed(client, upstream);
    pipeDelayed(upstream, client);
    client.on("close", () => upstream.destroy());
    upstream.on("close", () => client.destroy());
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ port: server.address().port, close: () => server.close() })));
}

const mms = await import(pathToFileURL(req.resolve("mongodb-memory-server")).href);
const mongod = await (mms.MongoMemoryServer ?? mms.default.MongoMemoryServer).create();
const mongoPort = Number(new URL(mongod.getUri()).port);
const proxy = RTT > 0 ? await delayProxy(mongoPort, RTT / 2) : null;
const directUri = `mongodb://127.0.0.1:${mongoPort}/`; // plans and seeding go straight to the database (no pretend distance)
const uri = `mongodb://127.0.0.1:${proxy ? proxy.port : mongoPort}/`;
Object.assign(process.env, { NODE_ENV: "production", API_PORT: String(PORT), MONGODB_URI: uri, MONGODB_DB: "sandbox", LOG_LEVEL: "silent", RATE_LIMITS: "off", ENCRYPTION_KEY: "x".repeat(40), PUBLIC_API_URL: `http://127.0.0.1:${PORT}`, STOREFRONT_ORIGIN: "https://food.example.com" });
const db = await import(`${REPO}/packages/db/src/index.js`);
const ops = [];
db.mongoose.set("debug", (collection, method) => ops.push(`${collection}.${method}`));
await db.connectDb({ uri, dbName: "sandbox" });
const { env } = await import(`${API}/src/env.js`);
const { createApp } = await import(`${API}/src/app.js`);
const { ensureSuperAdmin } = await import(`${API}/src/modules/auth/auth.service.js`);
const { cache } = await import(`${API}/src/modules/cache/cache.js`);
const server = createApp().listen(PORT);
await new Promise((r) => server.once("listening", r));
await ensureSuperAdmin({ email: "super@scan.test", name: "Super", password: "Super123!" });
env.RATE_LIMITS = "off";

const base = `http://127.0.0.1:${PORT}`;
let ip = 0;
const call = async (method, path, { body, cookie, headers = {} } = {}) => {
  const r = await fetch(base + path, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), "x-forwarded-for": `198.51.100.${(ip = (ip % 250) + 1)}`, ...headers }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let json = {}; try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: r.status, json, text, headers: r.headers };
};
const login = async (email, password) => (await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.250" }, body: JSON.stringify({ email, password }) })).headers.get("set-cookie")?.split(";")[0];

/* ------------------------------------------------------------------ a made-up restaurant */
const su = await login("super@scan.test", "Super123!");
const plan = (await call("POST", "/api/platform/plans", { cookie: su, body: { name: "Full", entitlements: { allFeatures: true } } })).json.plan;
const made = (await call("POST", "/api/brands", { cookie: su, body: { brandName: "Scan Momos", brandSlug: "scan", outletName: "Main", outletSlug: "main", hostnames: ["scan.test"], ownerEmail: "o@scan.test", ownerName: "Owner", ownerPassword: "Owner123!", planId: plan.id } })).json;
const brand = String(made.brand?._id ?? made.brand?.id ?? made.brandId);
const outlet = String(made.outlet?._id ?? made.outlet?.id ?? made.outletId);
const owner = await login("o@scan.test", "Owner123!");
const asOutlet = { "x-rasoipulse-outlet": outlet };
await call("POST", "/api/users", { cookie: owner, headers: { "x-rasoipulse-brand": brand }, body: { email: "k@scan.test", name: "Kitchen", password: "Kitchen123!", role: "kitchen" } });
const cat = (await call("POST", "/api/menu/categories", { cookie: owner, headers: asOutlet, body: { name: "Category" } })).json;
const cid = String(cat.category?.id ?? cat.category?._id ?? cat.id);
for (let i = 1; i <= 12; i++) await call("POST", "/api/menu/items", { cookie: owner, headers: asOutlet, body: { categoryId: cid, name: `Dish ${i}`, basePrice: 15000 + i * 500, isVeg: i % 3 !== 0 } });

// orders over the last 90 days: a handful open now, some online ones that were never paid, dine-in orders that share a table session, delivery orders with a rider
const now = Date.now();
const OPEN = 12;
const CUSTOMERS = 600;
const RIDERS = 6;
const docs = Array.from({ length: ORDERS }, (_, i) => {
  const open = i >= ORDERS - OPEN;
  const at = new Date(open ? now - Math.floor(Math.random() * 40 * 60_000) : now - Math.floor((i / ORDERS) * 90 * 86_400_000));
  const channel = ["takeaway", "dine-in", "delivery"][i % 3];
  const status = open ? ["placed", "accepted", "preparing", "ready"][i % 4] : i % 12 === 0 ? "cancelled" : "completed";
  const online = i % 5 < 2;
  const abandoned = online && !open && i % 97 === 0; // an online order nobody paid for
  return {
    brandId: brand, outletId: outlet, orderNumber: i + 1, orderDay: at.toISOString().slice(0, 10), createdAt: at, updatedAt: at, status, channel,
    customer: { customerId: `cust${i % CUSTOMERS}`, name: `Customer ${i % CUSTOMERS}` },
    ...(channel === "dine-in" ? { sessionId: `sess${Math.floor(i / 9)}` } : {}),
    ...(channel === "delivery" ? { rider: { riderId: `rider${i % RIDERS}` } } : {}),
    lines: [{ name: `Dish ${1 + (i % 12)}`, quantity: 1 + (i % 3), lineTotal: 20000 }, { name: `Dish ${1 + ((i + 5) % 12)}`, quantity: 1, lineTotal: 15000 }],
    totals: { grandTotal: 35000 },
    payment: { status: abandoned ? "pending" : "paid", gateway: online ? "razorpay" : "cod" },
    ...(i % 40 === 0 && !open ? { stockHold: { held: false } } : {}),
  };
});
for (let i = 0; i < docs.length; i += 1000) await db.OrderModel.collection.insertMany(docs.slice(i, i + 1000));
await db.OrderModel.init();

/* ===================================================================================== A. query plans */
const coll = db.OrderModel.collection;
const walk = (stage, found = []) => {
  if (!stage) return found;
  if (stage.stage) found.push(stage.indexName ? `${stage.stage}(${stage.indexName})` : stage.stage);
  walk(stage.inputStage, found);
  (stage.inputStages ?? []).forEach((s) => walk(s, found));
  return found;
};
const SOON = new Date(now - 30 * 60_000);
const T = { brandId: brand, outletId: outlet };
const plans = [
  // [label, who asks, filter, sort, limit]
  ["kitchen board (KDA + console)", "every 8 s per kitchen screen", { ...T, status: { $in: ["accepted", "preparing", "ready"] }, $or: [{ "payment.gateway": "cod" }, { "payment.status": { $ne: "pending" } }] }, { createdAt: 1 }, 150],
  ["dashboard: orders in the queue", "dashboard, every minute", { ...T, status: { $in: ["placed", "accepted", "preparing"] } }, null, 0],
  ["storefront capacity (2 counts)", "every 10 s per outlet", { ...T, status: { $in: ["placed", "accepted", "preparing"] }, channel: "delivery" }, null, 0],
  ["orders list, all", "order screen + apps", { ...T, $or: [{ "payment.gateway": "cod" }, { "payment.status": { $ne: "pending" } }] }, { createdAt: -1 }, 50],
  ["orders list, one status", "order screen filter", { ...T, status: "preparing", $or: [{ "payment.gateway": "cod" }, { "payment.status": { $ne: "pending" } }] }, { createdAt: -1 }, 50],
  ["online orders waiting for payment (count)", "EVERY orders-list call + dashboard", { ...T, "payment.gateway": { $ne: "cod" }, "payment.status": "pending", status: { $ne: "cancelled" } }, null, 0],
  ["one table session's orders", "tables screen, take-order", { ...T, sessionId: `sess${Math.floor(ORDERS / 2 / 9)}` }, { createdAt: 1 }, 0],
  ["a customer's order history", "storefront account, reorder, ratings", { brandId: brand, "customer.customerId": "cust17", customerHiddenAt: null }, { createdAt: -1 }, 16],
  ["coupon check: customer's order count", "every checkout with a coupon", { ...T, "customer.customerId": "cust17", status: { $ne: "cancelled" } }, null, 0],
  ["rider app: my active deliveries", "RDA, every 8 s per rider", { ...T, channel: "delivery", "rider.riderId": "rider2", status: { $in: ["accepted", "preparing", "ready", "out_for_delivery"] } }, { createdAt: 1 }, 50],
  ["stock sweeper (all stores at once)", "every 5 min, every process", { "stockHold.held": true, "payment.gateway": { $ne: "cod" }, "payment.status": { $in: ["pending", "failed"] }, createdAt: { $lt: SOON } }, null, 200],
];
const explain = async (filter, sort, limit) => {
  let c = coll.find(filter);
  if (sort) c = c.sort(sort);
  if (limit) c = c.limit(limit);
  const e = await c.explain("executionStats");
  const s = e.executionStats;
  return { stages: walk(e.queryPlanner.winningPlan).join(" > "), keys: s.totalKeysExamined, docs: s.totalDocsExamined, out: s.nReturned, ms: s.executionTimeMillis };
};
const before = [];
for (const [label, who, filter, sort, limit] of plans) before.push({ label, who, ...(await explain(filter, sort, limit)) });

// the extra indexes the report proposes — additive, built here only
const proposed = [
  [{ brandId: 1, outletId: 1, status: 1, createdAt: 1 }, { name: "scan_status" }],
  [{ brandId: 1, outletId: 1, sessionId: 1 }, { name: "scan_session", sparse: true }],
  [{ brandId: 1, "customer.customerId": 1, createdAt: -1 }, { name: "scan_customer" }],
  [{ brandId: 1, outletId: 1, "rider.riderId": 1, status: 1 }, { name: "scan_rider", partialFilterExpression: { channel: "delivery" } }],
  [{ brandId: 1, outletId: 1 }, { name: "scan_unpaid", partialFilterExpression: { "payment.status": "pending" } }],
  [{ createdAt: 1 }, { name: "scan_stockhold", partialFilterExpression: { "stockHold.held": true } }],
];
const sizes = {};
for (const [keys, o] of proposed) await coll.createIndex(keys, o);
const stats = await db.mongoose.connection.db.command({ collStats: "orders" }).catch(() => null);
if (stats) {
  for (const [name, bytes] of Object.entries(stats.indexSizes ?? {})) sizes[name] = bytes;
  sizes.__data = stats.size;
}
const after = [];
for (const [label, who, filter, sort, limit] of plans) after.push({ label, who, ...(await explain(filter, sort, limit)) });

/* ===================================================================================== B. the Server page */
const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor((sorted.length * p) / 100))];
const timed = async (path, cookie, headers = {}) => {
  const first = async () => { ops.length = 0; const t0 = performance.now(); const r = await call("GET", path, { cookie, headers }); return { ms: performance.now() - t0, ops: ops.length, r }; };
  await first();
  const times = [];
  let last;
  for (let i = 0; i < RUNS; i++) { last = await first(); times.push(last.ms); }
  times.sort((a, b) => a - b);
  const raw = Buffer.byteLength(last.r.text);
  return { path, status: last.r.status, raw, gzip: zlib.gzipSync(last.r.text).length, br: zlib.brotliCompressSync(last.r.text).length, ops: last.ops, p50: Math.round(pct(times, 50) * 10) / 10, p95: Math.round(pct(times, 95) * 10) / 10, max: Math.round(times[times.length - 1] * 10) / 10 };
};
// the monitor takes a sample every 5 s; let a few collect so the history answer is not empty
await new Promise((r) => setTimeout(r, 12_000));
const serverPage = [];
for (const p of ["/api/platform/server", "/api/platform/server/health", "/api/platform/server/history?minutes=30", "/api/platform/server/processes", "/api/platform/server/folders"]) serverPage.push(await timed(p, su));

// "processes" read the machine twice (half a second apart) when the last reading is under a second old — only a back-to-back test does that, a page open in ONE tab asks every 8 s.
// So measure it the way a page does: one ask every 1.5 s.
{
  const times = [];
  let last;
  for (let i = 0; i < 6; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    ops.length = 0;
    const t0 = performance.now();
    last = await call("GET", "/api/platform/server/processes", { cookie: su });
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  serverPage.push({ path: "/api/platform/server/processes (asked 1.5 s apart)", status: last.status, raw: Buffer.byteLength(last.text), gzip: zlib.gzipSync(last.text).length, br: 0, ops: ops.length, p50: Math.round(pct(times, 50) * 10) / 10, p95: Math.round(pct(times, 95) * 10) / 10, max: Math.round(times[times.length - 1] * 10) / 10 });
}

/* ===================================================================================== D. sizes */
const sizeRows = [];
for (const [name, path, who] of [
  ["orders list (50)", "/api/orders?limit=50", owner],
  ["kitchen board", "/api/kitchen/orders", owner],
  ["dashboard", "/api/dashboard/stats", owner],
  ["storefront menu", `/api/menu?outletId=${outlet}`, null],
  ["console stores list", "/api/platform/stores", su],
  ["app updates (public list)", "/api/app-updates/apps", null],
]) {
  const r = await call("GET", path, { cookie: who ?? undefined, headers: asOutlet });
  sizeRows.push({ name, status: r.status, raw: Buffer.byteLength(r.text), gzip: zlib.gzipSync(r.text).length, br: zlib.brotliCompressSync(r.text).length, encoding: r.headers.get("content-encoding") ?? "none" });
}

/* ===================================================================================== C. the sign-in wipe */
const PROBE = "/api/orders?limit=20";
const probe = async () => { ops.length = 0; const t0 = performance.now(); await call("GET", PROBE, { cookie: owner, headers: asOutlet }); return { ms: performance.now() - t0, ops: ops.length }; };
for (let i = 0; i < 4; i++) await probe(); // everything remembered
const calm = [];
for (let i = 0; i < RUNS; i++) calm.push(await probe());
const wiped = [];
const wipeOps = [];
for (let i = 0; i < RUNS; i++) {
  await login("k@scan.test", "Kitchen123!"); // somebody ELSE signs in (a kitchen tablet, an app) — one Session write
  wiped.push(await probe());
}
const wipeHeld = [];
for (let i = 0; i < RUNS; i++) wipeHeld.push(await probe()); // and the next ones, with everything remembered again
const med = (rows, key) => { const v = rows.map((r) => r[key]).sort((a, b) => a - b); return Math.round(v[Math.floor(v.length / 2)] * 10) / 10; };
const wipe = { calmMs: med(calm, "ms"), calmOps: med(calm, "ops"), afterOtherLoginMs: med(wiped, "ms"), afterOtherLoginOps: med(wiped, "ops"), laterMs: med(wipeHeld, "ms"), laterOps: med(wipeHeld, "ops") };

/* ===================================================================================== output */
const pad = (s, n) => String(s).padEnd(n);
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
console.error(`\nAPI scan — ${ORDERS} orders, database ${RTT} ms away (plans use the database directly), ${RUNS} runs (${new Date().toISOString().slice(0, 16)}Z)\n`);
console.error("A. QUERY PLANS — documents the database reads (docs) to return (out) answers; 'COLLSCAN' = read everything\n");
console.error(`${pad("question", 44)} ${pad("today: plan", 52)} ${pad("docs", 7)} ${pad("out", 5)} ${pad("ms", 4)} | ${pad("with the new index", 46)} ${pad("docs", 7)} ${pad("ms", 4)}`);
for (let i = 0; i < before.length; i++) {
  const b = before[i], a = after[i];
  console.error(`${pad(b.label, 44)} ${pad(b.stages.slice(0, 50), 52)} ${pad(b.docs, 7)} ${pad(b.out, 5)} ${pad(b.ms, 4)} | ${pad(a.stages.slice(0, 44), 46)} ${pad(a.docs, 7)} ${pad(a.ms, 4)}`);
}
console.error("\nB. THE SERVER PAGE — each call, from the same machine (no internet in between)\n");
console.error(`${pad("call", 46)} ${pad("size", 9)} ${pad("gzip", 9)} ${pad("db", 4)} ${pad("median", 8)} ${pad("95%", 8)} slowest`);
for (const r of serverPage) console.error(`${pad(r.path.replace("/api/platform/server", "server"), 46)} ${pad(kb(r.raw), 9)} ${pad(kb(r.gzip), 9)} ${pad(r.ops, 4)} ${pad(r.p50, 8)} ${pad(r.p95, 8)} ${r.max}`);
console.error("\nC. ONE OTHER PERSON SIGNS IN, then the owner asks for the order list\n");
console.error(`   everything remembered : ${wipe.calmMs} ms, ${wipe.calmOps} database questions`);
console.error(`   right after the login : ${wipe.afterOtherLoginMs} ms, ${wipe.afterOtherLoginOps} database questions`);
console.error(`   the request after that: ${wipe.laterMs} ms, ${wipe.laterOps} database questions`);
console.error("\nD. SIZES (the API itself sends no compression: 'encoding' is what came back)\n");
console.error(`${pad("answer", 28)} ${pad("raw", 10)} ${pad("gzip", 10)} ${pad("brotli", 10)} encoding`);
for (const r of sizeRows) console.error(`${pad(r.name, 28)} ${pad(kb(r.raw), 10)} ${pad(kb(r.gzip), 10)} ${pad(kb(r.br), 10)} ${r.encoding}${r.status === 200 ? "" : `  (HTTP ${r.status})`}`);
if (stats) {
  console.error(`\nIndex sizes in the orders collection (${ORDERS} orders, data ${(sizes.__data / 1048576).toFixed(1)} MB):`);
  for (const [n, b] of Object.entries(sizes)) if (n !== "__data") console.error(`   ${pad(n, 52)} ${kb(b)}`);
}
if (opt.json) writeFileSync(opt.json, JSON.stringify({ rtt: RTT, orders: ORDERS, runs: RUNS, plans: { before, after }, serverPage, wipe, sizeRows, sizes }, null, 2));

server.close();
proxy?.close();
await mongod.stop();
process.exit(0);
