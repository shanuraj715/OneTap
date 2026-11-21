// A customer's order history (the storefront Account page) and deleting an order (the dashboard Orders page) —
// API checks on an in-memory database (nothing real is touched). Orders are written straight into the database so
// every combination (online/cash, paid/pending, completed/cancelled, coins used and earned) is easy to set up.
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { fileURLToPath as __f } from "node:url";
import { mkdirSync as __mk } from "node:fs";
const REPO = __f(new URL("../../..", import.meta.url)).replace(/\/$/, "");
const API = `${REPO}/apps/api`;
const PORT = 3088;
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
// (the server builds its indexes at start-up; the coin ledger's one-row-per-order key is what stops a double refund)
await db.WalletLedgerModel.init();
const must = async (p, what) => { const r = await p; if (r.status >= 400) { console.error("SETUP FAILED", what, r.status, JSON.stringify(r.json).slice(0, 300)); process.exit(1); } return r; };

/* ------------------------------------------------------------------ setup */
const su = await login("super@sandbox.test", "Super123!");
const idOf = (o) => String(o?._id ?? o?.id);
const withCoins = idOf((await must(call("POST", "/api/platform/plans", { cookie: su, body: { name: "Everything", entitlements: { features: schema.FEATURE_KEYS } } }), "plan 1")).json.plan);
const noCoins = idOf((await must(call("POST", "/api/platform/plans", { cookie: su, body: { name: "No coins", entitlements: { features: schema.FEATURE_KEYS.filter((k) => k !== "wallet") } } }), "plan 2")).json.plan);
const mkStore = async (name, slug, host, email, planId) => {
  const j = (await must(call("POST", "/api/brands", { cookie: su, body: { brandName: name, brandSlug: slug, outletName: "Main", outletSlug: "main", hostnames: [host], ownerEmail: email, ownerName: "Owner", ownerPassword: "Owner123!", planId } }), `store ${slug}`)).json;
  return { brand: String(j.brand?._id ?? j.brand?.id ?? j.brandId), outlet: String(j.outlet?._id ?? j.outlet?.id ?? j.outletId), name };
};
const A = await mkStore("Acme", "acme", "acme.test", "o@acme.test", withCoins);
const B = await mkStore("Beta", "beta", "beta.test", "o@beta.test", noCoins);
const ownerA = await login("o@acme.test", "Owner123!");
const ownerB = await login("o@beta.test", "Owner123!");
const hdr = (s) => ({ "x-onetap-outlet": s.outlet, "x-onetap-brand": s.brand });
const mkUser = async (email, role) => { await must(call("POST", "/api/users", { cookie: ownerA, headers: hdr(A), body: { email, name: role, password: "Password123!", role } }), email); return login(email, "Password123!"); };
const manager = await mkUser("m@acme.test", "manager");
const cashier = await mkUser("c@acme.test", "staff");
const kitchen = await mkUser("k@acme.test", "kitchen");
// coins switched on for both stores' outlets (Beta's plan doesn't include the feature, so they must still stay hidden there)
const wallet = { enabled: true, earnRatePaise: 1000, redeemValuePaise: 100, minOrderToEarn: 0, maxRedeemPercent: 50, expiryDays: 0 };
await must(call("PATCH", `/api/outlets/${A.outlet}/config`, { cookie: ownerA, headers: hdr(A), body: { wallet } }), "wallet A");
await must(call("PATCH", `/api/outlets/${B.outlet}/config`, { cookie: ownerB, headers: hdr(B), body: { wallet } }), "wallet B");

