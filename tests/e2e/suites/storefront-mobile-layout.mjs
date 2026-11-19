// Storefront on small screens: less side padding on phones AND tablets (desktop unchanged), and on phones a path title
// ("South Indian › Idli & Vada") written on two lines with a smaller View all button.
// A custom menu section is set up through the bench API, checked in Chrome at three sizes, then put back.
import { chromium } from "playwright";
const SF = "http://localhost:3170";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const problems = [];

/* ------------------------------------------------------------ data, through the API */
const cookie = (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "o@acme.test", password: "Owner123!" }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const outlets = await (await fetch(`${API}/api/outlets`, { headers: { cookie } })).json();
const list = outlets.outlets ?? outlets;
const main = list.find((o) => o.slug === "main");
const outletId = String(main._id ?? main.id);
const layoutBefore = main.config.menuLayout;
const call = async (method, path, body) => {
  const r = await fetch(API + path, { method, headers: { "content-type": "application/json", cookie, "x-onetap-outlet": outletId }, body: body ? JSON.stringify(body) : undefined });
  let json = {}; try { json = await r.json(); } catch {}
  return { status: r.status, json };
};
const must = (r, what) => { if (r.status >= 400) { console.error("SETUP FAILED", what, r.status, JSON.stringify(r.json).slice(0, 300)); process.exit(1); } return r; };

const made = [];
const mk = async (name, parentId = null) => { const c = must(await call("POST", "/api/menu/categories", { name, parentId }), name).json.category.id; made.push(c); return c; };
const parent = await mk("Mob South Indian");
const child = await mk("Mob Idli & Vada", parent);
const plain = await mk("Mob Plain Heading");
for (const [cat, base] of [[child, "Idli"], [plain, "Plain"]]) {
  for (let i = 1; i <= 5; i++) must(await call("POST", "/api/menu/items", { categoryId: cat, name: `${base} dish ${i}`, basePrice: 9900 + i * 100, foodType: "veg" }), "item");
}
const section = (id, title, categoryId, placement) => ({ id, title, source: "category", categoryId, collapsible: true, initialItems: 2, viewAllPlacement: placement });
must(await call("PATCH", `/api/outlets/${outletId}/config`, { menuLayout: { ...layoutBefore, mode: "custom", sections: [section("mob-1", "Mob South Indian › Mob Idli & Vada", child, "title-right"), section("mob-2", "Mob Plain Heading", plain, "left")] } }), "layout");

const browser = await chromium.launch();
const open = async (viewport, extra = {}) => {
  const ctx = await browser.newContext({ viewport, ...extra });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !/Failed to load resource|React DevTools|favicon/.test(m.text())) problems.push(`${viewport.width}: ${m.text().slice(0, 200)}`); });
  page.on("pageerror", (e) => problems.push(`${viewport.width} pageerror: ${String(e).slice(0, 200)}`));
  await page.goto(`${SF}/main`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForSelector("#sec-mob-1", { timeout: 20000 });
  await page.waitForTimeout(500);
  return { ctx, page };
};
const css = (page, selector, prop) => page.locator(selector).first().evaluate((el, p) => getComputedStyle(el)[p], prop);
const px = async (page, selector, prop) => parseFloat(await css(page, selector, prop));

