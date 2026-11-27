// The console's "App Management" page, driven in Chrome against the bench: upload the staff app's APK (a real file picked in the
// browser, sent in 4 MB pieces with a progress bar), publish it, make an update required, edit the notes, withdraw, delete.
// What the phones are told is checked through the same public endpoint the app uses.
import { chromium } from "playwright";
import { makeApk } from "./_apk.mjs";
const AD = "http://localhost:3171";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const say = (s) => console.log(`\n=== ${s}`);
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
const phoneCheck = async (code) => (await (await fetch(`${API}/api/app-updates/check?versionCode=${code}`)).json());
const listed = async (app = "oma") => (await sa("GET", `/api/platform/app-releases?app=${app}`)).json;
const apkFile = (name, bytes) => ({ name, mimeType: "application/vnd.android.package-archive", buffer: makeApk(bytes) });

// start clean: whatever an earlier run left
for (const app of ["oma", "kda"]) for (const r of (await listed(app)).releases ?? []) await sa("DELETE", `/api/platform/app-releases/${r.id}`);

let browser;
try {
  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 1000 } });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|favicon|status of 4\d\d|status of 5\d\d/.test(m.text())) problems.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
  page.on("dialog", (d) => { dialogs.push(d.message()); void d.accept(); });
  await page.goto(AD + "/", { waitUntil: "load" });
  await page.fill('input[type="email"]', "super@sandbox.test"); await page.fill('input[type="password"]', "Super123!");
  await page.getByRole("button", { name: /sign in|log in/i }).first().click();
  await page.waitForSelector("text=Stores");

  say("1. The page, with nothing uploaded yet");
  await page.getByRole("link", { name: "App Management" }).first().click();
  await page.getByRole("heading", { name: "App Management" }).waitFor({ timeout: 15000 });
  ok(page.url().endsWith("/platform/app-management"), "the sidebar has an 'App Management' item that opens the page", page.url());
  await page.getByText("No version uploaded yet").waitFor();
  const summary = page.getByTestId("app-summary");
  ok(/Nothing yet/.test(await summary.innerText()), "it says no version is being offered to phones");
  ok(/optional/i.test(await summary.innerText()), "and that updates are optional right now");
  ok(await summary.getByRole("link", { name: /localhost:3173\/app/ }).count() === 1, "it shows the download page staff are sent to", (await summary.innerText()).match(/localhost:3173\/app/)?.[0]);

  say("2. The 'New version' pop-up checks the file and the version before it lets anything go");
  const open = async () => { await page.getByRole("button", { name: /^New version$/ }).click(); await page.getByRole("dialog").waitFor(); return page.getByRole("dialog"); };
  const dlg = await open();
  const goBtn = () => dlg.getByRole("button", { name: /^Upload (and publish|as draft)$/ });
  ok(await goBtn().isDisabled(), "'Upload and publish' is off until a file and a version are chosen");
  await dlg.locator('input[type="file"]').setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
  ok(await dlg.getByText("That is not an .apk file.").isVisible(), "a file that isn't an .apk is refused straight away");
  await dlg.locator('input[type="file"]').setInputFiles(apkFile("huge.apk", 21 * 1024 * 1024));
  ok(await dlg.getByText(/The most allowed is 20/).isVisible() && await goBtn().isDisabled(), "a file over the size limit says so (with the limit) and can't be sent");
  const nineApk = apkFile("rasoi-pulse-oma-v-26.11.26-001.apk", 9 * 1024 * 1024 + 321); // 3 pieces
  const nine = nineApk.buffer.length;
  await dlg.locator('input[type="file"]').setInputFiles(nineApk);
  const versionBox = dlg.getByPlaceholder("v-26.11.27-003");
  ok(await versionBox.inputValue() === "v-26.11.26-001", "the version box is filled in from the file's name", await versionBox.inputValue());
  ok(await goBtn().isEnabled(), "now the button is ready");
  await versionBox.fill("version one");
  ok(await dlg.getByText(/Use the form v-YY\.MM\.DD-NNN/).isVisible() && await goBtn().isDisabled(), "a version that isn't v-YY.MM.DD-NNN is explained and blocks the button");
  await versionBox.fill("v-26.11.26-001");
  ok(await dlg.getByText(/Use the form/).count() === 0 && await goBtn().isEnabled(), "fixing it clears the message");
  ok(await dlg.getByText(/Every phone on an older version will be blocked/).count() === 0, "no warning while 'Update required' is off");
  await dlg.getByRole("checkbox", { name: "Update required", exact: true }).check();
  ok(await dlg.getByText(/Every phone on an older version will be blocked/).isVisible(), "ticking 'Update required' (with Publish now) warns that older phones will be blocked");
  await dlg.getByRole("checkbox", { name: "Update required", exact: true }).uncheck();
  await dlg.locator("textarea").fill("First version: sign in, take orders at the tables.");

  say("3. Uploading shows its progress, and can be cancelled");
  // slow the connection down so the bar is visible (about 1.5 MB a second up)
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 20, downloadThroughput: -1, uploadThroughput: 1.5 * 1024 * 1024 });
  await goBtn().click();
  const progress = page.getByTestId("upload-progress");
  await progress.waitFor({ timeout: 15000 });
  ok(await until(async () => /Sending .* of .*/.test(await progress.innerText()), 8000), "a progress bar says how much has been sent", (await progress.innerText()).replace(/\s+/g, " "));
  ok(await dlg.getByRole("button", { name: "Cancel upload" }).isVisible(), "'Cancel upload' is offered while it is going");
  const pctOf = async () => Number((await progress.innerText()).match(/(\d+)%/)?.[1] ?? -1);
  const p1 = await pctOf(); await sleep(1200); const p2 = await pctOf();
  ok(p1 >= 0 && p2 > p1 && p2 < 100, "the percentage climbs while it sends", `${p1}% → ${p2}%`);
  await dlg.getByRole("button", { name: "Cancel upload" }).click();
  await dlg.getByText("Upload cancelled.").waitFor({ timeout: 10000 });
  ok((await listed()).releases.length === 0, "cancelling creates nothing");
  ok(await dlg.getByRole("button", { name: /^Upload and publish$/ }).isEnabled(), "and the form is ready to try again");

  say("4. A whole upload, published");
  await dlg.getByRole("button", { name: /^Upload and publish$/ }).click();
  await page.getByText("v-26.11.26-001 is live").waitFor({ timeout: 60000 });
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  ok(/Staff phones will offer it/.test(await page.getByRole("dialog").innerText()), "it says it is live, and that staff may choose Later");
  await page.getByRole("button", { name: "Done" }).click();
  const card1 = page.getByTestId("release-v-26.11.26-001");
  await card1.waitFor();
  const t1 = await card1.innerText();
  ok(/Published/.test(t1) && /9\.0 MB|9 MB/.test(t1) && /0 downloads/.test(t1) && /First version: sign in/.test(t1), "the version is listed: Published, its size, 0 downloads and its notes", t1.replace(/\s+/g, " ").slice(0, 160));
  ok(/v-26.11.26-001/.test(await summary.innerText()) && !/Nothing yet/.test(await summary.innerText()), "the summary now says phones are offered v-26.11.26-001");
  const api1 = (await listed()).releases[0];
  ok(api1.version === "v-26.11.26-001" && api1.status === "published" && api1.size === nine && api1.sha256.length === 64, "the server holds the file with its real size and SHA-256", `${api1.size} bytes`);
  const c0 = await phoneCheck(0), c1 = await (await fetch(`${API}/api/app-updates/check?versionCode=1`)).json();
  ok(!c1.updateAvailable, "a phone already on build 1 is told nothing");
  ok((await (await fetch(`${API}/api/app-updates/releases`)).json()).latest?.version === "v-26.11.26-001", "the website's list has it");
  void c0;

  say("5. A second version as a draft, then published, and made required");
  const dlg2 = await open();
  const secondApk = apkFile("oma.apk", 70_000);
  await dlg2.locator('input[type="file"]').setInputFiles(secondApk);
  await dlg2.getByPlaceholder("v-26.11.27-003").fill("v-26.11.26-001");
  ok(await dlg2.getByText(/Build 1 already exists \(v-26.11.26-001\)/).isVisible() && await dlg2.getByRole("button", { name: /^Upload and publish$/ }).isDisabled(), "a build number that is taken is refused with the version it clashes with");
  await dlg2.getByPlaceholder("v-26.11.27-003").fill("v-26.11.26-002");
  await dlg2.locator("textarea").fill("Two: faster menu.");
  await dlg2.getByRole("checkbox", { name: "Publish now", exact: true }).uncheck();
  await dlg2.getByRole("button", { name: "Upload as draft" }).click();
  await page.getByText("v-26.11.26-002 is saved as a draft").waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: "Done" }).click();
  const card2 = page.getByTestId("release-v-26.11.26-002");
  await card2.waitFor();
  ok(/Draft/.test(await card2.innerText()), "the second one is listed as a Draft");
  ok((await phoneCheck(1)).updateAvailable === false, "a draft is invisible to phones");
  await card2.getByRole("button", { name: /^Publish$/ }).click();
  await until(async () => /Published/.test(await card2.innerText()));
  ok((await phoneCheck(1)).updateAvailable === true && (await phoneCheck(1)).force === false, "published: a phone on build 1 is offered it — optional");
  ok(/optional/i.test(await summary.innerText()) && /v-26.11.26-002/.test(await summary.innerText()), "the summary now offers v-26.11.26-002 and still says updates are optional");
  const requiredBox = card2.getByRole("checkbox", { name: "Required", exact: true });
  await requiredBox.click(); // (it changes when the server has answered, so a plain check() would not wait for it)
  await until(async () => (await phoneCheck(1)).force === true && await requiredBox.isChecked());
  ok((await phoneCheck(1)).force === true, "ticking 'Required' makes the update compulsory for build 1");
  ok(await card2.getByText("Update required").first().isVisible() && /older than v-26.11.26-002/.test(await summary.innerText()), "the card is marked, and the summary says everything older than v-26.11.26-002 is stopped");
  const login426 = await fetch(`${API}/api/auth/app-login`, { method: "POST", headers: { "content-type": "application/json", "x-oma-version-code": "1" }, body: JSON.stringify({ email: "o@acme.test", password: "Owner123!" }) });
  ok(login426.status === 426, "an old build is now turned away at sign-in (426)", String(login426.status));
  await requiredBox.click();
  await until(async () => (await phoneCheck(1)).force === false && !(await requiredBox.isChecked()));
  ok((await phoneCheck(1)).force === false && /optional/i.test(await summary.innerText()), "unticking it makes it optional again, on the page and for phones");

  say("6. Notes, withdraw, download");
  await card2.getByRole("button", { name: "Notes" }).click();
  const nd = page.getByRole("dialog");
  await nd.locator("textarea").fill("Two: faster menu and a fix for the table list.");
  await nd.getByRole("button", { name: "Save notes" }).click();
  await nd.waitFor({ state: "detached" });
  ok(/fix for the table list/.test(await card2.innerText()), "edited release notes show on the card");
  ok((await (await fetch(`${API}/api/app-updates/check?versionCode=1`)).json()).latest.notes.includes("table list"), "…and reach phones");
  await card2.getByRole("button", { name: "Withdraw" }).click();
  await until(async () => /Withdrawn/.test(await card2.innerText()));
  ok((await phoneCheck(1)).updateAvailable === false, "a withdrawn version vanishes for phones");
  ok(await card2.getByRole("link", { name: /APK/ }).getAttribute("aria-disabled") === "true", "and its APK link is switched off");
  await card2.getByRole("button", { name: "Publish again" }).click();
  await until(async () => /Published/.test(await card2.innerText()));
  const href = await card2.getByRole("link", { name: /APK/ }).getAttribute("href");
  const file = await fetch(href);
  const bytes = Buffer.from(await file.arrayBuffer());
  ok(file.status === 200 && bytes.equals(secondApk.buffer) && file.headers.get("content-type") === "application/vnd.android.package-archive", "the APK link downloads the file", `${file.status} ${bytes.length} bytes`);
  await page.reload({ waitUntil: "load" });
  await card2.waitFor();
  ok(/1 download\b/.test(await card2.innerText()), "the download counter shows on the card after the page is reloaded", (await card2.innerText()).match(/\d+ downloads?/)?.[0]);
  await card2.getByRole("button", { name: "File" }).click();
  ok((await card2.innerText()).includes((await listed()).releases[0].sha256), "'File' shows the SHA-256 and the file name");

  say("7. Delete");
  dialogs.length = 0;
  await card2.getByRole("button", { name: "Delete v-26.11.26-002" }).click();
  await card2.waitFor({ state: "detached", timeout: 10000 });
  ok(dialogs.length === 1 && /Delete v-26.11.26-002\?/.test(dialogs[0]) && /published right now/.test(dialogs[0]), "it asks first, and says the version is published right now", dialogs[0]);
  ok((await listed()).releases.length === 1 && (await fetch(href)).status === 404, "the version and its file are gone");

  say("8. On a phone-sized screen");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  ok(!wide, "nothing sticks out sideways");
  ok(await page.getByTestId("release-v-26.11.26-001").getByRole("button", { name: "Withdraw" }).isVisible(), "the card's buttons are still reachable");

  say("9. Every app has its own tab, list and numbers");
  await page.setViewportSize({ width: 1360, height: 1000 });
  await page.reload({ waitUntil: "load" });
  ok(await page.getByTestId("app-tab-oma").getAttribute("aria-selected") === "true" && await page.getByTestId("app-tab-kda").isVisible(), "the page has a tab for each app (OMA is open first)");
  await page.getByTestId("app-tab-kda").click();
  await page.getByText("No version uploaded yet").waitFor({ timeout: 15000 });
  ok(await page.getByTestId("release-v-26.11.26-001").count() === 0, "the KDA tab does not show OMA's versions");
  const dk = await open();
  ok(await dk.getByText("New version of Rasoi Pulse KDA").isVisible(), "the pop-up names the app it is for");
  await dk.locator('input[type="file"]').setInputFiles(apkFile("rasoi-pulse-kda-v-26.11.27-001.apk", 60_000));
  ok(await dk.getByPlaceholder("v-26.11.27-003").inputValue() === "v-26.11.27-001", "the version is filled from the file name (new form)");
  await dk.getByRole("button", { name: /^Upload and publish$/ }).click();
  await page.getByText("v-26.11.27-001 is live").waitFor({ timeout: 60000 });
  await page.getByRole("button", { name: "Done" }).click();
  ok(await page.getByTestId("release-v-26.11.27-001").isVisible(), "it appears in the KDA list, with build 1 (OMA has its own build 1)");
  ok((await listed("kda")).releases.length === 1 && !(await listed("oma")).releases.some((r) => r.version === "v-26.11.27-001"), "it is stored for KDA only");
  ok(/localhost:3173\/apps\/kda/.test(await page.getByTestId("app-summary").innerText()), "the summary shows KDA's own download page (/apps/kda)");
  await page.getByTestId("app-tab-oma").click();
  await page.getByTestId("release-v-26.11.26-001").waitFor({ timeout: 15000 });
  ok(await page.getByTestId("release-v-26.11.27-001").count() === 0 && /localhost:3173\/apps\/oma/.test(await page.getByTestId("app-summary").innerText()), "back on the OMA tab: its own list and its own page (/apps/oma)");
  const oldForm = await open();
  await oldForm.locator('input[type="file"]').setInputFiles(apkFile("x.apk", 60_000));
  await oldForm.getByPlaceholder("v-26.11.27-003").fill("v-261127-009");
  ok(await oldForm.getByText(/That is the old form/).isVisible() && await oldForm.getByRole("button", { name: /^Upload and publish$/ }).isDisabled(), "a version in the OLD form is explained and blocks the upload");
} finally {
  for (const app of ["oma", "kda"]) for (const r of (await listed(app)).releases ?? []) await sa("DELETE", `/api/platform/app-releases/${r.id}`).catch(() => undefined);
  await browser?.close();
}
ok(problems.length === 0, "no errors in the browser", problems.slice(0, 3).join(" | "));
console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