/** a customer who has signed in on a store's sign-in screen (the dev code is returned when the store sends nothing) */
async function signUp(store, phone, name) {
  const r = await call("POST", "/api/customer/otp/request", { body: { outletId: store.outlet, destination: phone, name } });
  const v = await fetch(`${base}/api/customer/otp/verify`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ outletId: store.outlet, destination: phone, code: r.json.devCode, name, gender: "female", age: 30 }) });
  const customer = (await v.json()).customer;
  return { cookie: v.headers.get("set-cookie")?.split(";")[0], id: customer.id, name };
}
const asha = await signUp(A, "9811700001", "Asha Rao");
const ravi = await signUp(A, "9811700002", "Ravi Kumar");
const bela = await signUp(B, "9811700003", "Bela Shah");
// (through the model, like the app does — a customer's sign-in is remembered for a few seconds and dropped when the customer is written to)
const setCoins = (c, n) => db.CustomerModel.updateOne({ _id: oid(c.id) }, { $set: { walletBalance: n } });
const balanceOf = async (c) => (await raw("customers").findOne({ _id: oid(c.id) })).walletBalance;

let counter = 100;
const line = (name, qty, price, extra = {}) => ({ itemId: name.toLowerCase(), name, quantity: qty, unitPrice: price, lineTotal: qty * price, gstRatePct: 5, variantLabel: null, modifiers: [], ...extra });
const totals = (grand, extra = {}) => ({ subtotal: grand, discount: 0, deliveryFee: 0, coinsRedeemed: 0, coinsDiscount: 0, coinsEarned: 0, taxable: grand, cgst: 0, sgst: 0, taxAmount: 0, serviceCharge: 0, roundOff: 0, grandTotal: grand, ...extra });
/** write an order straight into the database, `ageMin` minutes old */
async function seed(store, who, { status = "placed", gateway = "cod", paymentStatus = "pending", channel = "takeaway", lines = [line("Veg Momos", 2, 12000)], grand = 24000, extra = {}, ageMin = 0, outlet = store.outlet } = {}) {
  const n = ++counter;
  const at = new Date(Date.now() - ageMin * 60_000);
  const doc = { brandId: store.brand, outletId: outlet, orderNumber: String(n), orderDay: "2026-11-19", channel, placedBy: "customer", status, customer: { customerId: who.id, name: who.name, phone: "9811700000" }, lines, totals: totals(grand, extra), pricesIncludeTax: true, payment: { gateway, status: paymentStatus }, statusHistory: [{ status: "placed", at }], note: "", createdAt: at, updatedAt: at };
  const r = await raw("orders").insertOne(doc);
  return { id: String(r.insertedId), orderNumber: String(n) };
}

