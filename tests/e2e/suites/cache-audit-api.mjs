// CACHE AUDIT — what the API remembers and what it must always read live. API checks on an in-memory database that
// count every database read a request causes. Remembered: who is signed in, outlet checks, a store's settings, the offers
// list; each is dropped the moment its data is changed. Live: orders and their status, tables, bookings, the kitchen.
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { fileURLToPath as __f } from "node:url";
import { mkdirSync as __mk } from "node:fs";
const REPO = __f(new URL("../../..", import.meta.url)).replace(/\/$/, "");
const API = `${REPO}/apps/api`;
const PORT = 3085;
const __RUN = __f(new URL("../.bench/suite-run/", import.meta.url));
__mk(__RUN, { recursive: true });
process.chdir(__RUN); // no .env here → the real database URI is never read
const req = createRequire(`${API}/package.json`);
const mms = await import(pathToFileURL(req.resolve("mongodb-memory-server")).href);
const mongod = await (mms.MongoMemoryServer ?? mms.default.MongoMemoryServer).create();
Object.assign(process.env, { NODE_ENV: "development", API_PORT: String(PORT), MONGODB_URI: mongod.getUri(), MONGODB_DB: "sandbox", LOG_LEVEL: "error", RATE_LIMITS: "off" });
const db = await import(`${REPO}/packages/db/src/index.js`);
await db.connectDb({ uri: mongod.getUri(), dbName: "sandbox" });
const { createApp } = await import(`${API}/src/app.js`);
const server = createApp().listen(PORT);
await new Promise((r) => server.once("listening", r));
const { ensureSuperAdmin } = await import(`${API}/src/modules/auth/auth.service.js`);
await ensureSuperAdmin({ email: "super@sandbox.test", name: "Super", password: "Super123!" });
const schema = await import(`${REPO}/packages/config-schema/src/index.js`);
const raw = (c) => db.mongoose.connection.db.collection(c);
const oid = (s) => new db.mongoose.Types.ObjectId(String(s));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const base = `http://127.0.0.1:${PORT}`;
const call = async (method, path, { body, cookie, headers = {} } = {}) => {
  const r = await fetch(base + path, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text(); let json = {}; try { json = JSON.parse(text); } catch {}
  return { status: r.status, json, headers: r.headers };
};
const login = async (email, password) => (await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) })).headers.get("set-cookie")?.split(";")[0];
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const say = (s) => console.log(`\n=== ${s}`);
await db.WalletLedgerModel.init();
const must = async (p, what) => { const r = await p; if (r.status >= 400) { console.error("SETUP FAILED", what, r.status, JSON.stringify(r.json).slice(0, 300)); process.exit(1); } return r; };

// every database operation the API makes is written down, so a test can say exactly what a request cost
const dbOps = [];
db.mongoose.set("debug", (collection, method) => { dbOps.push(`${collection}.${method}`); });
const cost = async (fn) => { dbOps.length = 0; const r = await fn(); return { r, ops: [...dbOps] }; };

/* ------------------------------------------------------------------ setup */
const su = await login("super@sandbox.test", "Super123!");
const idOf = (o) => String(o?._id ?? o?.id);
const plan = idOf((await must(call("POST", "/api/platform/plans", { cookie: su, body: { name: "Everything", entitlements: { features: schema.FEATURE_KEYS } } }), "plan")).json.plan);
const mkStore = async (name, slug, host, email) => {
  const j = (await must(call("POST", "/api/brands", { cookie: su, body: { brandName: name, brandSlug: slug, outletName: "Main", outletSlug: "main", hostnames: [host], ownerEmail: email, ownerName: "Owner", ownerPassword: "Owner123!", planId: plan } }), name)).json;
  return { brand: String(j.brand?._id ?? j.brand?.id ?? j.brandId), outlet: String(j.outlet?._id ?? j.outlet?.id ?? j.outletId), name };
};
const A = await mkStore("Acme", "acme", "acme.test", "o@acme.test");
const B = await mkStore("Beta", "beta", "beta.test", "o@beta.test");
const ownerA = await login("o@acme.test", "Owner123!");
const hdr = (s) => ({ "x-onetap-outlet": s.outlet, "x-onetap-brand": s.brand });
const own = (method, path, body) => call(method, path, { cookie: ownerA, headers: hdr(A), body });
const mkUser = async (email, role) => { await must(call("POST", "/api/users", { cookie: ownerA, headers: hdr(A), body: { email, name: role, password: "Password123!", role } }), email); return { cookie: await login(email, "Password123!"), email }; };

