// The console's Storage page: try a storage without switching it on (right under the list of storages), see what is stored
// where per store and outlet, and move the files to another S3-compatible storage. Chrome against the bench; a stand-in
// service plays the bucket, and a throwaway store ("Storage Test Co") owns the files so no real bench data is touched.
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { fakeS3 } from "../bench/fake-s3.mjs";
const AD = "http://localhost:3171";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const problems = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 20000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await fn()) return true; } catch { /* retry */ } await sleep(250); } return false; };

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

const login = async (email, password) => (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const sup = await login("super@sandbox.test", "Super123!");
const sa = async (method, path, body) => {
  const r = await fetch(API + path, { method, headers: { "content-type": "application/json", cookie: sup }, body: body ? JSON.stringify(body) : undefined });
  let json = {}; try { json = await r.json(); } catch {}
  return { status: r.status, json };
};
const planId = (await sa("GET", "/api/platform/plans")).json.plans.find((p) => p.name === "Pro").id;
const made = (await sa("POST", "/api/brands", { brandName: "Storage Test Co", brandSlug: "storage-test", outletName: "Counter", outletSlug: "counter", hostnames: ["stc.test"], ownerEmail: "o@stc.test", ownerName: "Owner", ownerPassword: "Owner123!", planId })).json;
const brandId = String(made.brand?._id ?? made.brand?.id ?? made.brandId);
const outletId = String(made.outlet?._id ?? made.outlet?.id ?? made.outletId);
const owner = await login("o@stc.test", "Owner123!");
const own = async (method, path, body, raw) => {
  const r = await fetch(API + path, { method, headers: { ...(raw ? {} : { "content-type": "application/json" }), cookie: owner, "x-onetap-outlet": outletId, ...(raw ? { "content-type": "image/png" } : {}) }, body: raw ?? (body ? JSON.stringify(body) : undefined) });
  let json = {}; try { json = await r.json(); } catch {}
  return { status: r.status, json };
};
// the store uploads three pictures (they land on this server's disk) and uses two on a dish and one as a banner image
const files = [];
for (const [name, rgb] of [["a", [200, 60, 60]], ["b", [60, 160, 60]], ["c", [60, 60, 200]]]) {
  const path = makePng(`stc-${name}.png`, 300, 300, rgb);
  const { readFileSync } = await import("node:fs");
  const up = (await own("POST", "/api/storage/upload?kind=menu-items", null, readFileSync(path))).json;
  files.push(up);
}
const cat = (await own("POST", "/api/menu/categories", { name: "Pictures" })).json.category;
const item = (await own("POST", "/api/menu/items", { categoryId: cat.id, name: "Photo Dish", basePrice: 5000, images: files.slice(0, 2).map((f) => ({ url: f.url, key: f.key, width: f.width, height: f.height, ratio: "1:1" })) })).json.item;
const item2 = (await own("POST", "/api/menu/items", { categoryId: cat.id, name: "Second Dish", basePrice: 5000, images: [{ url: files[2].url, key: files[2].key, width: files[2].width, height: files[2].height, ratio: "1:1" }] })).json.item;
const storageBefore = (await sa("GET", "/api/platform/storage")).json;
const imagesOf = async () => ((await (await fetch(`${API}/api/menu?outletId=${outletId}`)).json()).items.find((i) => i.name === "Photo Dish")?.images ?? []).map((i) => i.url);

const s3 = await fakeS3({ bucket: "stc", accessKey: "AKSTC" });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1360, height: 1000 }, acceptDownloads: false });
page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|favicon|status of 4\d\d|status of 5\d\d/.test(m.text())) problems.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
page.on("dialog", (d) => void d.accept());
const fill = async (label, value, scope = page) => scope.getByLabel(label, { exact: true }).first().fill(value);

