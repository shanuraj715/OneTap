// Every product has its own icon: the website (navy), the admin panel (red), the storefront (the SHOP OWNER's own favicon; the Rasoi Pulse one
// until they upload theirs). Chrome against the bench (API :3097, admin :3171, storefront :3170, marketing website :3173 — started if needed).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
const REPO = fileURLToPath(new URL("../../..", import.meta.url)).replace(/\/$/, "");
const BENCH = `${REPO}/tests/e2e/bench/bench.mjs`;
const API = "http://localhost:3097", ADMIN = "http://localhost:3171", SHOP = "http://localhost:3170", SITE = "http://localhost:3173";
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const say = (s) => console.log(`\n=== ${s}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 30000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await fn()) return true; } catch { /* retry */ } await sleep(700); } return false; };
const problems = [];
execFileSync(process.execPath, [BENCH, "website"], { stdio: "inherit" });

const get = async (url) => { const r = await fetch(url); return { status: r.status, type: r.headers.get("content-type") ?? "", body: Buffer.from(await r.arrayBuffer()) }; };
const file = (p) => readFileSync(`${REPO}/${p}`);
const svgOk = (r) => r.status === 200 && /svg/.test(r.type) && r.body.toString().includes("<svg");
const icoOk = (r) => r.status === 200 && r.body.subarray(0, 4).equals(Buffer.from([0, 0, 1, 0]));
const pngOk = (r) => r.status === 200 && r.body.subarray(1, 4).toString() === "PNG";

const login = async (email, password) => (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const owner = await login("o@acme.test", "Owner123!");
const outlets = (await (await fetch(`${API}/api/outlets`, { headers: { cookie: owner } })).json()).outlets;
const main = outlets.find((o) => o.slug === "main"); const outletId = String(main._id ?? main.id);
const setIcon = (url) => fetch(`${API}/api/outlets/${outletId}/config`, { method: "PATCH", headers: { "content-type": "application/json", cookie: owner, "x-rasoipulse-outlet": outletId }, body: JSON.stringify({ branding: { faviconUrl: url } }) }).then((r) => r.status);

let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  page.on("pageerror", (e) => problems.push(String(e).slice(0, 200)));
  const icons = () => page.evaluate(() => [...document.querySelectorAll('link[rel~="icon"]')].map((l) => l.getAttribute("href")));

  say("1. The website (navy)");
  const siteSvg = await get(`${SITE}/icon.svg`);
  ok(svgOk(siteSvg) && siteSvg.body.equals(file("apps/website/src/app/icon.svg")), "/icon.svg is the Rasoi Pulse favicon");
  ok(icoOk(await get(`${SITE}/favicon.ico`)), "/favicon.ico is a real .ico");
  ok(pngOk(await get(`${SITE}/apple-icon.png`)), "/apple-icon.png (the touch icon) is a PNG");
  await page.goto(SITE + "/", { waitUntil: "load" });
  ok((await icons()).some((h) => /icon\.svg/.test(h)) && (await page.locator('link[rel="apple-touch-icon"]').count()) >= 1, "the page links the icon and the touch icon", (await icons()).join(" "));
  ok(svgOk(await get(`${SITE}/rasoi-pulse-logo.svg`)), "the logo file used in the header is served");
  const mark = await page.locator(".site-header .brand-mark").first().evaluate((e) => ({ bg: getComputedStyle(e).backgroundImage, w: e.getBoundingClientRect().width }));
  ok(/rasoi-pulse-logo\.svg/.test(mark.bg) && mark.w >= 28, "the header shows the new logo (not the old drawn squares)", `${mark.w}px`);

  say("2. The admin panel (red — different from the website)");
  const adminSvg = await get(`${ADMIN}/favicon.svg`);
  ok(svgOk(adminSvg) && adminSvg.body.equals(file("apps/admin/public/favicon.svg")), "/favicon.svg is served");
  ok(!adminSvg.body.equals(siteSvg.body), "…and it is a DIFFERENT icon from the website's");
  ok(adminSvg.body.toString().includes("#be112d") && !adminSvg.body.toString().includes("#10111b\"/>"), "the admin tile is red");
  ok(icoOk(await get(`${ADMIN}/favicon.ico`)) && pngOk(await get(`${ADMIN}/apple-touch-icon.png`)), "its .ico and touch icon are served");
  await page.goto(ADMIN + "/", { waitUntil: "load" });
  ok((await icons()).includes("/favicon.ico") && (await icons()).includes("/favicon.svg") && (await page.locator('link[rel="apple-touch-icon"]').count()) === 1, "the page links all three", (await icons()).join(" "));
  const logo = page.locator('img[src="/favicon.svg"]').first();
  await logo.waitFor({ timeout: 15000 }).catch(() => undefined);
  ok(await logo.isVisible(), "the sign-in page shows the icon beside the name");

  say("3. The storefront: the shop owner's icon");
  ok((await setIcon("")) === 200, "start with no icon uploaded");
  await page.goto(SHOP + "/main", { waitUntil: "load" });
  ok((await until(async () => (await icons()).length === 1 && (await icons())[0] === "/rasoi-pulse-favicon.svg", 15000)), "a store with no icon of its own shows the Rasoi Pulse one — exactly one icon link", (await icons()).join(" "));
  ok(svgOk(await get(`${SHOP}/rasoi-pulse-favicon.svg`)), "…and that file is served by the storefront");
  const MINE = "https://cdn.example.test/my-shop-icon.png";
  ok((await setIcon(MINE)) === 200, "the owner uploads their own icon");
  const seen = await until(async () => { await page.goto(SHOP + "/main", { waitUntil: "load" }); const l = await icons(); return l.length === 1 && l[0] === MINE; }, 45000);
  ok(seen, "the storefront tab now shows the OWNER's icon, and only that one (the Rasoi Pulse icon is gone)", (await icons()).join(" "));
  ok((await setIcon("")) === 200, "(the icon is removed again)");
  await page.goto(SHOP + "/", { waitUntil: "load" });
  ok((await icons()).every((h) => /rasoi-pulse-favicon\.svg/.test(h)) || (await icons()).length === 0, "the outlet-picker page never shows a stray icon", (await icons()).join(" "));
} finally {
  await setIcon("").catch(() => undefined);
  await browser?.close();
}
ok(problems.length === 0, "no errors in the browser", problems.slice(0, 3).join(" | "));
console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
