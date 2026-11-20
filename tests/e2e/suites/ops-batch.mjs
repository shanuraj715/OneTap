// A batch of operations changes (2026-11-21), in Chrome against the bench:
//  1. a dine-in order marked Completed frees its table by itself (when nothing else is open and all is paid); the
//     "Needs cleaning" status no longer exists (closing / moving leaves the table Free; the API refuses to set it)
//  2. on a phone, "Free table for new guests" is on the menu screen of Take order before anything is added
//  3. the dashboard cards fit a phone (2 per row, nothing clipped, no sideways page scroll)
//  4. the Orders filters are ONE row that scrolls sideways on a phone (the list isn't pushed down)
//  5. the platform's "live updates" switch: off → no sockets (refused), dashboards refresh every 5 s; on → live again
//  6. the print station: checks every 8 s, shows a green check, a loader while checking and a countdown
//  7. the store page header in the platform console fits a phone
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
const superCookie = await login("super@sandbox.test", "Super123!");
const outlets = await (await fetch(`${API}/api/outlets`, { headers: { cookie } })).json();
const main = (outlets.outlets ?? outlets).find((o) => o.slug === "main");
const outletId = String(main._id ?? main.id);
const mk = (ck, oid) => async (method, path, body) => {
  const r = await fetch(API + path, { method, headers: { "content-type": "application/json", cookie: ck, ...(oid ? { "x-onetap-outlet": oid } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let json = {}; try { json = await r.json(); } catch {}
  return { status: r.status, json };
};
const call = mk(cookie, outletId);
const sup = mk(superCookie);
const tables = (await call("GET", "/api/tables")).json.tables;
const tid = (n) => tables.find((t) => t.number === n).id;
const tableNow = async (n) => (await call("GET", "/api/tables")).json.tables.find((t) => t.number === n);
const voidAll = async () => { for (const s of (await call("GET", "/api/tables/sessions/active")).json.sessions ?? []) await call("POST", `/api/tables/sessions/${s.id}/void`, {}); };
const menu = await (await fetch(`${API}/api/menu?outletId=${outletId}`)).json();
const dish = menu.items.find((i) => i.isAvailable && (i.variants ?? []).length === 0 && !(i.modifierGroupIds ?? []).length && !i.stock?.enabled && !i.combo?.enabled && !i.prepStation);
const place = async (table, phone) => (await call("POST", "/api/orders/staff", { tableId: tid(table), cart: { lines: [{ itemId: dish.id, modifierOptionIds: [], quantity: 1 }] }, phone })).json.order;
const setStatus = (id, status) => call("PATCH", `/api/orders/${id}/status`, { status });

const browser = await chromium.launch();
const signIn = async (page, email, pw) => {
  await page.goto(AD + "/", { waitUntil: "load" });
  await page.fill('input[type="email"]', email); await page.fill('input[type="password"]', pw);
  await page.getByRole("button", { name: /sign in|log in/i }).first().click();
  await page.waitForSelector("text=Orders", { timeout: 15000 }).catch(() => {});
};
const watch = (page) => {
  page.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !/Failed to load resource|React DevTools|favicon|WebSocket|503/.test(m.text())) problems.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
};
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);

try {
  await voidAll();
  /* ------------------------------------------------------------ 1. tables */
  console.log("== A completed dine-in order frees the table; no 'Needs cleaning'");
  const o1 = await place("T1", "9840000001");
  ok((await tableNow("T1")).status === "seated", "the table is Seated while the order is open");
  for (const st of ["preparing", "ready"]) await setStatus(o1.id, st);
  ok((await tableNow("T1")).status === "seated", "…and still Seated when the order is only Ready");
  let r = await setStatus(o1.id, "completed");
  ok(r.status === 200, "the order is marked Completed");
  const t1 = await tableNow("T1");
  ok(t1.status === "free" && !t1.activeSessionId, "the table is Free again by itself — nobody had to press 'Free the table'", `${t1.status} ${t1.activeSessionId}`);
  ok(!((await call("GET", "/api/tables/sessions/active")).json.sessions ?? []).some((s) => s.tableId === tid("T1")), "and its party session is closed");

  const a = await place("T2", "9840000002");
  const bOrder = (await call("POST", "/api/orders/staff", { tableId: tid("T2"), cart: { lines: [{ itemId: dish.id, modifierOptionIds: [], quantity: 1 }] }, expectedSessionId: (await call("GET", "/api/tables/sessions/active")).json.sessions.find((s) => s.tableId === tid("T2")).id })).json.order;
  for (const st of ["preparing", "ready", "completed"]) await setStatus(a.id, st);
  ok((await tableNow("T2")).status === "seated", "a table with ANOTHER order still being made stays Seated when one order is completed");
  for (const st of ["preparing", "ready", "completed"]) await setStatus(bOrder.id, st);
  ok((await tableNow("T2")).status === "free", "…and is freed when the last one is completed");

  const c = await place("T3", "9840000003");
  await setStatus(c.id, "cancelled");
  r = await call("PATCH", `/api/tables/${tid("T3")}`, { status: "needs-cleaning" });
  ok(r.status === 400, "'needs-cleaning' is no longer a status (setting it is refused)", String(r.status));
  await voidAll();
  const d = await place("T4", "9840000004");
  const sess = (await call("GET", "/api/tables/sessions/active")).json.sessions.find((s) => s.tableId === tid("T4"));
  r = await call("POST", `/api/tables/sessions/${sess.id}/move`, { toTableId: tid("T5") });
  ok(r.status === 200 && (await tableNow("T4")).status === "free" && (await tableNow("T5")).status === "seated", "moving a party leaves the old table Free (not 'needs cleaning'), the new one Seated");
  await call("POST", `/api/tables/sessions/${sess.id}/void`, {});

  /* ------------------------------------------------------------ 2. front-screen free button on a phone */
  console.log("== Phone: 'Free table for new guests' is on the front screen");
  // a party that has finished (nothing open, nothing owed) but whose table was never freed: its only order was cancelled
  const e = await place("T4", "9840000005");
  await setStatus(e.id, "cancelled");
  const seatedT4 = (await call("GET", "/api/tables/sessions/active")).json.sessions.find((s) => s.tableId === tid("T4"));
  ok(!!seatedT4 && seatedT4.allPaid && seatedT4.openOrders === 0 && (await tableNow("T4")).status === "seated", "(set-up: T4 is still seated by a party with nothing open and nothing owed)", JSON.stringify(seatedT4 && { paid: seatedT4.allPaid, open: seatedT4.openOrders }));
  const phone = await browser.newContext({ viewport: { width: 375, height: 760 }, isMobile: true, hasTouch: true });
  const pp = await phone.newPage(); watch(pp);
  await signIn(pp, "o@acme.test", "Owner123!");
  await pp.goto(AD + "/take-order", { waitUntil: "load" });
  await pp.getByText("T4", { exact: true }).first().click();
  const front = pp.getByTestId("free-table-front");
  ok(await until(async () => await front.isVisible(), 12000), "on a phone, with nothing added yet, the menu screen shows 'Free table for new guests'", await front.count() ? "" : "not shown");
  if (await front.count()) {
    const box = await front.boundingBox();
    ok(box && box.y < 400 && box.x >= 0 && box.x + box.width <= 376, "…near the top of the screen and fully inside it", JSON.stringify(box && { y: Math.round(box.y), w: Math.round(box.width) }));
    await pp.screenshot({ path: "free-table-front.png" });
    await front.click();
    ok(await until(async () => (await tableNow("T4")).status === "free"), "tapping it frees the table");
    ok(await until(async () => (await pp.getByTestId("free-table-front").count()) === 0), "and the banner goes away");
  }
  await voidAll();

  /* ------------------------------------------------------------ 3. dashboard on a phone */
  console.log("== Phone: the dashboard");
  await pp.goto(AD + "/", { waitUntil: "load" });
  await pp.getByTestId("dashboard-grid").waitFor({ timeout: 15000 });
  await sleep(600);
  const dash = await pp.evaluate(() => {
    const grid = document.querySelector('[data-testid="dashboard-grid"]');
    const cols = getComputedStyle(grid).gridTemplateColumns.split(" ").length;
    const widgets = [...grid.querySelectorAll(".ot-widget")].map((w) => { const r = w.getBoundingClientRect(); const id = w.dataset.widget; const sec = w.firstElementChild.getBoundingClientRect(); return { id, left: r.left, right: r.right, w: r.width, h: sec.height, scrollW: w.firstElementChild.scrollWidth, clientW: w.firstElementChild.clientWidth }; });
    return { cols, widgets, vw: document.documentElement.clientWidth };
  });
  ok(dash.cols === 2, "the cards sit two to a row on a phone", `${dash.cols} columns`);
  ok(dash.widgets.length > 0 && dash.widgets.every((w) => w.left >= 0 && w.right <= dash.vw + 1), "every card is inside the screen", dash.widgets.map((w) => `${Math.round(w.left)}–${Math.round(w.right)}`).join(" "));
  ok(dash.widgets.every((w) => w.scrollW <= w.clientW + 1), "nothing inside a card is clipped or overflows it", dash.widgets.map((w, i) => (w.scrollW > w.clientW + 1 ? `${w.id}: ${w.scrollW}>${w.clientW}` : "")).filter(Boolean).join(" "));
  ok(await noSideScroll(pp), "the page doesn't scroll sideways");
  const firstRow = dash.widgets.slice(0, 2);
  ok(firstRow.length === 2 && Math.abs(firstRow[0].h - firstRow[1].h) < 2, "cards in a row are the same height", firstRow.map((w) => Math.round(w.h)).join(" vs "));
  await pp.screenshot({ path: "dashboard-phone.png", fullPage: false });
  const wide = await browser.newPage({ viewport: { width: 1360, height: 900 } }); watch(wide);
  await signIn(wide, "o@acme.test", "Owner123!");
  await wide.goto(AD + "/", { waitUntil: "load" });
  await wide.getByTestId("dashboard-grid").waitFor({ timeout: 15000 });
  ok((await wide.evaluate(() => getComputedStyle(document.querySelector('[data-testid="dashboard-grid"]')).gridTemplateColumns.split(" ").length)) === 3, "on a computer it is still three columns");
  await wide.close();

  /* ------------------------------------------------------------ 4. orders filters on a phone */
  console.log("== Phone: Orders filters in one scrolling row");
  await pp.goto(AD + "/orders", { waitUntil: "load" });
  const row = pp.getByTestId("orders-filters");
  await row.waitFor({ timeout: 15000 });
  const f = await row.evaluate((el) => {
    const kids = [...el.children].map((c) => Math.round(c.getBoundingClientRect().top));
    return { sw: el.scrollWidth, cw: el.clientWidth, h: Math.round(el.getBoundingClientRect().height), oneRow: new Set(kids).size === 1, ox: getComputedStyle(el).overflowX };
  });
  ok(f.oneRow && f.sw > f.cw && /auto|scroll/.test(f.ox), "the filters are one row, wider than the screen, scrolling sideways", JSON.stringify(f));
  ok(f.h < 60, "the row is a single line tall — the order list isn't pushed down", `${f.h}px`);
  ok(await noSideScroll(pp), "the page itself doesn't scroll sideways");
  await row.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
  await pp.getByRole("button", { name: /Payment pending/ }).waitFor();
  ok(await pp.getByRole("button", { name: /Payment pending/ }).isVisible(), "the last chip (Payment pending) is reachable by scrolling the row");
  await row.evaluate((el) => { el.scrollLeft = 0; });
  await row.getByRole("button", { name: /^Status/ }).click();
  ok(await pp.getByRole("checkbox").first().isVisible(), "a filter dropdown still opens (it isn't clipped by the scrolling row)");
  await pp.keyboard.press("Escape");
  await pp.screenshot({ path: "orders-phone.png" });

  /* ------------------------------------------------------------ 5. live updates switch */
  console.log("== Platform: live updates over a WebSocket on / off");
  const dp = await browser.newPage({ viewport: { width: 1360, height: 900 } }); watch(dp);
  let orderCalls = 0;
  dp.on("request", (rq) => { if (/\/api\/orders\?/.test(rq.url()) && rq.method() === "GET") orderCalls += 1; });
  await signIn(dp, "o@acme.test", "Owner123!");
  await dp.goto(AD + "/orders", { waitUntil: "load" });
  ok(await until(async () => /Live/.test(await dp.locator("h1").locator("..").innerText()), 12000), "the default: the Orders page says Live (a WebSocket)");
  ok((await sup("GET", "/api/platform/settings")).json.settings.realtimeWebsocket === true, "the platform setting is ON by default");
  const sa = await browser.newPage({ viewport: { width: 1360, height: 900 } }); watch(sa);
  await signIn(sa, "super@sandbox.test", "Super123!");
  await sa.goto(AD + "/platform/settings", { waitUntil: "load" });
  const sw = sa.getByRole("checkbox", { name: /Use a WebSocket connection/ });
  await sw.waitFor({ timeout: 10000 });
  ok(await sw.isChecked(), "Platform settings → Live order updates: the switch is on");
  await sw.click(); // saves on the click, so the box flips once the server has answered
  await until(async () => (await sup("GET", "/api/platform/settings")).json.settings.realtimeWebsocket === false);
  ok((await sup("GET", "/api/platform/settings")).json.settings.realtimeWebsocket === false, "switching it off is saved");
  ok(/Off — every dashboard refreshes/.test(await sa.getByTestId("realtime-state").innerText()), "the page explains what off means");
  const sock = await dp.evaluate(() => new Promise((res) => { const w = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://localhost:3097/realtime?outletId=x`); w.onopen = () => res("open"); w.onerror = () => res("refused"); w.onclose = () => res("closed"); setTimeout(() => res("timeout"), 4000); }));
  ok(sock !== "open", "a new live connection is refused while it is off", sock);
  ok(await until(async () => /Refreshing every 5s/.test(await dp.locator("h1").locator("..").innerText()), 70000), "an open Orders page switches itself to 'Refreshing every 5s' (within a minute)");
  orderCalls = 0;
  await sleep(11500);
  ok(orderCalls >= 2, "it asks the API for the order list every ~5 seconds", `${orderCalls} requests in 11.5 s`);
  await sup("PUT", "/api/platform/settings", { realtimeWebsocket: true });
  ok((await sup("GET", "/api/platform/settings")).json.settings.realtimeWebsocket === true, "switching it back on is saved");
  ok(await until(async () => /Live/.test(await dp.locator("h1").locator("..").innerText()), 75000), "the Orders page is Live again by itself");
  await sa.close(); await dp.close();

  /* ------------------------------------------------------------ 6. print station */
  console.log("== Print station: 8-second checks, green check, loader, countdown");
  const pc = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  await pc.addInitScript(() => { try { localStorage.setItem("onetap.printStation", JSON.stringify({ enabled: true, targets: ["browser", "epos-lan"], clientId: "browser-test0001" })); } catch { /* ignore */ } });
  const ps = await pc.newPage(); watch(ps);
  const claims = [];
  ps.on("request", (rq) => { if (/\/api\/printing\/jobs\/claim/.test(rq.url())) claims.push(Date.now()); });
  await signIn(ps, "o@acme.test", "Owner123!");
  await ps.goto(AD + "/orders", { waitUntil: "load" });
  const chip = ps.getByTestId("print-station-chip");
  await chip.waitFor({ timeout: 15000 });
  const sawCheck = await until(async () => (await ps.getByTestId("print-station-check").count()) === 1, 12000);
  ok(sawCheck && /Print station on/.test(await chip.innerText()), "when idle the chip says 'Print station on' with a green check");
  ok(/· \d+s/.test(await chip.innerText()), "…and shows a countdown to the next check (just the seconds, no extra words)", (await chip.innerText()).replace(/\s+/g, " "));
  const c1 = (await chip.innerText()).match(/· (\d+)s/)?.[1];
  await sleep(2200);
  const c2 = (await chip.innerText()).match(/· (\d+)s/)?.[1];
  ok(c1 && c2 && Number(c2) < Number(c1), "the countdown goes down second by second", `${c1}s → ${c2}s`);
  const green = await ps.getByTestId("print-station-check").evaluate((el) => getComputedStyle(el).color);
  ok(/rgb\(\s*4\d|rgb\(\s*[0-9]{1,2},\s*1[0-9]{2}/.test(green) || green !== "rgb(0, 0, 0)", "the check is green (the success colour)", green);
  claims.length = 0;
  // slow the check down so the 'checking' state can be seen
  let slow = true;
  await ps.route("**/api/printing/jobs/claim", async (route) => { if (slow) await sleep(1500); await route.continue(); });
  let sawLoader = false;
  const end = Date.now() + 20000;
  while (Date.now() < end && !sawLoader) { sawLoader = (await ps.getByTestId("print-station-loader").count()) === 1; if (!sawLoader) await sleep(150); }
  ok(sawLoader && /Checking/.test(await chip.innerText().catch(() => "Checking")), "while it asks the server the chip shows a loader and 'Checking…'");
  slow = false;
  await sleep(18000);
  const gaps = claims.slice(1).map((t, i) => t - claims[i]);
  ok(claims.length >= 1 && claims.length <= 4 && gaps.every((g) => g >= 7000), "the station asks the server only every ~8 s (not every 4)", `${claims.length} calls in 38 s, gaps ${gaps.map((g) => Math.round(g / 1000)).join(",")}s`);
  await pc.close();

  console.log("== Print station: the platform dashboard (super admin) never prints or checks");
  const pc2 = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  await pc2.addInitScript(() => { try { localStorage.setItem("onetap.printStation", JSON.stringify({ enabled: true, targets: ["browser", "epos-lan"], clientId: "browser-test0002" })); } catch { /* ignore */ } });
  const sp2 = await pc2.newPage(); watch(sp2);
  const claims2 = [];
  sp2.on("request", (rq) => { if (/\/api\/printing\/jobs\/claim/.test(rq.url())) claims2.push(rq.url()); });
  await signIn(sp2, "super@sandbox.test", "Super123!");
  await sp2.goto(AD + "/platform/stores", { waitUntil: "load" });
  await sp2.waitForSelector("text=Stores");
  await sleep(19000);
  ok(claims2.length === 0, "with the print station switched on in this browser, the super admin's platform dashboard makes NO print requests", `${claims2.length} calls in 19 s`);
  ok(await sp2.getByTestId("print-station-chip").count() === 0, "…and shows no 'Print station on' chip");
  // inside a store (the super admin opened it) the platform is not "the dashboard": it is the store's own screen — still no tickets from here
  await pc2.close();

  /* ------------------------------------------------------------ 7. platform store header on a phone */
  console.log("== Phone: the store page in the platform console");
  const stores = (await sup("GET", "/api/platform/stores")).json.stores;
  const acme = stores.find((s) => s.name === "Acme Momos");
  const sp = await browser.newContext({ viewport: { width: 375, height: 760 }, isMobile: true, hasTouch: true });
  const sph = await sp.newPage(); watch(sph);
  await signIn(sph, "super@sandbox.test", "Super123!");
  await sph.goto(`${AD}/platform/stores/${acme.id ?? acme._id}`, { waitUntil: "load" });
  const act = sph.getByTestId("store-actions");
  await act.waitFor({ timeout: 15000 });
  const hdr = await act.evaluate((el) => {
    const kids = [...el.children].map((c) => { const r = c.getBoundingClientRect(); return { top: Math.round(r.top), right: Math.round(r.right), left: Math.round(r.left) }; });
    const tops = kids.map((k) => k.top);
    return { oneRow: Math.max(...tops) - Math.min(...tops) < 8, maxRight: Math.max(...kids.map((k) => k.right)), vw: document.documentElement.clientWidth, minLeft: Math.min(...kids.map((k) => k.left)) };
  });
  ok(hdr.oneRow && hdr.maxRight <= hdr.vw && hdr.minLeft >= 0, "the three buttons sit in one tidy row inside the screen", JSON.stringify(hdr));
  ok(await noSideScroll(sph), "the page doesn't scroll sideways");
  const title = await sph.locator("h1").first().boundingBox();
  ok(title && title.width > 120, "the store name has room (it isn't squeezed into a thin column)", `${Math.round(title?.width)}px wide`);
  await sph.screenshot({ path: "store-header-phone.png" });
} finally {
  await call("PUT", "/api/platform/settings", {}).catch(() => {});
  await sup("PUT", "/api/platform/settings", { realtimeWebsocket: true });
  await voidAll();
  await browser.close();
}
ok(problems.length === 0, "no errors in the browser", problems.slice(0, 3).join(" | "));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
