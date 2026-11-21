// Following an order (the customer's tracking API), how late an order is, cancelling an order nobody accepts, and
// error messages that say WHICH box is wrong — API checks on an in-memory database (nothing real is touched).
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { fileURLToPath as __f } from "node:url";
import { mkdirSync as __mk } from "node:fs";
const REPO = __f(new URL("../../..", import.meta.url)).replace(/\/$/, "");
const API = `${REPO}/apps/api`;
const PORT = 3086;
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

const asha = await signUp(A, "9811800001", "Asha Rao");
const ravi = await signUp(A, "9811800002", "Ravi Kumar");
const bela = await signUp(B, "9811800003", "Bela Shah");
const cashier = await mkUser("c@acme.test", "staff");
const orders = await import(`${API}/src/modules/orders/orders.service.js`);

/* ------------------------------------------------------------------ 1 */
say("1. following one order (GET /api/customer/orders/:id)");
{
  const o = await seed(A, asha, { status: "preparing", history: [{ status: "placed", minutesAgo: 6, by: "customer" }, { status: "accepted", minutesAgo: 5, by: "64b000000000000000000001" }, { status: "preparing", minutesAgo: 4, by: "64b000000000000000000002" }] });
  const url = (id, outlet = A.outlet) => `/api/customer/orders/${id}?outletId=${outlet}`;
  let r = await call("GET", url(o.id));
  ok(r.status === 401, "without signing in there is nothing to follow", `${r.status}`);
  r = await call("GET", url("not-an-id"), { cookie: asha.cookie });
  ok(r.status === 404, "a made-up order id is a plain 404", `${r.status}`);
  r = await call("GET", url(o.id), { cookie: ravi.cookie });
  ok(r.status === 404, "another customer of the same store can't follow it", `${r.status}`);
  r = await call("GET", url(o.id), { cookie: bela.cookie });
  ok(r.status === 403, "a customer of ANOTHER store is turned away", `${r.status}`);
  r = await call("GET", url(o.id, B.outlet), { cookie: asha.cookie });
  ok(r.status === 403, "…and asking through another store's outlet is refused too", `${r.status}`);
  r = await call("GET", url(o.id), { cookie: asha.cookie });
  const t = r.json.order;
  ok(r.status === 200 && t.status === "preparing" && t.orderNumber === o.orderNumber, "the customer follows their own order", `${r.status} ${t?.status}`);
  ok(Array.isArray(t.history) && t.history.map((h) => h.status).join() === "placed,accepted,preparing", "it says what happened, in order", JSON.stringify(t.history?.map((h) => h.status)));
  ok(t.history.every((h) => Object.keys(h).sort().join() === "at,status"), "…with a time for each — and never WHICH team member did it", JSON.stringify(Object.keys(t.history[0] ?? {})));
  ok(t.items?.[0]?.name === "Veg Momos" && t.totals.grandTotal === 24000 && t.payment.gateway === "cod" && t.outlet.slug === "main", "it carries the items, the money, how it is paid and the outlet");
  ok(!("customer" in t) && !("staffName" in t) && !("statusHistory" in t), "staff details and the internal history are not sent");

  // the older "one order" endpoint a signed-in customer could already use must not leak staff ids either
  r = await call("GET", `/api/orders/${o.id}?outletId=${A.outlet}`, { cookie: asha.cookie });
  ok(r.status === 200 && r.json.order.statusHistory.every((h) => !("by" in h)), "GET /api/orders/:id for a customer also leaves out who changed the status", JSON.stringify(r.json.order?.statusHistory?.[1]));
  r = await call("GET", `/api/orders/${o.id}?outletId=${A.outlet}`, { cookie: ownerA, headers: hdr(A) });
  ok(r.status === 200 && r.json.order.statusHistory.some((h) => h.by), "…while the team still sees it", String(r.json.order?.statusHistory?.length));

  // it is read from the database every time: when staff move the order the customer sees it on the very next ask
  r = await own("PATCH", `/api/orders/${o.id}/status`, { status: "ready" });
  ok(r.status === 200, "staff mark the order ready");
  const { r: again, ops } = await cost(() => call("GET", url(o.id), { cookie: asha.cookie }));
  ok(again.json.order.status === "ready" && again.json.order.history.at(-1).status === "ready", "the customer's next look says Ready — straight away", again.json.order?.status);
  ok(ops.includes("orders.findOne"), "…because the order itself is read from the database on every ask (never a saved copy)", ops.join(", "));
}

