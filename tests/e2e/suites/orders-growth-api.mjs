// Out for delivery + riders, pre-orders (a later pickup time), counted stock, dishes with hours, combos and
// "buy X get Y free" coupons — API checks on an in-memory database (nothing real is touched).
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { fileURLToPath as __f } from "node:url";
import { mkdirSync as __mk } from "node:fs";
const REPO = __f(new URL("../../..", import.meta.url)).replace(/\/$/, "");
const API = `${REPO}/apps/api`;
const PORT = 3102;
const __RUN = __f(new URL("../.bench/suite-run/", import.meta.url));
__mk(__RUN, { recursive: true });
process.chdir(__RUN); // no .env here → the real database URI is never read
const req = createRequire(`${API}/package.json`);
const mms = await import(pathToFileURL(req.resolve("mongodb-memory-server")).href);
const mongod = await (mms.MongoMemoryServer ?? mms.default.MongoMemoryServer).create();
Object.assign(process.env, { NODE_ENV: "development", API_PORT: String(PORT), MONGODB_URI: mongod.getUri(), MONGODB_DB: "sandbox", LOG_LEVEL: "error", RATE_LIMITS: "off", ALLOW_MOCK_GATEWAY: "true" });
const db = await import(`${REPO}/packages/db/src/index.js`);
await db.connectDb({ uri: mongod.getUri(), dbName: "sandbox" });
const { createApp } = await import(`${API}/src/app.js`);
const server = createApp().listen(PORT);
await new Promise((r) => server.once("listening", r));
const { ensureSuperAdmin } = await import(`${API}/src/modules/auth/auth.service.js`);
await ensureSuperAdmin({ email: "super@sandbox.test", name: "Super", password: "Super123!" });
const schema = await import(`${REPO}/packages/config-schema/src/index.js`);
const stock = await import(`${API}/src/modules/menu/stock.service.js`);
const raw = (c) => db.mongoose.connection.db.collection(c);
const oid = (s) => new db.mongoose.Types.ObjectId(String(s));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const base = `http://127.0.0.1:${PORT}`;
const call = async (method, path, { body, cookie, headers = {} } = {}) => {
  const r = await fetch(base + path, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text(); let json = {}; try { json = JSON.parse(text); } catch {}
  return { status: r.status, json };
};
const login = async (email, password) => (await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) })).headers.get("set-cookie")?.split(";")[0];
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const say = (s) => console.log(`\n=== ${s}`);
const must = async (p, what) => { const r = await p; if (r.status >= 400) { console.error("SETUP FAILED", what, r.status, JSON.stringify(r.json).slice(0, 300)); process.exit(1); } return r; };

/* ------------------------------------------------------------------ setup */
const su = await login("super@sandbox.test", "Super123!");
const idOf = (o) => String(o?._id ?? o?.id);
const everything = idOf((await must(call("POST", "/api/platform/plans", { cookie: su, body: { name: "Everything", entitlements: { features: schema.FEATURE_KEYS } } }), "plan")).json.plan);
const basic = idOf((await must(call("POST", "/api/platform/plans", { cookie: su, body: { name: "Basic", entitlements: { features: schema.FEATURE_KEYS.filter((k) => !["scheduledOrders", "delivery", "reservations", "feedback", "cartReminders"].includes(k)) } } }), "plan 2")).json.plan);
const mk = async (name, slug, email, planId) => {
  const j = (await must(call("POST", "/api/brands", { cookie: su, body: { brandName: name, brandSlug: slug, outletName: "Main", outletSlug: "main", hostnames: [`${slug}.test`], ownerEmail: email, ownerName: "Owner", ownerPassword: "Owner123!", planId } }), `store ${slug}`)).json;
  return { brand: String(j.brand?._id ?? j.brand?.id ?? j.brandId), outlet: String(j.outlet?._id ?? j.outlet?.id ?? j.outletId) };
};
const A = await mk("Acme", "acme", "o@acme.test", everything);
const B = await mk("Beta", "beta", "o@beta.test", basic);
const owner = await login("o@acme.test", "Owner123!");
const ownerB = await login("o@beta.test", "Owner123!");
const H = { "x-rasoipulse-outlet": A.outlet, "x-rasoipulse-brand": A.brand };
const HB = { "x-rasoipulse-outlet": B.outlet, "x-rasoipulse-brand": B.brand };
const own = (method, path, body) => call(method, path, { cookie: owner, headers: H, body });
const mkUser = async (email, role) => { await must(own("POST", "/api/users", { email, name: role, password: "Password123!", role }), email); return login(email, "Password123!"); };
const manager = await mkUser("m@acme.test", "manager");
const cashier = await mkUser("c@acme.test", "staff");
const as = (cookie) => (method, path, body) => call(method, path, { cookie, headers: H, body });
// every hour of the day is open, so pre-order times exist whenever this runs
await must(own("PATCH", `/api/outlets/${A.outlet}/config`, { operations: { hours: { enabled: true, opensAt: "00:00", closesAt: "23:59" }, orders: { allowOrderEdit: true, editLockAfter: "never" } }, payments: { enabled: ["cod", "mock"] } }), "config A");

