// The storefront menu: (1) a dish that can't be ordered right now (sold out) goes to the END of its category — a category of 15 with one
// sold-out dish shows the 14 orderable ones first and that one 15th; (2) after a Veg / Non-veg filter the "View all" button only stays
// while more dishes are left than the first few (15 dishes cut to 3 → no button). A custom menu layout and its dishes are set up through
// the bench API, checked in Chrome on a desktop and a phone, then removed.
import { chromium } from "playwright";
const SF = "http://localhost:3170";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const problems = [];
const pad = (n) => String(n).padStart(2, "0");

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
const must = (r, what) => { if (r.status >= 400) { console.error("SETUP FAILED", what, r.status, JSON.stringify(r.json).slice(0, 300)); process.exit(1); } return r; };

const made = [];
const items = {}; // "SOLD 02" → id
/** a category with `count` dishes named "<prefix> dish 01…"; foodType(k) and price(k) decide each dish */
const makeCategory = async (key, title, prefix, count, { foodType = () => "veg", price = (k) => 9000 + k * 100 } = {}) => {
  const id = must(await call("POST", "/api/menu/categories", { name: title }), title).json.category.id;
  made.push(id);
  for (let k = 1; k <= count; k++) {
    const r = must(await call("POST", "/api/menu/items", { categoryId: id, name: `${prefix} dish ${pad(k)}`, basePrice: price(k), foodType: foodType(k) }), "item");
    items[`${prefix} ${pad(k)}`] = r.json.item?.id ?? r.json.item?._id ?? r.json.id;
  }
  return id;
};
const cat = {
  sold: await makeCategory("sold", "SO Sold", "SOLD", 15),
  plain: await makeCategory("plain", "SO Plain", "PLAIN", 8),
  cap: await makeCategory("cap", "SO Capped", "CAP", 10),
  price: await makeCategory("price", "SO Price", "PRICE", 6),
  fa: await makeCategory("fa", "VF A", "FA", 15, { foodType: (k) => ([3, 8, 13].includes(k) ? "veg" : "non-veg") }),   // 3 veg, 12 non-veg
  fb: await makeCategory("fb", "VF B", "FB", 8, { foodType: (k) => (k <= 6 ? "veg" : "non-veg") }),                       // exactly 6 veg
  fc: await makeCategory("fc", "VF C", "FC", 9, { foodType: (k) => (k <= 7 ? "veg" : "non-veg") }),                       // 7 veg
  fd: await makeCategory("fd", "VF D", "FD", 9, { foodType: (k) => (k <= 2 ? "veg" : "non-veg") }),                       // 2 veg, button beside the title
};
const setAvailable = async (key, on) => must(await call("PATCH", `/api/menu/items/${items[key]}`, { isAvailable: on }), `${key} ${on ? "on" : "off"}`);
await setAvailable("SOLD 02", false);
await setAvailable("SOLD 07", false);
await setAvailable("CAP 01", false);
await setAvailable("CAP 02", false);
await setAvailable("PRICE 06", false); // the dearest one

const sec = (id, title, categoryId, extra = {}) => ({ id, title, source: "category", categoryId, collapsible: false, initialItems: 6, viewAllPlacement: "left", ...extra });
must(await call("PATCH", `/api/outlets/${outletId}/config`, { menuLayout: { ...layoutBefore, mode: "custom", showFoodTypeFilter: true, sections: [
  sec("so-sold", "SO Sold", cat.sold, { collapsible: true }),
  sec("so-plain", "SO Plain", cat.plain),
  sec("so-cap", "SO Capped", cat.cap, { maxItems: 5 }),
  sec("so-price", "SO Price", cat.price, { sortBy: "price-desc" }),
  sec("vf-a", "VF A", cat.fa, { collapsible: true }),
  sec("vf-b", "VF B", cat.fb, { collapsible: true }),
  sec("vf-c", "VF C", cat.fc, { collapsible: true }),
  sec("vf-d", "VF D", cat.fd, { collapsible: true, viewAllPlacement: "title-right" }),
] } }), "layout");

