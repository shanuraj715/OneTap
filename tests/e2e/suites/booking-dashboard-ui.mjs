// The restaurant's side of table bookings, in Chrome against the bench dashboard (Acme Momos, Main, as the owner):
//  - Settings: the stay, the price per person per hour, the WhatsApp Business template for booking updates;
//  - the Bookings page: EVERY upcoming booking in one list, soonest first, grouped by day — no changing the date to find them; "Earlier" and "All"; the date is only a
//    filter, chosen with OUR date picker (never the browser's own date box — anywhere on these screens);
//  - "Status": any booking's status can be changed by hand (a no-show marked by mistake isn't stuck);
//  - approving, declining or cancelling opens a window: a reason, the message the guest would get (editable), how it will be sent (automatically: linked WhatsApp →
//    WhatsApp Business → SMS) and whether to send it at all;
//  - what each booking shows (end time, length, occasion, WhatsApp number and money) and the refund mark for a declined paid booking;
//  - a "Table booking" coupon type, with our date and time pickers in the coupon's valid period.
// What it changes in the bench is put back at the end. Other bookings left in the bench by earlier tests are ignored (only the ones made here are looked at).
import { chromium } from "playwright";
const AD = "http://localhost:3171";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const problems = [];
let seen = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); if (problems.length > seen) { console.log(`      ^ browser error: ${problems.slice(seen).join(" | ").slice(0, 200)}`); seen = problems.length; } };
const norm = (t) => t.replace(/\s+/g, " ").trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 8000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await fn()) return true; } catch { /* retry */ } await sleep(200); } return false; };
const stamp = String(Date.now()).slice(-6);

const cookie = (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "o@acme.test", password: "Owner123!" }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const outlets = await (await fetch(`${API}/api/outlets`, { headers: { cookie } })).json();
const main = (outlets.outlets ?? outlets).find((o) => o.slug === "main");
const outletId = String(main._id ?? main.id);
const call = async (method, path, body, who = cookie) => {
  const r = await fetch(API + path, { method, headers: { "content-type": "application/json", cookie: who, "x-rasoipulse-outlet": outletId }, body: body ? JSON.stringify(body) : undefined });
  let json = {}; try { json = await r.json(); } catch { /* not json */ }
  return { status: r.status, json };
};
const S = await import("../../../packages/config-schema/src/index.js");
const today = S.istDayKey();
const dayN = (n) => S.shiftDay(today, n);
const at = (n, h, m = 0) => S.istDate(dayN(n), h * 60 + m).toISOString();
const before = (await call("GET", `/api/outlets/${outletId}`)).json.outlet?.config;
const made = [];
const coupons = [];

await call("PATCH", `/api/outlets/${outletId}/config`, {
  operations: { hours: { enabled: true, opensAt: "11:00", closesAt: "23:00" } },
  features: { reservations: { enabled: true } },
  payments: { enabled: ["cod", "mock"] },
  reservations: { pricePerPersonHour: 0, maxGuestsPerSlot: 60, maxDaysAhead: 10, minNoticeMinutes: 60, autoConfirm: false, whatsappTemplate: { name: "", languageCode: "en" } },
});

// a guest, signed in through the API (for paid bookings)
const phone = `96${stamp}1`.slice(0, 10).padEnd(10, "1");
const otp = await (await fetch(`${API}/api/customer/otp/request`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ outletId, destination: phone, name: "Dash Guest" }) })).json();
const verified = await fetch(`${API}/api/customer/otp/verify`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ outletId, destination: phone, code: otp.devCode ?? "123456", name: "Dash Guest", gender: "female", age: 30 }) });
const guest = verified.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const WA = "9876512345";

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1360, height: 900 } })).newPage();
page.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !/Failed to load resource|React DevTools|favicon|WebSocket/.test(m.text())) problems.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
page.on("dialog", (d) => d.accept());
const body = async () => norm(await page.locator("body").innerText());

