// App Management: every app can be PUBLIC (in the website's list of apps) or PRIVATE (not listed; its page still opens for anyone with the link).
// The Admin app (and the new Business app) now have a tab and start private; the staff apps start public. In Chrome against the bench (super admin),
// with the bench's website for the listed / unlisted pages. What it changes is put back at the end.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
const AD = "http://localhost:3171";
const API = "http://localhost:3097";
const WEB = "http://localhost:3173";
const BENCH = fileURLToPath(new URL("../bench/bench.mjs", import.meta.url));
let pass = 0, fail = 0;
const problems = [];
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const say = (s) => console.log(`\n=== ${s}`);
const login = async () => (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "super@sandbox.test", password: "Super123!" }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const su = await login();
const call = async (method, path, body) => { const r = await fetch(API + path, { method, headers: { "content-type": "application/json", cookie: su }, body: body ? JSON.stringify(body) : undefined }); const t = await r.text(); let json = {}; try { json = JSON.parse(t); } catch {} return { status: r.status, json }; };
const listed = async () => (await (await fetch(`${API}/api/app-updates/apps`)).json()).apps.map((a) => a.id);
const norm = (t) => t.replace(/\s+/g, " ").trim();

const wasPublic = {};
for (const x of (await call("GET", "/api/platform/app-releases/settings")).json.settings) wasPublic[x.app] = x.public;

