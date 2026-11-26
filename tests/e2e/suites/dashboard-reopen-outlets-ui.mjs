// Two dashboard changes, driven in the browser against the test bench:
//  1. An order put back from Completed by hand seats its table again; when someone else has the table the operator gets a pop-up
//     with the FREE tables (grouped by area) and picks one.
//  2. Users & roles: a new team member is given outlets when the account is made, the outlets can be changed later, and a mapped
//     person sees only their outlets.
import { chromium } from "playwright";
const AD = "http://localhost:3171";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const say = (s) => console.log(`\n=== ${s}`);
const problems = [];

const login = async (email, password) => (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const cookie = await login("o@acme.test", "Owner123!");
const outlets = (await (await fetch(`${API}/api/outlets`, { headers: { cookie } })).json()).outlets;
const main = outlets.find((o) => o.slug === "main");
const outletId = String(main._id ?? main.id);
const others = outlets.filter((o) => String(o._id ?? o.id) !== outletId);
const call = async (method, path, body, ck = cookie, outlet = outletId) => {
  const r = await fetch(API + path, { method, headers: { "content-type": "application/json", cookie: ck, "x-rasoipulse-outlet": outlet }, body: body ? JSON.stringify(body) : undefined });
  let json = {}; try { json = await r.json(); } catch {}
  return { status: r.status, json };
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tables = (await call("GET", "/api/tables")).json.tables;
const T = Object.fromEntries(tables.map((t) => [t.number, t]));
const menu = await (await fetch(`${API}/api/menu?outletId=${outletId}`)).json();
const dish = menu.items.find((i) => i.isAvailable && (i.variants ?? []).length === 0 && !(i.modifierGroupIds ?? []).length && !i.stock?.tracked && !i.combo);
const cart = { lines: [{ itemId: dish.id, modifierOptionIds: [], quantity: 1 }] };
const freeAll = async () => { for (const s of (await call("GET", "/api/tables/sessions/active")).json.sessions ?? []) await call("POST", `/api/tables/sessions/${s.id}/void`, {}); };
const board = async () => Object.fromEntries((await call("GET", "/api/tables")).json.tables.map((t) => [t.number, t]));
/** an order taken at a table, taken through to Completed and paid (the table frees itself) */
const finished = async (table, phone) => {
  const o = (await call("POST", "/api/orders/staff", { tableId: T[table].id, phone, cart })).json.order;
  for (const to of ["preparing", "ready", "completed"]) await call("PATCH", `/api/orders/${o.id}/status`, { status: to });
  await call("POST", `/api/tables/sessions/${o.sessionId}/confirm-payment`, {});
  await call("POST", `/api/tables/sessions/${o.sessionId}/close`, {});
  return o;
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => problems.push(String(e).slice(0, 200)));
const signIn = async (pg, email, password) => {
  await pg.goto(AD + "/", { waitUntil: "load" });
  await pg.fill('input[type="email"]', email); await pg.fill('input[type="password"]', password);
  await pg.getByRole("button", { name: /sign in|log in/i }).first().click();
  await pg.waitForSelector("text=Orders", { timeout: 20000 });
};

try {
  await freeAll();
  await signIn(page, "o@acme.test", "Owner123!");

  say("1. An order put back from Completed: its table is seated again");
  const first = await finished("T2", "9833300001");
  ok((await board()).T2.status === "free", "T2 is free after the order was completed and paid");
  await page.goto(AD + "/orders", { waitUntil: "load" });
  const rowFor = (o) => page.locator("tr", { hasText: `#${o.orderNumber}` }).first();
  await rowFor(first).waitFor({ timeout: 20000 });
  // the order is Completed by default hidden? widen the view to include finished orders if needed
  const openManual = async (o, label) => {
    await rowFor(o).getByRole("button", { name: "Set status manually" }).click();
    await page.getByRole("menuitem", { name: new RegExp(`^${label}`) }).or(page.getByRole("option", { name: new RegExp(`^${label}`) })).or(page.getByText(label, { exact: true }).last()).first().click();
    await page.getByRole("button", { name: /^Confirm$/ }).click();
  };
  await openManual(first, "Preparing");
  await page.getByText(/is seated again/).waitFor({ timeout: 15000 });
  ok(/Table T2 is seated again/.test(await page.getByText(/is seated again/).first().innerText()), "the page says 'Table T2 is seated again'");
  ok((await board()).T2.status === "seated", "T2 shows SEATED (it used to stay free)", (await board()).T2.status);
  ok(await page.getByTestId("pick-table").count() === 0, "no pop-up was needed — the table was free");

  say("2. Somebody else is at the table: the operator picks another");
  await freeAll();
  const second = await finished("T1", "9833300002");
  const intruder = (await call("POST", "/api/orders/staff", { tableId: T.T1.id, phone: "9833300003", cart })).json.order;
  ok(Boolean(intruder?.id), "another party sits at T1", intruder?.orderNumber);
  await page.reload({ waitUntil: "load" });
  await rowFor(second).waitFor({ timeout: 20000 });
  await openManual(second, "Preparing");
  const dlg = page.getByTestId("pick-table");
  await dlg.waitFor({ timeout: 15000 });
  const text = (await dlg.innerText()).replace(/\s+/g, " ");
  ok(/someone else/i.test(text) && /T1 has another party/.test(text), "a pop-up explains that T1 has another party", text.slice(0, 140));
  ok(await dlg.locator('[data-table="T3"]').isVisible() && await dlg.locator('[data-table="T1"]').count() === 0, "it offers free tables (T3 yes) and not the taken T1");
  const areas = await dlg.locator("section").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  ok(areas.length >= 2 && areas.includes("Ground floor") && areas.includes("Terrace"), "the tables are grouped by area", areas.join(" | "));
  ok(/\b4 seats?\b/.test(text) || /\b\d+ seats?\b/.test(text), "each shows its number and its seats", "");
  const seatBtn = page.getByRole("button", { name: /Pick a table|Seat them at/ });
  ok(await seatBtn.isDisabled(), "the confirm button is off until a table is chosen");
  ok((await call("GET", `/api/orders/${second.id}?outletId=${outletId}`)).json.order.status === "completed", "NOTHING changed yet — the order is still Completed");
  await page.screenshot({ path: "pick-table.png" });
  await dlg.locator('[data-table="T3"]').click();
  ok(await dlg.locator('[data-table="T3"]').getAttribute("aria-checked") === "true", "choosing T3 marks it");
  await page.getByRole("button", { name: /Seat them at T3/ }).click();
  await page.getByText(/Table T3 is seated again/).waitFor({ timeout: 15000 });
  ok(await page.getByTestId("pick-table").count() === 0, "the pop-up closes");
  const b = await board();
  ok(b.T3.status === "seated" && b.T1.status === "seated" && b.T3.activeSessionId === second.sessionId, "T3 is seated with the first party; the other party keeps T1");
  ok((await call("GET", `/api/orders/${second.id}?outletId=${outletId}`)).json.order.status === "preparing", "the order is back to Preparing");
  ok(/for this order's party/.test(await page.getByText(/is seated again/).first().innerText()), "the page says it is a different table than before");

  say("3. 'Leave the order as it is'");
  await freeAll();
  const third = await finished("T4", "9833300004");
  await call("POST", "/api/orders/staff", { tableId: T.T4.id, phone: "9833300005", cart });
  await page.reload({ waitUntil: "load" });
  await rowFor(third).waitFor({ timeout: 20000 });
  await openManual(third, "Preparing");
  await page.getByTestId("pick-table").waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: /Leave the order as it is/ }).click();
  ok(await page.getByTestId("pick-table").count() === 0 && (await call("GET", `/api/orders/${third.id}?outletId=${outletId}`)).json.order.status === "completed", "cancelling the pop-up leaves the order Completed");

  say("4. Users & roles: giving a new person outlets");
  await freeAll();
  ok(others.length >= 1, "the bench store has more than one outlet", outlets.map((o) => o.name).join(", "));
  const otherName = others[0].name;
  await page.goto(AD + "/users", { waitUntil: "load" });
  const form = page.locator("form").filter({ hasText: "Add user" });
  await form.waitFor({ timeout: 15000 });
  const email = `ui.staff.${Date.now() % 100000}@acme.test`;
  await form.locator("input").first().fill("UI Waiter"); // (name, email, password — the labels also match their "About …" buttons)
  await form.locator('input[type="email"]').fill(email);
  await form.locator('input[type="password"]').fill("Staff123!");
  await form.locator("select").selectOption("staff");
  ok(await page.getByTestId("new-user-outlets").isVisible(), "the form asks which outlets (the store has several)");
  ok(await form.getByRole("button", { name: "Add user" }).isDisabled(), "Add user is off until an outlet is chosen");
  ok(await page.getByText(/Pick at least one outlet, or tick All outlets/).first().isVisible(), "and says why");
  await page.getByTestId("new-user-outlets").getByLabel(main.name, { exact: true }).check();
  ok(await form.getByRole("button", { name: "Add user" }).isEnabled(), "choosing one outlet turns it on");
  await form.getByRole("button", { name: "Add user" }).click();
  const line = page.getByTestId(`outlets-of-${email}`);
  await line.waitFor({ timeout: 15000 });
  ok((await line.innerText()).includes(`Outlets: ${main.name}`) && !(await line.innerText()).includes(otherName), "the new person is listed with their outlet only", (await line.innerText()).replace(/\s+/g, " "));
  const made = (await call("GET", "/api/users", null, cookie, outletId)).json.users.find((u) => u.email === email);
  ok(made?.outletIds?.length === 1 && made.outletIds[0] === outletId, "saved: exactly the ticked outlet", JSON.stringify(made?.outletIds));

  say("5. The mapped person sees only their outlet");
  const staffCtx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const sp = await staffCtx.newPage();
  sp.on("pageerror", (e) => problems.push(String(e).slice(0, 200)));
  await signIn(sp, email, "Staff123!");
  await sp.goto(AD + "/orders", { waitUntil: "load" });
  await sleep(1500);
  const bodyText = await sp.locator("body").innerText();
  ok(!bodyText.includes(otherName), `nothing of "${otherName}" is on their dashboard`, "");
  const staffCookie = await login(email, "Staff123!");
  const theirs = (await (await fetch(`${API}/api/outlets`, { headers: { cookie: staffCookie } })).json()).outlets;
  ok(theirs.length === 1 && String(theirs[0]._id ?? theirs[0].id) === outletId, "the outlet list they get has just their outlet", theirs.map((o) => o.name).join(", "));
  const refused = await call("GET", "/api/tables", null, staffCookie, String(others[0]._id ?? others[0].id));
  ok(refused.status === 403, "another outlet is refused outright (403)", `${refused.status}`);

  say("6. Changing a person's outlets later");
  await page.goto(AD + "/users", { waitUntil: "load" });
  await page.getByTestId(`outlets-of-${email}`).getByRole("button", { name: "Change outlets" }).click();
  const od = page.getByTestId("outlets-dialog");
  await od.waitFor({ timeout: 10000 });
  await od.getByLabel("All outlets").check();
  await page.getByRole("button", { name: /^Save$/ }).click();
  await od.waitFor({ state: "detached", timeout: 10000 });
  ok((await page.getByTestId(`outlets-of-${email}`).innerText()).startsWith("All outlets"), "after ticking All outlets the row says All outlets");
  const theirs2 = (await (await fetch(`${API}/api/outlets`, { headers: { cookie: staffCookie } })).json()).outlets;
  ok(theirs2.length === outlets.length, "and they see every outlet now — without signing in again", `${theirs2.length}`);
  await staffCtx.close();
  await call("DELETE", `/api/users/${made.id}`, null, cookie, outletId);
} catch (e) {
  ok(false, "the suite stopped with an error", String(e?.message ?? e).split("\n").slice(0, 3).join(" | "));
} finally {
  await browser.close();
  await freeAll();
}
ok(problems.length === 0, "no errors in the browser", problems.slice(0, 2).join(" | "));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
