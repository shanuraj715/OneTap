// Table bookings with a start AND an end, a price and a 50% advance — the rules (shared package), the booking API, the advance paid through the test
// gateway, the seat hold while it is unpaid, refunds, the WhatsApp number and the message the guest gets. A private API on an in-memory database,
// with a fake SMS gateway on this machine (the guest's updates go to "the WhatsApp number" — here the SMS fallback, so they can be read). No browser.
import http from "node:http";
import { startApi } from "./_api-harness.mjs";

const t = await startApi(3124);
const { call, ok, say } = t;
const S = await import(`${t.REPO}/packages/config-schema/src/index.js`);
const reservations = await import(`${t.API}/src/modules/reservations/reservations.service.js`);

const SMS_PORT = 3125;
const sms = [];
const gateway = http.createServer((rq, rs) => { sms.push(new URL(rq.url, "http://x")); rs.end("OK"); });
await new Promise((r) => gateway.listen(SMS_PORT, r));
const lastSms = () => ({ to: sms.at(-1)?.searchParams.get("to") ?? "", msg: sms.at(-1)?.searchParams.get("msg") ?? "" });
const waitSms = async (n) => { for (let i = 0; i < 40 && sms.length < n; i++) await new Promise((r) => setTimeout(r, 100)); return sms.length >= n; };
/** the newest message whose text matches `rx` ({ to, msg }, or null) — waits for it: updates go out a moment after the action, and not always in the order they were made */
const smsLike = async (rx) => {
  const find = () => [...sms].reverse().map((u) => ({ to: u.searchParams.get("to") ?? "", msg: u.searchParams.get("msg") ?? "" })).find((m) => rx.test(m.msg)) ?? null;
  for (let i = 0; i < 40 && !find(); i++) await new Promise((r) => setTimeout(r, 100));
  return find();
};

const tomorrow = S.shiftDay(S.istDayKey(), 1);
const slot = (h, m = 0, day = tomorrow) => S.istDate(day, h * 60 + m).toISOString();