/* ------------------------------------------------------------------ 1 */
say("1. the customer's order history");
{
  const o1 = await seed(A, asha, { status: "placed", ageMin: 1 });
  const o2 = await seed(A, asha, { status: "completed", gateway: "razorpay", paymentStatus: "paid", lines: [line("Paneer Roll", 1, 18000, { variantLabel: "Large", modifiers: [{ id: "x", name: "Extra cheese", priceDelta: 2000 }] })], grand: 20000, extra: { coinsEarned: 20 }, ageMin: 30 });
  const o3 = await seed(A, asha, { status: "cancelled", ageMin: 90 });
  await seed(A, ravi, { status: "placed", ageMin: 5 });
  await seed(B, bela, { status: "placed" });

  let r = await call("GET", `/api/customer/orders?outletId=${A.outlet}`);
  ok(r.status === 401, "without signing in there is no history", `${r.status}`);
  r = await call("GET", `/api/customer/orders?outletId=${A.outlet}`, { cookie: asha.cookie });
  ok(r.status === 200 && r.json.orders.length === 3, "a customer sees their own three orders", `${r.status} ${r.json.orders?.length}`);
  ok(r.json.orders.map((o) => o.orderNumber).join() === [o1, o2, o3].map((o) => o.orderNumber).join(), "…newest first");
  ok(!JSON.stringify(r.json).includes(ravi.id) && !r.json.orders.some((o) => o.id === undefined), "…and nobody else's order is among them");
  const paid = r.json.orders.find((o) => o.orderNumber === o2.orderNumber);
  ok(paid.status === "completed" && paid.payment.gateway === "razorpay" && paid.payment.status === "paid", "each order carries its status and how it is paid (mode and paid / pending)", JSON.stringify({ s: paid.status, p: paid.payment }));
  ok(paid.items[0].name === "Paneer Roll" && paid.items[0].variantLabel === "Large" && paid.items[0].modifiers[0] === "Extra cheese" && paid.totals.grandTotal === 20000 && paid.totals.coinsEarned === 20, "…the items (with size and add-ons) and the money, including coins earned");
  ok(paid.outlet.name === "Main" && paid.outlet.slug === "main", "…and which outlet it was at");
  ok(!("staffName" in paid) && !("customer" in paid) && !("statusHistory" in paid) && !("note" in paid), "staff details, the customer record and internal history are not sent");
  r = await call("GET", `/api/customer/orders?outletId=${B.outlet}`, { cookie: asha.cookie });
  ok(r.status === 403, "a customer of one store can't read orders through another store", `${r.status}`);
  r = await call("GET", `/api/customer/orders?outletId=${B.outlet}`, { cookie: bela.cookie });
  ok(r.status === 200 && r.json.orders.length === 1, "…each store's customers see only their own store");
  r = await call("GET", `/api/customer/orders?outletId=${A.outlet}&limit=2`, { cookie: asha.cookie });
  const first = r.json;
  ok(first.orders.length === 2 && first.nextBefore, "paging: the first page of two says there are more", `${first.orders.length} ${first.nextBefore}`);
  r = await call("GET", `/api/customer/orders?outletId=${A.outlet}&limit=2&before=${encodeURIComponent(new Date(first.nextBefore).toISOString())}`, { cookie: asha.cookie });
  ok(r.json.orders.length === 1 && r.json.orders[0].orderNumber === o3.orderNumber && r.json.nextBefore === null, "…the second page has the rest, and no more after it", `${r.json.orders?.length} ${r.json.nextBefore}`);
  ok((await call("GET", `/api/customer/orders?outletId=${A.outlet}&before=nonsense`, { cookie: asha.cookie })).status === 400, "a nonsense date is a plain 400");
  ok((await call("GET", `/api/customer/orders?outletId=000000000000000000000000`, { cookie: asha.cookie })).status === 404, "an outlet that doesn't exist is a 404");
}

/* ------------------------------------------------------------------ 2 */
say("2. coins — shown only when the store has them");
{
  await setCoins(asha, 70);
  let r = await call("GET", `/api/customer/orders?outletId=${A.outlet}`, { cookie: asha.cookie });
  ok(r.json.coins.enabled === true && r.json.coins.balance === 70 && r.json.coins.valuePaise === 7000, "coins on (plan has them, outlet switched them on): the balance and what it is worth", JSON.stringify(r.json.coins));
  await call("PATCH", `/api/outlets/${A.outlet}/config`, { cookie: ownerA, headers: hdr(A), body: { wallet: { ...wallet, enabled: false } } });
  r = await call("GET", `/api/customer/orders?outletId=${A.outlet}`, { cookie: asha.cookie });
  ok(r.json.coins.enabled === false && r.json.coins.balance === 0, "the outlet switched coins off: nothing about coins is sent", JSON.stringify(r.json.coins));
  await call("PATCH", `/api/outlets/${A.outlet}/config`, { cookie: ownerA, headers: hdr(A), body: { wallet } });
  await raw("customers").updateOne({ _id: oid(bela.id) }, { $set: { walletBalance: 40 } });
  r = await call("GET", `/api/customer/orders?outletId=${B.outlet}`, { cookie: bela.cookie });
  ok(r.json.coins.enabled === false && r.json.coins.balance === 0, "a store whose PLAN doesn't include coins never shows them, even with a balance and the outlet setting on", JSON.stringify(r.json.coins));
}

