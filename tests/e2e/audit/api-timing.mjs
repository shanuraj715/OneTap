// API TIMING — how long do the main API reads take, how many database questions does each one ask, and what happens when the database is far away?
//
//   node audit/api-timing.mjs                 database next door (0 ms)
//   node audit/api-timing.mjs --rtt 20        every database question takes 20 ms there and back (a database in another city)
//   node audit/api-timing.mjs --rtt 40 --runs 40 --orders 3000
//
// It starts a PRIVATE copy of the API on its own port with its own in-memory database (nothing real is touched, the test bench and your dev servers are not used),
// fills it with a made-up restaurant, and puts a small delaying proxy between the API and the database so a far-away database can be simulated honestly: every
// question really waits, questions asked at the same time overlap, questions asked one after another add up. What it measures is the time to answer a request
// from a program on the same machine (no browser, no internet between): that is the time INSIDE the API plus the database trips.
//
// The API runs in production mode (as on the server), so it writes one log line per request to stdout; the table is printed to stderr so you can send stdout to a file like pm2 does:
//   node audit/api-timing.mjs > /tmp/api-log.txt
// Output: a table (one row per endpoint: median and slowest-of-the-runs time, database questions on the first and the later asks) and, with --json FILE, the same as data.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import net from "node:net";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const { values: opt } = parseArgs({ options: { rtt: { type: "string", default: "0" }, runs: { type: "string", default: "30" }, orders: { type: "string", default: "2000" }, json: { type: "string" }, port: { type: "string", default: "3123" } } });
const RTT = Number(opt.rtt);
const RUNS = Number(opt.runs);
const ORDERS = Number(opt.orders);
const PORT = Number(opt.port);

const REPO = fileURLToPath(new URL("../../..", import.meta.url)).replace(/\/$/, "");
const API = `${REPO}/apps/api`;
const RUN_DIR = fileURLToPath(new URL("../.bench/timing-run/", import.meta.url));
mkdirSync(RUN_DIR, { recursive: true });
process.chdir(RUN_DIR); // no .env here: the real database address is never read
const req = createRequire(`${API}/package.json`);

/* ------------------------------------------------------------ a database that is far away */
/** A TCP proxy that holds every chunk for `oneWayMs` before passing it on, in order, in both directions. */
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

/* -------------------------------------------------------------------------- start */
const mms = await import(pathToFileURL(req.resolve("mongodb-memory-server")).href);
const mongod = await (mms.MongoMemoryServer ?? mms.default.MongoMemoryServer).create();
const mongoPort = Number(new URL(mongod.getUri()).port);
const proxy = RTT > 0 ? await delayProxy(mongoPort, RTT / 2) : null;
const uri = `mongodb://127.0.0.1:${proxy ? proxy.port : mongoPort}/`;
Object.assign(process.env, { NODE_ENV: "production", API_PORT: String(PORT), MONGODB_URI: uri, MONGODB_DB: "sandbox", LOG_LEVEL: "silent", RATE_LIMITS: "off", ENCRYPTION_KEY: "x".repeat(40), PUBLIC_API_URL: `http://127.0.0.1:${PORT}`, STOREFRONT_ORIGIN: "https://food.example.com" });
const db = await import(`${REPO}/packages/db/src/index.js`);
const ops = [];
db.mongoose.set("debug", (collection, method) => ops.push(`${collection}.${method}`));
await db.connectDb({ uri, dbName: "sandbox" });
const { env } = await import(`${API}/src/env.js`);
const { createApp } = await import(`${API}/src/app.js`);
const { ensureSuperAdmin } = await import(`${API}/src/modules/auth/auth.service.js`);
const server = createApp().listen(PORT);
await new Promise((r) => server.once("listening", r));
await ensureSuperAdmin({ email: "super@timing.test", name: "Super", password: "Super123!" });
env.RATE_LIMITS = "off";

