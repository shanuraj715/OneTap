// TEST BENCH API — a complete throwaway TablePe API on an in-memory database, seeded through the real API with two
// fake stores. Nothing real is touched: no .env is read (we chdir away), the database lives in memory and dies with
// this process. Run it, then use the admin console (:3171) and storefront (:3170) pointed at it.
//
//   Platform console   super@sandbox.test / Super123!
//   Acme Momos (Pro plan — every feature)       owner o@acme.test / Owner123!   manager m@acme.test / Manager123!
//                                               cashier s@acme.test / Staff1234!  kitchen k@acme.test / Kitchen123!
//     storefront  http://localhost:3170/main   (Main: takeaway + delivery + dine-in)     /second (takeaway only)
//   Beta Bites (Starter plan — takeaway, dine-in, coupons only)   owner o@beta.test / Owner123!
//     storefront  http://beta.localhost:3170/only
//   A customer can sign in with ANY phone number; the code is always 123456.
//   Returning customer with 50 coins: 9876543210 (Asha Rao).
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const API = `${REPO}/apps/api`;
const HERE = resolve(fileURLToPath(new URL("../.bench", import.meta.url))) + "/";
mkdirSync(HERE, { recursive: true });
process.chdir(HERE); // no .env here → the real database URI is never read; uploads go to .bench/.uploads
mkdirSync(`${HERE}.uploads`, { recursive: true });

const req = createRequire(`${API}/package.json`);
const mms = await import(pathToFileURL(req.resolve("mongodb-memory-server")).href);
const mongod = await (mms.MongoMemoryServer ?? mms.default.MongoMemoryServer).create();
Object.assign(process.env, {
  NODE_ENV: "development",
  API_PORT: "3097",
  MONGODB_URI: mongod.getUri(),
  MONGODB_DB: "bench",
  WHATSAPP_WORKER: "off",
  MAPS_RESOLVE_ALLOW_LOCAL: "1", // the onboarding form may follow a "short map link" to a local stand-in for Google (a test runs one)
  WHATSAPP_GRAPH_URL: "http://127.0.0.1:3096", // WhatsApp Business (Meta) goes to a stand-in a test may run on this port
  GEMINI_API_BASE_URL: "http://127.0.0.1:3190", // AI pictures go to the stand-in for Google started below (never to the real one)
  MARKETING_WORKER: "on", // the bench is throwaway, so it may send (to the fake SMS gateway a test starts)
  STORE_SUBDOMAIN_BASE: "localhost:3170", // store addresses like  acme.localhost:3170  (Chrome opens *.localhost with no DNS)
  CORS_ORIGINS: "http://localhost:3171,http://127.0.0.1:3171",
  PUBLIC_API_URL: "http://localhost:3097",
  STOREFRONT_ORIGIN: "http://localhost:3170",
  LOG_LEVEL: "warn",
  // brute-force guard, with block times of seconds instead of minutes so a test can watch a block end and the next one be longer
  LOGIN_MAX_FAILURES: "3",
  LOGIN_FAILURE_WINDOW_SECONDS: "60",
  LOGIN_BLOCK_STEPS_SECONDS: "6,12,24",
  LOGIN_STRIKE_FORGET_SECONDS: "600",
  LOGIN_FLOOD_PER_MINUTE: "120",
});
const db = await import(`${REPO}/packages/db/src/index.js`);
await db.connectDb({ uri: mongod.getUri(), dbName: "bench" });

/* A STAND-IN for Google's Gemini picture API (port 3190), so AI dish pictures can be tried without a real key or a bill.
 * Any key works, except: a key starting "quota-" answers "limit used up" (429) and one starting "bad-" answers "key not
 * valid". It makes a plain coloured picture, a different colour each time. GET /__calls says what it was asked for. */
{
  const http = await import("node:http");
  const sharp = (await import(pathToFileURL(req.resolve("sharp")).href)).default;
  const calls = [];
  let shade = 0;
  http.createServer(async (rq, rs) => {
    const key = String(rq.headers["x-goog-api-key"] ?? "");
    const send = (status, body) => { rs.writeHead(status, { "content-type": "application/json" }); rs.end(JSON.stringify(body)); };
    const url = new URL(rq.url, "http://x");
    if (url.pathname === "/__calls") return send(200, calls);
    if (url.pathname === "/__reset") { calls.length = 0; return send(200, { ok: true }); }
    let raw = ""; for await (const c of rq) raw += c;
    const body = raw ? JSON.parse(raw) : {};
    if (rq.method === "GET" && url.pathname === "/v1beta/models") return key.startsWith("bad-") ? send(400, { error: { message: "API key not valid. Please pass a valid API key.", status: "INVALID_ARGUMENT" } }) : send(200, { models: [] });
    if (url.pathname !== "/v1beta/interactions") return send(404, { error: { message: "not found", status: "NOT_FOUND" } });
    calls.push({ key, model: body.model, aspectRatio: body.response_format?.aspect_ratio, prompt: body.input?.[0]?.text ?? "", outcome: key.startsWith("quota-") ? "quota" : key.startsWith("bad-") ? "bad" : "ok" });
    if (key.startsWith("quota-")) return send(429, { error: { message: "Quota exceeded", status: "RESOURCE_EXHAUSTED" } });
    if (key.startsWith("bad-")) return send(400, { error: { message: "API key not valid. Please pass a valid API key.", status: "INVALID_ARGUMENT" } });
    await new Promise((r) => setTimeout(r, 600)); // a real one takes seconds; long enough to see the "making…" message
    const hue = (shade += 53) % 255;
    const png = await sharp({ create: { width: 960, height: 720, channels: 3, background: { r: hue, g: 150, b: 80 } } }).png().toBuffer();
    return send(200, { steps: [{ type: "model_output", content: [{ type: "text", text: "ok" }, { type: "image", data: png.toString("base64") }] }] });
  }).listen(3190, "127.0.0.1");
}

