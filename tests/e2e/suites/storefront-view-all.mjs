// "View all" on the storefront menu: where the button is, and how a section opens and closes.
//  - from 720px wide up it is where the store configured it (left / centre / right / beside the title) — whatever the device
//    (desktop, tablet in portrait or landscape, touch laptop);
//  - under 720px wide (a phone) it is ALWAYS under the cards, in the middle;
//  - the extra cards slide open and shut (a height animation), instead of appearing and vanishing.
// A custom menu layout with five sections is set up through the bench API, checked in Chrome, then put back.
import { chromium } from "playwright";
const SF = "http://localhost:3170";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const problems = [];

/* ------------------------------------------------------------ data, through the API */
const cookie = (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "o@acme.test", password: "Owner123!" }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const outlets = await (await fetch(`${API}/api/outlets`, { headers: { cookie } })).json();
const main = (outlets.outlets ?? outlets).find((o) => o.slug === "main");
const outletId = String(main._id ?? main.id);
const layoutBefore = main.config.menuLayout;
const call = async (method, path, body) => {
  const r = await fetch(API + path, { method, headers: { "content-type": "application/json", cookie, "x-onetap-outlet": outletId }, body: body ? JSON.stringify(body) : undefined });
  let json = {}; try { json = await r.json(); } catch {}
  return { status: r.status, json };
};
const must = (r, what) => { if (r.status >= 400) { console.error("SETUP FAILED", what, r.status, JSON.stringify(r.json).slice(0, 300)); process.exit(1); } return r; };

const made = [];
const cats = {};
for (const [key, name, n] of [["left", "VA Left", 8], ["center", "VA Center", 8], ["right", "VA Right", 8], ["title", "VA Title", 8], ["grid", "VA Grid", 9]]) {
  const id = must(await call("POST", "/api/menu/categories", { name }), name).json.category.id;
  made.push(id); cats[key] = id;
  for (let i = 1; i <= n; i++) must(await call("POST", "/api/menu/items", { categoryId: id, name: `${name} dish ${i}`, basePrice: 9000 + i * 100, foodType: "veg" }), "item");
}
const sec = (id, title, categoryId, placement, extra = {}) => ({ id, title, source: "category", categoryId, collapsible: true, initialItems: 3, viewAllPlacement: placement, ...extra });
must(await call("PATCH", `/api/outlets/${outletId}/config`, { menuLayout: { ...layoutBefore, mode: "custom", sections: [
  sec("va-left", "VA Left", cats.left, "left"),
  sec("va-center", "VA Center", cats.center, "center"),
  sec("va-right", "VA Right", cats.right, "right"),
  sec("va-title", "VA Title", cats.title, "title-right"),
  sec("va-grid", "VA Grid", cats.grid, "left", { cardVariant: "card.image-top", columns: 3, initialItems: 4 }),
] } }), "layout");

const browser = await chromium.launch();
const open = async (viewport, extra = {}) => {
  const ctx = await browser.newContext({ viewport, ...extra });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !/Failed to load resource|React DevTools|favicon/.test(m.text())) problems.push(`${viewport.width}: ${m.text().slice(0, 200)}`); });
  page.on("pageerror", (e) => problems.push(`${viewport.width} pageerror: ${String(e).slice(0, 200)}`));
  await page.goto(`${SF}/main`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForSelector("#sec-va-left", { timeout: 20000 });
  await page.waitForTimeout(400);
  return { ctx, page };
};

/** where the visible View all button of a section is, against the section and its cards */
const where = (page, id) => page.evaluate((sid) => {
  const section = document.getElementById(`sec-${sid}`);
  const box = section.getBoundingClientRect();
  const visible = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
  const btns = [...section.querySelectorAll("button")].filter((b) => /View all|Show less/.test(b.textContent) && visible(b));
  const cards = [...section.querySelectorAll("[aria-label^='Add']")];
  const heading = section.querySelector(".ot-sec-title").getBoundingClientRect();
  const b = btns[0]?.getBoundingClientRect();
  return {
    count: btns.length,
    left: b ? Math.round(b.left - box.left) : null, right: b ? Math.round(box.right - b.right) : null,
    off: b ? Math.abs(b.left + b.width / 2 - (box.left + box.width / 2)) : null,
    below: b ? b.top >= Math.max(...cards.map((c) => c.getBoundingClientRect().bottom)) - 1 : null,
    besideTitle: b ? b.top < heading.bottom + 4 && b.bottom > heading.top - 4 : null,
    cards: cards.length,
  };
}, id);