async function signUp(store, phone, name) {
  const r = await call("POST", "/api/customer/otp/request", { body: { outletId: store.outlet, destination: phone, name } });
  const v = await fetch(`${base}/api/customer/otp/verify`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ outletId: store.outlet, destination: phone, code: r.json.devCode, name, gender: "female", age: 30 }) });
  const customer = (await v.json()).customer;
  return { cookie: v.headers.get("set-cookie")?.split(";")[0], id: customer.id, name };
}
const asha = await signUp(A, "9811700001", "Asha Rao");
const bela = await signUp(B, "9811700003", "Bela Shah");

// the menu: Food (kitchen), Drinks (bar), and Breakfast, whose hours are shut right now (they open in two hours)
const cat = async (name, extra = {}) => (await must(own("POST", "/api/menu/categories", { name, ...extra }), `category ${name}`)).json.category;
const itm = async (categoryId, name, extra = {}) => (await must(own("POST", "/api/menu/items", { categoryId, name, basePrice: 10000, ...extra }), `item ${name}`)).json.item;
const nowMin = schema.istParts().minutes;
const shut = [{ days: [0, 1, 2, 3, 4, 5, 6], from: schema.toHHMM((nowMin + 120) % 1440), to: schema.toHHMM((nowMin + 180) % 1440) }];
const food = await cat("Food");
const drinks = await cat("Drinks", { prepStation: "bar" });
const breakfast = await cat("Breakfast", { availability: { windows: shut } });
const momos = await itm(food.id, "Veg Momos", { stock: { tracked: true, left: 5, lowAt: 3 } });
const chai = await itm(drinks.id, "Masala Chai", { basePrice: 3000 });
const poha = await itm(breakfast.id, "Poha", { basePrice: 6000 });
const line = (item, quantity, extra = {}) => ({ itemId: item.id, quantity, modifierOptionIds: [], ...extra });
const placeAs = (who, lines, extra = {}) => call("POST", "/api/orders", { cookie: who.cookie, body: { outletId: A.outlet, cart: { lines }, channel: "takeaway", ...extra } });
const staffPlace = (lines, extra = {}) => own("POST", "/api/orders", { outletId: A.outlet, cart: { lines }, channel: "takeaway", name: "Walk-in", ...extra });
const menuItem = async (id) => (await call("GET", `/api/menu?outletId=${A.outlet}`)).json.items.find((i) => i.id === id);
const leftOf = async (item) => (await menuItem(item.id))?.stock?.left;