const { createApp } = await import(`${API}/src/app.js`);
const server = createApp().listen(3097);
await new Promise((r) => server.once("listening", r));
// DB-CALL RECORDER (for the cache audit, tests/e2e/audit/db-calls.mjs): a request that carries an `x-audit: <label>` header gets
// every database operation it causes written down (collection.method). Read them on :3189  GET /audit  (add ?clear=1 to empty it).
{
  const { AsyncLocalStorage } = await import("node:async_hooks");
  const http = await import("node:http");
  const als = new AsyncLocalStorage();
  const mongoose = (await import(pathToFileURL(createRequire(`${REPO}/packages/db/package.json`).resolve("mongoose")).href)).default;
  mongoose.set("debug", (collection, method) => { als.getStore()?.ops.push(`${collection}.${method}`); });
  const recorded = [];
  server.prependListener("request", (rq, rs) => {
    const label = rq.headers["x-audit"];
    if (!label) return;
    const rec = { label: String(label), method: rq.method, url: rq.url.split("?")[0], ops: [] };
    als.enterWith(rec);
    rs.on("finish", () => { rec.status = rs.statusCode; recorded.push(rec); });
  });
  http.createServer((rq, rs) => {
    const u = new URL(rq.url, "http://x");
    rs.setHeader("content-type", "application/json");
    rs.end(JSON.stringify(recorded));
    if (u.searchParams.get("clear")) recorded.length = 0;
  }).listen(3189, "127.0.0.1");
}
// the live order feed (/realtime) and the live menu preview, attached the way the real server.js does
(await import(`${API}/src/realtime/hub.js`)).attachRealtime(server);
(await import(`${API}/src/realtime/preview.js`)).attachPreview(server);
// the marketing sender (SMS / WhatsApp Business API) — on here because the bench is throwaway
(await import(`${API}/src/modules/marketing/worker.js`)).startMarketingWorker();
// A stand-in for a CONNECTED linked WhatsApp number: the real worker would need a phone to scan. A test switches a number
// "on" (it is marked connected, and a fake connection sends its queued messages exactly like the worker does) and reads
// what it "sent". Control port 3095:  POST /wa/online?account=ID  ·  POST /wa/offline?account=ID  ·  POST /wa/reset?brand=ID  ·  GET /wa/sent  ·  POST /wa/clear
{
  const worker = await import(`${API}/src/modules/whatsapp/worker.js`);
  const { createServer } = await import("node:http");
  const rawc = (c) => db.mongoose.connection.db.collection(c);
  const sentByNumber = [];
  const live = new Map();
  const fakeSock = (phone) => ({
    user: { id: `${phone}:1@s.whatsapp.net`, name: "Shop" },
    onWhatsApp: async (jid) => [{ exists: !jid.split("@")[0].endsWith("0000"), jid }], // a number ending 0000 is "not on WhatsApp"
    sendPresenceUpdate: async () => {},
    sendMessage: async (jid, content, opts) => { sentByNumber.push({ jid, text: content.text ?? "", id: opts?.messageId, at: new Date().toISOString(), from: phone }); return { key: { id: opts?.messageId } }; },
    end() {},
  });
  createServer(async (rq, rs) => {
    const u = new URL(rq.url, "http://x");
    const account = u.searchParams.get("account");
    const send = (j) => { rs.setHeader("content-type", "application/json"); rs.end(JSON.stringify(j)); };
    try {
      if (rq.method === "POST" && u.pathname === "/wa/online") {
        const oid = new db.mongoose.Types.ObjectId(account);
        const acc = await rawc("waaccounts").findOne({ _id: oid });
        const phone = acc?.phone || "919000000001";
        await rawc("waaccounts").updateOne({ _id: oid }, { $set: { status: "connected", phone, seenAt: new Date(), qr: "" } });
        const entry = { sock: fakeSock(phone), brandId: acc.brandId, connected: true, busy: false };
        worker.__test.sockets.set(account, entry);
        live.get(account) && clearInterval(live.get(account));
        live.set(account, setInterval(() => {
          rawc("waaccounts").updateOne({ _id: oid }, { $set: { seenAt: new Date() } }).catch(() => {});
          worker.__test.sendNext(account, entry).catch(() => {});
        }, 300));
        return send({ ok: true });
      }
      if (rq.method === "POST" && u.pathname === "/wa/offline") {
        live.get(account) && clearInterval(live.get(account));
        live.delete(account);
        worker.__test.sockets.delete(account);
        await rawc("waaccounts").updateOne({ _id: new db.mongoose.Types.ObjectId(account) }, { $set: { status: "disconnected" } });
        return send({ ok: true });
      }
      if (rq.method === "POST" && u.pathname === "/wa/reset") {
        // every number of one store goes back to "waiting for a scan" (the seeded ones look online for their first 90 s)
        for (const [id, t] of live) { clearInterval(t); live.delete(id); worker.__test.sockets.delete(id); }
        await rawc("waaccounts").updateMany({ brandId: u.searchParams.get("brand") }, { $set: { status: "pending", seenAt: null } });
        return send({ ok: true });
      }
      if (u.pathname === "/wa/sent") return send(sentByNumber);
      if (rq.method === "POST" && u.pathname === "/wa/clear") { sentByNumber.length = 0; return send({ ok: true }); }
      rs.statusCode = 404; rs.end("{}");
    } catch (e) { rs.statusCode = 500; send({ error: String(e?.message ?? e) }); }
  }).listen(3095, "127.0.0.1");
}
const { ensureSuperAdmin } = await import(`${API}/src/modules/auth/auth.service.js`);
await ensureSuperAdmin({ email: "super@sandbox.test", name: "Platform Admin", password: "Super123!" });
const { FEATURE_KEYS } = await import(`${REPO}/packages/config-schema/src/index.js`);

