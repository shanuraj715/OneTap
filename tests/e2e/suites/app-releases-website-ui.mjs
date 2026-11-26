// The website's /app page — where staff are sent to download the staff app — driven in Chrome against the bench (API :3097 and the
// marketing website :3173, which this suite starts if it isn't running). Versions are published and withdrawn through the console's API
// and the page must follow within seconds (the API tells the website to refresh its cache).
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { makeApk } from "./_apk.mjs";
const BENCH = fileURLToPath(new URL("../bench/bench.mjs", import.meta.url));
const WEB = "http://localhost:3173";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const say = (s) => console.log(`\n=== ${s}`);
const problems = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 20000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await fn()) return true; } catch { /* retry */ } await sleep(400); } return false; };

execFileSync(process.execPath, [BENCH, "website"], { stdio: "inherit" }); // builds it from the current code when it is out of date

const login = async (email, password) => (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const sup = await login("super@sandbox.test", "Super123!");
const sa = async (method, path, body, raw) => {
  const r = await fetch(API + path, { method, headers: { cookie: sup, "content-type": raw ? "application/octet-stream" : "application/json" }, body: raw ?? (body ? JSON.stringify(body) : undefined) });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};
const upload = async (version, { notes = "", force = false, publish = true, bytes = 40_000 } = {}) => {
  const apk = makeApk(bytes);
  const s = await sa("POST", "/api/platform/app-releases/uploads", { fileName: `oma-${version}.apk`, size: apk.length });
  await sa("PUT", `/api/platform/app-releases/uploads/${s.json.uploadId}/chunks/0`, null, apk);
  const done = await sa("POST", `/api/platform/app-releases/uploads/${s.json.uploadId}/complete`, { version, notes, force, publish });
  return { apk, release: done.json.release };
};
const clearAll = async () => { for (const r of (await sa("GET", "/api/platform/app-releases")).json.releases ?? []) await sa("DELETE", `/api/platform/app-releases/${r.id}`); };

let browser;
try {
  await clearAll();
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1360, height: 1000 } });
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|favicon|status of 4\d\d|status of 5\d\d/.test(m.text())) problems.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
  const open = async () => { await page.goto(WEB + "/app", { waitUntil: "load" }); return page.locator("main"); };
  const refresh = async (check) => until(async () => { await open(); return check(await page.locator("main").innerText()); }, 25000);

  say("1. Nothing is published yet");
  await refresh((t) => /No version has been published yet/.test(t));
  const main = page.locator("main");
  ok(/No version has been published yet/.test(await main.innerText()), "the page says no version has been published");
  ok(await page.getByRole("link", { name: /^Download v-/ }).count() === 0, "and offers no download button");
  ok(await page.getByRole("heading", { name: "Every version" }).count() === 0, "and no version list");
  ok(await page.getByRole("heading", { name: "Rasoi Pulse OMA" }).isVisible(), "the page still introduces the app");
  ok(await page.getByRole("heading", { name: "Three steps, about a minute" }).isVisible(), "and still explains how to install");
  ok(/OMA/.test(await page.title()), "the browser tab has a title that names the app", await page.title());
  ok(/noindex/.test((await page.locator('meta[name="robots"]').first().getAttribute("content")) ?? ""), "the page asks search engines not to list it");

  say("2. A published version appears");
  const v1 = await upload("v-261126-001", { notes: "First version\nSign in and take orders at the tables", bytes: 60_000 });
  await refresh((t) => /Download v-261126-001/.test(t));
  const dl = page.getByRole("link", { name: /^Download v-261126-001$/ });
  ok(await dl.isVisible(), "the download button names the version");
  const href = await dl.getAttribute("href");
  ok(href === v1.release.downloadUrl, "…and points at the API's download address", href);
  const t2 = await main.innerText();
  ok(/Android 11 or newer/.test(t2) && /58\.\d KB|58 KB|59 KB|\d+(\.\d)? KB/.test(t2), "it says Android 11 or newer and the file's size", (t2.match(/\d+(\.\d)? [KM]B/) ?? [])[0]);
  const ticket = page.locator(".ticket");
  ok(/v-261126-001/.test(await ticket.innerText()) && /Sign in and take orders at the tables/.test(await ticket.innerText()), "the ticket shows the version and its release notes");
  ok(await ticket.locator(".stamp").count() === 0, "no 'Required' stamp on an optional version");
  const file = await fetch(href);
  ok(file.status === 200 && Buffer.from(await file.arrayBuffer()).equals(v1.apk), "the button's file is exactly the uploaded APK");
  const list = page.locator(".app-versions li.app-version");
  ok(await list.count() === 1 && /latest/i.test(await list.first().innerText()), "the version list has it, marked Latest");

  say("3. A required version");
  const v2 = await upload("v-261126-002", { notes: "Security fix", force: true });
  await refresh((t) => /Download v-261126-002/.test(t));
  ok(await page.getByRole("link", { name: /^Download v-261126-002$/ }).isVisible(), "the button now offers v-261126-002");
  ok(await page.locator(".ticket .stamp").isVisible() && /required/i.test(await page.locator(".ticket .stamp").innerText()), "its ticket carries a 'Required' stamp");
  const rows = page.locator(".app-versions li.app-version");
  ok(await rows.count() === 2, "the list has both versions", String(await rows.count()));
  const first = await rows.nth(0).innerText(), second = await rows.nth(1).innerText();
  ok(/v-261126-002/.test(first) && /latest/i.test(first) && /required/i.test(first), "newest first: 002, marked Latest and Required");
  ok(/v-261126-001/.test(second) && !/latest/i.test(second) && !/required/i.test(second), "001 below it, with neither mark");
  ok(/Security fix/.test(first) && /Sign in and take orders/.test(second), "each keeps its own notes");
  await rows.nth(0).getByText("Check the file").click();
  ok((await rows.nth(0).innerText()).includes(v2.release.sha256), "'Check the file' shows the file's SHA-256", v2.release.sha256.slice(0, 12) + "…");

  say("4. Drafts and withdrawn versions stay hidden");
  await upload("v-261126-003", { notes: "Not ready", publish: false });
  await sa("PATCH", `/api/platform/app-releases/${v2.release.id}`, { status: "withdrawn" });
  await refresh((t) => /Download v-261126-001/.test(t) && !/v-261126-002/.test(t));
  const t4 = await main.innerText();
  ok(/Download v-261126-001/.test(t4) && !/v-261126-002/.test(t4) && !/v-261126-003/.test(t4) && !/Not ready/.test(t4), "withdrawing 002 hides it, and the draft 003 was never shown; 001 is the latest again");
  ok(await page.locator(".ticket .stamp").count() === 0, "so the 'Required' stamp is gone too");
  ok((await fetch(v2.release.downloadUrl)).status === 404, "and the withdrawn file can't be downloaded");

  say("5. A phone-sized screen");
  await page.setViewportSize({ width: 390, height: 844 });
  await open();
  ok(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), "nothing sticks out sideways");
  const btn = await page.getByRole("link", { name: /^Download v-261126-001$/ }).boundingBox();
  const tk = await page.locator(".ticket").boundingBox();
  ok(btn && btn.x >= 0 && btn.x + btn.width <= 390, "the download button fits the screen", `${Math.round(btn?.width ?? 0)} px wide`);
  ok(tk && tk.x >= 0 && tk.x + tk.width <= 392, "and so does the ticket", `${Math.round(tk?.x ?? 0)} → ${Math.round((tk?.x ?? 0) + (tk?.width ?? 0))}`);

  say("6. /app can't be taken by a website page");
  const clash = await sa("POST", "/api/platform/site/pages", { slug: "app", title: "App" });
  ok(clash.status === 400 && /used by the website itself/.test(clash.json.error ?? ""), "creating a page called 'app' in the console is refused", clash.json.error);
} finally {
  await clearAll().catch(() => undefined);
  await browser?.close();
}
ok(problems.length === 0, "no errors in the browser", problems.slice(0, 3).join(" | "));
console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