/** choose a day with OUR calendar: open the box, go forward to that day's month (the calendar opens on this month), press the day, press OK */
async function pickDate(testId, dayKey) {
  await page.getByTestId(testId).click();
  const cal = page.locator(".rasoipulse-datepicker");
  await cal.waitFor({ timeout: 5000 });
  const forward = (Number(dayKey.slice(0, 4)) - Number(today.slice(0, 4))) * 12 + (Number(dayKey.slice(5, 7)) - Number(today.slice(5, 7)));
  for (let i = 0; i < forward; i++) await page.getByRole("button", { name: "Next month" }).click();
  await cal.locator("button:not([disabled])", { hasText: new RegExp(`^${Number(dayKey.slice(8))}$`) }).first().click();
  await page.getByRole("button", { name: "OK", exact: true }).click();
  await cal.waitFor({ state: "detached", timeout: 3000 });
}
const book = async (n, h1, h2, event, extra = {}) => {
  const r = await call("POST", "/api/reservations", { outletId, at: at(n, h1), endsAt: at(n, h2), partySize: 2, event, whatsapp: WA, ...extra }, guest);
  const b = r.json.reservation;
  if (!b) throw new Error(`could not book: ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`);
  made.push(b.id);
  if (b.payment.status === "pending") {
    const i = await call("POST", "/api/payments/intent", { outletId, reservationId: b.id }, guest);
    await call("POST", "/api/payments/verify", { outletId, paymentId: i.json.paymentId, payload: { payment_id: String(i.json.clientParams.payment_id), signature: String(i.json.clientParams.signature) } }, guest);
  }
  return b;
};
const staff = async (n, h, name, note = "") => {
  const r = await call("POST", "/api/reservations/staff", { at: at(n, h), partySize: 2, name, phone: "9000000000", note });
  const b = r.json.reservation;
  if (!b) throw new Error(`could not add: ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`);
  made.push(b.id);
  return b;
};
const row = (code) => page.getByTestId(`booking-${code}`);
const state = async (id) => (await call("GET", "/api/reservations?scope=all")).json.reservations?.find((x) => x.id === id) ?? null;
const waMessages = async () => {
  const chats = (await call("GET", "/api/whatsapp/chats")).json.chats ?? [];
  const out = [];
  for (const c of chats) for (const m of ((await call("GET", `/api/whatsapp/chats/${c.id}/messages`)).json.messages ?? [])) out.push({ phone: c.phone, text: m.text, direction: m.direction });
  return out;
};
const shownCodes = () => page.locator('[data-testid^="booking-B"]').evaluateAll((els) => els.filter((e) => e.dataset.status).map((e) => e.dataset.testid.replace("booking-", "")));

