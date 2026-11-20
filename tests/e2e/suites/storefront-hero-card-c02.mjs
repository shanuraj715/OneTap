// (1) The "Order takeaway" button under the store name at the top of the menu page is gone.
// (2) Item card C02 ("Thumbnail left"): the price sits right after the veg / non-veg mark, and the name and description take the card's full width.
// (3) On EVERY item card style the description stops at ONE line and ends with an ellipsis.
// Chrome against the bench store; the item card style is set through the API and put back at the end.
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
const menuLayoutBefore = main.config.menuLayout;
const patch = async (body) => {
  const r = await fetch(`${API}/api/outlets/${outletId}/config`, { method: "PATCH", headers: { "content-type": "application/json", cookie, "x-onetap-outlet": outletId }, body: JSON.stringify(body) });
  if (!r.ok) { console.error("SETUP FAILED", r.status, (await r.text()).slice(0, 300)); process.exit(1); }
};
const call = async (method, path, body) => {
  const r = await fetch(API + path, { method, headers: { "content-type": "application/json", cookie, "x-onetap-outlet": outletId }, body: body ? JSON.stringify(body) : undefined });
  let json = {}; try { json = await r.json(); } catch {}
  return { status: r.status, json };
};

// a dish with a long description and a tag, so the full-width text and the tag after the price are really tested
const cat = (await call("POST", "/api/menu/categories", { name: "C02 test" })).json.category.id;
const SENTENCE = "A deliberately long description so that the text has to wrap over several lines and we can tell how much room it was given across the card, from the picture to the right-hand edge.";
const LONG = `${SENTENCE} ${SENTENCE} ${SENTENCE}`; // far more than one line on any card, even a full-width one
const dish = (await call("POST", "/api/menu/items", { categoryId: cat, name: "C02 Paneer Tikka Platter With A Rather Long Name", description: LONG, basePrice: 18000, foodType: "veg", tags: ["spicy"] })).json.item;
const dish2 = (await call("POST", "/api/menu/items", { categoryId: cat, name: "C02 Chicken Wings", description: "Crispy wings.", basePrice: 22000, foodType: "non-veg" })).json.item;
// the menu layout's own default card style wins over the appearance setting, so set both
const setCard = (v) => patch({ layout: { ...layoutBefore, itemCardVariant: `card.${v}` }, menuLayout: { ...menuLayoutBefore, defaultCardVariant: `card.${v}` } });
await setCard("row-thumb-left");

const browser = await chromium.launch();
const open = async (opts, path = "/main") => {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  page.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !/Failed to load resource|React DevTools|favicon/.test(m.text())) problems.push(`${opts.viewport.width}: ${m.text().slice(0, 200)}`); });
  page.on("pageerror", (e) => problems.push(`${opts.viewport.width} pageerror: ${String(e).slice(0, 200)}`));
  await page.goto(SF + path, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(500);
  return { ctx, page };
};

