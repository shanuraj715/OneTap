// Table bookings, ratings, "order again", "goes well with" suggestions and abandoned-cart reminders — API checks on
// an in-memory database, with a fake SMS gateway on this machine (nothing real is touched or messaged).
import http from "node:http";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { fileURLToPath as __f } from "node:url";
import { mkdirSync as __mk } from "node:fs";
const REPO = __f(new URL("../../..", import.meta.url)).replace(/\/$/, "");
const API = `${REPO}/apps/api`;
const PORT = 3104;
const SMS_PORT = 3105;
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
const carts = await import(`${API}/src/modules/carts/carts.service.js`);
const raw = (c) => db.mongoose.connection.db.collection(c);
const oid = (s) => new db.mongoose.Types.ObjectId(String(s));

// the fake SMS gateway: remembers every message it is asked to send
const sms = [];
const gateway = http.createServer((rq, rs) => { sms.push(new URL(rq.url, "http://x")); rs.end("OK"); });
await new Promise((r) => gateway.listen(SMS_PORT, r));

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
const NEW = ["reservations", "scheduledOrders", "feedback", "cartReminders"];
const everything = idOf((await must(call("POST", "/api/platform/plans", { cookie: su, body: { name: "Everything", entitlements: { features: schema.FEATURE_KEYS } } }), "plan")).json.plan);
const basic = idOf((await must(call("POST", "/api/platform/plans", { cookie: su, body: { name: "Basic", entitlements: { features: schema.FEATURE_KEYS.filter((k) => !NEW.includes(k)) } } }), "plan 2")).json.plan);
const mk = async (name, slug, email, planId) => {
  const j = (await must(call("POST", "/api/brands", { cookie: su, body: { brandName: name, brandSlug: slug, outletName: "Main", outletSlug: "main", hostnames: [`${slug}.test`], ownerEmail: email, ownerName: "Owner", ownerPassword: "Owner123!", planId } }), `store ${slug}`)).json;
  return { brand: String(j.brand?._id ?? j.brand?.id ?? j.brandId), outlet: String(j.outlet?._id ?? j.outlet?.id ?? j.outletId) };
};
const A = await mk("Acme", "acme", "o@acme.test", everything);
const B = await mk("Beta", "beta", "o@beta.test", basic);
const owner = await login("o@acme.test", "Owner123!");
const ownerB = await login("o@beta.test", "Owner123!");
const H = { "x-onetap-outlet": A.outlet, "x-onetap-brand": A.brand };
const HB = { "x-onetap-outlet": B.outlet, "x-onetap-brand": B.brand };
const own = (method, path, body) => call(method, path, { cookie: owner, headers: H, body });
const as = (cookie, h = H) => (method, path, body) => call(method, path, { cookie, headers: h, body });
const mkUser = async (email, role) => { await must(own("POST", "/api/users", { email, name: role, password: "Password123!", role }), email); return login(email, "Password123!"); };
const manager = await mkUser("m@acme.test", "manager");
const cashier = await mkUser("c@acme.test", "staff");
const kitchen = await mkUser("k@acme.test", "kitchen");
const accountant = await mkUser("a@acme.test", "accountant");
await must(own("PATCH", `/api/outlets/${A.outlet}/config`, { operations: { hours: { enabled: true, opensAt: "00:00", closesAt: "23:59" } } }), "hours");

async function signUp(store, phone, name) {
  const r = await call("POST", "/api/customer/otp/request", { body: { outletId: store.outlet, destination: phone, name } });
  const v = await fetch(`${base}/api/customer/otp/verify`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ outletId: store.outlet, destination: phone, code: r.json.devCode, name, gender: "female", age: 30 }) });
  const customer = (await v.json()).customer;
  return { cookie: v.headers.get("set-cookie")?.split(";")[0], id: customer.id, name, phone };
}
const asha = await signUp(A, "9811700001", "Asha Rao");
const ravi = await signUp(A, "9811700002", "Ravi Kumar");
const meera = await signUp(A, "9811700004", "Meera Iyer");
const bela = await signUp(B, "9811700003", "Bela Shah");

