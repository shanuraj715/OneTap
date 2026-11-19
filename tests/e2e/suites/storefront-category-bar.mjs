// The storefront's category bar with MANY categories: one short row that scrolls sideways, never a tall sticky block.
// 30 extra categories are added to Acme's fake menu through the bench API, checked in Chrome at three sizes, then removed.
import { chromium } from "playwright";
const SF = "http://localhost:3170";
const API = "http://localhost:3097";
const MANY = 30;
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const problems = [];

/* ------------------------------------------------------------ data, through the API */
const login = async () => (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "o@acme.test", password: "Owner123!" }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const cookie = await login();
const outletsRes = await (await fetch(`${API}/api/outlets`, { headers: { cookie } })).json();
const outlet = String((outletsRes.outlets ?? outletsRes).find((o) => o.slug === "main")?._id ?? (outletsRes.outlets ?? outletsRes).find((o) => o.slug === "main")?.id);
const call = async (method, path, body) => {
  const r = await fetch(API + path, { method, headers: { "content-type": "application/json", cookie, "x-onetap-outlet": outlet }, body: body ? JSON.stringify(body) : undefined });
  let json = {}; try { json = await r.json(); } catch {}
  return { status: r.status, json };
};
const made = [];
const names = Array.from({ length: MANY }, (_, i) => `Bar Test ${String(i + 1).padStart(2, "0")} Specials`);
for (const name of names) {
  const c = await call("POST", "/api/menu/categories", { name });
  if (c.status >= 400) { console.error("SETUP FAILED", name, c.status, JSON.stringify(c.json)); process.exit(1); }
  made.push(c.json.category.id);
  const it = await call("POST", "/api/menu/items", { categoryId: c.json.category.id, name: `${name} dish`, basePrice: 9900, foodType: "veg" });
  if (it.status >= 400) { console.error("SETUP FAILED item", it.status, JSON.stringify(it.json)); process.exit(1); }
}

const browser = await chromium.launch();
const open = async (viewport, extra = {}) => {
  const ctx = await browser.newContext({ viewport, ...extra });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !/Failed to load resource|React DevTools|favicon/.test(m.text())) problems.push(`${viewport.width}: ${m.text().slice(0, 200)}`); });
  page.on("pageerror", (e) => problems.push(`${viewport.width} pageerror: ${String(e).slice(0, 200)}`));
  await page.goto(`${SF}/main`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(700);
  return { ctx, page };
};
/** wait until the page has stopped moving (a long glide takes a while) */
const settle = async (page, max = 9000) => {
  let last = -1, still = 0;
  for (let t = 0; t < max; t += 250) {
    const y = await page.evaluate(() => Math.round(scrollY));
    still = y === last ? still + 1 : 0;
    last = y;
    if (still >= 3) return y;
    await page.waitForTimeout(250);
  }
  return last;
};
const barHeight = (page) => page.locator("[data-fx-toolbar]").evaluate((el) => Math.round(el.getBoundingClientRect().height));