const base = `http://127.0.0.1:${PORT}`;
let ip = 0;
const call = async (method, path, { body, cookie, headers = {} } = {}) => {
  const r = await fetch(base + path, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), "x-forwarded-for": `198.51.100.${(ip = (ip % 250) + 1)}`, ...headers }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let json = {}; try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: r.status, json, bytes: text.length };
};
const login = async (email, password) => (await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.250" }, body: JSON.stringify({ email, password }) })).headers.get("set-cookie")?.split(";")[0];

/* ------------------------------------------------------------------ a made-up restaurant */
const su = await login("super@timing.test", "Super123!");
const plan = (await call("POST", "/api/platform/plans", { cookie: su, body: { name: "Full", entitlements: { allFeatures: true } } })).json.plan;
const made = (await call("POST", "/api/brands", { cookie: su, body: { brandName: "Timing Momos", brandSlug: "timing", outletName: "Main", outletSlug: "main", hostnames: ["timing.test"], ownerEmail: "o@timing.test", ownerName: "Owner", ownerPassword: "Owner123!", planId: plan.id } })).json;
const brand = String(made.brand?._id ?? made.brand?.id ?? made.brandId);
const outlet = String(made.outlet?._id ?? made.outlet?.id ?? made.outletId);
const owner = await login("o@timing.test", "Owner123!");
await call("POST", "/api/users", { cookie: owner, headers: { "x-rasoipulse-brand": brand }, body: { email: "k@timing.test", name: "Kitchen", password: "Kitchen123!", role: "kitchen" } });
const kitchen = await login("k@timing.test", "Kitchen123!");
const asOutlet = { "x-rasoipulse-outlet": outlet };
// a menu of 8 categories × 12 dishes
for (let c = 1; c <= 8; c++) {
  const cat = (await call("POST", "/api/menu/categories", { cookie: owner, headers: asOutlet, body: { name: `Category ${c}` } })).json;
  const catId = String(cat.category?.id ?? cat.category?._id ?? cat.id);
  for (let i = 1; i <= 12; i++) await call("POST", "/api/menu/items", { cookie: owner, headers: asOutlet, body: { categoryId: catId, name: `Dish ${c}-${i}`, basePrice: 15000 + i * 500, isVeg: i % 3 !== 0 } });
}
for (let n = 1; n <= 10; n++) await call("POST", "/api/tables", { cookie: owner, headers: asOutlet, body: { number: `T${n}`, seats: 4 } });
// orders spread over the last 20 days, as the dashboard and the order list would meet them
const now = Date.now();
const kinds = ["takeaway", "dine-in", "delivery"];
// a real restaurant has a handful of orders open at any moment — the rest are finished (or cancelled), spread over the last 20 days
const OPEN = 12;
const docs = Array.from({ length: ORDERS }, (_, i) => {
  const open = i >= ORDERS - OPEN;
  const at = new Date(open ? now - Math.floor(Math.random() * 40 * 60_000) : now - Math.floor(Math.random() * 20 * 86_400_000));
  const status = open ? (i % 2 ? "preparing" : "placed") : i % 12 === 0 ? "cancelled" : "completed";
  return { brandId: brand, outletId: outlet, orderNumber: i + 1, customer: { name: `Customer ${i % 80}` }, channel: kinds[i % 3], status, lines: [{ name: `Dish ${1 + (i % 8)}-${1 + (i % 12)}`, quantity: 1 + (i % 3), lineTotal: 20000 }, { name: `Dish ${1 + ((i + 3) % 8)}-${1 + ((i + 5) % 12)}`, quantity: 1, lineTotal: 15000 }], totals: { grandTotal: 35000 }, payment: { status: i % 7 === 0 ? "pending" : "paid", gateway: "cod" }, createdAt: at, updatedAt: at, orderDay: at.toISOString().slice(0, 10) };
});
for (let i = 0; i < docs.length; i += 500) await db.OrderModel.collection.insertMany(docs.slice(i, i + 500));
const orderList = (await call("GET", "/api/orders?limit=5", { cookie: owner, headers: asOutlet })).json.orders ?? [];

/* --------------------------------------------------------------------------- the endpoints */
const O = (path, who = owner) => ({ path, cookie: who, headers: asOutlet });
const endpoints = [
  ["sign-in check", O("/api/auth/me")],
  ["store plan", O("/api/store/plan")],
  ["outlet list", O("/api/outlets")],
  ["dashboard (owner)", O("/api/dashboard/stats")],
  ["dashboard (kitchen)", O("/api/dashboard/stats", kitchen)],
  ["orders list (50)", O("/api/orders?limit=50")],
  ["kitchen board", O("/api/kitchen/orders")],
  ["tables", O("/api/tables")],
  ["tables in use", O("/api/tables/sessions/active")],
  ["customers", O("/api/customers")],
  ["bookings summary", O("/api/reservations/summary")],
  ["storefront: find the store", { path: "/api/outlets/for-host?host=timing.test" }],
  ["storefront: menu", { path: `/api/menu?outletId=${outlet}` }],
  ["storefront: capacity", { path: `/api/orders/capacity?outletId=${outlet}` }],
  ["storefront: pickup slots", { path: `/api/orders/pickup-slots?outletId=${outlet}` }],
  ["console: stores list", O("/api/platform/stores", su)],
  ["console: overview", O("/api/platform/overview", su)],
  ["health", { path: "/health" }],
];
if (orderList[0]) endpoints.splice(6, 0, ["one order", O(`/api/orders/${orderList[0].id}?outletId=${outlet}`)]);

const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor((sorted.length * p) / 100))];
const rows = [];
for (const [name, e] of endpoints) {
  const ask = async () => { ops.length = 0; const t0 = performance.now(); const r = await call("GET", e.path, { cookie: e.cookie, headers: e.headers }); return { ms: performance.now() - t0, ops: [...ops], status: r.status, bytes: r.bytes }; };
  const first = await ask();
  const second = await ask();
  for (let i = 0; i < 3; i++) await ask(); // warm up
  const times = [];
  let last = second;
  for (let i = 0; i < RUNS; i++) { last = await ask(); times.push(last.ms); }
  times.sort((a, b) => a - b);
  rows.push({ name, path: e.path.replace(outlet, ":outlet").replace(/\?.*$/, ""), status: last.status, kb: Math.round(last.bytes / 102.4) / 10, firstOps: first.ops.length, laterOps: last.ops.length, firstMs: Math.round(first.ms * 10) / 10, p50: Math.round(pct(times, 50) * 10) / 10, p95: Math.round(pct(times, 95) * 10) / 10, max: Math.round(times[times.length - 1] * 10) / 10, opsList: last.ops.length ? [...new Set(last.ops)].join(", ") : "" });
}

