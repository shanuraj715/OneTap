// A dish's pictures in four shapes, in Chrome against the bench store (Acme Momos, Main):
//  - the dish form has four photo sections (square — the default — landscape 4:3, wide 16:9, portrait 3:4); a picture is
//    uploaded into each, replaced, trimmed-warned, pasted into the chosen one, removed; saving keeps the dish's own square
//    pictures untouched;
//  - on the storefront every card style shows the picture of ITS shape, and falls back to the square one when the dish
//    has none for it; the dish pop-up shows the wide picture.
// What it changes on the bench is put back at the end.
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
const AD = "http://localhost:3171";
const SF = "http://localhost:3170";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const problems = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** a solid-colour PNG of any size, made here so the test needs no image file */
function makePng(name, w, h, rgb) {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const body = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(body)); return Buffer.concat([len, body, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w }, () => rgb).flat())]);
  const rawBytes = Buffer.concat(Array.from({ length: h }, () => row));
  const path = join(tmpdir(), name);
  writeFileSync(path, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(rawBytes)), chunk("IEND", Buffer.alloc(0))]));
  return path;
}
const PNG = {
  land: makePng("shape-land.png", 400, 300, [200, 60, 60]),
  land2: makePng("shape-land2.png", 400, 300, [60, 160, 60]),
  squareForLand: makePng("shape-sq-in-land.png", 300, 300, [60, 60, 200]),
  wide: makePng("shape-wide.png", 640, 360, [200, 160, 40]),
  tall: makePng("shape-tall.png", 300, 400, [140, 60, 180]),
};

const cookie = (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "o@acme.test", password: "Owner123!" }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const outlets = await (await fetch(`${API}/api/outlets`, { headers: { cookie } })).json();
const main = (outlets.outlets ?? outlets).find((o) => o.slug === "main");
const outletId = String(main._id ?? main.id);
const layoutBefore = main.config.layout;
const menuLayoutBefore = main.config.menuLayout;
const call = async (method, path, body) => {
  const r = await fetch(API + path, { method, headers: { "content-type": "application/json", cookie, "x-onetap-outlet": outletId }, body: body ? JSON.stringify(body) : undefined });
  let json = {}; try { json = await r.json(); } catch {}
  return { status: r.status, json };
};
const patchConfig = (body) => call("PATCH", `/api/outlets/${outletId}/config`, body);
const menuNow = async () => (await (await fetch(`${API}/api/menu?outletId=${outletId}`)).json());
const dish = (await menuNow()).items.find((i) => i.name === "Veg Steamed Momos");
const originalImages = dish.images;
// The bench dish has no pictures, so give it two SQUARE ones first — like the ones every real dish already has — and check
// they are never touched by anything below.
const seeded = [
  { url: "https://img.test/own-sq-1.png", key: "menu-items/own-sq-1.png", width: 800, height: 800 },
  { url: "https://img.test/own-sq-2.png", key: "menu-items/own-sq-2.png", width: 800, height: 800 },
];
{
  const r = await fetch(`${API}/api/menu/items/${dish.id}`, { method: "PATCH", headers: { "content-type": "application/json", cookie, "x-onetap-outlet": outletId }, body: JSON.stringify({ images: seeded }) });
  if (!r.ok) { console.error("SETUP FAILED", r.status); process.exit(1); }
}
const squareKeysBefore = seeded.map((i) => i.key);
const made = { items: [], categories: [] };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1360, height: 1000 } });
await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: AD });
const page = await ctx.newPage();
page.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !/Failed to load resource|React DevTools|favicon|WebSocket|img\.test/.test(m.text())) problems.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
const dishNow = async () => (await menuNow()).items.find((i) => i.id === dish.id);
const of = (item, ratio) => item.images.filter((i) => (i.ratio ?? "1:1") === ratio);

