// "N cards a row" on the storefront menu is a MAXIMUM. A row holds that many only while every card keeps at least its own minimum
// width; on a narrower screen (a tablet in portrait, a phone) it holds fewer — 3 → 2 → 1 — and nothing is cut off or pushed past the
// screen (a phone one, a tablet in portrait at most two). Every card style is put in a section set to "3 per row" (and some to 2 / 4), then measured in Chrome at several widths.
import { chromium } from "playwright";
const SF = "http://localhost:3170";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const problems = [];

/* the smallest width each card style is happy with (packages/ui/src/registry.jsx `minWidth`; list styles fall back to 280) */
const STYLES = [
  ["card.row-compact", 320], ["card.row-thumb-left", 340], ["card.row-thumb-right", 340], ["card.image-top", 240], ["card.image-top-badge", 240],
  ["card.text-above-image", 260], ["card.image-overlay", 260], ["card.portrait", 210], ["card.circle", 190], ["card.menu-line", 280],
];
const GAP = 12;
/** how many columns a grid of width `gw` should have for `n` per row and a card style whose auto-grid minimum is `autoMin`:
 *  the rule uses 97% of that minimum (so three 340px cards still fit the 1032px menu area of a laptop) */
/** the number the store chose, as the screen allows it: a phone (≤720px) one, a tablet in portrait (721–960px) at most two */
const perRow = (w, n) => (w <= 720 ? 1 : w <= 960 ? Math.min(n, 2) : n);
const expectedCols = (gw, n, autoMin) => {
  const min = Math.round(autoMin * 0.97);
  const trackMin = Math.max(min, (gw - (n - 1) * GAP) / n - 0.5);
  return Math.max(1, Math.min(n, Math.floor((gw + GAP) / (trackMin + GAP))));
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
import { execFileSync } from "node:child_process";
const made = []; // categories created so far
const undoSync = () => {
  const h = ["-s", "-X", "POST", "-H", "content-type: application/json", "-H", `cookie: ${cookie}`, "-H", `x-rasoipulse-outlet: ${outletId}`];
  try { execFileSync("curl", [...h, "-X", "PATCH", "-d", JSON.stringify({ menuLayout: layoutBefore }), `${API}/api/outlets/${outletId}/config`]); } catch { /* best effort */ }
  try { if (typeof made !== "undefined" && made.length) execFileSync("curl", [...h, "-d", JSON.stringify({ ids: made, deleteItems: true }), `${API}/api/menu/categories/bulk-delete`]); } catch { /* best effort */ }
};
const must = (r, what) => { if (r.status >= 400) { console.error("SETUP FAILED", what, r.status, JSON.stringify(r.json).slice(0, 300)); undoSync(); process.exit(1); } return r; };

const catId = must(await call("POST", "/api/menu/categories", { name: "Columns Test" }), "category").json.category.id;
made.push(catId);
for (let k = 1; k <= 7; k++) must(await call("POST", "/api/menu/items", { categoryId: catId, name: `Column dish ${k}`, description: "Crisp and golden, served hot with a long description that has to be cut off tidily when the card is narrow", basePrice: 12000 + k * 500, foodType: k % 2 ? "veg" : "non-veg" }), "item");

const sec = (id, title, cardVariant, columns) => ({ id, title, source: "category", categoryId: catId, collapsible: false, initialItems: 6, viewAllPlacement: "left", cardVariant, columns });
const sections = STYLES.map(([variant], i) => sec(`cc-${i}`, `S${i} ${variant.replace("card.", "")}`, variant, 3));
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
  await page.waitForTimeout(120);
};
/** measure one section's grid: its columns, its width, whether every card stays inside it, whether two cards overlap */
const measure = async (page, id) => {
  await reach(page, id);
  return page.locator(`#sec-${id}`).evaluate((sec) => {
    const grid = [...sec.querySelectorAll("*")].find((el) => getComputedStyle(el).display === "grid" && el.children.length >= 2);
    if (!grid) return null;
    const g = grid.getBoundingClientRect();
    const cs = getComputedStyle(grid);
    const cards = [...grid.children].map((c) => c.getBoundingClientRect());
    const eps = 1;
    const outside = cards.filter((r) => r.right > g.right + eps || r.left < g.left - eps).length;
    let overlaps = 0;
    for (let a = 0; a < cards.length; a++) for (let b = a + 1; b < cards.length; b++) {
      const x = Math.min(cards[a].right, cards[b].right) - Math.max(cards[a].left, cards[b].left);
      const y = Math.min(cards[a].bottom, cards[b].bottom) - Math.max(cards[a].top, cards[b].top);
      if (x > 2 && y > 2) overlaps++;
    }
    const cols = cs.gridTemplateColumns.split(" ").length;
    const first = cards.filter((r) => Math.abs(r.top - cards[0].top) < 3);
    const rowRight = Math.max(...first.map((r) => r.right));
    return { cols, gw: g.width, outside, overlaps, cards: cards.length, firstRow: first.length, fillGap: Math.round(g.right - rowRight), pageOverflow: document.documentElement.scrollWidth - window.innerWidth };
  });
};