/** a customer who has signed in on a store's sign-in screen (the dev code is returned when the store sends nothing) */
async function signUp(store, phone, name) {
  const r = await call("POST", "/api/customer/otp/request", { body: { outletId: store.outlet, destination: phone, name } });
  const v = await fetch(`${base}/api/customer/otp/verify`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ outletId: store.outlet, destination: phone, code: r.json.devCode, name, gender: "female", age: 30 }) });
  const customer = (await v.json()).customer;
  return { cookie: v.headers.get("set-cookie")?.split(";")[0], id: customer.id, name };
}

let counter = 100;
const line = (name, qty, price, extra = {}) => ({ itemId: name.toLowerCase(), name, quantity: qty, unitPrice: price, lineTotal: qty * price, gstRatePct: 5, variantLabel: null, modifiers: [], ...extra });
const totals = (grand, extra = {}) => ({ subtotal: grand, discount: 0, deliveryFee: 0, coinsRedeemed: 0, coinsDiscount: 0, coinsEarned: 0, taxable: grand, cgst: 0, sgst: 0, taxAmount: 0, serviceCharge: 0, roundOff: 0, grandTotal: grand, ...extra });
/** write an order straight into the database, `ageMin` minutes old (history: [{ status, minutesAgo, by?, reason? }]) */
async function seed(store, who, { status = "placed", gateway = "cod", paymentStatus = "pending", channel = "takeaway", lines = [line("Veg Momos", 2, 12000)], grand = 24000, extra = {}, ageMin = 0, history, scheduledFor } = {}) {
  const n = ++counter;
  const at = new Date(Date.now() - ageMin * 60_000);
  const hist = (history ?? [{ status: "placed", minutesAgo: ageMin }]).map((h) => ({ status: h.status, at: new Date(Date.now() - h.minutesAgo * 60_000), ...(h.by ? { by: h.by } : {}), ...(h.reason ? { reason: h.reason } : {}) }));
  const doc = { brandId: store.brand, outletId: store.outlet, orderNumber: String(n), orderDay: "2026-11-21", channel, placedBy: "customer", status, customer: { customerId: who.id, name: who.name, phone: "9811700000" }, lines, totals: totals(grand, extra), pricesIncludeTax: true, payment: { gateway, status: paymentStatus }, statusHistory: hist, createdAt: at, updatedAt: at, ...(scheduledFor ? { scheduledFor: new Date(scheduledFor) } : {}) };
  const r = await raw("orders").insertOne(doc);
  return { id: String(r.insertedId), orderNumber: String(n) };
}

const asha = await signUp(A, "9811900001", "Asha Rao");
const mgr = await mkUser("m@acme.test", "manager");
const kit = await mkUser("k@acme.test", "kitchen");
const ownerB = await login("o@beta.test", "Owner123!");
const reads = (ops, ...collections) => ops.filter((o) => collections.some((c) => o.startsWith(c + ".")));