/* ------------------------------------------------------------------ 1 */
say("1. counted stock — orders take it, cancelling and deleting give it back");
{
  let m = await menuItem(momos.id);
  ok(m.stock?.tracked === true && m.stock.left === 5 && m.stock.lowAt === 3, "a dish can be counted: the menu says 5 are left", JSON.stringify(m.stock));
  let r = await placeAs(asha, [line(momos, 2)]);
  ok(r.status === 201 && (await leftOf(momos)) === 3, "a customer orders 2 → 3 are left", `${r.status} ${await leftOf(momos)}`);
  const o1 = r.json.order;
  r = await placeAs(asha, [line(momos, 4)]);
  ok(r.status === 409 && /Only 3 Veg Momos left/.test(r.json.error ?? r.json.message ?? ""), "ordering 4 when only 3 are left is refused, saying how many are left", `${r.status} ${JSON.stringify(r.json).slice(0, 120)}`);
  r = await placeAs(asha, [line(momos, 2), line(momos, 2)]);
  ok(r.status === 409, "…two lines of the same dish add up (2 + 2 > 3)", `${r.status}`);
  ok((await leftOf(momos)) === 3, "a refused order takes nothing");
  r = await placeAs(asha, [line(momos, 3)]);
  const o2 = r.json.order;
  ok(r.status === 201 && (await leftOf(momos)) === 0, "the last 3 sell → 0 left", `${await leftOf(momos)}`);
  const shown = schema.menuForNow((await call("GET", `/api/menu?outletId=${A.outlet}`)).json).items.find((i) => i.id === momos.id);
  ok(shown.isAvailable === false && shown.unavailableLabel === "Sold out", "at 0 the storefront shows it as Sold out", JSON.stringify({ a: shown.isAvailable, l: shown.unavailableLabel }));
  r = await placeAs(asha, [line(momos, 1)]);
  ok(r.status === 409 && /sold out/i.test(JSON.stringify(r.json)), "ordering a sold-out dish is refused", `${r.status}`);
  await must(own("PATCH", `/api/orders/${o2.id}/status`, { status: "cancelled" }), "cancel");
  ok((await leftOf(momos)) === 3, "cancelling the order of 3 gives them back", `${await leftOf(momos)}`);
  await must(own("PATCH", `/api/orders/${o2.id}/status/manual`, { status: "cancelled", reason: "again" }).catch(() => ({ status: 200 })), "re-cancel (no-op)");
  ok((await leftOf(momos)) === 3, "…and only once");
  r = await own("DELETE", `/api/orders/${o1.id}`);
  ok(r.status === 200 && (await leftOf(momos)) === 5, "deleting an order that was never handed over gives its stock back too", `${r.status} ${await leftOf(momos)}`);
  // an edit takes or gives the difference
  r = await staffPlace([line(momos, 1)]);
  const o3 = r.json.order;
  ok((await leftOf(momos)) === 4, "staff orders take stock too");
  r = await own("PATCH", `/api/orders/${o3.id}`, { cart: { lines: [line(momos, 6)] } });
  ok(r.status === 409 && (await leftOf(momos)) === 4, "editing it up to 6 (only 4 + its own 1 = 5 there) is refused and changes nothing", `${r.status} ${await leftOf(momos)}`);
  r = await own("PATCH", `/api/orders/${o3.id}`, { cart: { lines: [line(momos, 3)] } });
  ok(r.status === 200 && (await leftOf(momos)) === 2, "editing it up to 3 takes 2 more", `${r.status} ${await leftOf(momos)}`);
  r = await own("PATCH", `/api/orders/${o3.id}`, { cart: { lines: [line(chai, 1)] } });
  ok(r.status === 200 && (await leftOf(momos)) === 5, "editing the momos out gives all 3 back", `${await leftOf(momos)}`);
  await must(own("PATCH", `/api/orders/${o3.id}/status`, { status: "cancelled" }), "cancel o3");
}

/* ------------------------------------------------------------------ 2 */
say("2. the daily refill, and online orders nobody paid for");
{
  await must(own("PATCH", `/api/menu/items/${momos.id}`, { stock: { tracked: true, left: 2, daily: 20, lowAt: 3 } }), "daily 20");
  ok((await leftOf(momos)) === 2, "setting today's count keeps it (the morning refill doesn't overwrite a number the owner just typed)");
  await raw("menuitems").updateOne({ _id: oid(momos.id) }, { $set: { "stock.resetDay": "2000-01-01" } });
  stock.__resetRefillMemo();
  ok((await leftOf(momos)) === 20, "on a new day the dish is refilled to its daily number when the menu is next read", `${await leftOf(momos)}`);
  ok((await leftOf(momos)) === 20, "…once (reading again doesn't refill again)");
  let r = await placeAs(asha, [line(momos, 4)], { gateway: "mock" });
  ok(r.status === 201 && (await leftOf(momos)) === 16, "an online order waiting for payment holds its stock", `${await leftOf(momos)}`);
  const unpaid = r.json.order;
  await raw("orders").updateOne({ _id: oid(unpaid.id) }, { $set: { createdAt: new Date(Date.now() - 45 * 60_000) } });
  const released = await stock.sweepUnpaidHolds();
  ok(released === 1 && (await leftOf(momos)) === 20, "…and gives it back if nobody pays within 30 minutes", `${released} ${await leftOf(momos)}`);
  ok((await stock.sweepUnpaidHolds()) === 0 && (await leftOf(momos)) === 20, "…only once");
  await must(own("PATCH", `/api/menu/items/${momos.id}`, { stock: null }), "stop counting");
  ok((await menuItem(momos.id)).stock === null, "counting can be switched off again (stock: null)");
  await must(own("PATCH", `/api/menu/items/${momos.id}`, { stock: { tracked: true, left: 10, lowAt: 3 } }), "count again");
}