/* ------------------------------------------------------------------ 3 */
say("3. deleting an order — who may");
const del = (cookie, id, store = A) => call("DELETE", `/api/orders/${id}`, { cookie, headers: hdr(store) });
{
  const t = await seed(A, ravi, { status: "placed" });
  let r = await del(cashier, t.id);
  ok(r.status === 403, "a cashier can't delete an order", `${r.status} ${r.json.error}`);
  r = await del(kitchen, t.id);
  ok(r.status === 403, "nor can the kitchen", `${r.status}`);
  r = await del(ownerB, t.id, B);
  ok(r.status === 404, "another store's owner can't reach it (not found)", `${r.status}`);
  r = await call("DELETE", `/api/orders/${t.id}`, { headers: hdr(A) });
  ok(r.status === 401, "nobody signed in can't delete it", `${r.status}`);
  ok((await raw("orders").findOne({ _id: oid(t.id) })).deletedAt === undefined, "…and it is untouched so far");
  r = await del(manager, t.id);
  ok(r.status === 403, "a manager can't either — deleting is for the owner and the platform admin only", `${r.status} ${r.json.error}`);
  ok((await raw("orders").findOne({ _id: oid(t.id) })).deletedAt === undefined, "…and the order is untouched after the manager's attempt");
  r = await del(su, t.id);
  ok(r.status === 200 && r.json.ok === true, "the platform super admin can", `${r.status} ${r.json.error ?? ""}`);
  const u = await seed(A, ravi, { status: "placed" });
  r = await del(ownerA, u.id);
  ok(r.status === 200, "the store owner can", `${r.status}`);
  r = await del(ownerA, u.id);
  ok(r.status === 404, "deleting it again is a 404 — it is gone", `${r.status}`);
  r = await del(ownerA, "000000000000000000000000");
  ok(r.status === 404, "an order that never existed is a 404");
}

/* ------------------------------------------------------------------ 4 */
say("4. deleting an order — what it puts right");
{
  // paid online: refuse
  const online = await seed(A, asha, { status: "completed", gateway: "razorpay", paymentStatus: "paid" });
  let r = await del(ownerA, online.id);
  ok(r.status === 409 && r.json.details?.code === "order_paid_online" && /Refund it with the payment gateway first/.test(r.json.error), "an order paid online can't be deleted — it says to refund it first", `${r.status} ${r.json.error}`);
  ok((await raw("orders").findOne({ _id: oid(online.id) })).deletedAt === undefined, "…and nothing about it changed");
  // paid in cash is fine; the test gateway too
  const cash = await seed(A, asha, { status: "completed", gateway: "cod", paymentStatus: "paid" });
  ok((await del(ownerA, cash.id)).status === 200, "an order paid in cash can be deleted");
  const mock = await seed(A, asha, { status: "completed", gateway: "mock", paymentStatus: "paid" });
  ok((await del(ownerA, mock.id)).status === 200, "so can one paid through the test gateway (no real money)");

  // coins: it used 30 and earned 10 — both are put right
  await setCoins(asha, 100);
  const coin = await seed(A, asha, { status: "completed", paymentStatus: "paid", extra: { coinsRedeemed: 30, coinsDiscount: 3000, coinsEarned: 10 } });
  await del(ownerA, coin.id);
  ok((await balanceOf(asha)) === 120, "coins the order used (30) go back and coins it earned (10) are taken back: 100 → 120", `${await balanceOf(asha)}`);
  const ledger = await raw("walletledgers").find({ orderId: coin.id }).toArray();
  ok(ledger.some((l) => l.kind === "reverse" && l.coins === 30) && ledger.some((l) => l.kind === "revoke" && l.coins === 10), "…both are in the customer's coin history", JSON.stringify(ledger.map((l) => [l.kind, l.coins])));
  // earned coins already spent: never below zero
  await setCoins(asha, 4);
  const spent = await seed(A, asha, { status: "completed", paymentStatus: "paid", extra: { coinsEarned: 25 } });
  await del(ownerA, spent.id);
  const l2 = await raw("walletledgers").findOne({ orderId: spent.id, kind: "revoke" });
  ok((await balanceOf(asha)) === 0 && l2.coins === 4, "coins already spent can't be taken twice: only the 4 left are taken back, the balance stops at 0", `${await balanceOf(asha)} / ${l2?.coins}`);
  // a cancelled order already refunded its coins: deleting it refunds nothing more
  await setCoins(asha, 50);
  const cancelled = await seed(A, asha, { status: "cancelled", extra: { coinsRedeemed: 20, coinsDiscount: 2000 } });
  await raw("walletledgers").insertOne({ brandId: A.brand, outletId: A.outlet, customerId: asha.id, orderId: cancelled.id, orderNumber: cancelled.orderNumber, kind: "reverse", coins: 20, balanceAfter: 50, reason: "Refunded", createdAt: new Date() });
  await del(ownerA, cancelled.id);
  ok((await balanceOf(asha)) === 50, "a cancelled order whose coins were already refunded doesn't refund them twice", `${await balanceOf(asha)}`);
  // a ticket waiting to print is cancelled
  const printed = await seed(A, asha, { status: "placed" });
  await raw("printjobs").insertOne({ brandId: A.brand, outletId: A.outlet, orderId: printed.id, status: "queued", target: "browser", createdAt: new Date(), updatedAt: new Date() });
  await del(ownerA, printed.id);
  const job = await raw("printjobs").findOne({ orderId: printed.id });
  ok(job.status === "cancelled", "a print ticket still waiting for the deleted order is cancelled", job.status);
}

