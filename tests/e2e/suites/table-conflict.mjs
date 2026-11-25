// Two staff taking an order for the SAME table: only one gets it. The other is told the table is no longer free and can
// move the order to a free table. API part: simultaneous orders on one free table (exactly one wins, one party on the
// table), the "table is still as it was" check, add-to-party still works. Browser part: the second waiter's screen.
import { chromium } from "playwright";
const AD = "http://localhost:3171";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const problems = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const cookie = (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "o@acme.test", password: "Owner123!" }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const outlets = await (await fetch(`${API}/api/outlets`, { headers: { cookie } })).json();
const main = (outlets.outlets ?? outlets).find((o) => o.slug === "main");
const outletId = String(main._id ?? main.id);
const call = async (method, path, body) => {
  const r = await fetch(API + path, { method, headers: { "content-type": "application/json", cookie, "x-rasoipulse-outlet": outletId }, body: body ? JSON.stringify(body) : undefined });
  let json = {}; try { json = await r.json(); } catch {}
  return { status: r.status, json };
};
const tables = (await call("GET", "/api/tables")).json.tables;
const byNo = (n) => tables.find((t) => t.number === n);
const menu = await (await fetch(`${API}/api/menu?outletId=${outletId}`)).json();
// a dish with no sizes and no add-ons, so it goes straight into the cart
const dish = menu.items.find((i) => i.isAvailable && (i.variants ?? []).length === 0 && !(i.modifierGroupIds ?? []).length && !(i.stock?.enabled) && !(i.combo?.enabled));
const cart = { lines: [{ itemId: dish.id, modifierOptionIds: [], quantity: 1 }] };
const place = (tableId, phone, expected) => call("POST", "/api/orders/staff", { tableId, cart, phone, ...(expected === undefined ? {} : { expectedSessionId: expected }) });
const sessions = async () => (await call("GET", "/api/tables/sessions/active")).json.sessions ?? [];
const sessionsOn = async (tableId) => (await sessions()).filter((s) => s.tableId === tableId);
const made = [];

console.log("== API: two orders for one free table at the same moment");
const t1 = byNo("T1"), t2 = byNo("T2"), t3 = byNo("T3");
ok(t1 && t2 && t3, "the bench has tables T1, T2, T3");
const [a, b] = await Promise.all([place(t1.id, "9811100001", null), place(t1.id, "9811100002", null)]);
const won = [a, b].filter((r) => r.status === 201), lost = [a, b].filter((r) => r.status === 409);
ok(won.length === 1 && lost.length === 1, "exactly one of the two simultaneous orders is accepted, the other refused", `${a.status} / ${b.status}`);
ok(lost[0]?.json?.details?.code === "table_taken" || /another party/i.test(lost[0]?.json?.error ?? ""), "the refused one says the table is taken", lost[0]?.json?.error);
ok((await sessionsOn(t1.id)).length === 1, "only ONE party is seated at the table (no double session)", String((await sessionsOn(t1.id)).length));
const seatedId = (await sessionsOn(t1.id))[0]?.id;
const ordersOnTable = async (tableId) => (await call("GET", "/api/orders")).json.orders?.filter((o) => o.tableId === tableId) ?? [];
ok((await ordersOnTable(t1.id)).length === 1, "and only one order exists for that table");