const browser = await chromium.launch();
const open = async (viewport) => {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !/Failed to load resource|React DevTools|favicon/.test(m.text())) problems.push(`${viewport.width}: ${m.text().slice(0, 200)}`); });
  page.on("pageerror", (e) => problems.push(`${viewport.width} pageerror: ${String(e).slice(0, 200)}`));
  await page.goto(`${SF}/main`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForSelector("#sec-so-sold", { timeout: 20000 });
  return { ctx, page };
};
/** the menu draws in chunks as you scroll — go down until the section exists */
const reach = async (page, id) => {
  for (let i = 0; i < 40 && !(await page.locator(`#sec-${id}`).count()); i++) { await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(250); }
  await page.locator(`#sec-${id}`).scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
};
/** the dish names drawn in a section, in the order they appear (each once) */
const names = async (page, id) => { await reach(page, id); return page.locator(`#sec-${id}`).evaluate((el) => [...new Set(el.innerText.match(/\b[A-Za-z]+ dish \d\d\b/g) ?? [])]); };
const soldOutLabels = async (page, id) => page.locator(`#sec-${id}`).evaluate((el) => (el.innerText.match(/Sold out/g) ?? []).length);
/** the visible View all / Show less buttons of a section (a section with the button beside its title has a hidden twin under the cards) */
const buttons = async (page, id) => { await reach(page, id); return page.locator(`#sec-${id} button`).evaluateAll((bs) => bs.filter((b) => /View all|Show less/.test(b.textContent) && b.getClientRects().length > 0 && getComputedStyle(b).visibility !== "hidden").map((b) => b.textContent.trim())); };
const chip = (page, label) => page.locator(".ot-filter-chip").filter({ hasText: new RegExp(`^${label}$`) }).first();
const list = (a) => a.map((n) => n.split(" ").pop()).join(" ");