try {
  const WIDTHS = [390, 744, 820, 1024, 1280];
  const table = {}; // style → width → measurement
  for (const w of WIDTHS) {
    console.log(`== ${w}px wide${w <= 720 ? " (a phone)" : w < 900 ? " (a tablet in portrait)" : w < 1100 ? " (a tablet in landscape)" : " (a laptop)"}`);
    const { ctx, page } = await open(w);
    for (const [i, [variant, min]] of STYLES.entries()) {
      const m = await measure(page, `cc-${i}`);
      (table[variant] ??= {})[w] = m;
      const want = w <= 720 ? 1 : expectedCols(m.gw, perRow(w, 3), min);
      ok(m.cols === want, `${variant}, 3 per row: ${want} column${want > 1 ? "s" : ""} here (minimum card ${min}px, row ${Math.round(m.gw)}px)`, `${m.cols} columns`);
      ok(m.outside === 0 && m.overlaps === 0, `${variant}: every card inside the row, none on top of another`, `${m.outside} outside, ${m.overlaps} overlapping`);
      if (m.firstRow === m.cols && m.cols > 1) ok(Math.abs(m.fillGap) <= 2, `${variant}: the cards share the whole row (no unused strip at the right)`, `${m.fillGap}px left over`);
    }
    ok((await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0, "the page does not scroll sideways");
    if (w >= 744) {
      const two = await measure(page, "cc-two"), four = await measure(page, "cc-four"), one = await measure(page, "cc-one");
      ok(two.cols === (w <= 720 ? 1 : expectedCols(two.gw, perRow(w, 2), 240)), `2 per row (image on top): ${two.cols} here`, `row ${Math.round(two.gw)}px`);
      ok(four.cols === expectedCols(four.gw, perRow(w, 4), 240) && four.outside === 0, `4 per row (image on top): only as many as fit — ${four.cols} here, nothing cut off`, `row ${Math.round(four.gw)}px`);
      ok(one.cols === 1 && one.outside === 0, "1 per row stays 1 at every width");
    }
    await ctx.close();
  }

  console.log("== The case from the report: image overlay, 3 per row, on a tablet");
  const o = table["card.image-overlay"];
  ok(o[820].cols === 2 && o[744].cols === 2, "portrait tablet (744 / 820px): 2 cards a row, not 3 squeezed or cut off", `${o[744].cols} / ${o[820].cols}`);
  ok(o[1024].cols === 3 && o[1024].outside === 0 && o[1024].overlaps === 0, "landscape tablet (1024px): 3 cards a row, all inside the row (they used to run past the right edge and overlap)", `${o[1024].cols} columns`);
  ok(o[1280].cols === 3, "laptop (1280px): 3 a row");
  ok(o[390].cols === 1, "phone: 1 a row");
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