try {
  await page.goto(AD + "/", { waitUntil: "load" });
  await page.fill('input[type="email"]', "o@acme.test"); await page.fill('input[type="password"]', "Owner123!");
  await page.getByRole("button", { name: /sign in|log in/i }).first().click();
  await page.waitForSelector("text=Orders");

  /* ------------------------------------------------------------------------------------------------------ A. settings */
  console.log("== Settings: the stay, the price, the WhatsApp Business template");
  await page.goto(AD + "/settings", { waitUntil: "load" });
  await page.getByRole("tab", { name: /Pre-orders & bookings/ }).or(page.getByRole("button", { name: /Pre-orders & bookings/ })).first().click();
  await page.getByTestId("settings-bookings").waitFor({ timeout: 15000 });
  const text = await body();
  ok(/Usual stay \(minutes\)/.test(text) && /Shortest stay \(minutes\)/.test(text) && /Longest stay \(minutes\)/.test(text), "the booking settings have Usual stay, Shortest stay and Longest stay");
  ok(/Booking price per person per hour \(₹\)/.test(text), "…and 'Booking price per person per hour (₹)'");
  ok(/WhatsApp Business template for booking updates/.test(text), "…and the WhatsApp Business template for booking updates");
  const price = page.getByLabel("Booking price per person per hour", { exact: true });
  ok((await price.inputValue()) === "0", "the price starts at 0 (no charge, so nothing is paid in advance)");
  await price.fill("400");
  await page.getByLabel("Shortest stay minutes").fill("60");
  await page.getByLabel("Longest stay minutes").fill("180");
  await page.getByLabel("Booking update template name").fill("booking_update");
  await page.getByRole("button", { name: /^Save/ }).first().click();
  await sleep(1500);
  const saved = (await call("GET", `/api/outlets/${outletId}`)).json.outlet.config.reservations;
  ok(saved.pricePerPersonHour === 40000 && saved.minDurationMinutes === 60 && saved.maxDurationMinutes === 180 && saved.whatsappTemplate?.name === "booking_update", "saved: ₹400 per person per hour (40000 paise), stays of 1 to 3 hours, the template name", JSON.stringify({ p: saved.pricePerPersonHour, t: saved.whatsappTemplate }));
  // (the template name is cleared again so the bench keeps sending through its linked WhatsApp number)
  await call("PATCH", `/api/outlets/${outletId}/config`, { reservations: { whatsappTemplate: { name: "", languageCode: "en" } } });

  /* ------------------------------------------------------------------------------------------------------ B. the list */
  console.log("== Bookings: every upcoming booking, soonest first — no date to change");
  const bLate = await staff(6, 13, "Far Farid");
  const bMid = await staff(3, 20, "Later Lata", "Window seat");
  const bSoon = await staff(1, 13, "Soon Sam");
  const bPaid = await book(1, 19, 21, "Anniversary");
  const bTwo = await book(2, 18, 20, "Business meeting");
  const mine = [bSoon.code, bPaid.code, bTwo.code, bMid.code, bLate.code];
  await page.goto(AD + "/reservations", { waitUntil: "load" });
  await row(bSoon.code).waitFor({ timeout: 15000 });
  ok((await page.getByTestId("booking-scope-upcoming").getAttribute("aria-selected")) === "true", "the page opens on 'Upcoming' — no date to pick first");
  const order = (await shownCodes()).filter((c) => mine.includes(c));
  ok(JSON.stringify(order) === JSON.stringify(mine), "the five new bookings are all listed, soonest first (tomorrow 1 PM, tomorrow 7 PM, in 2 days, in 3 days, in 6 days)", order.join(","));
  const days = await page.locator("section[data-day]").evaluateAll((els) => els.map((e) => e.dataset.day));
  ok(days.length === new Set(days).size && JSON.stringify(days) === JSON.stringify([...days].sort()) && [1, 2, 3, 6].every((n) => days.includes(dayN(n))), "they are grouped under one heading per day, the days in order", days.join(","));
  const heads = (await page.getByTestId("booking-group").allInnerTexts()).map(norm);
  ok(heads.some((h) => /^TOMORROW/i.test(h)), "…the nearest says 'Tomorrow'", heads.slice(0, 3).join(" | "));
  const apiCounts = (await call("GET", "/api/reservations")).json.counts;
  const countsText = norm(await page.getByTestId("booking-counts").innerText());
  ok(new RegExp(`${apiCounts.bookings} bookings?`).test(countsText) && new RegExp(`${apiCounts.guests} guests`).test(countsText), "the counts cover the whole list, as the server counts it", `${countsText} / ${JSON.stringify(apiCounts)}`);
  ok((await page.locator('input[type="date"], input[type="datetime-local"], input[type="time"]').count()) === 0, "there is NO browser date or time box on the page — only our own date picker");

  console.log("== The date is only a filter, chosen with our date picker");
  const filter = page.getByTestId("booking-filter-date");
  ok((await filter.innerText()).includes("Filter by date"), "the box reads 'Filter by date'");
  await pickDate("booking-filter-date", dayN(3));
  await until(async () => (await shownCodes()).includes(bMid.code) && !(await shownCodes()).includes(bSoon.code));
  const filtered = await shownCodes();
  const sections = await page.locator("section[data-day]").evaluateAll((els) => els.map((e) => e.dataset.day));
  ok(filtered.includes(bMid.code) && !filtered.includes(bSoon.code) && !filtered.includes(bLate.code) && sections.length === 1 && sections[0] === dayN(3), "choosing a day shows just that day's bookings", filtered.join(","));
  ok(/Showing only/.test(await page.getByTestId("booking-filter-note").innerText()), "…and a note says it is filtered");
  ok(await page.getByTestId("booking-filter-clear").isVisible(), "…with a 'Show all upcoming' button");
  await page.getByTestId("booking-filter-clear").click();
  await until(async () => (await shownCodes()).includes(bLate.code) && (await shownCodes()).includes(bSoon.code));
  ok((await shownCodes()).includes(bLate.code) && (await shownCodes()).includes(bSoon.code) && (await filter.innerText()).includes("Filter by date"), "it goes back to the full list");
  await pickDate("booking-filter-date", dayN(40));
  await until(async () => /No bookings on this day/.test(await body()));
  ok(/No bookings on this day/.test(await body()), "a day with nothing booked says so");
  await page.getByTestId("booking-filter-clear").click();
  await page.getByTestId("booking-scope-earlier").click();
  await until(async () => (await page.getByTestId("booking-scope-earlier").getAttribute("aria-selected")) === "true");
  await sleep(600);
  ok(!(await shownCodes()).some((c) => mine.includes(c)), "'Earlier' has its own list — none of tomorrow's bookings are in it");
  await page.getByTestId("booking-scope-all").click();
  await until(async () => { const l = await shownCodes(); return mine.every((c) => l.includes(c)); });
  ok((await shownCodes()).filter((c) => mine.includes(c)).length === 5, "'All' shows everything");
  await page.getByTestId("booking-scope-upcoming").click();
  await until(async () => (await page.getByTestId("booking-scope-upcoming").getAttribute("aria-selected")) === "true");

  console.log("== A booking taken over the phone: the day is chosen with our date picker too");
  await page.getByTestId("new-booking").click();
  await page.getByTestId("new-booking-form").waitFor();
  ok((await page.locator('input[type="date"]').count()) === 0, "the New booking window has no browser date box either");
  await pickDate("new-booking-day", dayN(4));
  ok((await page.getByTestId("new-booking-day").getAttribute("data-value")) === dayN(4), "the day is set from the calendar");
  await page.waitForFunction(() => document.querySelector('select[aria-label="Booking time"]')?.options.length > 3, null, { timeout: 10000 });
  const pick = await page.getByLabel("Booking time").evaluate((sel) => { const i = [...sel.options].findIndex((o, n) => n > 0 && o.value && !/full/.test(o.textContent)); return i; });
  await page.getByLabel("Booking time").selectOption({ index: pick });
  const priyaName = `Phone Priya ${stamp}`;
  await page.getByLabel("Guest name").fill(priyaName);
  await page.getByLabel("Guest phone").fill("9000000009");
  await page.getByTestId("new-booking-submit").click();
  await until(async () => (await body()).includes(priyaName), 10000);
  const priya = (await call("GET", `/api/reservations?day=${dayN(4)}`)).json.reservations.find((x) => x.customer.name === priyaName);
  if (priya) made.push(priya.id);
  ok(Boolean(priya) && priya.status === "confirmed" && (await body()).includes(priyaName), "the booking is made (confirmed) and shows in the list, without looking its date up");

  /* ------------------------------------------------------------------------------------------------------ C. status by hand */
  console.log("== Changing the status by hand: a mistaken No-show is not stuck");
  await row(bSoon.code).getByRole("button", { name: "No-show" }).click();
  await page.getByTestId("status-dialog").waitFor();
  await page.getByTestId("status-submit").click();
  await until(async () => (await state(bSoon.id))?.status === "no_show");
  ok((await state(bSoon.id)).status === "no_show", "Soon Sam is marked No-show");
  await until(async () => (await row(bSoon.code).getAttribute("data-status")) === "no_show");
  ok((await row(bSoon.code).getByRole("button", { name: "Seat" }).count()) === 0 && (await row(bSoon.code).getByTestId(`booking-status-menu-${bSoon.code}`).isVisible()), "after that the usual buttons are gone — but there is a 'Status' button");
  await row(bSoon.code).getByTestId(`booking-status-menu-${bSoon.code}`).click();
  const items = (await page.getByRole("menuitem").allInnerTexts()).map(norm);
  ok(items.length === 6 && !items.some((t) => /^No-show/.test(t)) && ["Waiting to be confirmed", "Confirmed", "Seated", "Completed", "Declined", "Cancelled"].every((s) => items.some((t) => t.startsWith(s))), "its menu offers every other status (all but No-show)", items.join(" | "));
  await page.getByTestId("booking-set-confirmed").click();
  await page.getByTestId("notify-dialog").waitFor();
  ok(/Approve this booking/.test(await page.getByTestId("notify-dialog").innerText()), "choosing Confirmed opens the 'Approve this booking' window (the guest may be told)");
  if (await page.getByTestId("notify-send").isEnabled()) await page.getByTestId("notify-send").uncheck();
  await page.getByTestId("notify-submit").click();
  await until(async () => (await state(bSoon.id))?.status === "confirmed");
  ok((await state(bSoon.id)).status === "confirmed", "the booking is back to Confirmed — nothing is stuck");
  await until(async () => (await row(bSoon.code).getAttribute("data-status")) === "confirmed");
  const hist = ((await state(bSoon.id)).history ?? []).map((h) => h.reason ?? "").join(" | ");
  ok(/Changed by hand from no-show/i.test(hist), "its history says it was changed by hand", hist);
  await row(bSoon.code).getByTestId(`booking-status-menu-${bSoon.code}`).click();
  await page.getByTestId("booking-set-completed").click();
  await page.getByTestId("status-dialog").waitFor();
  ok(/manual change/.test(await page.getByTestId("status-dialog").innerText()), "a change that skips a step says it is a manual change");
  await page.getByTestId("status-submit").click();
  await until(async () => (await state(bSoon.id))?.status === "completed");
  ok((await state(bSoon.id)).status === "completed", "…and it is done (Completed, straight from Confirmed)");

  /* ------------------------------------------------------------------------------------------------------ D. the message window */
  console.log("== Approving: tell the guest, in words that can be edited, sent automatically");
  const rowText = norm(await row(bPaid.code).innerText());
  ok(/7:00 PM/.test(rowText) && /to 9:00 PM · 2 hrs/.test(rowText) && /Anniversary/.test(rowText) && new RegExp(`WhatsApp \\+91 ${WA}`).test(rowText), "a booking shows its start, end, length, occasion and the WhatsApp number", rowText.slice(0, 200));
  ok(/₹1,600/.test(rowText) && /₹800 paid in advance, ₹800 at the restaurant/.test(rowText), "…and the money: ₹1,600, ₹800 paid in advance, ₹800 at the restaurant", rowText.slice(0, 260));
  await row(bPaid.code).getByTestId("booking-confirm").click();
  const dlg = page.getByTestId("notify-dialog");
  await dlg.waitFor();
  const channel = page.getByTestId("notify-channel");
  await until(async () => (await channel.getAttribute("data-channel")) !== null && !/Checking/.test(await channel.innerText()));
  const way = await channel.getAttribute("data-channel");
  ok(["linked", "business", "sms", "none"].includes(way), "the window says how it will go", `${way}: ${norm(await channel.innerText())}`);
  if (way !== "none") ok(/Sent automatically through/.test(await channel.innerText()) && new RegExp(`\\+91 ${WA}`).test(await channel.innerText()), "…automatically, and to the WhatsApp number the guest gave");
  const msg = page.getByTestId("notify-message");
  const first = await msg.inputValue();
  ok(/is confirmed for/.test(first) && /You paid ₹800 in advance; the remaining ₹800 is paid at the restaurant/.test(first) && /food and drinks are paid for separately/.test(first), "the message is already written: confirmed, ₹800 paid, ₹800 at the restaurant, food and drinks paid for separately", first.slice(0, 260));
  ok((await page.getByTestId("notify-reason").count()) === 0, "approving needs no reason");
  if (way !== "none") {
    ok(await page.getByTestId("notify-send").isChecked(), "'Tell … on WhatsApp' is ticked");
    const mark = `Hello Dash — table confirmed for Anniversary! 🎉 See you at 7. (${stamp})`;
    await msg.fill(mark);
    await page.getByTestId("notify-submit").click();
    await until(async () => (await state(bPaid.id))?.status === "confirmed");
    ok((await state(bPaid.id)).status === "confirmed", "Approve & send message: the booking is confirmed");
    if (way === "linked") ok(await until(async () => (await waMessages()).some((m) => m.text === mark && m.phone.endsWith(WA) && m.direction === "out"), 12000), "…and the guest's WhatsApp message went out as the team wrote it, to the number they gave");
    else ok(true, `(this bench sends by ${way}; the wording and routing are checked in the API test)`);
  } else {
    await page.getByTestId("notify-submit").click();
    await until(async () => (await state(bPaid.id))?.status === "confirmed");
    ok((await state(bPaid.id)).status === "confirmed", "this store has no way to send: the booking is still confirmed (without a message)");
  }

  console.log("== Declining: a reason, the refund, and no message if you don't want one");
  await row(bTwo.code).getByTestId("booking-decline").click();
  await dlg.waitFor();
  ok(/Decline this booking/.test(await dlg.innerText()) && (await page.getByTestId("notify-reason").isVisible()), "the decline window asks for a reason");
  ok(/Their advance of ₹800 will be marked refund due/.test(norm(await dlg.innerText())), "…and says the paid advance (₹800) will be marked for a refund");
  await page.getByTestId("notify-reason").fill("We are fully booked that evening");
  await until(async () => /fully booked that evening/.test(await msg.inputValue()));
  ok(/fully booked that evening/.test(await msg.inputValue()) && /refund/i.test(await msg.inputValue()), "the message follows the reason and mentions the refund of the advance", (await msg.inputValue()).slice(0, 200));
  const countBefore = (await waMessages()).length;
  if (await page.getByTestId("notify-send").isEnabled()) {
    await page.getByTestId("notify-send").uncheck();
    ok(await msg.isDisabled() && /Decline without a message/.test(await page.getByTestId("notify-submit").innerText()), "un-ticking 'Tell …' switches the message off and the button reads 'Decline without a message'");
  }
  await page.getByTestId("notify-submit").click();
  await until(async () => (await state(bTwo.id))?.status === "declined");
  const declined = await state(bTwo.id);
  ok(declined.status === "declined" && declined.payment.status === "refund_due", "declined, and its advance is due for a refund");
  await sleep(800);
  ok((await waMessages()).length === countBefore, "no message was sent");
  await until(async () => /Refund ₹800 due/.test(norm(await row(bTwo.code).innerText())));
  const r2 = norm(await row(bTwo.code).innerText());
  ok(/Refund ₹800 due/.test(r2) && /Mark refunded/.test(r2), "the Bookings page shows 'Refund ₹800 due' and a 'Mark refunded' button", r2.slice(0, 260));
  await row(bTwo.code).getByTestId("booking-refunded").click();
  await until(async () => (await state(bTwo.id))?.payment.status === "refunded");
  await until(async () => /Advance refunded/.test(norm(await row(bTwo.code).innerText())));
  ok((await state(bTwo.id)).payment.status === "refunded" && /Advance refunded/.test(norm(await row(bTwo.code).innerText())), "'Mark refunded' closes it ('Advance refunded')");

  console.log("== Cancelling");
  await row(bMid.code).getByTestId("booking-cancel").click();
  await dlg.waitFor();
  ok(/Cancel this booking/.test(await dlg.innerText()) && /Cancel booking & send message|Cancel without a message/.test(await page.getByTestId("notify-submit").innerText()), "cancelling opens its own window");
  await page.getByRole("button", { name: "Back" }).click();
  await dlg.waitFor({ state: "detached" });
  ok((await state(bMid.id)).status === "confirmed", "'Back' changes nothing");

  console.log("== A booking made with a coupon shows what it saved");
  const cpn = `TBX${stamp}`;
  const cr = await call("POST", "/api/coupons", { code: cpn, description: "", discountType: "fixed", value: 10000, maxDiscount: 0, minOrderValue: 0, validFrom: "", validUntil: "", maxRedemptions: 0, maxPerCustomer: 0, newCustomersOnly: false, channels: ["booking"], active: true, buyQty: 1, getQty: 1, itemIds: [], categoryIds: [], maxFreeUnits: 0 });
  const cid = cr.json.coupon?.id ?? cr.json.coupon?._id;
  if (cid) coupons.push(cid);
  const bCoup = await book(5, 14, 16, "Friends' get-together", { couponCode: cpn });
  await page.goto(AD + "/reservations", { waitUntil: "load" });
  await row(bCoup.code).waitFor({ timeout: 15000 });
  const rc = norm(await row(bCoup.code).innerText());
  ok(new RegExp(`₹1,500 after ${cpn} \\(−₹100\\)`).test(rc) && /₹750 paid in advance, ₹750 at the restaurant/.test(rc), "the row shows the amount after the coupon (₹1,500 after the code, −₹100) and the advance (₹750 paid, ₹750 at the restaurant)", rc.slice(0, 260));

  /* ------------------------------------------------------------------------------------------------------ E. coupons */
  console.log("== Coupons: a Table booking type, and our date and time pickers");
  await page.goto(AD + "/coupons", { waitUntil: "load" });
  await page.getByRole("button", { name: /New coupon/ }).first().click();
  const form = page.locator('form[aria-label="New coupon"]');
  await form.waitFor({ timeout: 10000 });
  ok((await form.locator('input[type="datetime-local"], input[type="date"], input[type="time"]').count()) === 0, "the coupon form has no browser date, time or date-time box");
  const tableTick = form.getByRole("checkbox", { name: /Table booking/ });
  ok((await tableTick.count()) === 1, "'Order types' has a 'Table booking' tick");
  const code = `TBL${stamp}`;
  await form.getByPlaceholder("SAVE20").fill(code);
  await pickDate("coupon-from-date", dayN(1));
  ok((await page.getByTestId("coupon-from-date").getAttribute("data-value")) === dayN(1) && !(await page.getByTestId("coupon-from-time").isDisabled()), "'From' is chosen on our calendar and its time box opens");
  await page.getByTestId("coupon-from-time").click();
  await page.getByTestId("coupon-from-time-panel").locator('[data-time="09:00"]').click();
  await pickDate("coupon-until-date", dayN(5));
  ok(/11:59 PM/.test(await page.getByTestId("coupon-until-time").innerText()), "'Until' starts at the end of the day (11:59 PM)", await page.getByTestId("coupon-until-time").innerText());
  ok(await page.getByTestId("coupon-from-clear").isVisible() && await page.getByTestId("coupon-until-clear").isVisible(), "each side has a Clear button");
  await tableTick.check();
  await form.getByRole("button", { name: "Create coupon" }).click();
  await form.waitFor({ state: "detached", timeout: 10000 });
  const list = (await call("GET", "/api/coupons")).json;
  const made1 = (list.coupons ?? list).find((c) => c.code === code);
  if (made1) coupons.push(made1.id ?? made1._id);
  ok(Boolean(made1) && made1.channels.includes("booking") && Boolean(made1.validFrom) && Boolean(made1.validUntil) && new Date(made1.validFrom) < new Date(made1.validUntil), "the coupon is saved for table bookings with its start and end from the pickers", JSON.stringify({ ch: made1?.channels, f: made1?.validFrom, u: made1?.validUntil }));
  ok(made1 && S.istDayKey(new Date(made1.validFrom)) === dayN(1) && S.istDayKey(new Date(made1.validUntil)) === dayN(5), "…the days are the ones chosen on the calendars", `${made1?.validFrom} → ${made1?.validUntil}`);

  /* ------------------------------------------------------------------------------------------------------ F. catalogue */
  console.log("== The component catalogue lists the new pickers");
  await page.goto(AD + "/components", { waitUntil: "load" });
  await page.getByText("Pickers & Inputs").first().click();
  await sleep(800);
  const cat = await body();
  ok(/Time Pickers/.test(cat) && /TP01/.test(cat) && /TP02/.test(cat), "'Time Pickers' (TP01 popover input, TP02 inline list) is in the catalogue");
  ok(/DRP08/.test(cat) && /Searchable/.test(cat), "…and the searchable dropdown (DRP08)");
  ok(/DP03/.test(cat) && /DP02/.test(cat), "…beside the date pickers (DP02 filled, DP03 popover input) the booking page uses");

  ok(problems.length === 0, "no errors in the browser", problems.slice(0, 2).join(" | "));
} finally {
  for (const id of made) await call("PATCH", `/api/reservations/${id}`, { status: "cancelled", manual: true, reason: "test clean-up", notify: { send: false } });
  for (const id of coupons) await call("DELETE", `/api/coupons/${id}`);
  if (before?.reservations) await call("PATCH", `/api/outlets/${outletId}/config`, { reservations: before.reservations, features: { reservations: before.features?.reservations ?? { enabled: false } }, payments: before.payments, operations: { hours: before.operations?.hours } });
  await browser.close();
}
console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