/* ------------------------------------------------------------------ 3 */
say("3. dishes with hours (a breakfast menu)");
{
  const menu = (await call("GET", `/api/menu?outletId=${A.outlet}`)).json;
  ok(menu.categories.find((c) => c.id === breakfast.id)?.availability?.windows?.length === 1, "a category carries its hours in the menu");
  const p = schema.menuForNow(menu).items.find((i) => i.id === poha.id);
  ok(p.isAvailable === false && /^Available /.test(p.unavailableLabel ?? ""), "outside its hours a dish shows when it IS available instead of a price", p.unavailableLabel);
  ok(schema.menuForNow(menu, Date.now(), { hideOutsideHours: true }).items.every((i) => i.id !== poha.id), "…or is hidden, when the outlet chooses that");
  let r = await placeAs(asha, [line(poha, 1)]);
  ok(r.status === 409 && /only available/i.test(JSON.stringify(r.json)), "a customer can't order it now", `${r.status} ${JSON.stringify(r.json).slice(0, 100)}`);
  r = await staffPlace([line(poha, 1)]);
  ok(r.status === 201, "staff at the till can still sell it", `${r.status}`);
  await must(own("PATCH", `/api/orders/${r.json.order.id}/status`, { status: "cancelled" }), "cancel");
  r = await own("PATCH", `/api/menu/categories/${breakfast.id}`, { availability: { windows: [{ days: [1], from: "08:00", to: "08:00" }] } });
  ok(r.status === 400, "a window that starts and ends at the same time is refused", `${r.status}`);
  r = await own("PATCH", `/api/menu/categories/${breakfast.id}`, { availability: { windows: [{ days: [9], from: "08:00", to: "09:00" }] } });
  ok(r.status === 400, "a day that doesn't exist is refused", `${r.status}`);
  r = await own("PATCH", `/api/menu/items/${poha.id}`, { availability: { windows: [{ days: [0, 1, 2, 3, 4, 5, 6], from: "00:00", to: "23:59" }] } });
  ok(r.status === 200 && schema.menuForNow((await call("GET", `/api/menu?outletId=${A.outlet}`)).json).items.find((i) => i.id === poha.id).isAvailable, "a dish's own hours win over its category's");
  await must(own("PATCH", `/api/menu/items/${poha.id}`, { availability: null }), "back to the category's hours");
}

