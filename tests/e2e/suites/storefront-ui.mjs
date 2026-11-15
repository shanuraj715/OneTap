import { chromium } from "playwright";
const SF = "http://localhost:3170";
const browser = await chromium.launch();
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const problems = [];
const open = async (viewport, extra = {}) => {
  const ctx = await browser.newContext({ viewport, ...extra });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !/Failed to load resource|React DevTools|favicon/.test(m.text())) problems.push(`${viewport.width}: ${m.text().slice(0, 200)}`); });
  page.on("pageerror", (e) => problems.push(`${viewport.width} pageerror: ${String(e).slice(0, 200)}`));
  await page.goto(`${SF}/main`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(600);
  return { ctx, page };
};

for (const [w, h, label] of [[1280, 900, "desktop"], [820, 1100, "tablet"], [390, 844, "phone"]]) {
  console.log(`== ${label} ${w}px`);
  const { ctx, page } = await open({ width: w, height: h }, w < 1024 ? { isMobile: w < 500, hasTouch: true, deviceScaleFactor: 2 } : {});
  // 1. favicon
  if (label === "desktop") {
    const icon = await page.locator('head link[rel="icon"]').getAttribute("href").catch(() => null);
    ok(icon?.startsWith("data:image/svg+xml"), "the store's favicon is in the page head");
    await page.goto(`${SF}/second`, { waitUntil: "networkidle" });
    ok((await page.locator('head link[rel="icon"]').getAttribute("href").catch(() => null))?.startsWith("data:image/svg+xml"), "…and on the other outlet's page too");
    await page.goto(`${SF}/main`, { waitUntil: "networkidle" });
  }
  // 2. message bar height while messages take turns (every 3 s)
  const bar = page.getByRole("region", { name: "Announcement" });
  const heights = new Set(), texts = new Set();
  for (let i = 0; i < 16; i++) {
    const b = await bar.boundingBox();
    heights.add(Math.round(b.height));
    texts.add((await bar.locator('[aria-hidden]:not([aria-hidden="true"]), span:not([aria-hidden="true"]) > span').first().innerText().catch(() => "")).slice(0, 12));
    await page.waitForTimeout(450);
  }
  const visible = await bar.evaluate((el) => [...el.querySelectorAll("span")].filter((s) => getComputedStyle(s).visibility === "visible" && s.style.gridArea).map((s) => s.textContent.slice(0, 20)));
  ok(heights.size === 1, "message bar keeps one height as messages change", [...heights].join(","));
  ok(visible.length === 1, "only one message is visible at a time", JSON.stringify(visible));
  if (label === "desktop") await page.screenshot({ path: `bar-${label}.png`, clip: { x: 0, y: 0, width: w, height: 140 } });

  // 3. categories
  const chips = page.locator(".ot-cat-chips");
  const btn = page.getByRole("button", { name: "Categories" });
  if (label === "desktop") {
    ok(await chips.isVisible() && !(await btn.isVisible()), "desktop: chips, no Categories button");
    const y0 = await page.evaluate(() => scrollY);
    await chips.getByRole("link", { name: "Kurkure Momos" }).click();
    await page.waitForTimeout(250);
    ok(Math.abs((await page.evaluate(() => scrollY)) - y0) < 2, "nothing moves for the first moment after a click", `${await page.evaluate(() => scrollY)}`);
    await page.waitForTimeout(1600);
  } else {
    ok(!(await chips.isVisible()) && (await btn.isVisible()), `${label}: one Categories button instead of the chips`);
    const tb = await page.locator("[data-fx-toolbar]").boundingBox();
    ok(tb.height < 80, `${label}: the filter bar stays short`, `${Math.round(tb.height)}px`);
    await page.screenshot({ path: `cats-${label}-1.png` });
    await btn.click();
    const sheet = page.getByRole("dialog", { name: "Menu categories" });
    await sheet.waitFor();
    await page.waitForTimeout(400);
    ok((await sheet.getByRole("button").count()) >= 6, "the sheet lists every category (+ close)", String(await sheet.getByRole("button").count()));
    await page.screenshot({ path: `cats-${label}-2-sheet.png` });
    const y0 = await page.evaluate(() => scrollY);
    await sheet.getByRole("button", { name: /^Kurkure/ }).click();
    await page.waitForTimeout(250);
    ok((await sheet.count()) === 0, "picking one closes the sheet");
    ok(Math.abs((await page.evaluate(() => scrollY)) - y0) < 2, "…and waits before scrolling");
    // sample mid-flight: it should be between start and end at some point (an animation, not a jump)
    const samples = [];
    for (let i = 0; i < 14; i++) { samples.push(await page.evaluate(() => Math.round(scrollY))); await page.waitForTimeout(90); }
    const mids = new Set(samples).size;
    ok(mids >= 4, "it glides there (several in-between positions)", samples.join(","));
    await page.waitForTimeout(900);
  }
  const sec = await page.evaluate(() => { const el = [...document.querySelectorAll("section h2, section h3")].find((h) => h.textContent.trim().startsWith("Kurkure")); const bar = document.querySelector("[data-fx-toolbar]"); return el ? { top: Math.round(el.getBoundingClientRect().top), bar: Math.round(bar.getBoundingClientRect().bottom) } : null; });
  ok(sec && sec.top >= sec.bar - 2 && sec.top < sec.bar + 80, `${label}: 'Kurkure Momos' lands just below the sticky bar`, JSON.stringify(sec));
  if (label !== "desktop") await page.screenshot({ path: `cats-${label}-3-landed.png` });
  const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(ov <= 1, `${label}: no sideways scroll`, String(ov));
  await ctx.close();
}
console.log(`TOTAL ${pass} passed, ${fail} failed`);
console.log("console problems:", problems.length ? problems : "none");
await browser.close();
