// Kitchen tickets, the screens: in the dashboard the owner sets where a CATEGORY and a DISH are prepared ("Prepared at": Kitchen / Bar),
// and the Printing → Queue list labels tickets that are "order changed" or "cancelled". Chrome against the bench store.
import { chromium } from "playwright";
const AD = "http://localhost:3171";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const problems = [];

const cookie = (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "o@acme.test", password: "Owner123!" }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const outlets = await (await fetch(`${API}/api/outlets`, { headers: { cookie } })).json();
const main = (outlets.outlets ?? outlets).find((o) => o.slug === "main");
const outletId = String(main._id ?? main.id);
const call = async (method, path, body) => {
  const r = await fetch(API + path, { method, headers: { "content-type": "application/json", cookie, "x-onetap-outlet": outletId }, body: body ? JSON.stringify(body) : undefined });
  let json = {}; try { json = await r.json(); } catch {}
  return { status: r.status, json };
};
const menuNow = async () => (await (await fetch(`${API}/api/menu?outletId=${outletId}`)).json());
const beverages = (await menuNow()).categories.find((c) => c.name === "Beverages");
const dish = (await menuNow()).items.find((i) => i.name === "Veg Steamed Momos");

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
const page = await ctx.newPage();
page.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !/Failed to load resource|React DevTools|favicon/.test(m.text())) problems.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
const made = { printer: null, orders: [] };

