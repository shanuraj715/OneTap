// T20 — Missed-order alerts (Settings → "Missed-order alerts"): what happens to an order that nobody accepts, first with the alerts
// switched OFF, then ON — on the Orders screen, the dashboard, the sound, for each kind of delay, for each staff role, and for the customer.
// All in Chrome. The store is Acme Momos; limits are set to 1 minute so an order becomes "late" quickly. The server's own clock decides
// the dashboard's "Missed orders"; for the Orders screen the test moves THAT browser tab's clock forward (a skewed Date in the tab) so it
// doesn't have to sit through every minute — the order data itself is real.
import * as ui from "../bench/ui.mjs";
import { BENCH } from "../bench/watch.mjs";

export const meta = {
  id: "t20-missed-order-alerts",
  title: "Missed-order alerts — with the feature off nothing warns anyone; with it on: banner, red row, sound, repeat, per-status messages, roles, dashboard, customer",
  area: "orders",
  fresh: true,
  summary: "In Chrome. The owner of Acme Momos opens Settings → Missed-order alerts (on by default: accept within 2 minutes and finish cooking within 20 minutes; sound and reminders on), checks the limits (0 becomes 1, 241 is refused) and sets both limits to 1 minute, then switches the alerts OFF. A customer places order A and nobody touches it. After more than a minute the Orders screen shows the wait ('1m') but no banner, no red row, no 'Running late' count and no sound; the dashboard says 'In the queue 1' and 'Missed orders 0'; the order is still 'Placed' (nothing accepts or cancels it for them). The customer's screen is the same. The alerts are switched ON: the Orders screen shows a banner ('Order #A needs attention — hasn't been accepted for N minutes — the limit is 1'), a red row ('Placed Nm — over 1m limit'), 'Running late (1)', and the dashboard shows 'Missed orders 1'. The alert sound waits for a click, then chimes once; a second order B then arrives and, when it also goes late, the sound chimes again, and keeps reminding every minute while orders are still late. Dismissing the banner leaves the rows red and the count. As staff move A on, only two moments warn: an order nobody has accepted, and an order that has been Preparing longer than its limit (the timer starts when it reaches Preparing). Once A is Accepted, and again when it is Ready or Completed, nothing warns however long it sits. 'Play a sound' off and 'Keep reminding me' off are respected. The manager, cashier and kitchen see the same alerts. The customer sees nothing different and can still order.",
  expect: [
    "Settings → Missed-order alerts starts ticked with 2 / 20 minutes (accept / finish cooking), 'Play a sound' and 'Keep reminding me' ticked; there are no 'start cooking' or 'hand over' limits; typing 0 gives 1; 241 is refused with 'Validation failed' and not saved; 1 / 1 saves.",
    "Switched off, the limits, the sound and the reminder boxes disappear and stay off after a reload.",
    "ALERTS OFF, order unattended for over a minute: the Orders row shows 'Placed' with the wait '1m' in the normal colour; no banner, no red row, 'Running late' has no count and shows no order; dashboard 'In the queue 1', 'Missed orders 0'; no sound; the order is still Placed.",
    "ALERTS ON: banner 'Order #A needs attention' with '#A hasn't been accepted for N minutes — the limit is 1.'; the row is red with 'Placed Nm — over 1m limit'; 'Running late (1)'; 'Show late orders' lists only the late order; the dashboard says 'Missed orders 1'.",
    "The sound is waiting for a click ('Click anywhere once to allow the alert sound.'); after one click it says 'Sound on' and chimes once; when a second order goes late it chimes again; with 'Keep reminding me' it chimes again a minute later while they are still late.",
    "'Dismiss all warnings' removes the banner and the sound but the rows stay red and 'Running late (2)' stays; nothing chimes again.",
    "After A is Accepted the warning for it goes and does NOT come back, however long it sits Accepted; Preparing starts a fresh timer and after the limit 'has been cooking longer than expected'; Ready → no warning; Completed → no warning, no timer.",
    "'Play a sound' off: the banner shows but nothing chimes and it says the sound is off. 'Keep reminding me' off: one chime only, however long the order stays late.",
    "The manager, the cashier and the kitchen each see the banner and the red row for a late order.",
    "The customer's confirmation is identical with the alerts on or off; a late order is not cancelled or changed for them and they can keep ordering.",
  ],
  expectNot: [
    "With the alerts off, an unattended order must NOT show a banner, a red row, a count, or play a sound.",
    "An order must NOT be accepted, cancelled or changed automatically because it was missed.",
    "Dismissing a warning must NOT make the late order look normal again.",
    "'Keep reminding me' must NOT go silent while the order is still late.",
    "A new late order must NOT be missed because an earlier one was dismissed.",
    "'Play a sound' off must NOT chime.",
    "The customer must NOT see anything different, or a warning, because staff missed the order.",
    "The browser must NOT log JavaScript errors.",
  ],
};

