// The storefront's top bars stay pinned to the top of the screen while the page scrolls — the header, the order bar under it
// (Takeaway / Delivery + outlet) and the category / filter bar under both — on a phone, a tablet and a desktop, with every
// header style. Chrome against the bench store; the header style is changed through the API and put back at the end.
import { chromium } from "playwright";
const SF = "http://localhost:3170";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const problems = [];

const cookie = (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "o@acme.test", password: "Owner123!" }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const outlets = await (await fetch(`${API}/api/outlets`, { headers: { cookie } })).json();
const main = (outlets.outlets ?? outlets).find((o) => o.slug === "main");
const outletId = String(main._id ?? main.id);
const layoutBefore = main.config.layout;
const setLayout = async (patch) => {
  const r = await fetch(`${API}/api/outlets/${outletId}/config`, { method: "PATCH", headers: { "content-type": "application/json", cookie, "x-rasoipulse-outlet": outletId }, body: JSON.stringify({ layout: { ...layoutBefore, ...patch } }) });
  if (!r.ok) { console.error("SETUP FAILED", r.status, (await r.text()).slice(0, 300)); process.exit(1); }
};

const browser = await chromium.launch();
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const TABLET = { viewport: { width: 820, height: 1100 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const DESKTOP = { viewport: { width: 1440, height: 900 } };
const open = async (opts, path = "/main") => {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const w = opts.viewport.width;
  page.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !/Failed to load resource|React DevTools|favicon/.test(m.text())) problems.push(`${w}: ${m.text().slice(0, 200)}`); });
  page.on("pageerror", (e) => problems.push(`${w} pageerror: ${String(e).slice(0, 200)}`));
  await page.goto(SF + path, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForSelector('[data-sticky="header"]', { timeout: 20000 });
  await page.waitForTimeout(500); // the bars publish their heights once the page has loaded
  return { ctx, page };
};
/** where the three bars are right now */
const geo = (page) => page.evaluate(() => {
  const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, h: b.height }; };
  return { header: r(document.querySelector('[data-sticky="header"]')), bar: r(document.querySelector('[data-sticky="bar"]')), tool: r(document.querySelector("[data-fx-toolbar]")), y: Math.round(scrollY), max: document.documentElement.scrollHeight - innerHeight };
});
const scrollTo = async (page, y) => { await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(350); };
const near = (a, b, tol = 1.5) => Math.abs(a - b) <= tol;
/** header at 0, order bar flush under it, category bar flush under that */
const pinnedOk = (g) => g.header && g.bar && g.tool && near(g.header.top, 0) && near(g.bar.top, g.header.bottom) && near(g.tool.top, g.bar.bottom);
const fmt = (g) => g.header && g.bar && g.tool ? `header ${g.header.top.toFixed(1)}+${g.header.h.toFixed(1)}, order bar ${g.bar.top.toFixed(1)}+${g.bar.h.toFixed(1)}, category bar ${g.tool.top.toFixed(1)}+${g.tool.h.toFixed(1)}` : JSON.stringify(g);