/* ------------------------------------------------------------------ 4 */
say("4. pre-orders — a later pickup time for takeaway");
let preorder;
{
  let r = await call("GET", `/api/orders/pickup-slots?outletId=${A.outlet}`);
  ok(r.status === 200 && r.json.enabled === false && r.json.days.length === 0, "off until the outlet switches pre-orders on", JSON.stringify(r.json).slice(0, 80));
  await must(own("PATCH", `/api/outlets/${A.outlet}/config`, { operations: { scheduling: { enabled: true, maxDaysAhead: 1, minLeadMinutes: 30, slotMinutes: 15, maxPerSlot: 1 } } }), "pre-orders on");
  r = await call("GET", `/api/orders/pickup-slots?outletId=${A.outlet}`);
  const slots = r.json.days.flatMap((d) => d.slots);
  ok(r.json.enabled && r.json.days.length >= 1 && slots.length > 10, "now the outlet offers pickup times, grouped by day", `${r.json.days.map((d) => `${d.label}:${d.slots.length}`).join(" ")}`);
  ok(slots.every((s) => new Date(s.at).getTime() >= Date.now() + 29 * 60_000), "…none sooner than 30 minutes from now");
  ok(slots.every((s) => (new Date(s.at).getTime() / 60_000) % 15 === 0), "…every 15 minutes");
  const later = slots[3];
  r = await placeAs(asha, [line(chai, 1)], { scheduledFor: later.at });
  preorder = r.json.order;
  ok(r.status === 201 && new Date(preorder.scheduledFor).toISOString() === later.at, "a customer places a takeaway for a later time", `${r.status} ${preorder?.scheduledFor}`);
  r = await placeAs(asha, [line(chai, 1)], { scheduledFor: later.at });
  ok(r.status === 409 && /fully booked/.test(JSON.stringify(r.json)), "a time that's full (1 per time here) is refused", `${r.status}`);
  r = await call("GET", `/api/orders/pickup-slots?outletId=${A.outlet}`);
  ok(r.json.days.flatMap((d) => d.slots).find((s) => s.at === later.at)?.full === true, "…and is shown as full");
  r = await placeAs(asha, [line(chai, 1)], { scheduledFor: new Date(Date.now() + 5 * 60_000).toISOString() });
  ok(r.status === 409, "a time that isn't on offer (too soon / not a slot) is refused", `${r.status}`);
  r = await placeAs(asha, [line(chai, 1)], { scheduledFor: slots[5].at, channel: "dine-in" });
  ok(r.status === 409 || r.status === 400, "only takeaway can be placed for later", `${r.status}`);
  // a dish with hours can be pre-ordered for a time inside them
  const inside = slots.find((s) => schema.timeWindowOpen(shut, new Date(s.at)));
  if (inside) {
    r = await placeAs(asha, [line(poha, 1)], { scheduledFor: inside.at });
    ok(r.status === 201, "breakfast can be pre-ordered for a time when breakfast is served (hours are checked at the pickup time)", `${r.status} ${JSON.stringify(r.json).slice(0, 100)}`);
    if (r.json.order) await must(own("PATCH", `/api/orders/${r.json.order.id}/status`, { status: "cancelled" }), "cancel");
  } else ok(true, "breakfast can be pre-ordered for a time when breakfast is served — (no slot inside the window today: skipped)");
  const hist = (await call("GET", `/api/customer/orders?outletId=${A.outlet}`, { cookie: asha.cookie })).json.orders.find((o) => o.id === preorder.id);
  ok(hist?.scheduledFor && new Date(hist.scheduledFor).toISOString() === later.at, "the customer's Account page shows the pickup time");
  const list = (await own("GET", "/api/orders")).json.orders.find((o) => o.id === preorder.id);
  ok(list?.scheduledFor, "the dashboard's order list carries it too");
  // the plan decides
  await must(call("PATCH", `/api/outlets/${B.outlet}/config`, { cookie: ownerB, headers: HB, body: { operations: { scheduling: { enabled: true } } } }), "B on");
  r = await call("GET", `/api/orders/pickup-slots?outletId=${B.outlet}`);
  ok(r.json.enabled === false, "a store whose plan lacks Pre-orders offers no times, even with the setting on");
  // the missed-order alert waits for the pickup time
  const sla = { enabled: true, acceptMinutes: 2, prepMinutes: 20, sound: true, repeatAlert: true };
  const old = { id: "x", orderNumber: "1", status: "placed", createdAt: new Date(Date.now() - 3 * 3_600_000), statusHistory: [{ status: "placed", at: new Date(Date.now() - 3 * 3_600_000) }] };
  ok(schema.evaluateSla({ ...old, scheduledFor: new Date(Date.now() + 5 * 3_600_000) }, sla) === null, "a pre-order nobody has accepted doesn't turn red hours ahead of its pickup time");
  ok(schema.evaluateSla({ ...old, scheduledFor: new Date(Date.now() + 30 * 60_000) }, sla)?.waitedMinutes === 30, "…its accept clock starts an hour before pickup (30 min to go = 30 min waiting)");
  ok(schema.evaluateSla(old, sla)?.waitedMinutes === 180, "an ordinary order still counts from when it was placed");
}

