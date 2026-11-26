// The storefront header marks the page the visitor is on: Menu on the menu page, My orders on the account page, a store page's own link on that
// page. It works in EVERY header style, is on by default, and the store owner can switch it off (Appearance → Header menu). Chrome against the
// bench store: each header style is set through the API, then the real pages are opened on a laptop (the inline menu) and a phone (the slide-in menu).
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SF = "http://localhost:3170";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const problems = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// every header style that exists (so a new one can't be added without being covered here)
const registry = readFileSync(fileURLToPath(new URL("../../../packages/ui/src/registry.jsx", import.meta.url)), "utf8");
const ALL = [...registry.matchAll(/v\("(header\.[a-z-]+)"/g)].map((m) => m[1]);
const NO_MENU = new Set(["header.minimal"]); // name only: it has no menu at all

const cookie = (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "o@acme.test", password: "Owner123!" }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const outlets = ((await (await fetch(`${API}/api/outlets`, { headers: { cookie } })).json()).outlets ?? []);
const main = outlets.find((o) => o.slug === "main");
const outletId = String(main._id ?? main.id);
const layoutBefore = main.config.layout;
const H = { "content-type": "application/json", cookie, "x-rasoipulse-outlet": outletId };
const call = async (method, path, body) => { const r = await fetch(API + path, { method, headers: H, body: body ? JSON.stringify(body) : undefined }); let json = {}; try { json = await r.json(); } catch {} return { status: r.status, json }; };
const setLayout = async (patch) => { const r = await call("PATCH", `/api/outlets/${outletId}/config`, { layout: { ...layoutBefore, ...patch } }); if (r.status >= 400) throw new Error(`layout ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`); };

const pages = [];
const makePage = async (slug, title, showInHeader) => { const r = await call("POST", "/api/pages", { slug, title, status: "published", showInHeader, showInFooter: false, blocks: [{ id: "b1", type: "text", markdown: "A page of the store." }] }); if (r.json?.page?.id) pages.push(r.json.page.id); return r; };

/** in the page: the header's menu links, which one is current, and whether it looks different from the others */
const READ = () => {
  const header = document.querySelector("header");
  const links = [...document.querySelectorAll("header nav.ot-nav-inline a, nav[aria-label='Site menu'] a")].filter((a) => a.getClientRects().length > 0);
  const sig = (a) => { const cs = getComputedStyle(a); return JSON.stringify([cs.color, cs.fontWeight, cs.textDecorationLine, cs.backgroundColor, cs.backgroundSize, cs.boxShadow]); };
  const current = links.filter((a) => a.getAttribute("aria-current") === "page");
  const others = links.filter((a) => a.getAttribute("aria-current") !== "page");
  return {
    hasHeader: Boolean(header), n: links.length, current: current.map((a) => a.textContent.trim()),
    distinct: current.length > 0 && others.length > 0 && current.every((c) => others.every((o) => sig(c) !== sig(o))),
    anyMarked: document.querySelectorAll("header [aria-current='page'], nav[aria-label='Site menu'] [aria-current='page']").length,
  };
};

const browser = await chromium.launch();
const open = async (viewport) => { const ctx = await browser.newContext({ viewport }); const page = await ctx.newPage(); page.on("pageerror", (e) => problems.push(`${viewport.width} pageerror: ${String(e).slice(0, 160)}`)); return { ctx, page }; };
const reading = async (page, path, phone) => {
  await page.goto(`${SF}${path}`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForSelector("header", { timeout: 20000 });
  if (phone) {
    const burger = page.locator("button[aria-label='Open menu']").first();
    if (await burger.count()) { await burger.click(); await page.waitForSelector("nav[aria-label='Site menu']", { timeout: 5000 }).catch(() => {}); await sleep(250); }
  }
  return page.evaluate(READ);
};

try {
  console.log("== Every header style is covered");
  ok(ALL.length >= 14, `the registry has ${ALL.length} header styles`, ALL.join(" "));
  await makePage("about-hl", "About us", true);   // shows in the header
  await makePage("story-hl", "Our story", false);  // not a built-in header link: only a custom link goes there

  const lap = await open({ width: 1280, height: 900 });
  const mob = await open({ width: 390, height: 844 });
  for (const id of ALL) {
    console.log(`== ${id}`);
    await setLayout({ headerVariant: id }); // highlightCurrentPage is left as the store has it: ON by default
    if (NO_MENU.has(id)) {
      const r = await reading(lap.page, "/main", false);
      ok(r.n === 0 && r.anyMarked === 0, `${id}: has no menu, so there is nothing to mark`);
      continue;
    }
    const burgerOnly = id === "header.burger";
    // laptop: the inline menu (a burger-only header shows the same links in its panel)
    const menu = await reading(lap.page, "/main", burgerOnly);
    ok(menu.current.length === 1 && menu.current[0] === "Menu", `${id}: on the menu page, "Menu" is the marked link`, JSON.stringify(menu.current));
    ok(menu.distinct, `${id}: it looks different from the other links (not just a hidden attribute)`);
    const account = await reading(lap.page, "/main/account", burgerOnly);
    ok(account.current.length === 1 && account.current[0] === "My orders", `${id}: on the account page it is "My orders" (and only that)`, JSON.stringify(account.current));
    const about = await reading(lap.page, "/main/about-hl", burgerOnly);
    ok(about.current.length === 1 && about.current[0] === "About us", `${id}: on a store page it is that page's own link`, JSON.stringify(about.current));
    // phone: the slide-in menu
    const drawer = await reading(mob.page, "/main", true);
    ok(drawer.current.length === 1 && drawer.current[0] === "Menu" && drawer.distinct, `${id}: in the phone's slide-in menu the current link is marked and stands out`, JSON.stringify(drawer.current));
  }

  console.log("== The owner can switch it off");
  await setLayout({ headerVariant: "header.left-logo", highlightCurrentPage: false });
  for (const path of ["/main", "/main/account", "/main/about-hl"]) {
    const r = await reading(lap.page, path, false);
    ok(r.n > 0 && r.anyMarked === 0, `switched off: nothing is marked on ${path}`, `${r.n} links, ${r.anyMarked} marked`);
  }
  const offPhone = await reading(mob.page, "/main", true);
  ok(offPhone.n > 0 && offPhone.anyMarked === 0, "switched off: nothing is marked in the phone's slide-in menu either");
  await setLayout({ headerVariant: "header.left-logo", highlightCurrentPage: true });
  const on = await reading(lap.page, "/main", false);
  ok(on.current.join() === "Menu", "switched back on: it is marked again", JSON.stringify(on.current));

  console.log("== The default, and the store's own links");
  const saved = (await call("GET", "/api/outlets")).json.outlets.find((o) => o.slug === "main").config.layout;
  ok(saved.highlightCurrentPage === true, "a store that never chose gets the highlight ON (the saved setting reads true)", String(saved.highlightCurrentPage));
  await setLayout({ headerVariant: "header.left-logo", highlightCurrentPage: true, navLinks: [{ label: "Story", href: "/main/story-hl" }, { label: "Elsewhere", href: "https://example.com/" }, { label: "Jump", href: "#menu" }] });
  const story = await reading(lap.page, "/main/story-hl", false);
  ok(story.current.join() === "Story", "a link the owner added is marked on the page it goes to", JSON.stringify(story.current));
  const home = await reading(lap.page, "/main", false);
  ok(home.current.join() === "Menu", "…and a link to another website or an in-page jump is never marked", JSON.stringify(home.current));
  await lap.ctx.close(); await mob.ctx.close();
} finally {
  await call("PATCH", `/api/outlets/${outletId}/config`, { layout: layoutBefore }).catch(() => {});
  for (const id of pages) await call("DELETE", `/api/pages/${id}`).catch(() => {});
  await browser.close();
}
console.log("console problems:", problems.length ? problems : "none");
ok(problems.length === 0, "no page errors", problems.slice(0, 2).join(" | "));
console.log(`SUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