try {
  /* ------------------------------------------------------------ 1. every device: all three stay pinned */
  for (const [label, opts] of [["phone 390px", PHONE], ["tablet 820px", TABLET], ["desktop 1440px", DESKTOP]]) {
    console.log(`== ${label}`);
    const { ctx, page } = await open(opts);
    const top = await geo(page);
    ok(top.header && top.bar && top.tool, `${label}: the header, the order bar and the category bar are all on the page`, fmt(top));
    // (the message bar sits above the header at the top of the page — it is the one thing that is NOT pinned)
    ok(top.header.top >= -0.5 && near(top.bar.top, top.header.bottom), `${label}: at the top of the page they sit in order, header then order bar`, fmt(top));
    ok(top.tool.top > top.bar.bottom + 40, `${label}: and the category bar starts lower down (it only pins once you reach it)`, fmt(top));
    ok(top.max > 1400, `${label}: the page is long enough to test scrolling`, `${Math.round(top.max)}px of scroll`);

    // the category bar only pins once it has been scrolled up under the other two: start well past that point
    const pinAt = Math.ceil(top.tool.top - top.bar.bottom) + 120;
    for (const y of [pinAt, Math.round(top.max * 0.6), Math.round(top.max - 40)]) {
      await scrollTo(page, y);
      const g = await geo(page);
      ok(pinnedOk(g), `${label}: scrolled ${g.y}px — all three are pinned to the top, one under the other with no gap`, fmt(g));
    }
    const g2 = await geo(page);
    const stack = g2.tool.bottom;
    ok(stack <= opts.viewport.height * (opts.viewport.width < 700 ? 0.4 : 0.3), `${label}: the pinned stack takes ${Math.round(stack)}px of ${opts.viewport.height}px — a small part of the screen`, `${Math.round((stack / opts.viewport.height) * 100)}%`);

    // the notes that go with the order bar are NOT pinned
    const note = await page.evaluate(() => { const el = document.querySelector('[data-testid="order-type-hint"]'); return el ? { pinned: Boolean(el.closest("[data-sticky]")), top: el.getBoundingClientRect().top } : null; });
    if (note) ok(!note.pinned && note.top < 0, `${label}: the "isn't available" note scrolls away (it is not part of the pinned bar)`, JSON.stringify(note));

    // content is never hidden under the bars: jump to a category with the bar
    await scrollTo(page, 0);
    const names = await page.evaluate(() => [...document.querySelectorAll("[id^='sec-'] .ot-sec-title, [id^='sec-'] h2, [id^='sec-'] h3")].map((h) => h.textContent.trim()).filter(Boolean));
    const far = names[Math.min(3, names.length - 1)];
    if (opts.viewport.width >= 1024) await page.locator('nav[aria-label="Menu categories"] a, nav[aria-label="Menu categories"] button').filter({ hasText: far }).first().click();
    else { await page.locator("[data-fx-toolbar] .ot-cat-button").click(); await page.locator(".ot-cat-sheet button", { hasText: far }).first().click(); }
    await page.waitForTimeout(2200);
    const landed = await page.evaluate((n) => { const h = [...document.querySelectorAll("[id^='sec-'] .ot-sec-title, [id^='sec-'] h2, [id^='sec-'] h3")].find((x) => x.textContent.trim().startsWith(n)); const t = document.querySelector("[data-fx-toolbar]").getBoundingClientRect().bottom; return { head: h.getBoundingClientRect().top, bar: t }; }, far);
    ok(landed.head >= landed.bar - 2 && landed.head < landed.bar + 90, `${label}: choosing a category scrolls to it just under the pinned bars (not hidden behind them)`, `heading at ${Math.round(landed.head)}px, pinned bars end at ${Math.round(landed.bar)}px`);

    // the header's own "Menu" link jumps to the menu with the first row clear of the bars
    await scrollTo(page, 0);
    await page.evaluate(() => { location.hash = ""; location.hash = "#menu"; });
    await page.waitForTimeout(1200);
    const menuTop = await page.evaluate(() => ({ top: document.getElementById("menu").getBoundingClientRect().top, reach: document.querySelector('[data-sticky="bar"]').getBoundingClientRect().bottom }));
    ok(menuTop.top >= menuTop.reach - 1, `${label}: jumping to #menu leaves the menu below the pinned bars`, `menu at ${Math.round(menuTop.top)}px, bars end at ${Math.round(menuTop.reach)}px`);
    await ctx.close();
  }

  /* ------------------------------------------------------------ 2. a phone: slim order bar, switch and outlet on one row */
  console.log("== phone: the order bar is slim");
  {
    const { ctx, page } = await open(PHONE);
    const g = await geo(page);
    ok(g.bar.h <= 66, "phone: the order bar is slim (the Takeaway/Delivery switch and the outlet share ONE row)", `${g.bar.h.toFixed(1)}px high`);
    const row = await page.evaluate(() => { const kids = [...document.querySelector(".ot-ob-controls").children].map((c) => c.getBoundingClientRect()); return { n: kids.length, spread: Math.max(...kids.map((k) => k.top)) - Math.min(...kids.map((k) => k.top)), right: Math.max(...kids.map((k) => k.right)), width: innerWidth }; });
    ok(row.n === 2 && row.spread < 6, "phone: the switch and the outlet are side by side", JSON.stringify(row));
    ok(row.right <= row.width - 10, "phone: nothing runs off the screen's edge", JSON.stringify(row));
    const small = await browser.newContext({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true });
    const sp = await small.newPage();
    await sp.goto(SF + "/main", { waitUntil: "networkidle" }); await sp.waitForTimeout(500);
    const fit = await sp.evaluate(() => ({ over: document.documentElement.scrollWidth - document.documentElement.clientWidth, bar: document.querySelector('[data-sticky="bar"]').getBoundingClientRect().height }));
    ok(fit.over <= 1, "a very narrow 320px phone: no sideways scroll, the outlet may drop under the switch", `${fit.over}px over, bar ${fit.bar.toFixed(0)}px`);
    await small.close();

    /* ------------------------------------------------------------ 3. what must sit ABOVE the pinned bars */
    console.log("== overlays sit above the pinned bars");
    await scrollTo(page, 900);
    // the outlet dropdown, opened while everything is pinned
    await page.locator(".ot-ob-pill").click();
    await page.waitForTimeout(300);
    const dd = await page.evaluate(() => { const p = document.querySelector('[role="dialog"][aria-label="Choose an outlet"]'); if (!p) return null; const b = p.getBoundingClientRect(); const at = (x, y) => document.elementFromPoint(x, y); return { overTool: p.contains(at(b.left + b.width / 2, b.top + 20)), midIn: p.contains(at(b.left + b.width / 2, b.top + b.height / 2)), top: b.top }; });
    ok(dd && dd.overTool && dd.midIn, "the outlet dropdown opens over the category bar and can be pressed", JSON.stringify(dd));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    // an item pop-up covers the pinned bars (it dims the whole page)
    await page.locator("[aria-label^='Add']").first().click();
    await page.waitForTimeout(500);
    const pop = await page.evaluate(() => { const hit = document.elementFromPoint(innerWidth / 2, 30); const bar = document.elementFromPoint(innerWidth / 2, 100); return { headerCovered: Boolean(hit) && !hit.closest("[data-sticky]"), barCovered: Boolean(bar) && !bar.closest("[data-sticky]") && !bar.closest("[data-fx-toolbar]") }; });
    ok(pop.headerCovered && pop.barCovered, "an item pop-up covers the header and the bars (they do not float above it)", JSON.stringify(pop));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    // the phone menu drawer slides in over everything
    await scrollTo(page, 600);
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.waitForTimeout(500);
    const dr = await page.evaluate(() => { const n = document.querySelector('nav[aria-label="Site menu"]'); if (!n) return null; const b = n.getBoundingClientRect(); const hit = document.elementFromPoint(b.left + b.width / 2, 40); return { onBody: n.parentElement === document.body, over: n.contains(hit), scrollLocked: document.body.style.overflow === "hidden" }; });
    ok(dr && dr.onBody && dr.over, "the phone menu drawer opens over the pinned header and bars", JSON.stringify(dr));
    ok(dr && dr.scrollLocked, "and the page behind it stops scrolling", JSON.stringify(dr));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    ok((await page.locator('nav[aria-label="Site menu"]').count()) === 0, "Escape closes the drawer");
    await ctx.close();
  }

  /* ------------------------------------------------------------ 4. other pages of the store: the header is pinned there too */
  console.log("== other pages");
  {
    const { ctx, page } = await open(DESKTOP, "/main/account");
    const pos = await page.evaluate(() => getComputedStyle(document.querySelector('[data-sticky="header"]')).position);
    ok(pos === "sticky", "the customer's Account page has the pinned header too", pos);
    await ctx.close();
  }

  /* ------------------------------------------------------------ 5. every header style */
  const HEADERS = ["centered", "left-logo", "split-nav", "minimal", "banner", "two-row", "boxed", "stacked", "pill-nav", "floating", "dark", "underline", "burger", "tagline", "call-order"];
  const heights = {};
  for (const [label, opts] of [["phone", PHONE], ["desktop", DESKTOP]]) {
    console.log(`== all 15 header styles, ${label}`);
    for (const name of HEADERS) {
      await setLayout({ headerVariant: `header.${name}` });
      const { ctx, page } = await open(opts);
      await scrollTo(page, 800);
      const g = await geo(page);
      const shownAs = await page.evaluate(() => document.querySelector('[data-sticky="header"]').firstElementChild?.tagName ?? "");
      (heights[name] ??= {})[label] = Math.round(g.header.h);
      // a header taller than 150px (or a fifth of the window) is too big to pin: it scrolls away and the two bars under it pin to the very top
      const limit = Math.min(150, opts.viewport.height * 0.2);
      const tall = g.header.h > limit;
      if (!tall) ok(pinnedOk(g) && shownAs !== "", `${label}: header style "${name}" (${Math.round(g.header.h)}px) stays pinned, with the order bar and category bar under it`, fmt(g));
      else ok(g.header.bottom < 0 && near(g.bar.top, 0) && near(g.tool.top, g.bar.bottom), `${label}: header style "${name}" is ${Math.round(g.header.h)}px tall — too tall to pin: it scrolls away and the order bar and category bar still pin to the top`, fmt(g));
      ok(g.tool.bottom <= opts.viewport.height * (label === "phone" ? 0.4 : 0.32), `${label}: "${name}" — the pinned bars leave most of the screen free`, `${Math.round(g.tool.bottom)}px of ${opts.viewport.height}px`);
      await ctx.close();
    }
  }
  console.log("header heights (px):", JSON.stringify(heights));
} finally {
  await setLayout({});
  await browser.close();
}
console.log("console problems:", problems.length ? problems : "none");
ok(problems.length === 0, "the browser logged no errors or warnings");
console.log(`SUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
