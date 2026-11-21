// The storefront menu is drawn in chunks: the first screens at once, the next chunk as the diner scrolls near the end — so a
// long menu opens fast. Chrome against the bench store (Acme, /main) with 90 extra dishes in three categories. The dishes
// are put back (deleted) at the end.
import { chromium } from "playwright";
const SF = "http://localhost:3170";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const problems = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 15000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await fn()) return true; } catch { /* retry */ } await sleep(200); } return false; };

const cookie = (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "o@acme.test", password: "Owner123!" }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const outlets = await (await fetch(`${API}/api/outlets`, { headers: { cookie } })).json();
const main = (outlets.outlets ?? outlets).find((o) => o.slug === "main");
const outletId = String(main._id ?? main.id);
const call = async (method, path, body) => {
  const r = await fetch(API + path, { method, headers: { "content-type": "application/json", cookie, "x-onetap-outlet": outletId }, body: body ? JSON.stringify(body) : undefined });
  let json = {}; try { json = await r.json(); } catch {}
  return { status: r.status, json };
};
const made = { cats: [], items: [] };
// 90 plain dishes in three categories, after the dishes the bench store already has
for (const letter of ["A", "B", "C"]) {
  const cat = (await call("POST", "/api/menu/categories", { name: `Chunk ${letter}` })).json.category;
  made.cats.push(cat.id);
  for (let i = 1; i <= 30; i++) {
    const it = (await call("POST", "/api/menu/items", { categoryId: cat.id, name: `Chunk${letter} dish ${String(i).padStart(2, "0")}`, basePrice: 5000 + i * 100 })).json.item;
    made.items.push(it.id);
  }
}
const menu = await (await fetch(`${API}/api/menu?outletId=${outletId}`)).json();
const total = menu.items.filter((i) => i.isAvailable).length;
const lastCat = menu.categories.find((c) => c.name === "Chunk C");

const browser = await chromium.launch();
const cardsIn = (page) => page.locator('.ot-menu-sections [role="button"][aria-label^="Add "]').count();
const more = (page) => page.getByTestId("menu-more");
const bottom = (page) => page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
try {
  console.log("== Desktop");
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|favicon|status of 4\d\d/.test(m.text())) problems.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
  await page.goto(`${SF}/main`, { waitUntil: "load" });
  await page.locator('.ot-menu-sections [role="button"]').first().waitFor({ timeout: 25000 });
  const first = await cardsIn(page);
  ok(total > 100, "the menu has more than 100 dishes to show", `${total} dishes`);
  ok(first >= 18 && first <= 36, "the menu opens with only the first chunk of dishes drawn", `${first} of ${total}`);
  ok(await more(page).count() === 1, "…and a 'more is coming' marker at the end");

  // scrolling to the end draws chunk after chunk until everything is there
  const sizes = [first];
  for (let i = 0; i < 12 && (await more(page).count()) === 1; i++) {
    await bottom(page);
    await sleep(500);
    sizes.push(await cardsIn(page));
  }
  const final = await cardsIn(page);
  ok(sizes.some((n, i) => i > 0 && n > sizes[i - 1]) && sizes.every((n, i) => i === 0 || n >= sizes[i - 1]), "each scroll to the end draws more dishes (never fewer)", sizes.join(" → "));
  ok(await more(page).count() === 0, "once everything is drawn the marker goes away");
  ok(final === total, "every available dish ends up on the page — none are lost", `${final} of ${total}`);
  ok(new Set(await page.locator('.ot-menu-sections [role="button"][aria-label^="Add "]').evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")))).size === final, "…and none is drawn twice");

  console.log("== A category further down");
  await page.goto(`${SF}/main`, { waitUntil: "load" });
  await page.locator('.ot-menu-sections [role="button"]').first().waitFor({ timeout: 25000 });
  ok((await cardsIn(page)) < total / 2, "(back to the first chunk)");
  const chip = page.locator("nav[aria-label='Menu categories'] a, [aria-label='Menu categories'] a", { hasText: "Chunk C" }).first();
  await chip.click();
  ok(await until(async () => {
    const top = await page.evaluate((id) => document.getElementById(`sec-${id}`)?.getBoundingClientRect().top ?? 99999, lastCat.id);
    return top > -5 && top < 260;
  }, 8000), "choosing the LAST category jumps straight to it, although it hadn't been drawn yet");
  ok(await page.locator(`#sec-${lastCat.id} [role="button"]`).count() > 0, "…with its dishes drawn");
  const top = await page.evaluate((id) => document.getElementById(`sec-${id}`).getBoundingClientRect().top, lastCat.id);
  ok(top > 40 && top < 260, "…resting just under the category bar", `${Math.round(top)}px from the top`);

  console.log("== The vegetarian filter still works with chunks");
  await page.goto(`${SF}/main`, { waitUntil: "load" });
  await page.locator('.ot-menu-sections [role="button"]').first().waitFor({ timeout: 25000 });
  const vegChip = page.getByRole("button", { name: "Veg", exact: true }).first();
  if (await vegChip.count()) {
    await vegChip.click();
    await sleep(500);
    for (let i = 0; i < 12 && (await more(page).count()) === 1; i++) { await bottom(page); await sleep(400); }
    const vegDishes = menu.items.filter((i) => i.isAvailable && i.foodType === "veg").length;
    ok((await cardsIn(page)) === vegDishes, "'Veg' shows exactly the vegetarian dishes after scrolling", `${await cardsIn(page)} of ${vegDishes}`);
  } else ok(true, "(no Veg filter on this store)");
  await ctx.close();

  console.log("== A phone");
  const mctx = await browser.newContext({ viewport: { width: 375, height: 760 }, isMobile: true, hasTouch: true });
  const mp = await mctx.newPage();
  await mp.goto(`${SF}/main`, { waitUntil: "load" });
  await mp.locator('.ot-menu-sections [role="button"]').first().waitFor({ timeout: 25000 });
  const m1 = await cardsIn(mp);
  ok(m1 < total / 2 && await more(mp).count() === 1, "on a phone too the menu opens with the first chunk", `${m1} of ${total}`);
  for (let i = 0; i < 14 && (await more(mp).count()) === 1; i++) { await bottom(mp); await sleep(500); }
  ok((await cardsIn(mp)) === total, "…and scrolling brings the rest", `${await cardsIn(mp)} of ${total}`);
  await mctx.close();
} finally {
  for (const id of made.items) await call("DELETE", `/api/menu/items/${id}`);
  for (const id of made.cats) await call("DELETE", `/api/menu/categories/${id}`);
  await browser.close();
}
ok(problems.length === 0, "no errors in the browser", problems.slice(0, 3).join(" | "));
console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
