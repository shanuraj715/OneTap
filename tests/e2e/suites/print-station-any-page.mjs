// The print station (a computer that prints tickets for browser / network printers) keeps working on EVERY dashboard page, not just
// Printing: switched on once, tickets are picked up and printed whichever page is open. Also: one poller only, off means silent,
// remembered after a reload, a store without the Printing feature never polls. Chrome against the bench stores.
import { chromium } from "playwright";
const AD = "http://localhost:3171";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const problems = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const login = async (email, pw) => (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: pw }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const cookie = await login("o@acme.test", "Owner123!");
const outlets = await (await fetch(`${API}/api/outlets`, { headers: { cookie } })).json();
const main = (outlets.outlets ?? outlets).find((o) => o.slug === "main");
const outletId = String(main._id ?? main.id);
const call = async (method, path, body) => {
  const r = await fetch(API + path, { method, headers: { "content-type": "application/json", cookie, "x-rasoipulse-outlet": outletId }, body: body ? JSON.stringify(body) : undefined });
  let json = {}; try { json = await r.json(); } catch {}
  return { status: r.status, json };
};
const dish = (await (await fetch(`${API}/api/menu?outletId=${outletId}`)).json()).items.find((i) => i.name === "Veg Steamed Momos");
const made = { printer: null, orders: [] };

/** place an order and accept it (as the staff would on the Orders page); returns the order */
const orderAndAccept = async () => {
  const order = (await call("POST", "/api/orders", { outletId, cart: { lines: [{ itemId: dish.id, variantId: dish.variants[0]?.id, quantity: 1, modifierOptionIds: [] }] }, channel: "takeaway", name: "T52" })).json.order;
  made.orders.push(order.id);
  await call("PATCH", `/api/orders/${order.id}/status`, { status: "accepted" });
  return order;
};
const kotJob = async (orderId) => (await call("GET", `/api/printing/jobs?orderId=${orderId}`)).json.jobs?.find((j) => j.docType === "kot");
/** wait until the order's kitchen ticket reaches `status` (or give up) */
const waitStatus = async (orderId, status, ms = 20000) => { const end = Date.now() + ms; let j = null; while (Date.now() < end) { j = await kotJob(orderId); if (j?.status === status) return j; await sleep(500); } return j; };

const browser = await chromium.launch();
const claims = [];
const newPage = async (extra = {}) => {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, ...extra });
  // no print dialog in the test: count what would have gone to the printer instead
  await ctx.addInitScript(() => { window.print = () => { try { window.top.__prints = (window.top.__prints || 0) + 1; } catch {} }; });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !/Failed to load resource|React DevTools|favicon/.test(m.text())) problems.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
  page.on("request", (r) => { if (r.method() === "POST" && /\/api\/printing\/jobs\/claim/.test(r.url())) claims.push(Date.now()); });
  return { ctx, page };
};
const signIn = async (page, email, pw) => {
  await page.goto(AD + "/", { waitUntil: "load" });
  await page.fill('input[type="email"]', email); await page.fill('input[type="password"]', pw);
  await page.getByRole("button", { name: /sign in|log in/i }).first().click();
  await page.waitForSelector("text=Orders", { timeout: 20000 });
};
const claimsDuring = async (ms) => { const from = claims.length; await sleep(ms); return claims.length - from; };