try {
  /* ------------------------------------------------------------ 1. a wide screen: as configured */
  console.log("== desktop 1280px (mouse): as configured");
  {
    const { ctx, page } = await open({ width: 1280, height: 900 });
    const L = await where(page, "va-left"), C = await where(page, "va-center"), R = await where(page, "va-right"), T = await where(page, "va-title");
    ok(L.count === 1 && L.below && L.left <= 2, "'Bottom — left': under the cards, at the left edge", JSON.stringify(L));
    ok(C.count === 1 && C.below && C.off <= 2, "'Bottom — centred': under the cards, in the middle", `${C.off.toFixed(1)}px off`);
    ok(R.count === 1 && R.below && R.right <= 2, "'Bottom — right': under the cards, at the right edge", JSON.stringify(R));
    ok(T.count === 1 && T.besideTitle && !T.below, "'Right side of the title': beside the title, and no second button under the cards", JSON.stringify(T));
    await ctx.close();
  }

  /* ------------------------------------------------------------ 2. under 720px: always under the cards, centred */
  for (const [w, h, label, extra] of [
    [390, 844, "phone", { isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
    [360, 780, "small phone", { isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
    [719, 900, "719px — one pixel under the line (mouse)", {}],
  ]) {
    console.log(`== ${label} ${w}px`);
    const { ctx, page } = await open({ width: w, height: h }, extra);
    for (const [id, what] of [["va-left", "configured left"], ["va-center", "configured centre"], ["va-right", "configured right"], ["va-title", "configured beside the title"], ["va-grid", "a grid of cards, configured left"]]) {
      const p = await where(page, id);
      ok(p.count === 1 && p.below && p.off <= 2 && !p.besideTitle, `${label}: ${what} → ONE button, under the cards, in the middle`, `${p.off?.toFixed(1)}px off centre, below=${p.below}, beside title=${p.besideTitle}`);
    }
    if (w === 390) await page.locator("#sec-va-title").screenshot({ path: "view-all-phone.png" });
    await ctx.close();
  }

  /* ------------------------------------------------------------ 2b. 720px and wider: as configured, on any device */
  for (const [w, h, label, extra] of [
    [720, 900, "720px — exactly on the line (mouse)", {}],
    [820, 1100, "tablet, portrait", { isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
    [900, 700, "a narrow desktop window (mouse)", {}],
    [1180, 820, "tablet, landscape", { isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
    [1366, 1024, "large tablet, landscape", { isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
  ]) {
    console.log(`== ${label} ${w}px`);
    const { ctx, page } = await open({ width: w, height: h }, extra);
    const L = await where(page, "va-left"), C = await where(page, "va-center"), R = await where(page, "va-right"), T = await where(page, "va-title"), G = await where(page, "va-grid");
    ok(L.count === 1 && L.below && L.left <= 2, `${label}: 'Bottom — left' stays at the left edge, under the cards`, JSON.stringify(L));
    ok(C.count === 1 && C.below && C.off <= 2, `${label}: 'Bottom — centred' is in the middle`, `${C.off?.toFixed(1)}px off`);
    ok(R.count === 1 && R.below && R.right <= 2, `${label}: 'Bottom — right' stays at the right edge`, JSON.stringify(R));
    ok(T.count === 1 && T.besideTitle && !T.below, `${label}: 'Right side of the title' stays beside the title, with no second button under the cards`, JSON.stringify(T));
    ok(G.count === 1 && G.below && G.left <= 2, `${label}: a grid of cards, configured left, keeps its button at the left`, JSON.stringify(G));
    if (w === 820) await page.locator("#sec-va-title").screenshot({ path: "view-all-tablet.png" });
    await ctx.close();
  }

  /* ------------------------------------------------------------ 3. opening and closing is animated */
  for (const [w, h, label, extra] of [[1280, 900, "desktop", {}], [390, 844, "phone", { isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
    console.log(`== animation, ${label}`);
    const { ctx, page } = await open({ width: w, height: h }, extra);
    const section = page.locator("#sec-va-left");
    const button = section.getByRole("button", { name: /View all|Show less/ }).filter({ visible: true }).first();
    const cardCount = () => section.locator("[aria-label^='Add']").count();
    /** the height of the clipping box around the cards, sampled every frame for `ms` after `act` runs */
    const sample = (act, ms = 2400) => page.evaluate(async ([act, ms]) => {
      const box = document.querySelector("#sec-va-left [aria-label^='Add']").parentElement.parentElement;
      const heights = [], times = [], fade = [];
      const start = performance.now();
      new Function(`return (${act})()`)();
      await new Promise((resolve) => {
        const tick = () => {
          heights.push(Math.round(box.getBoundingClientRect().height));
          times.push(Math.round(performance.now() - start));
          const extra = document.querySelectorAll("#sec-va-left [aria-label^='Add']")[3]; // the first dish that is not kept: it fades in
          if (extra) fade.push(Number(getComputedStyle(extra).opacity));
          performance.now() - start < ms ? requestAnimationFrame(tick) : resolve();
        };
        tick();
      });
      return { heights, times, fade };
    }, [act, ms]);
    const clickIt = `() => [...document.querySelectorAll("#sec-va-left button")].filter((b) => /View all|Show less/.test(b.textContent) && b.getClientRects().length > 0)[0].click()`;

    ok((await cardCount()) === 3, `${label}: closed, the section shows its first 3 of 8 dishes`, String(await cardCount()));
    const label0 = await button.innerText();
    ok(/View all \(5 more\)/.test(label0), `${label}: the button says how many more`, label0);
    const closedH = await section.locator("[aria-label^='Add']").first().evaluate((el) => Math.round(el.parentElement.parentElement.getBoundingClientRect().height));

    const { heights: opening, times: openTimes, fade } = await sample(clickIt);
    const openH = opening.at(-1);
    const stepsUp = [...new Set(opening)].filter((x) => x > closedH + 4 && x < openH - 4).length;
    ok(Math.abs(opening[0] - closedH) <= 6, `${label}: it starts from the closed height`, `${opening[0]}px vs ${closedH}px`);
    ok(stepsUp >= 4, `${label}: opening SLIDES — several in-between heights, not an instant jump`, `${stepsUp} in-between heights: ${[...new Set(opening)].slice(0, 8).join(", ")}…`);
    ok(opening.every((x, i) => i === 0 || x >= opening[i - 1] - 1), `${label}: and only ever grows while opening`);
    ok(openH > closedH * 1.8, `${label}: it ends fully open`, `${closedH}px → ${openH}px`);
    const settledAt = openTimes[opening.findIndex((x) => Math.abs(x - openH) <= 3)];
    ok(settledAt >= 750 && settledAt <= 2000, `${label}: opening takes long enough to WATCH (about ${(settledAt / 1000).toFixed(1)} s), without dragging`, `${settledAt} ms`);
    const mid = [...new Set(fade.map((x) => Math.round(x * 20) / 20))].filter((x) => x > 0.1 && x < 0.9);
    ok(fade[0] < 0.2 && fade.at(-1) === 1 && mid.length >= 3, `${label}: the new dishes also FADE in (opacity ${fade[0]} → ${fade.at(-1)}, ${mid.length} in-between steps)`, mid.slice(0, 6).join(", "));
    ok((await cardCount()) === 8 && /Show less/.test(await button.innerText()) && (await button.getAttribute("aria-expanded")) === "true", `${label}: all 8 dishes are there, the button says Show less`);
    ok((await section.locator("[inert]").count()) === 0, `${label}: nothing is inert once open`);

    // closing
    await page.evaluate(() => window.scrollTo(0, document.querySelector("#sec-va-left").getBoundingClientRect().top + scrollY - 80));
    await page.waitForTimeout(200);
    const closingHeights = await page.evaluate(async (act) => {
      const box = document.querySelector("#sec-va-left [aria-label^='Add']").parentElement.parentElement;
      const out = { heights: [], times: [], inertAtOnce: null };
      const start = performance.now();
      new Function(`return (${act})()`)();
      await new Promise((r) => requestAnimationFrame(r)); // the page re-renders for the click
      out.inertAtOnce = document.querySelectorAll("#sec-va-left [inert]").length;
      await new Promise((resolve) => { const tick = () => { out.heights.push(Math.round(box.getBoundingClientRect().height)); out.times.push(Math.round(performance.now() - start)); performance.now() - start < 2400 ? requestAnimationFrame(tick) : resolve(); }; tick(); });
      return out;
    }, clickIt);
    const down = closingHeights.heights;
    const stepsDown = [...new Set(down)].filter((x) => x > closedH + 4 && x < openH - 4).length;
    ok(stepsDown >= 4, `${label}: closing slides too`, `${stepsDown} in-between heights`);
    const closedAt = closingHeights.times[down.findIndex((x) => Math.abs(x - closedH) <= 3)];
    ok(closedAt >= 600 && closedAt <= 1800, `${label}: closing is visible too (about ${(closedAt / 1000).toFixed(1)} s)`, `${closedAt} ms`);
    ok(down.every((x, i) => i === 0 || x <= down[i - 1] + 1), `${label}: and only ever shrinks while closing`);
    ok(closingHeights.inertAtOnce === 1, `${label}: the leaving cards can't be tabbed into while they close`, `${closingHeights.inertAtOnce} inert group`);
    await page.waitForTimeout(150);
    ok((await cardCount()) === 3 && Math.abs(down.at(-1) - closedH) <= 6, `${label}: closed again — 3 dishes in the page, the original height`, `${await cardCount()} dishes, ${down.at(-1)}px vs ${closedH}px`);
    ok(/View all/.test(await button.innerText()) && (await button.getAttribute("aria-expanded")) === "false", `${label}: the button says View all again`);

    // pressing again in the middle of a slide
    await section.getByRole("button", { name: /View all/ }).filter({ visible: true }).first().click();
    await page.waitForTimeout(120);
    await section.getByRole("button", { name: /Show less/ }).filter({ visible: true }).first().click();
    await page.waitForTimeout(2300);
    ok((await cardCount()) === 3 && /View all/.test(await button.innerText()), `${label}: pressing twice quickly (mid-slide) turns round cleanly and ends closed`);
    await page.waitForTimeout(100);
    await ctx.close();
  }

  /* ------------------------------------------------------------ 4. things around the animation */
  console.log("== the grid layout, reduced motion and the scroll position");
  {
    const { ctx, page } = await open({ width: 1280, height: 900 });
    const grid = page.locator("#sec-va-grid");
    ok((await grid.locator("[aria-label^='Add']").count()) === 4, "a 3-column grid shows its first 4 cards");
    await grid.getByRole("button", { name: /View all/ }).filter({ visible: true }).first().click();
    await page.waitForTimeout(2000);
    const pos = await grid.locator("[aria-label^='Add']").evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top)]; }));
    ok(pos.length === 9, "…and all 9 once open", String(pos.length));
    ok(Math.abs(pos[4][1] - pos[3][1]) <= 2 && pos[4][0] > pos[3][0], "the 5th card carries on in the same row as the 4th — the opened cards flow on from the kept ones, exactly as one grid", JSON.stringify([pos[3], pos[4]]));
    await ctx.close();
  }
  {
    const { ctx, page } = await open({ width: 1280, height: 900 }, { reducedMotion: "reduce" });
    const section = page.locator("#sec-va-center");
    const heights = await page.evaluate(async () => {
      const box = document.querySelector("#sec-va-center [aria-label^='Add']").parentElement.parentElement;
      const out = [];
      const b = [...document.querySelectorAll("#sec-va-center button")].find((x) => /View all/.test(x.textContent) && x.getClientRects().length);
      const start = performance.now();
      b.click();
      await new Promise((resolve) => { const tick = () => { out.push(Math.round(box.getBoundingClientRect().height)); performance.now() - start < 400 ? requestAnimationFrame(tick) : resolve(); }; tick(); });
      return out;
    });
    ok(new Set(heights).size <= 3 && (await section.locator("[aria-label^='Add']").count()) === 8, "with 'reduce motion' switched on in the system it opens at once (no slide)", `${new Set(heights).size} distinct heights`);
    await ctx.close();
  }
  {
    // closing a long section while scrolled far below its heading brings the heading back into view
    const { ctx, page } = await open({ width: 1280, height: 900 });
    const section = page.locator("#sec-va-right");
    await section.getByRole("button", { name: /View all/ }).filter({ visible: true }).first().click();
    await page.waitForTimeout(2000);
    await page.evaluate(() => { const s = document.querySelector("#sec-va-right"); window.scrollTo(0, s.getBoundingClientRect().bottom + scrollY - 300); });
    await page.waitForTimeout(300);
    const before = await section.evaluate((el) => Math.round(el.getBoundingClientRect().top));
    await section.getByRole("button", { name: /Show less/ }).filter({ visible: true }).first().click();
    await page.waitForTimeout(3800);
    const after = await section.evaluate((el) => Math.round(el.getBoundingClientRect().top));
    ok(before < 0 && after >= 0 && after < 300, "closing a section you have scrolled far down in brings its heading back into view", `${before}px → ${after}px from the top`);
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