try {
  console.log("== Sold-out dishes go to the end of their category (desktop 1280px)");
  {
    const { ctx, page } = await open({ width: 1280, height: 900 });
    let n = await names(page, "so-sold");
    ok(n.length === 6 && !n.some((x) => /0[27]$/.test(x)), "a category of 15 with 2 sold-out dishes, closed: the first 6 shown are all orderable (01 03 04 05 06 08 — not 02 or 07)", list(n));
    ok((await soldOutLabels(page, "so-sold")) === 0, "…and none of the first 6 says 'Sold out'");
    ok(/View all \(9 more\)/.test((await buttons(page, "so-sold"))[0] ?? ""), "the button counts the rest: View all (9 more)", (await buttons(page, "so-sold")).join());
    await page.locator("#sec-so-sold button").filter({ hasText: /View all/ }).filter({ visible: true }).first().click();
    await page.waitForTimeout(2200);
    n = await names(page, "so-sold");
    ok(n.length === 15 && list(n) === "01 03 04 05 06 08 09 10 11 12 13 14 15 02 07", "opened: the 13 orderable dishes in their own order, then the two sold-out ones last (…15, 02, 07)", list(n));
    ok((await soldOutLabels(page, "so-sold")) === 2, "exactly two dishes say 'Sold out'");
    const ys = await page.locator("#sec-so-sold").evaluate((el) => {
      const at = (name) => { const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let t; while ((t = w.nextNode())) if (t.textContent.includes(name)) { const r = document.createRange(); r.selectNodeContents(t); return r.getBoundingClientRect(); } return null; };
      const last = at("SOLD dish 15"), s2 = at("SOLD dish 02"), s7 = at("SOLD dish 07");
      return { afterLast: s2 && last && (s2.top > last.top || (s2.top === last.top && s2.left > last.left)), order: s7 && s2 && (s7.top > s2.top || (s7.top === s2.top && s7.left > s2.left)) };
    });
    ok(ys.afterLast && ys.order, "on screen too: the sold-out dishes sit after dish 15, dish 02 before dish 07");
    n = await names(page, "so-plain");
    ok(list(n) === "01 02 03 04 05 06 07 08", "a category with nothing sold out keeps its normal order (01 … 08)", list(n));
    n = await names(page, "so-cap");
    ok(list(n) === "03 04 05 06 07" && (await soldOutLabels(page, "so-cap")) === 0, "a section capped at 5 dishes is filled with orderable ones first (03 … 07), not with the two sold-out dishes at the top", list(n));
    n = await names(page, "so-price");
    ok(list(n) === "05 04 03 02 01 06", "sorted by price (high to low): that order holds, and the dearest dish — sold out — drops to the end", list(n));
    ok((await soldOutLabels(page, "so-price")) === 1, "…with its 'Sold out' label");
    await ctx.close();
  }
  console.log("== A dish that comes back is put back where it belongs");
  {
    await setAvailable("SOLD 02", true);
    const { ctx, page } = await open({ width: 1280, height: 900 });
    const n = await names(page, "so-sold");
    ok(list(n) === "01 02 03 04 05 06", "dish 02 orderable again → it is back among the first six (01 … 06) after a reload", list(n));
    await ctx.close();
    await setAvailable("SOLD 02", false);
  }

  console.log("== 'View all' follows the filter (desktop 1280px)");
  {
    const { ctx, page } = await open({ width: 1280, height: 900 });
    const state = async () => ({ A: await buttons(page, "vf-a"), B: await buttons(page, "vf-b"), C: await buttons(page, "vf-c"), D: await buttons(page, "vf-d"), S: await buttons(page, "so-sold") });
    let s = await state();
    ok(/View all \(9 more\)/.test(s.A[0]) && /\(2 more\)/.test(s.B[0]) && /\(3 more\)/.test(s.C[0]) && /\(3 more\)/.test(s.D[0]), "no filter: the four long categories each have a View all button", JSON.stringify(s));
    await chip(page, "Veg").click();
    await page.waitForTimeout(400);
    s = await state();
    ok((await names(page, "vf-a")).length === 3 && s.A.length === 0, "Veg: category A (15 dishes) is down to 3 → all 3 are shown and there is NO View all button", `${(await names(page, "vf-a")).length} dishes, buttons: ${s.A.join() || "none"}`);
    ok((await names(page, "vf-b")).length === 6 && s.B.length === 0, "Veg: category B is down to exactly 6 (the first-few limit) → no button", `${(await names(page, "vf-b")).length} dishes, buttons: ${s.B.join() || "none"}`);
    ok((await names(page, "vf-c")).length === 6 && s.C.length === 1 && /\(1 more\)/.test(s.C[0]), "Veg: category C is down to 7 → 6 shown and View all (1 more)", `${(await names(page, "vf-c")).length} dishes, buttons: ${s.C.join() || "none"}`);
    ok(s.D.length === 0 && (await names(page, "vf-d")).length === 2, "Veg: category D (button beside the title) is down to 2 → that button is gone too", `buttons: ${s.D.join() || "none"}`);
    ok(s.S.length === 1 && /\(9 more\)/.test(s.S[0]), "Veg: the all-veg category (15 left) keeps its View all (9 more)", s.S.join());
    await page.locator("#sec-vf-c button").filter({ hasText: /View all/ }).filter({ visible: true }).first().click();
    await page.waitForTimeout(2000);
    ok((await names(page, "vf-c")).length === 7 && /Show less/.test((await buttons(page, "vf-c"))[0] ?? ""), "…and it still opens (7 dishes, 'Show less')");
    await chip(page, "Non-veg").click();
    await page.waitForTimeout(400);
    const nonVegA = await buttons(page, "vf-a");
    ok(/View all \(6 more\)/.test(nonVegA[0] ?? "") && (await names(page, "vf-a")).length === 6, "Non-veg: category A has 12 left → View all (6 more), first 6 shown", `${nonVegA.join() || "none"}`);
    ok((await page.locator("#sec-so-sold").count()) === 0, "…and the all-veg category is gone from a Non-veg menu (nothing left in it)");
    await chip(page, "All").click();
    await page.waitForTimeout(400);
    s = await state();
    ok(s.A.length === 1 && s.B.length === 1 && s.C.length === 1 && s.D.length === 1, "All: every View all button is back", JSON.stringify(s));
    await ctx.close();
  }

  console.log("== The same on a phone (390px wide)");
  {
    const { ctx, page } = await open({ width: 390, height: 844 });
    const A = async () => (await buttons(page, "vf-a")).length;
    ok((await A()) === 1, "no filter: category A has View all (under the cards)");
    await chip(page, "Veg").click();
    await page.waitForTimeout(400);
    ok((await A()) === 0 && (await names(page, "vf-a")).length === 3, "Veg: category A shows its 3 dishes and no View all button");
    ok((await buttons(page, "vf-d")).length === 0, "Veg: category D has no button either");
    ok((await buttons(page, "vf-c")).length === 1, "Veg: category C (7 left) still has one");
    const n = await names(page, "so-sold");
    ok(n.length === 6 && !n.some((x) => /0[27]$/.test(x)), "the first six of the 15-dish category are the orderable ones on a phone too", list(n));
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