try {
  /* ------------------------------------------------------------ 1. the top button is gone */
  for (const [label, path, opts] of [["desktop", "/main", { viewport: { width: 1440, height: 900 } }], ["phone", "/main", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }], ["the other outlet", "/second", { viewport: { width: 1440, height: 900 } }]]) {
    console.log(`== top of the menu page: ${label}`);
    const { ctx, page } = await open(opts, path);
    const hero = await page.evaluate(() => {
      const h1 = document.querySelector("h1");
      const sec = h1?.closest("section");
      return { links: sec ? sec.querySelectorAll("a, button").length : -1, text: sec?.innerText.replace(/\s+/g, " ") ?? "", page: /Order takeaway/i.test(document.body.innerText) };
    });
    ok(hero.links === 0, `${label}: the area under the store name has no button or link`, hero.text);
    ok(!hero.page, `${label}: "Order takeaway" appears nowhere on the page`);
    const still = await page.evaluate(() => Boolean(document.querySelector('[data-sticky="bar"]') ?? document.querySelector('section[aria-label="How would you like your order?"]')));
    ok(still, `${label}: the Takeaway / Delivery order bar is still there (only the extra button went)`);
    await ctx.close();
  }

  /* ------------------------------------------------------------ 2. card C02 */
  for (const [label, opts] of [["desktop", { viewport: { width: 1440, height: 900 } }], ["phone", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }]]) {
    console.log(`== card C02: ${label}`);
    const { ctx, page } = await open(opts);
    const cards = await page.evaluate(() => [...document.querySelectorAll("article.ot-fx-card")].filter((a) => /C02 /.test(a.innerText)).map((a) => {
      const box = a.getBoundingClientRect();
      const col = [...a.children].filter((c) => c.tagName === "DIV").pop(); // the text column (the picture is the first child)
      const top = col.children[0], name = col.children[1], desc = col.children[2];
      const kids = [...top.children].map((k) => ({ text: k.textContent.trim(), r: k.getBoundingClientRect() }));
      const mark = kids[0], price = kids.find((k) => /₹/.test(k.text)), tag = kids.find((k) => /spicy/i.test(k.text));
      const photo = a.children[0].getBoundingClientRect();
      const rect = (el) => el?.getBoundingClientRect();
      return {
        name: name.textContent.trim().slice(0, 30),
        children: [...a.children].length,
        priceAfterMark: Boolean(price) && price.r.left >= mark.r.right - 1 && Math.abs((price.r.top + price.r.height / 2) - (mark.r.top + mark.r.height / 2)) < 8,
        priceText: price?.text,
        tagAfterPrice: tag ? tag.r.left >= price.r.right - 1 : null,
        nameRight: Math.round(box.right - rect(name).right),
        descRight: desc ? Math.round(box.right - rect(desc).right) : null,
        descLines: desc ? Math.round(rect(desc).height / parseFloat(getComputedStyle(desc).lineHeight || 16)) : 0,
        textLeft: Math.round(rect(name).left - photo.right),
        photo: [Math.round(photo.width), Math.round(photo.height)],
        priceTopBelowName: price ? price.r.top >= rect(name).top : null,
        pad: parseFloat(getComputedStyle(a).paddingRight),
        over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    }));
    ok(cards.length === 2, `${label}: both test dishes are shown in the Thumbnail-left card`, String(cards.length));
    for (const c of cards) {
      ok(c.priceAfterMark, `${label}: "${c.name}" — the price (${c.priceText}) comes right after the veg / non-veg mark, on the same line`, JSON.stringify(c));
      ok(c.priceTopBelowName === false, `${label}: "${c.name}" — the price is above the title, not beside it at the edge`);
      ok(c.nameRight <= c.pad + 2, `${label}: "${c.name}" — the title runs to the card's right padding (${c.nameRight}px from the edge, padding ${c.pad}px)`);
      if (c.descRight != null) ok(c.descRight <= c.pad + 2, `${label}: "${c.name}" — the description takes the full width too (${c.descRight}px from the edge)`);
      ok(c.photo[0] === 72 && c.photo[1] === 72, `${label}: "${c.name}" — the thumbnail is still 72×72 at the left`, c.photo.join("×"));
    }
    const long = cards.find((c) => /Paneer/.test(c.name)); // the dish with the long description and the "spicy" tag (dishes are listed alphabetically)
    ok(long?.tagAfterPrice === true, `${label}: the "spicy" tag follows the price`, String(long?.tagAfterPrice));
    ok(long?.descLines === 1, `${label}: the very long description is cut at ONE line, inside the wide column`, `${long?.descLines} lines`);
    ok(cards.every((c) => c.over <= 1), `${label}: no sideways scroll`, String(cards[0].over));
    await page.locator("article.ot-fx-card", { hasText: "C02 Paneer Tikka" }).first().screenshot({ path: `c02-${label}.png` });
    await ctx.close();
  }

  /* ------------------------------------------------------------ 3. every card style: one line, then an ellipsis */
  console.log("== every item card style: the description stops at ONE line");
  const VARIANTS = [["row-compact", "C01"], ["row-thumb-left", "C02"], ["row-thumb-right", "C03"], ["image-top", "C04"], ["image-top-badge", "C05"], ["text-above-image", "C06"], ["image-overlay", "C07"], ["portrait", "C08"], ["circle", "C09"], ["menu-line", "C10"], ["featured-wide", "C11"]];
  const NO_DESCRIPTION = new Set(["portrait", "circle"]); // these two styles show no description at all
  for (const [v, code] of VARIANTS) {
    await setCard(v);
    const { ctx, page } = await open({ viewport: { width: 1440, height: 900 } });
    const probe = (text) => page.evaluate((t) => {
      const el = [...document.querySelectorAll("article *")].find((e) => e.children.length === 0 && e.textContent.trim() === t);
      if (!el) return null;
      const cs = getComputedStyle(el);
      const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.45;
      return { lines: Math.round((el.getBoundingClientRect().height / lh) * 10) / 10, clamp: cs.webkitLineClamp, cut: el.scrollHeight > el.clientHeight + 1 };
    }, text);
    const long = await probe(LONG), short = await probe("Crispy wings.");
    if (NO_DESCRIPTION.has(v)) {
      ok(long === null, `${code} ${v}: this card style shows no description (nothing to cut)`);
    } else {
      ok(long && long.lines <= 1.05 && long.clamp === "1", `${code} ${v}: a very long description is held to ONE line`, JSON.stringify(long));
      ok(long && long.cut, `${code} ${v}: the rest is cut off (that is where the … shows)`, JSON.stringify(long));
      ok(short && short.lines <= 1.05 && !short.cut, `${code} ${v}: a short description is left alone, on one line`, JSON.stringify(short));
    }
    await ctx.close();
  }
  // the pop-up that opens when a dish is chosen still has the WHOLE description
  await setCard("row-compact");
  {
    const { ctx, page } = await open({ viewport: { width: 1440, height: 900 } });
    await page.locator("article.ot-fx-card", { hasText: "C02 Paneer Tikka" }).first().click();
    await page.waitForTimeout(600);
    const dlg = await page.getByRole("dialog").first().innerText();
    ok(dlg.includes(LONG.slice(-60)), "the dish pop-up still shows the full description, not the shortened one", dlg.replace(/\s+/g, " ").slice(-90));
    await ctx.close();
  }
} finally {
  await patch({ layout: layoutBefore, menuLayout: menuLayoutBefore });
  const del = await call("POST", "/api/menu/categories/bulk-delete", { ids: [cat], deleteItems: true });
  ok(del.status === 200, "the test dishes are removed and the card style is put back", `${del.status}`);
  await browser.close();
}
console.log("console problems:", problems.length ? problems : "none");
ok(problems.length === 0, "the browser logged no errors or warnings");
console.log(`SUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