await t.run(async () => {
  /* ---------------------------------------------------------------------------------------------------------------- 1 */
  say("1. The rules (the shared package)");
  const st = S.reservationSettingsSchema.parse({ pricePerPersonHour: 50000, slotMinutes: 30 });
  ok(st.minDurationMinutes === 60 && st.maxDurationMinutes === 240 && st.durationMinutes === 90 && st.pricePerPersonHour === 50000, "the new settings and their starting values: stay 1 hr to 4 hrs, usual 90 min, price set by the outlet");
  ok(S.reservationSettingsSchema.parse({}).pricePerPersonHour === 0, "a booking costs nothing until the outlet sets a price (so no outlet is suddenly charging)");
  ok(JSON.stringify(S.reservationDurations(st)) === JSON.stringify({ step: 30, min: 60, max: 240, usual: 90 }), "durations: shortest 60, longest 240, usual 90, in 30-minute steps");
  const odd = S.reservationDurations(S.reservationSettingsSchema.parse({ slotMinutes: 60, minDurationMinutes: 45, maxDurationMinutes: 200, durationMinutes: 100 }));
  ok(odd.min === 60 && odd.max === 180 && odd.usual === 120, "odd settings are rounded to whole steps (45 → 60, 200 → 180, 100 → 120 with 60-minute steps)", JSON.stringify(odd));
  const m4 = S.bookingAmount(st, 4, 150);
  ok(m4.amountPaise === 500000 && m4.prepayPaise === 250000 && m4.remainingPaise === 250000, "4 guests for 2½ hours at ₹500 each an hour = ₹5,000: ₹2,500 now, ₹2,500 at the restaurant", JSON.stringify(m4));
  const m3 = S.bookingAmount(st, 3, 90);
  ok(m3.amountPaise === 225000 && m3.prepayPaise + m3.remainingPaise === m3.amountPaise && m3.prepayPaise % 100 === 0, "the amount and its halves are whole rupees and always add up (₹2,250 → ₹1,125 + ₹1,125)", JSON.stringify(m3));
  const odd2 = S.bookingAmount(S.reservationSettingsSchema.parse({ pricePerPersonHour: 33300 }), 1, 60);
  ok(odd2.amountPaise === 33300 && odd2.prepayPaise + odd2.remainingPaise === 33300, "an odd amount (₹333) still splits into two whole-rupee parts", JSON.stringify(odd2));
  ok(S.bookingAmount(S.reservationSettingsSchema.parse({}), 4, 120).amountPaise === 0 && S.bookingAmount(S.reservationSettingsSchema.parse({}), 4, 120).prepayPaise === 0, "rate 0: nothing to pay");
  ok(S.PREPAY_PERCENT === 50, "the advance is 50%");
  ok(["98765 43210", "+91 98765-43210", "09876543210", "9876543210"].every((x) => S.whatsappNumber(x) === "9876543210") && ["12345", "5876543210", "", null, "98765432101234"].every((x) => S.whatsappNumber(x) === null), "a WhatsApp number: any way of writing a 10-digit Indian mobile is understood; short, long or not-a-mobile ones are refused");
  ok(S.formatDuration(45) === "45 min" && S.formatDuration(60) === "1 hr" && S.formatDuration(150) === "2 hrs 30 min" && S.formatDuration(120) === "2 hrs", "durations are said in words (45 min, 1 hr, 2 hrs 30 min)");
  ok(/7:00 PM – 9:30 PM/.test(S.formatRange(slot(19), slot(21, 30))), "a booking's time is said as a range (7:00 PM – 9:30 PM)", S.formatRange(slot(19), slot(21, 30)));
  ok(S.BOOKING_EVENTS.length >= 12 && S.BOOKING_EVENTS.includes("Birthday") && !S.BOOKING_EVENTS.includes("Other") && S.BOOKING_EVENT_OTHER === "Other", "the event list has the usual occasions; 'Other' is separate (the page adds it at the end)");
  const bks = [{ at: slot(18), endsAt: slot(19, 30), partySize: 6 }, { at: slot(19, 30), endsAt: slot(21), partySize: 6 }];
  ok(S.peakGuests(bks, new Date(slot(18)).getTime(), new Date(slot(21)).getTime()) === 6, "two bookings of 6 that follow each other are never more than 6 at once (the old way counted 12)");
  ok(S.peakGuests([...bks, { at: slot(19), endsAt: slot(20), partySize: 3 }], new Date(slot(18)).getTime(), new Date(slot(21)).getTime()) === 9, "…but one that overlaps them both makes 9");
  const cfg = { operations: { hours: { opensAt: "11:00", closesAt: "23:00" } } };
  const ends = S.reservationEnds(cfg, st, tomorrow, slot(21, 30), { partySize: 2 });
  ok(ends.length === 2 && ends[0].label === "10:30 PM" && ends.at(-1).label === "11:00 PM" && ends.at(-1).minutes === 90, "from 9:30 PM the finish times stop at closing (10:30 PM, 11:00 PM… never later)", ends.map((e) => e.label).join(","));
  ok(ends[0].amountPaise === 100000 && ends[0].prepayPaise === 50000 && ends[0].remainingPaise === 50000, "each finish time carries its price (1 hour for 2 guests at ₹500 each = ₹1,000: ₹500 now, ₹500 there)", JSON.stringify(ends[0]).slice(0, 140));

  /* ---------------------------------------------------------------------------------------------------------------- 2 */
  say("2. A store, its settings, three guests");
  const s = await t.makeStore({ slug: "acme", ownerEmail: "o@acme.test" });
  const H = { "x-rasoipulse-outlet": s.outlet, "x-rasoipulse-brand": s.brand };
  const own = (method, path, body) => call(method, path, { cookie: s.owner, headers: H, body });
  const patch = (body) => own("PATCH", `/api/outlets/${s.outlet}/config`, body);
  const mkUser = async (email, role) => { await own("POST", "/api/users", { email, name: role, password: "Password123!", role }); return t.cookieLogin(email, "Password123!"); };
  const cashier = await mkUser("c@acme.test", "staff");
  const manager = await mkUser("m@acme.test", "manager");
  const asTeam = (cookie) => (method, path, body) => call(method, path, { cookie, headers: H, body });
  const r0 = await patch({
    operations: { hours: { enabled: true, opensAt: "11:00", closesAt: "23:00" } },
    features: { reservations: { enabled: true } },
    payments: { enabled: ["cod", "mock"] },
    reservations: { slotMinutes: 30, durationMinutes: 90, minDurationMinutes: 60, maxDurationMinutes: 240, pricePerPersonHour: 50000, maxGuestsPerSlot: 10, minNoticeMinutes: 60, maxDaysAhead: 7, maxPartySize: 12, autoConfirm: false, cancelUntilMinutes: 60 },
  });
  ok(r0.status === 200, "the outlet takes bookings: ₹500 per person per hour, 1 to 4 hour stays, 10 seats, the test gateway on", String(r0.status));
  ok(r0.json.config.reservations.pricePerPersonHour === 50000 && r0.json.config.reservations.minDurationMinutes === 60, "the new settings are saved");
  await own("PUT", "/api/notify/config/sms", { values: { requestUrl: `http://127.0.0.1:${SMS_PORT}/sms?to={{to}}&msg={{message}}&k={{apiKey}}`, apiKey: "K9" } });

  const signUp = async (phone, name) => {
    const r = await call("POST", "/api/customer/otp/request", { body: { outletId: s.outlet, destination: phone, name } });
    const v = await fetch(`${t.base}/api/customer/otp/verify`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ outletId: s.outlet, destination: phone, code: r.json.devCode, name, gender: "female", age: 30 }) });
    return { cookie: v.headers.get("set-cookie")?.split(";")[0], id: (await v.json()).customer.id, name, phone };
  };
  const asha = await signUp("9811700001", "Asha Rao");
  const ravi = await signUp("9811700002", "Ravi Kumar");
  const meera = await signUp("9811700004", "Meera Iyer");
  const avail = (q = "") => call("GET", `/api/reservations/availability?outletId=${s.outlet}&day=${tomorrow}${q}`);
  const book = (who, body) => call("POST", "/api/reservations", { cookie: who?.cookie, body: { outletId: s.outlet, partySize: 2, ...body } });
  const teamDay = async (cookie = s.owner) => (await call("GET", `/api/reservations?day=${tomorrow}`, { cookie, headers: H })).json;
  const mine = async (who) => (await call("GET", `/api/reservations/mine?outletId=${s.outlet}`, { cookie: who.cookie })).json.reservations;
  const pay = async (who, reservationId) => {
    const i = await call("POST", "/api/payments/intent", { cookie: who.cookie, body: { outletId: s.outlet, reservationId } });
    if (i.status !== 200) return { intent: i };
    const cp = i.json.clientParams;
    const v = await call("POST", "/api/payments/verify", { cookie: who.cookie, body: { outletId: s.outlet, paymentId: i.json.paymentId, payload: { payment_id: String(cp.payment_id), signature: String(cp.signature) } } });
    return { intent: i, verify: v };
  };

  /* ---------------------------------------------------------------------------------------------------------------- 3 */
  say("3. What the booking page is told");
  let r = await avail("&party=2");
  ok(r.status === 200 && r.json.enabled && r.json.pricing.ratePaise === 50000 && r.json.pricing.prepayPercent === 50 && r.json.pricing.prepayAvailable === true && r.json.pricing.gateway === "mock", "the price, 50%, and that an advance can be paid online (the test gateway) come with the times", JSON.stringify(r.json.pricing));
  ok(r.json.settings.minDurationMinutes === 60 && r.json.settings.maxDurationMinutes === 240 && r.json.settings.stepMinutes === 30 && r.json.settings.durationMinutes === 90, "…and how long a stay can be");
  ok(r.json.slots.length > 10 && r.json.ends.length === 0 && r.json.start === null, "with no start chosen there are start times and no finish times");
  const at7 = slot(19);
  r = await avail(`&party=2&start=${encodeURIComponent(at7)}`);
  ok(r.json.start === at7 && r.json.ends.length === 7 && r.json.ends[0].label === "8:00 PM" && r.json.ends[0].minutes === 60 && r.json.ends.at(-1).label === "11:00 PM" && r.json.ends.at(-1).minutes === 240, "choosing 7 PM gives the finish times 8:00 PM … 11:00 PM (1 to 4 hours)", r.json.ends.map((e) => e.label).join(","));
  const e2h = r.json.ends.find((e) => e.minutes === 120);
  ok(e2h.amountPaise === 200000 && e2h.prepayPaise === 100000 && e2h.remainingPaise === 100000 && e2h.available, "7 to 9 PM for 2 guests: ₹2,000, pay ₹1,000 now and ₹1,000 there", JSON.stringify(e2h).slice(0, 140));
  r = await avail(`&party=4&start=${encodeURIComponent(at7)}`);
  ok(r.json.ends.find((e) => e.minutes === 120).amountPaise === 400000, "for 4 guests the same stay is ₹4,000 (the price follows the party)");
  r = await avail(`&party=2&start=${encodeURIComponent(slot(22, 30))}`);
  ok(r.json.ends.length === 0 && r.json.start === null, "a start the restaurant doesn't offer (10:30 PM is after the last start) has no finish times", `${r.json.ends.length}`);
  r = await avail(`&party=2&start=${encodeURIComponent(slot(22))}`);
  ok(r.json.start === slot(22) && r.json.ends.length === 1 && r.json.ends[0].label === "11:00 PM", "the last start (10 PM) has one finish time: closing, 11 PM");
  r = await avail(`&party=2&start=nonsense`);
  ok(r.status === 200 && r.json.ends.length === 0 && r.json.start === null, "a start that isn't a time is ignored, not an error");

  /* ---------------------------------------------------------------------------------------------------------------- 4 */
  say("4. Booking: the rules a guest meets");
  const base = { at: at7, endsAt: slot(21) };
  r = await book(null, base);
  ok(r.status === 401, "booking needs the guest to be signed in", String(r.status));
  r = await book(asha, { ...base, endsAt: slot(18) });
  ok(r.status === 400 && /finish time after the start/i.test(JSON.stringify(r.json)), "a finish time before the start is refused, in words");
  r = await book(asha, { at: at7, endsAt: slot(19, 30) });
  ok(r.status === 409 && /at least 1 hr/.test(JSON.stringify(r.json)), "30 minutes is shorter than the shortest stay: 'at least 1 hr'", JSON.stringify(r.json).slice(0, 120));
  r = await book(asha, { at: at7, endsAt: slot(23, 30) });
  ok(r.status === 409 && /at most 4 hrs/.test(JSON.stringify(r.json)), "4½ hours is longer than the longest stay: 'at most 4 hrs'", JSON.stringify(r.json).slice(0, 120));
  r = await book(asha, { at: at7, endsAt: slot(21, 10) });
  ok(r.status === 409 && /30-minute mark/.test(JSON.stringify(r.json)), "a finish time that is not on the half hour is refused", JSON.stringify(r.json).slice(0, 120));
  r = await book(asha, { at: slot(22), endsAt: S.istDate(S.shiftDay(tomorrow, 1), 0).toISOString() });
  ok(r.status === 409 && /after closing/.test(JSON.stringify(r.json)), "a booking that runs past closing is refused: 'after closing'", JSON.stringify(r.json).slice(0, 120));
  r = await book(asha, { ...base, whatsapp: "12345" });
  ok(r.status === 400 && /10-digit WhatsApp/.test(JSON.stringify(r.json)), "a WhatsApp number that isn't 10 digits is refused: 'Enter a 10-digit WhatsApp number'", JSON.stringify(r.json).slice(0, 120));
  r = await book(asha, { ...base, event: "x".repeat(61) });
  ok(r.status === 400, "an event name longer than 60 characters is refused");
  r = await book(asha, { ...base, partySize: 13 });
  ok(r.status === 400 || r.status === 409, "a party over the online limit is refused", String(r.status));
  ok((await t.raw("reservations").countDocuments({ brandId: s.brand })) === 0, "none of the refused requests left a booking behind");

  /* ---------------------------------------------------------------------------------------------------------------- 5 */
  say("5. A booking that costs money waits for its advance");
  r = await book(asha, { ...base, whatsapp: "+91 98765-43210", event: "Birthday", note: "Window seat" });
  const b1 = r.json.reservation;
  ok(r.status === 201 && b1.status === "requested" && b1.payment.status === "pending", "Asha books 7 to 9 PM for 2: it is created and waits for the advance", `${r.status} ${b1?.status}/${b1?.payment?.status}`);
  ok(b1.pricing.amountPaise === 200000 && b1.pricing.prepayPaise === 100000 && b1.pricing.remainingPaise === 100000 && b1.minutes === 120, "₹2,000 for 2 hours: ₹1,000 now, ₹1,000 at the restaurant", JSON.stringify(b1.pricing));
  ok(b1.event === "Birthday", "the occasion is kept");
  const raw1 = await t.raw("reservations").findOne({ code: b1.code });
  ok(raw1.customer.whatsapp === "9876543210" && raw1.customer.phone === "9811700001", "the WhatsApp number is stored cleaned up (9876543210), apart from the number she signed in with");
  ok((await teamDay()).reservations.length === 0 && (await call("GET", "/api/reservations/summary", { cookie: s.owner, headers: H })).json.pending === 0, "the team doesn't see it yet, and the 'to confirm' badge doesn't count it");
  ok(sms.length === 0, "and nobody is messaged yet");
  const m1 = await mine(asha);
  ok(m1.length === 1 && m1[0].canPay === true && m1[0].payment.status === "pending", "Asha sees it on her account with a 'pay now' (canPay)");

  say("5b. Its seats are held — for a few minutes");
  await patch({ reservations: { maxGuestsPerSlot: 4 } });
  r = await avail("&party=3");
  ok(r.json.slots.find((x) => x.at === at7).available === false && r.json.slots.find((x) => x.at === at7).seatsLeft === 2, "while the advance is awaited, its 2 seats count: only 2 of 4 are left at 7 PM", JSON.stringify(r.json.slots.find((x) => x.at === at7)));
  await t.raw("reservations").updateOne({ code: b1.code }, { $set: { createdAt: new Date(Date.now() - 20 * 60_000) } });
  r = await avail("&party=3");
  ok(r.json.slots.find((x) => x.at === at7).available === true, "after 15 minutes without payment the hold is over: the seats are free again");
  ok((await mine(asha)).length === 0, "…and it no longer shows on her account");
  const stale = await call("POST", "/api/payments/intent", { cookie: asha.cookie, body: { outletId: s.outlet, reservationId: b1.id } });
  ok(stale.status === 409 && /expired/.test(JSON.stringify(stale.json)), "paying for it now says it has expired ('please book again')", JSON.stringify(stale.json).slice(0, 120));
  const released = await reservations.sweepUnpaidBookings();
  const swept = await t.raw("reservations").findOne({ code: b1.code });
  ok(released === 1 && swept.status === "cancelled" && swept.payment.status === "expired", "the sweep lets go of it (cancelled, 'expired': 'The advance wasn't paid in time')", `${released} ${swept.status}/${swept.payment.status}`);
  ok((await reservations.sweepUnpaidBookings()) === 0, "…and running the sweep again does nothing more");
  await patch({ reservations: { maxGuestsPerSlot: 10 } });

  /* ---------------------------------------------------------------------------------------------------------------- 6 */
  say("6. Paying the advance (the test gateway)");
  r = await book(asha, { ...base, whatsapp: "98765 43210", event: "Anniversary" });
  const b2 = r.json.reservation;
  const noAuth = await call("POST", "/api/payments/intent", { body: { outletId: s.outlet, reservationId: b2.id } });
  ok(noAuth.status === 401, "starting the payment needs a signed-in guest", String(noAuth.status));
  const other = await call("POST", "/api/payments/intent", { cookie: ravi.cookie, body: { outletId: s.outlet, reservationId: b2.id } });
  ok(other.status === 403, "another guest can't pay for Asha's booking (403)", String(other.status));
  const both = await call("POST", "/api/payments/intent", { cookie: asha.cookie, body: { outletId: s.outlet, orderId: "a".repeat(24), reservationId: b2.id } });
  ok(both.status === 400, "an intent for an order AND a booking at once is refused (400)");
  const neither = await call("POST", "/api/payments/intent", { cookie: asha.cookie, body: { outletId: s.outlet } });
  ok(neither.status === 400, "…and one for neither is refused too");
  const intent = await call("POST", "/api/payments/intent", { cookie: asha.cookie, body: { outletId: s.outlet, reservationId: b2.id } });
  ok(intent.status === 200 && intent.json.gateway === "mock" && intent.json.clientParams.amount === 100000, "her own: the gateway is asked for ₹1,000 — the advance, not the whole amount", `${intent.status} ${intent.json.clientParams?.amount}`);
  const payment = await t.raw("payments").findOne({ orderId: b2.id });
  ok(payment.subject === "reservation" && payment.amount === 100000 && payment.status === "pending", "the payment record says it is for a booking: ₹1,000, pending");
  const cp = intent.json.clientParams;
  const verifyOther = await call("POST", "/api/payments/verify", { cookie: ravi.cookie, body: { outletId: s.outlet, paymentId: intent.json.paymentId, payload: { payment_id: String(cp.payment_id), signature: String(cp.signature) } } });
  ok(verifyOther.status === 403 && (await t.raw("payments").findOne({ orderId: b2.id })).status === "pending", "another guest can't confirm it either — and it is NOT settled by the attempt (the owner is checked before anything is verified)", String(verifyOther.status));
  const bad = await call("POST", "/api/payments/verify", { cookie: asha.cookie, body: { outletId: s.outlet, paymentId: intent.json.paymentId, payload: { payment_id: String(cp.payment_id), signature: "wrong" } } });
  ok(bad.status === 400 && (await t.raw("reservations").findOne({ code: b2.code })).payment.status === "pending", "a payment with a wrong signature is refused and the booking stays unpaid");
  const good = await call("POST", "/api/payments/verify", { cookie: asha.cookie, body: { outletId: s.outlet, paymentId: intent.json.paymentId, payload: { payment_id: String(cp.payment_id), signature: String(cp.signature) } } });
  ok(good.status === 200 && good.json.status === "paid" && good.json.subject === "reservation", "her real payment is accepted", `${good.status} ${JSON.stringify(good.json)}`);
  const paid = await t.raw("reservations").findOne({ code: b2.code });
  ok(paid.payment.status === "paid" && paid.status === "requested" && paid.payment.paidAt, "the booking is now paid and waits for the restaurant (still 'requested': a person approves it)");
  const day = await teamDay();
  ok(day.reservations.length === 1 && day.reservations[0].payment.status === "paid" && day.reservations[0].pricing.prepayPaise === 100000 && day.reservations[0].event === "Anniversary" && day.reservations[0].customer.whatsapp === "9876543210", "now the team sees it: ₹1,000 paid, the event and the WhatsApp number", JSON.stringify(day.reservations[0]).slice(0, 200));
  ok((await call("GET", "/api/reservations/summary", { cookie: s.owner, headers: H })).json.pending === 1, "the 'to confirm' badge counts it");
  const gotB2 = await smsLike(/request B-0002 /);
  ok(gotB2 && gotB2.to.endsWith("9876543210") && !gotB2.to.endsWith("9811700001"), "Asha is told on the WHATSAPP number she gave (…43210), not the one she signed in with", gotB2?.to);
  ok(/received your table request/.test(gotB2?.msg) && /Anniversary/.test(gotB2?.msg) && /advance of ₹1,000 is paid/.test(gotB2?.msg) && /confirm it here on WhatsApp/.test(gotB2?.msg), "the message says it was received, what for, that ₹1,000 is paid and that the restaurant will confirm on WhatsApp", gotB2?.msg.slice(0, 220));
  const again = await call("POST", "/api/payments/verify", { cookie: asha.cookie, body: { outletId: s.outlet, paymentId: intent.json.paymentId, payload: { payment_id: String(cp.payment_id), signature: String(cp.signature) } } });
  ok(again.status === 200 && sms.length === 1 && (await t.raw("reservations").countDocuments({ code: b2.code })) === 1, "confirming it a second time changes nothing and sends no second message");
  const mine2 = (await mine(asha))[0];
  ok(mine2.payment.status === "paid" && mine2.canPay === false && mine2.pricing.remainingPaise === 100000, "on her account: paid, nothing more to pay online, ₹1,000 left for the restaurant");

  /* ---------------------------------------------------------------------------------------------------------------- 7 */
  say("7. The restaurant decides — and refunds");
  const team = asTeam(cashier);
  r = await team("PATCH", `/api/reservations/${b2.id}`, { refunded: true });
  ok(r.status === 409 && /no refund/i.test(JSON.stringify(r.json)), "'refunded' is refused while no refund is due", String(r.status));
  r = await team("PATCH", `/api/reservations/${b2.id}`, { status: "declined", reason: "We're closed for a private event" });
  ok(r.status === 200 && r.json.reservation.status === "declined" && r.json.reservation.payment.status === "refund_due", "declining a paid booking marks its advance as DUE for a refund");
  const gotNo = await smsLike(/can't take your booking B-0002/);
  ok(gotNo && /advance of ₹1,000 will be refunded/.test(gotNo.msg) && gotNo.to.endsWith("9876543210"), "the guest is told, on WhatsApp, that the advance will be refunded", gotNo?.msg.slice(0, 220));
  r = await team("PATCH", `/api/reservations/${b2.id}`, { refunded: true });
  ok(r.status === 200 && r.json.reservation.payment.status === "refunded", "once the money is sent back, 'mark refunded' closes it");
  const hist = (await t.raw("reservations").findOne({ code: b2.code })).history.map((h) => h.reason ?? "").join(" | ");
  ok(/Advance of ₹1,000 paid/.test(hist) && /refunded/.test(hist), "the booking's history shows the payment and the refund", hist.slice(0, 200));
  r = await team("PATCH", `/api/reservations/${b2.id}`, { refunded: true });
  ok(r.status === 409, "…and it can't be marked twice");

  say("7b. A guest cancels");
  r = await book(ravi, { at: slot(20), endsAt: slot(22), whatsapp: "9811700002", event: "Date night" });
  const b3 = r.json.reservation;
  r = await call("POST", `/api/reservations/${b3.id}/cancel`, { cookie: ravi.cookie, body: { outletId: s.outlet } });
  ok(r.status === 200 && (await t.raw("reservations").findOne({ code: b3.code })).payment.status === "expired", "cancelling a booking whose advance was never paid just drops it (nothing to refund)");
  ok(!(await teamDay()).reservations.some((x) => x.code === b3.code) && !(await teamDay()).reservations.some((x) => x.code === b1.code), "…and neither it nor the one that expired ever shows up to the team as a cancelled booking");
  r = await book(ravi, { at: slot(20), endsAt: slot(22), whatsapp: "9811700002", event: "Date night" });
  const b4 = r.json.reservation;
  await pay(ravi, b4.id);
  r = await call("POST", `/api/reservations/${b4.id}/cancel`, { cookie: ravi.cookie, body: { outletId: s.outlet } });
  ok(r.status === 200 && (await t.raw("reservations").findOne({ code: b4.code })).payment.status === "refund_due", "cancelling a PAID booking puts the advance on the refund list");
  ok((await team("GET", `/api/reservations?day=${tomorrow}`)).json.reservations.some((x) => x.code === b4.code && x.payment.status === "refund_due"), "the team sees the refund that is due");

  say("7c. Confirming, and a no-show keeps the advance");
  r = await book(meera, { at: slot(18), endsAt: slot(20), whatsapp: "9811700004", event: "Birthday" });
  const b5 = r.json.reservation;
  const n0 = sms.length;
  await pay(meera, b5.id);
  await smsLike(/received your table request B-0005/); // (the "we've received your request" message goes out a moment after the payment)
  r = await team("PATCH", `/api/reservations/${b5.id}`, { status: "confirmed" });
  ok(r.status === 200 && r.json.reservation.payment.status === "paid", "the team confirms Meera's paid booking");
  const gotOk = await smsLike(/B-0005\. You paid/);
  ok(gotOk && /is confirmed for/.test(gotOk.msg) && /paid ₹1,000 in advance; the remaining ₹1,000 is paid at the restaurant/.test(gotOk.msg) && /food and drinks are paid for separately/.test(gotOk.msg), "the message says it is confirmed, that ₹1,000 was paid, ₹1,000 is payable at the restaurant — and that food and drinks are paid for separately", gotOk?.msg.slice(0, 260));
  r = await team("PATCH", `/api/reservations/${b5.id}`, { status: "no_show" });
  ok(r.status === 200 && r.json.reservation.payment.status === "paid", "a no-show keeps the advance (nothing to refund)");

  /* ---------------------------------------------------------------------------------------------------------------- 8 */
  say("8. A guest signed in with one number, updates on another; the usual length; no charge");
  await patch({ reservations: { pricePerPersonHour: 0 } });
  r = await book(asha, { at: slot(13), partySize: 2 });
  const free = r.json.reservation;
  ok(r.status === 201 && free.payment.status === "none" && free.pricing.amountPaise === 0 && free.minutes === 90, "with no price, a booking without a finish time takes the usual 90 minutes and needs no payment", `${r.status} ${free.minutes}`);
  ok((await teamDay()).reservations.some((x) => x.code === free.code), "…and goes straight to the team");
  const waitFor = sms.length;
  const rw = await t.raw("reservations").findOne({ code: free.code });
  ok(rw.customer.whatsapp === "" && rw.customer.phone === "9811700001", "no WhatsApp number given: only the sign-in number is on it");
  await team("PATCH", `/api/reservations/${free.id}`, { status: "confirmed" });
  const gotFree = await smsLike(new RegExp(`booking ${free.code}|Booking ${free.code}`));
  ok(gotFree && gotFree.to.endsWith("9811700001"), "…so the update goes to the number she signed in with", gotFree?.to);
  r = await book(asha, { at: slot(15), endsAt: slot(16, 30), whatsapp: "9811700001" });
  ok(r.status === 201 && r.json.reservation.minutes === 90 && r.json.reservation.payment.status === "none", "a free booking with a finish time works too (90 minutes)");

  say("8b. A price but no way to pay online: nothing is taken in advance");
  await patch({ reservations: { pricePerPersonHour: 50000 }, payments: { enabled: ["cod"] } });
  r = await avail("&party=2");
  ok(r.json.pricing.ratePaise === 50000 && r.json.pricing.prepayAvailable === false && r.json.pricing.gateway === null, "with only cash on, the page is told no advance can be taken");
  r = await book(meera, { at: slot(12), endsAt: slot(14), whatsapp: "9811700004" });
  const nogw = r.json.reservation;
  ok(r.status === 201 && nogw.payment.status === "none" && nogw.pricing.amountPaise === 200000 && nogw.pricing.prepayPaise === 0 && nogw.pricing.remainingPaise === 200000, "the booking is taken without an advance: the whole ₹2,000 is paid at the restaurant", JSON.stringify(nogw.pricing));
  ok((await teamDay()).reservations.some((x) => x.code === nogw.code), "and it goes straight to the team");
  await patch({ payments: { enabled: ["cod", "mock"] } });

  /* ---------------------------------------------------------------------------------------------------------------- 9 */
  say("9. The outlet confirms by itself");
  await patch({ reservations: { autoConfirm: true } });
  r = await book(asha, { at: slot(16), endsAt: slot(18), whatsapp: "9811700001", event: "Kitty party" });
  const auto = r.json.reservation;
  ok(r.status === 201 && auto.status === "requested" && auto.payment.status === "pending", "it waits for the advance first (not confirmed before it is paid)");
  const n = sms.length;
  await pay(asha, auto.id);
  ok((await t.raw("reservations").findOne({ code: auto.code })).status === "confirmed", "paid → confirmed straight away");
  const gotAuto = await smsLike(new RegExp(`Booking ${auto.code}\\.`));
  ok(gotAuto && /is confirmed for/.test(gotAuto.msg), "…and the confirmation goes to the guest");
  await patch({ reservations: { autoConfirm: false } });

  /* ---------------------------------------------------------------------------------------------------------------- 10 */
  say("10. An advance that arrives after the booking was let go");
  r = await book(ravi, { at: slot(14), endsAt: slot(16), whatsapp: "9811700002", event: "Business meeting" });
  const late = r.json.reservation;
  const lateIntent = await call("POST", "/api/payments/intent", { cookie: ravi.cookie, body: { outletId: s.outlet, reservationId: late.id } });
  await t.raw("reservations").updateOne({ code: late.code }, { $set: { createdAt: new Date(Date.now() - 20 * 60_000) } });
  await reservations.sweepUnpaidBookings();
  const lcp = lateIntent.json.clientParams;
  const lateVerify = await call("POST", "/api/payments/verify", { cookie: ravi.cookie, body: { outletId: s.outlet, paymentId: lateIntent.json.paymentId, payload: { payment_id: String(lcp.payment_id), signature: String(lcp.signature) } } });
  const lateDoc = await t.raw("reservations").findOne({ code: late.code });
  ok(lateVerify.status === 200 && lateDoc.status === "cancelled" && lateDoc.payment.status === "refund_due", "money that arrives after the hold ran out is not lost: the booking stays cancelled and the advance is marked due for a refund", `${lateVerify.status} ${lateDoc.status}/${lateDoc.payment.status}`);
  ok(!(await teamDay()).reservations.some((x) => x.code === late.code && x.status === "requested"), "and it is not put in front of the team as a live request");

  /* ---------------------------------------------------------------------------------------------------------------- 11 */
  say("11. Orders are untouched");
  const order = await call("POST", "/api/payments/intent", { cookie: asha.cookie, body: { outletId: s.outlet, orderId: "b".repeat(24) } });
  ok(order.status === 403 || order.status === 404, "an intent for an order that isn't hers still goes through the order rules", String(order.status));
});