/* ------------------------------------------------------------------ 4b */
say("4b. a customer removes an order from their own account — only their list changes");
{
  await setCoins(asha, 33);
  const mine = await seed(A, asha, { status: "completed", gateway: "cod", paymentStatus: "paid", extra: { coinsEarned: 5 } });
  const other = await seed(A, asha, { status: "placed" });
  const rm = (cookie, id, store = A) => call("DELETE", `/api/customer/orders/${id}?outletId=${store.outlet}`, { cookie });
  let r = await call("DELETE", `/api/customer/orders/${mine.id}?outletId=${A.outlet}`);
  ok(r.status === 401, "signed out, nobody can remove anything", `${r.status}`);
  r = await rm(ravi.cookie, mine.id);
  ok(r.status === 404, "another customer can't remove (or even find) someone else's order", `${r.status}`);
  r = await rm(asha.cookie, mine.id, B);
  ok(r.status === 403, "nor through another store", `${r.status}`);
  ok((await rm(asha.cookie, "not-an-id")).status === 404 && (await rm(asha.cookie, "000000000000000000000000")).status === 404, "an id that isn't an order is a plain 404");
  ok((await call("GET", `/api/customer/orders?outletId=${A.outlet}`, { cookie: asha.cookie })).json.orders.some((o) => o.id === mine.id), "(it is on their list before)");
  r = await rm(asha.cookie, mine.id);
  ok(r.status === 200 && r.json.ok === true, "the customer removes their own order", `${r.status} ${r.json.error ?? ""}`);
  const after = await call("GET", `/api/customer/orders?outletId=${A.outlet}`, { cookie: asha.cookie });
  ok(!after.json.orders.some((o) => o.id === mine.id) && after.json.orders.some((o) => o.id === other.id), "it is gone from THEIR list — and only that one order");
  ok((await rm(asha.cookie, mine.id)).status === 200, "removing it again is harmless");
  // the store is not affected in any way
  const list = await call("GET", "/api/orders", { cookie: ownerA, headers: hdr(A) });
  ok(list.json.orders.some((o) => o.id === mine.id), "the store owner still sees it in the orders list");
  const one = await call("GET", `/api/orders/${mine.id}?outletId=${A.outlet}`, { cookie: ownerA, headers: hdr(A) });
  ok(one.status === 200 && one.json.order.payment.status === "paid" && one.json.order.totals.coinsEarned === 5, "…unchanged: its payment, its totals, its coins", `${one.status}`);
  ok((await balanceOf(asha)) === 33, "the customer's coins are not touched by hiding an order", `${await balanceOf(asha)}`);
  const doc = await raw("orders").findOne({ _id: oid(mine.id) });
  ok(doc.customerHiddenAt && !doc.deletedAt, "it is marked 'hidden by the customer' — and NOT deleted", JSON.stringify({ hidden: Boolean(doc.customerHiddenAt), deleted: Boolean(doc.deletedAt) }));
  const stillOpens = await call("GET", `/api/orders/${mine.id}?outletId=${A.outlet}`, { cookie: asha.cookie });
  ok(stillOpens.status === 200, "their own link to it still opens (they only tidied their list)", `${stillOpens.status}`);
  // and the store can still delete it later, which is the store's decision
  ok((await del(ownerA, mine.id)).status === 200, "the store can still delete it on its own side");
  ok((await del(ownerA, other.id)).status === 200, "(clean-up)");
}