const base = "http://127.0.0.1:3097";
const call = async (method, path, { body, cookie, outlet, brand } = {}) => {
  const r = await fetch(base + path, {
    method,
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...(outlet ? { "x-onetap-outlet": outlet } : {}), ...(brand ? { "x-onetap-brand": brand } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  let j = {};
  try { j = JSON.parse(t); } catch { /* not json */ }
  if (r.status >= 400) { console.error("SETUP FAILED", method, path, r.status, t.slice(0, 300)); process.exit(1); }
  return j;
};
const login = async (email, password) => (await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) })).headers.get("set-cookie")?.split(";")[0];
const raw = (c) => db.mongoose.connection.db.collection(c);
const oid = (s) => new db.mongoose.Types.ObjectId(String(s));
const idOf = (o) => String(o?._id ?? o?.id);

/* --------------------------------------------------------------- pictures */
const svg = (a, b) => "data:image/svg+xml," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 4' preserveAspectRatio='none'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/></linearGradient></defs><rect width='8' height='4' fill='url(#g)'/></svg>`);
const logo = "data:image/svg+xml," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'><circle cx='60' cy='60' r='56' fill='#c6362f'/><path d='M30 70c0-20 14-34 30-34s30 14 30 34z' fill='white'/><rect x='26' y='72' width='68' height='10' rx='5' fill='white'/></svg>`);

const su = await login("super@sandbox.test", "Super123!");

/* ------------------------------------------------------------------ plans */
const ALL_EFFECTS = undefined; // omitted = every effect
const starter = (await call("POST", "/api/platform/plans", {
  cookie: su,
  body: {
    name: "Starter",
    description: "Takeaway, dine-in QR and coupons",
    limits: { maxUsers: 3, multiOutlet: false, maxOutlets: 1 },
    entitlements: { features: ["takeaway", "dineInQr", "coupons"], effects: [] },
  },
})).plan;
const pro = (await call("POST", "/api/platform/plans", { cookie: su, body: { name: "Pro", description: "Everything", entitlements: { features: FEATURE_KEYS } } })).plan;

/* ----------------------------------------------------------------- stores */
const A = await call("POST", "/api/brands", { cookie: su, body: { brandName: "Acme Momos", brandSlug: "acme", outletName: "Main", outletSlug: "main", hostnames: ["localhost:3170"], ownerEmail: "o@acme.test", ownerName: "Owner", ownerPassword: "Owner123!", planId: idOf(pro) } });
const brandA = idOf(A.brand) !== "undefined" ? idOf(A.brand) : String(A.brandId);
const main = idOf(A.outlet) !== "undefined" ? idOf(A.outlet) : String(A.outletId);
const ownerA = await login("o@acme.test", "Owner123!");
for (const [email, name, password, role] of [["m@acme.test", "Manager", "Manager123!", "manager"], ["s@acme.test", "Cashier", "Staff1234!", "staff"], ["k@acme.test", "Kitchen", "Kitchen123!", "kitchen"]]) {
  await call("POST", "/api/users", { cookie: ownerA, brand: brandA, body: { email, name, password, role } });
}
const second = idOf((await call("POST", "/api/outlets", { cookie: ownerA, body: { name: "Second", slug: "second" } })).outlet);
await raw("outlets").updateMany({ brandId: brandA }, { $set: { hostnames: ["localhost:3170"], canonicalHostname: "localhost:3170" } });

const B = await call("POST", "/api/brands", { cookie: su, body: { brandName: "Beta Bites", brandSlug: "beta", outletName: "Only", outletSlug: "only", hostnames: ["beta.localhost:3170"], ownerEmail: "o@beta.test", ownerName: "Beta Owner", ownerPassword: "Owner123!", planId: idOf(starter) } });
const brandB = idOf(B.brand) !== "undefined" ? idOf(B.brand) : String(B.brandId);
const only = idOf(B.outlet) !== "undefined" ? idOf(B.outlet) : String(B.outletId);
const ownerB = await login("o@beta.test", "Owner123!");

/* ---------------------------------------------------------- store settings */
const cfg = (outlet, cookie, body) => call("PATCH", `/api/outlets/${outlet}/config`, { cookie, outlet, body });
const place = (name, address, lat, lng, extra = {}) => ({
  identity: { name, tagline: "Steamed, fried and made to order", address, phone: "+91 98765 43210", email: "hello@acme.test", logoUrl: logo, location: { point: { lat, lng }, formattedAddress: address } },
  operations: { hours: { enabled: true, opensAt: "11:00", closesAt: "23:00" }, ...(extra.operations ?? {}) },
  features: { ordering: { takeaway: true, dineInQr: true, delivery: extra.delivery ?? false } },
  ...(extra.delivery ? { payments: { enabled: ["cod", "mock"] } } : {}),
  wallet: { enabled: true },
});
await cfg(main, ownerA, place("Acme Momos — Connaught Place", "12 Janpath, Connaught Place, New Delhi 110001", 28.6315, 77.2167, { delivery: true, operations: { limits: { deliveryRadiusKm: 5, deliveryFee: 3000, freeDeliveryAbove: 49900 } } }));
await cfg(second, ownerA, place("Acme Momos — Noida Sector 18", "Atta Market, Sector 18, Noida 201301", 28.5707, 77.3219));
await cfg(only, ownerB, {
  identity: { name: "Beta Bites", tagline: "Quick bites, fresh daily", address: "Shop 4, Hauz Khas Village, New Delhi", phone: "+91 91234 56789", location: { point: { lat: 28.5494, lng: 77.1944 }, formattedAddress: "Hauz Khas Village, New Delhi" } },
  features: { ordering: { takeaway: true, dineInQr: true, delivery: false } },
});

// the message bar + promo carousel + store pages (Main only)
await cfg(main, ownerA, {
  announcement: { enabled: true, showPhone: true, dismissible: true, rotateSeconds: 5, messages: [
    { id: "m1", text: "Free delivery on orders above ₹499", linkLabel: "Order now", linkHref: "#menu" },
    { id: "m2", text: "Fresh momos, steamed to order — open till 11 pm", linkLabel: "", linkHref: "" },
  ] },
  carousel: { enabled: true, autoplay: true, intervalSeconds: 5, showArrows: true, showDots: true, height: "regular", slides: [
    { id: "s1", imageUrl: svg("#c6362f", "#f2a65a"), title: "Festival feast", subtitle: "Buy 2 plates of momos, get a lassi free this weekend", ctaLabel: "Order now", ctaHref: "#menu" },
    { id: "s2", imageUrl: svg("#0f766e", "#84cc16"), title: "New: Kurkure momos", subtitle: "Crisp outside, juicy inside", ctaLabel: "See the menu", ctaHref: "#menu" },
    { id: "s3", imageUrl: svg("#4338ca", "#e879f9"), title: "Smoky tandoori momos", subtitle: "Char-grilled to order", ctaLabel: "", ctaHref: "" },
  ] },
});
// one favicon for the whole store (a store-level setting, shown on every outlet)
await cfg(main, ownerA, { branding: { faviconUrl: "data:image/svg+xml," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><circle cx='8' cy='8' r='8' fill='#c6362f'/></svg>") } });
await call("POST", "/api/pages/starter", { cookie: ownerA, outlet: main });
for (const p of (await call("GET", "/api/pages", { cookie: ownerA, outlet: main })).pages) {
  await call("PATCH", `/api/pages/${p.id}`, { cookie: ownerA, outlet: main, body: { status: "published", showInFooter: true } });
}

/* ------------------------------------------------------------------- menu */
const V = (a, b) => [{ label: "5 pcs", price: a }, { label: "8 pcs", price: b }];
const MENU = [
  ["Steamed Momos", [
    ["Veg Steamed Momos", "veg", V(6000, 9000), ["bestseller"]], ["Paneer Steamed Momos", "veg", V(8000, 12000), []],
    ["Chicken Steamed Momos", "non-veg", V(9000, 14000), ["bestseller"]], ["Corn Cheese Steamed Momos", "veg", V(9000, 13000), []],
  ]],
  ["Kurkure Momos", [
    ["Veg Kurkure Momos", "veg", V(8000, 12000), ["spicy"]], ["Chicken Kurkure Momos", "non-veg", V(10000, 15000), ["spicy"]],
    ["Paneer Kurkure Momos", "veg", V(10000, 15000), []], ["Chicken Cheese Momos", "non-veg", V(11000, 16000), [], false],
  ]],
  ["Tandoori Momos", [
    ["Veg Tandoori Momos", "veg", V(9000, 14000), []], ["Chicken Tandoori Momos", "non-veg", V(11000, 17000), ["spicy"]], ["Afghani Malai Momos", "veg", V(12000, 18000), []],
  ]],
  ["Gravy Momos", [
    ["Schezwan Gravy Momos", "veg", [{ label: "Plate", price: 11000 }], ["spicy"]], ["Butter Gravy Momos", "veg", [{ label: "Plate", price: 12000 }], []], ["Peri Peri Chicken Gravy", "non-veg", [{ label: "Plate", price: 13000 }], ["spicy"]],
  ]],
  ["Beverages", [
    ["Cold Coffee", "veg", null, [], true, 7000], ["Masala Coke", "veg", null, [], true, 4000], ["Sweet Lassi", "veg", null, [], true, 6000], ["Water Bottle", "veg", null, [], true, 2000],
  ]],
];
async function seedMenu(outlet, cookie, menu) {
  let order = 0;
  for (const [cat, items] of menu) {
    const c = (await call("POST", "/api/menu/categories", { cookie, outlet, body: { name: cat, sortOrder: order++ } })).category;
    let i = 0;
    for (const [name, foodType, variants, tags, available = true, price] of items) {
      await call("POST", "/api/menu/items", {
        cookie, outlet,
        body: { categoryId: idOf(c), name, description: `${name} — made fresh to order`, foodType, tags, isAvailable: available, sortOrder: i++, ...(variants ? { variants } : { basePrice: price }) },
      });
    }
  }
}
await seedMenu(main, ownerA, MENU);
await seedMenu(second, ownerA, MENU.slice(0, 2));
await seedMenu(only, ownerB, [["Burgers", [["Veg Burger", "veg", null, ["bestseller"], true, 9000], ["Chicken Burger", "non-veg", null, [], true, 12000]]], ["Shakes", [["Chocolate Shake", "veg", null, [], true, 11000], ["Mango Shake", "veg", null, [], true, 10000]]]]);

/* ------------------------------------------------------- coupons + tables */
for (const c of [
  { code: "SAVE20", description: "20% off up to ₹100", discountType: "percent", value: 20, maxDiscount: 10000, minOrderValue: 19900, maxPerCustomer: 0 },
  { code: "FLAT50", description: "₹50 off orders above ₹299", discountType: "fixed", value: 5000, minOrderValue: 29900, maxPerCustomer: 0 },
  { code: "WELCOME15", description: "15% off your first order", discountType: "percent", value: 15, newCustomersOnly: true, maxPerCustomer: 1 },
]) await call("POST", "/api/coupons", { cookie: ownerA, outlet: main, body: c });
await call("POST", "/api/coupons", { cookie: ownerB, outlet: only, body: { code: "BETA10", description: "10% off", discountType: "percent", value: 10, maxPerCustomer: 0 } });
for (const [n, z, s] of [["T1", "Ground floor", 4], ["T2", "Ground floor", 2], ["T3", "Ground floor", 6], ["T4", "Terrace", 4], ["T5", "Terrace", 4]]) await call("POST", "/api/tables", { cookie: ownerA, outlet: main, body: { number: n, zone: z, seats: s } });
for (const n of ["T1", "T2"]) await call("POST", "/api/tables", { cookie: ownerB, outlet: only, body: { number: n, seats: 4 } });

/* -------------------------------------------------------------- customers */
await raw("customers").insertOne({ brandId: brandA, phone: "9876543210", name: "Asha Rao", gender: "female", age: 29, walletBalance: 50, createdAt: new Date(), updatedAt: new Date() });

/* ------------------------------------------------- WhatsApp (worker is off) */
// Four numbers (online / offline / waiting for a QR scan / online) and five chats covering what the WhatsApp suites
// check: an ongoing chat with media, a month-old chat that opted out, a queued broadcast and a failed send.
const wa = async (label) => (await call("POST", "/api/whatsapp/accounts", { cookie: ownerA, outlet: main, body: { label } })).account.id;
await call("PUT", "/api/whatsapp/access", { cookie: ownerA, outlet: main, body: { access: { manager: "send", staff: "read" } } });
const counter = await wa("Counter phone");
const number2 = await wa("Number 2");
const pending = await wa("New phone");
const number3 = await wa("Number 3");
const today = new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
await raw("waaccounts").updateOne({ _id: oid(counter) }, { $set: { status: "connected", phone: "919000000001", pushName: "Acme Momos", seenAt: new Date(), linkedAt: new Date(), coldDay: today, coldCount: 4, orderDay: today, orderCount: 2 } });
await raw("waaccounts").updateOne({ _id: oid(number2) }, { $set: { status: "disconnected", phone: "919000000002", seenAt: new Date(Date.now() - 3600_000), linkedAt: new Date(), lastError: "Connection lost — trying again." } });
await raw("waaccounts").updateOne({ _id: oid(pending) }, { $set: { qr: "2@sandbox-qr-not-a-real-code,AbCdEf,GhIjKl,MnOpQr", qrAt: new Date() } });
await raw("waaccounts").updateOne({ _id: oid(number3) }, { $set: { status: "connected", phone: "919000000003", seenAt: new Date(), linkedAt: new Date() } });
setInterval(() => void raw("waaccounts").updateMany({ _id: { $in: [oid(counter), oid(number3)] } }, { $set: { seenAt: new Date() } }), 20_000); // the "worker"
const ago = (min) => new Date(Date.now() - min * 60000);
const wsvg = (c) => "data:image/svg+xml," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 4 3'><rect width='4' height='3' fill='${c}'/></svg>`);
const addChat = async (phone, name, accountId, msgs, extra = {}) => {
  const r = await raw("wachats").insertOne({ brandId: brandA, phone, name, accountId, createdAt: ago(3000), updatedAt: new Date(), unread: 0, ...extra });
  const id = String(r.insertedId);
  for (const m of msgs) await raw("wamessages").insertOne({ brandId: brandA, chatId: id, accountId, type: "text", text: "", media: null, source: "chat", pace: "warm", waId: "", error: "", sendAfter: new Date(), createdAt: new Date(), updatedAt: new Date(), ...m });
  const last = msgs[msgs.length - 1];
  await raw("wachats").updateOne({ _id: r.insertedId }, { $set: { lastMessageAt: last.at, lastPreview: last.text || "📎 photo", lastDirection: last.direction, ...(msgs.some((m) => m.direction === "in") ? { lastInboundAt: msgs.filter((m) => m.direction === "in").pop().at } : {}) } });
  return id;
};
await addChat("919876543210", "Riya Sharma", counter, [
  { direction: "in", text: "Hi! Do you deliver to Laxmi Nagar Block J?", status: "received", at: ago(1500) },
  { direction: "out", text: "Yes we do 🙂 Free delivery above ₹499.", status: "read", at: ago(1490) },
  { direction: "in", text: "Can you send the menu?", status: "received", at: ago(62) },
  { direction: "out", type: "image", text: "Here's today's menu", media: { url: wsvg("#c6362f"), key: "", mime: "image/svg+xml", fileName: "menu.svg", size: 2048 }, status: "delivered", waId: "WA-MENU", at: ago(60) },
  { direction: "out", type: "document", text: "", media: { url: "https://example.com/menu.pdf", key: "", mime: "application/pdf", fileName: "Full menu.pdf", size: 412000 }, status: "sent", at: ago(59) },
  { direction: "in", text: "Great, 2 plates of kurkure momos please\nand one cold coffee", status: "received", at: ago(3) },
], { unread: 1 });
await addChat("919833333333", "Kabir", number2, [
  { direction: "in", text: "Old question from last month", status: "received", at: ago(40 * 1440) },
  { direction: "out", text: "Old answer from last month", status: "read", waId: "WA-OLD", at: ago(40 * 1440 - 5) },
  { direction: "in", text: "Is the Preet Vihar outlet open today?", status: "received", at: ago(240) },
  { direction: "out", text: "Order #0042 at Acme Momos is Ready. Total ₹350.", status: "sent", source: "order", pace: "order", at: ago(200) },
]);
await addChat("919844444444", "", counter, [
  { direction: "out", text: "Diwali special: 20% off this weekend!\n\nReply STOP to stop offers.", status: "queued", source: "broadcast", pace: "cold", sendAfter: new Date(Date.now() + 14 * 3600_000), at: ago(30) },
]);
await addChat("919855555555", "Meera", counter, [
  { direction: "out", text: "Hello Meera, your table is booked for 8 pm.", status: "failed", error: "This number isn't on WhatsApp.", pace: "cold", at: ago(20) },
]);
// customers for the broadcast audience (Asha Rao above is the sixth)
await raw("customers").insertMany(["9833333333", "9844444444", "9855555555", "9866666666", "9877777777"].map((p, i) => ({ brandId: brandA, phone: p, name: `Customer ${i + 2}`, createdAt: new Date(), updatedAt: new Date() })));
await raw("wachats").updateOne({ phone: "919833333333" }, { $set: { optedOut: true } });

/* ----------------------------------------------- Marketing Mart (marketing tests) */
// A third store with customers who differ in age, gender, last visit, items, order types and area — so every
// marketing filter has someone who matches and someone who doesn't. Kept apart from Acme so the other tests'
// customer counts don't change.
const M = await call("POST", "/api/brands", { cookie: su, body: { brandName: "Marketing Mart", brandSlug: "mart", outletName: "Mart Main", outletSlug: "main", hostnames: ["mart.localhost:3170"], ownerEmail: "o@mart.test", ownerName: "Mart Owner", ownerPassword: "Owner123!", planId: idOf(pro) } });
const brandM = idOf(M.brand) !== "undefined" ? idOf(M.brand) : String(M.brandId);
const mainM = idOf(M.outlet) !== "undefined" ? idOf(M.outlet) : String(M.outletId);
const ownerM = await login("o@mart.test", "Owner123!");
const secondM = idOf((await call("POST", "/api/outlets", { cookie: ownerM, body: { name: "Mart Second", slug: "second" } })).outlet);
await raw("outlets").updateMany({ brandId: brandM }, { $set: { hostnames: ["mart.localhost:3170"], canonicalHostname: "mart.localhost:3170" } });
const MM = [["Momos", [["Paneer Steamed Momos", "veg", null, [], true, 9000], ["Paneer Gravy Momos", "veg", null, [], true, 11000], ["Veg Steamed Momos", "veg", null, [], true, 8000], ["Chicken Momos", "non-veg", null, [], true, 10000]]], ["Drinks", [["Cold Coffee", "veg", null, [], true, 7000]]]];
await seedMenu(mainM, ownerM, MM);
await seedMenu(secondM, ownerM, MM);
await cfg(mainM, ownerM, { identity: { name: "Marketing Mart — Main", location: { point: { lat: 28.6304, lng: 77.2773 }, formattedAddress: "Laxmi Nagar, Delhi" } } });
await cfg(secondM, ownerM, { identity: { name: "Marketing Mart — Second", location: { point: { lat: 28.5707, lng: 77.3219 }, formattedAddress: "Sector 18, Noida" } } });
// one linked WhatsApp number (the worker is off, so it is faked online)
const martWa = (await call("POST", "/api/whatsapp/accounts", { cookie: ownerM, outlet: mainM, body: { label: "Mart phone" } })).account.id;
await raw("waaccounts").updateOne({ _id: oid(martWa) }, { $set: { status: "connected", phone: "919000000099", pushName: "Marketing Mart", seenAt: new Date(), linkedAt: new Date() } });
setInterval(() => void raw("waaccounts").updateOne({ _id: oid(martWa) }, { $set: { seenAt: new Date() } }), 20_000);

const daysAgo = (n) => new Date(Date.now() - n * 86_400_000);
const yr = new Date().getFullYear();
const dayKey = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");
let orderSeq = 100;
const mk = async (c) => (await raw("customers").insertOne({ brandId: brandM, orderCount: 0, walletBalance: 0, createdAt: daysAgo(400), updatedAt: new Date(), ...c })).insertedId;
const order = async (cid, who, outlet, channel, lines, n, extra = {}) => {
  const at = daysAgo(n);
  await raw("orders").insertOne({
    brandId: brandM, outletId: outlet, orderNumber: String(++orderSeq), orderDay: dayKey(at), channel, placedBy: "customer", status: "completed",
    customer: { customerId: String(cid), name: who.name, phone: who.phone },
    lines: lines.map(([name, quantity]) => ({ itemId: "x", name, quantity, unitPrice: 9000, lineTotal: 9000 * quantity })),
    totals: { grandTotal: 20000 }, payment: { gateway: "cod", status: "paid" }, statusHistory: [], createdAt: at, updatedAt: at, ...extra,
  });
  await raw("customers").updateOne({ _id: cid }, { $inc: { orderCount: 1 }, $max: { lastOrderAt: at } });
};
const ravi = { name: "Ravi Kumar", phone: "9000000001" };
const raviId = await mk({ ...ravi, gender: "male", age: 24, ageYear: 2020 }); // 24 in 2020 → 30 in 2026
for (const n of [150, 120, 90]) await order(raviId, ravi, mainM, "takeaway", [["Paneer Steamed Momos", 2], ["Paneer Gravy Momos", 1]], n);
const meena = { name: "Meena Iyer", phone: "9000000002" };
const meenaId = await mk({ ...meena, gender: "female", age: 28, ageYear: yr });
for (const n of [12, 5]) await order(meenaId, meena, mainM, "delivery", [["Veg Steamed Momos", 2]], n, { deliveryAddress: { text: "Flat 4, Laxmi Nagar, Delhi", lat: 28.6304, lng: 77.2773, distanceKm: 0.5 } });
const karan = { name: "Karan Singh", phone: "9000000003" };
const karanId = await mk({ ...karan, gender: "male", age: 41, ageYear: yr });
await order(karanId, karan, secondM, "dine-in", [["Cold Coffee", 1]], 70);
const sana = { name: "Sana Khan", phone: "9000000004" };
const sanaId = await mk({ ...sana, gender: "female", age: 19, ageYear: 2024 }); // 19 in 2024
for (const n of [100, 80, 60, 45]) await order(sanaId, sana, secondM, "takeaway", [["Chicken Momos", 3]], n, { deliveryAddress: undefined });
await mk({ name: "Dev Patel", phone: "9000000005", gender: "other" }); // signed up, never ordered, no age
const priya = { name: "Priya Nair", phone: "9000000006" };
const priyaId = await mk({ ...priya, gender: "female", age: 33, ageYear: yr });
for (const n of [30, 10]) await order(priyaId, priya, mainM, "takeaway", [["Paneer Steamed Momos", 1]], n);
const sam = { name: "Stop Sam", phone: "9000000007" };
const samId = await mk({ ...sam, gender: "male", age: 30, ageYear: yr });
await order(samId, sam, mainM, "takeaway", [["Cold Coffee", 1]], 20);
await raw("wachats").insertOne({ brandId: brandM, phone: "919000000007", name: "Stop Sam", accountId: martWa, optedOut: true, unread: 0, createdAt: daysAgo(10), updatedAt: new Date() });
await raw("wachats").insertOne({ brandId: brandM, phone: "919000000008", name: "Chat Only Chandni", accountId: martWa, unread: 0, createdAt: daysAgo(3), updatedAt: new Date(), lastMessageAt: daysAgo(3) }); // messaged on WhatsApp, not a customer
await mk({ name: "Mail Only", email: "mail.only@example.com", gender: "female", age: 27, ageYear: yr }); // no phone → can't be messaged

/* ------------------------------------------------ analytics fixtures (Marketing Mart) */
// ~10 weeks of orders with weekday rhythm, order types, coupons, cancellations and slow kitchens, so every analytics
// figure has a known answer. The EXPECTED figures are worked out below straight from the stored orders with plain loops
// (not with the API's database queries), so a test compares the engine against a second calculation.
for (const [email, name, password, role] of [["m@mart.test", "Mart Manager", "Manager123!", "manager"], ["a@mart.test", "Mart Accountant", "Account123!", "accountant"], ["s@mart.test", "Mart Cashier", "Staff1234!", "staff"]]) {
  await call("POST", "/api/users", { cookie: ownerM, brand: brandM, body: { email, name, password, role } });
}
{
  const IST = 330 * 60_000;
  const istDay = (ms) => new Date(ms + IST).toISOString().slice(0, 10);
  const PRICE = { "Paneer Steamed Momos": 9000, "Paneer Gravy Momos": 11000, "Veg Steamed Momos": 8000, "Chicken Momos": 10000, "Cold Coffee": 7000 };
  const COMBOS = [[["Paneer Steamed Momos", 2], ["Cold Coffee", 1]], [["Veg Steamed Momos", 1]], [["Chicken Momos", 2]], [["Paneer Gravy Momos", 1], ["Cold Coffee", 1]]];
  const BASE = [9, 4, 4, 5, 6, 8, 10]; // orders at Main on Sun…Sat; Second gets about half
  const CHANNELS = ["takeaway", "delivery", "dine-in"];
  let global = 0;
  const docs = [];
  for (let back = 70; back >= 1; back--) {
    const dayMs = Date.now() - back * 86_400_000;
    const key = istDay(dayMs);
    const dow = new Date(`${key}T12:00:00Z`).getUTCDay();
    for (const [outlet, count, shift] of [[mainM, BASE[dow], 0], [secondM, Math.floor(BASE[dow] / 2) + 1, 1]]) {
      for (let i = 0; i < count; i++) {
        global++;
        const channel = CHANNELS[(i + shift) % 3];
        const lines = COMBOS[(i + shift) % COMBOS.length].map(([name, quantity]) => ({ itemId: "x", name, quantity, unitPrice: PRICE[name], lineTotal: PRICE[name] * quantity }));
        const subtotal = lines.reduce((a, l) => a + l.lineTotal, 0);
        const coupon = global % 5 === 0;
        const discount = coupon ? Math.round(subtotal * 0.1) : 0;
        const deliveryFee = channel === "delivery" ? 3000 : 0;
        const grand = subtotal - discount + deliveryFee;
        const tax = Math.round((grand * 5) / 105);
        const cancelled = global % 10 === 0;
        const hour = 11 + ((i * 7 + shift * 3) % 11);
        const at = new Date(`${key}T${String(hour).padStart(2, "0")}:${String((i * 13) % 60).padStart(2, "0")}:00+05:30`);
        const slow = global % 4 === 0;
        const t = (m) => new Date(at.getTime() + m * 60_000);
        const cid = `walkin-${global % 30}`;
        docs.push({
          brandId: brandM, outletId: outlet, orderNumber: String(1000 + i), orderDay: key.replace(/-/g, ""), channel, placedBy: "customer",
          status: cancelled ? "cancelled" : "completed",
          customer: { customerId: cid, name: `Guest ${global % 30}`, phone: `9190000${String(global % 30).padStart(5, "0")}` },
          lines, couponCode: coupon ? "SAVE20" : undefined,
          totals: { subtotal, discount, deliveryFee, taxable: grand - tax, taxAmount: tax, cgst: Math.floor(tax / 2), sgst: tax - Math.floor(tax / 2), serviceCharge: 0, coinsDiscount: 0, grandTotal: grand },
          payment: { gateway: channel === "delivery" ? "razorpay" : "cod", status: cancelled ? "pending" : "paid" },
          statusHistory: cancelled ? [{ status: "placed", at }, { status: "cancelled", at: t(3) }] : [{ status: "placed", at }, { status: "accepted", at: t(slow ? 6 : 2) }, { status: "preparing", at: t(slow ? 8 : 4) }, { status: "ready", at: t(slow ? 34 : 14) }, { status: "completed", at: t(slow ? 40 : 20) }],
          createdAt: at, updatedAt: at,
        });
      }
    }
  }
  await raw("orders").insertMany(docs);

  // ---- the expected answers, worked out from EVERY stored order of the store with plain loops
  const all = await raw("orders").find({ brandId: brandM }).toArray();
  const isSale = (o) => o.status !== "cancelled" && o.payment?.status === "paid";
  const window = (fromBack, toBack, outlet) => {
    const from = istDay(Date.now() - fromBack * 86_400_000), to = istDay(Date.now() - toBack * 86_400_000);
    const rows = all.filter((o) => { const d = istDay(new Date(o.createdAt).getTime()); return d >= from && d <= to && (!outlet || o.outletId === outlet); });
    const sold = rows.filter(isSale);
    const sum = (list, f) => list.reduce((a, o) => a + f(o), 0);
    const items = {};
    for (const o of sold) for (const l of o.lines) items[l.name] = (items[l.name] ?? 0) + l.quantity;
    return {
      from, to,
      sales: sum(sold, (o) => o.totals.grandTotal), tax: sum(sold, (o) => o.totals.taxAmount ?? 0), net: sum(sold, (o) => o.totals.grandTotal - (o.totals.taxAmount ?? 0)),
      orders: sold.length, cancelled: rows.filter((o) => o.status === "cancelled").length, placed: rows.length,
      itemsSold: sum(sold, (o) => sum(o.lines, (l) => l.quantity)), discount: sum(sold, (o) => o.totals.discount ?? 0),
      topItems: Object.entries(items).sort((a, b) => b[1] - a[1]).map(([name, qty]) => ({ name, qty })),
      cgst: sum(sold, (o) => o.totals.cgst ?? 0), sgst: sum(sold, (o) => o.totals.sgst ?? 0), taxable: sum(sold, (o) => o.totals.taxable ?? 0),
      byChannel: Object.fromEntries(CHANNELS.map((c) => [c, sum(sold.filter((o) => o.channel === c), (o) => o.totals.grandTotal)])),
      cash: sum(sold.filter((o) => o.payment.gateway === "cod"), (o) => o.totals.grandTotal),
    };
  };
  // stock suggestions for Main: the last 6 whole weeks ending yesterday, average per weekday, +15%
  const stock = {};
  const sixWeeks = all.filter((o) => o.outletId === mainM && isSale(o) && (Date.now() - new Date(o.createdAt).getTime()) <= 42 * 86_400_000 + 86_400_000);
  const dayKeys = Array.from({ length: 42 }, (_, i) => istDay(Date.now() - (i + 1) * 86_400_000));
  for (const name of Object.keys(PRICE)) {
    const perWeekday = Array.from({ length: 7 }, () => 0);
    for (const d of dayKeys) {
      const dow = new Date(`${d}T12:00:00Z`).getUTCDay();
      for (const o of sixWeeks) if (istDay(new Date(o.createdAt).getTime()) === d) for (const l of o.lines) if (l.name === name) perWeekday[dow] += l.quantity;
    }
    stock[name] = perWeekday.map((total) => { const avg = total / 6; return avg > 0 ? Math.max(1, Math.ceil(avg * 1.15)) : 0; });
  }
  globalThis.__analyticsExpect = { last7: window(6, 0), last30: window(29, 0), prev30: window(59, 30), last30Main: window(29, 0, mainM), last30Second: window(29, 0, secondM), today: window(0, 0), stockMain: stock };
}

/* ------------------------------------------------------------------ done */
const ids = { analytics: globalThis.__analyticsExpect, brandA, main, second, brandB, only, brandM, mainM, secondM, planStarter: idOf(starter), planPro: idOf(pro) };
writeFileSync(`${HERE}ids.json`, JSON.stringify(ids, null, 2));
console.log("READY", JSON.stringify(ids));
setInterval(() => {}, 1 << 30);