/* ------------------------------------------------------------------ 5 */
say("5. out for delivery, and riders");
let dOrder;
{
  const seedDelivery = async (status = "ready") => {
    const doc = { brandId: A.brand, outletId: A.outlet, orderNumber: String(9000 + Math.floor(Math.random() * 999)), orderDay: "2026-11-20", channel: "delivery", placedBy: "customer", status, customer: { customerId: asha.id, name: asha.name, phone: "9811700001" }, lines: [{ itemId: chai.id, name: "Masala Chai", quantity: 1, unitPrice: 3000, lineTotal: 3000, gstRatePct: 5, modifiers: [] }], totals: { subtotal: 3000, discount: 0, deliveryFee: 0, coinsRedeemed: 0, coinsDiscount: 0, coinsEarned: 0, taxable: 2857, cgst: 72, sgst: 71, taxAmount: 143, serviceCharge: 0, roundOff: 0, grandTotal: 3000 }, pricesIncludeTax: true, payment: { gateway: "mock", status: "paid" }, statusHistory: [{ status: "placed", at: new Date() }], deliveryAddress: { text: "12 MG Road", lat: 1, lng: 1, distanceKm: 2 }, createdAt: new Date(), updatedAt: new Date() };
    return String((await raw("orders").insertOne(doc)).insertedId);
  };
  ok(schema.nextStatusesFor("ready", "takeaway").join() === "completed" && schema.nextStatusesFor("ready", "delivery").join() === "out_for_delivery,completed", "only a delivery order has an 'Out for delivery' step after Ready");
  const takeaway = (await staffPlace([line(chai, 1)])).json.order;
  for (const s of ["accepted", "preparing", "ready"]) await must(own("PATCH", `/api/orders/${takeaway.id}/status`, { status: s }), s);
  let r = await own("PATCH", `/api/orders/${takeaway.id}/status`, { status: "out_for_delivery" });
  ok(r.status === 409, "a takeaway order can't go out for delivery", `${r.status}`);
  r = await own("PATCH", `/api/orders/${takeaway.id}/rider`, { name: "Ravi", sendOut: true });
  ok(r.status === 409, "…or be given a rider");

  r = await as(cashier)("POST", "/api/riders", { name: "Ramesh", phone: "98765 43210" });
  ok(r.status === 403, "a cashier can't add riders (rider list is for managers)", `${r.status}`);
  r = await as(manager)("POST", "/api/riders", { name: "Ramesh", phone: "98765 43210" });
  const ramesh = r.json.rider;
  ok(r.status === 201 && ramesh?.name === "Ramesh", "a manager adds a rider", `${r.status}`);
  ok((await as(manager)("POST", "/api/riders", { name: "ramesh" })).status === 409, "the same name twice is refused");
  ok((await as(manager)("POST", "/api/riders", { name: "X", phone: "call me" })).status === 400, "a phone that isn't a number is refused");
  r = await as(cashier)("GET", "/api/riders");
  ok(r.status === 200 && r.json.riders.length === 1, "a cashier can see the riders (to hand an order over)");
  ok((await call("GET", "/api/riders", { cookie: ownerB, headers: HB })).status === 403, "a store whose plan has no Delivery has no rider list");

  dOrder = await seedDelivery("ready");
  r = await as(cashier)("PATCH", `/api/orders/${dOrder}/rider`, { riderId: ramesh.id, sendOut: true });
  ok(r.status === 200 && r.json.order.status === "out_for_delivery" && r.json.order.rider?.name === "Ramesh" && r.json.order.rider.phone === "98765 43210", "handing a Ready delivery order to Ramesh marks it Out for delivery with his name and number", `${r.status} ${r.json.order?.status}`);
  const hist = (await call("GET", `/api/customer/orders?outletId=${A.outlet}`, { cookie: asha.cookie })).json.orders.find((o) => o.id === dOrder);
  ok(hist?.status === "out_for_delivery" && hist.rider?.name === "Ramesh" && hist.rider.phone === "98765 43210", "the customer sees it is on its way, and who is bringing it", JSON.stringify(hist?.rider));
  r = await as(cashier)("PATCH", `/api/orders/${dOrder}/rider`, { name: "Suresh", phone: "9000000001" });
  ok(r.status === 200 && r.json.order.rider?.name === "Suresh" && r.json.order.status === "out_for_delivery", "the rider can be changed (a name typed in once works too)");
  r = await own("PATCH", `/api/orders/${dOrder}/rider`, { riderId: "000000000000000000000000" });
  ok(r.status === 404, "a rider who isn't on the list is refused");
  r = await own("PATCH", `/api/orders/${dOrder}/status`, { status: "completed" });
  ok(r.status === 200 && schema.statusLabelFor("completed", "delivery") === "Delivered", "then it is marked delivered (a completed delivery is called Delivered)");
  const after = (await call("GET", `/api/customer/orders?outletId=${A.outlet}`, { cookie: asha.cookie })).json.orders.find((o) => o.id === dOrder);
  ok(after.status === "completed" && after.rider === null, "once delivered, the rider's number is no longer shown to the customer");
  const early = await seedDelivery("preparing");
  r = await own("PATCH", `/api/orders/${early}/rider`, { riderId: ramesh.id, sendOut: true });
  ok(r.status === 409 && /Ready/.test(JSON.stringify(r.json)), "an order still being cooked can't go out yet", `${r.status}`);
  await must(as(manager)("PATCH", `/api/riders/${ramesh.id}`, { isActive: false }), "switch Ramesh off");
  await must(own("PATCH", `/api/orders/${early}/status`, { status: "ready" }), "ready");
  r = await own("PATCH", `/api/orders/${early}/rider`, { riderId: ramesh.id, sendOut: true });
  ok(r.status === 409, "a rider switched off in the list can't be given orders", `${r.status}`);
  ok((await as(manager)("DELETE", `/api/riders/${ramesh.id}`)).status === 204, "a rider can be removed");
  ok((await raw("orders").findOne({ _id: oid(dOrder) })).rider?.name === "Suresh", "…orders keep the rider they went out with");
}