try {
  await page.goto(AD + "/", { waitUntil: "load" });
  await page.fill('input[type="email"]', "o@acme.test"); await page.fill('input[type="password"]', "Owner123!");
  await page.getByRole("button", { name: /sign in|log in/i }).first().click();
  await page.waitForSelector("text=Orders");

  /* ------------------------------------------------------------ a category */
  console.log("== Menu → a category → Edit… → Prepared at");
  await page.goto(AD + "/menu", { waitUntil: "load" });
  await page.waitForSelector('[data-testid="cat-row"]');
  await page.getByRole("button", { name: "Actions for Beverages" }).click();
  await page.getByText("Edit…", { exact: true }).click();
  let dlg = page.getByRole("dialog", { name: "Edit category" });
  await dlg.waitFor();
  const sel = dlg.getByTestId("category-prep-station");
  ok(await sel.isVisible(), "the category's Edit window has a 'Prepared at' choice");
  ok((await sel.locator("option").allInnerTexts()).map((t) => t.trim()).join(" | ") === "Same as the category it is inside | Kitchen | Bar / beverages", "…offering 'Same as the category it is inside', 'Kitchen' and 'Bar / beverages'", (await sel.locator("option").allInnerTexts()).join(" | "));
  ok((await sel.inputValue()) === "", "a category that was never set starts on 'Same as the category it is inside'");
  ok(/Which kitchen-ticket printer gets what is in here/.test(await dlg.innerText()), "a line explains what it decides");
  await sel.selectOption({ label: "Bar / beverages" });
  await dlg.getByRole("button", { name: "Save" }).click();
  await dlg.waitFor({ state: "hidden", timeout: 8000 });
  await page.waitForTimeout(500);
  ok((await menuNow()).categories.find((c) => c.id === beverages.id).prepStation === "bar", "Save keeps it: Beverages is now made at the Bar");
  await page.getByRole("button", { name: "Actions for Beverages" }).click();
  await page.getByText("Edit…", { exact: true }).click();
  dlg = page.getByRole("dialog", { name: "Edit category" });
  await dlg.waitFor();
  ok((await dlg.getByTestId("category-prep-station").inputValue()) === "bar", "opening it again still shows 'Bar / beverages'");
  await page.screenshot({ path: "kot-category-edit.png" });
  await dlg.getByTestId("category-prep-station").selectOption({ label: "Same as the category it is inside" });
  await dlg.getByRole("button", { name: "Save" }).click();
  await dlg.waitFor({ state: "hidden", timeout: 8000 });
  await page.waitForTimeout(500);
  ok((await menuNow()).categories.find((c) => c.id === beverages.id).prepStation === null, "choosing 'Same as the category it is inside' clears it again");

  /* ------------------------------------------------------------ a dish */
  console.log("== Menu → a dish → Edit → Prepared at");
  await page.locator('[data-testid="cat-row"][data-category="Steamed Momos"] button', { hasText: "Steamed Momos" }).first().click();
  const row = page.locator('[data-testid="item-row"][data-item="Veg Steamed Momos"]');
  await row.waitFor();
  await row.getByTitle("Edit").click();
  const dish1 = page.getByTestId("item-prep-station");
  await dish1.waitFor();
  ok(await dish1.isVisible() && (await dish1.inputValue()) === "", "the dish form has 'Prepared at', starting on 'Same as its category'");
  ok((await dish1.locator("option").allInnerTexts()).join(" | ") === "Same as its category | Kitchen | Bar / beverages", "…with Kitchen and Bar / beverages to pick from");
  await dish1.selectOption({ label: "Bar / beverages" });
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.waitForTimeout(900);
  ok((await menuNow()).items.find((i) => i.id === dish.id).prepStation === "bar", "Save keeps it on the dish");
  await row.getByTitle("Edit").click();
  ok((await page.getByTestId("item-prep-station").inputValue()) === "bar", "…and the form shows it when reopened");
  await page.getByTestId("item-prep-station").selectOption({ label: "Same as its category" });
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.waitForTimeout(900);
  ok((await menuNow()).items.find((i) => i.id === dish.id).prepStation === null, "…and goes back to 'same as its category'");

  /* ------------------------------------------------------------ the print queue */
  console.log("== Printing → Queue labels the tickets");
  const printer = (await call("POST", "/api/printing/printers", { name: "T51 Kitchen", station: "kitchen", docType: "kot", target: "browser", paperWidth: "80mm", autoPrintOn: ["accepted"] })).json.printer;
  made.printer = printer.id;
  const lines = [{ itemId: dish.id, variantId: dish.variants[0]?.id, quantity: 2, modifierOptionIds: [] }];
  const order = (await call("POST", "/api/orders", { outletId, cart: { lines }, channel: "takeaway", name: "T51" })).json.order;
  made.orders.push(order.id);
  await call("PATCH", `/api/orders/${order.id}/status`, { status: "accepted" });
  await page.waitForTimeout(1200);
  const job1 = (await call("GET", `/api/printing/jobs?orderId=${order.id}`)).json.jobs.find((j) => j.docType === "kot");
  await call("POST", `/api/printing/jobs/${job1.id}/result`, { ok: true });
  await call("PATCH", `/api/orders/${order.id}`, { cart: { lines: [{ ...lines[0], quantity: 3 }] } });
  await page.waitForTimeout(1200);
  await call("PATCH", `/api/orders/${order.id}/status`, { status: "cancelled" });
  await page.waitForTimeout(1200);
  await page.goto(AD + "/printing", { waitUntil: "load" });
  await page.getByRole("tab", { name: /Queue/ }).click();
  await page.waitForTimeout(700);
  const queue = await page.locator("main, body").first().innerText();
  const kinds = (await call("GET", `/api/printing/jobs?orderId=${order.id}`)).json.jobs.map((j) => j.ticketKind).sort().join(",");
  ok(kinds.includes("kot") && kinds.includes("change"), "(setup) the order has its ticket and a change ticket", kinds);
  const rows = page.locator("div").filter({ hasText: `Order #${order.orderNumber}` });
  ok(/order changed/i.test(queue), "the Queue marks the change ticket 'order changed'");
  ok(/order cancelled/i.test(queue), "…and the ticket that tells the kitchen 'order cancelled'");
  await page.screenshot({ path: "kot-queue.png" });
} finally {
  // put everything back
  await call("PATCH", `/api/menu/categories/${beverages.id}`, { prepStation: null }).catch(() => {});
  await call("PATCH", `/api/menu/items/${dish.id}`, { prepStation: null }).catch(() => {});
  for (const id of made.orders) await call("DELETE", `/api/orders/${id}`).catch(() => {});
  if (made.printer) await call("DELETE", `/api/printing/printers/${made.printer}`).catch(() => {});
  await browser.close();
}
console.log("console problems:", problems.length ? problems : "none");
ok(problems.length === 0, "the browser logged no errors or warnings");
console.log(`SUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
