// The dish form is a pop-up: header + scrolling body + a footer with Save / Cancel that stays put; Esc closes it. Photos are
// saved the moment they change (no Save needed); every other field needs Save. Chrome against the bench store (Acme, Main).
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
const AD = "http://localhost:3171";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const problems = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
const PNG = { land: makePng("form-land.png", 400, 300, [200, 60, 60]), sq: makePng("form-sq.png", 300, 300, [60, 160, 60]), newSq: makePng("form-new-sq.png", 300, 300, [60, 60, 200]) };

const cookie = (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "o@acme.test", password: "Owner123!" }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const outlets = await (await fetch(`${API}/api/outlets`, { headers: { cookie } })).json();
const main = (outlets.outlets ?? outlets).find((o) => o.slug === "main");
const outletId = String(main._id ?? main.id);
const call = async (method, path, body) => {
  const r = await fetch(API + path, { method, headers: { "content-type": "application/json", cookie, "x-onetap-outlet": outletId }, body: body ? JSON.stringify(body) : undefined });
  let json = {}; try { json = await r.json(); } catch {}
  return { status: r.status, json };
};
const menuNow = async () => (await (await fetch(`${API}/api/menu?outletId=${outletId}`)).json());
const dish = (await menuNow()).items.find((i) => i.name === "Veg Steamed Momos");
const original = { name: dish.name, images: dish.images };
const dishNow = async () => (await menuNow()).items.find((i) => i.id === dish.id);
const made = { items: [] };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1360, height: 640 } }); // short, so the form has to scroll
page.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !/Failed to load resource|React DevTools|favicon|WebSocket/.test(m.text())) problems.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
const dlg = () => page.getByRole("dialog", { name: /Edit item|New item/ });
const nameInput = () => dlg().locator("input").first();
const openDish = async () => {
  await page.locator('[data-item="Veg Steamed Momos"]').first().getByTitle("Edit").click();
  await dlg().waitFor();
};