/* ------------------------------------------------------------------ 6 */
say("6. combos — a dish made of other dishes");
let combo;
{
  let r = await own("POST", "/api/menu/items", { categoryId: food.id, name: "Momo Combo", basePrice: 11000, combo: { items: [{ itemId: momos.id, quantity: 1 }, { itemId: chai.id, quantity: 1 }] } });
  combo = r.json.item;
  ok(r.status === 201 && combo.combo?.items?.length === 2, "a combo is a dish with the dishes it is made of", `${r.status}`);
  const info = schema.comboDetails(combo, new Map((await call("GET", `/api/menu?outletId=${A.outlet}`)).json.items.map((i) => [i.id, i])));
  ok(info.separately === 13000 && info.saves === 2000, "the storefront can show what it saves (₹130 separately, ₹110 as a combo → saves ₹20)", JSON.stringify(info));
  r = await own("PATCH", `/api/menu/items/${combo.id}`, { combo: { items: [{ itemId: combo.id, quantity: 1 }] } });
  ok(r.status === 400, "a combo can't contain itself", `${r.status}`);
  r = await own("POST", "/api/menu/items", { categoryId: food.id, name: "Mega", basePrice: 20000, combo: { items: [{ itemId: combo.id, quantity: 1 }] } });
  ok(r.status === 400, "a combo can't contain another combo", `${r.status}`);
  r = await own("PATCH", `/api/menu/items/${momos.id}`, { combo: { items: [{ itemId: chai.id, quantity: 1 }] } });
  ok(r.status === 400, "a dish that is part of a combo can't become a combo itself", `${r.status}`);
  const q = (await call("POST", "/api/orders/quote", { body: { outletId: A.outlet, cart: { lines: [line(combo, 2)] }, channel: "takeaway" } })).json;
  ok(q.lines?.[0]?.includes?.map((p) => p.name).join() === "Veg Momos,Masala Chai", "an ordered combo carries what it is made of", JSON.stringify(q.lines?.[0]?.includes));
  const before = await leftOf(momos);
  r = await placeAs(asha, [line(combo, 2)]);
  ok(r.status === 201 && (await leftOf(momos)) === before - 2, "a combo takes its parts' stock (2 combos → 2 momos)", `${before} → ${await leftOf(momos)}`);
  // kitchen tickets: each part goes to the printer that makes it
  const printer = async (name, station) => (await must(own("POST", "/api/printing/printers", { name, station, docType: "kot", target: "browser", paperWidth: "80mm", autoPrintOn: ["accepted"] }), name)).json.printer;
  const K = await printer("Kitchen", "kitchen");
  const Bp = await printer("Bar", "bar");
  await must(own("PATCH", `/api/orders/${r.json.order.id}/status`, { status: "accepted" }), "accept");
  await sleep(700);
  const jobs = await raw("printjobs").find({ orderId: r.json.order.id }).toArray();
  const kt = jobs.find((j) => j.printerId === idOf(K))?.payload?.text ?? "";
  const bt = jobs.find((j) => j.printerId === idOf(Bp))?.payload?.text ?? "";
  ok(/Veg Momos/.test(kt) && /in Momo Combo/.test(kt) && !/Masala Chai/.test(kt), "the KITCHEN ticket says to make the momos of the combo", kt.replace(/\n+/g, " | ").slice(0, 160));
  ok(/Masala Chai/.test(bt) && /in Momo Combo/.test(bt) && !/Veg Momos/.test(bt), "the BAR ticket says to make its chai", bt.replace(/\n+/g, " | ").slice(0, 160));
  // a pre-order's ticket says when it is wanted
  await must(own("PATCH", `/api/orders/${preorder.id}/status`, { status: "accepted" }), "accept pre-order");
  await sleep(700);
  const pj = (await raw("printjobs").find({ orderId: preorder.id }).toArray()).map((j) => j.payload?.text ?? "").join("\n");
  ok(/PRE-ORDER/.test(pj) && /Pickup \d{1,2}:\d{2} [AP]M, \w{3} \d{1,2} \w{3}/.test(pj), "a pre-order's kitchen ticket starts with PRE-ORDER and the full pickup time", pj.split("\n").slice(0, 4).join(" | "));
  await must(own("PATCH", `/api/orders/${r.json.order.id}/status`, { status: "cancelled" }), "cancel combo order");
}