try {
  /* ------------------------------------------------------------ desktop */
  console.log("== desktop 1280px");
  {
    const { ctx, page } = await open({ width: 1280, height: 900 });
    const strip = page.locator('nav[aria-label="Menu categories"]');
    const chips = strip.getByRole("link");
    ok((await chips.count()) >= MANY, `all ${MANY}+ categories are in the bar`, String(await chips.count()));
    const h = await barHeight(page);
    ok(h < 80, "the sticky bar is ONE short row (it used to be seven)", `${h}px`);
    const tops = await strip.evaluate((el) => [...new Set([...el.querySelectorAll("a")].map((a) => a.offsetTop))]);
    ok(tops.length === 1, "every chip sits on the same row", `${tops.length} row(s)`);
    const over = await strip.evaluate((el) => ({ scroll: el.scrollWidth, shown: el.clientWidth }));
    ok(over.scroll > over.shown, "more chips than fit: the row scrolls sideways instead of wrapping", `${over.scroll}px of chips in ${over.shown}px`);
    ok((await page.evaluate(() => getComputedStyle(document.querySelector('nav[aria-label="Menu categories"]')).scrollbarWidth)) === "none", "no scrollbar is drawn on it");
    await page.evaluate(() => window.scrollTo(0, 1100)); // into the menu, so the bar is stuck to the top of the screen
    await page.waitForTimeout(500);
    await page.screenshot({ path: "bar-many-desktop.png", clip: { x: 0, y: 0, width: 1280, height: 300 } });
    await page.evaluate(() => window.scrollTo(0, 0));

    const left = page.getByRole("button", { name: /scroll menu categories left/i });
    const right = page.getByRole("button", { name: /scroll menu categories right/i });
    ok((await right.isVisible()) && (await right.isEnabled()) && (await left.isVisible()) && (await left.isDisabled()), "‹ › buttons appear; ‹ is off at the start");
    const x0 = await strip.evaluate((el) => el.scrollLeft);
    await right.click();
    await page.waitForTimeout(700);
    const x1 = await strip.evaluate((el) => el.scrollLeft);
    ok(x1 > x0 + 100 && (await left.isEnabled()), "› moves the row along and turns ‹ on", `${x0} → ${x1}`);
    await left.click();
    await page.waitForTimeout(700);
    ok((await strip.evaluate((el) => el.scrollLeft)) < x1, "‹ moves it back");

    // jump to a category far along the row
    const far = names[21];
    await strip.getByRole("link", { name: far }).click();
    await page.waitForTimeout(700);
    await settle(page);
    const landed = await page.evaluate((n) => { const hh = [...document.querySelectorAll("section h2, section h3")].find((x) => x.textContent.trim().startsWith(n)); const bar = document.querySelector("[data-fx-toolbar]"); return hh ? { top: Math.round(hh.getBoundingClientRect().top), bar: Math.round(bar.getBoundingClientRect().bottom) } : null; }, far);
    ok(landed && landed.top >= landed.bar - 2 && landed.top < landed.bar + 90, "choosing it scrolls the menu to that category, just under the (short) bar", JSON.stringify(landed));
    const cur = strip.locator('[aria-current="true"]');
    ok((await cur.count()) === 1 && (await cur.innerText()).includes(far), "that chip is the highlighted one", await cur.first().innerText().catch(() => "none"));
    const inView = await strip.evaluate((el) => { const c = el.querySelector('[aria-current="true"]'); return c ? c.offsetLeft >= el.scrollLeft - 1 && c.offsetLeft + c.offsetWidth <= el.scrollLeft + el.clientWidth + 1 : false; });
    ok(inView, "…and it is scrolled into view in the row, not hidden off to the side");

    // reading down the page moves the highlight and keeps it in view
    await page.evaluate((n) => { const hh = [...document.querySelectorAll("section h2, section h3")].find((x) => x.textContent.trim().startsWith(n)); window.scrollTo(0, hh.getBoundingClientRect().top + scrollY - 62); }, names[4]);
    await page.waitForTimeout(900);
    await settle(page);
    const cur2 = await strip.locator('[aria-current="true"]').innerText().catch(() => "none");
    ok(cur2.includes(names[4]), "scrolling the page by hand moves the highlight to the category being read", cur2);
    ok(await strip.evaluate((el) => { const c = el.querySelector('[aria-current="true"]'); return c ? c.offsetLeft >= el.scrollLeft - 1 && c.offsetLeft + c.offsetWidth <= el.scrollLeft + el.clientWidth + 1 : false; }), "…and the row follows it");
    ok((await barHeight(page)) < 80, "the bar is still one short row while scrolled");

    // the last category can't reach the top of the page — it is still the one highlighted at the bottom
    await strip.getByRole("link", { name: names[MANY - 1] }).click().catch(async () => { await page.getByRole("button", { name: /scroll menu categories right/i }).click(); await strip.getByRole("link", { name: names[MANY - 1] }).click(); });
    await page.waitForTimeout(700);
    await settle(page);
    const last = await strip.locator('[aria-current="true"]').innerText().catch(() => "none");
    ok(last.includes(names[MANY - 1]), "choosing the very last category highlights it, even though the page can't scroll it to the top", last);
    ok((await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 1, "no sideways scroll on the page");
    await ctx.close();
  }

  /* ------------------------------------------------------------ tablet and phone */
  for (const [w, h, label] of [[820, 1100, "tablet"], [390, 844, "phone"]]) {
    console.log(`== ${label} ${w}px`);
    const { ctx, page } = await open({ width: w, height: h }, { isMobile: w < 500, hasTouch: true, deviceScaleFactor: 2 });
    const bh = await barHeight(page);
    ok(bh < 80, `${label}: the bar is one short row`, `${bh}px`);
    const btn = page.getByRole("button", { name: "Categories" });
    ok(await btn.isVisible(), `${label}: one Categories button`);
    const geo = await page.evaluate(() => { const bar = document.querySelector("[data-fx-toolbar]").getBoundingClientRect(); const b = document.querySelector(".ot-cat-button").getBoundingClientRect(); const f = document.querySelector(".ot-chip-row")?.getBoundingClientRect(); return { barH: bar.height, btnRight: Math.round(b.right), barRight: Math.round(bar.right), filterBottom: f ? Math.round(f.bottom) : null, btnTop: Math.round(b.top), filterTop: f ? Math.round(f.top) : null }; });
    ok(!geo.filterTop || Math.abs(geo.filterTop - geo.btnTop) < 20, `${label}: the Veg/Egg/Non-veg filter and the Categories button share the row`, JSON.stringify(geo));
    ok(geo.btnRight <= geo.barRight + 1, `${label}: the Categories button is fully on screen`);
    await page.evaluate(() => window.scrollTo(0, 1500));
    await page.waitForTimeout(500);
    await page.screenshot({ path: `bar-many-${label}.png`, clip: { x: 0, y: 0, width: w, height: 330 } });
    await page.evaluate(() => window.scrollTo(0, 0));
    await btn.click();
    const sheet = page.getByRole("dialog", { name: "Menu categories" });
    await sheet.waitFor();
    await page.waitForTimeout(400);
    const box = await sheet.boundingBox();
    ok(box.height <= h && (await sheet.getByRole("button").count()) >= MANY, `${label}: the sheet fits the screen and lists every category`, `${Math.round(box.height)}px of ${h}px, ${await sheet.getByRole("button").count()} buttons`);
    ok(await sheet.evaluate((el) => { const list = [...el.querySelectorAll("div")].find((d) => getComputedStyle(d).overflowY === "auto"); return Boolean(list) && list.scrollHeight > list.clientHeight; }), `${label}: the list inside it scrolls (there are more categories than fit)`);
    await sheet.getByRole("button", { name: new RegExp(names[20]) }).click();
    await page.waitForTimeout(700);
    await settle(page);
    const landed = await page.evaluate((n) => { const hh = [...document.querySelectorAll("section h2, section h3")].find((x) => x.textContent.trim().startsWith(n)); const bar = document.querySelector("[data-fx-toolbar]"); return hh ? { top: Math.round(hh.getBoundingClientRect().top), bar: Math.round(bar.getBoundingClientRect().bottom) } : null; }, names[20]);
    ok(landed && landed.top >= landed.bar - 2 && landed.top < landed.bar + 90, `${label}: a category picked in the sheet lands just under the bar`, JSON.stringify(landed));
    ok((await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 1, `${label}: no sideways scroll`);
    await ctx.close();
  }
} finally {
  // put the menu back exactly as it was
  const del = await call("POST", "/api/menu/categories/bulk-delete", { ids: made, deleteItems: true });
  ok(del.status === 200, "the 30 extra categories and their dishes are removed again", `${del.status}`);
  await browser.close();
}
console.log(`TOTAL ${pass} passed, ${fail} failed`);
console.log("console problems:", problems.length ? problems : "none");
ok(problems.length === 0, "the browser logged no errors or warnings");
console.log(`SUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