try {
  /* ------------------------------------------------------------ the dish form */
  console.log("== The dish form has four photo sections");
  await page.goto(AD + "/", { waitUntil: "load" });
  await page.fill('input[type="email"]', "o@acme.test"); await page.fill('input[type="password"]', "Owner123!");
  await page.getByRole("button", { name: /sign in|log in/i }).first().click();
  await page.waitForSelector("text=Orders");
  await page.goto(AD + "/menu", { waitUntil: "load" });
  await page.locator('[data-testid="cat-row"][data-category="Steamed Momos"] button', { hasText: "Steamed Momos" }).first().click();
  const row = page.locator('[data-testid="item-row"][data-item="Veg Steamed Momos"]');
  await row.waitFor();
  await row.getByTitle("Edit").click();
  await page.getByTestId("item-photo-slots").waitFor();
  for (const r of ["1:1", "4:3", "16:9", "3:4"]) ok(await page.getByTestId(`photo-slot-${r}`).isVisible(), `a ${r} section is there`);
  ok(/default/i.test(await page.getByTestId("photo-slot-1:1").innerText()) && /square/i.test(await page.getByTestId("photo-slot-1:1").innerText()), "the square section is marked Default");
  ok(/square 1:1/.test(await page.getByTestId("paste-target").innerText()), "Ctrl+V is aimed at the square section until another is chosen");
  ok((await page.getByTestId("item-photo").count()) === squareKeysBefore.length, `the dish's own ${squareKeysBefore.length} square picture(s) are all in the square section`, String(await page.getByTestId("item-photo").count()));
  ok((await page.getByTestId("item-photo-4:3").count()) + (await page.getByTestId("item-photo-16:9").count()) + (await page.getByTestId("item-photo-3:4").count()) === 0, "the other three sections start empty");
  ok(await page.getByTestId("add-photo").isVisible() && await page.getByTestId("paste-photo").isVisible(), "the square section still has 'Add photo' and 'Paste photo'");

  console.log("== Upload into each shape");
  const up = async (ratio, file) => { await page.getByTestId(`photo-file${ratio === "1:1" ? "" : "-" + ratio}`).setInputFiles(file); };
  await up("4:3", PNG.land);
  await page.getByTestId("item-photo-4:3").waitFor({ timeout: 20000 });
  await up("16:9", PNG.wide);
  await page.getByTestId("item-photo-16:9").waitFor({ timeout: 20000 });
  await up("3:4", PNG.tall);
  await page.getByTestId("item-photo-3:4").waitFor({ timeout: 20000 });
  ok(await page.getByTestId("add-photo-4:3").count() === 0 && await page.getByTestId("add-photo-16:9").count() === 0 && await page.getByTestId("add-photo-3:4").count() === 0, "once a shape has its picture, its 'Add' tile goes (one picture per shape)");
  ok(await page.getByTestId("photo-trim-4:3").count() === 0, "a picture that really is 4:3 gets no 'trimmed' warning");
  const landSrc1 = await page.getByTestId("item-photo-4:3").locator("img").getAttribute("src");
  await up("4:3", PNG.land2);
  await page.waitForFunction((old) => document.querySelector('[data-testid="item-photo-4:3"] img')?.getAttribute("src") !== old, landSrc1, { timeout: 20000 });
  ok(await page.getByTestId("item-photo-4:3").count() === 1, "choosing another landscape picture REPLACES the first (still one)");
  await up("4:3", PNG.squareForLand);
  await page.getByTestId("photo-trim-4:3").waitFor({ timeout: 20000 });
  ok(/not 4:3/.test(await page.getByTestId("photo-trim-4:3").innerText()), "a square picture put in the landscape section says its edges will be trimmed");
  await up("4:3", PNG.land);
  await page.getByTestId("photo-trim-4:3").waitFor({ state: "detached", timeout: 20000 });
  await page.screenshot({ path: "shapes-dish-form.png", fullPage: false });

  console.log("== Paste goes into the section you chose");
  await page.getByTestId("photo-slot-3:4").click({ position: { x: 8, y: 8 } });
  ok(/portrait 3:4/.test(await page.getByTestId("paste-target").innerText()), "clicking the portrait section aims Ctrl+V at it");
  const tallSrc1 = await page.getByTestId("item-photo-3:4").locator("img").getAttribute("src");
  await page.evaluate(async () => {
    const c = document.createElement("canvas"); c.width = 300; c.height = 400;
    const g = c.getContext("2d"); g.fillStyle = "#2a9d8f"; g.fillRect(0, 0, 300, 400); g.fillStyle = "#fff"; g.font = "40px sans-serif"; g.fillText("pasted", 60, 200);
    const blob = await new Promise((r) => c.toBlob(r, "image/png"));
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
  });
  await page.keyboard.press(process.platform === "darwin" ? "Meta+V" : "Control+V");
  await page.waitForFunction((old) => document.querySelector('[data-testid="item-photo-3:4"] img')?.getAttribute("src") !== old, tallSrc1, { timeout: 20000 });
  ok(await page.getByTestId("item-photo-3:4").count() === 1 && (await page.getByTestId("item-photo").count()) === squareKeysBefore.length, "the pasted picture replaced the portrait one — the squares are untouched");

  console.log("== Save keeps the squares and stores the shapes");
  await page.getByRole("button", { name: "Save changes" }).click();
  await row.waitFor({ timeout: 15000 });
  await sleep(600);
  let now = await dishNow();
  ok(now.images.length === squareKeysBefore.length + 3, `saved: ${squareKeysBefore.length} square + one landscape + one wide + one portrait`, now.images.map((i) => i.ratio).join(","));
  ok(JSON.stringify(of(now, "1:1").map((i) => i.key)) === JSON.stringify(squareKeysBefore), "…and the dish's own square pictures are exactly the ones it had (same files, same order)");
  ok(of(now, "4:3").length === 1 && of(now, "16:9").length === 1 && of(now, "3:4").length === 1, "…each other shape holds one picture");
  ok(of(now, "16:9")[0].width / of(now, "16:9")[0].height > 1.6 && of(now, "3:4")[0].height > of(now, "3:4")[0].width, "…and the files really are wide and tall (the pictures weren't squashed to squares)", JSON.stringify(now.images.map((i) => [i.ratio, i.width, i.height])));

  console.log("== Reopen, remove one");
  await row.getByTitle("Edit").click();
  await page.getByTestId("item-photo-slots").waitFor();
  ok(await page.getByTestId("item-photo-4:3").count() === 1 && await page.getByTestId("item-photo-16:9").count() === 1 && await page.getByTestId("item-photo-3:4").count() === 1, "reopening the dish shows each picture in its own section");
  await page.getByTestId("remove-photo-16:9").click();
  ok(await page.getByTestId("add-photo-16:9").isVisible(), "removing the wide picture brings its 'Add' tile back");
  await page.getByRole("button", { name: "Save changes" }).click();
  await row.waitFor({ timeout: 15000 });
  await sleep(600);
  now = await dishNow();
  ok(of(now, "16:9").length === 0 && of(now, "4:3").length === 1 && of(now, "1:1").length === squareKeysBefore.length, "after saving, the wide picture is gone and the rest is as it was");
  ok(JSON.stringify(of(now, "1:1").map((i) => i.key)) === JSON.stringify(squareKeysBefore), "the two square pictures are still exactly the same files, in the same order");

  /* ------------------------------------------------------------ the storefront */
  console.log("== Storefront: each card style shows its own shape");
  const cat = (await call("POST", "/api/menu/categories", { name: "Shapes test" })).json.category;
  made.categories.push(cat.id);
  const img = (name, ratio) => ({ url: `https://img.test/${name}.png`, key: `menu-items/${name}.png`, ratio, width: ratio === "16:9" ? 1600 : ratio === "3:4" ? 900 : ratio === "4:3" ? 1200 : 800, height: ratio === "16:9" ? 900 : ratio === "3:4" ? 1200 : ratio === "4:3" ? 900 : 800 });
  const full = (await call("POST", "/api/menu/items", { categoryId: cat.id, name: "Shapes Full", basePrice: 10000, images: [img("full-sq", "1:1"), img("full-land", "4:3"), img("full-wide", "16:9"), img("full-tall", "3:4")] })).json.item;
  const sqOnly = (await call("POST", "/api/menu/items", { categoryId: cat.id, name: "Shapes Square Only", basePrice: 10000, images: [img("only-sq", "1:1")] })).json.item;
  made.items.push(full.id, sqOnly.id);
  const setCard = (v) => patchConfig({ layout: { ...layoutBefore, itemCardVariant: `card.${v}` }, menuLayout: { ...menuLayoutBefore, defaultCardVariant: `card.${v}` } });
  const cases = [
    ["row-thumb-left", "C02", "full-sq"],
    ["row-thumb-right", "C03", "full-sq"],
    ["image-top", "C04", "full-land"],
    ["image-top-badge", "C05", "full-land"],
    ["text-above-image", "C06", "full-wide"],
    ["image-overlay", "C07", "full-land"],
    ["portrait", "C08", "full-tall"],
    ["circle", "C09", "full-sq"],
    ["featured-wide", "C11", "full-wide"],
  ];
  const sf = await ctx.newPage();
  sf.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
  for (const [variant, code, wanted] of cases) {
    await setCard(variant);
    await sf.goto(`${SF}/main`, { waitUntil: "load" });
    const cardFull = sf.locator("article", { hasText: "Shapes Full" }).first();
    await cardFull.waitFor({ timeout: 25000 });
    const srcFull = await cardFull.locator("img").first().getAttribute("src");
    const cardSq = sf.locator("article", { hasText: "Shapes Square Only" }).first();
    const srcSq = await cardSq.locator("img").first().getAttribute("src");
    ok(srcFull === `https://img.test/${wanted}.png`, `${code} (${variant}) shows the ${wanted.replace("full-", "")} picture of a dish that has all four`, srcFull);
    ok(srcSq === "https://img.test/only-sq.png", `${code}: a dish with only a square picture shows the square one`, srcSq);
  }
  await sf.screenshot({ path: "shapes-card-featured.png" });

  console.log("== Storefront: the dish pop-up uses the wide picture");
  await setCard("image-top");
  await sf.goto(`${SF}/main`, { waitUntil: "load" });
  await sf.locator('[role="button"]', { hasText: "Shapes Full" }).first().click();
  const modal = sf.getByTestId("item-modal");
  await modal.waitFor();
  const modalSrcs = await modal.locator("img").evaluateAll((els) => els.map((e) => e.getAttribute("src")));
  ok(modalSrcs.includes("https://img.test/full-wide.png") && !modalSrcs.includes("https://img.test/full-sq.png"), "a dish with a wide picture shows it in the pop-up (not the square)", modalSrcs.join(" | "));
  await sf.keyboard.press("Escape");
  await sleep(400);
  await sf.locator('[role="button"]', { hasText: "Shapes Square Only" }).first().click();
  await modal.waitFor();
  const modalSrcs2 = await modal.locator("img").evaluateAll((els) => els.map((e) => e.getAttribute("src")));
  ok(modalSrcs2.includes("https://img.test/only-sq.png"), "a dish with only a square picture still shows it in the pop-up, as before", modalSrcs2.join(" | "));
} finally {
  for (const id of made.items) await call("DELETE", `/api/menu/items/${id}`);
  for (const id of made.categories) await call("DELETE", `/api/menu/categories/${id}`);
  await patchConfig({ layout: layoutBefore, menuLayout: menuLayoutBefore });
  // the dish's own pictures go back exactly as they were
  await call("PATCH", `/api/menu/items/${dish.id}`, { images: originalImages });
  await browser.close();
}
const restored = (await menuNow()).items.find((i) => i.id === dish.id);
ok(restored.images.length === originalImages.length && restored.images.every((im, n) => im.key === originalImages[n].key), "the dish's own pictures are back exactly as they were at the start");
ok(problems.length === 0, "no errors in the browser console", problems.slice(0, 3).join(" | "));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