/* ------------------------------------------------------------------ 7 */
say("7. buy X, get Y free coupons");
{
  let r = await own("POST", "/api/coupons", { code: "B1G1MOMO", discountType: "bogo", value: 1, buyQty: 1, getQty: 1, categoryIds: [food.id], maxPerCustomer: 0 });
  ok(r.status === 201 && r.json.coupon.discountType === "bogo", "a 'buy 1 get 1 free' coupon on the Food category is created", `${r.status} ${JSON.stringify(r.json).slice(0, 120)}`);
  ok(schema.couponSummary(r.json.coupon) === "Buy 1 get 1 free on chosen dishes", "it reads 'Buy 1 get 1 free on chosen dishes'", schema.couponSummary(r.json.coupon));
  const apply = (lines, code = "B1G1MOMO") => call("POST", "/api/coupons/apply", { cookie: asha.cookie, body: { outletId: A.outlet, code, cart: { lines }, channel: "takeaway" } });
  r = await apply([line(momos, 2), line(chai, 1)]);
  ok(r.json.ok === true && r.json.discount === 10000, "2 momos (₹100 each) + a chai: one momo is free — ₹100 off (the chai isn't covered)", JSON.stringify(r.json).slice(0, 120));
  r = await apply([line(momos, 1)]);
  ok(r.json.ok === false && /Add 1 more/.test(r.json.reason), "with only one covered dish it says to add one more", r.json.reason);
  r = await apply([line(chai, 3)]);
  ok(r.json.ok === false && /other dishes/.test(r.json.reason), "with none of the covered dishes it says so", r.json.reason);
  r = await apply([line(momos, 1), line(combo, 1)]);
  ok(r.json.ok === true && r.json.discount === 10000, "the CHEAPEST covered dish is the free one (momo ₹100 free, combo ₹110 paid)", `${r.json.discount}`);
  await must(own("POST", "/api/coupons", { code: "B2G1", discountType: "bogo", value: 1, buyQty: 2, getQty: 1, itemIds: [chai.id], maxPerCustomer: 0, maxFreeUnits: 1 }), "b2g1");
  r = await apply([line(chai, 6)], "B2G1");
  ok(r.json.ok === true && r.json.discount === 3000, "'buy 2 get 1' on chai with at most 1 free: 6 chais → 1 free (₹30)", `${r.json.discount}`);
  const placed = await call("POST", "/api/orders", { cookie: asha.cookie, body: { outletId: A.outlet, cart: { lines: [line(momos, 2)], couponCode: "B1G1MOMO" }, channel: "takeaway" } });
  ok(placed.status === 201 && placed.json.order.totals.discount === 10000 && placed.json.order.couponCode === "B1G1MOMO", "an order placed with it gets the same discount", `${placed.status} ${placed.json.order?.totals?.discount}`);
  r = await own("POST", "/api/coupons", { code: "BAD", discountType: "bogo", value: 1, buyQty: 0, getQty: 1 });
  ok(r.status === 400, "buy 0 is refused", `${r.status}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
await server.close();
await db.mongoose.disconnect();
await mongod.stop();
process.exit(fail ? 1 : 0);