/* ------------------------------------------------------------------ 5 */
say("5. a deleted order is gone from everywhere");
{
  const keep = await seed(A, ravi, { status: "placed", ageMin: 2 });
  const gone = await seed(A, ravi, { status: "placed", ageMin: 1 });
  let list = await call("GET", "/api/orders", { cookie: ownerA, headers: hdr(A) });
  ok(list.json.orders.some((o) => o.id === gone.id), "(it is in the orders list before)");
  await del(ownerA, gone.id);
  list = await call("GET", "/api/orders", { cookie: ownerA, headers: hdr(A) });
  ok(!list.json.orders.some((o) => o.id === gone.id) && list.json.orders.some((o) => o.id === keep.id), "the dashboard's orders list no longer shows it (and still shows the others)");
  ok((await call("GET", `/api/orders/${gone.id}?outletId=${A.outlet}`, { cookie: ownerA, headers: hdr(A) })).status === 404, "opening it is a 404");
  ok((await call("PATCH", `/api/orders/${gone.id}/status`, { cookie: ownerA, headers: hdr(A), body: { status: "accepted" } })).status === 404, "it can't be moved to another status either");
  const mine = await call("GET", `/api/customer/orders?outletId=${A.outlet}`, { cookie: ravi.cookie });
  ok(!mine.json.orders.some((o) => o.id === gone.id) && mine.json.orders.some((o) => o.id === keep.id), "the customer's own history no longer shows it");
  const mineById = await call("GET", `/api/orders/${gone.id}?outletId=${A.outlet}`, { cookie: ravi.cookie });
  ok(mineById.status === 404, "nor their order page", `${mineById.status}`);
  const kept = await raw("orders").findOne({ _id: oid(gone.id) });
  ok(kept && kept.deletedAt && kept.deletedBy && kept.deletedByName, "the record is kept in the database, marked with when and who deleted it (nothing is lost for good)", `${kept?.deletedByName}`);
  // reports count only what is left
  const rep = await call("GET", "/api/analytics/overview", { cookie: ownerA, headers: hdr(A) });
  ok(rep.status === 200 || rep.status === 400, "(reports still answer)", `${rep.status}`);
  const counted = await db.OrderModel.countDocuments({ brandId: A.brand });
  const all = await db.OrderModel.countDocuments({ brandId: A.brand }).setOptions({ includeDeleted: true });
  ok(all > counted, "every ordinary query skips deleted orders; only a query that asks for them gets them", `${counted} of ${all}`);
  const agg = await db.OrderModel.aggregate([{ $match: { brandId: A.brand } }, { $count: "n" }]);
  ok(agg[0].n === counted, "…aggregations (reports, marketing audiences) too", `${agg[0].n}`);
}

/* ------------------------------------------------------------------ 6 */
say("6. deleting a whole store wipes its deleted orders too");
{
  const before = await db.OrderModel.countDocuments({ brandId: B.brand }).setOptions({ includeDeleted: true });
  const t = await seed(B, bela, { status: "placed" });
  await del(ownerB, t.id, B);
  const withDeleted = await db.OrderModel.countDocuments({ brandId: B.brand }).setOptions({ includeDeleted: true });
  ok(withDeleted === before + 1, "(Beta has an order that was deleted from its dashboard)", `${withDeleted}`);
  const r = await call("DELETE", `/api/platform/stores/${B.brand}`, { cookie: su, body: { confirmName: "Beta" } });
  ok(r.status === 200, "the platform deletes the Beta store", `${r.status} ${r.json.error ?? ""}`);
  const left = await db.OrderModel.countDocuments({ brandId: B.brand }).setOptions({ includeDeleted: true });
  ok(left === 0, "no order of it is left — not even the ones that had been deleted", `${left} left`);
}

console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
server.close();
process.exit(fail ? 1 : 0);
