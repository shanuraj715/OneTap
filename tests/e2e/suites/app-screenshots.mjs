// The tablet screenshots on the three apps' website pages (/apps/oma, /apps/kda, /apps/rda): the pictures and their list are well formed, the
// tooling that takes them can't touch anything real, and the gallery on each page works (tabs by mouse and keyboard, no script needed, phone
// width, dark mode, reduced motion). Driven in Chrome against the bench (API :3097, website :3173, which `bench website` builds from the current
// code). The pictures themselves are taken by mobile-apps/screenshots/capture.mjs; this suite checks what it left behind.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const REPO = fileURLToPath(new URL("../../..", import.meta.url)).replace(/\/$/, "");
const BENCH = path.join(REPO, "tests/e2e/bench/bench.mjs");
const SHOTS_DIR = path.join(REPO, "mobile-apps/screenshots");
const PUBLIC = path.join(REPO, "apps/website/public/app-screens");
const WEB = "http://localhost:3173";
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const say = (s) => console.log(`\n=== ${s}`);
const problems = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const APPS = { oma: "OMA", kda: "KDA", rda: "RDA" };
const sharp = createRequire(path.join(REPO, "apps/api/package.json"))("sharp");

/* ---------------------------------------------------------------- 1. the list and the pictures */
say("1. The list of screenshots and the pictures");
const manifest = JSON.parse(fs.readFileSync(path.join(REPO, "apps/website/src/lib/app-shots.json"), "utf8"));
ok(Object.keys(manifest).sort().join() === "kda,oma,rda", "there are screenshots for all three apps", Object.keys(manifest).join(","));
const files = new Set(fs.readdirSync(PUBLIC));
for (const app of Object.keys(APPS)) {
  const list = manifest[app] ?? [];
  ok(list.length >= 3, `${APPS[app]}: at least three screenshots`, `${list.length}`);
  ok(new Set(list.map((s) => s.name)).size === list.length, `${APPS[app]}: each has its own name`);
  for (const s of list) {
    const f = path.join(PUBLIC, s.file);
    const exists = files.has(s.file);
    ok(exists, `${s.file} is in public/app-screens`);
    if (!exists) continue;
    const bytes = fs.readFileSync(f);
    const meta = await sharp(bytes).metadata();
    ok(bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP", `${s.file} is a real WebP file`);
    ok(meta.width === s.width && meta.height === s.height, `${s.file}: the list says ${s.width}×${s.height} and the picture is ${meta.width}×${meta.height}`);
    ok(meta.width >= 1400 && Math.abs(meta.width / meta.height - 1.6) < 0.05, `${s.file}: a wide tablet picture (at least 1,400 px, 16:10)`, `${meta.width}×${meta.height} = ${(meta.width / meta.height).toFixed(2)}`);
    ok(bytes.length < 400 * 1024, `${s.file}: small enough for a web page (under 400 KB)`, `${(bytes.length / 1024).toFixed(0)} KB`);
    // a picture that is blank or nearly one flat colour means a screen that never drew
    const { channels } = await sharp(bytes).stats();
    ok(channels.some((c) => c.stdev > 20), `${s.file}: has real content on it (not a blank screen)`, `${channels.map((c) => c.stdev.toFixed(0)).join("/")}`);
    ok(s.title?.length >= 3 && s.caption?.length >= 30 && s.alt?.length >= 30, `${s.file}: has a title, a caption and a description for screen readers`);
  }
}
const listed = new Set(Object.values(manifest).flat().map((s) => s.file));
ok([...files].every((f) => listed.has(f)), "no picture sits in the folder without being listed (so nothing old is left behind)", [...files].filter((f) => !listed.has(f)).join(", "));

/* ---------------------------------------------------------------- 2. the tooling can't touch anything real */
say("2. The tooling that takes them");
const read = (f) => fs.readFileSync(path.join(SHOTS_DIR, f), "utf8");
for (const f of ["adb.mjs", "build.mjs", "capture.mjs", "scenarios.mjs", "serve.mjs"]) {
  let good = true;
  try { execFileSync(process.execPath, ["--check", path.join(SHOTS_DIR, f)], { stdio: "pipe" }); } catch { good = false; }
  ok(good, `${f} is valid JavaScript`);
}
const build = read("build.mjs"), serve = read("serve.mjs"), capture = read("capture.mjs");
ok(!/copyFileSync\([^)]*build-output/.test(build) && /\.build/.test(build) && !/join\(root, "build-output"/.test(build), "builds go to screenshots/.build, never into an app's build-output folder (where real releases are)");
ok(/KEYSTORE_PROPERTIES\$\/\.test\(k\)\) delete env\[k\]/.test(build), "no signing key is handed to these builds, whatever the shell has set (they use Android's shared debug key)");
ok(/EXPO_PUBLIC_API_URL: API_URL/.test(build) && /http:\/\/localhost:\$\{SHOTS_PORT\}/.test(serve), "the builds are pointed at the throwaway server on localhost, not the live one");
ok(!/rasoipulse\.in\/?["'`]/.test(build + capture) || /WEBSITE_URL: "https:\/\/rasoipulse\.in"/.test(serve) && !/api\.rasoipulse\.in/.test(build + capture + serve), "nothing in the tooling points at the live API");
ok(/listen\(SHOTS_PORT, "127\.0\.0\.1"\)/.test(serve), "the throwaway server listens on this machine only (127.0.0.1)");
ok(/MongoMemoryServer/.test(serve) && /process\.chdir\(run\)/.test(serve) && !/MONGODB_URI: process\.env/.test(serve), "its database is in memory, and it never reads a .env (so the real database address is never seen)");
ok(/adb reverse|"reverse"/.test(capture) && /"--remove"/.test(capture), "the phone reaches the server through adb reverse, which is removed again afterwards");
ok(/wm size reset/.test(capture) && /wm density reset/.test(capture) && /command exit/.test(capture), "the emulator's screen size and clean status bar are put back when it is done");
const gi = read(".gitignore");
ok(/^\.build\/$/m.test(gi) && /^raw\/$/m.test(gi), "the debug-signed builds and the huge raw pictures are never committed (.gitignore)");
const { SHOTS } = await import(path.join(SHOTS_DIR, "scenarios.mjs") + `?t=${Date.now()}`);
for (const app of Object.keys(APPS)) {
  // the scenarios are listed in the order they are TAKEN; the website shows them by `rank` (default: the order listed)
  const names = (SHOTS[app] ?? []).map((s, i) => ({ name: s.name, rank: s.rank ?? i })).sort((x, y) => x.rank - y.rank).map((s) => s.name);
  ok(names.length >= 3 && JSON.stringify(names) === JSON.stringify((manifest[app] ?? []).map((s) => s.name)), `${APPS[app]}: the scenarios and the list agree on which screens, in which order`, names.join(","));
}
const fictional = ["Saffron Table"];
ok(fictional.every((n) => serve.includes(n)) && !/Gazab|rasoipulse\.in\/noida|rp-demo/.test(serve), "the restaurant in the pictures is fictional (Saffron Table), not a real customer");
ok(!/(\+?91)?[6-9]\d{9}/.test(serve.replace(/9876543210|98765 43210|9811122233|98111 22233|98\d{8,}/g, "")), "only made-up phone numbers are used");

/* ---------------------------------------------------------------- 3. the pages */
say("3. The gallery on each app's page");
execFileSync(process.execPath, [BENCH, "website"], { stdio: "inherit" });
let browser;
try {
  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 1000 } });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|favicon|status of 4\d\d|status of 5\d\d/.test(m.text())) problems.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
  const failedImages = [];
  page.on("response", (r) => { if (/\/app-screens\//.test(r.url()) && r.status() >= 400) failedImages.push(`${r.status()} ${r.url()}`); });

  for (const [app, code] of Object.entries(APPS)) {
    const list = manifest[app];
    await page.goto(`${WEB}/apps/${app}`, { waitUntil: "load" });
    const sec = page.locator("#screens");
    ok((await sec.count()) === 1, `/apps/${app}: has the 'See it' section`);
    ok(new RegExp(`^${code} on a tablet$`).test((await sec.locator("h2").innerText()).trim()), `/apps/${app}: it is headed '${code} on a tablet'`);
    const after = await page.evaluate(() => { const s = document.querySelector("#screens"), hero = document.querySelector(".apps-hero"), inst = document.querySelector("#install"); return { afterHero: !!(hero.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING), beforeInstall: !!(s.compareDocumentPosition(inst) & Node.DOCUMENT_POSITION_FOLLOWING) }; });
    ok(after.afterHero && after.beforeInstall, `/apps/${app}: it sits between the top of the page and the install steps`);
    const tabs = sec.locator(".shots-tab");
    ok((await tabs.count()) === list.length && JSON.stringify(await tabs.allInnerTexts()) === JSON.stringify(list.map((s) => s.title)), `/apps/${app}: one tab per screenshot, named as listed`, (await tabs.allInnerTexts()).join(" | "));
    const visible = async () => page.evaluate(() => [...document.querySelectorAll("#screens .shots-panel")].map((p) => getComputedStyle(p).display !== "none"));
    const vis0 = await visible();
    ok(vis0[0] && vis0.filter(Boolean).length === 1, `/apps/${app}: the first picture is showing, and only that one`, JSON.stringify(vis0));
    const img0 = sec.locator(".shots-panel").first().locator("img");
    await img0.evaluate((i) => i.decode().catch(() => undefined));
    ok(await img0.evaluate((i) => i.complete && i.naturalWidth > 1000), `/apps/${app}: the first picture loaded at full size`);
    ok((await img0.getAttribute("alt"))?.length >= 30 && (await img0.getAttribute("width")) && (await img0.getAttribute("height")), `/apps/${app}: the picture has a description and its size (so the page doesn't jump)`);
    ok((await sec.locator(".tablet").first().evaluate((e) => parseFloat(getComputedStyle(e).borderTopLeftRadius) >= 18)), `/apps/${app}: the picture sits in a rounded tablet frame`);
    // the Android tablet frame: rim, even bezel, camera, side buttons, glass
    const fr = await sec.locator(".tablet").first().evaluate((e) => {
      const r = e.getBoundingClientRect(), cs = getComputedStyle(e), scr = e.querySelector(".tablet-screen"), sc = getComputedStyle(scr);
      const cam = e.querySelector(".tablet-cam").getBoundingClientRect(), sheen = getComputedStyle(scr, "::after");
      const btns = [...e.querySelectorAll(".tablet-btn")].map((b) => { const q = b.getBoundingClientRect(); return { above: q.top < r.top - 0.5, touches: Math.abs(q.bottom - r.top) <= 1.5, inside: q.left > r.left && q.right < r.right }; });
      const sr = scr.getBoundingClientRect();
      return {
        pad: parseFloat(cs.paddingTop), padSides: [cs.paddingLeft, cs.paddingRight, cs.paddingBottom].map(parseFloat), radius: parseFloat(cs.borderTopLeftRadius), screenRadius: parseFloat(sc.borderTopLeftRadius), imgInside: !!scr.querySelector("img"),
        camX: Math.abs(cam.left + cam.width / 2 - (r.left + r.width / 2)), camY: cam.top + cam.height / 2 - r.top, camW: cam.width, btns, sheenEvents: sheen.pointerEvents, sheenGradient: /linear-gradient/.test(sheen.backgroundImage),
        shadows: cs.boxShadow.split(/\),\s*(?=(?:rgb|inset|\d))/).length, bodyGradient: /linear-gradient/.test(cs.backgroundImage), screenInset: Math.round(sr.left - r.left), w: r.width, h: r.height,
      };
    });
    ok(fr.pad >= 9 && fr.pad <= 22.5 && fr.padSides.every((p) => Math.abs(p - fr.pad) < 0.5), `/apps/${app}: the bezel is an even ${fr.pad.toFixed(0)} px all round`, JSON.stringify(fr.padSides));
    ok(Math.abs(fr.radius - fr.pad * 1.9) < 1.5 && Math.abs(fr.screenRadius - fr.pad * 0.8) < 1.5 && fr.screenRadius < fr.radius, `/apps/${app}: the body and the glass have rounded corners, the glass less than the body`, `${fr.radius.toFixed(0)} / ${fr.screenRadius.toFixed(0)}`);
    ok(fr.imgInside && Math.round(fr.screenInset) === Math.round(fr.pad), `/apps/${app}: the picture sits inside the glass, one bezel in from the edge`, `${fr.screenInset} vs ${fr.pad}`);
    ok(fr.camX < 1.5 && fr.camY > 0 && fr.camY < fr.pad && fr.camW >= 3, `/apps/${app}: a front camera in the middle of the top bezel`, `x off ${fr.camX.toFixed(1)}, y ${fr.camY.toFixed(1)}, ${fr.camW.toFixed(1)} px`);
    ok(fr.btns.length === 2 && fr.btns.every((b) => b.above && b.touches && b.inside), `/apps/${app}: power and volume buttons stand on the top edge`, JSON.stringify(fr.btns));
    ok(fr.sheenEvents === "none" && fr.sheenGradient, `/apps/${app}: the glass has a faint sheen that never blocks a tap or click`);
    ok(fr.shadows >= 5 && fr.bodyGradient, `/apps/${app}: the body is a metal-rimmed gradient with a soft shadow`, `${fr.shadows} shadow layers`);
    // real pixels: the bezel is dark
    const shot = await sec.locator(".tablet").first().screenshot();
    const strip = await sharp(shot).extract({ left: 4, top: Math.round(fr.h * 0.3), width: Math.max(2, Math.round(fr.pad) - 8), height: Math.round(fr.h * 0.3) }).stats();
    ok(strip.channels.every((c) => c.mean < 60), `/apps/${app}: the bezel really is dark on the page`, strip.channels.map((c) => c.mean.toFixed(0)).join("/"));
    const cap0 = await sec.locator(".shots-panel").first().locator("figcaption").innerText();
    ok(cap0.includes(list[0].title) && cap0.includes(list[0].caption.slice(0, 30)), `/apps/${app}: the caption under it is the first screenshot's`);

    // mouse: choose the second tab
    await tabs.nth(1).click();
    const vis1 = await visible();
    ok(vis1[1] && vis1.filter(Boolean).length === 1, `/apps/${app}: clicking the second tab shows the second picture only`, JSON.stringify(vis1));
    const active = await tabs.evaluate((els) => els.map((e) => getComputedStyle(e).backgroundColor));
    const brand = await page.evaluate(() => getComputedStyle(document.querySelector(".app-themed")).getPropertyValue("--brand").trim());
    ok(active[1] !== active[0] && active[2] !== active[1], `/apps/${app}: the chosen tab is lit and the others are not`, active.join(" · "));
    // the lit tab wears the app's own colour
    const probe = await page.evaluate((b) => { const d = document.createElement("i"); d.style.color = b; document.body.append(d); const c = getComputedStyle(d).color; d.remove(); return c; }, brand);
    ok(active[1] === probe, `/apps/${app}: …in the app's own colour`, `${active[1]} vs ${probe}`);
    await sec.locator(".shots-panel").nth(1).locator("img").evaluate((i) => i.decode().catch(() => undefined));
    ok(await sec.locator(".shots-panel").nth(1).locator("img").evaluate((i) => i.complete && i.naturalWidth > 1000), `/apps/${app}: the second picture loaded too`);

    // keyboard: the arrow key moves to the next tab
    await sec.locator(".shots-radio").nth(1).focus();
    await page.keyboard.press("ArrowRight");
    const vis2 = await visible();
    ok(vis2[2] && vis2.filter(Boolean).length === 1, `/apps/${app}: the arrow key moves to the next picture`, JSON.stringify(vis2));
    await page.keyboard.press("ArrowLeft");
    ok((await visible())[1], `/apps/${app}: …and back`);
    const focusRing = await sec.locator(".shots-tab").nth(1).evaluate((e) => getComputedStyle(e).outlineStyle);
    ok(focusRing !== "none", `/apps/${app}: the tab you are on with the keyboard shows a focus ring`, focusRing);
    await tabs.first().click();
  }

  say("4. Works without script, on a phone, in the dark, and with reduced motion");
  const noJs = await browser.newContext({ viewport: { width: 1360, height: 1000 }, javaScriptEnabled: false });
  const njp = await noJs.newPage();
  await njp.goto(`${WEB}/apps/oma`, { waitUntil: "load" });
  await njp.locator(".shots-tab").nth(2).click();
  const njVisible = await njp.evaluate(() => [...document.querySelectorAll("#screens .shots-panel")].map((p) => getComputedStyle(p).display !== "none"));
  ok(njVisible[2] && njVisible.filter(Boolean).length === 1, "with JavaScript switched off the tabs still switch the picture", JSON.stringify(njVisible));
  await noJs.close();

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pp = await phone.newPage();
  for (const app of Object.keys(APPS)) {
    await pp.goto(`${WEB}/apps/${app}`, { waitUntil: "load" });
    await pp.locator("#screens").scrollIntoViewIfNeeded();
    const m = await pp.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth, frame: Math.round(document.querySelector("#screens .shots-panel:not([style*='none']) .tablet, #screens .tablet").getBoundingClientRect().width), tabsRight: Math.max(...[...document.querySelectorAll("#screens .shots-tab")].map((t) => Math.round(t.getBoundingClientRect().right))) }));
    ok(m.over <= 0 && m.frame <= 390 - 20 && m.tabsRight <= 390, `${app} at 390 px: nothing sticks out sideways, the picture fits (${m.frame}px), the tabs fit`, JSON.stringify(m));
  }
  await phone.close();

  const dark = await browser.newContext({ viewport: { width: 1360, height: 1000 }, colorScheme: "dark" });
  const dp = await dark.newPage();
  await dp.goto(`${WEB}/apps/kda`, { waitUntil: "load" });
  const dc = await dp.evaluate(() => { const t = document.querySelector("#screens .shots-tab:not(:nth-child(1))"); const h = document.querySelector("#screens h2"); return { tab: getComputedStyle(t).color, tabBg: getComputedStyle(t).backgroundColor, h2: getComputedStyle(h).color, bg: getComputedStyle(document.body).backgroundColor }; });
  const lum = (c) => { const [r, g, b] = c.match(/\d+/g).map(Number); return (0.299 * r + 0.587 * g + 0.114 * b); };
  ok(lum(dc.h2) > 150 && lum(dc.bg) < 60 && lum(dc.tab) > 100, "in dark mode the heading and the tab labels are light on the dark page", JSON.stringify(dc));
  const darkShot = await dp.locator("#screens .tablet").first().screenshot();
  const dBezel = await sharp(darkShot).extract({ left: 4, top: 120, width: 8, height: 120 }).stats();
  ok(dBezel.channels.every((c) => c.mean < 70), "in dark mode the tablet's bezel is still a dark frame, visible against the dark page", dBezel.channels.map((c) => c.mean.toFixed(0)).join("/"));
  await dark.close();

  const calm = await browser.newContext({ viewport: { width: 1360, height: 1000 }, reducedMotion: "reduce" });
  const cp = await calm.newPage();
  await cp.goto(`${WEB}/apps/rda`, { waitUntil: "load" });
  ok(await cp.evaluate(() => getComputedStyle(document.querySelector("#screens .shots-panel")).animationName === "none"), "with reduced motion the picture does not slide in");
  await calm.close();

  ok(failedImages.length === 0, "every picture on the pages was served (no 404)", failedImages.slice(0, 3).join(" | "));
  await page.goto(`${WEB}/apps`, { waitUntil: "load" });
  ok((await page.locator(".apps-card").count()) === 3 && (await page.locator("#screens").count()) === 0, "the apps index still shows its three cards, without a gallery");
} finally {
  await browser?.close();
}
ok(problems.length === 0, "no errors in the browser", problems.slice(0, 3).join(" | "));
console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