try {
  for (const [w, h, label] of [[1280, 900, "desktop"], [820, 1100, "tablet"], [390, 844, "phone"]]) {
    console.log(`== ${label} ${w}px`);
    const { ctx, page } = await open({ width: w, height: h }, w < 1024 ? { isMobile: w < 500, hasTouch: true, deviceScaleFactor: 2 } : {});
    const small = w < 1024;

    // 1. side padding
    const menuPad = await px(page, ".ot-menu-sections", "paddingLeft");
    const menuPadR = await px(page, ".ot-menu-sections", "paddingRight");
    ok(small ? menuPad === 14 && menuPadR === 14 : menuPad === 24 && menuPadR === 24, small ? `${label}: the menu sits 14px from each edge (was 24)` : "desktop: the menu keeps its 24px side padding", `${menuPad}/${menuPadR}`);
    const pads = await page.locator(".ot-page-px").evaluateAll((els) => els.map((e) => [e.tagName.toLowerCase(), parseFloat(getComputedStyle(e).paddingLeft)]));
    ok(small ? pads.every(([, p]) => p === 14) : pads.every(([, p]) => p >= 16), small ? `${label}: every page-width block (hero, offers, order bar, menu, footer…) uses the same 14px edge` : "desktop: none of the page blocks lost padding", JSON.stringify(pads.slice(0, 8)));
    const hdr = await page.locator(".ot-header-px").first().evaluate((e) => parseFloat(getComputedStyle(e).paddingLeft)).catch(() => null);
    ok(hdr === null || (small ? hdr === 14 : hdr === 24), small ? `${label}: the header lines up with them (14px)` : "desktop: the header is unchanged (24px)", String(hdr));
    const cardLeft = await page.locator("#sec-mob-1").evaluate((el) => Math.round(el.getBoundingClientRect().left));
    ok(small ? cardLeft === 14 : cardLeft > 14, `${label}: the first category starts ${cardLeft}px from the left edge`);

    // 2. the path title
    const crumb = page.locator("#sec-mob-1 .ot-sec-crumb");
    const name = page.locator("#sec-mob-1 .ot-sec-name");
    const btn = page.locator("#sec-mob-1 .ot-viewall-title");
    const cb = await crumb.boundingBox(), nb = await name.boundingBox(), bb = await btn.boundingBox();
    const heading = await px(page, "#sec-mob-1 .ot-sec-title", "fontSize");
    const crumbSize = await px(page, "#sec-mob-1 .ot-sec-crumb", "fontSize");
    const nameSize = await px(page, "#sec-mob-1 .ot-sec-name", "fontSize");
    const btnSize = await px(page, "#sec-mob-1 .ot-viewall-title", "fontSize");
    if (w <= 640) {
      ok(cb.y + cb.height <= nb.y + 2, "phone: the title is on TWO lines — parent first, then the name", `${Math.round(cb.y)} / ${Math.round(nb.y)}`);
      ok((await crumb.innerText()).trim() === "Mob South Indian ›" && (await name.innerText()).trim() === "Mob Idli & Vada", "phone: line one is the parent, line two is the category", `"${(await crumb.innerText()).trim()}" / "${(await name.innerText()).trim()}"`);
      ok(crumbSize <= 13 && crumbSize < nameSize / 1.4, "phone: the parent is small", `${crumbSize}px`);
      ok(nameSize < heading && nameSize >= 15, "phone: the category name is a little smaller than a normal heading", `${nameSize}px of ${heading}px`);
      ok(btnSize <= 12 && bb.height <= 30, "phone: the View all button is smaller", `${btnSize}px text, ${Math.round(bb.height)}px high`);
      ok(nb.x + nb.width <= bb.x + 1, "phone: the title and the button fit on one row without overlapping", `${Math.round(nb.x + nb.width)} <= ${Math.round(bb.x)}`);
      ok(bb.x + bb.width <= w - 12, "phone: the button is fully on screen", `${Math.round(bb.x + bb.width)} of ${w}`);
      await page.locator("#sec-mob-1").scrollIntoViewIfNeeded();
      await page.screenshot({ path: "mobile-layout-phone.png" });
    } else {
      ok(Math.abs(cb.y - nb.y) < 4 && crumbSize === nameSize, `${label}: the title stays on ONE line at the normal size`, `${crumbSize}px / ${nameSize}px`);
      ok(btnSize >= 12.5, `${label}: the View all button keeps its size`, `${btnSize}px`);
    }
    // a plain heading and the bottom View all button
    ok((await px(page, "#sec-mob-2 .ot-sec-title", "fontSize")) === 22, `${label}: a plain heading is unchanged (22px)`);
    const bottomBtn = await px(page, "#sec-mob-2 .ot-viewall", "fontSize");
    ok(w <= 640 ? bottomBtn <= 12.6 : bottomBtn >= 13.5, w <= 640 ? "phone: the bottom View all button is smaller too" : `${label}: the bottom View all button keeps its size`, `${bottomBtn}px`);
    // it still works
    await page.locator("#sec-mob-1 .ot-viewall-title").click();
    ok((await page.locator("#sec-mob-1 [aria-label^='Add']").count()) === 5, `${label}: View all still shows all 5 dishes`);
    ok((await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 1, `${label}: no sideways scroll`);
    await ctx.close();
  }
} finally {
  must(await call("PATCH", `/api/outlets/${outletId}/config`, { menuLayout: layoutBefore }), "restore layout");
  const del = await call("POST", "/api/menu/categories/bulk-delete", { ids: made, deleteItems: true });
  ok(del.status === 200, "the test categories are removed and the menu layout is put back", `${del.status}`);
  await browser.close();
}
console.log("console problems:", problems.length ? problems : "none");
ok(problems.length === 0, "the browser logged no errors or warnings");
console.log(`SUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