/* ------------------------------------------------------------------ 1 */
say("1. who is signed in is remembered — and forgotten at once when it changes");
{
  const first = await cost(() => call("GET", "/api/auth/me", { cookie: mgr.cookie }));
  ok(first.r.status === 200 && reads(first.ops, "sessions", "users").length === 2, "the first request reads the session and the person (2 reads)", first.ops.join(", "));
  const second = await cost(() => call("GET", "/api/auth/me", { cookie: mgr.cookie }));
  ok(second.r.status === 200 && second.ops.length === 0, "the next one reads NOTHING from the database", second.ops.join(", ") || "0 reads");
  await call("GET", "/api/orders?limit=5", { cookie: mgr.cookie, headers: hdr(A) }); // (the first look at this outlet is remembered…)
  const withStore = await cost(() => call("GET", "/api/orders?limit=5", { cookie: mgr.cookie, headers: hdr(A) })); // …so this one costs only its own reads
  ok(withStore.r.status === 200 && reads(withStore.ops, "sessions", "users", "outlets").length === 0, "a dashboard read no longer spends reads on the session, the person or the outlet check — only its own data", withStore.ops.join(", "));

  // sign out → refused on the very next request
  const m2 = await login("m@acme.test", "Password123!");
  ok((await call("GET", "/api/auth/me", { cookie: m2 })).status === 200 && (await call("GET", "/api/auth/me", { cookie: m2 })).status === 200, "a second sign-in works (and is remembered too)");
  await call("POST", "/api/auth/logout", { cookie: m2 });
  ok((await call("GET", "/api/auth/me", { cookie: m2 })).status === 401, "signing out takes effect on the very next request");

  // switched off → refused at once
  const c = await mkUser("c@acme.test", "staff");
  ok((await call("GET", "/api/orders?limit=5", { cookie: c.cookie, headers: hdr(A) })).status === 200, "a cashier can read orders (and is remembered)");
  await db.UserModel.updateOne({ email: "c@acme.test" }, { $set: { isActive: false } });
  ok((await call("GET", "/api/orders?limit=5", { cookie: c.cookie, headers: hdr(A) })).status === 401, "switching a person off locks them out on the very next request");

  // a role change → at once
  ok((await call("GET", "/api/coupons", { cookie: mgr.cookie, headers: hdr(A) })).status === 200, "a manager can open the coupons (remembered)");
  await own("PATCH", `/api/users/${(await db.UserModel.findOne({ email: "m@acme.test" }))._id}`, { role: "editor" });
  const after = (await call("GET", "/api/coupons", { cookie: mgr.cookie, headers: hdr(A) })).status;
  ok(after === 403, "changing someone's role takes effect on the very next request", String(after));

  // pausing someone's access to the store (membership blocked) → at once
  ok((await call("GET", "/api/orders?limit=5", { cookie: kit.cookie, headers: hdr(A) })).status === 200, "the kitchen user can read orders (remembered)");
  await db.UserModel.updateOne({ email: "k@acme.test" }, { $set: { "memberships.0.blockedAt": new Date() } });
  ok((await call("GET", "/api/orders?limit=5", { cookie: kit.cookie, headers: hdr(A) })).status === 403, "pausing a person's access takes effect on the very next request");

  // an expired session is refused even while remembered
  const exp = await login("o@acme.test", "Owner123!");
  ok((await call("GET", "/api/auth/me", { cookie: exp })).status === 200, "an owner session (remembered)");
  const token = exp.split("=")[1];
  const { createHash } = await import("node:crypto");
  await raw("sessions").updateOne({ tokenHash: createHash("sha256").update(token).digest("hex") }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  ok((await call("GET", "/api/auth/me", { cookie: exp })).status === 200, "(a change made behind the app's back — straight in the database — is only noticed after at most 30 seconds)");
  const stale = await db.SessionModel.findOne({ userId: String((await db.UserModel.findOne({ email: "o@acme.test" }))._id) }).sort({ createdAt: -1 });
  await db.SessionModel.updateOne({ _id: stale._id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  ok((await call("GET", "/api/auth/me", { cookie: exp })).status === 401, "…while a change made through the app is seen at once (an expired session is refused)");
}

/* ------------------------------------------------------------------ 2 */
say("2. an outlet that is blocked is refused at once");
{
  const o2 = await login("o@acme.test", "Owner123!");
  const who = await mkUser("s2@acme.test", "staff");
  const first = await cost(() => call("GET", "/api/orders?limit=5", { cookie: who.cookie, headers: hdr(A) }));
  const second = await cost(() => call("GET", "/api/orders?limit=5", { cookie: who.cookie, headers: hdr(A) }));
  ok(first.r.status === 200 && second.r.status === 200 && reads(second.ops, "outlets").length === 0, "the outlet check is remembered (no outlet read on the second request)", second.ops.join(", "));
  await db.OutletModel.updateOne({ _id: A.outlet }, { $set: { blocked: { at: new Date(), reason: "over its plan's outlet limit" } } }, { allowGlobalQuery: true });
  ok((await call("GET", "/api/orders?limit=5", { cookie: who.cookie, headers: hdr(A) })).status === 403, "blocking the outlet turns the team away on the very next request");
  await db.OutletModel.updateOne({ _id: A.outlet }, { $set: { blocked: null } }, { allowGlobalQuery: true });
  ok((await call("GET", "/api/orders?limit=5", { cookie: who.cookie, headers: hdr(A) })).status === 200, "unblocking lets them back in at once");
  void o2;
}

/* ------------------------------------------------------------------ 3 */
say("3. a store's settings are remembered — and a change shows at once");
{
  const slots1 = await cost(() => call("GET", `/api/orders/pickup-slots?outletId=${A.outlet}`));
  const slots2 = await cost(() => call("GET", `/api/orders/pickup-slots?outletId=${A.outlet}`));
  ok(slots1.r.json.enabled === false && slots2.ops.length === 0, "pickup times for a store that has none cost no database read the second time", slots2.ops.join(", ") || "0 reads");
  await must(own("PATCH", `/api/outlets/${A.outlet}/config`, { operations: { scheduling: { enabled: true } } }), "scheduling on");
  const slots3 = await call("GET", `/api/orders/pickup-slots?outletId=${A.outlet}`);
  ok(slots3.json.enabled === true && slots3.json.days.length > 0, "switching pre-orders on shows pickup times on the very next request", `${slots3.json.enabled} ${slots3.json.days?.length}`);
  const origin1 = await call("GET", `/api/delivery/origin?outletId=${A.outlet}`);
  await must(own("PATCH", `/api/outlets/${A.outlet}/config`, { operations: { limits: { deliveryRadiusKm: 7 } } }), "radius");
  const origin2 = await cost(() => call("GET", `/api/delivery/origin?outletId=${A.outlet}`));
  ok(origin2.r.json.radiusKm === 7 && origin1.json.radiusKm !== 7, "a changed delivery distance shows at once", `${origin1.json.radiusKm} → ${origin2.r.json.radiusKm}`);
  const again = await cost(() => call("GET", `/api/delivery/origin?outletId=${A.outlet}`));
  ok(again.ops.length === 0, "…and is then remembered again");
}

/* ------------------------------------------------------------------ 4 */
say("4. the offers a storefront advertises");
{
  const c1 = await cost(() => call("GET", `/api/coupons/public?outletId=${A.outlet}`));
  const c2 = await cost(() => call("GET", `/api/coupons/public?outletId=${A.outlet}`));
  ok(c1.r.json.coupons.length === 0 && c2.ops.length === 0, "the (empty) list is remembered", c2.ops.join(", ") || "0 reads");
  const made = await must(own("POST", "/api/coupons", { code: "WELCOME10", discountType: "percent", value: 10, maxRedemptions: 2, active: true }), "coupon");
  const c3 = await call("GET", `/api/coupons/public?outletId=${A.outlet}`);
  ok(c3.json.coupons.map((c) => c.code).join() === "WELCOME10", "a new coupon appears on the very next request", c3.json.coupons?.map((c) => c.code).join());
  const c4 = await cost(() => call("GET", `/api/coupons/public?outletId=${A.outlet}`));
  ok(c4.ops.length === 0, "…and the list is remembered again");
  await db.CouponModel.updateOne({ brandId: A.brand, outletId: A.outlet, code: "WELCOME10" }, { $inc: { redemptionCount: 2 } });
  const c5 = await call("GET", `/api/coupons/public?outletId=${A.outlet}`);
  ok(c5.json.coupons.length === 0, "when its last use is taken it disappears from the list at once", String(c5.json.coupons?.length));
  await db.CouponModel.updateOne({ brandId: A.brand, outletId: A.outlet, code: "WELCOME10" }, { $set: { redemptionCount: 0, validUntil: "2020-01-01" } });
  ok((await call("GET", `/api/coupons/public?outletId=${A.outlet}`)).json.coupons.length === 0, "a coupon whose date has passed is left out (dates are checked fresh every time)");
  void made;
}

/* ------------------------------------------------------------------ 5 */
say("5. a customer's sign-in is remembered, their coins never late");
{
  await must(own("PATCH", `/api/outlets/${A.outlet}/config`, { wallet: { enabled: true, earnRatePaise: 1000, redeemValuePaise: 100, minOrderToEarn: 0, maxRedeemPercent: 50, expiryDays: 0 } }), "wallet");
  const a = await cost(() => call("GET", `/api/customer/orders?outletId=${A.outlet}`, { cookie: asha.cookie }));
  const b = await cost(() => call("GET", `/api/customer/orders?outletId=${A.outlet}`, { cookie: asha.cookie }));
  ok(a.r.status === 200 && b.r.status === 200 && reads(b.ops, "customersessions", "customers").length === 0, "the second request spends no reads on who the customer is", b.ops.join(", "));
  ok(b.r.json.coins.balance === 0, "(no coins yet)");
  await db.CustomerModel.updateOne({ _id: asha.id }, { $set: { walletBalance: 250 } });
  const c = await call("GET", `/api/customer/orders?outletId=${A.outlet}`, { cookie: asha.cookie });
  ok(c.json.coins.balance === 250, "coins added to their wallet show on the very next request", String(c.json.coins?.balance));
  await db.CustomerModel.updateOne({ _id: asha.id }, { $inc: { walletBalance: -100 } });
  ok((await call("GET", `/api/customer/orders?outletId=${A.outlet}`, { cookie: asha.cookie })).json.coins.balance === 150, "…and coins spent too");
  const prof = await call("PATCH", "/api/customer/profile", { cookie: asha.cookie, body: { name: "Asha R." } });
  const me = await call("GET", "/api/customer/me", { cookie: asha.cookie });
  ok(prof.status === 200 && me.json.customer.name === "Asha R.", "a changed name shows at once (the profile edit works on the stored record)", `${prof.status} ${me.json.customer?.name}`);
  await call("POST", "/api/customer/logout", { cookie: asha.cookie });
  ok((await call("GET", "/api/customer/me", { cookie: asha.cookie })).status === 401 || (await call("GET", "/api/customer/me", { cookie: asha.cookie })).json.customer == null, "signing out takes effect on the very next request");
}

/* ------------------------------------------------------------------ 6 */
say("6. things that must be LIVE are read from the database every time");
{
  const ashaB = await signUp(A, "9811900009", "Live Customer");
  const o = await seed(A, ashaB, { status: "placed", ageMin: 0 });
  const live = async (label, fn, collection) => {
    await fn(); // (warm-up: the sign-in, the settings)
    const x = await cost(fn);
    const y = await cost(fn);
    ok(reads(x.ops, collection).length > 0 && reads(y.ops, collection).length > 0, `${label}: every request reads ${collection} from the database`, `${reads(x.ops, collection).join("+")} / ${reads(y.ops, collection).join("+")}`);
  };
  await live("the order list", () => call("GET", "/api/orders?limit=20", { cookie: ownerA, headers: hdr(A) }), "orders");
  await live("one order's status (customer)", () => call("GET", `/api/customer/orders/${o.id}?outletId=${A.outlet}`, { cookie: ashaB.cookie }), "orders");
  await live("the kitchen screen", () => call("GET", "/api/kitchen/orders", { cookie: ownerA, headers: hdr(A) }), "orders");
  await live("the tables", () => call("GET", "/api/tables", { cookie: ownerA, headers: hdr(A) }), "tables");
  await live("which tables are taken (storefront)", () => call("GET", `/api/tables/public?outletId=${A.outlet}`), "tables");
  await live("running tables", () => call("GET", "/api/tables/sessions/active", { cookie: ownerA, headers: hdr(A) }), "tablesessions");
  await live("the bookings", () => call("GET", "/api/reservations", { cookie: ownerA, headers: hdr(A) }), "reservations");
  await live("booking summary", () => call("GET", "/api/reservations/summary", { cookie: ownerA, headers: hdr(A) }), "reservations");
  await live("print jobs", () => call("GET", "/api/printing/jobs", { cookie: ownerA, headers: hdr(A) }), "printjobs");
  await live("the dashboard numbers", () => call("GET", "/api/dashboard/stats", { cookie: ownerA, headers: hdr(A) }), "orders");
  await live("riders", () => call("GET", "/api/riders", { cookie: ownerA, headers: hdr(A) }), "riders");
  // and a change is seen on the very next read, not later
  await own("PATCH", `/api/orders/${o.id}/status`, { status: "accepted" });
  ok((await call("GET", `/api/customer/orders/${o.id}?outletId=${A.outlet}`, { cookie: ashaB.cookie })).json.order.status === "accepted", "an order moved by staff is seen by the customer on the very next read");
  const t = (await own("POST", "/api/tables", { number: "L1", seats: 2 })).json.table;
  ok((await call("GET", `/api/tables/public?outletId=${A.outlet}`)).json.tables.some((x) => x.number === "L1" && x.occupied === false), "a new table is on the storefront's list at once");
  await db.TableModel.updateOne({ brandId: A.brand, outletId: A.outlet, _id: t.id }, { $set: { activeSessionId: "someone" } });
  ok((await call("GET", `/api/tables/public?outletId=${A.outlet}`)).json.tables.find((x) => x.number === "L1").occupied === true, "a table that just got taken shows as taken on the very next read");
}

/* ------------------------------------------------------------------ 7 */
say("7. the console's cache pages");
{
  await call("GET", `/api/menu?outletId=${A.outlet}`);
  const entries = (await call("GET", "/api/platform/cache/entries", { cookie: su })).json;
  ok(entries.entries.length > 0 && entries.entries.every((e) => e.kind !== "auth" && e.kind !== "cauth"), "sign-in entries are never listed (they are about people)", [...new Set(entries.entries.map((e) => e.kind))].join(","));
  ok(["cfg", "outletaccess", "coupons"].some((k) => entries.entries.some((e) => e.kind === k)), "the new kinds (settings, access check, offers) are listed with words, not codes", [...new Set(entries.entries.map((e) => e.kind))].join(","));
  const mine = entries.stores.find((s) => s.name === "Acme");
  ok(mine && mine.entries > 0, "Store by store: Acme has remembered items", JSON.stringify(mine));
  const cfgKey = entries.entries.find((e) => e.kind === "cfg");
  const peek = await call("GET", `/api/platform/cache/entry?key=${encodeURIComponent(cfgKey.key)}`, { cookie: su });
  ok(peek.status === 200, "an item can be opened and read");
  const hiddenAuth = await call("GET", `/api/platform/cache/entry?key=${encodeURIComponent("auth:abc")}`, { cookie: su });
  ok(hiddenAuth.status === 404, "a sign-in item can never be opened");
  const cleared = await call("POST", "/api/platform/cache/expire", { cookie: su, body: { scope: "store", storeId: A.brand } });
  ok(cleared.status === 200 && cleared.json.result.removed > 0 && cleared.json.result.store.name === "Acme", "clearing ONE store's cache removes its items", JSON.stringify(cleared.json.result));
  const after = (await call("GET", "/api/platform/cache/entries", { cookie: su })).json;
  ok(!after.stores.some((s) => s.name === "Acme" && s.entries > 0) || after.stores.find((s) => s.name === "Acme").entries < mine.entries, "…and Acme's row shrinks (or goes) in the list");
  // clearing one store leaves the others (Beta) alone
  await call("GET", `/api/menu?outletId=${B.outlet}`);
  await call("POST", "/api/platform/cache/expire", { cookie: su, body: { scope: "store", storeId: A.brand } });
  const beta = (await call("GET", "/api/platform/cache/entries", { cookie: su })).json.stores.find((s) => s.name === "Beta");
  ok(beta && beta.entries > 0, "other stores keep what they had when one store is cleared", JSON.stringify(beta));
  // the very next request after clearing a store still works (it just reads fresh)
  ok((await call("GET", "/api/orders?limit=5", { cookie: ownerA, headers: hdr(A) })).status === 200, "after clearing, the store's team is not signed out and everything still works");
  void ownerB;
}

console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
await new Promise((r) => server.close(r));
await mongod.stop();
process.exit(fail ? 1 : 0);
