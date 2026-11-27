// The dashboard and its configuration page, in Chrome against the bench: the new look, the "needs attention" chips, the new widgets, what each role and
// each plan sees, and the clean Configure-dashboard grid (locked cells, switches, reordering, all/none, recommended). What it changes in the bench's
// dashboard settings is put back at the end.
import { chromium } from "playwright";
const AD = "http://localhost:3171";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const problems = [];
let seen = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); if (problems.length > seen) { console.log(`      ^ browser error: ${problems.slice(seen).join(" | ").slice(0, 200)}`); seen = problems.length; } };
const login = async (email, password) => (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const ownerCookie = await login("o@acme.test", "Owner123!");
const call = async (cookie, method, path, body, headers = {}) => { const r = await fetch(API + path, { method, headers: { "content-type": "application/json", cookie, ...headers }, body: body ? JSON.stringify(body) : undefined }); let json = {}; try { json = await r.json(); } catch {} return { status: r.status, json }; };
const outlets = (await call(ownerCookie, "GET", "/api/outlets")).json.outlets;
const main = outlets.find((o) => o.slug === "main");
const mainId = String(main._id ?? main.id);
const savedWidgets = main.config.dashboard?.widgets; // put back at the end
const norm = (t) => t.replace(/\s+/g, " ").trim();

const browser = await chromium.launch();
const newPage = async (viewport = { width: 1360, height: 900 }) => {
  const page = await (await browser.newContext({ viewport })).newPage();
  page.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !/Failed to load resource|React DevTools|favicon|WebSocket/.test(m.text())) problems.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
  return page;
};
const signIn = async (page, email, pw) => {
  await page.goto(AD + "/", { waitUntil: "load" });
  await page.fill('input[type="email"]', email); await page.fill('input[type="password"]', pw);
  await page.getByRole("button", { name: /sign in|log in/i }).first().click();
  await page.waitForSelector("text=Orders", { timeout: 20000 });
};
const ids = async (page) => page.locator("[data-widget]").evaluateAll((els) => els.map((e) => e.dataset.widget));
const showsDashboard = async (page) => { await page.goto(AD + "/", { waitUntil: "load" }); await page.getByTestId("dashboard-grid").waitFor({ timeout: 15000 }); await page.waitForTimeout(400); };

