// The console's "Optimize pictures" card (Storage page): find the pictures that are bigger than the size limit, see them in a
// grid, select them (all, or some) and optimize. Chrome against the bench, with a throwaway store ("Optimize Test Co") whose
// pictures are made with sharp; the platform's compression settings are put back at the end.
import { createRequire } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import { chromium } from "playwright";
const REPO = fileURLToPath(new URL("../../..", import.meta.url)).replace(/\/$/, "");
const sharp = (await import(pathToFileURL(createRequire(`${REPO}/apps/api/package.json`).resolve("sharp")).href)).default;
const AD = "http://localhost:3171";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const problems = [];
const dialogs = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 20000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await fn()) return true; } catch { /* retry */ } await sleep(250); } return false; };

const login = async (email, password) => (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const sup = await login("super@sandbox.test", "Super123!");
const sa = async (method, path, body) => {
  const r = await fetch(API + path, { method, headers: { "content-type": "application/json", cookie: sup }, body: body ? JSON.stringify(body) : undefined });
  let json = {}; try { json = await r.json(); } catch {}
  return { status: r.status, json };
};
const planId = (await sa("GET", "/api/platform/plans")).json.plans.find((p) => p.name === "Pro").id;
const made = (await sa("POST", "/api/brands", { brandName: "Optimize Test Co", brandSlug: "optimize-test", outletName: "Counter", outletSlug: "counter", hostnames: ["otc.test"], ownerEmail: "o@otc.test", ownerName: "Owner", ownerPassword: "Owner123!", planId })).json;
const brandId = String(made.brand?._id ?? made.brand?.id ?? made.brandId);
const outletId = String(made.outlet?._id ?? made.outlet?.id ?? made.outletId);
const owner = await login("o@otc.test", "Owner123!");
const own = async (method, path, body, raw) => {
  const r = await fetch(API + path, { method, headers: { ...(raw ? {} : { "content-type": "application/json" }), cookie: owner, "x-onetap-outlet": outletId, ...(raw ? { "content-type": "image/png" } : {}) }, body: raw ?? (body ? JSON.stringify(body) : undefined) });
  let json = {}; try { json = await r.json(); } catch {}
  return { status: r.status, json };
};

const before = (await sa("GET", "/api/platform/storage")).json.processing; // put back at the end
const setProcessing = (p) => sa("PUT", "/api/platform/storage", { processing: p });
const noisy = (w, h, sigma = 40) => sharp({ create: { width: w, height: h, channels: 3, background: "#808080", noise: { type: "gaussian", mean: 128, sigma } } });

let browser;
let bigBytes = 0;
const bigUploads = [];
try {
  // pictures are made while the compression is loose, so they arrive big (the way they did before a limit existed)
  await setProcessing({ maxDimension: 4096, quality: 100, format: "jpeg", targetMaxKB: 0 });
  for (let i = 0; i < 3; i++) {
    const buf = await noisy(1000, 800).jpeg({ quality: 98 }).toBuffer();
    const up = (await own("POST", "/api/storage/upload?kind=menu-items", null, buf)).json;
    bigUploads.push(up);
    bigBytes += up.bytes;
  }
  const cat = (await own("POST", "/api/menu/categories", { name: "Pictures" })).json.category;
  const img = (u) => ({ url: u.url, key: u.key, width: u.width, height: u.height, ratio: "1:1" });
  await own("POST", "/api/menu/items", { categoryId: cat.id, name: "Big Dish A", basePrice: 5000, images: [img(bigUploads[0]), img(bigUploads[1])] });
  await own("POST", "/api/menu/items", { categoryId: cat.id, name: "Big Dish B", basePrice: 5000, images: [img(bigUploads[2])] });
  // fifty small noisy pictures (~12 KB each) on nine dishes — for the paging of the grid
  const smalls = [];
  for (let i = 0; i < 50; i++) smalls.push((await own("POST", "/api/storage/upload?kind=menu-items", null, await noisy(64, 64, 60 + i).png().toBuffer())).json);
  for (let d = 0; d < 9; d++) await own("POST", "/api/menu/items", { categoryId: cat.id, name: `Small Dish ${d + 1}`, basePrice: 5000, images: smalls.slice(d * 6, d * 6 + 6).map(img) });
  const small = Math.min(...smalls.map((s) => s.bytes));
  console.log(`   (made 3 big pictures: ${bigUploads.map((u) => Math.round(u.bytes / 1024) + " KB").join(", ")}; 50 small: from ${Math.round(small / 1024)} KB)`);
  await setProcessing({ maxDimension: 800, quality: 70, format: "webp", targetMaxKB: 150 });

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1360, height: 1000 } });
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|favicon|status of 4\d\d|status of 5\d\d/.test(m.text())) problems.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
  page.on("dialog", (d) => { dialogs.push(d.message()); void d.accept(); });
  await page.goto(AD + "/", { waitUntil: "load" });
  await page.fill('input[type="email"]', "super@sandbox.test"); await page.fill('input[type="password"]', "Super123!");
  await page.getByRole("button", { name: /sign in|log in/i }).first().click();
  await page.waitForSelector("text=Stores");
  await page.goto(AD + "/platform/storage", { waitUntil: "load" });
  await page.getByText("Optimize pictures").first().waitFor({ timeout: 20000 });

  console.log("== Before looking");
  const scanBtn = page.getByTestId("optimize-scan");
  await scanBtn.scrollIntoViewIfNeeded();
  // the API remembers the last scan while it runs, so the card may already show one (from an earlier run of this test)
  const remembered = (await sa("GET", "/api/platform/storage/optimize/scan")).json.scan;
  if (!remembered) {
    ok(/Find big pictures/.test(await scanBtn.innerText()), "the card starts with a 'Find big pictures' button");
    ok(await page.getByTestId("optimize-grid").count() === 0, "nothing is listed until you look");
  } else {
    ok(/Scan again/.test(await scanBtn.innerText()), "the last scan is still there when the page is opened again (the button says 'Scan again')");
    ok(await page.locator('[data-testid="optimize-pic"]', { hasText: "Optimize Test Co" }).count() === 0, "…and it can't show this run's pictures: they weren't there when it was made");
  }
  const compIdx = await page.getByText("Image compression").first().boundingBox();
  const optIdx = await page.getByText("Optimize pictures").first().boundingBox();
  ok(compIdx && optIdx && optIdx.y > compIdx.y, "it sits below 'Image compression', whose size limit it uses");

  console.log("== Find the big pictures");
  await scanBtn.click();
  await page.getByTestId("optimize-summary").waitFor({ timeout: 30000 });
  ok(/Scan again/.test(await scanBtn.innerText()), "the button now says 'Scan again'");
  ok(/150 KB/.test(await page.getByTestId("optimize-summary").innerText()), "the summary names the limit that is saved (150 KB)", (await page.getByTestId("optimize-summary").innerText()).replace(/\s+/g, " ").slice(0, 160));
  await page.getByTestId("optimize-store").selectOption(brandId);
  const cards = page.getByTestId("optimize-pic");
  ok(await until(async () => (await cards.count()) === 3), "choosing the store shows exactly its 3 big pictures", String(await cards.count()));
  const selectAll = page.getByTestId("optimize-toolbar").getByRole("checkbox").first();
  ok(/Select all of this store \(3\)/.test(await page.getByTestId("optimize-toolbar").innerText()), "'Select all' says how many it would select (3)", (await page.getByTestId("optimize-toolbar").innerText()).replace(/\s+/g, " ").slice(0, 120));
  ok(/Nothing selected/.test(await page.getByTestId("optimize-selected").innerText()) && await page.getByTestId("optimize-start").isDisabled(), "nothing is selected to begin with, and the Optimize button waits");
  ok((await cards.first().innerText()).includes("Optimize Test Co") && /Counter/.test(await cards.first().innerText()) && /Dish picture/.test(await cards.first().innerText()) && /\bMB\b|\bKB\b/.test(await cards.first().innerText()), "each picture shows its size, store, outlet and what it is", (await cards.first().innerText()).replace(/\s+/g, " "));
  ok(await page.locator('[data-testid="optimize-pic"] button').count() === 0, "the grid is view-only: no button on any picture");
  const first = cards.first().locator("img");
  await first.scrollIntoViewIfNeeded();
  ok(await until(async () => first.evaluate((i) => i.complete && i.naturalWidth > 0)), "the pictures are shown (loaded from where they are stored)");
  const boxes = await Promise.all([0, 1, 2].map((i) => cards.nth(i).boundingBox()));
  ok(boxes.every((b) => Math.abs(b.width - boxes[0].width) < 1.5 && Math.abs(b.height - boxes[0].height) < 1.5), "the cards are all the same size", boxes.map((b) => `${Math.round(b.width)}×${Math.round(b.height)}`).join(" "));
  const scanBox = await scanBtn.boundingBox();
  ok(scanBox.height < 48, "the 'Scan again' button stays on one line", `${Math.round(scanBox.width)}×${Math.round(scanBox.height)}`);
  const caption = (await cards.first().innerText()).split("\n").map((x) => x.trim()).filter(Boolean);
  ok(caption.some((x) => x === "Counter") && caption.some((x) => x === "Dish picture"), "the outlet and the kind each get their own line, not cut off", caption.join(" | "));
  await page.screenshot({ path: "optimize-grid.png" });

  console.log("== Select");
  await selectAll.check();
  ok(/3 selected/.test(await page.getByTestId("optimize-selected").innerText()) && (await page.locator('[data-testid="optimize-pic"][data-picked="true"]').count()) === 3, "'Select all' selects the 3", (await page.getByTestId("optimize-selected").innerText()).trim());
  ok(/Optimize 3 pictures/.test(await page.getByTestId("optimize-start").innerText()) && !(await page.getByTestId("optimize-start").isDisabled()), "the button says what it will do and is ready");
  await cards.nth(1).getByRole("checkbox").uncheck();
  ok(/2 selected/.test(await page.getByTestId("optimize-selected").innerText()) && /Optimize 2 pictures/.test(await page.getByTestId("optimize-start").innerText()), "a single picture can be taken out again (2 selected)");
  await selectAll.check(); // (it was off, because one picture is out) — selects them all again
  ok(/3 selected/.test(await page.getByTestId("optimize-selected").innerText()), "'Select all' puts it back (3 selected)");
  await selectAll.uncheck();
  ok(/Nothing selected/.test(await page.getByTestId("optimize-selected").innerText()), "unticking 'Select all' clears the selection");
  await selectAll.check();

  console.log("== Optimize");
  const origins = bigUploads.map((u) => u.url);
  const jobBefore = (await sa("GET", "/api/platform/storage/optimize")).json.current?.id; // (an earlier run's job may still be shown)
  await page.getByTestId("optimize-start").click();
  ok(await until(async () => (await sa("GET", "/api/platform/storage/optimize")).json.current?.id !== jobBefore, 15000), "a new job starts");
  ok(dialogs.some((d) => /Optimize 3 pictures/.test(d) && /DELETED/.test(d) && /can't be undone/.test(d)), "it asks first and says plainly that the big originals are deleted and it can't be undone", (dialogs.at(-1) ?? "").replace(/\s+/g, " ").slice(0, 140));
  await page.getByTestId("optimize-job").waitFor({ timeout: 15000 });
  await sleep(1800); // (the page asks again every second and a half)
  ok(await until(async () => (await page.getByTestId("optimize-job").getAttribute("data-status")) === "done", 60000), "the job runs and finishes by itself", await page.getByTestId("optimize-job").getAttribute("data-status"));
  const prog = (await page.getByTestId("optimize-progress").innerText()).replace(/\s+/g, " ");
  ok(/3 optimized/.test(prog) && /0 failed/.test(prog) && /3 originals deleted/.test(prog), "the numbers say 3 optimized, 0 failed, 3 originals deleted", prog);
  const result = (await page.getByTestId("optimize-result").innerText()).replace(/\s+/g, " ");
  ok(/3 pictures went from .* to .* — .* smaller/.test(result), "it says how much was saved", result);
  ok(await until(async () => (await page.locator('[data-testid="optimize-pic"]', { hasText: "Optimize Test Co" }).count()) === 0, 30000), "the list refreshes by itself: the optimized pictures are gone from it");

  const menu = (await (await fetch(`${API}/api/menu?outletId=${outletId}`)).json()).items;
  const nowUrls = menu.filter((i) => /^Big Dish/.test(i.name)).flatMap((i) => i.images.map((x) => x.url));
  ok(nowUrls.length === 3 && nowUrls.every((u) => !origins.includes(u)), "the dishes now use new files (new addresses)", nowUrls.length + " pictures");
  const heads = await Promise.all(nowUrls.map(async (u) => { const r = await fetch(u); return { status: r.status, type: r.headers.get("content-type"), size: (await r.arrayBuffer()).byteLength }; }));
  ok(heads.every((h) => h.status === 200 && h.type === "image/webp" && h.size <= 150 * 1024), "…which open, as WebP, each under 150 KB", heads.map((h) => `${Math.round(h.size / 1024)} KB`).join(", "));
  ok(heads.reduce((n, h) => n + h.size, 0) < bigBytes * 0.3, "together they are a fraction of what they were", `${Math.round(bigBytes / 1024)} KB → ${Math.round(heads.reduce((n, h) => n + h.size, 0) / 1024)} KB`);
  const oldGone = await Promise.all(origins.map(async (u) => (await fetch(u)).status));
  ok(oldGone.every((s) => s === 404), "the big originals no longer open (they were deleted)", oldGone.join(","));

  console.log("== A long list is shown a page at a time");
  await setProcessing({ maxDimension: 800, quality: 70, format: "webp", targetMaxKB: 5 });
  await scanBtn.click();
  await page.getByTestId("optimize-summary").waitFor();
  await page.getByTestId("optimize-store").selectOption(brandId);
  ok(await until(async () => (await cards.count()) === 48), "only the first 48 are drawn at once", String(await cards.count()));
  const more = page.getByTestId("optimize-more");
  ok(await more.isVisible() && /Show more \(\d+ left\)/.test(await more.innerText()), "'Show more' says how many are left", (await more.innerText()).trim());
  await more.click();
  ok(await until(async () => (await cards.count()) > 48 && (await page.getByTestId("optimize-more").count()) === 0), "pressing it draws the rest", String(await cards.count()));
  await selectAll.check();
  ok(new RegExp(`${await cards.count()} selected`).test(await page.getByTestId("optimize-selected").innerText()), "'Select all' covers every picture of the store, not only the ones drawn", (await page.getByTestId("optimize-selected").innerText()).trim());
  await selectAll.uncheck();

  console.log("== A phone");
  await page.setViewportSize({ width: 390, height: 844 });
  await sleep(400);
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "no sideways scrolling on a phone");
  const [c0, c1] = [await cards.nth(0).boundingBox(), await cards.nth(1).boundingBox()];
  ok(Math.abs(c0.y - c1.y) < 2 && c0.x + c0.width <= 390 && c1.x + c1.width <= 390, "the grid shows two pictures side by side, inside the screen", `${Math.round(c0.width)} + ${Math.round(c1.width)} px`);
  await page.screenshot({ path: "optimize-phone.png" });
  await page.setViewportSize({ width: 1360, height: 1000 });

  console.log("== No size limit set");
  await setProcessing({ maxDimension: 800, quality: 70, format: "webp", targetMaxKB: 0 });
  await scanBtn.click();
  await page.getByTestId("optimize-nolimit").waitFor({ timeout: 20000 });
  ok(/Target max size/.test(await page.getByTestId("optimize-nolimit").innerText()) && await page.getByTestId("optimize-grid").count() === 0, "it says a size limit is needed (and where to put it) instead of listing everything");
} finally {
  await setProcessing(before).catch(() => undefined);
  await sa("DELETE", `/api/platform/stores/${brandId}`, { confirmName: "Optimize Test Co" }).catch(() => undefined);
  await browser?.close();
}
ok(problems.length === 0, "no errors in the browser", problems.slice(0, 3).join(" | "));
console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
