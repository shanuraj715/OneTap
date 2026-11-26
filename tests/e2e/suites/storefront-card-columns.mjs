// Menu cards resize with the screen. Every card style has a natural width; a card is drawn between 70% and 120% of it depending on how
// wide the screen is, and when a whole number of cards can't fit inside that window the NUMBER of cards in the row changes instead.
// "N cards a row", when the store sets it, is the most there may be. Every card style is put in a section set to "3 per row" (and
// some to 2 / 4 / 1, and some with no number at all), then measured in Chrome at several widths: the count must follow the rule,
// no card may be cut off, pushed past the screen or lie on top of another, and no card may be squeezed below 70%.
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
const SF = "http://localhost:3170";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const problems = [];

/* the narrowest width each card style was designed for (packages/ui/src/registry.jsx `minWidth`); its natural width is 115% of that */
const STYLES = [
  ["card.row-compact", 320], ["card.row-thumb-left", 340], ["card.row-thumb-right", 340], ["card.image-top", 240], ["card.image-top-badge", 240],
  ["card.text-above-image", 260], ["card.image-overlay", 260], ["card.portrait", 210], ["card.circle", 190], ["card.menu-line", 280],
];
const LIST_STYLES = new Set(["card.menu-line"]); // a plain column unless a number is chosen
const GAP = 12, SHRINK = 0.7, GROW = 1.2;
const baseOf = (minWidth) => Math.round(minWidth * 1.15);
/** the rule, written out again here (not imported): the number of cards in a row of width `gw` */
const rule = (gw, base, maxCols) => {
  const widthOf = (n) => (gw - (n - 1) * GAP) / n;
  const fit = Math.max(1, Math.floor((gw + GAP) / (base * SHRINK + GAP)));
  const most = Math.max(1, Math.min(fit, maxCols || 8));
  let best = 1, bestScore = Infinity;
  for (let n = 1; n <= most; n++) {
    const w = widthOf(n);
    const score = Math.abs(Math.log(w / base)) + (w > base * GROW ? 1 : 0);
    if (score < bestScore - 1e-9) { best = n; bestScore = score; }
  }
  return best;
};

/* ------------------------------------------------------------ data, through the API */
const cookie = (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "o@acme.test", password: "Owner123!" }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const outlets = await (await fetch(`${API}/api/outlets`, { headers: { cookie } })).json();
const main = (outlets.outlets ?? outlets).find((o) => o.slug === "main");
const outletId = String(main._id ?? main.id);
const layoutBefore = main.config.menuLayout;
const call = async (method, path, body) => {
  const r = await fetch(API + path, { method, headers: { "content-type": "application/json", cookie, "x-rasoipulse-outlet": outletId }, body: body ? JSON.stringify(body) : undefined });
  let json = {}; try { json = await r.json(); } catch {}
  return { status: r.status, json };
};
// a failed setup step must not leave test categories or a changed menu layout behind (the bench store is shared by later tests):
// undo what was done so far, synchronously, then stop
const made = []; // categories created so far
const undoSync = () => {
  const h = ["-s", "-X", "POST", "-H", "content-type: application/json", "-H", `cookie: ${cookie}`, "-H", `x-rasoipulse-outlet: ${outletId}`];
  try { execFileSync("curl", [...h, "-X", "PATCH", "-d", JSON.stringify({ menuLayout: layoutBefore }), `${API}/api/outlets/${outletId}/config`]); } catch { /* best effort */ }
  try { if (made.length) execFileSync("curl", [...h, "-d", JSON.stringify({ ids: made, deleteItems: true }), `${API}/api/menu/categories/bulk-delete`]); } catch { /* best effort */ }
};
const must = (r, what) => { if (r.status >= 400) { console.error("SETUP FAILED", what, r.status, JSON.stringify(r.json).slice(0, 300)); undoSync(); process.exit(1); } return r; };

const catId = must(await call("POST", "/api/menu/categories", { name: "Columns Test" }), "category").json.category.id;
made.push(catId);
for (let k = 1; k <= 9; k++) must(await call("POST", "/api/menu/items", { categoryId: catId, name: `Column dish ${k}`, description: "Crisp and golden, served hot with a long description that has to be cut off tidily when the card is narrow", basePrice: 12000 + k * 500, foodType: k % 2 ? "veg" : "non-veg" }), "item");