const cat = async (name, extra = {}) => (await must(own("POST", "/api/menu/categories", { name, ...extra }), `category ${name}`)).json.category;
const itm = async (categoryId, name, extra = {}) => (await must(own("POST", "/api/menu/items", { categoryId, name, basePrice: 10000, ...extra }), `item ${name}`)).json.item;
const food = await cat("Food");
const extras = (await must(own("POST", "/api/menu/modifier-groups", { name: "Extras", options: [{ label: "Cheese", priceDelta: 2000 }, { label: "Mayo", priceDelta: 1000 }] }), "group")).json.group;
const spice = (await must(own("POST", "/api/menu/modifier-groups", { name: "Spice level", required: true, minSelect: 1, maxSelect: 1, options: [{ label: "Mild" }, { label: "Hot" }] }), "group 2")).json.group;
const momos = await itm(food.id, "Veg Momos", { variants: [{ label: "Half", price: 7000 }, { label: "Full", price: 12000 }], modifierGroupIds: [extras.id] });
const chai = await itm(food.id, "Masala Chai", { basePrice: 3000 });
const lassi = await itm(food.id, "Sweet Lassi", { basePrice: 5000 });
const cola = await itm(food.id, "Cola", { basePrice: 4000 });
const curry = await itm(food.id, "Curry", { basePrice: 15000, modifierGroupIds: [spice.id] });
const roll = await itm(food.id, "Paneer Roll", { basePrice: 9000 });
const line = (item, quantity, extra = {}) => ({ itemId: item.id, quantity, modifierOptionIds: [], ...extra });

let counter = 100;
const totals = (grand) => ({ subtotal: grand, discount: 0, deliveryFee: 0, coinsRedeemed: 0, coinsDiscount: 0, coinsEarned: 0, taxable: grand, cgst: 0, sgst: 0, taxAmount: 0, serviceCharge: 0, roundOff: 0, grandTotal: grand });
/** write an order straight into the database, `ageDays` old */
async function seed(store, who, { status = "completed", lines, grand = 20000, ageDays = 0, outlet = store.outlet } = {}) {
  const at = new Date(Date.now() - ageDays * 86_400_000);
  const doc = { brandId: store.brand, outletId: outlet, orderNumber: String(++counter), orderDay: "2026-11-20", channel: "takeaway", placedBy: "customer", status, customer: { customerId: who.id, name: who.name, phone: who.phone }, lines, totals: totals(grand), pricesIncludeTax: true, payment: { gateway: "cod", status: "paid" }, statusHistory: [{ status: "placed", at }], createdAt: at, updatedAt: at };
  return String((await raw("orders").insertOne(doc)).insertedId);
}
const pl = (item, qty, extra = {}) => ({ itemId: item.id, name: item.name, quantity: qty, unitPrice: 10000, lineTotal: 10000 * qty, gstRatePct: 5, modifiers: [], ...extra });

/* ------------------------------------------------------------------ 1 */
say("1. table bookings — what can be booked");
const tomorrow = schema.shiftDay(schema.istDayKey(), 1);
const at7 = schema.istDate(tomorrow, 19 * 60).toISOString();
{
  let r = await call("GET", `/api/reservations/availability?outletId=${A.outlet}`);
  ok(r.status === 200 && r.json.enabled === false, "booking is off until the outlet switches it on", JSON.stringify(r.json).slice(0, 80));
  await must(own("PATCH", `/api/outlets/${A.outlet}/config`, { features: { reservations: { enabled: true } }, reservations: { slotMinutes: 30, durationMinutes: 90, maxGuestsPerSlot: 10, minNoticeMinutes: 60, maxDaysAhead: 7, maxPartySize: 12, autoConfirm: false, cancelUntilMinutes: 60, guestNote: "We hold your table for 15 minutes." } }), "booking on");
  r = await call("GET", `/api/reservations/availability?outletId=${A.outlet}&day=${tomorrow}&party=4`);
  ok(r.json.enabled && r.json.days.length === 8 && r.json.dayKey === tomorrow, "now: today plus 7 days to choose from", `${r.json.days?.length} ${r.json.dayKey}`);
  ok(r.json.slots.some((s) => s.at === at7 && s.available && s.seatsLeft === 10), "tomorrow 7 PM is free for 4 (10 seats)", JSON.stringify(r.json.slots.find((s) => s.at === at7)));
  ok(r.json.settings.guestNote === "We hold your table for 15 minutes." && r.json.settings.maxPartySize === 12, "the guest note and party limits come with it");
  const today = (await call("GET", `/api/reservations/availability?outletId=${A.outlet}&party=2`)).json;
  ok(today.slots.every((s) => new Date(s.at).getTime() >= Date.now() + 59 * 60_000), "nothing sooner than an hour from now is offered (minimum notice)");
}