try {
  await page.goto(AD + "/", { waitUntil: "load" });
  await page.fill('input[type="email"]', "o@acme.test"); await page.fill('input[type="password"]', "Owner123!");
  await page.getByRole("button", { name: /sign in|log in/i }).first().click();
  await page.waitForSelector("text=Orders");
  await page.goto(AD + "/menu", { waitUntil: "load" });
  await page.locator('[data-testid="cat-row"][data-category="Steamed Momos"] button', { hasText: "Steamed Momos" }).first().click();
  await page.locator('[data-item="Veg Steamed Momos"]').first().waitFor();

  /* ------------------------------------------------------------ the shape of the pop-up */
  console.log("== A pop-up with a fixed footer");
  await openDish();
  ok(await dlg().isVisible() && await page.getByTestId("item-form-footer").isVisible(), "Edit opens a pop-up, with a footer");
  ok(!!(await page.locator('[data-item="Veg Steamed Momos"]').first().isVisible()), "the item list is still there behind it (the form no longer replaces the list)");
  const body = page.getByTestId("item-form-body");
  const sizes = await body.evaluate((e) => ({ scroll: e.scrollHeight, client: e.clientHeight, overflowY: getComputedStyle(e).overflowY }));
  ok(sizes.scroll > sizes.client + 50 && /auto|scroll/.test(sizes.overflowY), "the body is taller than the window space and scrolls on its own", JSON.stringify(sizes));
  await sleep(700); // let the pop-in animation finish
  const footBefore = await page.getByTestId("item-form-footer").boundingBox();
  await body.evaluate((e) => { e.scrollTop = e.scrollHeight; });
  await sleep(200);
  const footAfter = await page.getByTestId("item-form-footer").boundingBox();
  ok(Math.abs(footBefore.y - footAfter.y) < 1 && footAfter.y + footAfter.height <= 640, "scrolling the form to the bottom leaves the Save / Cancel footer where it was, inside the window", `${Math.round(footBefore.y)} → ${Math.round(footAfter.y)}`);
  ok(await page.getByTestId("item-form-save").isVisible() && await page.getByTestId("item-form-cancel").isVisible(), "Save changes and Cancel are both visible at the bottom, whatever the scroll");
  ok((await page.evaluate(() => document.body.style.overflow)) === "hidden", "the page behind doesn't scroll while it is open");
  const box = await dlg().boundingBox();
  ok(box.width > box.height * 1.3, "the pop-up is a landscape rectangle, not a square", `${Math.round(box.width)} × ${Math.round(box.height)}`);
  await page.screenshot({ path: "item-form-modal.png" });
  await body.evaluate((e) => { e.scrollTop = 0; });

  console.log("== Esc closes it; clicking outside does not");
  await page.mouse.click(8, 8);
  await sleep(300);
  ok(await dlg().isVisible(), "a click outside the pop-up doesn't close it (so nothing typed is lost by accident)");
  await page.keyboard.press("Escape");
  await dlg().waitFor({ state: "hidden", timeout: 5000 });
  ok(true, "Esc closes the pop-up");
  await openDish();
  await page.getByTestId("item-form-close").click();
  await dlg().waitFor({ state: "hidden", timeout: 5000 });
  ok(true, "the ✕ closes it too");

  /* ------------------------------------------------------------ other fields need Save */
  console.log("== Other fields are saved with Save, and discarded with Cancel / Esc");
  await openDish();
  await nameInput().fill("Veg Steamed Momos EDITED");
  await page.getByTestId("item-form-cancel").click();
  await dlg().waitFor({ state: "hidden", timeout: 5000 });
  await sleep(500);
  ok((await dishNow()).name === original.name, "typing a new name and pressing Cancel changes nothing");
  await openDish();
  await nameInput().fill("Veg Steamed Momos EDITED");
  await page.keyboard.press("Escape");
  await dlg().waitFor({ state: "hidden", timeout: 5000 });
  await sleep(500);
  ok((await dishNow()).name === original.name, "…and so does Esc");
  await openDish();
  await nameInput().fill("Veg Steamed Momos EDITED");
  await sleep(800);
  ok((await dishNow()).name === original.name, "the name is NOT saved just by typing it");
  await page.getByTestId("item-form-save").click();
  await dlg().waitFor({ state: "hidden", timeout: 8000 });
  await sleep(500);
  ok((await dishNow()).name === "Veg Steamed Momos EDITED", "Save changes saves it and closes the pop-up");
  await call("PATCH", `/api/menu/items/${dish.id}`, { name: original.name });
  await page.reload({ waitUntil: "load" });
  await page.locator('[data-testid="cat-row"][data-category="Steamed Momos"] button', { hasText: "Steamed Momos" }).first().click();
  await page.locator('[data-item="Veg Steamed Momos"]').first().waitFor();
  await openDish();
  await nameInput().fill("");
  ok(await page.getByTestId("item-form-save").isDisabled(), "Save is off while the name is empty");
  await nameInput().fill(original.name);
  await page.getByTestId("item-form-cancel").click();
  await dlg().waitFor({ state: "hidden" });

  /* ------------------------------------------------------------ photos save themselves */
  console.log("== Photos are saved as they change");
  await openDish();
  await nameInput().fill("Veg Steamed Momos NOT SAVED");
  await page.getByTestId("photo-file-4:3").setInputFiles(PNG.land);
  await page.getByTestId("item-photo-4:3").waitFor({ timeout: 20000 });
  await ui_waitFor(async () => (await dishNow()).images.some((i) => i.ratio === "4:3"), 15000);
  let now = await dishNow();
  ok(now.images.some((i) => i.ratio === "4:3"), "an uploaded photo is on the dish at once — without pressing Save");
  ok(now.name === original.name, "…while the name typed in the same form is still unsaved");
  ok(/Saved/.test(await page.getByTestId("photos-status").innerText()), "the Photos heading says 'Saved'", await page.getByTestId("photos-status").innerText());
  ok(/saved as soon as you add/i.test(await dlg().innerText()), "the form says photos need no Save");
  await page.getByTestId("photo-file").setInputFiles(PNG.sq);
  await page.getByTestId("item-photo").first().waitFor({ timeout: 20000 });
  await ui_waitFor(async () => (await dishNow()).images.some((i) => i.ratio === "1:1"), 15000);
  ok((await dishNow()).images.length === 2, "a square photo too (two photos saved)", String((await dishNow()).images.length));
  await page.getByTestId("remove-photo-4:3").click();
  await ui_waitFor(async () => !(await dishNow()).images.some((i) => i.ratio === "4:3"), 15000);
  ok(!(await dishNow()).images.some((i) => i.ratio === "4:3") && (await dishNow()).images.length === 1, "removing a photo is saved at once too");
  const removedKey = now.images.find((i) => i.ratio === "4:3").key;
  await page.keyboard.press("Escape");
  await dlg().waitFor({ state: "hidden" });
  await sleep(500);
  now = await dishNow();
  ok(now.name === original.name && now.images.length === 1 && now.images[0].ratio === "1:1", "closing with Esc keeps the photos (already saved) and drops the unsaved name");
  const gone = await fetch(now.images[0].url);
  ok(gone.ok, "the kept photo opens");
  await openDish();
  ok((await page.getByTestId("item-photo").count()) === 1, "reopening the dish shows the saved photo");
  await page.getByTestId("remove-photo").first().click().catch(async () => { await page.getByTestId("item-photo").first().hover(); await page.locator('[data-testid="item-photo"] button[title="Remove"]').first().click(); });
  await ui_waitFor(async () => (await dishNow()).images.length === 0, 15000);
  ok((await dishNow()).images.length === 0, "the last photo removed is saved as well");
  await page.keyboard.press("Escape");
  await dlg().waitFor({ state: "hidden" });

  /* ------------------------------------------------------------ the "Uploading…" label stays where the upload is */
  console.log("== The Uploading… label stays on the section that is uploading");
  await openDish();
  // uploads wait at this gate until the test opens it (one route for the whole section)
  let gate = Promise.resolve();
  const hold = () => { let open; gate = new Promise((r) => { open = r; }); return open; };
  await page.route("**/api/storage/upload**", async (route) => { await gate; await route.continue(); });
  const release = hold();
  const slotSq = page.getByTestId("photo-slot-1:1");
  const slotLand = page.getByTestId("photo-slot-4:3");
  await page.getByTestId("photo-file").setInputFiles(PNG.sq); // square upload starts, held back by the gate
  await slotSq.getByTestId("photo-uploading").waitFor({ timeout: 10000 });
  ok(await slotSq.getByText("Uploading…").count() === 1, "while a square photo uploads, its section says Uploading…");
  await slotLand.click(); // pick another section while it is still uploading
  await page.getByTestId("photo-slot-16:9").click();
  await sleep(300);
  ok(await slotSq.getByText("Uploading…").count() === 1, "clicking another section does not move the label — it stays on the square section");
  ok(await slotLand.getByText("Uploading…").count() === 0 && await page.getByTestId("photo-slot-16:9").getByText("Uploading…").count() === 0, "the sections that are not uploading never show Uploading…");
  ok(await page.getByTestId("photo-uploading").count() === 1, "exactly one Uploading… label on the whole form");
  release();
  await ui_waitFor(async () => (await dishNow()).images.some((i) => i.ratio === "1:1"), 15000);
  ok((await dishNow()).images.some((i) => i.ratio === "1:1"), "the square photo still ends up saved on the dish");
  ok(await page.getByTestId("photo-uploading").count() === 0, "when the upload ends the label is gone");
  // the same for a landscape photo (it has no 'Add' tile left once filled, so start from an empty one)
  await call("PATCH", `/api/menu/items/${dish.id}`, { images: [] });
  await page.keyboard.press("Escape");
  await dlg().waitFor({ state: "hidden" });
  await openDish();
  const release2 = hold();
  await page.getByTestId("photo-file-4:3").setInputFiles(PNG.land);
  await slotLand.getByTestId("photo-uploading").waitFor({ timeout: 10000 });
  await slotSq.click();
  await sleep(300);
  ok(await slotLand.getByText("Uploading…").count() === 1 && await slotSq.getByText("Uploading…").count() === 0, "a landscape upload keeps its label on the landscape section when the square one is clicked");
  release2();
  await ui_waitFor(async () => (await dishNow()).images.some((i) => i.ratio === "4:3"), 15000);
  await page.keyboard.press("Escape");
  await dlg().waitFor({ state: "hidden" });

  /* ------------------------------------------------------------ a new dish */
  console.log("== A new dish keeps its photos until it is created");
  await page.locator('[data-testid="cat-row"][data-category="Beverages"] button', { hasText: "Beverages" }).first().click();
  await page.getByRole("button", { name: /Add item/ }).first().click();
  await dlg().waitFor();
  ok(/Edit|New item/.test(await dlg().getByRole("heading").first().innerText()) && /New item/.test(await dlg().getByRole("heading").first().innerText()), "'Add item' opens the same pop-up as New item");
  ok(/saved when you create the item/i.test(await dlg().innerText()), "…and says its photos are saved when it is created");
  ok((await page.getByTestId("photos-status").count()) === 0, "no 'Saved' status — nothing is saved before it exists");
  const before = (await menuNow()).items.length;
  await page.getByTestId("photo-file").setInputFiles(PNG.newSq);
  await page.getByTestId("item-photo").first().waitFor({ timeout: 20000 });
  const src = await page.getByTestId("item-photo").first().locator("img").getAttribute("src");
  ok((await menuNow()).items.length === before, "the photo does not create anything by itself");
  ok((await fetch(src)).ok, "(the uploaded photo is on the server)");
  await page.getByTestId("item-form-cancel").click();
  await dlg().waitFor({ state: "hidden" });
  await sleep(800);
  ok((await fetch(src)).status === 404 && (await menuNow()).items.length === before, "cancelling a NEW dish deletes the photo it uploaded — nothing is left behind", `${(await fetch(src)).status}`);
  await page.getByRole("button", { name: /Add item/ }).first().click();
  await dlg().waitFor();
  await nameInput().fill("Form Test Cola");
  await page.getByTestId("photo-file").setInputFiles(PNG.newSq);
  await page.getByTestId("item-photo").first().waitFor({ timeout: 20000 });
  await page.getByTestId("item-form-save").click();
  await dlg().waitFor({ state: "hidden", timeout: 10000 });
  await sleep(600);
  const created = (await menuNow()).items.find((i) => i.name === "Form Test Cola");
  if (created) made.items.push(created.id);
  ok(created && created.images.length === 1 && created.images[0].ratio === "1:1", "Create item saves the dish together with its photo", JSON.stringify(created?.images?.map((i) => i.ratio)));
} finally {
  for (const id of made.items) await call("DELETE", `/api/menu/items/${id}`);
  await call("PATCH", `/api/menu/items/${dish.id}`, { name: original.name, images: original.images });
  await browser.close();
}
ok(problems.length === 0, "no errors in the browser console", problems.slice(0, 3).join(" | "));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

async function ui_waitFor(fn, ms = 10000) { const end = Date.now() + ms; while (Date.now() < end) { try { if (await fn()) return true; } catch { /* retry */ } await sleep(300); } return false; }