try {
  await page.goto(AD + "/", { waitUntil: "load" });
  await page.fill('input[type="email"]', "super@sandbox.test"); await page.fill('input[type="password"]', "Super123!");
  await page.getByRole("button", { name: /sign in|log in/i }).first().click();
  await page.waitForSelector("text=Stores");
  await page.goto(AD + "/platform/storage", { waitUntil: "load" });
  await page.getByText("Where images are stored").first().waitFor({ timeout: 20000 });

  console.log("== Test connection, right after the list of storages");
  const list = page.locator("button", { hasText: "S3-compatible cloud storage" }).first();
  const testBtn = page.getByTestId("storage-test");
  const lastRow = await list.boundingBox();
  const tb = await testBtn.boundingBox();
  const fieldsCard = page.getByRole("heading", { name: /— settings$/ });
  ok(tb.y > lastRow.y + lastRow.height - 2, "the Test connection button sits directly under the list of storages", `list ends ${Math.round(lastRow.y + lastRow.height)}, button at ${Math.round(tb.y)}`);
  if (await fieldsCard.count()) { const fb = await fieldsCard.first().boundingBox(); ok(tb.y < fb.y, "…above the settings fields (so any storage can be tried without scrolling past them)"); }
  ok(/Test connection — This server's \(local disk\)|Test connection/.test(await testBtn.innerText()), "it says which storage it will try", (await testBtn.innerText()).trim());

  await testBtn.click();
  await page.getByTestId("storage-test-result").waitFor({ timeout: 15000 });
  ok(await page.getByTestId("storage-test-result").getAttribute("data-ok") === "true" && await page.getByTestId("storage-test-result").getAttribute("data-public") === "true", "this server's disk works (saved, read back, opened from its public address, deleted)", (await page.getByTestId("storage-test-result").innerText()).replace(/\s+/g, " ").slice(0, 100));

  await list.click();
  await testBtn.click();
  await page.getByText(/Fill in .* first/).first().waitFor({ timeout: 10000 });
  ok(true, "choosing S3 and testing with nothing filled in says what is missing (it doesn't pretend)");

  // type the details of the stand-in bucket and try them — nothing is saved
  const field = (i) => page.locator("section", { has: page.getByRole("heading", { name: /— settings$/ }) }).first().locator("input").nth(i); // bucket, region, endpoint, access key id, secret, public base URL
  await field(0).fill("stc");
  await field(1).fill("auto");
  await field(2).fill(s3.endpoint);
  await field(3).fill("AKSTC");
  await field(4).fill("secret-123");
  await testBtn.click();
  await page.getByTestId("storage-step-delete").waitFor({ timeout: 15000 });
  const res = page.getByTestId("storage-test-result");
  ok(await res.getAttribute("data-ok") === "true" && await res.getAttribute("data-public") === "true", "the typed-in bucket works and is public", (await res.innerText()).replace(/\s+/g, " ").slice(0, 110));
  const states = await Promise.all(["write", "read", "public", "delete"].map(async (id) => `${id}:${await page.getByTestId(`storage-step-${id}`).getAttribute("data-state")}`));
  ok(states.every((x) => x.endsWith("ok")), "all four steps are shown with a tick", states.join(" "));
  ok((await sa("GET", "/api/platform/storage")).json.provider === storageBefore.provider && s3.store.size === 0, "nothing was saved or switched on, and the bucket was left clean", `${(await sa("GET", "/api/platform/storage")).json.provider}, ${s3.store.size} objects`);

  s3.state.publicRead = false;
  await testBtn.click();
  await until(async () => (await page.getByTestId("storage-step-public").getAttribute("data-state").catch(() => "")) === "warn");
  ok(await res.getAttribute("data-ok") === "true" && await res.getAttribute("data-public") === "false" && await page.getByTestId("storage-step-public").getAttribute("data-state") === "warn", "a bucket that isn't public is a warning, not a pass: 'pictures would not show yet'", (await page.getByTestId("storage-step-public").innerText()).replace(/\s+/g, " ").slice(0, 120));
  s3.state.publicRead = true;
  await field(3).fill("WRONG");
  await testBtn.click();
  await until(async () => (await res.getAttribute("data-ok")) === "false");
  ok(await page.getByTestId("storage-step-write").getAttribute("data-state") === "fail" && /did NOT work/.test(await res.innerText()) && /access key/i.test(await page.getByTestId("storage-step-write").innerText()), "wrong keys: the first step fails and shows the service's own words", (await page.getByTestId("storage-step-write").innerText()).replace(/\s+/g, " ").slice(0, 100));
  await field(3).fill("AKSTC");
  await page.screenshot({ path: "storage-test.png" });

  console.log("== What is stored where");
  await page.getByTestId("storage-scan").click();
  await page.getByTestId("storage-usage").waitFor({ timeout: 30000 });
  ok(/\d+ files?/.test(await page.getByTestId("usage-total").innerText()), "the scan shows the total for everything", (await page.getByTestId("usage-total").innerText()).replace(/\s+/g, " "));
  ok(await page.getByTestId("usage-local").isVisible(), "…and this server's disk on its own");
  const row = page.locator('[data-testid="usage-store"][data-store="Storage Test Co"]');
  await row.waitFor();
  ok(/3 files/.test(await row.innerText()), "the test store has its 3 files", (await row.innerText()).replace(/\s+/g, " "));
  await row.getByRole("button").click();
  const outletRow = page.locator('[data-testid="usage-outlet"]', { hasText: "Counter" });
  ok(await outletRow.isVisible() && /3 files/.test(await outletRow.innerText()), "opening it shows the outlet ('Counter') and its files", (await outletRow.innerText()).replace(/\s+/g, " "));
  ok(await page.getByTestId("usage-stores").getByText("menu-items").count() === 0 && (await page.getByText("By kind of file").count()) === 1, "files are also counted by kind");

  console.log("== Move the test store's files to the bucket");
  await page.getByTestId("move-source-local").check();
  await page.getByTestId("move-target-s3").check();
  const target = page.getByTestId("move-target");
  await fill("To — where they should go: Bucket name", "stc", target);
  await fill("To — where they should go: Region", "auto", target);
  await fill("To — where they should go: Endpoint", s3.endpoint, target);
  await fill("To — where they should go: Access key ID", "AKSTC", target);
  await fill("To — where they should go: Secret access key", "secret-123", target);
  await target.getByTestId("move-target-test").click();
  await target.getByTestId("storage-test-result").waitFor({ timeout: 15000 });
  ok(await target.getByTestId("storage-test-result").getAttribute("data-ok") === "true", "the destination can be tried before anything moves");
  await page.getByTestId("move-scope").selectOption(brandId);
  ok(await page.getByTestId("move-start").isDisabled(), "'Move files' stays off until you have looked at what would happen");
  await page.getByTestId("move-preview").click();
  await page.getByTestId("move-preview-result").waitFor({ timeout: 20000 });
  const prev = (await page.getByTestId("move-preview-result").innerText()).replace(/\s+/g, " ");
  ok(/3 files? \(.* to copy, 0 already there, 3 stored picture addresses to update/.test(prev), "'Check what would move' says 3 files to copy and 3 addresses to update — and only for this store", prev);
  ok(s3.store.size === 0 && (await imagesOf())[0].includes("/uploads/"), "checking changed nothing");
  {
    // the result box must not touch the buttons above it
    const btnBox = await page.getByTestId("move-start").boundingBox();
    const noteBox = await page.getByTestId("move-preview-result").locator("xpath=../..").boundingBox(); // the blue box itself, not the text inside it
    const gap = Math.round(noteBox.y - (btnBox.y + btnBox.height));
    ok(gap >= 12, "the 'what would move' box has room (≥ 12 px) below the buttons — it does not touch them", `gap ${gap}px`);
  }
  await page.getByTestId("move-start").click();
  await page.getByTestId("move-job").waitFor({ timeout: 15000 });
  console.log("   (job right after start:", JSON.stringify((await sa("GET", "/api/platform/storage/move")).json.current).slice(0, 300), ")");
  ok(await until(async () => (await page.getByTestId("move-job").getAttribute("data-status")) === "done", 40000), "the move runs and finishes by itself", await page.getByTestId("move-job").getAttribute("data-status"));
  ok(/3 copied/.test(await page.getByTestId("move-progress").innerText()) && /3 addresses updated/.test(await page.getByTestId("move-progress").innerText()), "the numbers say 3 copied, 3 addresses updated", (await page.getByTestId("move-progress").innerText()).replace(/\s+/g, " "));
  ok(s3.store.size === 3 && [...s3.store.keys()].every((k) => k.startsWith(`${brandId}/`)), "the bucket holds exactly that store's 3 files", [...s3.store.keys()].map((k) => k.slice(-14)).join(" "));
  const links = await imagesOf();
  ok(links.length === 2 && links.every((u) => u.startsWith(`${s3.endpoint}/stc/${brandId}/`)), "the dish's pictures now come from the bucket", links[0]);
  ok((await fetch(links[0])).ok, "…and really open from there");
  await page.screenshot({ path: "storage-move-done.png" });

  await page.getByTestId("storage-scan").click();
  await page.waitForFunction(() => /Scanned (just now|a few seconds|\d+ s)/i.test(document.querySelector('[data-testid="storage-usage"]')?.innerText ?? ""), null, { timeout: 30000 }).catch(() => undefined);
  await sleep(800);
  ok(await page.getByTestId("usage-waiting").count() === 0 || !/Storage Test Co/.test(await page.getByTestId("usage-waiting").innerText().catch(() => "")), "after the move the test store's files no longer count as waiting to be moved");

  console.log("== A file the bucket refuses");
  const extra = (await own("POST", "/api/storage/upload?kind=menu-items", null, (await import("node:fs")).readFileSync(makePng("stc-d.png", 200, 200, [10, 10, 10])))).json;
  await own("PATCH", `/api/menu/items/${item2.id}`, { images: [{ url: files[2].url, key: files[2].key, ratio: "1:1" }, { url: extra.url, key: extra.key, ratio: "1:1", width: extra.width, height: extra.height }] });
  s3.fail.add(extra.key);
  await page.getByTestId("move-preview").click();
  await page.getByTestId("move-preview-result").waitFor();
  await page.getByTestId("move-start").click();
  ok(await until(async () => /Finished — some files could not be moved/.test(await page.getByTestId("move-job").innerText()), 40000), "the move says it finished with problems");
  ok(/couldn't|500|try again/i.test(await page.getByTestId("move-failures").innerText()) && (await page.getByTestId("move-failures").innerText()).includes(extra.key), "the file that failed is listed with the service's answer", (await page.getByTestId("move-failures").innerText()).slice(0, 120));
  s3.fail.delete(extra.key);
  await page.getByTestId("move-preview").click();
  await page.getByTestId("move-preview-result").waitFor();
  await page.getByTestId("move-start").click();
  ok(await until(async () => (await page.getByTestId("move-job").getAttribute("data-status")) === "done", 40000), "starting again finishes the rest (only that file is copied)");
  ok(/1 copied/.test(await page.getByTestId("move-progress").innerText()), "…it says 1 copied", (await page.getByTestId("move-progress").innerText()).replace(/\s+/g, " "));
} finally {
  // put everything back: the files return to the disk, then the throwaway store is deleted
  await sa("POST", "/api/platform/storage/move", { source: { type: "s3", values: { bucket: "stc", region: "auto", endpoint: s3.endpoint, accessKeyId: "AKSTC", secretAccessKey: "secret-123" } }, target: { type: "local" }, scope: { brandId } }).catch(() => undefined);
  await until(async () => (await sa("GET", "/api/platform/storage/move")).json.current?.status !== "running", 30000).catch(() => undefined);
  await sa("DELETE", `/api/platform/stores/${brandId}`, { confirmName: "Storage Test Co" });
  await s3.close();
  await browser.close();
}
ok(problems.length === 0, "no errors in the browser", problems.slice(0, 3).join(" | "));
console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