/* ------------------------------------------------ a request right after the remembered answers have expired */
// Who you are (30 s), which store and outlet a request is for (60 s) and what the store's plan allows (30 s) are remembered for a short time. The first request after
// that pays for them all again, one after another. This asks for the same endpoint with everything remembered thrown away first.
const { cache } = await import(`${API}/src/modules/cache/cache.js`);
const coldRows = [];
for (const [name, e] of endpoints.filter(([n]) => ["tables", "orders list (50)", "dashboard (owner)", "kitchen board"].includes(n))) {
  const times = [];
  let asks = 0;
  for (let i = 0; i < 6; i++) {
    cache.expireAll();
    ops.length = 0;
    const t0 = performance.now();
    await call("GET", e.path, { cookie: e.cookie, headers: e.headers });
    times.push(performance.now() - t0);
    asks = ops.length;
  }
  times.sort((a, b) => a - b);
  coldRows.push({ name, asks, median: Math.round(times[Math.floor(times.length / 2)] * 10) / 10, max: Math.round(times[times.length - 1] * 10) / 10 });
}

const pad = (s, n) => String(s).padEnd(n);
console.error(`\nAPI timing — database ${RTT} ms away (there and back), ${ORDERS} orders, ${RUNS} runs each (${new Date().toISOString().slice(0, 16)}Z)\n`);
console.error(`${pad("endpoint", 28)} ${pad("status", 6)} ${pad("size", 8)} ${pad("db asks 1st/later", 18)} ${pad("1st", 8)} ${pad("median", 8)} ${pad("95%", 8)} slowest`);
for (const r of rows) console.error(`${pad(r.name, 28)} ${pad(r.status, 6)} ${pad(`${r.kb} KB`, 8)} ${pad(`${r.firstOps} / ${r.laterOps}`, 18)} ${pad(`${r.firstMs}`, 8)} ${pad(`${r.p50}`, 8)} ${pad(`${r.p95}`, 8)} ${r.max}`);
console.error(`\nThe same, right after everything remembered has expired (what one request in every ~30 seconds pays):`);
console.error(`${pad("endpoint", 28)} ${pad("db asks", 9)} ${pad("median", 8)} slowest`);
for (const r of coldRows) console.error(`${pad(r.name, 28)} ${pad(r.asks, 9)} ${pad(r.median, 8)} ${r.max}`);
if (opt.json) writeFileSync(opt.json, JSON.stringify({ rtt: RTT, orders: ORDERS, runs: RUNS, rows, coldRows }, null, 2));

server.close();
proxy?.close();
await mongod.stop();
process.exit(0);