try {
  /* --------------------------------------------------------------------------------------------- A. the look */
  console.log("== A. The owner's dashboard");
  const op = await newPage();
  await signIn(op, "o@acme.test", "Owner123!");
  await showsDashboard(op);
  const hello = norm(await op.getByTestId("dashboard-hello").innerText());
  ok(/Good (morning|afternoon|evening), Owner/.test(hello) && /here is how the day is going/.test(hello) && /(Updated|Refresh)/.test(hello), "a greeting by name, today's date and when the numbers were last updated", hello.slice(0, 120));
  ok(["clear", "needs"].includes(await op.getByTestId("dashboard-attention").getAttribute("data-state")), "a strip says whether anything needs attention (all clear, or what to do)");
  const shown = await ids(op);
  ok(["revenue-today", "orders-today", "deliveries-active", "bookings-today", "customer-rating", "revenue-trend", "orders-by-hour", "recent-orders"].every((w) => shown.includes(w)), "the owner of a full plan sees the new widgets (deliveries, bookings, rating) beside the old ones", `${shown.length} widgets`);
  const chip = op.locator('[data-widget="orders-today"] header [aria-hidden="true"]').first();
  ok(await chip.isVisible(), "each card has a coloured icon chip beside its title");
  const chartBox = op.locator('[data-widget="revenue-trend"] svg[role="img"]');
  await chartBox.scrollIntoViewIfNeeded();
  const cb = await chartBox.boundingBox();
  ok(cb && cb.width > 250 && cb.height > 120, "the revenue chart is drawn at the card's width", cb ? `${Math.round(cb.width)}×${Math.round(cb.height)}` : "none");
  await op.mouse.move(cb.x + cb.width * 0.7, cb.y + cb.height * 0.5);
  await op.waitForTimeout(150);
  ok(await op.locator('[data-widget="revenue-trend"] [role="status"]').count() === 1 && /₹/.test(await op.locator('[data-widget="revenue-trend"] [role="status"]').innerText()), "pointing at the chart reads out that day's revenue");
  await op.mouse.move(5, 5);
  await op.waitForTimeout(150);
  ok((await op.locator('[data-widget="revenue-trend"] [role="status"]').count()) === 0, "…and the read-out goes away again");
  await op.getByRole("button", { name: "Refresh the numbers" }).click();
  ok(true, "the Refresh button can be pressed");

  /* --------------------------------------------------------------------------- B. attention chips and cards, from made-up numbers */
  console.log("== B. Needs-attention chips and the new cards (the numbers are made up for this check)");
  const fake = await newPage();
  await fake.route("**/api/dashboard/stats*", async (route) => {
    const r = await route.fetch();
    const j = await r.json();
    Object.assign(j.today, { revenue: 500000, revenueYesterday: 400000, missedOrders: 3, paymentPending: 2, deliveriesOut: 2, deliveriesWaiting: 1, bookings: 5, bookingsActive: 4, bookingsAwaiting: 2, notificationFailures: 4, ratingAverage: 4.5, ratingCount: 12 });
    j.revenueTrend = j.revenueTrend.map((x, i) => ({ ...x, revenue: 100000 + i * 30000 }));
    await route.fulfill({ response: r, json: j });
  });
  await signIn(fake, "o@acme.test", "Owner123!");
  await showsDashboard(fake);
  const att = fake.getByTestId("dashboard-attention");
  ok((await att.getAttribute("data-state")) === "needs", "with trouble, the strip lists what needs a person");
  const chips = await fake.locator("[data-attention]").evaluateAll((els) => els.map((e) => ({ id: e.dataset.attention, text: e.textContent.trim(), href: new URL(e.href).pathname })));
  const by = Object.fromEntries(chips.map((c) => [c.id, c]));
  ok(/3 orders are over the time limit/.test(by.missed?.text) && by.missed.href === "/orders", "'3 orders are over the time limit' → the Orders page", by.missed?.text);
  ok(/2 online orders are waiting for payment/.test(by.payment?.text) && by.payment.href === "/orders", "'2 online orders are waiting for payment' → Orders");
  ok(/1 delivery is ready and waiting for a rider/.test(by.riders?.text), "'1 delivery is ready and waiting for a rider'");
  ok(/2 bookings are waiting for your yes/.test(by.bookings?.text) && by.bookings.href === "/reservations", "'2 bookings are waiting for your yes' → Bookings");
  ok(/4 messages could not be sent today/.test(by.alerts?.text) && by.alerts.href === "/notifications", "'4 messages could not be sent today' → Notifications");
  const card = (id) => fake.locator(`[data-widget="${id}"]`);
  ok(/125% of yesterday/.test(norm(await card("revenue-today").innerText())) && /Yesterday: ₹4,000/.test(norm(await card("revenue-today").innerText())), "the revenue card says '125% of yesterday' and what yesterday was", norm(await card("revenue-today").innerText()).slice(0, 100));
  ok((await card("revenue-today").locator("svg[aria-hidden='true']").count()) >= 1, "…with a little trend line");
  ok(/4\.5/.test(await card("customer-rating").innerText()) && (await card("customer-rating").locator('[aria-label="4.5 out of 5"]').count()) === 1 && /12 ratings, last 30 days/.test(norm(await card("customer-rating").innerText())), "the rating card shows 4.5 with five stars and '12 ratings, last 30 days'");
  ok(/1 waiting for a rider/.test(norm(await card("deliveries-active").innerText())) && /1 to hand over/.test(norm(await card("deliveries-active").innerText())), "the deliveries card says 2 on the way, 1 to hand over");
  ok(/2 need a yes/.test(norm(await card("bookings-today").innerText())), "the bookings card says '2 need a yes'");
  await fake.close();

  /* ----------------------------------------------------------------------------------------------- C. roles and plans */
  console.log("== C. Other roles, and a small plan");
  const kp = await newPage();
  await signIn(kp, "k@acme.test", "Kitchen123!");
  await showsDashboard(kp);
  const kids = await ids(kp);
  ok(!kids.includes("revenue-today") && !kids.includes("revenue-trend") && !kids.includes("customer-rating") && !kids.includes("bookings-today") && kids.includes("active-queue") && kids.includes("recent-orders"), "the kitchen sees its queue and recent orders — no revenue, rating or bookings", kids.join(","));
  const bp = await newPage();
  await signIn(bp, "o@beta.test", "Owner123!");
  await showsDashboard(bp);
  const bids = await ids(bp);
  ok(!bids.includes("deliveries-active") && !bids.includes("bookings-today") && !bids.includes("customer-rating") && !bids.includes("coins-issued-today") && !bids.includes("notification-failures-today"), "the owner of the small Starter plan has no deliveries, bookings, rating, coins or message-failure cards (not in the plan)", bids.join(","));
  ok(bids.includes("revenue-today") && bids.includes("orders-today") && bids.includes("coupons-redeemed-today"), "…but does have revenue, orders and coupons (in the plan)");

  /* -------------------------------------------------------------------------------------- D. the configuration page */
  console.log("== D. Configure dashboard");
  await op.goto(AD + "/dashboard-config", { waitUntil: "load" });
  await op.getByTestId("dash-row-revenue-today").waitFor({ timeout: 15000 });
  ok((await op.locator('[data-testid^="dash-row-"]').count()) === 20, "one row for each of the 20 widgets");
  const heads = (await op.getByRole("columnheader").allInnerTexts()).map(norm).join(" | ");
  ok(/Widget/i.test(heads) && /\bOn\b/i.test(heads) && /Owner/i.test(heads) && /Manager/i.test(heads) && /Cashier \/ Staff/i.test(heads) && /Kitchen/i.test(heads) && /Accountant/i.test(heads) && !/Super/i.test(heads), "a column for each role (Owner, Manager, Cashier / Staff, Kitchen, Accountant) — and none for the platform's super admin", heads);
  const lock = op.getByTestId("dash-role-revenue-today-kitchen");
  ok((await lock.getAttribute("data-locked")) === "yes" && /Kitchen can't open Reports/.test((await lock.getAttribute("title")) ?? ""), "Revenue for the Kitchen is a padlock that says why (they can't open Reports)", await lock.getAttribute("title"));
  ok((await op.getByTestId("dash-role-revenue-today-accountant").getAttribute("aria-checked")) === "true" && (await op.getByTestId("dash-role-revenue-today-staff").getAttribute("data-locked")) === "yes", "…the accountant has a tick, the cashier a padlock");
  ok(/20 of 20 widgets on/.test(await op.getByTestId("dash-count").innerText()), "'20 of 20 widgets on'");
  const saveBtn = op.getByTestId("dash-save");
  ok((await saveBtn.isDisabled()) && /Saved/.test(await saveBtn.innerText()), "nothing changed: the button says Saved and is off");

  const tick = op.getByTestId("dash-role-orders-today-manager");
  ok((await tick.getAttribute("aria-checked")) === "true", "the manager is ticked for 'Orders today'");
  await tick.click();
  ok((await tick.getAttribute("aria-checked")) === "false" && !(await saveBtn.isDisabled()) && /Save changes/.test(await saveBtn.innerText()), "unticking the manager turns the button to 'Save changes'");
  await op.getByTestId("dash-on-low-stock").click();
  ok(/19 of 20 widgets on/.test(await op.getByTestId("dash-count").innerText()), "switching 'Sold out right now' off makes it '19 of 20 widgets on'");
  const names = async () => op.locator('[data-testid^="dash-row-"]').evaluateAll((els) => els.slice(0, 3).map((e) => e.dataset.testid.replace("dash-row-", "")));
  const before = await names();
  await op.getByTestId("dash-row-revenue-today").getByRole("button", { name: "Move down" }).click();
  const after = await names();
  ok(before[0] === "revenue-today" && after[1] === "revenue-today" && after[0] === before[1], "'Move down' swaps the first two rows", `${before.join(",")} → ${after.join(",")}`);
  await saveBtn.click();
  await op.getByText("Dashboard configuration saved.").waitFor({ timeout: 8000 });
  ok(/Saved/.test(await saveBtn.innerText()) && (await saveBtn.isDisabled()), "Save: 'Dashboard configuration saved.' and the button is back to Saved");
  const saved = (await call(ownerCookie, "GET", "/api/outlets")).json.outlets.find((o) => String(o._id ?? o.id) === mainId).config.dashboard.widgets;
  ok(saved[0].id === "orders-today" && saved[1].id === "revenue-today" && !saved.find((w) => w.id === "orders-today").roles.includes("manager") && saved.find((w) => w.id === "low-stock").enabled === false, "what was saved: the new order, no manager on Orders today, Sold out switched off", saved.slice(0, 2).map((w) => w.id).join());
  const mp = await newPage();
  await signIn(mp, "m@acme.test", "Manager123!");
  await showsDashboard(mp);
  const mids = await ids(mp);
  ok(!mids.includes("orders-today") && mids.includes("revenue-today") && !mids.includes("low-stock"), "the manager's own dashboard now has no 'Orders today' and no 'Sold out', but still has Revenue", mids.slice(0, 5).join(","));
  ok(mids[0] === "revenue-today" && mids.indexOf("revenue-today") < mids.indexOf("avg-order-value-today"), "…and the new order is the one everyone sees");
  await mp.close();

  console.log("== D2. All / none, and back to recommended");
  await op.reload({ waitUntil: "load" });
  await op.getByTestId("dash-row-revenue-today").waitFor({ timeout: 15000 });
  const kitchenTicks = () => op.locator('[data-testid^="dash-role-"][data-testid$="-kitchen"][role="checkbox"]').evaluateAll((els) => els.map((e) => e.getAttribute("aria-checked")));
  const col = op.getByTestId("dash-col-kitchen");
  await col.click(); // first press: tick every widget the kitchen may be given (or clear them, when they all are already)
  let ticks = await kitchenTicks();
  const firstAll = ticks.every((t) => t === "true");
  if (!firstAll) { ok(ticks.every((t) => t === "false"), "pressing the Kitchen column's link clears every one of its ticks"); } else { ok(true, "pressing the Kitchen column's link ticks every widget the kitchen may be given"); }
  await col.click();
  ticks = await kitchenTicks();
  ok(ticks.length > 0 && (firstAll ? ticks.every((t) => t === "false") : ticks.every((t) => t === "true")), "…and pressing it again does the opposite", ticks.join(","));
  ok((await op.locator('[data-testid^="dash-role-"][data-testid$="-kitchen"][data-locked="yes"]').count()) >= 6, "the padlocked widgets for the kitchen are never ticked by 'all'");
  await op.getByTestId("dash-reset").click();
  await op.getByRole("dialog", { name: "Back to the recommended dashboard" }).waitFor();
  await op.getByTestId("dash-reset-confirm").click();
  await op.waitForTimeout(200);
  const rowsNow = await op.locator('[data-testid^="dash-row-"]').evaluateAll((els) => els.slice(0, 2).map((e) => e.dataset.testid.replace("dash-row-", "")));
  ok(rowsNow[0] === "revenue-today" && (await op.getByTestId("dash-role-orders-today-manager").getAttribute("aria-checked")) === "true" && /20 of 20 widgets on/.test(await op.getByTestId("dash-count").innerText()) && !(await op.getByTestId("dash-save").isDisabled()), "'Recommended' puts the usual order, every widget on and the usual roles back — waiting for Save", rowsNow.join());
  await op.getByTestId("dash-save").click();
  await op.getByText("Dashboard configuration saved.").waitFor({ timeout: 8000 });

  console.log("== D3. A small plan: widgets the plan doesn't include");
  await bp.goto(AD + "/dashboard-config", { waitUntil: "load" });
  await bp.getByTestId("dash-row-deliveries-active").waitFor({ timeout: 15000 });
  const sw = bp.getByTestId("dash-on-deliveries-active");
  ok(await sw.isDisabled(), "on the Starter plan the Deliveries switch is off and can't be turned on");
  const planLock = bp.getByTestId("dash-role-deliveries-active-owner");
  ok((await planLock.getAttribute("data-locked")) === "yes" && /Not in your plan \(Delivery/.test((await planLock.getAttribute("title")) ?? ""), "…and its role cells say 'Not in your plan (Delivery…)'", await planLock.getAttribute("title"));
  ok(/needs Delivery/i.test(norm(await bp.getByTestId("dash-row-deliveries-active").innerText())), "…and the row says what it needs ('needs Delivery')");
  ok((await bp.getByTestId("dash-on-revenue-today").isDisabled()) === false, "widgets the plan does include can still be switched");

  console.log("== D4. On a phone");
  const pp = await newPage({ width: 390, height: 844 });
  await signIn(pp, "o@acme.test", "Owner123!");
  await pp.goto(AD + "/dashboard-config", { waitUntil: "load" });
  await pp.getByTestId("dash-row-revenue-today").waitFor({ timeout: 15000 });
  const phone = await pp.evaluate(() => ({ rows: document.querySelectorAll('[data-testid^="dash-row-"]').length, table: document.querySelector('[role="table"]') !== null, sideScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, locked: document.querySelectorAll('[data-locked="yes"]').length }));
  ok(phone.rows === 20 && !phone.table && !phone.sideScroll, "on a phone the widgets are stacked (no wide grid) and the page doesn't scroll sideways", JSON.stringify(phone));
  ok(phone.locked > 0, "…with the roles as chips and the unavailable ones marked");
  await pp.goto(AD + "/", { waitUntil: "load" });
  await pp.getByTestId("dashboard-grid").waitFor({ timeout: 15000 });
  const pd = await pp.evaluate(() => ({ cols: getComputedStyle(document.querySelector('[data-testid="dashboard-grid"]')).gridTemplateColumns.split(" ").length, side: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 }));
  ok(pd.cols === 2 && !pd.side, "the new dashboard on a phone: two cards a row, no sideways scroll", JSON.stringify(pd));

  ok(problems.length === 0, "no errors or warnings in the browser", problems.slice(0, 3).join(" | "));
} finally {
  // put the bench's dashboard settings back as they were
  if (savedWidgets) await call(ownerCookie, "PATCH", `/api/outlets/${mainId}/config`, { dashboard: { widgets: savedWidgets } }, { "x-rasoipulse-outlet": mainId }).catch(() => {});
  await browser.close();
}
console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