/* ------------------------------------------------------------------ 2 */
say("2. booking, capacity, and what the team does");
let b1, b2;
{
  const book = (who, at, partySize, extra = {}) => call("POST", "/api/reservations", { cookie: who?.cookie, body: { outletId: A.outlet, at, partySize, ...extra } });
  let r = await book(null, at7, 4);
  ok(r.status === 401, "booking needs the customer to be signed in", `${r.status}`);
  r = await book(asha, at7, 4, { note: "Birthday — window seat please" });
  b1 = r.json.reservation;
  ok(r.status === 201 && b1.status === "requested" && /^B-\d{4}$/.test(b1.code), "Asha books tomorrow 7 PM for 4 — it waits for the restaurant to confirm", `${r.status} ${b1?.status} ${b1?.code}`);
  r = await book(ravi, at7, 8);
  ok(r.status === 409 && /Only 6 seats/.test(JSON.stringify(r.json)), "8 more at the same time don't fit (6 seats left)", `${r.status} ${JSON.stringify(r.json).slice(0, 100)}`);
  r = await book(ravi, schema.istDate(tomorrow, 19 * 60 + 30).toISOString(), 6);
  b2 = r.json.reservation;
  ok(r.status === 201, "6 at 7:30 PM fit (they overlap Asha's 4 for an hour: 10 seats)", `${r.status}`);
  r = await call("GET", `/api/reservations/availability?outletId=${A.outlet}&day=${tomorrow}&party=2`);
  ok(r.json.slots.find((s) => s.at === at7)?.available === false, "now 7 PM is full for anyone else");
  r = await book(ravi, schema.istDate(tomorrow, 19 * 60 + 10).toISOString(), 2);
  ok(r.status === 409, "a time that isn't one of the slots is refused", `${r.status}`);
  r = await book(ravi, schema.istDate(tomorrow, 13 * 60).toISOString(), 20);
  ok(r.status === 409 && /call the restaurant/.test(JSON.stringify(r.json)), "a party bigger than the outlet takes online is told to call", `${r.status}`);
  r = await as(cashier)("POST", "/api/reservations/staff", { at: at7, partySize: 2, name: "Walk-in Kapoor", phone: "9000000000" });
  ok(r.status === 409, "the team can't overbook by accident…", `${r.status}`);
  r = await as(cashier)("POST", "/api/reservations/staff", { at: at7, partySize: 2, name: "Walk-in Kapoor", phone: "9000000000", force: true });
  ok(r.status === 201 && r.json.reservation.status === "confirmed" && r.json.reservation.source === "staff", "…but can take it anyway when they choose to (confirmed at once)", `${r.status}`);
  r = await as(cashier)("GET", `/api/reservations?day=${tomorrow}`);
  ok(r.status === 200 && r.json.reservations.length === 3 && r.json.counts.guests === 12 && r.json.counts.requested === 2, "a cashier sees tomorrow's bookings: 3 bookings, 12 guests, 2 waiting", JSON.stringify(r.json.counts));
  ok((await as(kitchen)("GET", `/api/reservations?day=${tomorrow}`)).status === 403, "the kitchen doesn't see bookings");
  r = await as(cashier)("GET", "/api/reservations/summary");
  ok(r.json.pending === 2, "the sidebar count: 2 waiting to be confirmed", JSON.stringify(r.json));
  r = await as(cashier)("PATCH", `/api/reservations/${b1.id}`, { status: "seated" });
  ok(r.status === 409, "a booking can't be seated before it is confirmed", `${r.status}`);
  r = await as(cashier)("PATCH", `/api/reservations/${b1.id}`, { status: "confirmed" });
  ok(r.status === 200 && r.json.reservation.status === "confirmed", "the cashier confirms Asha's booking");
  r = await as(cashier)("PATCH", `/api/reservations/${b2.id}`, { status: "declined", reason: "We're closed for a private event" });
  ok(r.status === 200 && r.json.reservation.status === "declined", "…and declines Ravi's, with a reason");
  r = await call("GET", `/api/reservations/availability?outletId=${A.outlet}&day=${tomorrow}&party=2`);
  ok(r.json.slots.find((s) => s.at === schema.istDate(tomorrow, 20 * 60 + 30).toISOString())?.seatsLeft === 10, "a declined booking frees its seats");
  const table = (await must(own("POST", "/api/tables", { number: "7", seats: 4 }), "table")).json.table;
  r = await as(cashier)("PATCH", `/api/reservations/${b1.id}`, { status: "seated", tableId: idOf(table) });
  ok(r.status === 200 && r.json.reservation.status === "seated" && r.json.reservation.tableNumber === "7", "when they arrive they are seated at table 7", `${r.status} ${r.json.reservation?.tableNumber}`);
  r = await as(cashier)("PATCH", `/api/reservations/${b1.id}`, { status: "completed" });
  ok(r.status === 200, "…and the booking is completed when they leave");
}