const sec = (id, title, cardVariant, columns) => ({ id, title, source: "category", categoryId: catId, collapsible: false, initialItems: 6, viewAllPlacement: "left", cardVariant, columns });
const sections = STYLES.map(([variant], i) => sec(`cc-${i}`, `S${i} ${variant.replace("card.", "")}`, variant, 3)); // "3 per row"
STYLES.forEach(([variant], i) => { if (!LIST_STYLES.has(variant)) sections.push(sec(`ca-${i}`, `A${i} ${variant.replace("card.", "")}`, variant, 0)); }); // no number chosen
sections.push(sec("cc-two", "Two per row", "card.image-top", 2), sec("cc-four", "Four per row", "card.image-top", 4), sec("cc-one", "One per row", "card.image-overlay", 1));
must(await call("PATCH", `/api/outlets/${outletId}/config`, { menuLayout: { ...layoutBefore, mode: "custom", sections } }), "layout");

const browser = await chromium.launch();
const open = async (width) => {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !/Failed to load resource|React DevTools|favicon/.test(m.text())) problems.push(`${width}: ${m.text().slice(0, 200)}`); });
  page.on("pageerror", (e) => problems.push(`${width} pageerror: ${String(e).slice(0, 200)}`));
  await page.goto(`${SF}/main`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForSelector("#sec-cc-0", { timeout: 20000 });
  return { ctx, page };
};
const reach = async (page, id) => {
  for (let i = 0; i < 40 && !(await page.locator(`#sec-${id}`).count()); i++) { await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(250); }
  await page.locator(`#sec-${id}`).scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
};
/** measure one section's grid: its columns, its width, whether every card stays inside it, whether two cards overlap */
const measure = async (page, id) => {
  await reach(page, id);
  return page.locator(`#sec-${id}`).evaluate((sec) => {
    const grid = [...sec.querySelectorAll("*")].find((el) => getComputedStyle(el).display === "grid" && el.children.length >= 2);
    if (!grid) return null;
    const g = grid.getBoundingClientRect();
    // the card itself (the <article> in each grid cell) — a card can be wider than its cell and still leave the cell the right size
    const cards = [...grid.children].map((c) => (c.tagName === "ARTICLE" ? c : c.querySelector("article") ?? c).getBoundingClientRect());
    const eps = 1;
    const outside = cards.filter((r) => r.right > g.right + eps || r.left < g.left - eps).length;
    let overlaps = 0;
    for (let a = 0; a < cards.length; a++) for (let b = a + 1; b < cards.length; b++) {
      const x = Math.min(cards[a].right, cards[b].right) - Math.max(cards[a].left, cards[b].left);
      const y = Math.min(cards[a].bottom, cards[b].bottom) - Math.max(cards[a].top, cards[b].top);
      if (x > 2 && y > 2) overlaps++;
    }
    const cols = getComputedStyle(grid).gridTemplateColumns.split(" ").length;
    const first = cards.filter((r) => Math.abs(r.top - cards[0].top) < 3);
    return { cols, gw: g.width, cardW: cards[0].width, outside, overlaps, cards: cards.length, firstRow: first.length, fillGap: Math.round(g.right - Math.max(...first.map((r) => r.right))) };
  });
};
const pct = (x) => `${Math.round(x * 100)}%`;

