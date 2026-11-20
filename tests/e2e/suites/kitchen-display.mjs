// Kitchen Display System (/kitchen). API: orders reach the board once accepted, split by prep station (kitchen / bar);
// stations move new → preparing → ready independently; the order's status follows (preparing on the first Start, ready only
// when EVERY station is ready); recall; a finished order is off the board; plan gating. Browser: the /kitchen screen
// (lanes, station tabs, Start / Ready, waiting colours, sound switch) and the waiter's bell (off by default, on from Settings).
import { chromium } from "playwright";
const AD = "http://localhost:3171";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const problems = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 15000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await fn()) return true; } catch { /* retry */ } await sleep(250); } return false; };

const login = async (email, password) => (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const cookie = await login("o@acme.test", "Owner123!");
const outletsOf = async (ck) => { const j = await (await fetch(`${API}/api/outlets`, { headers: { cookie: ck } })).json(); return j.outlets ?? j; };
const main = (await outletsOf(cookie)).find((o) => o.slug === "main");
const outletId = String(main._id ?? main.id);
const configBefore = main.config.kitchenDisplay;
const callAs = (ck, oid) => async (method, path, body) => {
  const r = await fetch(API + path, { method, headers: { "content-type": "application/json", cookie: ck, "x-onetap-outlet": oid }, body: body ? JSON.stringify(body) : undefined });
  let json = {}; try { json = await r.json(); } catch {}
  return { status: r.status, json };
};
const call = callAs(cookie, outletId);
const patchConfig = (body) => call("PATCH", `/api/outlets/${outletId}/config`, body);
const made = { items: [], categories: [] };
const tables = (await call("GET", "/api/tables")).json.tables;
const tableId = (n) => tables.find((t) => t.number === n).id;
const voidAll = async () => { for (const s of (await call("GET", "/api/tables/sessions/active")).json.sessions ?? []) await call("POST", `/api/tables/sessions/${s.id}/void`, {}); };

// a bar category + dish, and a plain kitchen dish
const menu = await (await fetch(`${API}/api/menu?outletId=${outletId}`)).json();
const kitchenDish = menu.items.find((i) => i.isAvailable && (i.variants ?? []).length === 0 && !(i.modifierGroupIds ?? []).length && !i.stock?.enabled && !i.combo?.enabled && !i.prepStation);
const barCat = (await call("POST", "/api/menu/categories", { name: "KDS Drinks", prepStation: "bar" })).json.category;
made.categories.push(barCat.id);
const barDish = (await call("POST", "/api/menu/items", { categoryId: barCat.id, name: "KDS Cola", basePrice: 6000 })).json.item;
made.items.push(barDish.id);
const lines = (...pairs) => pairs.map(([id, q]) => ({ itemId: id, modifierOptionIds: [], quantity: q }));
const place = async (table, ls, phone = "9830000001") => (await call("POST", "/api/orders/staff", { tableId: tableId(table), cart: { lines: ls }, phone })).json.order;
const board = async (screen = "all", c = call) => (await c("GET", `/api/kitchen/orders?screen=${screen}`)).json;
const orderStatus = async (id) => ((await call("GET", "/api/orders?limit=200")).json.orders ?? []).find((o) => o.id === id)?.status;
const stage = (id, screen, st, c = call) => c("POST", `/api/kitchen/orders/${id}/stage`, { screen, stage: st });
const card = (b, id) => b.orders.find((o) => o.id === id);

try {
  await voidAll();
  console.log("== API: the board");
  ok(configBefore?.notifyWaiter === false, "the waiter's bell is OFF by default", JSON.stringify(configBefore));
  const o1 = await place("T2", lines([kitchenDish.id, 2], [barDish.id, 1]));
  ok(o1?.status === "accepted", "a staff order is accepted and goes to the kitchen", o1?.status);
  let all = await board("all");
  const c1 = card(all, o1.id);
  ok(c1 && c1.stage === "new" && c1.tableNumber === "T2" && c1.lines.length === 2, "the order is on the board as a NEW card with its table and both dishes", JSON.stringify(c1 && { stage: c1.stage, table: c1.tableNumber, n: c1.lines.length }));
  ok(c1.stations.map((s) => s.station).sort().join() === "bar,kitchen", "it needs two stations: kitchen and bar");
  const k = card(await board("kitchen"), o1.id), b = card(await board("bar"), o1.id);
  ok(k?.lines.length === 1 && k.lines[0].name === kitchenDish.name && k.lines[0].quantity === 2, "the Kitchen screen shows only the kitchen dish (and its quantity)");
  ok(b?.lines.length === 1 && b.lines[0].name === "KDS Cola", "the Bar screen shows only the bar dish");
  ok(all.settings.warnAfterMinutes === 10 && all.settings.lateAfterMinutes === 20, "waiting thresholds default to amber 10 / red 20 minutes");

  console.log("== API: stations move on their own; the order follows");
  let r = await stage(o1.id, "kitchen", "preparing");
  ok(r.status === 200 && await orderStatus(o1.id) === "preparing", "the kitchen taps Start → the order becomes 'preparing'");
  ok(card(await board("kitchen"), o1.id).stage === "preparing" && card(await board("bar"), o1.id).stage === "new" && card(await board("all"), o1.id).stage === "new", "kitchen shows Preparing, the bar still New, and 'All' shows the slowest (New)");
  r = await stage(o1.id, "bar", "ready");
  ok(r.status === 200 && await orderStatus(o1.id) === "preparing", "the bar finishes first — the order is NOT ready yet (the kitchen still cooks)");
  r = await stage(o1.id, "kitchen", "ready");
  ok(await orderStatus(o1.id) === "ready", "when the kitchen is ready too, the order becomes 'ready'");
  ok(card(await board("all"), o1.id).stage === "ready", "…and sits in the Ready lane");
  r = await stage(o1.id, "kitchen", "preparing");
  ok(await orderStatus(o1.id) === "preparing" && card(await board("kitchen"), o1.id).stage === "preparing", "Recall: the kitchen taking it back puts the order back to 'preparing'");
  r = await stage(o1.id, "all", "ready");
  ok(await orderStatus(o1.id) === "ready", "the 'All' screen's Ready marks every station at once");
  r = await stage(o1.id, "all", "ready");
  ok(r.status === 200, "pressing Ready twice is harmless");

  console.log("== API: rules");
  const o2 = await place("T3", lines([barDish.id, 1]), "9830000002");
  r = await stage(o2.id, "kitchen", "ready");
  ok(r.status === 409, "the kitchen can't mark an order that has nothing to make there", `${r.status} ${r.json.error ?? ""}`);
  ok(!card(await board("kitchen"), o2.id) && !!card(await board("bar"), o2.id), "such an order isn't on the Kitchen screen, only on the Bar's");
  r = await stage(o2.id, "bar", "bogus");
  ok(r.status === 400, "an unknown stage is refused");
  await call("PATCH", `/api/orders/${o1.id}/status`, { status: "completed" });
  ok(!card(await board("all"), o1.id), "a completed order leaves the board");
  r = await stage(o1.id, "all", "preparing");
  ok(r.status === 409, "a finished order can't be moved from the kitchen screen");
  await call("PATCH", `/api/orders/${o2.id}/status`, { status: "cancelled" });
  ok(!card(await board("all"), o2.id), "a cancelled order leaves the board too");
  const cashier = await login("s@acme.test", "Staff1234!");
  const kitchenUser = await login("k@acme.test", "Kitchen123!");
  ok((await board("all", callAs(kitchenUser, outletId))).orders !== undefined, "the kitchen role can open the board");
  const beta = await login("o@beta.test", "Owner123!");
  const betaOutlet = String((await outletsOf(beta))[0]._id ?? (await outletsOf(beta))[0].id);
  r = await callAs(beta, betaOutlet)("GET", "/api/kitchen/orders");
  ok(r.status === 403, "a store whose plan has no Kitchen display is refused (403)", `${r.status} ${r.json.error ?? ""}`);
  await voidAll();

  console.log("== Browser: the /kitchen screen");
  const browser = await chromium.launch();
  const ctxK = await browser.newContext({ viewport: { width: 1360, height: 860 } });
  const kp = await ctxK.newPage();
  kp.on("pageerror", (e) => problems.push(String(e).slice(0, 200)));
  const signIn = async (page, email, pw) => {
    await page.goto(AD + "/", { waitUntil: "load" });
    await page.fill('input[type="email"]', email); await page.fill('input[type="password"]', pw);
    await page.getByRole("button", { name: /sign in|log in/i }).first().click();
    await page.waitForSelector("text=Orders", { timeout: 15000 }).catch(() => {});
  };
  try {
    // Settings first: the bell switch is off, the owner can switch it on
    const ctxO = await browser.newContext({ viewport: { width: 1360, height: 860 } });
    const op = await ctxO.newPage();
    op.on("pageerror", (e) => problems.push(String(e).slice(0, 200)));
    await signIn(op, "o@acme.test", "Owner123!");
    await op.goto(AD + "/settings", { waitUntil: "load" });
    await op.getByRole("tab", { name: /Kitchen & delivery/ }).or(op.getByRole("button", { name: /Kitchen & delivery/ })).first().click();
    const sw = op.getByRole("checkbox", { name: /Tell the waiter when the kitchen marks something ready/ });
    await sw.waitFor({ timeout: 10000 });
    ok(!(await sw.isChecked()) && await op.getByTestId("settings-kitchen-display").isVisible(), "Settings → Kitchen & delivery → Kitchen display: the waiter's bell switch is off");
    await sw.check();
    await op.getByRole("button", { name: "Save changes" }).click();
    await op.getByRole("button", { name: "Saved" }).waitFor({ timeout: 10000 });
    ok((await outletsOf(cookie)).find((o) => o.slug === "main").config.kitchenDisplay.notifyWaiter === true, "ticking it and saving turns the bell on for the store");
    await call("PATCH", `/api/outlets/${outletId}/config`, { kitchenDisplay: { ...configBefore, notifyWaiter: false } }); // back to off for the "off" check
    await ctxO.close();

    await signIn(kp, "k@acme.test", "Kitchen123!");
    const oA = await place("T4", lines([kitchenDish.id, 1], [barDish.id, 2]), "9830000003");
    await kp.goto(AD + "/kitchen", { waitUntil: "load" });
    await kp.getByTestId("kitchen-screen").waitFor();
    const cardA = kp.locator('[data-testid="kitchen-card"]', { hasText: `#${oA.orderNumber}` });
    await cardA.waitFor({ timeout: 15000 });
    ok(await kp.getByTestId("lane-new").locator('[data-testid="kitchen-card"]', { hasText: `#${oA.orderNumber}` }).count() === 1, "the kitchen user sees the new order in the NEW lane, with its table");
    ok(/Table T4/.test(await cardA.innerText()) && /KDS Cola/.test(await cardA.innerText()) && (await cardA.getByText("Kitchen", { exact: true }).count()) + (await cardA.getByText("Bar", { exact: true }).count()) >= 2, "the card shows the table, both dishes and which station makes each");

    await kp.getByTestId("screen-bar").click();
    await until(async () => (await kp.locator('[data-testid="kitchen-card"]', { hasText: `#${oA.orderNumber}` }).innerText()).includes("KDS Cola") && !(await kp.locator('[data-testid="kitchen-card"]', { hasText: `#${oA.orderNumber}` }).innerText()).includes(kitchenDish.name), 8000);
    ok(/screen=bar/.test(kp.url()), "the Bar tab is in the address (/kitchen?screen=bar), so a bar tablet can open it directly");
    ok(!(await kp.locator('[data-testid="kitchen-card"]', { hasText: `#${oA.orderNumber}` }).innerText()).includes(kitchenDish.name), "the Bar screen shows only the bar dish");
    await kp.getByTestId("screen-all").click();
    await until(async () => (await kp.locator('[data-testid="kitchen-card"]', { hasText: `#${oA.orderNumber}` }).innerText()).includes(kitchenDish.name), 8000);

    // the waiter (cashier) on another screen: bell is OFF → nothing
    const ctxW = await browser.newContext({ viewport: { width: 1360, height: 860 } });
    const wp = await ctxW.newPage();
    wp.on("pageerror", (e) => problems.push(String(e).slice(0, 200)));
    await signIn(wp, "s@acme.test", "Staff1234!");
    await wp.goto(AD + "/orders", { waitUntil: "load" });
    await sleep(800);
    await kp.getByTestId("kitchen-start").first().waitFor();
    await kp.locator('[data-testid="kitchen-card"]', { hasText: `#${oA.orderNumber}` }).getByTestId("kitchen-start").click();
    ok(await until(async () => (await kp.getByTestId("lane-preparing").locator('[data-testid="kitchen-card"]', { hasText: `#${oA.orderNumber}` }).count()) === 1), "Start moves the card to PREPARING");
    ok(await until(async () => (await orderStatus(oA.id)) === "preparing"), "…and the order's status is 'preparing'");
    await kp.getByTestId("lane-preparing").locator('[data-testid="kitchen-card"]', { hasText: `#${oA.orderNumber}` }).getByTestId("kitchen-ready").click();
    ok(await until(async () => (await kp.getByTestId("lane-ready").locator('[data-testid="kitchen-card"]', { hasText: `#${oA.orderNumber}` }).count()) === 1), "Ready moves the card to the READY lane");
    await sleep(2500);
    ok(await wp.getByTestId("kitchen-bell-card").count() === 0, "with the bell OFF the waiter's screen shows nothing when the kitchen is ready");
    await kp.getByTestId("lane-ready").locator('[data-testid="kitchen-card"]', { hasText: `#${oA.orderNumber}` }).getByTestId("kitchen-recall").click();
    ok(await until(async () => (await kp.getByTestId("lane-preparing").locator('[data-testid="kitchen-card"]', { hasText: `#${oA.orderNumber}` }).count()) === 1), "Recall brings it back to PREPARING");

    // bell ON → waiter gets it, on whichever page they are
    await call("PATCH", `/api/outlets/${outletId}/config`, { kitchenDisplay: { ...configBefore, notifyWaiter: true } });
    await wp.reload({ waitUntil: "load" });
    await wp.getByRole("link", { name: /Orders/ }).first().waitFor();
    await sleep(1200);
    await kp.getByTestId("lane-preparing").locator('[data-testid="kitchen-card"]', { hasText: `#${oA.orderNumber}` }).getByTestId("kitchen-ready").click();
    const bell = wp.getByTestId("kitchen-bell-card");
    await bell.first().waitFor({ timeout: 10000 });
    const bellText = await bell.first().innerText();
    ok(/Table T4/.test(bellText) && new RegExp(`#${oA.orderNumber}`).test(bellText) && /ready/i.test(bellText), "bell ON: the waiter's screen shows 'Table T4 — Order #… Everything is ready'", bellText.replace(/\s+/g, " "));
    await wp.screenshot({ path: "kitchen-bell.png" });
    await wp.getByTestId("kitchen-bell-card").first().getByRole("button", { name: "Dismiss" }).click();
    ok(await wp.getByTestId("kitchen-bell-card").count() === 0, "the waiter can dismiss it");
    await ctxW.close();
    await call("PATCH", `/api/outlets/${outletId}/config`, { kitchenDisplay: configBefore });
    await call("PATCH", `/api/orders/${oA.id}/status`, { status: "completed" });

    // sound switch
    const snd = kp.getByTestId("kitchen-sound");
    ok(await snd.getAttribute("aria-pressed") === "true", "the new-order sound is on by default");
    await snd.click();
    await kp.reload({ waitUntil: "load" });
    ok(await kp.getByTestId("kitchen-sound").getAttribute("aria-pressed") === "false", "switching it off is remembered on this device after a reload");
    await kp.getByTestId("kitchen-sound").click();

    console.log("== Browser: late orders turn amber, then red");
    await patchConfig({ kitchenDisplay: { ...configBefore, warnAfterMinutes: 1, lateAfterMinutes: 2 } });
    const oB = await place("T5", lines([kitchenDish.id, 1]), "9830000004");
    const lp = await (await browser.newContext({ viewport: { width: 1360, height: 860 } })).newPage();
    await lp.clock.install({ time: new Date() });
    await signIn(lp, "o@acme.test", "Owner123!");
    await lp.goto(AD + "/kitchen", { waitUntil: "load" });
    const cardB = lp.locator('[data-testid="kitchen-card"]', { hasText: `#${oB.orderNumber}` });
    await cardB.waitFor({ timeout: 15000 });
    ok(await cardB.getAttribute("data-tone") === "ok", "a fresh order is neutral (not amber, not red)");
    await lp.clock.fastForward("01:20");
    ok(await until(async () => (await cardB.getAttribute("data-tone")) === "warn", 6000), "after the amber time it turns amber");
    await lp.clock.fastForward("01:00");
    ok(await until(async () => (await cardB.getAttribute("data-tone")) === "late", 6000), "after the red time it turns red");
    ok(/\d+ min/.test(await cardB.getByTestId("kitchen-wait").innerText()), "its waiting time is shown in minutes", await cardB.getByTestId("kitchen-wait").innerText());
    await lp.screenshot({ path: "kitchen-late.png" });
    await call("PATCH", `/api/orders/${oB.id}/status`, { status: "cancelled" });
  } finally {
    await browser.close();
  }
} finally {
  await voidAll();
  await patchConfig({ kitchenDisplay: configBefore });
  for (const id of made.items) await call("DELETE", `/api/menu/items/${id}`);
  for (const id of made.categories) await call("DELETE", `/api/menu/categories/${id}`);
}
ok(problems.length === 0, "no errors in the browser", problems.slice(0, 3).join(" | "));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