try {
  const printer = (await call("POST", "/api/printing/printers", { name: "T52 Kitchen", station: "kitchen", docType: "kot", target: "browser", paperWidth: "80mm", autoPrintOn: ["accepted"] })).json.printer;
  made.printer = printer.id;

  const { ctx, page } = await newPage();
  await signIn(page, "o@acme.test", "Owner123!");

  /* ------------------------------------------------------------ switched on once, on the Printing page */
  console.log("== switch the print station on (Printing page)");
  await page.goto(AD + "/printing", { waitUntil: "load" });
  const box = page.getByRole("checkbox", { name: /Use this computer as a print station/ });
  await box.waitFor();
  ok(!(await box.isChecked()) && (await page.getByTestId("print-station-chip").count()) === 0, "a new device is NOT a print station, and the sidebar shows no print-station marker");
  await box.check();
  await page.getByTestId("print-station-chip").waitFor({ timeout: 8000 });
  ok(/Print station on|checking/i.test(await page.getByTestId("print-station-chip").innerText()), "switching it on shows 'Print station on' in the sidebar");

  /* ------------------------------------------------------------ tickets print from other pages */
  console.log("== tickets are printed from other pages");
  for (const [path, label] of [["/orders", "Orders"], ["/menu", "Menu"], ["/", "Dashboard"]]) {
    await page.goto(AD + path, { waitUntil: "load" });
    await page.getByTestId("print-station-chip").waitFor({ timeout: 8000 });
    const o = await orderAndAccept();
    const j = await waitStatus(o.id, "printed");
    ok(j?.status === "printed", `${label} page: the order is accepted and its kitchen ticket is printed by this computer (no need to be on Printing)`, `job ${j?.status ?? "none"}`);
  }
  ok((await page.evaluate(() => window.__prints ?? 0)) >= 1, "the browser was asked to print", String(await page.evaluate(() => window.__prints ?? 0)));
  await page.screenshot({ path: "print-station-chip.png" });

  /* ------------------------------------------------------------ one poller, not two */
  console.log("== only one poller");
  await page.goto(AD + "/menu", { waitUntil: "load" });
  await page.getByTestId("print-station-chip").waitFor();
  const n = await claimsDuring(20000);
  ok(n >= 1 && n <= 3, "about one check every 8 seconds on a page that is not Printing — not two pollers", `${n} checks in 20 s`);

  /* ------------------------------------------------------------ off means silent, and the backlog prints when it is back */
  console.log("== off is silent; on picks up the waiting tickets");
  await page.goto(AD + "/printing", { waitUntil: "load" });
  await page.getByRole("checkbox", { name: /Use this computer as a print station/ }).uncheck();
  await page.waitForTimeout(400);
  ok((await page.getByTestId("print-station-chip").count()) === 0, "switching it off removes the sidebar marker");
  await page.goto(AD + "/orders", { waitUntil: "load" });
  const waiting = await orderAndAccept();
  const quiet = await claimsDuring(9000);
  const stillWaiting = await kotJob(waiting.id);
  ok(quiet === 0, "with the station off, this browser makes no print checks at all", `${quiet} checks`);
  ok(stillWaiting?.status === "queued", "…and the new ticket simply waits in the queue", stillWaiting?.status);
  await page.goto(AD + "/printing", { waitUntil: "load" });
  await page.getByRole("checkbox", { name: /Use this computer as a print station/ }).check();
  // move on the way a person does — by the sidebar, inside the app (a full reload would cut a print off half-way)
  await page.locator("aside a", { hasText: /^Orders/ }).first().click();
  await page.waitForURL(/\/orders/);
  const late = await waitStatus(waiting.id, "printed");
  ok(late?.status === "printed", "switching it back on prints the ticket that was waiting — from the Orders page", `job ${late?.status ?? "none"}, chip ${await page.getByTestId("print-station-chip").count()}, claims since: ${claims.length}`);

  /* ------------------------------------------------------------ remembered across a reload */
  console.log("== remembered on this device");
  await page.goto(AD + "/menu", { waitUntil: "load" });
  await page.reload({ waitUntil: "load" });
  ok(await page.getByTestId("print-station-chip").waitFor({ timeout: 8000 }).then(() => true, () => false), "after a reload the device is still a print station");
  await page.getByRole("checkbox").first().waitFor({ state: "attached" }).catch(() => {});
  // leave it off for the next checks
  await page.goto(AD + "/printing", { waitUntil: "load" });
  await page.getByRole("checkbox", { name: /Use this computer as a print station/ }).uncheck();
  await ctx.close();

  /* ------------------------------------------------------------ a store without the Printing feature */
  console.log("== a store whose plan has no Printing never checks");
  {
    const b = await newPage();
    // pretend this device was switched on earlier
    await b.ctx.addInitScript(() => { try { localStorage.setItem("rasoipulse.printStation", JSON.stringify({ enabled: true, targets: ["browser", "epos-lan"], clientId: "browser-t52" })); } catch {} });
    await signIn(b.page, "o@beta.test", "Owner123!");
    await b.page.goto(AD + "/orders", { waitUntil: "load" });
    await b.page.waitForTimeout(1500);
    const quiet2 = await claimsDuring(9000);
    ok((await b.page.getByTestId("print-station-chip").count()) === 0 && quiet2 === 0, "no marker and no print checks, even if the device was switched on before", `${quiet2} checks`);
    await b.ctx.close();
  }
} finally {
  for (const id of made.orders) await call("DELETE", `/api/orders/${id}`).catch(() => {});
  if (made.printer) await call("DELETE", `/api/printing/printers/${made.printer}`).catch(() => {});
  await browser.close();
}
console.log("console problems:", problems.length ? problems : "none");
ok(problems.length === 0, "the browser logged no errors or warnings");
console.log(`SUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
