// The storefront's order history (Account page) shown a page at a time with the joined pagination (PAG03): five orders a page by default, numbered pages,
// newest first, "…" when there are many pages, and what happens when an order is removed. Driven in Chrome against the bench (Acme Momos, /main); the orders
// are placed through the API for made-up customers (cash orders). The orders stay in the bench (they belong to customers made for this test).
import { chromium } from "playwright";
const SF = "http://localhost:3170";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const problems = [];
let seen = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); if (problems.length > seen) { console.log(`      ^ browser error: ${problems.slice(seen).join(" | ").slice(0, 200)}`); seen = problems.length; } };
const norm = (t) => t.replace(/\s+/g, " ").trim();
const stamp = String(Date.now()).slice(-6);
let ipn = Math.floor(Math.random() * 200);

const ownerCookie = (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "o@acme.test", password: "Owner123!" }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const outlets = await (await fetch(`${API}/api/outlets`, { headers: { cookie: ownerCookie } })).json();
const main = (outlets.outlets ?? outlets).find((o) => o.slug === "main");
const outletId = String(main._id ?? main.id);
const menu = await (await fetch(`${API}/api/menu?outletId=${outletId}`)).json();
const lassi = menu.items.find((i) => i.name === "Sweet Lassi");

/** a customer with `n` takeaway orders; resolves to { cookieName, cookieValue, orders: [orderNumber, newest first] } */
async function customerWith(n, phone, name) {
  const r = await (await fetch(`${API}/api/customer/otp/request`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ outletId, destination: phone, name }) })).json();
  const v = await fetch(`${API}/api/customer/otp/verify`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ outletId, destination: phone, code: r.devCode ?? "123456", name, gender: "female", age: 30 }) });
  const [pair] = v.headers.getSetCookie().map((c) => c.split(";")[0]);
  const [cookieName, ...rest] = pair.split("=");
  const cookie = pair;
  const numbers = [];
  for (let i = 0; i < n; i++) {
    // (a customer may place 12 orders in 10 minutes — this test needs 12 for one person, which is exactly the budget, so run it at most once in ten minutes)
    const o = await fetch(`${API}/api/orders`, { method: "POST", headers: { "content-type": "application/json", cookie, "x-forwarded-for": `198.51.100.${(++ipn % 250) + 1}` }, body: JSON.stringify({ outletId, channel: "takeaway", name, cart: { lines: [{ itemId: lassi.id, quantity: 1, modifierOptionIds: [] }] }, gateway: "cod" }) });
    const j = await o.json();
    if (!j.order) throw new Error(`could not place order ${i + 1} for ${name}: ${o.status} ${JSON.stringify(j).slice(0, 200)}`);
    numbers.push(j.order.orderNumber);
  }
  return { cookieName, cookieValue: rest.join("="), cookie, numbers: numbers.reverse() }; // newest first
}
const history = async (c, q) => (await (await fetch(`${API}/api/customer/orders?outletId=${outletId}&${q}`, { headers: { cookie: c.cookie } })).json());

const dozen = await customerWith(12, `97${stamp}01`.slice(0, 10), "Pager Twelve");
const few = await customerWith(3, `97${stamp}02`.slice(0, 10), "Pager Three");
// (a customer may place only 12 orders in 10 minutes, so 'many pages' is made from the same 12 orders, one to a page: ?pageSize=1)

