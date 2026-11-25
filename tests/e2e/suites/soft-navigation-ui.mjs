// Moving around the storefront must not reload the app. Every link to another page of the store (header menu, the
// "Order" button, the footer's pages, the message bar's link, the phone menu) is followed inside the page: a marker put on
// the window survives the click, whereas a real page load would wipe it. Chrome against the bench store (Acme, /main).
import { chromium } from "playwright";
const SF = "http://localhost:3170";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const problems = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 15000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await fn()) return true; } catch { /* retry */ } await sleep(200); } return false; };

const cookie = (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "o@acme.test", password: "Owner123!" }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const outlets = await (await fetch(`${API}/api/outlets`, { headers: { cookie } })).json();
const main = (outlets.outlets ?? outlets).find((o) => o.slug === "main");
const outletId = String(main._id ?? main.id);
const call = async (method, path, body) => {
  const r = await fetch(API + path, { method, headers: { "content-type": "application/json", cookie, "x-rasoipulse-outlet": outletId }, body: body ? JSON.stringify(body) : undefined });
  let json = {}; try { json = await r.json(); } catch {}
  return { status: r.status, json };
};
const before = { announcement: main.config.announcement, layout: main.config.layout };
const made = [];

// a page that shows in the footer, a message-bar link to the Account page
const pg = await call("POST", "/api/pages", { slug: "about-soft", title: "About soft", status: "published", showInFooter: true, showInHeader: false, blocks: [{ id: "b1", type: "text", markdown: "About this store." }] });
if (pg.json.page?.id) made.push(pg.json.page.id);
await call("PATCH", `/api/outlets/${outletId}/config`, { announcement: { ...before.announcement, enabled: true, dismissible: false, messages: [{ text: "See how your order is going", linkLabel: "My orders", linkHref: "/main/account" }] } });

const browser = await chromium.launch();
const mark = (page) => page.evaluate(() => { window.__soft = `m${Math.random()}`; return window.__soft; });
const kept = (page, m) => page.evaluate((x) => window.__soft === x, m);
const path = (page) => new URL(page.url()).pathname;

try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|favicon|status of 4\d\d/.test(m.text())) problems.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
  let loads = 0;
  page.on("load", () => { loads += 1; });

  console.log("== Desktop");
  await page.goto(`${SF}/main`, { waitUntil: "load" });
  await page.getByText("Veg Steamed Momos").first().waitFor({ timeout: 20000 });
  let m = await mark(page);
  const loadsAfterFirst = loads;
  await page.locator("nav.ot-nav-inline").getByRole("link", { name: "My orders" }).first().click();
  ok(await until(async () => path(page) === "/main/account"), "header 'My orders' goes to the Account page", path(page));
  ok(await kept(page, m), "…without reloading the app (the page was not loaded again)");
  m = await mark(page);

  await page.locator("nav.ot-nav-inline").getByRole("link", { name: "Menu" }).first().click();
  ok(await until(async () => path(page) === "/main"), "header 'Menu' goes back to the menu", path(page));
  ok(await kept(page, m), "…without reloading");
  m = await mark(page);

  const footer = page.getByRole("link", { name: "About soft" }).first();
  await footer.scrollIntoViewIfNeeded();
  await footer.click();
  ok(await until(async () => path(page) === "/main/about-soft"), "a footer page link opens that page", path(page));
  ok(await kept(page, m), "…without reloading");
  m = await mark(page);

  // the message bar's link (on a page that has the bar and a header)
  await page.getByRole("link", { name: "My orders" }).first().waitFor();
  const bar = page.getByRole("link", { name: "My orders" }).first();
  await bar.click();
  ok(await until(async () => path(page) === "/main/account"), "the message bar's link opens the Account page", path(page));
  ok(await kept(page, m), "…without reloading");
  m = await mark(page);

  // the header's own "Order" button from another page goes back to the menu
  const orderBtn = page.locator("header a", { hasText: /^Order$/ }).first();
  if (await orderBtn.count()) {
    await orderBtn.click();
    ok(await until(async () => path(page) === "/main"), "the header's Order button takes you to the menu", path(page));
    ok(await kept(page, m), "…without reloading");
  } else {
    ok(true, "(this header style has no Order button)");
  }

  console.log("== The menu link on the menu page, and the page-load count");
  m = await mark(page);
  await page.locator("nav.ot-nav-inline").getByRole("link", { name: "Menu" }).first().click();
  await sleep(600);
  ok(path(page) === "/main" && await kept(page, m), "clicking 'Menu' while already on the menu stays put and doesn't reload");
  ok(loads === loadsAfterFirst, "the browser loaded the page exactly once in the whole walk", `${loads - loadsAfterFirst + 1} loads`);
  await ctx.close();

  console.log("== Phone menu");
  const mctx = await browser.newContext({ viewport: { width: 375, height: 760 }, isMobile: true, hasTouch: true });
  const mp = await mctx.newPage();
  mp.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
  await mp.goto(`${SF}/main`, { waitUntil: "load" });
  await mp.getByText("Veg Steamed Momos").first().waitFor({ timeout: 20000 });
  const mm = await mark(mp);
  await mp.getByRole("button", { name: "Open menu" }).click();
  await mp.getByRole("navigation", { name: "Site menu" }).getByRole("link", { name: "My orders" }).click();
  ok(await until(async () => path(mp) === "/main/account"), "the phone menu's 'My orders' opens the Account page", path(mp));
  ok(await kept(mp, mm), "…without reloading");
  await mctx.close();
} finally {
  await call("PATCH", `/api/outlets/${outletId}/config`, { announcement: before.announcement });
  for (const id of made) await call("DELETE", `/api/pages/${id}`);
  await browser.close();
}
ok(problems.length === 0, "no errors in the browser", problems.slice(0, 3).join(" | "));
console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
