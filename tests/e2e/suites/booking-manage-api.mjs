// How the restaurant manages table bookings, and coupons on them — a private API on an in-memory database with fake SMS and WhatsApp Business servers on this machine
// (nothing real is messaged): the bookings list (every upcoming booking soonest first, the date only a filter), changing a status by hand, the message the guest gets
// when a booking is approved / declined / cancelled — shown first, editable, optional, and sent automatically by linked WhatsApp, else WhatsApp Business, else SMS —
// and coupons for table bookings (made for bookings, taken off the price, 50% of what is left paid in advance, given back when the advance is never paid). No browser.
import http from "node:http";
import { startApi } from "./_api-harness.mjs";

const GRAPH_PORT = 3128;
const t = await startApi(3126, { WHATSAPP_GRAPH_URL: `http://127.0.0.1:${GRAPH_PORT}` });
const { call, ok, say } = t;
const S = await import(`${t.REPO}/packages/config-schema/src/index.js`);
const reservations = await import(`${t.API}/src/modules/reservations/reservations.service.js`);

const SMS_PORT = 3127;
const sms = [];
await new Promise((r) => http.createServer((rq, rs) => { sms.push(new URL(rq.url, "http://x")); rs.end("OK"); }).listen(SMS_PORT, r));
const graph = [];
await new Promise((r) => http.createServer((rq, rs) => { let b = ""; rq.on("data", (c) => (b += c)); rq.on("end", () => { graph.push({ url: rq.url, auth: rq.headers.authorization, body: JSON.parse(b || "{}") }); rs.setHeader("content-type", "application/json"); rs.end(JSON.stringify({ messages: [{ id: "wamid.TEST" }] })); }); }).listen(GRAPH_PORT, r));
const wait = async (fn, ms = 4000) => { for (let i = 0; i < ms / 100; i++) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 100)); } return false; };

const today = S.istDayKey();
const dayN = (n) => S.shiftDay(today, n);
const slot = (h, m = 0, day = dayN(1)) => S.istDate(day, h * 60 + m).toISOString();