try {
  const WIDTHS = [390, 600, 744, 820, 930, 1024, 1280];
  const table = {}; // style → width → measurement
  for (const w of WIDTHS) {
    console.log(`== ${w}px wide${w <= 600 ? " (a phone)" : w < 900 ? " (a tablet in portrait)" : w < 1100 ? " (a tablet in landscape)" : " (a laptop)"}`);
    const { ctx, page } = await open(w);
    for (const [i, [variant, minWidth]] of STYLES.entries()) {
      const base = baseOf(minWidth);
      const m = await measure(page, `cc-${i}`);
      (table[variant] ??= {})[w] = m;
      const want = rule(m.gw, base, 3);
      ok(m.cols === want, `${variant}, 3 per row: ${want} here (natural width ${base}px, row ${Math.round(m.gw)}px)`, `${m.cols} columns, cards ${Math.round(m.cardW)}px = ${pct(m.cardW / base)}`);
      ok(m.outside === 0 && m.overlaps === 0, `${variant}: every card inside the row, none on top of another`, `${m.outside} outside, ${m.overlaps} overlapping`);
      ok(m.cols === 1 || m.cardW / base >= SHRINK - 0.015, `${variant}: no card squeezed below 70% of its natural width`, pct(m.cardW / base));
      if (m.cols > 1 && m.cols < 3) ok(m.cardW / base <= GROW + 0.015, `${variant}: with fewer than the chosen 3, the cards stay within 120%`, pct(m.cardW / base));
      if (m.firstRow === m.cols && m.cols > 1) ok(Math.abs(m.fillGap) <= 2, `${variant}: the cards share the whole row (no unused strip at the right)`, `${m.fillGap}px left over`);
    }
    // no number chosen: as many as the window allows
    for (const [i, [variant, minWidth]] of STYLES.entries()) {
      if (LIST_STYLES.has(variant)) continue;
      const base = baseOf(minWidth);
      const m = await measure(page, `ca-${i}`);
      const defaultCols = variant === "card.row-thumb-left" ? 3 : undefined; // this style's own default is 3 a row
      const want = rule(m.gw, base, defaultCols);
      ok(m.cols === want && m.outside === 0 && m.overlaps === 0, `${variant}, no number chosen: ${want} here, nothing cut off or overlapping`, `${m.cols} columns, cards ${pct(m.cardW / base)} of natural`);
      ok(m.cols === 1 || (m.cardW / base >= SHRINK - 0.015 && (defaultCols || m.cardW / base <= GROW + 0.015)), `${variant}, no number chosen: every card between 70% and 120% of its natural width`, pct(m.cardW / base));
    }
    const side = await page.evaluate(() => {
      const over = document.documentElement.scrollWidth - window.innerWidth;
      const wide = over > 0 ? [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1).slice(0, 3).map((e) => `${e.closest("section")?.id ?? e.tagName.toLowerCase()} ${e.tagName.toLowerCase()} → ${Math.round(e.getBoundingClientRect().right)}px (${Math.round(e.getBoundingClientRect().width)} wide)`) : [];
      const sec = document.getElementById("sec-cc-6");
      const grid = sec && [...sec.querySelectorAll("*")].find((el) => getComputedStyle(el).display === "grid" && el.children.length >= 2);
      const info = grid ? `grid ${Math.round(grid.getBoundingClientRect().width)}px, columns "${getComputedStyle(grid).gridTemplateColumns}", item widths ${[...grid.children].slice(0, 3).map((c) => Math.round(c.getBoundingClientRect().width)).join("/")}, class "${grid.className}"` : "no grid";
      const a = sec?.querySelector("article");
      const cs = a && getComputedStyle(a), ps = a && getComputedStyle(a.parentElement), gs = a && getComputedStyle(a.parentElement.parentElement);
      const deep = a ? `article[display ${cs.display}, minWidth ${cs.minWidth}, minHeight ${cs.minHeight}, aspect ${cs.aspectRatio}, width ${cs.width}] parent[${a.parentElement.tagName} display ${ps.display}, minWidth ${ps.minWidth}, width ${ps.width}] grandparent[${a.parentElement.parentElement.tagName} display ${gs.display}, width ${gs.width}]` : "";
      return { over, wide: over > 0 ? [...wide, info, deep] : wide };
    });
    ok(side.over <= 0, "the page does not scroll sideways", side.over > 0 ? `${side.over}px too wide: ${side.wide.join("; ")}` : "");
    if (w >= 744) {
      const two = await measure(page, "cc-two"), four = await measure(page, "cc-four"), one = await measure(page, "cc-one");
      ok(two.cols === rule(two.gw, baseOf(240), 2), `2 per row (image on top): ${two.cols} here`, `row ${Math.round(two.gw)}px`);
      ok(four.cols === rule(four.gw, baseOf(240), 4) && four.outside === 0, `4 per row (image on top): ${four.cols} here, nothing cut off`, `row ${Math.round(four.gw)}px`);
      ok(one.cols === 1 && one.outside === 0, "1 per row stays 1 at every width");
    }
    await ctx.close();
  }

  console.log("== The case from the report: image overlay (C07), 3 per row, on tablets");
  const o = table["card.image-overlay"];
  ok(o[390].cols === 1, "phone (390px): 1 a row", `${o[390].cols}`);
  ok(o[744].cols === 2, "tablet in portrait (744px): 2 a row — three would be squeezed below 70%", `${o[744].cols}, cards ${pct(o[744].cardW / baseOf(260))}`);
  ok(o[930].cols === 3 && o[930].outside === 0 && o[930].overlaps === 0, "930px wide (the report's screenshot): 3 a row, all inside the row (they used to overlap and run past the edge)", `${o[930].cols} columns, cards ${Math.round(o[930].cardW)}px`);
  ok(o[1024].cols === 3 && o[1280].cols === 3, "tablet in landscape and laptop: 3 a row");
  ok([744, 820, 930, 1024, 1280].every((w) => o[w].cardW / baseOf(260) >= SHRINK - 0.015), "from a tablet up, the cards are never smaller than 70% of their natural width");
} finally {
  must(await call("PATCH", `/api/outlets/${outletId}/config`, { menuLayout: layoutBefore }), "restore layout");
  const del = await call("POST", "/api/menu/categories/bulk-delete", { ids: [catId], deleteItems: true });
  ok(del.status === 200, "the test category is removed and the menu layout is put back", `${del.status}`);
  await browser.close();
}
console.log("console problems:", problems.length ? problems : "none");
ok(problems.length === 0, "the browser logged no errors or warnings");
console.log(`SUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