/* ------------------------------------------------------------------ 3 */
say("3. the guest's own bookings");
{
  const book = (who, at, partySize) => call("POST", "/api/reservations", { cookie: who.cookie, body: { outletId: A.outlet, at, partySize } });
  const day2 = schema.shiftDay(schema.istDayKey(), 2);
  const mine = [];
  for (const h of [12, 13, 14]) {
    const r = await book(meera, schema.istDate(day2, h * 60).toISOString(), 2);
    mine.push(r.json.reservation);
  }
  let r = await book(meera, schema.istDate(day2, 15 * 60).toISOString(), 2);
  ok(r.status === 409 && /3 upcoming/.test(JSON.stringify(r.json)), "a guest can hold at most 3 upcoming bookings", `${r.status}`);
  r = await call("GET", `/api/reservations/mine?outletId=${A.outlet}`, { cookie: meera.cookie });
  ok(r.status === 200 && r.json.reservations.length === 3 && r.json.reservations.every((x) => x.canCancel && !("customer" in x) && !("staffNote" in x)), "Meera sees her 3 bookings, each cancellable — and none of the team's notes", `${r.json.reservations?.length}`);
  r = await call("POST", `/api/reservations/${mine[0].id}/cancel`, { cookie: meera.cookie, body: { outletId: A.outlet } });
  ok(r.status === 200 && r.json.reservation.status === "cancelled", "she cancels one");
  r = await call("POST", `/api/reservations/${mine[1].id}/cancel`, { cookie: asha.cookie, body: { outletId: A.outlet } });
  ok(r.status === 404, "nobody else can cancel her booking", `${r.status}`);
  await must(own("PATCH", `/api/outlets/${A.outlet}/config`, { reservations: { cancelUntilMinutes: 2880 } }), "cancel window 2 days");
  r = await call("POST", `/api/reservations/${mine[1].id}/cancel`, { cookie: meera.cookie, body: { outletId: A.outlet } });
  ok(r.status === 409 && /call the restaurant/.test(JSON.stringify(r.json)), "too close to the time, she is told to call instead", `${r.status}`);
  await must(own("PATCH", `/api/outlets/${A.outlet}/config`, { reservations: { autoConfirm: true, cancelUntilMinutes: 60 } }), "auto-confirm");
  r = await book(asha, schema.istDate(day2, 20 * 60).toISOString(), 2);
  ok(r.status === 201 && r.json.reservation.status === "confirmed", "with auto-confirm on, a booking is confirmed at once", `${r.json.reservation?.status}`);
  // the plan decides
  await must(call("PATCH", `/api/outlets/${B.outlet}/config`, { cookie: ownerB, headers: HB, body: { features: { reservations: { enabled: true } } } }), "B on");
  r = await call("GET", `/api/reservations/availability?outletId=${B.outlet}`);
  ok(r.json.enabled === false, "a store whose plan lacks Table reservations can't take bookings, even with the switch on");
  ok((await call("GET", "/api/reservations", { cookie: ownerB, headers: HB })).status === 403, "…and has no bookings page");
  r = await call("POST", "/api/reservations", { cookie: bela.cookie, body: { outletId: B.outlet, at: at7, partySize: 2 } });
  ok(r.status === 403, "…and a booking sent anyway is refused", `${r.status}`);
}

