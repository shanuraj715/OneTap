// When the platform super admin opens a store's dashboard, every page is under  /store/<store-name>/<store-id>/…  (e.g.
// /store/acme-momos/6b00…/menu); a store owner keeps the plain addresses (/menu). Chrome against the bench stores.
import { chromium } from "playwright";
const AD = "http://localhost:3171";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const problems = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const login = async (email, password) => (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const superCookie = await login("super@sandbox.test", "Super123!");
const stores = (await (await fetch(`${API}/api/platform/stores`, { headers: { cookie: superCookie } })).json()).stores;
const acme = stores.find((s) => s.name === "Acme Momos");
const beta = stores.find((s) => s.name === "Beta Bites");
const id = String(acme.id ?? acme._id);
const betaId = String(beta.id ?? beta._id);

const browser = await chromium.launch();
const watch = (page) => {
  page.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !/Failed to load resource|React DevTools|favicon|WebSocket/.test(m.text())) problems.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
};
const here = (page) => new URL(page.url()).pathname;
const signIn = async (page, email, pw) => {
  await page.goto(AD + "/", { waitUntil: "load" });
  await page.fill('input[type="email"]', email); await page.fill('input[type="password"]', pw);
  await page.getByRole("button", { name: /sign in|log in/i }).first().click();
};
const goes = async (page, re, ms = 10000) => { try { await page.waitForURL(re, { timeout: ms }); return true; } catch { return false; } };

try {
  /* ------------------------------------------------------------ the super admin */
  console.log("== The super admin opens a store");
  const sa = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  watch(sa);
  await signIn(sa, "super@sandbox.test", "Super123!");
  await sa.waitForSelector("text=Stores");
  await sa.goto(`${AD}/platform/stores/${id}`, { waitUntil: "load" });
  await sa.getByRole("button", { name: "Open store dashboard" }).click();
  ok(await goes(sa, new RegExp(`/store/acme-momos/${id}$`)), "'Open store dashboard' lands on /store/<store-name>/<store-id>", here(sa));
  await sa.waitForSelector("text=Orders");

  console.log("== Every page of the store keeps that address");
  const side = sa.locator("aside");
  await side.getByRole("link", { name: "Menu", exact: true }).click();
  ok(await goes(sa, new RegExp(`/store/acme-momos/${id}/menu$`)), "the sidebar's Menu goes to …/menu", here(sa));
  ok(await sa.getByTestId("cat-row").first().waitFor({ timeout: 15000 }).then(() => true).catch(() => false), "…and it is the store's menu");
  await side.getByRole("link", { name: "Orders", exact: true }).click();
  ok(await goes(sa, new RegExp(`/store/acme-momos/${id}/orders$`)), "Orders goes to …/orders", here(sa));
  await side.getByRole("link", { name: "Settings", exact: true }).click();
  ok(await goes(sa, new RegExp(`/store/acme-momos/${id}/settings$`)), "Settings goes to …/settings", here(sa));
  await sa.getByRole("link", { name: "Payments" }).first().click();
  ok(await goes(sa, new RegExp(`/store/acme-momos/${id}/payments$`)), "a tab inside Settings (Payments) keeps the prefix too", here(sa));
  const filled = (name) => side.getByRole("link", { name, exact: true }).evaluate((a) => getComputedStyle(a).backgroundColor !== "rgba(0, 0, 0, 0)");
  ok((await filled("Settings")) && !(await filled("Menu")), "the sidebar marks the section you are in (Settings, on its Payments tab) and not the others");
  await sa.screenshot({ path: "store-address-super.png" });

  console.log("== Reload, shared and old addresses");
  await sa.goto(`${AD}/store/acme-momos/${id}/menu`, { waitUntil: "load" });
  await sa.waitForSelector('[data-testid="cat-row"]', { timeout: 20000 });
  ok(here(sa) === `/store/acme-momos/${id}/menu`, "reloading a store page stays on it (a bookmark or a link to another admin works)", here(sa));
  await sa.goto(`${AD}/store/wrong-name/${id}/orders`, { waitUntil: "load" });
  ok(await goes(sa, new RegExp(`/store/acme-momos/${id}/orders$`)), "a wrong or old store name in the address is corrected to the current one", here(sa));
  await sa.goto(`${AD}/orders`, { waitUntil: "load" });
  ok(await goes(sa, new RegExp(`/store/acme-momos/${id}/orders$`), 15000), "an old plain address (/orders) opened by the super admin goes to the store they last had open", here(sa));
  await sa.goto(`${AD}/store/acme-momos/${betaId}/menu`, { waitUntil: "load" });
  ok(await goes(sa, new RegExp(`/store/beta-bites/${betaId}/menu$`)), "an address with another store's id shows THAT store (the id decides, the name follows)", here(sa));
  ok(/Beta Bites/.test(await sa.locator("body").innerText()), "…and the page says it is Beta Bites");

  console.log("== Leaving the store");
  await sa.getByRole("button", { name: /Back to my dashboard/ }).click();
  ok(await goes(sa, new RegExp(`/platform/stores/${betaId}$`)), "'Back to my dashboard' leaves the store (no /store in the address)", here(sa));
  await sa.goto(`${AD}/platform`, { waitUntil: "load" });
  ok(/Stores/.test(await sa.locator("aside").innerText()) && !/\/store\//.test(here(sa)), "the platform console is at /platform, not under a store");

  /* ------------------------------------------------------------ the owner */
  console.log("== A store owner keeps the plain addresses");
  const ctx2 = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const ow = await ctx2.newPage();
  watch(ow);
  await signIn(ow, "o@acme.test", "Owner123!");
  await ow.waitForSelector("text=Orders");
  await ow.locator("aside").getByRole("link", { name: "Menu", exact: true }).click();
  ok(await goes(ow, /\/menu$/) && !/\/store\//.test(here(ow)), "the owner's Menu is /menu (no store prefix)", here(ow));
  await ow.locator("aside").getByRole("link", { name: "Orders", exact: true }).click();
  ok(await goes(ow, /\/orders$/) && !/\/store\//.test(here(ow)), "…and Orders is /orders", here(ow));
  await ow.goto(`${AD}/store/acme-momos/${id}/menu`, { waitUntil: "load" });
  await sleep(1500);
  ok(!/\/store\//.test(here(ow)), "an owner who types a /store/… address is sent back to their own dashboard", here(ow));
} finally {
  await browser.close();
}
ok(problems.length === 0, "no errors in the browser console", problems.slice(0, 3).join(" | "));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