const OWNER = ["o@acme.test", "Owner123!"];
const MANAGER = ["m@acme.test", "Manager123!"];
const CASHIER = ["s@acme.test", "Staff1234!"];
const KITCHEN = ["k@acme.test", "Kitchen123!"];
const MEERA = { name: "Meera Late", phone: "9877700077" };
const norm = (t) => t.replace(/\s+/g, " ").trim();

/** runs in the counter tab before the page loads: counts the alert chime's oscillators and lets the test move this tab's clock */
const COUNTER_TAB = () => {
  window.__osc = 0;
  const wrap = (C) => (C ? class extends C { createOscillator() { window.__osc++; return super.createOscillator(); } } : C);
  window.AudioContext = wrap(window.AudioContext);
  window.webkitAudioContext = wrap(window.webkitAudioContext);
  const Real = Date;
  let skew = 0;
  window.__skewSet = (ms) => { skew = ms; };
  class SkewDate extends Real {
    constructor(...a) { if (a.length === 0) super(Real.now() + skew); else super(...a); }
    static now() { return Real.now() + skew; }
  }
  window.Date = SkewDate;
};

export async function run(d, h) {
  const page = () => ui.text(d);
  const asOwner = async () => { await d.tab("dashboard", "Store dashboard · owner of Acme Momos"); await ui.signIn(d, OWNER); };
  let counterReady = false;
  const atCounter = async (who, label = "The counter · Orders screen") => {
    await d.tab("counter", label);
    if (!counterReady) { await d.page.addInitScript(COUNTER_TAB); counterReady = true; }
    await ui.signIn(d, who);
    await d.goto(`${BENCH.admin}/orders`, 1200);
    await d.page.locator("tr", { hasText: "#" }).first().waitFor({ timeout: 20000 });
  };
  const alertsTab = async () => { await d.click(d.page.getByRole("tab", { name: "Missed-order alerts" }), { after: 400 }); };
  const openAlertSettings = async () => { await d.goto(`${BENCH.admin}/settings`, 500); await alertsTab(); await d.page.getByText("Warn me about slow orders").first().waitFor({ timeout: 15000 }); };
  const save = async () => { await d.click(d.page.getByRole("button", { name: /^Save/ }).first(), { after: 1000 }); };
  const box = (cap) => d.page.getByRole("checkbox", { name: new RegExp(`^\\s*${cap}`) });
  const value = async (label) => (await ui.F(d, label)).inputValue();

  // the Orders screen
  const banner = () => d.page.getByRole("status").filter({ hasText: /attention/ });
  const bannerText = async () => ((await banner().count()) ? norm(await banner().first().innerText()) : "");
  const row = (no) => d.page.locator("tr", { hasText: `#${no}` }).first();
  const rowText = async (no) => norm(await row(no).innerText());
  const statusCell = async (no) => {
    const heads = (await d.page.locator("th").allInnerTexts()).map((t) => t.trim().toLowerCase());
    return norm(await row(no).locator("td").nth(heads.indexOf("status")).innerText());
  };
  const tinted = async (no) => !/^rgba\(0, 0, 0, 0\)$|^transparent$/.test(await row(no).evaluate((e) => getComputedStyle(e).backgroundColor));
  const chip = async () => norm(await d.page.getByRole("button", { name: /^Running late/ }).innerText());
  const setClock = async (ms) => { await d.page.evaluate((m) => window.__skewSet(m), ms); await d.page.waitForTimeout(1700); }; // the tab ticks once a second
  const chimes = async () => (await d.page.evaluate(() => window.__osc)) / 2;
  const clickPage = async () => { await d.click(d.page.getByRole("heading", { name: "Orders", exact: true }).first(), { after: 900 }); }; // a click on the title: it counts as the one touch browsers need before they allow sound
  const waitBanner = async (rx, ms = 8000) => ui.until(async () => rx.test(await bannerText()), ms);
  const advance = async (no, label) => {
    await d.click(row(no).getByRole("button", { name: label, exact: true }), { after: 400 });
    const dlg = d.page.getByRole("dialog", { name: "Confirm status change" });
    await dlg.waitFor({ timeout: 8000 });
    await d.press("Enter", 900);
    await dlg.waitFor({ state: "hidden", timeout: 8000 });
    await d.page.waitForTimeout(700);
  };
  const dashboard = async () => {
    await asOwner();
    await d.goto(`${BENCH.admin}/`, 800);
    let m;
    await ui.until(async () => (m = (await page()).match(/In the queue (\d+) Missed orders (\d+)/)) !== null, 15000);
    return m ? { queue: Number(m[1]), missed: Number(m[2]) } : null;
  };
  const customerOrder = async () => {
    await d.tab("customer", "Customer · Meera");
    const no = await ui.placeTakeaway(d, BENCH.storefront + "/main", [{ name: "Cold Coffee" }], MEERA);
    return { no, text: norm(await page()) };
  };

  // ----------------------------------------------------------------------------------------------------------------- 1
  await d.step("Settings → Missed-order alerts: the defaults and the limits");
  await asOwner();
  await openAlertSettings();
  d.check("the switch 'Warn me about slow orders' is ticked from the start", await box("Warn me about slow orders").isChecked());
  const defaults = [await value("Accept within (minutes)"), await value("Finish cooking within (minutes)")];
  d.check("the limits are 2 (accept) / 20 (finish cooking) minutes", defaults.join("/") === "2/20", defaults.join("/"));
  d.never("there is still a 'Start cooking within' or 'Hand over within' limit", (await d.page.getByText("Start cooking within").count()) + (await d.page.getByText("Hand over within").count()) > 0);
  d.check("'Play a sound' and 'Keep reminding me' are ticked", (await box("Play a sound").isChecked()) && (await box("Keep reminding me").isChecked()));
  await ui.fill(d, "Accept within (minutes)", "0");
  d.check("typing 0 minutes gives 1 (never 0)", (await value("Accept within (minutes)")) === "1", await value("Accept within (minutes)"));
  await ui.fill(d, "Accept within (minutes)", "241");
  await save();
  d.check("241 minutes is refused ('Validation failed')", /Validation failed/.test(await page()));
  d.finding("Missed-order alerts: a limit over 240 minutes is refused with only 'Validation failed' — it doesn't say which box or what the maximum is.");
  await d.page.reload({ waitUntil: "load" });
  await alertsTab();
  d.never("the refused value 241 was saved", (await value("Accept within (minutes)")) === "241");
  for (const label of ["Accept within (minutes)", "Finish cooking within (minutes)"]) await ui.fill(d, label, "1");
  await save();
  d.check("1 / 1 saves ('Settings saved.')", /Settings saved\./.test(await page()));
  await d.page.reload({ waitUntil: "load" });
  await alertsTab();
  d.check("after a reload both limits are 1", [await value("Accept within (minutes)"), await value("Finish cooking within (minutes)")].join("/") === "1/1");

  // ----------------------------------------------------------------------------------------------------------------- 2
  await d.step("Switch the alerts OFF");
  await ui.tick(d, "Warn me about slow orders", false);
  await save();
  await d.page.reload({ waitUntil: "load" });
  await alertsTab();
  d.never("the switch is still ticked after saving it off", await box("Warn me about slow orders").isChecked());
  d.check("with it off, the limits, the sound and the reminder boxes are hidden", (await d.page.getByText("Accept within (minutes)").count()) === 0 && (await box("Play a sound").count()) === 0 && (await box("Keep reminding me").count()) === 0);

  // ----------------------------------------------------------------------------------------------------------------- 3
  await d.step("A customer places order A and nobody accepts it (alerts OFF)");
  const a = await customerOrder();
  const placedA0 = Date.now(); // the order exists from here: the server needs a real minute to pass for the dashboard
  d.check("the customer sees 'Order #… placed' and the kitchen has it", new RegExp(`Order #${a.no} placed`).test(a.text) && /The kitchen has it/.test(a.text), a.text.slice(0, 200));
  await atCounter(OWNER);
  d.check("the counter's Orders screen has order A as 'Placed' with its wait running ('0m')", (await statusCell(a.no)) === "Placed" && /\b0m\b/.test(await rowText(a.no)), await rowText(a.no));
  d.never("a banner shows for a brand-new order", (await banner().count()) > 0);
  await d.page.waitForTimeout(Math.max(0, 63000 - (Date.now() - placedA0)));
  await d.page.reload({ waitUntil: "load" });
  await row(a.no).waitFor({ timeout: 20000 });
  await clickPage();
  const offRow = await rowText(a.no);
  d.check("over a minute later the status still says 'Placed' and the wait shows 1m or more", (await statusCell(a.no)) === "Placed" && /\b[1-9]\d*m\b/.test(offRow), offRow);
  d.never("a banner ('needs attention') is shown although the alerts are off", (await banner().count()) > 0, await bannerText());
  d.never("the late order's row is red although the alerts are off", await tinted(a.no));
  d.never("the status says 'over 1m limit'", /over \d+m limit/.test(offRow));
  d.check("'Running late' has no count and no order in it", (await chip()) === "Running late");
  await d.click(d.page.getByRole("button", { name: /^Running late/ }), { after: 600 });
  d.never("'Running late' lists the unattended order", (await d.page.locator("tr", { hasText: `#${a.no}` }).count()) > 0);
  await d.click(d.page.getByRole("button", { name: /^Running late/ }), { after: 400 });
  d.check("no chime has played", (await chimes()) === 0, String(await chimes()));
  await d.shot("off");
  const dashOff = await dashboard();
  d.check("the dashboard says 'In the queue 1' and 'Missed orders 0'", dashOff?.queue === 1 && dashOff?.missed === 0, JSON.stringify(dashOff));
  await atCounter(OWNER);
  d.check("after all that time the order is still just 'Placed' (not accepted, not cancelled by itself)", (await statusCell(a.no)) === "Placed" || /^Placed \d/.test(await statusCell(a.no)), await statusCell(a.no));
  d.finding("A missed order is never escalated: nobody is messaged and it is not cancelled — the only signs are the Orders screen alerts and the dashboard's 'Missed orders'.");
  const aCustomer = await (async () => { await d.tab("customer", "Customer · Meera"); await ui.visit(d, BENCH.storefront + "/main"); return norm(await page()); })();
  d.never("the customer's store page mentions the delay", /\b(delayed|sorry|taking longer|running late|missed)\b/i.test(aCustomer));

  // ----------------------------------------------------------------------------------------------------------------- 4
  await d.step("The alerts are switched ON (order A is still waiting)");
  await asOwner();
  await d.goto(`${BENCH.admin}/settings`, 500);
  await alertsTab();
  await ui.tick(d, "Warn me about slow orders", true);
  d.check("ticking it brings the limits back with the values saved earlier (1 / 1), sound and reminder ticked", [await value("Accept within (minutes)"), await value("Finish cooking within (minutes)")].join("/") === "1/1" && (await box("Play a sound").isChecked()) && (await box("Keep reminding me").isChecked()));
  await save();
  d.check("it saves", /Settings saved\./.test(await page()));

  // ----------------------------------------------------------------------------------------------------------------- 5
  await d.step("ALERTS ON: banner, red row, count, dashboard");
  await atCounter(OWNER);
  const on = await bannerText();
  d.check(`a banner names order A: 'Order #${a.no} needs attention'`, new RegExp(`Order #${a.no} needs attention`).test(on), on);
  const waitedBanner = on.match(new RegExp(`#${a.no} hasn't been accepted for (\\d+) minutes? — the limit is 1\\.`))?.[1];
  d.check("…with the reason and the limit: 'hasn't been accepted for N minute(s) — the limit is 1.' (N is however long it has really waited, at least 1)", Number(waitedBanner) >= 1, on);
  d.check("order A's row is red and its status says 'Placed Nm — over 1m limit' with the same N as the banner", (await tinted(a.no)) && (await statusCell(a.no)) === `Placed ${waitedBanner}m — over 1m limit`, `${await statusCell(a.no)} (banner said ${waitedBanner})`);
  d.check("'Running late (1)' counts it", (await chip()) === "Running late (1)", await chip());
  d.check("the wait is shown in red and bold", await row(a.no).evaluate((tr) => { const el = [...tr.querySelectorAll("span")].find((s) => /^\d+m$/.test(s.textContent.trim())); return Boolean(el) && Number(getComputedStyle(el).fontWeight) >= 700; }));
  await d.shot("on");
  await d.click(d.page.getByRole("button", { name: "Show late orders" }), { after: 700 });
  d.check("'Show late orders' lists the late order", (await d.page.locator("tr", { hasText: `#${a.no}` }).count()) === 1 && /Running late \(1\)/.test(await chip()));
  await d.click(d.page.getByRole("button", { name: /^Running late/ }), { after: 500 });
  d.check("clicking the filter again goes back to every order", (await d.page.locator("tr", { hasText: `#${a.no}` }).count()) === 1);
  const dashOn = await dashboard();
  d.check("the dashboard says 'In the queue 1' and 'Missed orders 1'", dashOn?.queue === 1 && dashOn?.missed === 1, JSON.stringify(dashOn));

  // ----------------------------------------------------------------------------------------------------------------- 6
  await d.step("The sound: waits for a click, chimes, chimes for a second late order, keeps reminding");
  await atCounter(OWNER);
  d.check("before anyone clicks: 'Click anywhere once to allow the alert sound.' and no chime", /Click anywhere once to allow the alert sound/.test(await bannerText()) && (await chimes()) === 0);
  await clickPage();
  d.check("after one click on the page: 'Sound on' and one chime", /Sound on/.test(await bannerText()) && (await chimes()) === 1, `${await chimes()} chimes`);
  const b = await customerOrder(); // a second order arrives while the warning for A is showing
  await d.tab("counter", "The counter · Orders screen");
  await row(b.no).waitFor({ timeout: 25000 });
  d.check("order B appears on the Orders screen by itself, and is not late yet (not red, banner still only about A)", !(await tinted(b.no)) && !/2 orders/.test(await bannerText()), await bannerText());
  d.check("its arrival doesn't chime (it isn't late)", (await chimes()) === 1, `${await chimes()} chimes`);
  await setClock(61_000);
  d.check("a minute on, order B is late too: '2 orders need attention … And 1 more.'", await waitBanner(/2 orders need attention/), await bannerText());
  d.check("…and the new late order chimes (2 chimes)", await ui.until(async () => (await chimes()) === 2, 6000), `${await chimes()} chimes`);
  await setClock(122_000);
  d.check("'Keep reminding me': a minute later it chimes again while both are still late (3 chimes)", await ui.until(async () => (await chimes()) === 3, 15000), `${await chimes()} chimes`);
  await setClock(183_000);
  d.check("…and another minute later again (4 chimes)", await ui.until(async () => (await chimes()) === 4, 15000), `${await chimes()} chimes`);
  d.check("both rows are red and 'Running late (2)'", (await tinted(a.no)) && (await tinted(b.no)) && (await chip()) === "Running late (2)", await chip());

  await d.step("Dismiss all warnings: the banner and the sound stop, the rows stay red");
  await d.click(d.page.getByRole("button", { name: "Dismiss all warnings" }), { after: 600 });
  d.check("the banner is gone", (await banner().count()) === 0);
  d.never("dismissing made a late order look normal again (rows no longer red)", !(await tinted(a.no)) || !(await tinted(b.no)));
  d.check("'Running late (2)' is still counted", (await chip()) === "Running late (2)", await chip());
  const quiet = await chimes();
  await setClock(300_000);
  d.never("a dismissed warning chimes again", (await chimes()) !== quiet, `${await chimes()} chimes (was ${quiet})`);
  d.never("a dismissed warning's banner comes back by itself", (await banner().count()) > 0);

  // ----------------------------------------------------------------------------------------------------------------- 7
  await d.step("Staff move A along: only 'not accepted' and 'cooking too long' warn — Accepted, Ready and Completed never do");
  await setClock(0);
  await ui.cancelOrder(d, b.no);
  d.check("cancelling the other late order (B) takes it out of the late list: 'Running late (1)'", (await statusCell(b.no)) === "Cancelled" && (await chip()) === "Running late (1)", `${await statusCell(b.no)} · ${await chip()}`);
  d.never("a cancelled order is still red", await tinted(b.no));
  await advance(a.no, "Accepted");
  d.check("accepted: order A is no longer red and its status says 'Accepted' (no 'over limit')", !(await tinted(a.no)) && (await statusCell(a.no)) === "Accepted", await statusCell(a.no));
  await setClock(61_000);
  await d.pause(1500);
  d.check("a minute later, still Accepted: NO warning (an accepted order is not the alert's business — only 'not accepted' and 'cooking too long' are)", (await banner().count()) === 0 && !(await tinted(a.no)) && !/over \d+m limit/.test(await statusCell(a.no)), `${await statusCell(a.no)} · banner ${await banner().count()}`);
  await setClock(0);
  await advance(a.no, "Preparing");
  d.check("preparing: no warning for A yet (a fresh timer starts now)", (await banner().count()) === 0 && !(await tinted(a.no)) && (await statusCell(a.no)) === "Preparing", await statusCell(a.no));
  await setClock(61_000);
  d.check("'#A has been cooking longer than expected for N minute(s) — the limit is 1.'", await waitBanner(new RegExp(`#${a.no} has been cooking longer than expected for \\d+ minutes?`)), await bannerText());
  d.check("A had been dismissed as 'not accepted' — it speaks up again because this is a different delay", /needs attention/.test(await bannerText()));
  d.check("order A is red: 'Preparing Nm — over 1m limit'", (await tinted(a.no)) && /^Preparing \d+m — over 1m limit$/.test(await statusCell(a.no)), await statusCell(a.no));
  await setClock(0);
  await advance(a.no, "Ready");
  await setClock(61_000);
  await d.pause(1500);
  d.check("ready: NO warning, however long it waits — the warning from cooking is gone and none replaces it", (await banner().count()) === 0 && !(await tinted(a.no)) && !/over \d+m limit/.test(await statusCell(a.no)), `${await statusCell(a.no)} · banner ${await banner().count()}`);
  await setClock(0);
  await advance(a.no, "Completed");
  await setClock(61_000);
  const done = await rowText(a.no);
  d.check("completed: order A has no timer and no warning", (await statusCell(a.no)) === "Completed" && !/over \d+m limit/.test(done) && !(await tinted(a.no)) && (await banner().count()) === 0, `${await statusCell(a.no)} · ${done}`);
  d.check("nothing is late any more: 'Running late' has no count", (await chip()) === "Running late", await chip());

  // ----------------------------------------------------------------------------------------------------------------- 8
  await d.step("'Keep reminding me' off, and 'Play a sound' off");
  const dd = await customerOrder();
  await asOwner();
  await d.goto(`${BENCH.admin}/settings`, 500);
  await alertsTab();
  await ui.tick(d, "Keep reminding me", false);
  await save();
  await atCounter(OWNER);
  await clickPage();
  await setClock(120_000);
  d.check("reminders off: the late order chimes once…", await ui.until(async () => (await chimes()) === 1, 8000), `${await chimes()} chimes`);
  await setClock(240_000);
  await setClock(360_000);
  d.never("…and chimes again although 'Keep reminding me' is off", (await chimes()) !== 1, `${await chimes()} chimes`);
  d.check("the banner is still there (the warning stays, only the repeating stops)", /needs attention/.test(await bannerText()));
  await asOwner();
  await d.goto(`${BENCH.admin}/settings`, 500);
  await alertsTab();
  await ui.tick(d, "Keep reminding me", true);
  await ui.tick(d, "Play a sound", false);
  await save();
  await atCounter(OWNER);
  await clickPage();
  await setClock(120_000);
  d.check("sound off: the banner still warns about the late order", await waitBanner(new RegExp(`Order #${dd.no} needs attention`)), await bannerText());
  d.never("a chime played although 'Play a sound' is off", (await chimes()) > 0, `${await chimes()} chimes`);
  d.check("the banner says the sound is off (not 'Sound on')", /Sound is off/.test(await bannerText()) && !/Sound on/.test(await bannerText()), await bannerText());
  await asOwner();
  await d.goto(`${BENCH.admin}/settings`, 500);
  await alertsTab();
  await ui.tick(d, "Play a sound", true);
  await save();

  // ----------------------------------------------------------------------------------------------------------------- 9
  await d.step("The manager, the cashier and the kitchen see the same alerts");
  for (const [who, name] of [[MANAGER, "manager"], [CASHIER, "cashier"], [KITCHEN, "kitchen"]]) {
    await atCounter(who, `The counter · ${name}`);
    await setClock(180_000);
    const text = await bannerText();
    d.check(`the ${name} sees the banner for the late order (#${dd.no})`, new RegExp(`#${dd.no} hasn't been accepted`).test(text), text);
    d.check(`…and order #${dd.no} is red there too`, await tinted(dd.no));
  }

  // ----------------------------------------------------------------------------------------------------------------- 10
  await d.step("The customer's side");
  const c = await customerOrder();
  const strip = (t, no) => t.replace(new RegExp(`#${no}`, "g"), "#N").replace(/about \d+ minutes/, "about N minutes"); // the quoted ready time depends on how busy the kitchen is
  d.check("a customer can still order while orders are late; their confirmation reads exactly like before the alerts were on", strip(c.text, c.no) === strip(a.text, a.no), `${strip(a.text, a.no)} || ${strip(c.text, c.no)}`);
  d.never("the customer's confirmation mentions a delay or a late order", /\b(delayed|sorry|taking longer|running late|missed)\b/i.test(c.text));
  d.finding("The customer has no way to see that their order is waiting or late — their confirmation never changes (see also T01: there is no order-tracking page).");
  await atCounter(OWNER);
  d.check("their new order simply appears on the Orders screen like any other", /Placed/.test(await rowText(c.no)));

  d.never("the browser logged JavaScript errors", d.problems.length > 0, d.problems.join(" | "));
}