/* ------------------------------------------------------------------ 4 */
say("4. ratings — customers rate completed orders");
let done1, done2;
{
  done1 = await seed(A, asha, { lines: [pl(momos, 2), pl(chai, 1)], grand: 27000 });
  done2 = await seed(A, asha, { lines: [pl(roll, 1)] });
  const open = await seed(A, asha, { status: "preparing", lines: [pl(chai, 1)] });
  const old = await seed(A, asha, { lines: [pl(chai, 1)], ageDays: 40 });
  await must(own("PATCH", `/api/outlets/${A.outlet}/config`, { feedback: { enabled: true, googleReviewUrl: "https://g.page/r/acme/review", googleMinStars: 4 } }), "feedback config");
  let h = (await call("GET", `/api/customer/orders?outletId=${A.outlet}`, { cookie: asha.cookie })).json;
  const byId = (id) => h.orders.find((o) => o.id === id);
  ok(h.feedback?.enabled === true && h.feedback.googleReviewUrl === "https://g.page/r/acme/review", "the Account page knows the store takes ratings");
  ok(byId(done1).canRate === true && byId(open).canRate === false && byId(old).canRate === false, "a completed order can be rated; one still cooking, or older than 30 days, can't", JSON.stringify([byId(done1).canRate, byId(open).canRate, byId(old).canRate]));
  const rate = (who, id, body) => call("POST", `/api/customer/orders/${id}/feedback`, { cookie: who.cookie, body: { outletId: A.outlet, ...body } });
  let r = await rate(asha, open, { rating: 5 });
  ok(r.status === 409, "rating an order that isn't completed is refused", `${r.status}`);
  r = await rate(asha, old, { rating: 5 });
  ok(r.status === 409, "rating an order from more than 30 days ago is refused", `${r.status}`);
  r = await rate(ravi, done1, { rating: 1 });
  ok(r.status === 404, "nobody can rate someone else's order", `${r.status}`);
  r = await rate(asha, done1, { rating: 5, comment: "Best momos in town!", tags: ["Tasty", "Hot & fresh", "made-up tag"] });
  ok(r.status === 200 && r.json.google === "https://g.page/r/acme/review", "Asha gives 5 stars — and is offered the store's Google review page", `${r.status} ${r.json.google}`);
  r = await rate(asha, done2, { rating: 2, comment: "Roll was cold", tags: ["Cold"] });
  ok(r.status === 200 && r.json.google === null, "a 2-star rating is not sent to Google");
  h = (await call("GET", `/api/customer/orders?outletId=${A.outlet}`, { cookie: asha.cookie })).json;
  const f = byId(done1).feedback;
  ok(f?.rating === 5 && f.comment === "Best momos in town!" && f.tags.join() === "Tasty,Hot & fresh" && f.editable === true && byId(done1).canRate === false, "her order now shows her rating (made-up tags are dropped) and that she can still change it", JSON.stringify(f));
  r = await rate(asha, done2, { rating: 3, comment: "Roll was cold, but on time", tags: ["Cold", "On time"] });
  ok(r.status === 200 && (await raw("feedbacks").countDocuments({ orderId: done2 })) === 1, "rating again changes it (still one rating per order)");
  await raw("feedbacks").updateOne({ orderId: done2 }, { $set: { createdAt: new Date(Date.now() - 8 * 86_400_000) } });
  r = await rate(asha, done2, { rating: 1 });
  ok(r.status === 409 && /7 days/.test(JSON.stringify(r.json)), "…but not after a week", `${r.status}`);
  // the team's page
  r = await own("GET", "/api/feedback?days=30");
  ok(r.status === 200 && r.json.summary.count === 2 && r.json.summary.average === 4 && r.json.summary.byStars[5] === 1 && r.json.summary.byStars[3] === 1 && r.json.summary.withComments === 2, "the owner's Ratings page: 2 ratings, average 4.0, one 5★ and one 3★, both with comments", JSON.stringify(r.json.summary));
  ok(r.json.ratings[0].items.length > 0 && r.json.ratings.some((x) => x.customerName === "Asha Rao" && x.orderNumber), "each rating shows the customer, the order number and what was ordered");
  r = await own("GET", "/api/feedback?stars=1,2,3");
  ok(r.json.ratings.length === 1 && r.json.ratings[0].rating === 3, "it can show only the low ratings");
  ok((await as(cashier)("GET", "/api/feedback")).status === 403, "a cashier can't see ratings");
  ok((await as(accountant)("GET", "/api/feedback")).status === 200, "an accountant can");
  ok((await call("GET", "/api/feedback", { cookie: ownerB, headers: HB })).status === 403, "a store whose plan lacks Ratings has no ratings page");
  const bOrder = await seed(B, bela, { lines: [pl(chai, 1)] });
  r = await call("POST", `/api/customer/orders/${bOrder}/feedback`, { cookie: bela.cookie, body: { outletId: B.outlet, rating: 5 } });
  ok(r.status === 403, "…and its customers can't rate", `${r.status}`);
  ok((await call("GET", `/api/customer/orders?outletId=${B.outlet}`, { cookie: bela.cookie })).json.orders.every((o) => o.canRate === false), "…nor are they asked to");
}