const browser = await chromium.launch();
try {
  say("1. The server: who is public to begin with");
  const ids = await listed();
  ok(ids.join() === "oma,kda,rda" || (["oma", "kda", "rda"].every((a) => ids.includes(a)) && !ids.includes("admin") && !ids.includes("business")), "the public list has the staff apps (OMA, KDA, RDA) and NOT the Admin or Business app", ids.join());
  const st = (await call("GET", "/api/platform/app-releases/settings")).json.settings;
  const by = Object.fromEntries(st.map((x) => [x.app, x]));
  ok(Object.keys(by).includes("admin") && Object.keys(by).includes("business"), "the console's app list has the Admin and Business apps too");
  ok(by.oma.public && by.kda.public && by.rda.public && !by.admin.public && !by.business.public, "settings: the staff apps are public, the Admin and Business apps private");
  ok(by.admin.publicByDefault === false && by.oma.publicByDefault === true && by.admin.pageUrl.endsWith("/apps/admin") && by.admin.usesRefreshInterval === false && by.oma.usesRefreshInterval === true, "…each says what its default is, its page address, and whether the refresh interval applies to it");
  const rel = (await fetch(`${API}/api/app-updates/releases?app=admin`)).json ? await (await fetch(`${API}/api/app-updates/releases?app=admin`)).json() : {};
  ok(rel.app?.id === "admin" && rel.app.listed === false && rel.pageUrl.endsWith("/apps/admin"), "a private app's own page data is still available (so its page opens for anyone with the link) and says it is not listed", JSON.stringify(rel.app ?? rel).slice(0, 100));

  say("2. The console: a tab for the Admin app with a Public / Private button");
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 1100 } });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !/Failed to load resource|React DevTools|favicon|WebSocket/.test(m.text())) problems.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
  page.on("dialog", (d) => d.accept());
  await page.goto(AD + "/", { waitUntil: "load" });
  await page.fill('input[type="email"]', "super@sandbox.test");
  await page.fill('input[type="password"]', "Super123!");
  await page.getByRole("button", { name: /sign in|log in/i }).first().click();
  await page.waitForSelector("aside a");
  await page.goto(AD + "/platform/app-management", { waitUntil: "load" });
  await page.getByTestId("app-tab-admin").waitFor({ timeout: 15000 });
  const tabs = await page.locator('[data-testid^="app-tab-"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-testid").replace("app-tab-", "")));
  ok(["oma", "kda", "rda", "admin", "business"].every((a) => tabs.includes(a)), "App Management has a tab for every app, the Admin app and the Business app included", tabs.join());
  ok(/Rasoi Pulse Admin/.test(await page.getByTestId("app-tab-admin").innerText()), "the Admin app's tab is named");

  await page.getByTestId("app-tab-oma").click();
  await page.getByTestId("app-visibility").waitFor();
  ok(/Public/.test(norm(await page.getByTestId("app-visibility-now").innerText())) && (await page.getByTestId("app-visibility-toggle").innerText()).trim() === "Make private" && (await page.getByTestId("app-visibility-link").count()) === 0, "OMA's tab: Public, the button says 'Make private', no link box");
  ok((await page.getByTestId("app-refresh").count()) === 1, "…and OMA still has its Refresh interval card");

  await page.getByTestId("app-tab-admin").click();
  await page.waitForFunction(() => /Rasoi Pulse Admin/.test(document.querySelector('[data-testid="app-visibility-now"]')?.innerText ?? ""), null, { timeout: 8000 });
  const now = () => page.getByTestId("app-visibility-now");
  ok(/Private/.test(norm(await now().innerText())) && /not in the list of apps/.test(norm(await now().innerText())), "the Admin tab says Private: not in the list of apps on the website");
  ok((await page.getByTestId("app-visibility-toggle").innerText()).trim() === "Make public", "…with a 'Make public' button");
  ok(/\/apps\/admin$/.test((await page.getByTestId("app-visibility-link").innerText()).trim()) && (await page.getByTestId("app-visibility-copy").count()) === 1, "…and the link to share with the team, with a Copy button");
  ok((await page.getByTestId("app-refresh").count()) === 0, "the Refresh interval card is not shown for the Admin app (it does not use that setting)");
  ok(/Upload|New version/.test(await page.locator("body").innerText()), "the upload of a new version is there as for the other apps");

  say("3. Make public, then private again");
  await page.getByTestId("app-visibility-toggle").click();
  await page.waitForFunction(() => /Public/.test(document.querySelector('[data-testid="app-visibility-now"]')?.innerText ?? "") && document.querySelector('[data-testid="app-visibility-toggle"]')?.innerText.trim() === "Make private", null, { timeout: 8000 });
  ok(/Public/.test(norm(await now().innerText())) && (await page.getByTestId("app-visibility-link").count()) === 0, "pressing Make public (and agreeing to the question) turns it Public; the link box goes");
  ok((await listed()).includes("admin"), "the server's public list now has the Admin app");
  ok((await (await fetch(`${API}/api/app-updates/releases?app=admin`)).json()).app.listed === true, "…and its page data says listed");
  await page.reload({ waitUntil: "load" });
  await page.getByTestId("app-tab-admin").click();
  await page.waitForFunction(() => /Public/.test(document.querySelector('[data-testid="app-visibility-now"]')?.innerText ?? ""), null, { timeout: 8000 });
  ok(true, "after a reload it is still Public (the choice was saved)");
  ok((await listed()).includes("oma") && (await listed()).includes("kda") && (await listed()).includes("rda"), "the staff apps are still in the list");
  await page.getByTestId("app-visibility-toggle").click();
  await page.waitForFunction(() => /Private/.test(document.querySelector('[data-testid="app-visibility-now"]')?.innerText ?? ""), null, { timeout: 8000 });
  ok(!(await listed()).includes("admin"), "Make private takes it out of the public list again");

  say("4. A staff app can be made private too (and back)");
  const off = await call("PUT", "/api/platform/app-releases/visibility/rda", { public: false });
  ok(off.status === 200 && off.json.setting.public === false && !(await listed()).includes("rda") && (await listed()).includes("oma"), "any app can be made private: RDA leaves the list, the others stay");
  await call("PUT", "/api/platform/app-releases/visibility/rda", { public: true });
  ok((await listed()).includes("rda"), "…and public again");
  ok((await call("PUT", "/api/platform/app-releases/visibility/nope", { public: true })).status === 404 && (await call("PUT", "/api/platform/app-releases/visibility/oma", { public: "yes" })).status === 400, "an app that doesn't exist is a 404; something that is not true / false is a 400");
  const anon = await fetch(`${API}/api/platform/app-releases/visibility/oma`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ public: false }) });
  ok(anon.status === 401 && (await listed()).includes("oma"), "someone not signed in can't change it (401)");
  const refresh = await call("PUT", "/api/platform/app-releases/settings/oma", { refreshSeconds: 8 });
  ok(refresh.status === 200 && (await call("GET", "/api/platform/app-releases/settings")).json.settings.find((x) => x.app === "oma").public === true, "saving the refresh interval does not change who is public");

  say("5. The website: the list leaves it out, its own page still opens");
  execFileSync(process.execPath, [BENCH, "website"], { stdio: "inherit" });
  const index = await (await fetch(`${WEB}/apps`)).text();
  ok(/Rasoi Pulse OMA/.test(index) && /Rasoi Pulse KDA/.test(index) && /Rasoi Pulse RDA/.test(index), "the website's /apps page lists the three staff apps");
  ok(!/Rasoi Pulse Admin/.test(index) && !/Rasoi Pulse Business/.test(index) && !/href="\/apps\/admin"/.test(index), "…and does NOT list the Admin or Business app");
  const adminPage = await fetch(`${WEB}/apps/admin`);
  const html = await adminPage.text();
  ok(adminPage.status === 200 && /Rasoi Pulse/.test(html) && /ADM/.test(html) && /noindex/.test(html), "the Admin app's own page opens by its link (200), and tells search engines to skip it");
  ok(/For the Rasoi Pulse team/.test(html), "it says who the app is for");
  const home = await (await fetch(`${WEB}/`)).text();
  ok(!/\/apps\/admin/.test(home) && !/\/apps\/business/.test(home), "the home page does not mention the private apps either");

  ok(problems.length === 0, "no errors in the browser console", problems.slice(0, 3).join(" | "));
} finally {
  for (const [app, was] of Object.entries(wasPublic)) await call("PUT", `/api/platform/app-releases/visibility/${app}`, { public: was }).catch(() => {});
  await browser.close();
}
console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
