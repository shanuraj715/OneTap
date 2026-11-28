// The version in the three places a person looks, in Chrome against the bench: the storefront's footer, the website's footer, the admin panel's left
// sidebar (open and folded, store dashboard and platform console) — each equal to version.json — and the API's header over the wire.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
const AD = "http://localhost:3171";
const API = "http://localhost:3097";
const SF = "http://localhost:3170";
const WEB = "http://localhost:3173";
const BENCH = fileURLToPath(new URL("../bench/bench.mjs", import.meta.url));
const VERSION = JSON.parse(readFileSync(fileURLToPath(new URL("../../../version.json", import.meta.url)), "utf8")).version;
let pass = 0, fail = 0;
const problems = [];
let seen = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); if (problems.length > seen) { console.log(`      ^ browser error: ${problems.slice(seen).join(" | ")}`); seen = problems.length; } };
const say = (s) => console.log(`\n=== ${s}`);
const norm = (t) => t.replace(/\s+/g, " ").trim();

const browser = await chromium.launch();
const newPage = async (viewport = { width: 1360, height: 1000 }) => {
  const page = await (await browser.newContext({ viewport })).newPage();
  page.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !/Failed to load resource|React DevTools|favicon|WebSocket/.test(m.text())) problems.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
  return page;
};
const signIn = async (page, email, pw) => {
  await page.goto(AD + "/", { waitUntil: "load" });
  await page.fill('input[type="email"]', email); await page.fill('input[type="password"]', pw);
  await page.getByRole("button", { name: /sign in|log in/i }).first().click();
  await page.waitForSelector("aside a", { timeout: 20000 });
};

try {
  say("0. The version being looked for");
  ok(/^v-\d{2}\.\d{2}\.\d{2}-\d{3,}$/.test(VERSION), "version.json holds a good version", VERSION);

  say("1. The API's header, over the wire");
  const r = await fetch(`${API}/health`);
  ok(r.headers.get("x-rasoipulse-version") === VERSION, "the bench API answers with the version in X-RasoiPulse-Version", String(r.headers.get("x-rasoipulse-version")));

  say("2. The admin panel's left sidebar");
  const owner = await newPage();
  await signIn(owner, "o@acme.test", "Owner123!");
  const tag = owner.getByTestId("app-version");
  await tag.waitFor({ timeout: 10000 });
  ok(norm(await tag.innerText()) === `Rasoi Pulse ${VERSION}`, "the store dashboard's sidebar footer reads 'Rasoi Pulse <version>'", norm(await tag.innerText()));
  const inAside = await tag.evaluate((el) => !!el.closest("aside"));
  ok(inAside, "…and it sits inside the left sidebar");
  const box = await tag.boundingBox(); const aside = await owner.locator("aside").first().boundingBox();
  ok(box.y > aside.y + aside.height * 0.6 && box.x < 400, "…at the bottom of it, with the user box above", `${Math.round(box.y)} of ${Math.round(aside.y + aside.height)}`);
  const signOutBox = await owner.getByRole("button", { name: /sign out/i }).first().boundingBox();
  ok(box.y > signOutBox.y, "…below the Sign out button");
  await owner.getByRole("button", { name: /collapse the sidebar/i }).click();
  await owner.waitForTimeout(500);
  const folded = owner.getByTestId("app-version");
  ok((await folded.innerText()).includes(VERSION) && (await folded.getAttribute("title")) === `Rasoi Pulse ${VERSION}`, "folded, the sidebar still shows the version (small), with the full words on hover", norm(await folded.innerText()));
  ok((await folded.boundingBox()).x + (await folded.boundingBox()).width <= (await owner.locator("aside").first().boundingBox()).width + 1, "…and it fits inside the folded sidebar");
  await owner.getByRole("button", { name: /expand the sidebar/i }).click();

  const sup = await newPage();
  await signIn(sup, "super@sandbox.test", "Super123!");
  await sup.getByTestId("app-version").waitFor({ timeout: 10000 });
  ok(norm(await sup.getByTestId("app-version").innerText()) === `Rasoi Pulse ${VERSION}`, "the platform console's sidebar shows it too");
  const phone = await newPage({ width: 390, height: 850 });
  await signIn(phone, "o@acme.test", "Owner123!").catch(() => undefined);
  ok((await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)), "a phone-width screen does not scroll sideways");

  say("3. The storefront footer");
  const sf = await newPage();
  for (const path of ["/main", "/second"]) {
    await sf.goto(SF + path, { waitUntil: "load" });
    const v = sf.getByTestId("app-version");
    await v.waitFor({ timeout: 15000 });
    ok(norm(await v.innerText()) === `Rasoi Pulse · ${VERSION}`, `${path}: the footer ends with 'Rasoi Pulse · <version>'`, norm(await v.innerText()));
    const footerBottom = await sf.locator("footer").first().boundingBox().catch(() => null);
    const vb = await v.boundingBox();
    ok(!footerBottom || vb.y >= footerBottom.y + footerBottom.height - 2, `${path}: it sits under the store's own footer`);
  }
  await sf.goto(SF + "/main", { waitUntil: "load" });
  ok((await sf.getByTestId("app-version").count()) === 1, "exactly one version line on the page");
  ok(!/undefined|NaN/.test(await sf.getByTestId("app-version").innerText()), "no 'undefined' in it");
  const sfPhone = await newPage({ width: 390, height: 850 });
  await sfPhone.goto(SF + "/main", { waitUntil: "load" });
  ok(await sfPhone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "on a phone the storefront page still fits its width with the version line");

  say("4. The website footer");
  execFileSync(process.execPath, [BENCH, "website"], { stdio: "inherit" });
  const web = await newPage();
  for (const path of ["/", "/apps"]) {
    await web.goto(WEB + path, { waitUntil: "load" });
    const v = web.getByTestId("app-version");
    await v.waitFor({ timeout: 15000 });
    ok(norm(await v.innerText()) === VERSION, `${path}: the footer shows the version`, norm(await v.innerText()));
    ok(await v.evaluate((el) => !!el.closest("footer")), `${path}: …inside the footer`);
  }
} catch (e) {
  ok(false, "the suite stopped with an error", String(e?.stack ?? e).split("\n").slice(0, 4).join(" | "));
} finally {
  await browser.close();
  console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