/* ------------------------------------------------------------------ 5 */
say("5. order again");
{
  const fullId = momos.variants.find((v) => v.label === "Full").id;
  const cheese = extras.options.find((o) => o.label === "Cheese").id;
  const gone = await itm(food.id, "Seasonal Soup", { basePrice: 8000 });
  const past = await seed(A, asha, { lines: [
    pl(momos, 2, { variantId: fullId, variantLabel: "Full", modifiers: [{ id: cheese, label: "Cheese", priceDelta: 2000 }, { id: "old-option", label: "Old sauce", priceDelta: 500 }], note: "extra chutney" }),
    pl(chai, 3),
    pl(lassi, 1),
    pl(gone, 1),
  ] });
  await must(own("PATCH", `/api/menu/items/${lassi.id}`, { isAvailable: false }), "lassi off");
  await must(own("DELETE", `/api/menu/items/${gone.id}`), "soup gone");
  let r = await call("POST", `/api/customer/orders/${past}/reorder`, { cookie: asha.cookie, body: { outletId: A.outlet } });
  const L = r.json.lines ?? [];
  ok(r.status === 200 && r.json.outletSlug === "main", "Asha asks to order an old order again", `${r.status}`);
  ok(L.length === 2 && L[0].itemId === momos.id && L[0].variantId === fullId && L[0].quantity === 2 && L[0].modifierOptionIds.join() === cheese && L[0].note === "extra chutney", "the momos come back as they were: Full, 2 of them, with cheese and the kitchen note", JSON.stringify(L[0]));
  ok(L[1].itemId === chai.id && L[1].quantity === 3, "…and 3 chais");
  ok(r.json.skipped.map((s) => `${s.name}: ${s.reason}`).join(" | ") === "Sweet Lassi: sold out right now | Seasonal Soup: no longer on the menu", "the sold-out lassi and the soup that's gone are left out, with why", JSON.stringify(r.json.skipped));
  ok(r.json.notes.some((n) => /add-on/.test(n)), "an add-on that isn't offered any more is dropped, and said so");
  const q = await call("POST", "/api/orders/quote", { body: { outletId: A.outlet, cart: { lines: L }, channel: "takeaway" } });
  ok(q.status === 200 && q.json.totals.subtotal === 2 * 14000 + 3 * 3000, "those lines price at today's prices (₹120 + ₹20 cheese) × 2 + ₹30 × 3", `${q.json.totals?.subtotal}`);
  r = await call("POST", `/api/customer/orders/${past}/reorder`, { cookie: ravi.cookie, body: { outletId: A.outlet } });
  ok(r.status === 404, "nobody can re-order someone else's order", `${r.status}`);
  await must(own("PATCH", `/api/menu/items/${lassi.id}`, { isAvailable: true }), "lassi on");
}

/* ------------------------------------------------------------------ 6 */
say("6. 'goes well with your order'");
{
  // what customers order together (in the database before anything asks — the result is kept for 6 hours)
  for (let n = 0; n < 3; n++) await seed(A, ravi, { lines: [pl(roll, 1), pl(cola, 1)] });
  await must(own("PATCH", `/api/menu/items/${momos.id}`, { pairsWith: [chai.id, curry.id, lassi.id, momos.id, "000000000000000000000000"] }), "pairs");
  const saved = (await call("GET", `/api/menu?outletId=${A.outlet}`)).json.items.find((i) => i.id === momos.id).pairsWith;
  ok(saved.join() === [chai.id, curry.id, lassi.id].join(), "the owner picks what goes with momos (the dish itself and unknown dishes are dropped)", JSON.stringify(saved));
  const ask = (ids) => call("POST", "/api/menu/suggestions", { body: { outletId: A.outlet, itemIds: ids } });
  let r = await ask([momos.id]);
  ok(r.status === 200 && r.json.items.map((s) => s.itemId).join() === [chai.id, lassi.id].join(), "with momos in the cart: chai and lassi are suggested (the curry needs a spice choice, so it can't be one tap)", JSON.stringify(r.json.items.map((s) => s.itemId)));
  ok(r.json.title === "Goes well with your order", "under the outlet's title");
  r = await ask([momos.id, chai.id]);
  ok(!r.json.items.some((s) => s.itemId === chai.id), "nothing already in the cart is suggested");
  await must(own("PATCH", `/api/menu/items/${lassi.id}`, { isAvailable: false }), "lassi off");
  r = await ask([momos.id]);
  ok(!r.json.items.some((s) => s.itemId === lassi.id), "a sold-out dish isn't suggested");
  await must(own("PATCH", `/api/menu/items/${lassi.id}`, { isAvailable: true }), "lassi on");
  r = await ask([roll.id]);
  ok(r.json.items.some((s) => s.itemId === cola.id), "with no picks, what others often ordered with it is suggested (roll → cola, ordered together 3 times)", JSON.stringify(r.json.items));
  await must(own("PATCH", `/api/outlets/${A.outlet}/config`, { upsell: { enabled: false } }), "upsell off");
  r = await ask([momos.id]);
  ok(r.json.items.length === 0, "switched off, nothing is suggested");
  await must(own("PATCH", `/api/outlets/${A.outlet}/config`, { upsell: { enabled: true } }), "upsell on");
}