/* ------------------------------------------------------------------ 2 */
say("2. running late");
{
  const late = (await call("GET", `/api/customer/orders/${(await seed(A, asha, { status: "placed", ageMin: 5 })).id}?outletId=${A.outlet}`, { cookie: asha.cookie })).json.order;
  ok(late.late?.kind === "accept" && late.late.minutes >= 5, "an order nobody has accepted for longer than the limit (2 min) says so", JSON.stringify(late.late));
  const fresh = (await call("GET", `/api/customer/orders/${(await seed(A, asha, { status: "placed", ageMin: 1 })).id}?outletId=${A.outlet}`, { cookie: asha.cookie })).json.order;
  ok(fresh.late === null, "a new order is not 'late'");
  const slow = (await call("GET", `/api/customer/orders/${(await seed(A, asha, { status: "preparing", history: [{ status: "placed", minutesAgo: 30 }, { status: "accepted", minutesAgo: 25 }, { status: "preparing", minutesAgo: 24 }] })).id}?outletId=${A.outlet}`, { cookie: asha.cookie })).json.order;
  ok(slow.late?.kind === "prep", "an accepted order still not ready after the cooking limit (20 min) says so", JSON.stringify(slow.late));
  const pre = (await call("GET", `/api/customer/orders/${(await seed(A, asha, { status: "placed", ageMin: 30, scheduledFor: Date.now() + 5 * 3600_000 })).id}?outletId=${A.outlet}`, { cookie: asha.cookie })).json.order;
  ok(pre.late === null, "a pre-order for later today is not late while its pickup is hours away");
  const done = (await call("GET", `/api/customer/orders/${(await seed(A, asha, { status: "completed", ageMin: 90, history: [{ status: "placed", minutesAgo: 90 }, { status: "accepted", minutesAgo: 89 }, { status: "completed", minutesAgo: 30 }] })).id}?outletId=${A.outlet}`, { cookie: asha.cookie })).json.order;
  ok(done.late === null, "a finished order is never late");
  await must(own("PATCH", `/api/outlets/${A.outlet}/config`, { operations: { sla: { enabled: false } } }), "alerts off");
  const off = (await call("GET", `/api/customer/orders/${(await seed(A, asha, { status: "placed", ageMin: 9 })).id}?outletId=${A.outlet}`, { cookie: asha.cookie })).json.order;
  ok(off.late === null, "with the missed-order alerts switched off the customer isn't told either");
  await must(own("PATCH", `/api/outlets/${A.outlet}/config`, { operations: { sla: { enabled: true } } }), "alerts on");
}

/* ------------------------------------------------------------------ 3 */
say("3. a missed order is cancelled when the store asks for it");
{
  const sla = async (patch) => must(own("PATCH", `/api/outlets/${A.outlet}/config`, { operations: { sla: patch } }), "sla");
  const stateOf = async (id) => (await raw("orders").findOne({ _id: oid(id) }));
  const stale = await seed(A, asha, { status: "placed", ageMin: 8 });
  const paidOnline = await seed(A, asha, { status: "placed", ageMin: 8, gateway: "razorpay", paymentStatus: "paid" });
  const recent = await seed(A, asha, { status: "placed", ageMin: 3 });
  const accepted = await seed(A, asha, { status: "accepted", ageMin: 20, history: [{ status: "placed", minutesAgo: 20 }, { status: "accepted", minutesAgo: 19 }] });
  const pre = await seed(A, asha, { status: "placed", ageMin: 60, scheduledFor: Date.now() + 4 * 3600_000 });
  const otherStore = await seed(B, bela, { status: "placed", ageMin: 8 });

  // (orders left over from the checks above are put out of the way, so this section counts only its own)
  const mine = [stale, paidOnline, recent, accepted, pre, otherStore].map((o) => oid(o.id));
  await raw("orders").updateMany({ _id: { $nin: mine }, status: "placed" }, { $set: { status: "completed" } });
  ok((await orders.sweepUnacceptedOrders()) === 0, "by default nothing is ever cancelled by itself (the setting is 0 = never)");
  ok((await stateOf(stale.id)).status === "placed", "…an old unaccepted order just stays placed");

  r_ok: {
    const r = await call("PATCH", `/api/outlets/${A.outlet}/config`, { cookie: ownerA, headers: hdr(A), body: { operations: { sla: { autoCancelMinutes: 241 } } } });
    ok(r.status === 400 && /Auto cancel minutes can be at most 240/.test(r.json.error), "more than 240 minutes is refused and says which box and what the most is", r.json.error);
  }
  await sla({ autoCancelMinutes: 5 });
  const n = await orders.sweepUnacceptedOrders();
  ok(n === 1, "with 'cancel after 5 minutes' on, exactly one order is cancelled", String(n));
  const gone = await stateOf(stale.id);
  ok(gone.status === "cancelled" && gone.statusHistory.at(-1).status === "cancelled" && /within 5 minutes/.test(gone.statusHistory.at(-1).reason ?? ""), "the unaccepted order is cancelled, and the history says why", gone.statusHistory?.at(-1)?.reason);
  ok((await stateOf(paidOnline.id)).status === "placed", "an order already paid online is left for a person");
  ok((await stateOf(recent.id)).status === "placed", "an order younger than the limit is left alone");
  ok((await stateOf(accepted.id)).status === "accepted", "an order that was accepted is left alone");
  ok((await stateOf(pre.id)).status === "placed", "a pre-order for later is left alone (its clock starts an hour before pickup)");
  ok((await stateOf(otherStore.id)).status === "placed", "another store's order is never touched (its setting is 0)");
  ok((await orders.sweepUnacceptedOrders()) === 0, "running it again cancels nothing more");
  const r = await call("GET", `/api/customer/orders/${stale.id}?outletId=${A.outlet}`, { cookie: asha.cookie });
  ok(r.json.order.status === "cancelled" && /Nobody accepted it within 5 minutes/.test(r.json.order.cancelReason ?? ""), "the customer's page says it was cancelled, and why", r.json.order?.cancelReason);
  ok(r.json.order.payment && (await call("GET", `/api/customer/orders?outletId=${A.outlet}`, { cookie: asha.cookie })).json.orders.some((o) => o.id === stale.id && o.status === "cancelled"), "…and the Account page lists it as cancelled");
  await sla({ autoCancelMinutes: 0 });
}