const browser = await chromium.launch();
const open = async (c, viewport = { width: 900, height: 900 }, query = "") => {
  const ctx = await browser.newContext({ viewport });
  await ctx.addCookies([{ name: c.cookieName, value: c.cookieValue, domain: "localhost", path: "/" }]);
  const page = await ctx.newPage();
  page.on("console", (m) => { if (["error"].includes(m.type()) && !/Failed to load resource|favicon|status of 4\d\d/.test(m.text())) problems.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
  await page.goto(`${SF}/main/account${query}`, { waitUntil: "load" });
  await page.locator("[data-order]").first().waitFor({ timeout: 20000 });
  return page;
};
const shown = (page) => page.locator("[data-order]").evaluateAll((els) => els.map((e) => e.dataset.order));
const pagerLabels = (page) => page.getByTestId("pagination").locator("button, span").evaluateAll((els) => els.map((e) => e.textContent.trim()));
const current = (page) => page.getByTestId("pagination").locator('[aria-current="page"]').textContent();

try {
  /* ------------------------------------------------------------------------------------------ the API */
  console.log("== The API: numbered pages");
  let r = await history(dozen, "limit=5&page=1");
  ok(r.orders.length === 5 && r.page === 1 && r.pageSize === 5 && r.total === 12 && r.pages === 3 && r.nextBefore === null, "page 1 of 12 orders, 5 a page: 5 orders, 3 pages in all", `${r.orders.length} p${r.page}/${r.pages} total ${r.total}`);
  ok(JSON.stringify(r.orders.map((o) => o.orderNumber)) === JSON.stringify(dozen.numbers.slice(0, 5)), "…newest first");
  r = await history(dozen, "limit=5&page=3");
  ok(r.orders.length === 2 && r.page === 3 && JSON.stringify(r.orders.map((o) => o.orderNumber)) === JSON.stringify(dozen.numbers.slice(10)), "page 3 has the last 2 (the oldest)");
  r = await history(dozen, "limit=5&page=99");
  ok(r.page === 3 && r.orders.length === 2, "a page past the end shows the last page (not an empty one)");
  r = await history(dozen, "limit=5&page=0");
  ok(r.page === undefined && r.orders.length === 5 && r.total === undefined, "page 0 or nonsense falls back to the date-based paging (the old way still works)");
  r = await history(dozen, "limit=5&page=abc");
  ok(r.page === undefined && r.orders.length === 5, "page=abc is ignored");
  r = await history(dozen, "limit=100&page=1");
  ok(r.orders.length === 12 || r.orders.length === 30 || r.pageSize === 30, "a huge page size is capped (30)", `${r.pageSize}`);
  r = await history(dozen, "limit=5");
  ok(r.nextBefore && r.orders.length === 5, "without `page` it still pages by date (nextBefore)");
  const other = await history(few, "limit=5&page=1");
  ok(other.total === 3 && other.pages === 1 && !other.orders.some((o) => dozen.numbers.includes(o.orderNumber) && o.orderNumber === dozen.numbers[0] && false), "each customer sees only their own orders (3 for the other one)");

  /* ------------------------------------------------------------------------------------------ the page */
  console.log("== The page: five orders and PAG03");
  const page = await open(dozen);
  ok(JSON.stringify(await shown(page)) === JSON.stringify(dozen.numbers.slice(0, 5)), "the Account page shows 5 orders to begin with, newest first", (await shown(page)).join(","));
  const pager = page.getByTestId("pagination");
  ok(await pager.isVisible() && (await pager.getAttribute("aria-label")) === "Order history pages", "a page-number control sits under the list");
  ok(JSON.stringify(await pagerLabels(page)) === JSON.stringify(["1", "2", "3"]), "it shows 1 2 3 (3 pages for 12 orders)", (await pagerLabels(page)).join(" "));
  ok((await current(page)) === "1", "page 1 is marked as the current one");
  const joined = await pager.evaluate((e) => ({ display: getComputedStyle(e).display, radius: getComputedStyle(e).borderRadius, border: getComputedStyle(e).borderTopWidth }));
  ok(/flex/.test(joined.display) && joined.border === "1px", "it is the joined control (PAG03): numbers in one bordered strip", JSON.stringify(joined));
  ok(/Page 1 of 3 · 12 orders/.test(norm(await page.getByTestId("orders-pagination").innerText())), "a line says 'Page 1 of 3 · 12 orders'");
  ok(!(await page.getByRole("button", { name: /Show older orders/ }).count()), "the old 'Show older orders' button is gone");
  const first = (await shown(page))[0];
  await page.getByRole("button", { name: "Page 2" }).click();
  await page.waitForFunction((was) => document.querySelector("[data-order]")?.dataset.order !== was, first, { timeout: 10000 });
  ok(JSON.stringify(await shown(page)) === JSON.stringify(dozen.numbers.slice(5, 10)) && (await current(page)) === "2", "pressing 2 shows the next 5 orders and marks 2 as current", (await shown(page)).join(","));
  ok(/Page 2 of 3/.test(norm(await page.getByTestId("orders-pagination").innerText())), "…and the line says 'Page 2 of 3'");
  await page.getByRole("button", { name: "Page 3" }).click();
  await page.waitForFunction(() => document.querySelectorAll("[data-order]").length === 2, null, { timeout: 10000 });
  ok(JSON.stringify(await shown(page)) === JSON.stringify(dozen.numbers.slice(10)), "page 3 shows the last 2 orders");
  ok((await page.getByRole("button", { name: "Page 3" }).getAttribute("aria-current")) === "page", "…and the current page is marked for screen readers (aria-current)");
  await page.waitForTimeout(1200); // (the scroll glides)
  const heading = await page.getByRole("heading", { name: "Your orders" }).boundingBox();
  ok(heading && heading.y > -5 && heading.y < 400, "turning a page brings the top of the list back into view", `heading at y=${Math.round(heading?.y ?? -1)}`);
  await page.getByRole("button", { name: "Page 1" }).click();
  await page.waitForFunction((n) => document.querySelector("[data-order]")?.dataset.order === n, dozen.numbers[0], { timeout: 10000 });
  ok(true, "and back to page 1");

  console.log("== Few orders: no pager");
  const small = await open(few);
  ok((await shown(small)).length === 3 && (await small.getByTestId("pagination").count()) === 0 && (await small.getByTestId("orders-pagination").count()) === 0, "with 3 orders (one page) there are no page numbers at all");
  await small.context().close();

  console.log("== Many pages: …");
  const big = await open(dozen, { width: 900, height: 900 }, "?pageSize=1");
  ok((await shown(big)).length === 1, "the page size can be set in the address (?pageSize=1): one order a page, 12 pages");
  ok(JSON.stringify(await pagerLabels(big)) === JSON.stringify(["1", "2", "3", "4", "…", "12"]), "on page 1 the control reads 1 2 3 4 … 12 (not 12 buttons in a row)", (await pagerLabels(big)).join(" "));
  await big.getByRole("button", { name: "Page 4" }).click();
  await big.waitForFunction(() => document.querySelector('[data-testid="pagination"] [aria-current="page"]')?.textContent === "4", null, { timeout: 10000 });
  ok(JSON.stringify(await pagerLabels(big)) === JSON.stringify(["1", "…", "3", "4", "5", "…", "12"]), "in the middle: 1 … 3 4 5 … 12", (await pagerLabels(big)).join(" "));
  await big.getByRole("button", { name: "Page 12" }).click();
  await big.waitForFunction(() => document.querySelector('[data-testid="pagination"] [aria-current="page"]')?.textContent === "12", null, { timeout: 10000 });
  ok(JSON.stringify(await pagerLabels(big)) === JSON.stringify(["1", "…", "9", "10", "11", "12"]) && (await shown(big)).length === 1, "on the last page: 1 … 9 10 11 12", (await pagerLabels(big)).join(" "));
  await big.context().close();
  const bad = await open(dozen, { width: 900, height: 900 }, "?pageSize=999");
  ok((await shown(bad)).length === 5, "a page size outside 1 to 30 in the address is ignored (5 a page)");
  await bad.context().close();

  console.log("== On a phone");
  const phone = await open(dozen, { width: 390, height: 844 }, "?pageSize=1");
  const side = await phone.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  const pw = await phone.getByTestId("pagination").boundingBox();
  ok(!side && pw && pw.x >= 0 && pw.x + pw.width <= 390, "the page control fits a phone screen and nothing scrolls sideways", JSON.stringify(pw));
  await phone.context().close();

  console.log("== Removing orders on the last page");
  await page.getByRole("button", { name: "Page 3" }).click();
  await page.waitForFunction(() => document.querySelectorAll("[data-order]").length === 2, null, { timeout: 10000 });
  const removeOne = async () => {
    await page.locator("[data-order]").first().getByRole("button", { name: /Remove order/ }).click();
    await page.getByTestId("order-remove-ask").getByRole("button", { name: "Remove", exact: true }).click();
  };
  await removeOne();
  await page.waitForFunction(() => document.querySelectorAll("[data-order]").length === 1, null, { timeout: 10000 });
  ok(/Page 3 of 3 · 11 orders/.test(norm(await page.getByTestId("orders-pagination").innerText())), "removing one order on page 3 leaves 1 there and the count says 11 orders");
  await removeOne();
  await page.waitForFunction(() => /Page 2 of 2 · 10 orders/.test(document.querySelector('[data-testid="orders-pagination"]')?.textContent ?? ""), null, { timeout: 10000 });
  ok(JSON.stringify(await pagerLabels(page)) === JSON.stringify(["1", "2"]) && (await shown(page)).length === 5, "removing the last order there drops back to the new last page (2 of 2) — never an empty page", (await shown(page)).join(","));

  await page.context().close();

  ok(problems.length === 0, "no errors in the browser", problems.slice(0, 2).join(" | "));
} finally {
  await browser.close();
}
console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
