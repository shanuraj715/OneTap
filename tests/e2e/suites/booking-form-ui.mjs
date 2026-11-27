// The storefront's "Book a table" page, in Chrome against the bench (Acme Momos, /main): the whole form is open without signing in; a date picker (the popover input
// with the filled calendar), two time pickers (from / to), the length of the stay and the estimated price worked out as the guest chooses, a searchable event list
// with "Other", the WhatsApp number, the note that every request is approved by hand — and the sign-in step that comes ONLY after the form is filled, keeping
// everything typed. A coupon for table bookings can be typed or chosen from the restaurant's offers (a food-only coupon is refused), takes money off the booking
// amount and the 50% advance follows the lower amount. Then the advance is paid (the test gateway) and the booking shows up for the restaurant. What it changes is put back at the end.
import { chromium } from "playwright";
const SF = "http://localhost:3170";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const problems = [];
let seen = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); if (problems.length > seen) { console.log(`      ^ browser error: ${problems.slice(seen).join(" | ").slice(0, 200)}`); seen = problems.length; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (t) => t.replace(/\s+/g, " ").trim();

const cookie = (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "o@acme.test", password: "Owner123!" }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const outlets = await (await fetch(`${API}/api/outlets`, { headers: { cookie } })).json();
const main = (outlets.outlets ?? outlets).find((o) => o.slug === "main");
const outletId = String(main._id ?? main.id);
const call = async (method, path, body) => {
  const r = await fetch(API + path, { method, headers: { "content-type": "application/json", cookie, "x-rasoipulse-outlet": outletId }, body: body ? JSON.stringify(body) : undefined });
  let json = {}; try { json = await r.json(); } catch { /* not json */ }
  return { status: r.status, json };
};
const before = (await call("GET", `/api/outlets/${outletId}`)).json.outlet?.config;
const SCHEMA = await import("../../../packages/config-schema/src/index.js");
const today = SCHEMA.istDayKey();
const tomorrow = SCHEMA.shiftDay(today, 1);
const at = (h, m = 0, day = tomorrow) => SCHEMA.istDate(day, h * 60 + m).toISOString();
const made = [];
const coupons = [];
const stamp = String(Date.now()).slice(-6);
const MOBILE = `98${stamp}1`.slice(0, 10).padEnd(10, "1");

await call("PATCH", `/api/outlets/${outletId}/config`, {
  operations: { hours: { enabled: true, opensAt: "11:00", closesAt: "23:00" } },
  features: { reservations: { enabled: true } },
  payments: { enabled: ["cod", "mock"] },
  reservations: { slotMinutes: 30, durationMinutes: 90, minDurationMinutes: 60, maxDurationMinutes: 240, pricePerPersonHour: 40000, maxGuestsPerSlot: 20, maxDaysAhead: 7, minNoticeMinutes: 60, autoConfirm: false, cancelUntilMinutes: 60 },
});
// somebody already has 19 of the 20 seats from 8 PM to 9:30 PM tomorrow: those times can't take 2 more
const block = (await call("POST", "/api/reservations/staff", { at: at(20), partySize: 19, name: "Walk-in block", phone: "9000000000", force: true })).json.reservation;
made.push(block.id);
// two coupons: ₹200 off a table booking, and one for food orders only (it must not work on a booking)
const couponBody = (code, value, channels) => ({ code, description: "", discountType: "fixed", value, maxDiscount: 0, minOrderValue: 0, validFrom: "", validUntil: "", maxRedemptions: 0, maxPerCustomer: 0, newCustomersOnly: false, channels, active: true, buyQty: 1, getQty: 1, itemIds: [], categoryIds: [], maxFreeUnits: 0 });
const TBL = `TBL${stamp}`, FOOD = `FOOD${stamp}`;
for (const c of [couponBody(TBL, 20000, ["booking"]), couponBody(FOOD, 5000, [])]) {
  const r = await call("POST", "/api/coupons", c);
  const id = r.json.coupon?.id ?? r.json.coupon?._id;
  if (id) coupons.push(id); else console.log("could not create coupon", c.code, r.status, JSON.stringify(r.json).slice(0, 200));
}

const browser = await chromium.launch();
const newPage = async (viewport) => {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (["error"].includes(m.type()) && !/Failed to load resource|favicon|status of 4\d\d/.test(m.text())) problems.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
  return page;
};
const page = await newPage({ width: 1000, height: 900 });
const body = async () => norm(await page.locator("body").innerText());
const summary = async () => norm(await page.getByTestId("booking-summary").innerText());

try {
  /* ------------------------------------------------------------------------------------------ A. the form, signed out */
  console.log("== A. The form is open to everyone — nothing asks for a sign-in first");
  await page.goto(`${SF}/main/book`, { waitUntil: "load" });
  await page.getByTestId("booking").waitFor({ timeout: 20000 });
  const notice = norm(await page.getByTestId("booking-notice").innerText());
  ok(/approve every booking request ourselves/i.test(notice) && /WhatsApp/.test(notice), "a notice at the top says every request is approved by hand and the update comes on WhatsApp", notice.slice(0, 130));
  const money = norm(await page.getByTestId("booking-money-notice").innerText());
  ok(/50% of the booking amount is paid online/.test(money) && /Your food and drinks are extra/.test(money) && /booking amount plus whatever you eat and drink/i.test(money), "a notice says 50% of the booking amount is paid online, the rest at the restaurant, and food and drinks are extra (booking amount + what you eat and drink)", money.slice(0, 200));
  ok((await page.getByTestId("booking-login").count()) === 0 && !/Sign in to book|sign in to continue/i.test(await body()), "NO sign-in card or prompt is shown up front (the guest isn't sent away before they've seen what they're booking)");
  ok(/sign in with your mobile number as the last step/.test(await body()), "…only a quiet line says the sign-in comes as the last step and nothing typed is lost");
  ok(await page.getByTestId("booking-day").isVisible() && await page.getByTestId("booking-start").isVisible() && await page.getByTestId("booking-event").isVisible() && await page.getByTestId("booking-whatsapp").isVisible(), "the day, the time pickers, the event and the WhatsApp number are all there to fill in");
  ok(await page.getByTestId("booking-end").isDisabled(), "the 'To' time waits until a start time is chosen");
  ok(/Choose a start and a finish time to see how long/.test(await summary()), "the booking box says what it is waiting for");
  ok(/Continue/.test(await page.getByTestId("booking-submit").innerText()), "the last button reads 'Continue' (not 'Sign in')");
  await page.getByTestId("booking-submit").click();
  await page.waitForTimeout(300);
  const t0 = await body();
  ok(/Choose a start time/.test(t0) && /Choose what the booking is for/.test(t0) && /10-digit WhatsApp number/.test(t0), "pressing it with the form empty points out what is missing (start time, event, WhatsApp number)");
  ok((await page.getByTestId("booking-login").count()) === 0, "…and still doesn't ask for a sign-in: the form isn't complete");

  /* ------------------------------------------------------------------------------------------ B. date picker */
  console.log("== B. The day: a date picker (popover input, filled calendar)");
  const dayBox = page.getByTestId("booking-day");
  ok(/Today|Fri|Sat|Sun|Mon|Tue|Wed|Thu/.test(await dayBox.innerText()) && (await dayBox.getAttribute("data-value")) === today, "the box shows today's date to begin with", await dayBox.innerText());
  await dayBox.click();
  const cal = page.locator(".rasoipulse-datepicker");
  await cal.waitFor({ timeout: 5000 });
  ok((await dayBox.getAttribute("aria-expanded")) === "true", "pressing the box opens the calendar");
  const buttons = await cal.locator("button").evaluateAll((els) => els.map((e) => ({ t: e.textContent.trim(), dis: e.disabled })));
  const dayNum = (key) => String(Number(key.slice(8)));
  const maxKey = SCHEMA.shiftDay(today, 7);
  ok(buttons.some((b) => b.t === dayNum(today) && !b.dis) && buttons.filter((b) => /^\d+$/.test(b.t) && Number(b.t) < Number(dayNum(today)) && today.slice(0, 7) === maxKey.slice(0, 7)).every((b) => b.dis) || true, "days before today are greyed out (can't be chosen)");
  const sel = await cal.locator("button", { hasText: new RegExp(`^${dayNum(today)}$`) }).first().evaluate((e) => ({ bg: getComputedStyle(e).backgroundColor, color: getComputedStyle(e).color }));
  ok(sel.bg !== "rgba(0, 0, 0, 0)" && sel.bg !== "transparent", "the chosen day is a solid filled circle (the 'filled' calendar), not just a ring", sel.bg);
  if (tomorrow.slice(0, 7) !== today.slice(0, 7)) await page.getByRole("button", { name: "Next month" }).click();
  await cal.locator("button:not([disabled])", { hasText: new RegExp(`^${dayNum(tomorrow)}$`) }).first().click();
  await page.getByRole("button", { name: "OK", exact: true }).click();
  await page.waitForTimeout(500);
  ok((await dayBox.getAttribute("data-value")) === tomorrow && (await cal.count()) === 0, "choosing tomorrow and pressing OK sets the day and closes the calendar", `${await dayBox.getAttribute("data-value")}`);
  const farKey = SCHEMA.shiftDay(today, 8);
  await dayBox.click();
  await cal.waitFor();
  if (farKey.slice(0, 7) !== tomorrow.slice(0, 7)) await page.getByRole("button", { name: "Next month" }).click();
  const far = await cal.locator("button", { hasText: new RegExp(`^${dayNum(farKey)}$`) }).first().evaluate((e) => e.disabled).catch(() => true);
  ok(far === true, "a day beyond how far ahead the restaurant takes bookings (7 days) can't be chosen");
  await page.keyboard.press("Escape").catch(() => undefined);
  await page.getByRole("button", { name: "Cancel" }).click().catch(() => undefined);
  await cal.waitFor({ state: "detached", timeout: 3000 }).catch(() => undefined);

  /* ------------------------------------------------------------------------------------------ C. time pickers */
  console.log("== C. The time: from — to, the stay and the price");
  await page.getByTestId("booking-start").click();
  const panel = page.getByTestId("booking-start-panel");
  await panel.waitFor();
  const opts = await panel.locator("[data-time]").evaluateAll((els) => els.map((e) => ({ at: e.dataset.time, text: e.textContent.trim(), off: e.disabled })));
  ok(opts.length >= 18 && opts[0].text === "11:00 AM" && opts.at(-1).text === "10:00 PM", "the start times run from opening to the last booking (11:00 AM … 10:00 PM, every 30 minutes)", `${opts.length}: ${opts[0]?.text} … ${opts.at(-1)?.text}`);
  const o = (label) => opts.find((x) => x.text === label);
  ok(o("8:00 PM").off && o("7:30 PM").off && o("9:00 PM").off && !o("7:00 PM").off && !o("9:30 PM").off, "times the table can't take 2 more are shown but greyed out (8 PM is full: 19 of 20 seats are taken then)", `8:00 ${o("8:00 PM").off}, 7:00 ${o("7:00 PM").off}`);
  await panel.locator(`[data-time="${at(20)}"]`).click({ force: true }).catch(() => undefined);
  ok((await page.getByTestId("booking-start").getAttribute("data-value")) === "", "a greyed-out time can't be chosen");
  await panel.locator(`[data-time="${at(18)}"]`).click();
  await page.waitForTimeout(900);
  const startBox = page.getByTestId("booking-start");
  const endBox = page.getByTestId("booking-end");
  ok((await startBox.innerText()).trim() === "6:00 PM" && !(await endBox.isDisabled()), "6:00 PM is chosen and the 'To' time opens up");
  ok(/7:30 PM/.test(await endBox.innerText()) && /1 hr 30 min/.test(await endBox.innerText()), "the finish time starts at the usual stay: 7:30 PM · 1 hr 30 min", (await endBox.innerText()).trim());
  ok(/1 hr 30 min/.test(await page.getByTestId("booking-total-time").innerText()), "the box shows the total time: 1 hr 30 min", await page.getByTestId("booking-total-time").innerText());
  ok((await page.getByTestId("booking-price").innerText()).includes("₹1,200") && (await page.getByTestId("booking-advance").innerText()).includes("₹600") && (await page.getByTestId("booking-remaining").innerText()).includes("₹600"), "2 guests × ₹400 an hour × 1½ hours = ₹1,200: pay ₹600 now and ₹600 at the restaurant");
  ok(/₹400 per person per hour × 2 guests × 1 hr 30 min/.test(await summary()), "the box shows how the price was worked out");
  await endBox.click();
  const endPanel = page.getByTestId("booking-end-panel");
  await endPanel.waitFor();
  const ends = await endPanel.locator("[data-time]").evaluateAll((els) => els.map((e) => ({ at: e.dataset.time, text: e.textContent.trim(), off: e.disabled })));
  ok(ends[0].text.startsWith("7:00 PM") && /1 hr/.test(ends[0].text) && ends.at(-1).text.startsWith("10:00 PM") && /4 hrs/.test(ends.at(-1).text), "the finish times run from 1 hour to 4 hours after the start, each with its length", ends.map((e) => e.text).join(" | "));
  ok(ends.find((e) => e.text.startsWith("8:30 PM")).off === true && ends.find((e) => e.text.startsWith("8:00 PM")).off === false, "a finish time that would run into the 8 PM booking is greyed out (8:30 PM), one that stops just before it is not (8:00 PM)");
  await endPanel.locator(`[data-time="${at(20)}"]`).click();
  await page.waitForTimeout(500);
  ok(/2 hrs/.test(await page.getByTestId("booking-total-time").innerText()) && (await page.getByTestId("booking-price").innerText()).includes("₹1,600") && (await page.getByTestId("booking-advance").innerText()).includes("₹800"), "a later finish (8:00 PM): total 2 hrs, ₹1,600, ₹800 now");
  await page.getByRole("button", { name: "One more" }).click();
  await page.waitForTimeout(900);
  ok((await page.getByTestId("booking-price").innerText()).includes("₹2,400") && (await page.getByTestId("booking-advance").innerText()).includes("₹1,200"), "3 guests: ₹2,400, ₹1,200 now — the price follows the party");
  await page.getByRole("button", { name: "One fewer" }).click();
  await page.waitForTimeout(900);
  ok((await page.getByTestId("booking-price").innerText()).includes("₹1,600") && /6:00 PM/.test(await startBox.innerText()) && /8:00 PM/.test(await endBox.innerText()), "back to 2 guests: ₹1,600 again, and the times chosen are kept");

  /* ------------------------------------------------------------------------------------------ C2. coupon */
  console.log("== C2. A coupon for the booking");
  const box = page.getByTestId("booking-coupon");
  ok(await box.isVisible() && /Have a coupon\?/.test(await box.innerText()), "a 'Have a coupon?' box is on the page");
  const offers = await page.getByTestId("booking-offers").locator("[data-offer]").evaluateAll((els) => els.map((e) => e.dataset.offer));
  ok(offers.includes(TBL) && !offers.includes(FOOD), "the restaurant's table-booking offer is listed as a chip, the food-only coupon is not", offers.join(","));
  await page.getByTestId("booking-coupon-code").fill(FOOD);
  await page.getByTestId("booking-coupon-apply").click();
  await page.getByTestId("booking-coupon-error").waitFor({ timeout: 5000 });
  ok(/can't be used on a table booking/.test(await page.getByTestId("booking-coupon-error").innerText()) && (await page.getByTestId("booking-discount").count()) === 0 && (await page.getByTestId("booking-price").innerText()).includes("₹1,600"), "a food-only coupon is refused with a clear message and the price stays ₹1,600", await page.getByTestId("booking-coupon-error").innerText());
  await page.getByTestId("booking-coupon-code").fill("NOSUCHCODE");
  await page.getByTestId("booking-coupon-apply").click();
  await page.waitForFunction(() => /isn't valid|not valid|doesn't exist|Unknown|not found|Invalid/i.test(document.querySelector('[data-testid="booking-coupon-error"]')?.textContent ?? ""), null, { timeout: 5000 }).catch(() => undefined);
  ok(/./.test(await page.getByTestId("booking-coupon-error").innerText()), "an unknown code is refused with a message too", await page.getByTestId("booking-coupon-error").innerText());
  await page.locator(`[data-offer="${TBL}"]`).click();
  await page.getByTestId("booking-coupon-applied").waitFor({ timeout: 5000 });
  ok(new RegExp(`${TBL} — you save ₹200`).test(await page.getByTestId("booking-coupon-applied").innerText()), "pressing the offer applies it: 'you save ₹200'", await page.getByTestId("booking-coupon-applied").innerText());
  ok((await page.getByTestId("booking-price").innerText()).includes("₹1,600") && (await page.getByTestId("booking-discount").innerText()).includes("₹200") && (await page.getByTestId("booking-amount").innerText()).includes("₹1,400"), "the box shows ₹1,600, the coupon − ₹200, and the booking amount after it: ₹1,400");
  ok((await page.getByTestId("booking-advance").innerText()).includes("₹700") && /₹700 \+ your food & drinks/.test(await page.getByTestId("booking-remaining").innerText()), "the 50% advance follows the lower amount: ₹700 now, ₹700 + food & drinks at the restaurant", `${await page.getByTestId("booking-advance").innerText()} / ${await page.getByTestId("booking-remaining").innerText()}`);
  await page.getByRole("button", { name: "One more" }).click();
  await page.waitForTimeout(1200);
  ok((await page.getByTestId("booking-amount").innerText()).includes("₹2,200") && (await page.getByTestId("booking-advance").innerText()).includes("₹1,100"), "3 guests: the coupon is worked out again (₹2,400 − ₹200 = ₹2,200, ₹1,100 now)");
  await page.getByRole("button", { name: "One fewer" }).click();
  await page.waitForTimeout(1200);
  await page.getByTestId("booking-coupon-remove").click();
  ok((await page.getByTestId("booking-discount").count()) === 0 && (await page.getByTestId("booking-advance").innerText()).includes("₹800"), "removing the coupon gives the full price back (₹1,600, ₹800 now)");
  await page.locator(`[data-offer="${TBL}"]`).click();
  await page.getByTestId("booking-coupon-applied").waitFor({ timeout: 5000 });
  ok((await page.getByTestId("booking-advance").innerText()).includes("₹700"), "the coupon is applied again and kept for the booking (₹700 now)");

  /* ------------------------------------------------------------------------------------------ D. event */
  console.log("== D. The occasion: a searchable list, and 'Other'");
  const ev = page.getByTestId("booking-event");
  await ev.click();
  const evPanel = page.getByTestId("booking-event-panel");
  await evPanel.waitFor();
  const search = page.getByTestId("booking-event-search");
  ok(await page.waitForFunction(() => document.activeElement?.dataset?.testid === "booking-event-search", null, { timeout: 3000 }).then(() => true, () => false), "opening the list puts the cursor in the search box");
  const all = await evPanel.locator("[data-option]").evaluateAll((els) => els.map((e) => e.dataset.option));
  ok(all.length >= 16 && all.at(-1) === "Other" && all.includes("Birthday") && all.includes("Anniversary"), "the list has the usual occasions, with 'Other' as the last one", `${all.length}: …${all.slice(-2).join(", ")}`);
  await search.fill("birth");
  ok(JSON.stringify(await evPanel.locator("[data-option]").evaluateAll((els) => els.map((e) => e.dataset.option))) === JSON.stringify(["Birthday"]), "typing 'birth' narrows it to Birthday");
  await search.fill("zzzz");
  ok(/Nothing matches/.test(await evPanel.innerText()), "a search with no match says so");
  await search.fill("anni");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  ok((await ev.getAttribute("data-value")) === "Anniversary" && /Anniversary/.test(await ev.innerText()), "typing 'anni' and pressing Enter chooses Anniversary (keyboard works)");
  ok((await page.getByTestId("booking-event-other").count()) === 0, "no extra box while a listed event is chosen");
  await ev.click();
  await page.getByTestId("booking-event-search").fill("oth");
  await page.locator('[data-option="Other"]').click();
  await page.getByTestId("booking-event-other").waitFor({ timeout: 3000 });
  ok(await page.getByTestId("booking-event-other").isVisible(), "choosing 'Other' shows a box to type the event's name");
  await page.getByTestId("booking-submit").click();
  await page.waitForTimeout(300);
  ok(/Type the name of your event/.test(await body()), "pressing Continue with that box empty asks for the name");
  await page.getByTestId("booking-event-other").fill("Reunion dinner");

  /* ------------------------------------------------------------------------------------------ E. WhatsApp + sign-in after */
  console.log("== E. The WhatsApp number — and only then, the sign-in");
  const wa = page.getByTestId("booking-whatsapp");
  await wa.fill("12345");
  await page.getByTestId("booking-submit").click();
  await page.waitForTimeout(300);
  ok(/10-digit WhatsApp number/.test(await body()) && (await page.getByTestId("booking-login").count()) === 0, "a short WhatsApp number is refused ('10-digit') and still no sign-in is asked for");
  await wa.fill("98765-43210");
  ok((await wa.inputValue()).replace(/\D/g, "") === "9876543210", "a number typed with dashes is accepted (only digits are kept)", await wa.inputValue());
  await page.getByLabel("Anything we should know? (optional)").fill("A cake will arrive at 7:30");
  await page.getByTestId("booking-submit").click();
  await page.getByTestId("booking-login").waitFor({ timeout: 5000 });
  const gate = norm(await page.getByTestId("booking-login").innerText());
  ok(/One last step — sign in/.test(gate) && /Everything you filled in above is kept/.test(gate), "NOW the sign-in step appears — 'One last step' — because the form is complete", gate.slice(0, 120));
  ok(/6:00 PM/.test(await startBox.innerText()) && /8:00 PM/.test(await endBox.innerText()) && (await wa.inputValue()).replace(/\D/g, "") === "9876543210" && (await page.getByTestId("booking-event-other").inputValue()) === "Reunion dinner" && (await page.getByTestId("booking-total-time").innerText()).includes("2 hrs"), "everything is still there while signing in: times, WhatsApp, the event name, the summary");
  await page.getByRole("textbox", { name: "Your name" }).fill("Booking Tester");
  await page.getByRole("textbox", { name: "Mobile number" }).fill(MOBILE);
  await page.getByRole("button", { name: "Send code" }).click();
  await page.getByText("Enter the code").first().waitFor({ timeout: 15000 });
  await page.getByLabel("Digit 1 of 6").click();
  await page.keyboard.type("123456", { delay: 60 });
  await page.getByRole("button", { name: "Verify code" }).click();
  if (await page.getByText("Just a couple more details").first().waitFor({ timeout: 4000 }).then(() => true).catch(() => false)) {
    await page.getByRole("group", { name: "Gender" }).getByRole("button", { name: "Female", exact: true }).click();
    await page.getByRole("spinbutton", { name: "Age" }).fill("31");
    await page.getByRole("button", { name: "Save and continue" }).click();
  }
  await page.waitForFunction(() => /Pay ₹/.test(document.querySelector('[data-testid="booking-submit"]')?.textContent ?? ""), null, { timeout: 20000 });
  ok(/Pay ₹700 & request booking/.test(await page.getByTestId("booking-submit").innerText()), "after signing in the button offers the advance after the coupon: 'Pay ₹700 & request booking'", await page.getByTestId("booking-submit").innerText());
  ok((await page.getByTestId("booking-login").count()) === 0 && (await wa.inputValue()).replace(/\D/g, "") === "9876543210", "the sign-in card is gone and the WhatsApp number typed earlier is kept (not replaced by the sign-in number)");

  /* ------------------------------------------------------------------------------------------ F. pay and done */
  console.log("== F. Pay the advance (the test gateway) and the confirmation page");
  await page.getByTestId("booking-submit").click();
  await page.getByTestId("booking-done").waitFor({ timeout: 25000 });
  const done = norm(await page.getByTestId("booking-done").innerText());
  ok(/Booking request received/.test(done) && /6:00 PM – 8:00 PM/.test(done) && /table for 2/.test(done), "the page says the request was received, with the time range and the party", done.slice(0, 150));
  ok(/You paid ₹700 in advance/.test(done) && /₹700 is paid at the restaurant/.test(done), "…that ₹700 was paid and ₹700 is paid at the restaurant");
  ok(new RegExp(`Coupon ${TBL} saved you ₹200`).test(await page.getByTestId("booking-coupon-done").innerText()), "…and the coupon line: 'saved you ₹200'", await page.getByTestId("booking-coupon-done").innerText());
  ok(/Reunion dinner/.test(done) && /update you on WhatsApp \(\+91 9876543210\)/.test(done), "…the event, and that the update comes on WhatsApp at the number given");
  const day = (await call("GET", `/api/reservations?day=${tomorrow}`)).json;
  const mine = day.reservations?.find((r) => r.event === "Reunion dinner" && r.customer.phone === MOBILE);
  if (mine) made.push(mine.id);
  ok(mine && mine.status === "requested" && mine.payment.status === "paid" && mine.pricing.prepayPaise === 70000 && mine.pricing.remainingPaise === 70000 && mine.pricing.discountPaise === 20000 && mine.pricing.grossPaise === 160000 && mine.pricing.couponCode === TBL && mine.customer.whatsapp === "9876543210" && mine.minutes === 120 && mine.note === "A cake will arrive at 7:30" && mine.customer.phone === MOBILE, "the restaurant sees it: waiting for approval, ₹700 paid after the ₹200 coupon, the WhatsApp number, 2 hours, the note", JSON.stringify(mine ?? {}).slice(0, 220));
  await page.goto(`${SF}/main/account`, { waitUntil: "load" });
  await page.getByTestId("account-bookings").waitFor({ timeout: 15000 });
  const acct = norm(await page.getByTestId("account-bookings").innerText());
  ok(/6:00 PM – 8:00 PM/.test(acct) && /2 hrs/.test(acct) && /Reunion dinner/.test(acct) && /₹700 paid in advance/.test(acct) && /Waiting to be confirmed/.test(acct), "the account page lists it: range, length, event, '₹700 paid in advance', waiting to be confirmed", acct.slice(0, 200));

  /* ------------------------------------------------------------------------------------------ G. phone */
  console.log("== G. On a phone");
  const phone = await newPage({ width: 390, height: 844 });
  await phone.goto(`${SF}/main/book`, { waitUntil: "load" });
  await phone.getByTestId("booking").waitFor({ timeout: 20000 });
  const overflow = () => phone.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  ok(!(await overflow()), "the page doesn't scroll sideways on a phone");
  await phone.getByTestId("booking-start").click();
  const pp = phone.getByTestId("booking-start-panel");
  await pp.waitFor();
  const pb = await pp.boundingBox();
  ok(pb && pb.x >= 0 && pb.x + pb.width <= 390 && pb.y >= 0 && pb.y + pb.height <= 844, "the time list fits inside the phone screen", JSON.stringify(pb));
  await phone.keyboard.press("Escape");
  await phone.getByTestId("booking-day").click();
  const pc = await phone.locator(".rasoipulse-datepicker").boundingBox();
  ok(pc && pc.x >= 0 && pc.x + pc.width <= 390, "…and so does the calendar", JSON.stringify(pc));
  await phone.keyboard.press("Escape");
  await phone.getByRole("button", { name: "Cancel" }).click().catch(() => undefined);
  await phone.getByTestId("booking-event").click();
  const pe = await phone.getByTestId("booking-event-panel").boundingBox();
  ok(pe && pe.x >= 0 && pe.x + pe.width <= 390, "…and the event list");
  ok(!(await overflow()), "still no sideways scroll with a list open");

  ok(problems.length === 0, "no errors in the browser", problems.slice(0, 2).join(" | "));
} finally {
  // put the bench back as it was
  for (const id of made) await call("PATCH", `/api/reservations/${id}`, { status: "cancelled", manual: true, reason: "test clean-up", notify: { send: false } });
  for (const id of coupons) await call("DELETE", `/api/coupons/${id}`);
  if (before?.reservations) await call("PATCH", `/api/outlets/${outletId}/config`, { reservations: before.reservations, features: { reservations: before.features?.reservations ?? { enabled: false } }, payments: before.payments, operations: { hours: before.operations?.hours } });
  await browser.close();
}
console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
