// The platform console's Cache page, store by store — what is remembered for each store and clearing just one store's —
// in Chrome against the bench (Acme Momos and Beta Bites).
import { chromium } from "playwright";
const AD = "http://localhost:3171";
const SF = "http://localhost:3170";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const problems = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 15000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await fn()) return true; } catch { /* retry */ } await sleep(250); } return false; };
const login = async (email, password) => (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const sup = await login("super@sandbox.test", "Super123!");
const entries = async () => (await (await fetch(`${API}/api/platform/cache/entries`, { headers: { cookie: sup } })).json());
const stores = (await (await fetch(`${API}/api/platform/stores`, { headers: { cookie: sup } })).json()).stores;
const acme = stores.find((s) => s.name === "Acme Momos");
const beta = stores.find((s) => s.name === "Beta Bites");
const outlets = await (await fetch(`${API}/api/outlets?brandId=${acme.id}`, { headers: { cookie: sup, "x-onetap-brand": String(acme.id) } })).json();
const acmeOutlet = String(((outlets.outlets ?? outlets)[0])._id ?? ((outlets.outlets ?? outlets)[0]).id);
const betaOutlets = await (await fetch(`${API}/api/outlets?brandId=${beta.id}`, { headers: { cookie: sup, "x-onetap-brand": String(beta.id) } })).json();
const betaOutlet = String(((betaOutlets.outlets ?? betaOutlets)[0])._id ?? ((betaOutlets.outlets ?? betaOutlets)[0]).id);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|favicon|status of 4\d\d/.test(m.text())) problems.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
try {
  // make both stores remember something (their menus)
  await fetch(`${API}/api/menu?outletId=${acmeOutlet}`);
  await fetch(`${API}/api/menu?outletId=${betaOutlet}`);
  await fetch(`${API}/api/orders/pickup-slots?outletId=${acmeOutlet}`);

  await page.goto(AD + "/", { waitUntil: "load" });
  await page.fill('input[type="email"]', "super@sandbox.test"); await page.fill('input[type="password"]', "Super123!");
  await page.getByRole("button", { name: /sign in|log in/i }).first().click();
  await page.waitForSelector("text=Stores");
  await page.goto(AD + "/platform/cache", { waitUntil: "load" });
  const rowOf = (name) => page.locator('[data-testid="cache-store-row"]', { hasText: name });
  await rowOf("Acme Momos").waitFor({ timeout: 20000 });
  ok(await page.getByText("Store by store").first().isVisible(), "Cache page has a 'Store by store' table");
  ok(await rowOf("Acme Momos").isVisible() && await rowOf("Beta Bites").isVisible(), "each store that has something remembered has its own row");
  const acmeCount = Number((await rowOf("Acme Momos").locator("td").nth(1).innerText()).replace(/\D/g, ""));
  ok(acmeCount > 0, "…with how many items and how big", (await rowOf("Acme Momos").innerText()).replace(/\s+/g, " "));
  ok(await rowOf("Acme Momos").getByTestId("cache-store-view").isVisible() && await rowOf("Acme Momos").getByTestId("cache-store-clear").isVisible(), "…a 'View items' button and a 'Clear this store's cache' button");

  await rowOf("Beta Bites").getByTestId("cache-store-view").click();
  await sleep(500);
  const shown = await page.locator("table").last().innerText();
  ok(/Beta Bites/.test(shown) && !/Acme Momos/.test(shown), "'View items' lists only that store's items", shown.replace(/\s+/g, " ").slice(0, 120));
  await page.getByRole("button", { name: "Clear filters" }).click();

  const betaBefore = (await entries()).stores.find((s) => s.name === "Beta Bites")?.entries ?? 0;
  await rowOf("Acme Momos").getByTestId("cache-store-clear").click();
  await page.getByTestId("cache-store-cleared").waitFor({ timeout: 10000 });
  ok(/Acme Momos: \d+ items? cleared/.test(await page.getByTestId("cache-store-cleared").innerText()), "'Clear this store's cache' says how much it cleared", await page.getByTestId("cache-store-cleared").innerText());
  const after = await entries();
  ok(!(after.stores.find((s) => s.name === "Acme Momos")?.entries > 0) || after.stores.find((s) => s.name === "Acme Momos").entries < acmeCount, "Acme's remembered items are gone from the server", String(after.stores.find((s) => s.name === "Acme Momos")?.entries ?? 0));
  ok((after.stores.find((s) => s.name === "Beta Bites")?.entries ?? 0) >= betaBefore, "Beta Bites kept everything it had", `${betaBefore} → ${after.stores.find((s) => s.name === "Beta Bites")?.entries}`);
  ok(await until(async () => (await rowOf("Acme Momos").count()) === 0 || Number((await rowOf("Acme Momos").locator("td").nth(1).innerText()).replace(/\D/g, "")) < acmeCount, 12000), "the table updates by itself");
  // the store's pages still load straight after (they just read fresh)
  const menu = await fetch(`${API}/api/menu?outletId=${acmeOutlet}`);
  ok(menu.ok, "Acme's storefront still works right after (it reloads from the database)");
  // the same buttons are on the store's own page
  await page.goto(`${AD}/platform/stores/${acme.id ?? acme._id}`, { waitUntil: "load" });
  await page.getByRole("tab", { name: "Cache" }).or(page.getByRole("button", { name: "Cache", exact: true })).first().click();
  ok(await page.getByRole("button", { name: /Expire this store's cache/ }).isVisible({ timeout: 10000 }), "the store's own page (Cache tab) has its cache and the same clear button too");
  await page.screenshot({ path: "cache-console.png" });
} finally {
  await browser.close();
}
void SF;
ok(problems.length === 0, "no errors in the browser", problems.slice(0, 3).join(" | "));
console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
