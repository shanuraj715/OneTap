// Console, in Chrome against the bench (super admin: super@sandbox.test): Rasoi Pulse's OWN sales.
//   - a store's page has a Payments tab: write a payment down (day, plan, months, amount, note) → the first is the NEW SALE, later ones are
//     RE-SUBSCRIPTIONS; the amount starts from the plan's price; refused forms say what to fix; a wrong payment is deleted;
//   - the dashboard's "Rasoi Pulse business" section: total sales, new sales, re-subscribed, paid up / ran out, ONE chart that switches
//     between Day / Week / Month (each against the period before), the latest payments, who to follow up, by plan;
//   - a team member who can only READ stores sees the payments but gets no form and no Delete.
// What it adds to the bench is removed at the end (its payments are deleted, its plan archived, the stores go back to their own plans).
import { chromium } from "playwright";
const AD = "http://localhost:3171";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const problems = [];
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const say = (s) => console.log(`\n=== ${s}`);
const login = async (email, password) => (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const su = await login("super@sandbox.test", "Super123!");
const call = async (method, path, body, cookie = su) => { const r = await fetch(API + path, { method, headers: { "content-type": "application/json", cookie }, body: body ? JSON.stringify(body) : undefined }); const text = await r.text(); let json = {}; try { json = JSON.parse(text); } catch {} return { status: r.status, json }; };
const norm = (t) => t.replace(/\s+/g, " ").trim();
const tag = String(Date.now()).slice(-5);
const IST = 330 * 60_000, DAY = 86_400_000;
const istDay = (off = 0) => new Date(Date.now() + IST + off * DAY).toISOString().slice(0, 10);
const today = istDay(0);
const meName = (await call("GET", "/api/auth/me")).json.user.name; // who the bench's super admin is called
const rupee = (n) => `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n)}`;

const stores = (await call("GET", "/api/platform/stores")).json.stores;
const [A, B, C] = stores;
const was = {};
for (const s of [A, B, C]) was[s.id] = (await call("GET", `/api/platform/stores/${s.id}`)).json.store;
const madePlans = [];
const wrote = []; // [storeId, paymentId]
const NOTHING = { limits: {}, entitlements: { features: { unlock: [], lock: [] }, effects: { unlock: [], lock: [] }, qrCardFamilies: { unlock: [], lock: [] } } };

// start clean: no payments on the two stores the test uses
for (const s of [A, B, C]) for (const p of (await call("GET", `/api/platform/stores/${s.id}/payments`)).json.payments ?? []) await call("DELETE", `/api/platform/stores/${s.id}/payments/${p.id}`);

const browser = await chromium.launch();
try {
  const plan = (await call("POST", "/api/platform/plans", { name: `Pay Plan ${tag}`, limits: { maxUsers: 5, multiOutlet: true, maxOutlets: 3, maxTables: 20 }, entitlements: { features: ["takeaway", "dineInQr"] }, marketing: { monthly: 2499, yearlyDiscount: 20 } })).json.plan;
  madePlans.push(plan.id);
  for (const s of [A, B, C]) await call("PATCH", `/api/platform/stores/${s.id}/plan`, { planId: plan.id });

  const ctx = await browser.newContext({ viewport: { width: 1360, height: 1100 } });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !/Failed to load resource|React DevTools|favicon|WebSocket/.test(m.text())) problems.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
  page.on("dialog", (d) => d.accept());
  await page.goto(AD + "/", { waitUntil: "load" });
  await page.fill('input[type="email"]', "super@sandbox.test");
  await page.fill('input[type="password"]', "Super123!");
  await page.getByRole("button", { name: /sign in|log in/i }).first().click();
  await page.waitForSelector("aside a");
  const body = async () => norm(await page.locator("body").innerText());

  /** choose a day with OUR calendar: open the box, go back to that day's month, press the day, press OK */
  async function pickDate(testId, dayKey) {
    await page.getByTestId(testId).click();
    const cal = page.locator(".rasoipulse-datepicker");
    await cal.waitFor({ timeout: 5000 });
    const back = (Number(today.slice(0, 4)) - Number(dayKey.slice(0, 4))) * 12 + (Number(today.slice(5, 7)) - Number(dayKey.slice(5, 7)));
    for (let i = 0; i < back; i++) await page.getByRole("button", { name: "Previous month" }).click();
    await cal.locator("button:not([disabled])", { hasText: new RegExp(`^${Number(dayKey.slice(8))}$`) }).first().click();
    await page.getByRole("button", { name: "OK", exact: true }).click();
    await cal.waitFor({ state: "detached", timeout: 3000 });
  }
  const openStore = async (s) => {
    await page.goto(`${AD}/platform/stores/${s.id}`, { waitUntil: "load" });
    await page.getByRole("tab", { name: "Payments" }).click();
    await page.getByTestId("payments-standing").waitFor({ timeout: 15000 });
  };
  const rows = () => page.getByTestId("payment-row");
  const rowTexts = async () => (await rows().allInnerTexts()).map(norm);

  say("1. Before any payment: the dashboard says so, plainly");
  await page.goto(AD + "/platform", { waitUntil: "load" });
  const biz = page.getByTestId("business");
  await biz.waitFor({ timeout: 15000 });
  const b0 = (await call("GET", "/api/platform/business")).json;
  ok(norm(await biz.innerText()).includes("Rasoi Pulse business") && norm(await biz.innerText()).includes("not what the shops sell"), "the section is headed 'Rasoi Pulse business' and says it is what shops pay you, not what they sell");
  ok(b0.totals.payments === 0 && (await page.getByTestId("biz-total").innerText()).trim() === "₹0" && (await page.getByTestId("biz-new").innerText()).trim() === "0" && (await page.getByTestId("biz-renewals").innerText()).trim() === "0", "total sales ₹0, new sales 0, re-subscribed 0");
  ok(/No payments written down yet/.test(norm(await biz.innerText())) && /Payments/.test(norm(await biz.innerText())), "an empty-state explains how to start (open a store → Payments → write it down)");
  ok(/Across every store/.test(await body()) && /What the shops sell to their own customers/.test(await body()), "the stores' own sales are still on the page, further down, under their own heading");
  const followBefore = norm(await page.getByTestId("biz-followup").innerText());
  ok(followBefore.includes(A.name) && followBefore.includes("No payment written down"), "'Who to follow up' lists shops that have no payment written down", followBefore.slice(0, 120));

  say("2. A store's Payments tab: nothing yet");
  await openStore(A);
  ok(/No payment written down yet/.test(norm(await page.getByTestId("payments-standing").innerText())), "the store says it has no payment written down yet");
  ok((await rows().count()) === 0 && /Nothing written down yet/.test(await body()), "the list is empty, with a hint");
  ok(await page.getByTestId("payments-form").isVisible(), "the super admin sees the form");

  say("3. The form starts from the plan's price and checks itself");
  const amount = page.getByTestId("payment-amount"), months = page.getByTestId("payment-months"), submit = page.getByTestId("payment-submit"), will = page.getByTestId("payment-will-be");
  ok((await amount.inputValue()) === "2499", "one month: the amount box already holds the plan's monthly price (₹2,499)", await amount.inputValue());
  await months.fill("12");
  ok((await amount.inputValue()) === "23990", "12 months: it holds the yearly price with the plan's 20% off (₹23,990)", await amount.inputValue());
  await months.fill("3");
  ok((await amount.inputValue()) === "7497", "3 months: 3 × the monthly price", await amount.inputValue());
  await amount.fill("7000");
  await months.fill("6");
  ok((await amount.inputValue()) === "7000", "once someone types an amount it is not changed under them, even if the months change");
  const usePrice = page.getByTestId("payment-use-price");
  ok(await usePrice.isVisible() && /14,994/.test(norm(await usePrice.innerText())), "…and a button offers the plan's price for the months now chosen (6 × ₹2,499 = ₹14,994)", norm(await usePrice.innerText().catch(() => "")));
  await usePrice.click();
  ok((await amount.inputValue()) === "14994" && (await usePrice.count()) === 0, "pressing it puts the plan's price back, and the button goes away");
  await months.fill("1");
  await amount.fill("2499");
  ok((await usePrice.count()) === 0, "typing exactly the plan's price needs no button");
  await amount.fill("");
  ok(await submit.isDisabled() && /amount/i.test(norm(await will.innerText())), "no amount: the button is off and the line under the form says what to fix", norm(await will.innerText()));
  await amount.fill("2499");
  await months.fill("0");
  ok(await submit.isDisabled() && /Months/.test(norm(await will.innerText())), "0 months: the button is off and says months must be 1 to 60");
  await months.fill("1");
  ok(!(await submit.isDisabled()) && /NEW SALE/.test(await will.innerText()), "a good form says this will count as the NEW SALE (the store's first payment)", norm(await will.innerText()));

  say("4. The first payment is written down: it is the new sale");
  await page.getByTestId("payment-note").fill("Bank transfer ref 4471");
  await submit.click();
  await page.getByText("Payment written down.").waitFor({ timeout: 8000 });
  await rows().first().waitFor({ timeout: 8000 });
  let texts = await rowTexts();
  ok(texts.length === 1 && texts[0].includes("₹2,499") && /New sale/.test(texts[0]) && texts[0].includes("1 month") && texts[0].includes("Bank transfer ref 4471") && texts[0].includes(`written by ${meName}`), "one row: ₹2,499, 'New sale', 1 month, the note and who wrote it", texts[0]?.slice(0, 160));
  const standing = norm(await page.getByTestId("payments-standing").innerText());
  ok(/Paid until/.test(standing) && /days? left/.test(standing) && /1 payment/.test(standing) && standing.includes("₹2,499 in all"), "the store now says 'Paid until …' with the days left and the total", standing);
  ok((await call("GET", `/api/platform/stores/${A.id}/payments`)).json.payments[0].paidOn === today, "it was written for today by default");
  const first = (await call("GET", `/api/platform/stores/${A.id}/payments`)).json.payments[0];
  wrote.push([A.id, first.id]);

  say("5. A second payment: a re-subscription (written with the calendar, for an earlier day it would be the new sale)");
  await amount.fill("2499.5");
  ok(/RE-SUBSCRIPTION/.test(await will.innerText()), "the line under the form now says this will count as a RE-SUBSCRIPTION");
  await months.fill("1");
  await submit.click();
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="payment-row"]').length === 2, null, { timeout: 8000 });
  texts = await rowTexts();
  ok(texts[0].includes("₹2,499.5") && /Re-subscribed/.test(texts[0]) && /New sale/.test(texts[1]), "newest first: the new one is 'Re-subscribed' (₹2,499.50 — paise are shown), the first stays 'New sale'", `${texts[0].slice(0, 60)} | ${texts[1].slice(0, 40)}`);
  const second = (await call("GET", `/api/platform/stores/${A.id}/payments`)).json.payments[0];
  wrote.push([A.id, second.id]);
  ok(norm(await page.getByTestId("payments-total").innerText()).includes("₹4,998.5 in all"), "the total adds up (₹4,998.50)", norm(await page.getByTestId("payments-total").innerText()));

  say("6. Picking an earlier day with our calendar: the older payment becomes the new sale");
  const earlier = (() => { const d = new Date(`${today}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() - 1); d.setUTCDate(15); return d.toISOString().slice(0, 10); })();
  await pickDate("payment-date", earlier);
  await amount.fill("2000");
  ok(/NEW SALE/.test(await will.innerText()), "dated before the first payment, the line says it would become the NEW SALE");
  await submit.click();
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="payment-row"]').length === 3, null, { timeout: 8000 });
  texts = await rowTexts();
  ok(texts.filter((t) => /New sale/.test(t)).length === 1 && /New sale/.test(texts[2]) && texts[2].includes("₹2,000") && texts.filter((t) => /Re-subscribed/.test(t)).length === 2, "the ₹2,000 payment (oldest) is the one 'New sale'; the other two turned into 'Re-subscribed'", texts.map((t) => t.slice(0, 30)).join(" | "));
  wrote.push([A.id, (await call("GET", `/api/platform/stores/${A.id}/payments`)).json.payments.find((p) => p.amount === 2000).id]);

  say("7. A refused form says why; a wrong payment is deleted");
  const dup = (await call("GET", `/api/platform/stores/${A.id}/payments`)).json.payments.find((p) => p.amount === 2000);
  // (the form still holds the earlier day from the step before — the same store, day and amount again)
  await amount.fill("2000");
  await submit.click();
  await page.getByText(/already written down/).waitFor({ timeout: 8000 });
  ok((await rows().count()) === 3, "writing the same payment twice is refused with a sentence, and nothing is added");
  await page.getByTestId("payment-delete").nth(2).click(); // the oldest: ₹2,000
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="payment-row"]').length === 2, null, { timeout: 8000 });
  texts = await rowTexts();
  ok(texts.length === 2 && !texts.some((t) => t.includes("₹2,000")) && /New sale/.test(texts[1]), "after deleting it, the first ₹2,499 payment is the 'New sale' again", texts.map((t) => t.slice(0, 30)).join(" | "));
  wrote.splice(wrote.findIndex(([, id]) => id === dup.id), 1);

  say("8. A second store pays once");
  await openStore(B);
  await amount.fill("999");
  await months.fill("1");
  await submit.click();
  await rows().first().waitFor({ timeout: 8000 });
  wrote.push([B.id, (await call("GET", `/api/platform/stores/${B.id}/payments`)).json.payments[0].id]);
  ok(/New sale/.test(norm(await rows().first().innerText())), "store B's first payment is a 'New sale' too");

  say("8b. A third shop paid long ago (written through the API): 400, 120 and 45 days back — so Day, Week and Month hold different numbers");
  for (const [days, amt] of [[-400, 200], [-120, 300], [-45, 500]]) {
    const r = await call("POST", `/api/platform/stores/${C.id}/payments`, { amount: amt, paidOn: istDay(days), months: 1 });
    ok(r.status === 201, `the ₹${amt} payment from ${-days} days ago is written down`, String(r.status));
    wrote.push([C.id, r.json.payment?.id]);
  }

  say("9. The dashboard: total sales, new sales, re-subscribed");
  await page.goto(AD + "/platform", { waitUntil: "load" });
  await page.getByTestId("business").waitFor({ timeout: 15000 });
  const b = (await call("GET", "/api/platform/business")).json;
  const text = async (id) => norm(await page.getByTestId(id).innerText());
  ok(b.totals.sales === 6997.5 && b.newSales.shops === 3 && b.renewals.payments === 3 && b.renewals.shops === 2, "(the API agrees: 6,997.50 in all; 3 shops bought; 3 re-subscriptions from 2 shops)", JSON.stringify([b.totals.sales, b.newSales.shops, b.renewals.payments, b.renewals.shops]));
  ok((await text("biz-total")) === rupee(6997.5), "TOTAL SALES shows ₹6,997.50", await text("biz-total"));
  ok((await text("biz-new")) === "3" && /₹3,698/.test(norm(await biz.innerText())), "NEW SALES shows 3 shops (₹3,698)", await text("biz-new"));
  ok((await text("biz-renewals")) === "3" && /₹3,299\.5/.test(norm(await biz.innerText())) && /2 shops paid again/.test(norm(await biz.innerText())), "RE-SUBSCRIBED shows 3 payments (₹3,299.50) from 2 shops", await text("biz-renewals"));
  ok((await text("biz-active")) === "2" && (await text("biz-expired")) === "1", "2 shops are paid up now and 1 ran out (the one that paid 45 days ago for a month)", `${await text("biz-active")} / ${await text("biz-expired")}`);
  ok(/Ran out/.test(norm(await page.getByTestId("biz-followup").innerText())) && norm(await page.getByTestId("biz-followup").innerText()).includes(C.name), "'Who to follow up' names the shop that ran out", norm(await page.getByTestId("biz-followup").innerText()).slice(0, 120));
  const recent = norm(await page.getByTestId("biz-recent").innerText());
  ok(recent.includes(A.name) && recent.includes(B.name) && recent.includes(C.name) && /New sale/.test(recent) && /Re-subscribed/.test(recent), "'Latest payments' lists the shops with 'New sale' / 'Re-subscribed'", recent.slice(0, 140));
  const plans = norm(await page.getByTestId("biz-plans").innerText());
  ok(plans.includes(`Pay Plan ${tag}`) && plans.includes("₹6,997.5") && /2 shops paid up/.test(plans), "'By plan' shows the plan with 2 shops paid up and the money taken", plans.slice(0, 120));
  ok(!(await page.getByTestId("business").innerText()).includes("Orders this month"), "the business section holds nothing about the stores' orders");

  say("10. ONE chart that switches between Day, Week and Month");
  const chart = page.getByTestId("biz-chart");
  ok((await chart.getAttribute("data-unit")) === "month", "it opens on Month");
  const totalsByUnit = Object.fromEntries(["day", "week", "month"].map((u) => [u, b.series[u].total]));
  ok(new Set(Object.values(totalsByUnit)).size === 3 && b.series.day.previousTotal === 500 && b.series.week.previousTotal === 300 && b.series.month.previousTotal === 200, "the three charts hold DIFFERENT numbers (so the switch can be seen to work): day 5,997.50 vs 500 before; week 6,497.50 vs 300; month 6,797.50 vs 200", JSON.stringify(totalsByUnit));
  for (const unit of ["day", "week", "month"]) {
    await page.getByTestId(`biz-range-${unit}`).click();
    await page.waitForFunction((u) => document.querySelector('[data-testid="biz-chart"]')?.getAttribute("data-unit") === u, unit, { timeout: 5000 });
    const s = (await call("GET", "/api/platform/business")).json.series[unit];
    ok(Number(await chart.getAttribute("data-total")) === s.total && Number(await chart.getAttribute("data-previous-total")) === s.previousTotal, `${unit}: the chart shows this period ₹${s.total} against ₹${s.previousTotal} before (same as the API)`);
    const legend = norm(await page.locator(".viz-legend").first().innerText());
    ok(legend.includes(rupee(s.total)) && legend.includes(rupee(s.previousTotal)), `${unit}: the legend names both lines with their totals`, legend);
    ok((await page.getByTestId(`biz-range-${unit}`).getAttribute("aria-pressed")) === "true" && (await page.locator('[data-testid^="biz-range-"][aria-pressed="true"]').count()) === 1, `${unit}: only that button is pressed`);
    ok((await chart.locator("svg").count()) >= 1, `${unit}: the chart is drawn`);
  }
  await page.getByTestId("biz-range-day").click();
  await page.locator("figure", { has: page.getByTestId("biz-chart") }).getByRole("button", { name: "Table" }).click();
  const table = norm(await page.locator("figure", { has: page.locator("table") }).first().innerText());
  ok(/New/.test(table) && /Re-subscribed/.test(table) && table.includes(rupee(5997.5)) || table.includes("₹2,499.5"), "the table twin of the chart carries the same numbers, with the new / re-subscribed split", table.slice(0, 140));
  await page.locator("figure", { has: page.locator("table") }).first().getByRole("button", { name: "Chart" }).click();

  say("11. A team member who can only READ stores");
  const PW = "Reader2026Pass";
  const role = (await call("POST", "/api/platform/roles", { name: `Reader ${tag}`, features: ["stores:read"] })).json.role;
  const member = (await call("POST", "/api/platform/team", { name: "Rick Reader", email: `rick${tag}@rp.test`, password: PW, roleId: role.id })).json.member;
  const rctx = await browser.newContext({ viewport: { width: 1360, height: 1100 } });
  const rp = await rctx.newPage();
  rp.on("dialog", (d) => d.accept());
  await rp.goto(AD + "/", { waitUntil: "load" });
  await rp.fill('input[type="email"]', `rick${tag}@rp.test`);
  await rp.fill('input[type="password"]', PW);
  await rp.getByRole("button", { name: /sign in|log in/i }).first().click();
  await rp.waitForSelector("aside a", { timeout: 15000 });
  await rp.goto(`${AD}/platform/stores/${A.id}`, { waitUntil: "load" });
  await rp.getByRole("tab", { name: "Payments" }).click();
  await rp.getByTestId("payments-standing").waitFor({ timeout: 15000 });
  ok((await rp.getByTestId("payment-row").count()) === 2, "the reader sees the store's payments");
  ok((await rp.getByTestId("payments-form").count()) === 0 && (await rp.getByTestId("payment-delete").count()) === 0, "…but there is no form and no Delete button");
  ok(/can see payments but not write them/.test(norm(await rp.locator("body").innerText())), "…and a sentence says why");
  await rctx.close();
  await call("DELETE", `/api/platform/team/${member.id}`).catch(() => {});
  await call("DELETE", `/api/platform/roles/${role.id}`).catch(() => {});

  ok(problems.length === 0, "no errors in the browser console", problems.slice(0, 3).join(" | "));
} finally {
  // put it all back: payments deleted, stores on their own plans, the test plan archived
  for (const [sid, pid] of wrote) await call("DELETE", `/api/platform/stores/${sid}/payments/${pid}`).catch(() => {});
  for (const s of [A, B, C]) {
    for (const p of (await call("GET", `/api/platform/stores/${s.id}/payments`)).json.payments ?? []) await call("DELETE", `/api/platform/stores/${s.id}/payments/${p.id}`).catch(() => {});
    await call("PATCH", `/api/platform/stores/${s.id}/plan`, { planId: was[s.id].plan?.id ?? null, overrides: was[s.id].overrides ?? NOTHING }).catch(() => {});
  }
  for (const id of madePlans) await call("PATCH", `/api/platform/plans/${id}`, { archived: true }).catch(() => {});
  await browser.close();
}
console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