console.log("== API: the table must still be as it was when the order was started");
let r = await place(t1.id, "9811100003", null); // this screen saw the table FREE, it is not any more
ok(r.status === 409 && r.json.details?.code === "table_taken" && r.json.details.occupied === true && r.json.details.tableNumber === "T1", "an order started on a FREE table is refused once the table is taken (occupied: true)", `${r.status} ${JSON.stringify(r.json.details)}`);
ok((await ordersOnTable(t1.id)).length === 1, "…nothing was added to the table");
r = await place(t1.id, undefined, seatedId); // a waiter who saw THIS party adds to it
ok(r.status === 201, "adding to the party that is really there still works (the screen saw that party)", `${r.status}`);
r = await place(t1.id, undefined, "000000000000000000000000"); // saw some other party
ok(r.status === 409 && r.json.details?.code === "table_taken", "an order for a different party than the screen saw is refused", `${r.status}`);
r = await place(t2.id, "9811100004", seatedId); // thought a party was there, table is in fact free
ok(r.status === 409 && r.json.details?.occupied === false, "an order started on a seated table that has since emptied is refused (occupied: false)", `${r.status} ${JSON.stringify(r.json.details)}`);
r = await place(t2.id, "9811100004", null);
ok(r.status === 201, "a free table that is still free takes the order", `${r.status}`);
r = await place(t3.id, "9811100005"); // an older screen sends nothing to compare
ok(r.status === 201, "an older screen that sends no 'expected party' still works as before", `${r.status}`);

console.log("== Browser: the second waiter's screen");
// free every table again, then run the screen race on T4
for (const s of await sessions()) await call("POST", `/api/tables/sessions/${s.id}/void`, {}).catch(() => {});
const t4 = byNo("T4"), t5 = byNo("T5");
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => problems.push(String(e).slice(0, 200)));
try {
  await page.goto(AD + "/", { waitUntil: "load" });
  await page.fill('input[type="email"]', "o@acme.test"); await page.fill('input[type="password"]', "Owner123!");
  await page.getByRole("button", { name: /sign in|log in/i }).first().click();
  await page.waitForSelector("text=Orders");
  await page.goto(AD + "/take-order", { waitUntil: "load" });
  await page.getByText("T4", { exact: true }).first().click();
  await page.getByRole("button", { name: `Add ${dish.name}` }).first().click();
  if (!(await page.locator("#to-phone").isVisible().catch(() => false))) await page.getByRole("button", { name: /Review/ }).click().catch(() => {});
  await page.locator("#to-phone").fill("9822200001");
  ok(await page.getByTestId("table-taken").count() === 0, "while the table is free there is no warning");
  // meanwhile another waiter takes T4
  const other = await place(t4.id, "9822200009", null);
  ok(other.status === 201, "(another waiter sends an order for T4 first)");
  await page.getByRole("button", { name: /Send to kitchen|Sending/ }).click().catch(() => {});
  const banner = page.getByTestId("table-taken");
  await banner.waitFor({ timeout: 25000 });
  ok(/no longer free/i.test(await banner.innerText()), "pressing Send (or the live list) shows 'Table T4 is no longer free'", (await banner.innerText()).replace(/\s+/g, " ").slice(0, 120));
  ok(await page.getByTestId("move-to-T5").isVisible() && await page.getByTestId("move-to-T4").count() === 0, "it offers the free tables to move to (T5 yes, the taken T4 not)");
  ok((await ordersOnTable(t4.id)).length === 1, "the second order was NOT sent to T4 — still one order there");
  ok(await page.getByRole("button", { name: /Send to kitchen/ }).isDisabled(), "the Send button stays off while the table is taken");
  await page.screenshot({ path: "table-taken.png" });
  await page.getByTestId("move-to-T5").click();
  await page.getByTestId("table-taken").waitFor({ state: "detached", timeout: 8000 });
  ok(await page.getByRole("button", { name: /Table T5 — change table/ }).isVisible(), "choosing T5 moves the order there");
  ok((await page.locator("#to-phone").inputValue()).replace(/\D/g, "") === "9822200001", "the customer's number typed so far went along");
  await page.getByRole("button", { name: /Send to kitchen/ }).click();
  await page.getByText("Sent to the kitchen").waitFor({ timeout: 15000 });
  ok((await ordersOnTable(t5.id)).length === 1 && (await ordersOnTable(t4.id)).length === 1, "the order lands on T5 and T4 keeps only the first waiter's order");
} finally {
  await browser.close();
  for (const s of await sessions()) await call("POST", `/api/tables/sessions/${s.id}/void`, {}).catch(() => {});
}
ok(problems.length === 0, "no errors in the browser", problems.slice(0, 2).join(" | "));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
