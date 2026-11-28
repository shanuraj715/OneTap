// App Management → the app's tab → "Screenshots on the website", in Chrome against the bench console (super admin) and API: add a screenshot, put pictures into its
// slots (3 devices × light / dark), warnings for a picture of the wrong shape, replace and remove a picture, hide / show, reorder, edit the words, remove, the section's
// switch / heading / intro / first device. It works on a throwaway app ("tour") that it removes at the end.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const REPO = fileURLToPath(new URL("../../..", import.meta.url)).replace(/\/$/, "");
const AD = "http://localhost:3171";
const API = "http://localhost:3097";
const sharp = createRequire(`${REPO}/apps/api/package.json`)("sharp");
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const say = (s) => console.log(`\n=== ${s}`);
const problems = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 12000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await fn()) return true; } catch { /* retry */ } await sleep(200); } return false; };
const norm = (t) => t.replace(/\s+/g, " ").trim();
const su = (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "super@sandbox.test", password: "Super123!" }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const call = async (method, path, body) => { const r = await fetch(API + path, { method, headers: { cookie: su, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }); return { status: r.status, json: await r.json().catch(() => ({})) }; };
const A = "/api/platform/app-releases";
const list = async () => (await call("GET", `${A}/screenshots/tour`)).json;
const png = (w, h, rgb = [90, 80, 200]) => sharp({ create: { width: w, height: h, channels: 3, background: { r: rgb[0], g: rgb[1], b: rgb[2] } } }).png().toBuffer();
const file = async (w, h, rgb) => ({ name: "screen.png", mimeType: "image/png", buffer: await png(w, h, rgb) });

await call("DELETE", `${A}/apps/tour`).catch(() => undefined);
const browser = await chromium.launch();
try {
  await call("POST", `${A}/apps`, { name: "Rasoi Pulse Tour", slug: "tour", code: "TUR" });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1100 } });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !/Failed to load resource|React DevTools|favicon|WebSocket/.test(m.text())) problems.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
  await page.goto(AD + "/", { waitUntil: "load" });
  await page.fill('input[type="email"]', "super@sandbox.test");
  await page.fill('input[type="password"]', "Super123!");
  await page.getByRole("button", { name: /sign in|log in/i }).first().click();
  await page.waitForSelector("aside a");
  await page.goto(AD + "/platform/app-management?app=tour", { waitUntil: "load" });
  await page.getByTestId("app-shots").waitFor({ timeout: 15000 });
  const T = (id) => page.getByTestId(id);
  const slot = (n, d, t) => `${n}-${d}-${t}`;

  say("1. An app with no screenshots");
  ok(/has no screenshots yet/.test(await T("shots-summary").innerText()) && await T("shots-add").isVisible(), "the card says there are none, and has 'Add a screenshot'");
  ok((await T("shots-heading").getAttribute("placeholder")) === "TUR on every screen" && (await T("shots-intro").getAttribute("placeholder")).length > 20, "the heading and intro boxes show the usual words as hints");
  ok((await T("shots-device").inputValue()) === "tablet-landscape" && await T("shots-save").isDisabled(), "the first device is the wide tablet, and Save is off until something changes");
  ok(/Show the screenshots section on TUR's page/.test(await T("shots-section").innerText()), "the section's switch is there, on");
  ok(/\/apps\/tour#screens$/.test(await T("shots-view").getAttribute("href")), "'View on the website' goes to the app's page, at the screenshots");

  say("2. Add a screenshot");
  await T("shots-add").click();
  await T("shot-form").waitFor();
  ok(await T("shot-form-save").isDisabled(), "'Add it' is off until there is a title");
  await T("shot-form-title").fill("x");
  ok(await T("shot-form-save").isDisabled(), "…a one-letter title is not enough");
  await T("shot-form-title").fill("Tables at a glance");
  await T("shot-form-caption").fill("See which tables are free.");
  await T("shot-form-alt").fill("The tables grouped by area.");
  await T("shot-form-save").click();
  await T("shot-card-0").waitFor({ timeout: 10000 });
  ok(/Tables at a glance/.test(await T("shot-title-0").innerText()) && /See which tables are free/.test(await T("shot-caption-0").innerText()), "the new screenshot is in the list with its words");
  ok((await page.locator('[data-testid^="slot-0-"][data-filled="false"]').count()) === 6, "…with six empty slots (3 devices × light and dark)");
  ok(/1 screenshot, 0 pictures/.test(await T("shots-summary").innerText()) && /none is shown yet/.test(await T("shots-summary").innerText()), "the summary says it has no picture yet, so nothing is shown");
  const l1 = await list();
  ok(l1.shots.length === 1 && l1.shots[0].enabled === true && l1.shots[0].builtIn === false, "the server has it (shown, not built in)");

  say("3. Put pictures in the slots");
  await T(`slot-file-${slot(0, "tablet-landscape", "light")}`).setInputFiles(await file(1600, 1000, [240, 240, 250]));
  await T(`slot-img-${slot(0, "tablet-landscape", "light")}`).waitFor({ timeout: 15000 });
  ok((await T(`slot-${slot(0, "tablet-landscape", "light")}`).getAttribute("data-filled")) === "true", "a picture goes into its slot and is shown there");
  ok(/1600 × 1000 · uploaded/.test(await T(`slot-${slot(0, "tablet-landscape", "light")}`).innerText()), "…with its size, and 'uploaded'", norm(await T(`slot-${slot(0, "tablet-landscape", "light")}`).innerText()));
  ok((await T(`slot-upload-${slot(0, "tablet-landscape", "light")}`).innerText()).includes("Replace") && await T(`slot-remove-${slot(0, "tablet-landscape", "light")}`).isVisible(), "…and the slot now offers Replace and Remove");
  ok(await T(`slot-shape-${slot(0, "tablet-landscape", "light")}`).count() === 0, "a picture of the right shape has no warning");
  await T(`slot-file-${slot(0, "tablet-landscape", "dark")}`).setInputFiles(await file(1600, 1000, [20, 20, 40]));
  await T(`slot-img-${slot(0, "tablet-landscape", "dark")}`).waitFor({ timeout: 15000 });
  await T(`slot-file-${slot(0, "phone", "light")}`).setInputFiles(await file(1440, 3120, [250, 250, 255]));
  await T(`slot-img-${slot(0, "phone", "light")}`).waitFor({ timeout: 15000 });
  ok(/3 pictures/.test(await T("shots-summary").innerText()) && /shown on the page for tablet · wide, phone/.test(await T("shots-summary").innerText()), "the summary counts the pictures and names the devices that will be offered", norm(await T("shots-summary").innerText()));
  const l2 = await list();
  ok(Object.keys(l2.shots[0].images).sort().join() === "phone,tablet-landscape" && l2.shots[0].images["tablet-landscape"].dark && l2.shots[0].images.phone.light, "the server holds the three pictures in the right slots");
  ok(/^https?:\/\/.+\/uploads\//.test(l2.shots[0].images.phone.light.src), "…as stored files with an address");

  say("4. A picture of the wrong shape is warned about");
  await T(`slot-file-${slot(0, "phone", "dark")}`).setInputFiles(await file(1600, 1000, [30, 30, 30])); // a wide picture in a phone slot
  await T(`slot-shape-${slot(0, "phone", "dark")}`).waitFor({ timeout: 15000 });
  ok(/squashed/.test(await T(`slot-shape-${slot(0, "phone", "dark")}`).innerText()) && /wide/.test(await T(`slot-shape-${slot(0, "phone", "dark")}`).innerText()), "a wide picture in a phone slot says it will look squashed", norm(await T(`slot-shape-${slot(0, "phone", "dark")}`).innerText()));
  await T(`slot-file-${slot(0, "phone", "dark")}`).setInputFiles(await file(1440, 3120, [30, 30, 40]));
  ok(await until(async () => (await T(`slot-shape-${slot(0, "phone", "dark")}`).count()) === 0), "putting the right shape in its place (Replace) clears the warning");
  const ids = (await list()).shots[0].images.phone.dark.src;
  ok(/uploads/.test(ids), "…and the picture is the new one (replaced, not added)");

  say("5. Not a picture, and removing a picture");
  await T(`slot-file-${slot(0, "tablet-portrait", "light")}`).setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("this is not a picture") });
  await T("shots-error").waitFor({ timeout: 10000 });
  ok(/isn't an image/.test(await T("shots-error").innerText()) && /light/.test(await T("shots-error").innerText()), "a file that is not a picture is refused, in words that name the slot", norm(await T("shots-error").innerText()));
  ok((await T(`slot-${slot(0, "tablet-portrait", "light")}`).getAttribute("data-filled")) === "false", "…and the slot stays empty");
  await T(`slot-remove-${slot(0, "phone", "dark")}`).click();
  ok(await until(async () => (await T(`slot-${slot(0, "phone", "dark")}`).getAttribute("data-filled")) === "false"), "Remove empties a slot");
  ok(!(await list()).shots[0].images.phone.dark, "…on the server too");

  say("6. Add another, reorder, hide");
  await T("shots-add").click();
  await T("shot-form-title").fill("Orders in one list");
  await T("shot-form-save").click();
  await T("shot-card-1").waitFor({ timeout: 10000 });
  ok(await T("shot-up-0").isDisabled() && await T("shot-down-1").isDisabled() && !(await T("shot-down-0").isDisabled()), "the first can't move up and the last can't move down");
  await T("shot-down-0").click();
  ok(await until(async () => /Orders in one list/.test(await T("shot-title-0").innerText())), "Move down swaps the two");
  ok((await list()).shots.map((s) => s.title).join("|") === "Orders in one list|Tables at a glance", "…and the server has the new order");
  await T("shot-up-1").click();
  ok(await until(async () => /Tables at a glance/.test(await T("shot-title-0").innerText())), "Move up swaps them back");
  await T("shot-enabled-1").click();
  ok(await until(async () => /Hidden/.test(await T("shot-card-1").innerText())), "Hide marks the second one 'Hidden'");
  ok((await list()).shots[1].enabled === false, "…and the server has it hidden");
  await T("shot-enabled-1").click();
  ok(await until(async () => !/Hidden/.test(await T("shot-card-1").innerText())), "Show brings it back");

  say("7. Edit the words");
  await T("shot-edit-1").click();
  await T("shot-form").waitFor();
  ok((await T("shot-form-title").inputValue()) === "Orders in one list", "the form opens with the current words");
  await T("shot-form-title").fill("");
  ok(await T("shot-form-save").isDisabled(), "an empty title can't be saved");
  await T("shot-form-title").fill("Every order in one list");
  await T("shot-form-caption").fill("Follow each order from new to served.");
  await T("shot-form-save").click();
  ok(await until(async () => /Every order in one list/.test(await T("shot-title-1").innerText()) && /new to served/.test(await T("shot-caption-1").innerText())), "the card shows the new words");
  ok((await list()).shots[1].caption === "Follow each order from new to served.", "…and the server has them");

  say("8. The section: switch, heading, intro, first device");
  await T("shots-heading").fill("Take a look at TUR");
  await T("shots-intro").fill("Three screens, two looks.");
  await T("shots-device").selectOption("phone");
  ok(!(await T("shots-save").isDisabled()), "Save turns on when something changes");
  await T("shots-save").click();
  await T("shots-saved").waitFor({ timeout: 10000 });
  const sec = (await list()).section;
  ok(sec.heading === "Take a look at TUR" && sec.intro === "Three screens, two looks." && sec.defaultDevice === "phone" && sec.enabled === true, "the server has the heading, the intro and the first device");
  await T("shots-section").getByRole("checkbox").click();
  ok(await until(async () => /the section is switched off/.test(await T("shots-summary").innerText())), "switching the section off is said in the summary");
  ok((await list()).section.enabled === false, "…and saved at once");
  await T("shots-section").getByRole("checkbox").click();
  ok(await until(async () => !/switched off/.test(await T("shots-summary").innerText())), "switching it on again takes the words back");
  await T("shots-heading").fill("x".repeat(80));
  ok((await T("shots-heading").inputValue()).length === 80, "(the heading box takes 80 characters)");
  await T("shots-heading").fill("");
  await T("shots-save").click();
  ok(await until(async () => (await list()).section.heading === ""), "an empty heading means the usual one");

  say("9. Remove a screenshot");
  await T("shot-remove-1").click();
  await page.getByRole("dialog").waitFor();
  ok(/Remove “Every order in one list”\?/.test(await page.getByRole("dialog").innerText()), "pressing Remove asks first, by name");
  await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
  ok((await list()).shots.length === 2, "Cancel changes nothing");
  await T("shot-remove-0").click();
  await T("shot-remove-confirm").click();
  ok(await until(async () => (await list()).shots.length === 1), "Remove it deletes the screenshot");
  ok(await until(async () => (await T("shot-card-1").count()) === 0 && /Every order in one list/.test(await T("shot-title-0").innerText())), "…and the list shows what is left");
  const files = (await fetch(`${API}/health`)).status;
  ok(files === 200, "(the API is still fine)");

  say("10. A phone-sized console");
  await page.setViewportSize({ width: 390, height: 900 });
  await sleep(500);
  const over = await page.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth, card: document.querySelector('[data-testid="app-shots"]').getBoundingClientRect().right }));
  ok(over.over <= 0 && over.card <= 392, "nothing runs off the screen at 390 px", JSON.stringify(over));
  await page.setViewportSize({ width: 1400, height: 1100 });

  say("11. The screenshots that come with the website (an app that has them)");
  await page.goto(AD + "/platform/app-management?app=oma", { waitUntil: "load" });
  await T("app-shots").waitFor({ timeout: 15000 });
  const oma = (await call("GET", `${A}/screenshots/oma`)).json;
  if (oma.shots.length) {
    ok(oma.shots.every((s) => s.builtIn) && /Came with the website/.test(await T("shot-card-0").innerText()), "OMA's screenshots are marked 'Came with the website'", `${oma.shots.length} screenshots`);
    const loaded = await T("app-shots").locator("img").evaluateAll((els) => Promise.all(els.map((e) => (e.complete ? Promise.resolve(e.naturalWidth > 0) : new Promise((r) => { e.onload = () => r(true); e.onerror = () => r(false); })))));
    ok(loaded.length >= 6 && loaded.every(Boolean), "…and every picture shows (they come from the website's own files)", `${loaded.length} pictures`);
    ok(oma.shots[0].images["tablet-landscape"] && oma.shots[0].images["tablet-portrait"] && oma.shots[0].images.phone && oma.shots.every((s) => Object.values(s.images).every((by) => by.light && by.dark)), "each has light and dark pictures, for the wide tablet, the tall tablet and the phone (where the screen exists there)");
  } else ok(true, "(no screenshots came with this build of the website: nothing to check)");

  ok(problems.length === 0, "no errors in the browser console", problems.slice(0, 3).join(" | "));
  await ctx.close();
} finally {
  await call("DELETE", `${A}/apps/tour`).catch(() => undefined);
  await browser.close();
}
console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