/* ------------------------------------------------------------------ 4 */
say("4. a refused request says WHICH box is wrong");
{
  let r = await own("POST", "/api/tables", { number: "X".repeat(21), seats: 4 });
  ok(r.status === 400 && r.json.error === "The table number can be at most 20 characters.", "a 21-character table number", r.json.error);
  r = await own("POST", "/api/tables", { number: "", seats: 4 });
  ok(r.status === 400 && r.json.error === "Enter the table number.", "no table number", r.json.error);
  r = await own("POST", "/api/tables", { number: "S1", seats: 51 });
  ok(r.status === 400 && r.json.error === "A table can have at most 50 seats.", "51 seats", r.json.error);
  r = await own("POST", "/api/tables", { number: "S2", seats: 0 });
  ok(r.status === 400 && /Seats must be at least 1/.test(r.json.error), "0 seats is refused, not turned into 4", r.json.error);
  r = await own("POST", "/api/tables", { number: "S3", seats: 2.5 });
  ok(r.status === 400 && /whole number/.test(r.json.error), "2.5 seats", r.json.error);
  r = await own("POST", "/api/tables", { number: "S4", seats: "four" });
  ok(r.status === 400 && /Seats must be a number/.test(r.json.error), "text for seats", r.json.error);
  r = await own("POST", "/api/tables", { number: "T9", seats: 4 });
  ok(r.status === 201, "T9 is created");
  r = await own("POST", "/api/tables", { number: "T9", seats: 4 });
  ok(r.status === 409 && r.json.error === "Table T9 already exists.", "T9 again", r.json.error);
  r = await own("POST", "/api/tables", { number: "t9", seats: 4 });
  ok(r.status === 409 && /Table T9 already exists/.test(r.json.error) && /capital letters/.test(r.json.error), "'t9' is the same table as 'T9' (capital letters don't make a new table)", r.json.error);
  r = await own("POST", "/api/tables", { number: " t9 ", seats: 4 });
  ok(r.status === 409, "…spaces round it don't either", String(r.status));
  const t10 = (await own("POST", "/api/tables", { number: "T10", seats: 4 })).json.table;
  r = await own("PATCH", `/api/tables/${t10.id}`, { number: "t9" });
  ok(r.status === 409 && /already exists/.test(r.json.error), "renaming a table to an existing number (in other capitals) is refused", r.json.error);
  r = await own("PATCH", `/api/tables/${t10.id}`, { number: "T10" });
  ok(r.status === 200, "…but saving a table under its own number is fine");
  // the same wording everywhere, not only on tables
  r = await own("PATCH", `/api/outlets/${A.outlet}/config`, { operations: { sla: { acceptMinutes: 241 } } });
  ok(r.status === 400 && r.json.error === "Accept minutes can be at most 240.", "Settings → Missed-order alerts: 241 minutes", r.json.error);
  r = await own("PATCH", `/api/outlets/${A.outlet}/config`, { operations: { sla: { acceptMinutes: 0 } } });
  ok(r.status === 400 && /Accept minutes must be at least 1/.test(r.json.error), "…and 0 minutes", r.json.error);
  r = await own("POST", "/api/coupons", { code: "X".repeat(40), discountType: "percent", value: 10 });
  ok(r.status === 400 && /^[A-Z][a-z]/.test(r.json.error) && r.json.error !== "Validation failed", "any other form gets a sentence about its box too", r.json.error);
  ok(Array.isArray(r.json.details?.fieldErrors?.code ?? r.json.details?.formErrors) || r.json.details, "(the detailed list is still sent along for anything that wants it)");
}

console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
await new Promise((r) => server.close(r));
await mongod.stop();
process.exit(fail ? 1 : 0);
