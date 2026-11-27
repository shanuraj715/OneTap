// The Rasoi Pulse marketing website's menus, in Chrome (website :3173 built from the current code by `bench website`, the bench API :3097):
//  - the pages the console calls "About Us" and "Contact Us" (any of about / about-us / contact / contact-us) are NOT in the header menu — on a computer or a phone —
//    and ARE in the footer; the "Talk to us" button still goes to the contact page;
//  - on a phone, pressing any link in the menu closes the menu (it used to stay open on top of the new page), and so do a press outside, Escape, and a link
//    to the page that is already open; without JavaScript the menu still opens (it is a native <details>).
// The bench has no website pages, so this suite creates its own and removes them at the end.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
const BENCH = fileURLToPath(new URL("../bench/bench.mjs", import.meta.url));
const WEB = "http://localhost:3173";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const say = (s) => console.log(`\n=== ${s}`);
const problems = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 25000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await fn()) return true; } catch { /* retry */ } await sleep(400); } return false; };

execFileSync(process.execPath, [BENCH, "website"], { stdio: "inherit" }); // builds it from the current code when it is out of date

const login = async (email, password) => (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const sup = await login("super@sandbox.test", "Super123!");
const sa = async (method, path, body) => {
  const r = await fetch(API + path, { method, headers: { cookie: sup, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};
const simple = (heading) => [{ type: "hero", id: "h1", heading, subheading: "Test page" }];
const SETS = {
  // the names a console user typically gives them: "About Us" / "Contact Us"
  us: [
    { slug: "home", title: "Home", status: "published", nav: { show: true, label: "Home", order: 0 }, sections: simple("Home") },
    { slug: "pricing", title: "Pricing", status: "published", nav: { show: true, label: "Pricing", order: 10 }, sections: simple("Pricing") },
    { slug: "faq", title: "FAQ", status: "published", nav: { show: true, label: "FAQ", order: 20 }, sections: simple("FAQ") },
    { slug: "about-us", title: "About Us", status: "published", nav: { show: true, label: "About Us", order: 30 }, sections: simple("About Us") },
    { slug: "contact-us", title: "Contact Us", status: "published", nav: { show: true, label: "Contact Us", order: 40 }, sections: simple("Contact Us") },
  ],
  // the starter names
  plain: [
    { slug: "home", title: "Home", status: "published", nav: { show: true, label: "Home", order: 0 }, sections: simple("Home") },
    { slug: "pricing", title: "Pricing", status: "published", nav: { show: true, label: "Pricing", order: 10 }, sections: simple("Pricing") },
    { slug: "about", title: "About", status: "published", nav: { show: true, label: "About", order: 30 }, sections: simple("About") },
    { slug: "contact", title: "Contact", status: "published", nav: { show: true, label: "Contact", order: 40 }, sections: simple("Contact") },
  ],
  // a page whose address is something else but whose menu label says "About Us"
  label: [
    { slug: "home", title: "Home", status: "published", nav: { show: true, label: "Home", order: 0 }, sections: simple("Home") },
    { slug: "pricing", title: "Pricing", status: "published", nav: { show: true, label: "Pricing", order: 10 }, sections: simple("Pricing") },
    { slug: "our-story", title: "Our story", status: "published", nav: { show: true, label: "About Us", order: 30 }, sections: simple("Our story") },
    { slug: "get-in-touch", title: "Get in touch", status: "published", nav: { show: true, label: "Contact Us", order: 40 }, sections: simple("Get in touch") },
  ],
};

let created = [];
let browser;
async function publish(set) {
  for (const id of created) await sa("DELETE", `/api/platform/site/pages/${id}`).catch(() => undefined);
  created = [];
  for (const p of (await sa("GET", "/api/platform/site/pages")).json.pages ?? []) await sa("DELETE", `/api/platform/site/pages/${p.id ?? p._id}`);
  for (const p of set) {
    const r = await sa("POST", "/api/platform/site/pages", p);
    if (r.status !== 201) console.log("could not create", p.slug, r.status, JSON.stringify(r.json).slice(0, 200));
    else created.push(r.json.page.id ?? r.json.page._id);
  }
  return created.length === set.length;
}
try {
  browser = await chromium.launch();
  const open = async (viewport, extra = {}) => {
    const ctx = await browser.newContext({ viewport, ...extra });
    const page = await ctx.newPage();
    page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|favicon|status of 4\d\d|status of 5\d\d/.test(m.text())) problems.push(m.text().slice(0, 200)); });
    page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
    return page;
  };
  const check = async (key, aboutHref, contactHref, aboutText, contactText) => {
    ok(await publish(SETS[key]), `the ${key} pages were created`);
    const page = await open({ width: 1360, height: 900 });
    await until(async () => { await page.goto(WEB + "/", { waitUntil: "load" }); return (await page.locator(".site-footer").count()) === 1; });
    const nav = (await page.locator(".site-header .nav > a").allTextContents()).map((t) => t.trim());
    ok(nav.includes("Pricing") && !nav.some((t) => /about|contact/i.test(t)), `[${key}] the header menu has Pricing but no About / Contact`, nav.join(" | "));
    ok(!/about|contact/i.test(await page.locator(".site-header .nav").innerText()), `[${key}] …nothing about About or Contact anywhere in the header's menu`);
    const foot = page.locator(".site-footer");
    ok((await foot.locator(`a[href="${aboutHref}"]`).count()) === 1 && (await foot.locator(`a[href="${contactHref}"]`).count()) === 1, `[${key}] the footer has both (${aboutText}, ${contactText})`, (await foot.locator("a").allTextContents()).join(" | ").slice(0, 160));
    const company = (await foot.locator(".foot-col").filter({ has: page.locator("h2", { hasText: "Company" }) }).locator("a").allTextContents()).map((t) => t.trim());
    ok(company.includes(aboutText) && company.includes(contactText), `[${key}] …under 'Company'`, company.join(" | "));
    ok((await page.locator(".site-header .header-cta").getAttribute("href")) === contactHref, `[${key}] the 'Talk to us' button still goes to the contact page`, await page.locator(".site-header .header-cta").getAttribute("href"));
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto(WEB + "/", { waitUntil: "load" });
    await page.locator(".menu summary").click();
    const phone = (await page.locator(".menu-panel a").allTextContents()).map((t) => t.trim());
    ok(phone.includes("Pricing") && !phone.some((t) => /about|contact/i.test(t) && !/talk/i.test(t)), `[${key}] the phone menu has no About / Contact either`, phone.join(" | "));
    await page.context().close();
  };

  say("1. About Us / Contact Us are in the footer, not in the header menu");
  await check("us", "/about-us", "/contact-us", "About Us", "Contact Us");
  await check("plain", "/about", "/contact", "About", "Contact");
  await check("label", "/our-story", "/get-in-touch", "About Us", "Contact Us");

  say("2. The phone menu closes after a link is pressed");
  ok(await publish(SETS.us), "the pages are back");
  const page = await open({ width: 390, height: 800 });
  await until(async () => { await page.goto(WEB + "/", { waitUntil: "load" }); return (await page.locator(".menu").count()) === 1; });
  const menu = page.locator("details.menu");
  const isOpen = () => menu.evaluate((e) => e.open);
  ok(!(await isOpen()), "the menu starts closed");
  await menu.locator("summary").click();
  ok(await isOpen() && await page.locator(".menu-panel").isVisible(), "pressing 'Menu' opens it");
  await page.locator('.menu-panel a[href="/pricing"]').click();
  await page.waitForURL(/\/pricing/, { timeout: 15000 });
  ok(!(await isOpen()), "pressing 'Pricing' goes to the page AND closes the menu (it used to stay open)");
  ok(!(await page.locator(".menu-panel").isVisible()), "…the panel is gone from the screen");
  await menu.locator("summary").click();
  await page.locator('.menu-panel a[href="/faq"]').click();
  await page.waitForURL(/\/faq/, { timeout: 15000 });
  await sleep(300);
  ok(!(await isOpen()), "the same for FAQ");
  await menu.locator("summary").click();
  await page.locator('.menu-panel a[href="/apps"]').click();
  await page.waitForURL(/\/apps/, { timeout: 15000 });
  await sleep(300);
  ok(!(await isOpen()), "…and Apps");
  await menu.locator("summary").click();
  await page.locator(".menu-panel .btn").click();
  await page.waitForURL(/\/contact-us/, { timeout: 15000 });
  await sleep(300);
  ok(!(await isOpen()), "…and the 'Talk to us' button in the menu");
  await menu.locator("summary").click();
  await page.locator('.menu-panel a[href="/contact-us"]').first().click().catch(() => undefined);
  await sleep(600);
  ok(!(await isOpen()), "a link to the page that is already open closes the menu too (nothing navigates, so only the click can close it)");
  await menu.locator("summary").click();
  await page.mouse.click(200, 600);
  await sleep(200);
  ok(!(await isOpen()), "pressing outside the menu closes it");
  await menu.locator("summary").click();
  await page.keyboard.press("Escape");
  await sleep(200);
  ok(!(await isOpen()), "Escape closes it");
  await menu.locator("summary").click();
  await menu.locator("summary").click();
  ok(!(await isOpen()), "pressing 'Menu' again closes it (as before)");
  await menu.locator("summary").click();
  await page.goBack();
  await sleep(600);
  ok(!(await isOpen()), "going back with the browser's button also leaves the menu closed");
  await page.context().close();

  say("3. Without JavaScript the menu still opens");
  const nojs = await open({ width: 390, height: 800 }, { javaScriptEnabled: false });
  await nojs.goto(WEB + "/", { waitUntil: "load" });
  await nojs.locator(".menu summary").click();
  ok(await nojs.locator("details.menu").evaluate((e) => e.open) && await nojs.locator(".menu-panel").isVisible(), "a native <details>: opens with no script (closing after a link needs script)");
  await nojs.context().close();

  ok(problems.length === 0, "no errors in the browser", problems.slice(0, 2).join(" | "));
} finally {
  for (const id of created) await sa("DELETE", `/api/platform/site/pages/${id}`).catch(() => undefined);
  await browser?.close();
}
console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