/* ------------------------------------------------------------------ 7 */
say("7. abandoned-cart reminders");
{
  const putCart = (who, lines, outletId = A.outlet) => call("PUT", "/api/customer/cart", { cookie: who.cookie, body: { outletId, lines } });
  let r = await putCart(asha, [line(chai, 2)]);
  ok(r.status === 200 && r.json.saved === false && (await raw("carts").countDocuments({})) === 0, "while reminders are off, no cart is kept at all");
  r = await own("GET", "/api/cart-reminders");
  ok(r.status === 200 && r.json.planAllows === true && r.json.settings.enabled === false && r.json.settings.delayMinutes === 30, "the store's settings: allowed by the plan, off, 30 minutes", JSON.stringify(r.json.settings));
  const settings = { enabled: true, delayMinutes: 30, sendFrom: "00:00", sendUntil: "23:59", minDaysBetween: 3, channel: "sms", message: "Hi {{name}}, {{items}} ({{total}}) is waiting at {{store}}: {{link}}" };
  ok((await as(cashier)("PUT", "/api/cart-reminders", settings)).status === 403, "a cashier can't change them");
  ok((await as(manager)("PUT", "/api/cart-reminders", { ...settings, sendFrom: "21:00", sendUntil: "10:00" })).status === 400, "sending hours that end before they start are refused");
  r = await as(manager)("PUT", "/api/cart-reminders", settings);
  ok(r.status === 200 && r.json.settings.enabled === true, "a manager switches them on for the store", `${r.status}`);
  ok((await call("PUT", "/api/cart-reminders", { cookie: ownerB, headers: HB, body: settings })).status === 403, "a store whose plan lacks them can't switch them on");
  r = await putCart(bela, [line(chai, 1)], B.outlet);
  ok(r.json.saved === false, "…and keeps no carts");
  await must(own("PUT", "/api/notify/config/sms", { values: { requestUrl: `http://127.0.0.1:${SMS_PORT}/sms?key={{apiKey}}&to={{to}}&msg={{message}}`, apiKey: "K9" } }), "sms gateway");

  r = await putCart(asha, [line(momos, 2, { variantId: momos.variants[0].id }), line(chai, 1)]);
  const cart = await raw("carts").findOne({ customerId: asha.id });
  ok(r.json.saved === true && cart?.itemCount === 3 && cart.value === 2 * 7000 + 3000 && cart.status === "open", "now Asha's cart is kept: 3 items worth ₹170", JSON.stringify({ n: cart?.itemCount, v: cart?.value }));
  ok((await carts.remindTick()) === 0 && sms.length === 0, "nothing is sent while the cart is fresh");
  await raw("carts").updateOne({ _id: cart._id }, { $set: { touchedAt: new Date(Date.now() - 40 * 60_000) } });
  const sent = await carts.remindTick();
  const msg = sms.at(-1)?.searchParams.get("msg") ?? "";
  ok(sent === 1 && sms.length === 1 && sms[0].searchParams.get("to")?.endsWith("9811700001"), "40 minutes later ONE reminder goes to Asha's number", `${sent} ${sms.length}`);
  ok(/^Hi Asha, 2× Veg Momos, 1× Masala Chai \(₹170\) is waiting at Acme: http/.test(msg) && msg.includes(`/main/order?cart=${cart._id}`), "it says what she left, what it's worth, the store, and links straight to her cart", msg);
  ok((await carts.remindTick()) === 0 && sms.length === 1, "it is never sent twice");
  const c2 = await raw("carts").findOne({ _id: cart._id });
  ok(c2.status === "reminded" && c2.remindChannel === "sms" && c2.remindError === "", "the cart is marked reminded (by SMS)");
  r = await call("GET", `/api/customer/cart/${cart._id}?outletId=${A.outlet}`);
  ok(r.status === 200 && r.json.lines.length === 2 && !JSON.stringify(r.json).includes("9811700001") && !JSON.stringify(r.json).includes("Asha"), "the link's cart can be opened on another phone — dishes only, nothing personal", JSON.stringify(r.json).slice(0, 120));
  const placed = await call("POST", "/api/orders", { cookie: asha.cookie, body: { outletId: A.outlet, cart: { lines: [line(chai, 1)] }, channel: "takeaway" } });
  await new Promise((res) => setTimeout(res, 300));
  const c3 = await raw("carts").findOne({ _id: cart._id });
  ok(placed.status === 201 && c3.status === "recovered" && c3.recoveredValue === placed.json.order.totals.grandTotal, "she orders after the reminder → counted as won back, with the order's value", `${c3.status} ${c3.recoveredValue}`);
  // the next cart, within the gap
  await putCart(asha, [line(roll, 1)]);
  await raw("carts").updateOne({ customerId: asha.id }, { $set: { touchedAt: new Date(Date.now() - 40 * 60_000) } });
  ok((await carts.remindTick()) === 0 && sms.length === 1, "a new forgotten cart within 3 days of her last reminder is NOT reminded about");
  ok((await raw("carts").findOne({ customerId: asha.id })).remindError.startsWith("skipped"), "…it is marked skipped");
  // outside the sending hours, and too old
  await putCart(ravi, [line(cola, 2)]);
  await raw("carts").updateOne({ customerId: ravi.id }, { $set: { touchedAt: new Date(Date.now() - 40 * 60_000) } });
  const m = schema.istParts().minutes;
  const closedHours = { ...settings, sendFrom: schema.toHHMM((m + 60) % 1380), sendUntil: schema.toHHMM(((m + 60) % 1380) + 30) };
  await must(as(manager)("PUT", "/api/cart-reminders", closedHours), "hours shut");
  ok((await carts.remindTick()) === 0, "outside the sending hours nothing goes out");
  await must(as(manager)("PUT", "/api/cart-reminders", settings), "hours open");
  await raw("carts").updateOne({ customerId: ravi.id }, { $set: { touchedAt: new Date(Date.now() - 30 * 3_600_000) } });
  ok((await carts.remindTick()) === 0, "a cart left more than a day ago is never reminded about");
  await raw("carts").updateOne({ customerId: ravi.id }, { $set: { touchedAt: new Date(Date.now() - 50 * 60_000) } });
  ok((await carts.remindTick()) === 1 && sms.length === 2 && /Hi Ravi/.test(sms[1].searchParams.get("msg")), "another customer's 50-minute-old cart is reminded about");
  r = await own("GET", "/api/cart-reminders");
  ok(r.json.stats.sent === 2 && r.json.stats.recovered === 1 && r.json.stats.recoveredValue === placed.json.order.totals.grandTotal && r.json.stats.recent.length === 2 && r.json.stats.recent.some((x) => x.status === "recovered"), "the settings page shows: 2 sent, 1 won back (with its value) and the recent ones", JSON.stringify({ s: r.json.stats.sent, rec: r.json.stats.recovered, v: r.json.stats.recoveredValue, n: r.json.stats.recent.length }));
  ok(r.json.stats.recent.every((x) => !x.phone || /x{6}/.test(x.phone)), "…with phone numbers partly hidden");
  r = await putCart(ravi, []);
  ok((await raw("carts").countDocuments({ customerId: ravi.id })) === 0, "an emptied cart is removed");
  await must(own("PUT", "/api/cart-reminders", { ...settings, enabled: false }), "off");
  await putCart(meera, [line(chai, 1)]);
  ok((await raw("carts").countDocuments({ customerId: meera.id })) === 0, "switched off again, carts are no longer kept");
}

console.log(`\n${pass} passed, ${fail} failed`);
await new Promise((r) => gateway.close(r));
await server.close();
await db.mongoose.disconnect();
await mongod.stop();
process.exit(fail ? 1 : 0);