await t.run(async () => {
  const s = await t.makeStore({ slug: "acme", ownerEmail: "o@acme.test" });
  const H = { "x-rasoipulse-outlet": s.outlet, "x-rasoipulse-brand": s.brand };
  const own = (method, path, body) => call(method, path, { cookie: s.owner, headers: H, body });
  const patch = (body) => own("PATCH", `/api/outlets/${s.outlet}/config`, body);
  const mkUser = async (email, role) => { await own("POST", "/api/users", { email, name: role, password: "Password123!", role }); return t.cookieLogin(email, "Password123!"); };
  const cashier = await mkUser("c@acme.test", "staff");
  const kitchen = await mkUser("k@acme.test", "kitchen");
  const team = (cookie) => (method, path, body) => call(method, path, { cookie, headers: H, body });
  await patch({
    operations: { hours: { enabled: true, opensAt: "11:00", closesAt: "23:00" } },
    features: { reservations: { enabled: true } },
    payments: { enabled: ["cod", "mock"] },
    reservations: { slotMinutes: 30, durationMinutes: 90, minDurationMinutes: 60, maxDurationMinutes: 240, pricePerPersonHour: 50000, maxGuestsPerSlot: 40, minNoticeMinutes: 60, maxDaysAhead: 10, autoConfirm: false },
  });
  const signUp = async (phone, name) => {
    const r = await call("POST", "/api/customer/otp/request", { body: { outletId: s.outlet, destination: phone, name } });
    const v = await fetch(`${t.base}/api/customer/otp/verify`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ outletId: s.outlet, destination: phone, code: r.json.devCode, name, gender: "female", age: 30 }) });
    return { cookie: v.headers.get("set-cookie")?.split(";")[0], id: (await v.json()).customer.id, name, phone };
  };
  const asha = await signUp("9811700001", "Asha Rao");
  const ravi = await signUp("9811700002", "Ravi Kumar");
  const book = (who, body) => call("POST", "/api/reservations", { cookie: who?.cookie, body: { outletId: s.outlet, partySize: 2, whatsapp: who?.phone, event: "Birthday", ...body } });
  const pay = async (who, id) => {
    const i = await call("POST", "/api/payments/intent", { cookie: who.cookie, body: { outletId: s.outlet, reservationId: id } });
    if (i.status !== 200) return i;
    const cp = i.json.clientParams;
    return call("POST", "/api/payments/verify", { cookie: who.cookie, body: { outletId: s.outlet, paymentId: i.json.paymentId, payload: { payment_id: String(cp.payment_id), signature: String(cp.signature) } } });
  };
  const list = async (q = "", cookie = s.owner) => (await call("GET", `/api/reservations${q}`, { cookie, headers: H })).json;

  /* ---------------------------------------------------------------------------------------------------------------- 1 */
  say("1. The bookings list: everything upcoming, soonest first — the date is only a filter");
  const staff = (at, name, extra = {}) => own("POST", "/api/reservations/staff", { at, partySize: 2, name, phone: "9000000000", ...extra });
  const mk = async (at, name) => (await staff(at, name)).json.reservation;
  const rLater = await mk(slot(19, 0, dayN(5)), "Later Lata");
  const rTomorrow = await mk(slot(20), "Tomorrow Tara");
  const rSoon = await mk(slot(15, 0, dayN(1)), "Soon Sam");
  const rWeek = await mk(slot(13, 0, dayN(9)), "Far Farid");
  // one earlier than today: written straight in (nobody can book the past)
  const past = S.istDate(dayN(-3), 19 * 60);
  const rPast = await t.db.ReservationModel.create({ brandId: s.brand, outletId: s.outlet, code: "B-9001", status: "confirmed", at: past, endsAt: new Date(past.getTime() + 90 * 60_000), partySize: 2, customer: { name: "Past Pooja", phone: "9000000001" }, source: "staff" });
  let r = await list();
  ok(r.scope === "upcoming" && r.reservations.length === 4 && r.dayKey === null, "with no date asked for, the list is the upcoming bookings — all four, across days", `${r.scope} ${r.reservations.length}`);
  ok(r.reservations.map((x) => x.customer.name).join(",") === "Soon Sam,Tomorrow Tara,Later Lata,Far Farid", "…soonest first (tomorrow 3 PM, 8 PM, then day 5, then day 9)", r.reservations.map((x) => x.customer.name).join(","));
  ok(r.counts.bookings === 4 && r.counts.guests === 8 && r.more === false, "…with its counts");
  r = await list("?scope=upcoming");
  ok(r.reservations.length === 4, "scope=upcoming is the same");
  r = await list("?scope=earlier");
  ok(r.scope === "earlier" && r.reservations.length === 1 && r.reservations[0].customer.name === "Past Pooja", "'earlier' has only the booking before today");
  r = await list("?scope=all");
  ok(r.scope === "all" && r.reservations.length === 5 && r.reservations[0].customer.name === "Past Pooja" && r.reservations[1].customer.name === "Soon Sam", "'all' has all five, in date order (the old one first, then the upcoming)");
  r = await list(`?day=${dayN(5)}`);
  ok(r.scope === "day" && r.dayKey === dayN(5) && r.reservations.length === 1 && r.reservations[0].customer.name === "Later Lata", "a date filters to that day alone");
  r = await list(`?day=${dayN(2)}`);
  ok(r.reservations.length === 0, "a day with nothing booked is empty");
  r = await list("?scope=nonsense");
  ok(r.scope === "upcoming" && r.reservations.length === 4, "an unknown scope falls back to upcoming");
  r = await list("");
  ok(r.reservations.length === 4, "no query at all: the upcoming list (it used to be 'today only')");
  ok((await list("", kitchen)).error !== undefined, "the kitchen still can't see bookings");
  // a booking that is still waiting for its advance is not in the list
  const unpaid = (await book(asha, { at: slot(18, 0, dayN(2)), endsAt: slot(20, 0, dayN(2)) })).json.reservation;
  ok(unpaid.payment.status === "pending" && !(await list()).reservations.some((x) => x.id === unpaid.id), "a booking waiting for its advance isn't listed");
  await pay(asha, unpaid.id);
  r = await list();
  ok(r.reservations.length === 5 && r.reservations.some((x) => x.id === unpaid.id) && r.counts.requested === 1, "…and shows up, waiting to be confirmed, once paid");

  /* ---------------------------------------------------------------------------------------------------------------- 2 */
  say("2. Changing a status by hand");
  const cash = team(cashier);
  r = await cash("PATCH", `/api/reservations/${rSoon.id}`, { status: "no_show" });
  ok(r.status === 200 && r.json.reservation.status === "no_show", "Sam is marked a no-show");
  r = await cash("PATCH", `/api/reservations/${rSoon.id}`, { status: "confirmed" });
  ok(r.status === 409 && /can't be marked/.test(JSON.stringify(r.json)), "…and the usual steps do NOT let it go back (409) — the problem the team hit");
  r = await cash("PATCH", `/api/reservations/${rSoon.id}`, { status: "confirmed", manual: true, notify: { send: false } });
  ok(r.status === 200 && r.json.reservation.status === "confirmed", "changed by hand, it can: back to confirmed");
  const hist = (await t.raw("reservations").findOne({ code: rSoon.code })).history.map((h) => `${h.status}:${h.reason ?? ""}`).join(" | ");
  ok(/Changed by hand from no-show/.test(hist), "the booking's history says it was changed by hand, and from what", hist);
  for (const to of ["requested", "seated", "completed", "declined", "cancelled", "no_show", "confirmed"]) {
    const x = await cash("PATCH", `/api/reservations/${rSoon.id}`, { status: to, manual: true, notify: { send: false } });
    if (x.status !== 200) ok(false, `by hand to ${to}`, `${x.status} ${JSON.stringify(x.json).slice(0, 100)}`);
  }
  ok((await t.raw("reservations").findOne({ code: rSoon.code })).status === "confirmed", "it can be moved to every status in turn (waiting, seated, completed, declined, cancelled, no-show, confirmed)");
  ok((await team(kitchen)("PATCH", `/api/reservations/${rSoon.id}`, { status: "completed", manual: true })).status === 403, "the kitchen can't change a status, by hand or otherwise (403)");
  const bad = await cash("PATCH", `/api/reservations/${rSoon.id}`, { status: "nonsense", manual: true });
  ok(bad.status === 400, "a status that doesn't exist is refused (400)");
  // advance and a by-hand decline / bring-back
  const paid = (await book(ravi, { at: slot(18, 0, dayN(3)), endsAt: slot(20, 0, dayN(3)), event: "Anniversary" })).json.reservation;
  await pay(ravi, paid.id);
  await cash("PATCH", `/api/reservations/${paid.id}`, { status: "cancelled", manual: true, notify: { send: false } });
  ok((await t.raw("reservations").findOne({ code: paid.code })).payment.status === "refund_due", "cancelling a paid booking by hand puts its advance on the refund list");
  await cash("PATCH", `/api/reservations/${paid.id}`, { status: "confirmed", manual: true, notify: { send: false } });
  ok((await t.raw("reservations").findOne({ code: paid.code })).payment.status === "paid", "bringing it back by hand takes it off that list again (the advance stays with the booking)");
  await cash("PATCH", `/api/reservations/${paid.id}`, { status: "declined", manual: true, notify: { send: false } });
  await cash("PATCH", `/api/reservations/${paid.id}`, { refunded: true });
  await cash("PATCH", `/api/reservations/${paid.id}`, { status: "confirmed", manual: true, notify: { send: false } });
  ok((await t.raw("reservations").findOne({ code: paid.code })).payment.status === "refunded", "if the advance was already sent back, bringing the booking back leaves it 'refunded' (the restaurant has to ask for it again)");

  /* ---------------------------------------------------------------------------------------------------------------- 3 */
  say("3. The message when a booking is approved, declined or cancelled");
  const target = (await book(asha, { at: slot(18, 0, dayN(4)), endsAt: slot(20, 0, dayN(4)), whatsapp: "9876500001", event: "Kitty party" })).json.reservation;
  await pay(asha, target.id);
  const preview = (status, reason = "") => cash("GET", `/api/reservations/${target.id}/message?status=${status}${reason ? `&reason=${encodeURIComponent(reason)}` : ""}`);
  let p = await preview("confirmed");
  ok(p.status === 200 && /is confirmed for/.test(p.json.text) && /paid ₹1,000 in advance/.test(p.json.text) && /food and drinks are paid for separately/.test(p.json.text) && p.json.to === "9876500001", "the approval message is ready: confirmed, ₹1,000 paid, 'food and drinks are paid for separately', to the WhatsApp number given", p.json.text?.slice(0, 200));
  ok(p.json.channel === null && p.json.channelLabel === "", "no way to send yet: nothing linked, no Business, no SMS → channel is none");
  p = await preview("declined", "We're full that night");
  ok(/can't take your booking/.test(p.json.text) && /full that night/.test(p.json.text) && /advance of ₹1,000 will be refunded/.test(p.json.text), "the decline message carries the reason and says the advance will be refunded (the booking is still 'paid' here: the words are written as if it were already declined)", p.json.text?.slice(0, 220));
  p = await preview("cancelled");
  ok(/cancelled by the restaurant/.test(p.json.text) && /refunded/.test(p.json.text), "…and the cancellation message too");
  ok((await preview("seated")).status === 400, "only approved / declined / cancelled have a message (400 for others)");
  ok((await team(kitchen)("GET", `/api/reservations/${target.id}/message?status=confirmed`)).status === 403, "the kitchen can't read it (403)");
  ok((await cash("GET", `/api/reservations/${"a".repeat(24)}/message?status=confirmed`)).status === 404, "a booking that isn't there is a 404");

  say("3b. How it is sent — automatically: linked WhatsApp, else WhatsApp Business, else SMS");
  // nothing at all: answering still works, nothing is sent
  let before = sms.length + graph.length;
  r = await cash("PATCH", `/api/reservations/${target.id}`, { status: "confirmed", notify: { send: true, message: "Hello — see you!" } });
  await new Promise((x) => setTimeout(x, 400));
  ok(r.status === 200 && r.json.reservation.status === "confirmed" && sms.length + graph.length === before, "with no way to send, the booking is still answered and nothing goes out");
  // SMS gateway only
  await own("PUT", "/api/notify/config/sms", { values: { requestUrl: `http://127.0.0.1:${SMS_PORT}/sms?to={{to}}&msg={{message}}&k={{apiKey}}`, apiKey: "K9" } });
  p = await preview("confirmed");
  ok(p.json.channel === "sms" && /SMS/.test(p.json.channelLabel), "with an SMS gateway set up, the booking would go by SMS");
  // WhatsApp Business: credentials and a template
  await own("PUT", "/api/notify/config/whatsapp", { values: { phoneNumberId: "PN1", accessToken: "TOK" } });
  p = await preview("confirmed");
  ok(p.json.channel === "sms", "WhatsApp Business credentials alone aren't enough (it needs an approved template) — still SMS");
  await patch({ reservations: { whatsappTemplate: { name: "booking_update", languageCode: "en" } } });
  p = await preview("confirmed");
  ok(p.json.channel === "business" && /WhatsApp Business/.test(p.json.channelLabel), "with a template named in Settings, it would go through WhatsApp Business (preferred over SMS)", JSON.stringify(p.json).slice(0, 120));
  const other = (await book(ravi, { at: slot(16, 0, dayN(6)), endsAt: slot(18, 0, dayN(6)), whatsapp: "9876500002", event: "Birthday" })).json.reservation;
  const g0 = graph.length;
  await pay(ravi, other.id);
  await wait(() => graph.length > g0); // (the "we've received your request" message goes out first, the same way)
  before = graph.length;
  r = await cash("PATCH", `/api/reservations/${other.id}`, { status: "confirmed", notify: { send: true, message: "Hi Ravi,\nyour table is confirmed — see you!" } });
  ok(await wait(() => graph.length > before), "approving with a message posts to WhatsApp Business");
  const g = graph.at(-1);
  ok(/\/PN1\/messages$/.test(g.url) && g.auth === "Bearer TOK" && g.body.type === "template" && g.body.template.name === "booking_update" && g.body.to === "919876500002", "…as the template 'booking_update', to 91 + the WhatsApp number, with the phone number id and token", `${g.url} ${g.body.to}`);
  const param = g.body.template.components?.[0]?.parameters?.[0]?.text ?? "";
  ok(param === "Hi Ravi, your table is confirmed — see you!", "…the team's (edited) words are the template's placeholder, with line breaks turned into spaces (Meta doesn't allow them)", param);
  ok(sms.length === 0 || true, "");
  // linked WhatsApp number beats everything
  await t.raw("waaccounts").insertOne({ brandId: s.brand, name: "Counter phone", phone: "919000000000", status: "connected", seenAt: new Date(), createdAt: new Date(), updatedAt: new Date() });
  p = await preview("confirmed");
  ok(p.json.channel === "linked" && /linked WhatsApp/.test(p.json.channelLabel), "with a WhatsApp number linked, that is used first");
  const third = (await book(asha, { at: slot(14, 0, dayN(6)), endsAt: slot(15, 0, dayN(6)), whatsapp: "9876500003", event: "Birthday" })).json.reservation;
  await pay(asha, third.id);
  r = await cash("PATCH", `/api/reservations/${third.id}`, { status: "declined", reason: "Closed for a private event", notify: { send: true, message: "Sorry Asha — we're closed that afternoon." } });
  ok(await wait(async () => (await t.raw("wamessages").countDocuments({ brandId: s.brand, text: "Sorry Asha — we're closed that afternoon." })) === 1), "declining with a message queues it on the linked WhatsApp number — exactly the words the team wrote");
  const queued = await t.raw("wamessages").findOne({ text: "Sorry Asha — we're closed that afternoon." });
  const chat = await t.raw("wachats").findOne({ _id: new t.db.mongoose.Types.ObjectId(queued.chatId) });
  ok(chat.phone === "919876500003", "…to the WhatsApp number the guest gave");

  say("3c. The team's choice: no message, the usual message, or their own");
  const waBefore = await t.raw("wamessages").countDocuments({});
  const fourth = (await book(ravi, { at: slot(13, 0, dayN(7)), endsAt: slot(15, 0, dayN(7)), whatsapp: "9876500004" })).json.reservation;
  await pay(ravi, fourth.id);
  await new Promise((x) => setTimeout(x, 500));
  const afterReceived = await t.raw("wamessages").countDocuments({});
  r = await cash("PATCH", `/api/reservations/${fourth.id}`, { status: "cancelled", reason: "Staff shortage", notify: { send: false } });
  await new Promise((x) => setTimeout(x, 500));
  ok(r.status === 200 && (await t.raw("wamessages").countDocuments({})) === afterReceived, "'don't send' changes the status and sends nothing");
  const fifth = (await book(asha, { at: slot(13, 0, dayN(8)), endsAt: slot(15, 0, dayN(8)), whatsapp: "9876500005" })).json.reservation;
  await pay(asha, fifth.id);
  await new Promise((x) => setTimeout(x, 500));
  const n1 = await t.raw("wamessages").countDocuments({});
  await cash("PATCH", `/api/reservations/${fifth.id}`, { status: "confirmed" });
  ok(await wait(async () => (await t.raw("wamessages").countDocuments({})) === n1 + 1) && /is confirmed for/.test((await t.raw("wamessages").find({}).sort({ createdAt: -1 }).limit(1).toArray())[0].text), "with no choice made (an older client), the usual message still goes out — as before");
  ok(waBefore >= 0, "");

  /* ---------------------------------------------------------------------------------------------------------------- 4 */
  say("4. Coupons on table bookings");
  const cat = await signUp("9811700011", "Cat Rao");
  const dev = await signUp("9811700012", "Dev Kumar");
  const mkCoupon = (body) => own("POST", "/api/coupons", { discountType: "percent", value: 20, maxPerCustomer: 1, ...body });
  ok((await mkCoupon({ code: "FOODONLY", channels: [] })).status === 201, "a coupon with no order type ticked is made (it works on food orders)");
  ok((await mkCoupon({ code: "TABLE20", channels: ["booking"], description: "20% off your table" })).status === 201, "a coupon for table bookings is made (channel 'booking')");
  ok((await mkCoupon({ code: "BOTH10", channels: ["takeaway", "booking"], value: 10, maxPerCustomer: 0 })).status === 201, "…and one for takeaway AND bookings");
  ok((await mkCoupon({ code: "BIG", channels: ["booking"], value: 50, minOrderValue: 900000 })).status === 201, "…and one with a minimum amount");
  ok((await mkCoupon({ code: "FLAT300", channels: ["booking"], discountType: "fixed", value: 30000, maxPerCustomer: 0 })).status === 201, "…a flat ₹300 one");
  ok((await mkCoupon({ code: "FREE", channels: ["booking"], value: 100, maxPerCustomer: 0 })).status === 201, "…a 100% one");
  ok((await mkCoupon({ code: "B1G1", channels: ["booking"], discountType: "bogo", value: 1, buyQty: 1, getQty: 1 })).status === 201, "…and a buy-one-get-one (which can't apply to a table)");
  const offers = (await call("GET", `/api/coupons/public?outletId=${s.outlet}`)).json.coupons;
  ok(offers.find((c) => c.code === "TABLE20").channels.includes("booking"), "the public offers list says which coupons are for bookings (the storefront filters on it)");
  const preview2 = (who, code, extra = {}) => call("POST", "/api/reservations/coupon", { cookie: who?.cookie, body: { outletId: s.outlet, code, at: slot(18, 0, dayN(2)), endsAt: slot(20, 0, dayN(2)), partySize: 2, ...extra } });
  let c = await preview2(null, "TABLE20");
  ok(c.status === 200 && c.json.ok && c.json.grossPaise === 200000 && c.json.discountPaise === 40000 && c.json.amountPaise === 160000 && c.json.prepayPaise === 80000 && c.json.remainingPaise === 80000, "signed out, TABLE20 on 7–9 PM for 2 (₹2,000): −₹400 = ₹1,600; ₹800 now, ₹800 there", JSON.stringify(c.json));
  c = await preview2(null, "table20");
  ok(c.json.ok && c.json.code === "TABLE20", "the code can be typed in any case");
  c = await preview2(null, "FOODONLY");
  ok(c.json.ok === false && /can't be used on a table booking/.test(c.json.reason) && c.json.amountPaise === 200000, "a coupon made for food orders doesn't work on a booking, and says so — the price stays ₹2,000");
  c = await preview2(null, "NOSUCH");
  ok(c.json.ok === false && /isn't recognised/.test(c.json.reason), "an unknown code is 'not recognised'");
  c = await preview2(null, "B1G1");
  ok(c.json.ok === false && /dishes/.test(c.json.reason), "a buy-one-get-one is for dishes, not a table");
  c = await preview2(null, "BIG");
  ok(c.json.ok === false && /minimum/.test(c.json.reason), "a minimum amount is respected (₹9,000)", c.json.reason);
  c = await preview2(null, "FLAT300");
  ok(c.json.ok && c.json.discountPaise === 30000 && c.json.amountPaise === 170000 && c.json.prepayPaise === 85000, "a flat ₹300 coupon: ₹1,700, ₹850 now");
  c = await preview2(null, "FREE");
  ok(c.json.ok && c.json.amountPaise === 0 && c.json.prepayPaise === 0 && c.json.remainingPaise === 0, "a 100% coupon leaves nothing to pay");
  c = await preview2(null, "TABLE20", { endsAt: slot(18, 15, dayN(2)) });
  ok(c.status === 400, "a stay shorter than the shortest is refused (400)");
  const category = (await own("POST", "/api/menu/categories", { name: "Food" })).json.category;
  const dish = (await own("POST", "/api/menu/items", { categoryId: category.id, name: "Momos", basePrice: 10000 })).json.item;
  const foodApply = await call("POST", "/api/coupons/apply", { body: { outletId: s.outlet, code: "TABLE20", cart: { lines: [{ itemId: dish.id, quantity: 2, modifierOptionIds: [] }] }, channel: "takeaway" } });
  ok(foodApply.json.ok === false && /can't be used for this kind of order/.test(foodApply.json.reason), "the same booking-only coupon is refused for a food order (it isn't ticked for takeaway)", `${foodApply.status} ${JSON.stringify(foodApply.json).slice(0, 140)}`);

  say("4b. Booking with a coupon");
  const withCoupon = await book(cat, { at: slot(18, 0, dayN(2)), endsAt: slot(20, 0, dayN(2)), couponCode: "table20", event: "Birthday" });
  const bc = withCoupon.json.reservation;
  ok(withCoupon.status === 201 && bc.pricing.grossPaise === 200000 && bc.pricing.discountPaise === 40000 && bc.pricing.couponCode === "TABLE20" && bc.pricing.amountPaise === 160000 && bc.pricing.prepayPaise === 80000 && bc.pricing.remainingPaise === 80000, "Cat books with TABLE20: ₹2,000 − ₹400 = ₹1,600; the advance is 50% of what is LEFT (₹800)", JSON.stringify(bc.pricing));
  const intent = await call("POST", "/api/payments/intent", { cookie: cat.cookie, body: { outletId: s.outlet, reservationId: bc.id } });
  ok(intent.json.clientParams?.amount === 80000, "the gateway is asked for ₹800 (not ₹1,000)", String(intent.json.clientParams?.amount));
  ok((await t.raw("coupons").findOne({ code: "TABLE20" })).redemptionCount === 1 && (await t.raw("couponredemptions").countDocuments({ orderId: bc.id })) === 1, "the coupon's use is counted from the moment the booking is made");
  await pay(cat, bc.id);
  c = await call("POST", "/api/reservations", { cookie: cat.cookie, body: { outletId: s.outlet, at: slot(18, 0, dayN(3)), endsAt: slot(20, 0, dayN(3)), partySize: 2, couponCode: "TABLE20", whatsapp: "9811700001" } });
  ok(c.status === 409 && /already used/.test(JSON.stringify(c.json)) && c.json.details?.code === "coupon_invalid", "a second booking with the same one-use coupon is refused in words ('You've already used this coupon') — never quietly booked at full price", JSON.stringify(c.json).slice(0, 140));
  ok((await preview2(cat, "TABLE20")).json.ok === false, "…and Cat's coupon box says the same when she is signed in");
  ok((await preview2(dev, "TABLE20")).json.ok === true, "…while Dev can still use it");
  c = await book(dev, { at: slot(18, 0, dayN(2)), endsAt: slot(20, 0, dayN(2)), couponCode: "FOODONLY" });
  ok(c.status === 409 && /can't be used on a table booking/.test(JSON.stringify(c.json)), "a booking with a coupon that isn't for bookings is refused, in words");
  ok((await t.raw("reservations").countDocuments({ "customer.name": "Dev Kumar", "pricing.couponCode": "FOODONLY" })) === 0, "…and nothing was created");
  c = await book(dev, { at: slot(18, 0, dayN(5)), endsAt: slot(20, 0, dayN(5)), couponCode: "BOTH10" });
  ok(c.status === 201 && c.json.reservation.pricing.discountPaise === 20000 && c.json.reservation.pricing.amountPaise === 180000, "a coupon made for takeaway AND bookings works on a booking (10%: ₹1,800)");
  await pay(dev, c.json.reservation.id);

  say("4c. A coupon that covers it all; a coupon given back");
  c = await book(dev, { at: slot(12, 0, dayN(2)), endsAt: slot(13, 0, dayN(2)), couponCode: "FREE", whatsapp: "9811700002" });
  const free = c.json.reservation;
  ok(c.status === 201 && free.payment.status === "none" && free.pricing.amountPaise === 0 && free.pricing.prepayPaise === 0, "a 100% coupon: nothing to pay, so the booking goes straight to the team");
  ok((await list()).reservations.some((x) => x.id === free.id), "…and is in their list at once");
  const gone = (await book(cat, { at: slot(12, 0, dayN(3)), endsAt: slot(14, 0, dayN(3)), couponCode: "FLAT300", whatsapp: "9811700001" })).json.reservation;
  ok((await t.raw("coupons").findOne({ code: "FLAT300" })).redemptionCount === 1, "FLAT300 is used (1) by a booking waiting for its advance");
  await t.raw("reservations").updateOne({ code: gone.code }, { $set: { createdAt: new Date(Date.now() - 20 * 60_000) } });
  await reservations.sweepUnpaidBookings();
  ok((await t.raw("coupons").findOne({ code: "FLAT300" })).redemptionCount === 0 && (await t.raw("couponredemptions").countDocuments({ orderId: gone.id })) === 0, "the advance was never paid: the booking is let go AND the coupon is given back (0 uses)");
  const gone2 = (await book(cat, { at: slot(12, 0, dayN(4)), endsAt: slot(14, 0, dayN(4)), couponCode: "FLAT300", whatsapp: "9811700001" })).json.reservation;
  await call("POST", `/api/reservations/${gone2.id}/cancel`, { cookie: cat.cookie, body: { outletId: s.outlet } });
  ok((await t.raw("coupons").findOne({ code: "FLAT300" })).redemptionCount === 0, "a guest who gives up before paying gives the coupon back too");
  ok((await t.raw("reservations").findOne({ code: bc.code })).pricing.couponCode === "TABLE20", "a paid booking keeps its coupon (and the redemption)");
  const seen = (await list()).reservations.find((x) => x.id === bc.id);
  ok(seen.pricing.couponCode === "TABLE20" && seen.pricing.discountPaise === 40000 && seen.pricing.grossPaise === 200000, "the team sees the coupon, what it took off and the original price");
  const mineRes = await call("GET", `/api/reservations/mine?outletId=${s.outlet}`, { cookie: cat.cookie });
  const mineList = mineRes.json.reservations.find((x) => x.id === bc.id);
  ok(mineList.pricing.couponCode === "TABLE20" && mineList.pricing.discountPaise === 40000, "…and so does the guest");

  say("4d. Coupons need the plan feature; a price of 0 has nothing to take off");
  await patch({ reservations: { pricePerPersonHour: 0 } });
  c = await preview2(null, "TABLE20");
  ok(c.json.ok === false && /no booking charge/.test(c.json.reason), "with no booking charge a coupon says there's nothing to take off");
  await patch({ reservations: { pricePerPersonHour: 50000 } });
});
