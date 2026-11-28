// The "See it" gallery on an app's page: a device frame (tablet held sideways, tablet held upright, phone), light / dark / Auto, a list of screens. In Chrome
// against the bench API (:3097) and website (:3173). It adds a throwaway app ("tour") in the console with five screenshots whose pictures it draws itself — a
// pale picture for light and a dark one for dark, so what the visitor sees can be read from the pixels — and removes it at the end.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const REPO = fileURLToPath(new URL("../../..", import.meta.url)).replace(/\/$/, "");
const BENCH = `${REPO}/tests/e2e/bench/bench.mjs`;
const API = "http://localhost:3097";
const WEB = "http://localhost:3173";
const sharp = createRequire(`${REPO}/apps/api/package.json`)("sharp");
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const say = (s) => console.log(`\n=== ${s}`);
const problems = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 10000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await fn()) return true; } catch { /* retry */ } await sleep(150); } return false; };
const rebuild = () => execFileSync(process.execPath, [BENCH, "website"], { stdio: "inherit" });

const su = (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "super@sandbox.test", password: "Super123!" }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const call = async (method, path, body) => { const r = await fetch(API + path, { method, headers: { cookie: su, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }); return { status: r.status, json: await r.json().catch(() => ({})) }; };
const A = "/api/platform/app-releases";
let ipn = 0; // (each upload comes from its own made-up address, so the API's upload limit — per address — does not slow a run of this test)
const upload = async (id, device, theme, buf) => (await fetch(`${API}${A}/screenshots/item/${id}/image?device=${device}&theme=${theme}`, { method: "PUT", headers: { cookie: su, "content-type": "image/png", "x-forwarded-for": `198.51.100.${(ipn = (ipn % 250) + 1)}` }, body: buf })).status;

/** a picture of the device's shape: pale for light, dark for dark, with what it is written on it */
const SIZES = { "tablet-landscape": [800, 500], "tablet-portrait": [500, 800], phone: [360, 780] };
const draw = (n, device, theme) => {
  const [w, h] = SIZES[device];
  const bg = theme === "dark" ? "#14131c" : "#f4f5fb";
  const fg = theme === "dark" ? "#e8e8f4" : "#1a1c2b";
  return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${bg}"/><text x="${w / 2}" y="${h / 2}" font-size="${Math.round(w / 9)}" font-family="Arial" text-anchor="middle" fill="${fg}">${n} ${theme}</text></svg>`)).png().toBuffer();
};

const DEVICES = ["tablet-landscape", "tablet-portrait", "phone"];
await call("DELETE", `${A}/apps/tour`).catch(() => undefined);
const browser = await chromium.launch();
try {
  const made = await call("POST", `${A}/apps`, { name: "Rasoi Pulse Tour", slug: "tour", code: "TUR", tagline: "A test app", audience: "For the test", description: "Used by the gallery test." });
  ok(made.status === 201, "(a test app is added in the console)");
  const spec = [
    ["Tables at a glance", "See every table.", "The tables grouped by area.", DEVICES, ["light", "dark"], true],
    ["Orders in one list", "Follow each order.", "The orders list.", DEVICES, ["light", "dark"], true],
    ["Menu with dish photos", "Pick dishes.", "The menu with photos.", ["tablet-landscape", "phone"], null, true], // the phone has a light picture only; no tall-tablet picture at all
    ["Hidden one", "Not shown.", "A hidden screen.", DEVICES, ["light", "dark"], false],
    ["Empty one", "No picture.", "No picture yet.", [], [], true],
  ];
  const ids = [];
  for (const [i, [title, caption, alt, devs, themes, enabled]] of spec.entries()) {
    const s = (await call("POST", `${A}/screenshots/tour`, { title, caption, alt })).json.shot;
    ids.push(s.id);
    for (const d of devs) for (const t of themes ?? (d === "phone" ? ["light"] : ["light", "dark"])) ok((await upload(s.id, d, t, await draw(i + 1, d, t))) === 200, `(picture ${i + 1} ${d} ${t} stored)`);
    if (!enabled) await call("PATCH", `${A}/screenshots/item/${s.id}`, { enabled: false });
  }
  await call("PUT", `${A}/screenshots/tour/section`, { defaultDevice: "tablet-landscape" });
  rebuild();

  const open = async (page, url = "/apps/tour") => { await page.goto(WEB + url, { waitUntil: "load" }); await page.getByTestId("shots-ui").waitFor({ timeout: 15000 }); await page.waitForTimeout(500); };
  /** the average colour of the middle of the device's screen (below the camera, away from any text) */
  const tone = async (page) => {
    await page.waitForTimeout(700); // the cross-fade
    const r = await page.locator(".dev-screen").boundingBox();
    const png = await page.screenshot({ clip: { x: r.x + r.width * 0.08, y: r.y + r.height * 0.78, width: r.width * 0.2, height: 6 } });
    return page.evaluate(async (b64) => {
      const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
      const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
      const x = c.getContext("2d"); x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, img.width, img.height).data; let s = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) { s += d[i] + d[i + 1] + d[i + 2]; n += 3; }
      return Math.round(s / n);
    }, png.toString("base64"));
  };
  // (a screen that drew nothing is black: that is "blank", not "dark")
  const look = async (page) => { const t = await tone(page); return t > 150 ? "light" : t >= 8 && t <= 90 ? "dark" : `blank(${t})`; };

  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, colorScheme: "light" });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) problems.push(m.text().slice(0, 200)); });
  const imageRequests = [];
  page.on("request", (r) => { if (/\/uploads\//.test(r.url())) imageRequests.push(r.url()); });
  await open(page);

  say("1. The section");
  ok(/TUR on every\s+screen/.test(await page.locator("#screens h2").innerText()) && (await page.locator("#screens h2 em").innerText()) === "screen", "the heading is 'TUR on every screen', its last word in the app's colour");
  ok(/light and dark/.test(await page.locator("#screens .section-head p").innerText()), "…with the usual line under it");
  const devs = await page.locator('[data-testid^="device-"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-testid").replace("device-", "")).filter((x) => x !== "switch"));
  ok(devs.join() === DEVICES.join(), "the device switch offers the three devices (each has a picture somewhere)", devs.join());
  ok((await page.getByTestId("look-switch").locator("button").allInnerTexts()).map((t) => t.trim()).join() === "Auto,Light,Dark", "the look switch has Auto, Light and Dark");
  ok((await page.getByTestId("look-auto").getAttribute("aria-checked")) === "true" && (await page.getByTestId("device-tablet-landscape").getAttribute("aria-checked")) === "true", "it opens on the wide tablet, on Auto");
  const tabs = await page.locator('[role="tab"]').allInnerTexts();
  ok(tabs.length === 3 && /Tables at a glance/.test(tabs[0]) && /Orders in one list/.test(tabs[1]) && /Menu with dish photos/.test(tabs[2]), "the list has the three screens that are shown, in order (not the hidden one, not the one with no picture)", tabs.map((t) => t.split("\n")[0]).join(" | "));
  ok((await page.getByTestId("shot-count").innerText()).replace(/\s+/g, "") === "1/3", "the counter reads 1 / 3");
  ok(/See every table/.test(await page.locator('[role="tab"][aria-selected="true"]').innerText()), "the chosen screen shows its caption");
  const alt = await page.locator('[data-testid="layer-on"] img').evaluateAll((els) => els.map((e) => e.alt));
  ok(alt.length === 2 && alt.every((a) => /^TUR on a tablet held sideways, (light|dark) mode: The tables grouped by area\.$/.test(a)), "each picture has a description that says the app, the device, the look and what is on the screen", alt.join(" | "));

  say("2. The frame");
  const frame = (dev) => page.evaluate(() => {
    const w = document.querySelector('[data-testid="device"]'); const s = document.querySelector(".dev-screen").getBoundingClientRect(); const b = document.querySelector(".dev").getBoundingClientRect();
    const cam = document.querySelector(".dev-cam")?.getBoundingClientRect();
    return { cls: w.className, ratio: s.width / s.height, w: Math.round(b.width), h: Math.round(b.height), pw: Math.round(w.parentElement.getBoundingClientRect().width), camIn: cam ? cam.top >= s.top && cam.bottom <= s.bottom : null, camClass: document.querySelector(".dev-cam")?.className ?? "", keys: document.querySelectorAll(".dev-key").length, bezel: Math.round(s.left - b.left) };
  });
  let f = await frame();
  ok(Math.abs(f.ratio - 1.6) < 0.02 && f.cls.includes("tablet-landscape"), "the wide tablet's screen is 16:10", f.ratio.toFixed(3));
  ok(f.camIn === false && /bezel/.test(f.camClass) && f.keys === 2 && f.bezel >= 8, "…with the camera in the bezel, two keys on the edge and an even bezel", `${JSON.stringify({ camIn: f.camIn, keys: f.keys, bezel: f.bezel })}`);
  await page.getByTestId("device-tablet-portrait").click();
  await page.waitForTimeout(800);
  f = await frame();
  ok(Math.abs(f.ratio - 0.625) < 0.02 && f.cls.includes("tablet-portrait") && f.h > f.w, "the tall tablet's screen is 5:8, and the device stands upright", f.ratio.toFixed(3));
  ok((await page.getByTestId("shot-count").innerText()).replace(/\s+/g, "") === "1/2" && (await page.locator('[role="tab"]').count()) === 2, "…and only the two screens that have a picture for it are listed (1 / 2)");
  await page.getByTestId("device-phone").click();
  await page.waitForTimeout(800);
  f = await frame();
  ok(Math.abs(f.ratio - 1440 / 3120) < 0.01 && f.cls.includes("phone") && f.camIn === true && /hole/.test(f.camClass), "the phone's screen is 19.5:9 and its camera is a punch-hole inside the screen", `${f.ratio.toFixed(3)} ${f.camClass}`);
  ok(f.w <= 300 && f.h > f.w * 2, "…a narrow, tall device", `${f.w}×${f.h}`);
  ok((await page.getByTestId("shot-count").innerText()).replace(/\s+/g, "") === "1/3", "…with all three screens (the Menu one has a light picture for the phone)");
  await page.getByTestId("device-tablet-landscape").click();
  await page.waitForTimeout(600);

  say("3. Auto follows the browser, live");
  ok((await look(page)) === "light", "the browser is light: the light picture is on the screen");
  ok(/Following your browser: light/.test(await page.getByTestId("look-hint").innerText()), "the hint says it follows the browser (light)");
  await page.emulateMedia({ colorScheme: "dark" });
  ok((await look(page)) === "dark", "the browser goes dark (nothing reloaded): the dark picture fades in");
  ok(/Following your browser: dark/.test(await page.getByTestId("look-hint").innerText()), "…and the hint follows too (dark)");
  await page.emulateMedia({ colorScheme: "light" });
  ok((await look(page)) === "light", "back to light: the light picture again");

  say("4. Choosing a look by hand");
  await page.getByTestId("look-dark").click();
  ok((await look(page)) === "dark" && (await page.getByTestId("look-dark").getAttribute("aria-checked")) === "true", "Dark shows the dark picture although the browser is light");
  ok(/Showing the dark screens, whatever your browser is set to/.test(await page.getByTestId("look-hint").innerText()), "…and says so");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.getByTestId("look-light").click();
  ok((await look(page)) === "light", "Light shows the light picture although the browser is dark");
  await page.getByTestId("look-auto").click();
  ok((await look(page)) === "dark", "Auto goes back to following the browser (dark)");
  await page.getByTestId("look-light").click();
  await page.getByTestId("shot-next").click();
  ok((await look(page)) === "light", "the chosen look stays when another screen is chosen");
  await page.getByTestId("shot-tab-0").click();
  ok((await page.evaluate(() => localStorage.getItem("rp-shots-look"))) === "light", "the choice is remembered on this browser");
  await page.getByTestId("device-phone").click();
  await page.reload({ waitUntil: "load" });
  await page.getByTestId("shots-ui").waitFor();
  ok(await until(async () => (await page.getByTestId("look-light").getAttribute("aria-checked")) === "true" && (await page.getByTestId("device-phone").getAttribute("aria-checked")) === "true"), "after a reload the device (phone) and the look (Light) are the ones chosen last time");
  await page.getByTestId("look-auto").click();
  await page.getByTestId("device-tablet-landscape").click();
  await page.emulateMedia({ colorScheme: "light" });

  say("5. A look the screen doesn't have");
  await page.getByTestId("device-phone").click();
  await page.getByTestId("shot-tab-2").click();
  await page.getByTestId("look-dark").click();
  ok((await look(page)) === "light", "the Menu screen has only a light phone picture: it is shown even when Dark is chosen");
  await page.getByTestId("shot-tab-0").click();
  ok((await look(page)) === "dark", "…while the other screens do go dark");
  await page.getByTestId("look-auto").click();
  await page.getByTestId("device-tablet-landscape").click();

  say("6. Flipping through the screens");
  await page.getByTestId("shot-tab-0").click();
  await page.getByTestId("shot-next").click();
  ok((await page.getByTestId("shot-count").innerText()).replace(/\s+/g, "") === "2/3" && (await page.getByTestId("shot-tab-1").getAttribute("aria-selected")) === "true", "Next moves to the second screen");
  ok(/Follow each order/.test(await page.locator('[role="tab"][aria-selected="true"]').innerText()), "…and its caption opens");
  await page.getByTestId("shot-next").click();
  await page.getByTestId("shot-next").click();
  ok((await page.getByTestId("shot-count").innerText()).replace(/\s+/g, "") === "1/3", "Next from the last screen goes round to the first");
  await page.getByTestId("shot-prev").click();
  ok((await page.getByTestId("shot-count").innerText()).replace(/\s+/g, "") === "3/3", "Previous from the first goes round to the last");
  await page.getByTestId("shot-tab-0").click();
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(150);
  const kb = [await page.getByTestId("shot-tab-1").getAttribute("aria-selected"), await page.evaluate(() => document.activeElement?.getAttribute("data-testid"))];
  ok(kb[0] === "true" && kb[1] === "shot-tab-1", "the arrow keys move along the list, and the focus goes with them", kb.join(" / "));
  await page.keyboard.press("End");
  ok((await page.getByTestId("shot-tab-2").getAttribute("aria-selected")) === "true", "End jumps to the last");
  await page.keyboard.press("Home");
  ok((await page.getByTestId("shot-tab-0").getAttribute("aria-selected")) === "true", "Home jumps to the first");
  await page.evaluate(() => {
    const s = document.querySelector(".shots-stage");
    const fire = (type, x) => s.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: "touch", clientX: x, clientY: 400 }));
    fire("pointerdown", 400); fire("pointerup", 250);
  });
  ok((await page.getByTestId("shot-tab-1").getAttribute("aria-selected")) === "true", "a swipe to the left on the picture goes to the next screen");
  await page.evaluate(() => {
    const s = document.querySelector(".shots-stage");
    const fire = (type, x) => s.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: "touch", clientX: x, clientY: 400 }));
    fire("pointerdown", 250); fire("pointerup", 400);
  });
  ok((await page.getByTestId("shot-tab-0").getAttribute("aria-selected")) === "true", "…and a swipe to the right goes back");
  await page.evaluate(() => {
    const s = document.querySelector(".shots-stage");
    const fire = (type, x, y) => s.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: "touch", clientX: x, clientY: y }));
    fire("pointerdown", 300, 200); fire("pointerup", 235, 520); // a mostly up-down drag (the page scrolling) is not a swipe, even if it drifts sideways a little
  });
  ok((await page.getByTestId("shot-tab-0").getAttribute("aria-selected")) === "true", "…but scrolling the page with a finger is not mistaken for a swipe");
  const roles = await page.evaluate(() => ({ list: document.querySelector('[role="tablist"]')?.getAttribute("aria-label"), panel: document.querySelector('[role="tabpanel"]')?.getAttribute("aria-labelledby"), tab0: document.querySelector('[role="tab"]')?.id, groups: [...document.querySelectorAll('[role="radiogroup"]')].map((g) => g.getAttribute("aria-label")) }));
  ok(/Screens of TUR/.test(roles.list) && roles.panel === roles.tab0 && roles.groups.join("|") === "Device|Light or dark screens", "the controls are labelled for a screen reader (tabs, a panel tied to its tab, two radio groups)", JSON.stringify(roles));

  say("7. Pictures are fetched when wanted");
  const fresh = await ctx.newPage();
  const reqs = [];
  fresh.on("request", (r) => { if (/\/uploads\//.test(r.url())) reqs.push(r.url()); });
  await open(fresh);
  const layers0 = await fresh.locator(".dev-layer").count();
  ok(layers0 === 2, "at first only the first screen and the next one are on the page (2 of 3)", `${layers0}`);
  const before = reqs.length;
  await fresh.getByTestId("shot-tab-2").click();
  await fresh.waitForTimeout(800);
  ok((await fresh.locator(".dev-layer").count()) === 3 && reqs.length > before, "…the third is added when it is wanted, and only then fetched", `${before} → ${reqs.length} requests`);
  await fresh.close();

  say("8. A pointer leans the device (a mouse only)");
  await page.getByTestId("shot-tab-0").click();
  const box = await page.locator(".shots-stage").boundingBox();
  await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.2);
  await page.waitForTimeout(500);
  const lean = await page.evaluate(() => getComputedStyle(document.querySelector(".shots-stage")).getPropertyValue("--ry"));
  ok(parseFloat(lean) > 2, "the device leans towards a mouse pointer", lean);
  await page.mouse.move(2, 2);
  await page.waitForTimeout(400);
  ok(parseFloat(await page.evaluate(() => getComputedStyle(document.querySelector(".shots-stage")).getPropertyValue("--ry"))) === 0, "…and stands straight again when the pointer leaves");

  say("9. A phone-sized screen");
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "light", hasTouch: true, isMobile: true });
  const mp = await m.newPage();
  await open(mp);
  const geo = await mp.evaluate(() => {
    const r = (s) => document.querySelector(s)?.getBoundingClientRect();
    const tab = document.querySelector('[role="tablist"]');
    return { over: document.documentElement.scrollWidth - innerWidth, ctl: r(".shots-controls").top, dev: r(".dev-wrap").top, list: tab.getBoundingClientRect().top, devW: Math.round(r(".dev-wrap").width), listScroll: tab.scrollWidth > tab.clientWidth, seg: [...document.querySelectorAll(".seg-btn")].map((b) => Math.round(b.getBoundingClientRect().height)), cap: getComputedStyle(document.querySelector(".shots-cap")).display, tabCap: getComputedStyle(document.querySelector('[role="tab"] .shots-tab-text > span')).display };
  });
  ok(geo.over <= 0, "nothing sticks out sideways", `${geo.over}px`);
  ok(geo.ctl < geo.dev && geo.dev < geo.list, "the controls come first, then the device, then the row of screens");
  ok(geo.devW <= 390 - 30 && geo.devW >= 300, "the device fills the width", `${geo.devW}px`);
  ok(geo.seg.every((h) => h >= 36), "the switch buttons are big enough to touch", geo.seg.join());
  ok(geo.listScroll, "the screens are a row you can scroll sideways (when they don't fit)", String(geo.listScroll));
  ok(geo.cap !== "none" && geo.tabCap === "none", "the chosen screen's caption sits under the device (not inside the chips)");
  await mp.getByTestId("shot-tab-2").tap();
  await mp.waitForTimeout(700);
  ok((await mp.getByTestId("shot-count").innerText()).replace(/\s+/g, "") === "3/3", "tapping a chip chooses that screen");
  await mp.getByTestId("device-phone").tap();
  await mp.waitForTimeout(800);
  const g2 = await mp.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth, w: Math.round(document.querySelector(".dev-wrap").getBoundingClientRect().width) }));
  ok(g2.over <= 0 && g2.w <= 300, "the phone view fits too", `${g2.w}px wide, ${g2.over}px over`);
  await m.close();

  say("10. The first paint needs no script");
  const nojs = await browser.newContext({ viewport: { width: 1400, height: 1000 }, colorScheme: "dark", javaScriptEnabled: false });
  const np = await nojs.newPage();
  await np.goto(WEB + "/apps/tour", { waitUntil: "load" });
  ok((await np.locator("#screens .dev-layer").count()) >= 1 && (await np.locator('#screens .dev-layer[data-on="true"]').count()) === 1, "with no script the first screen is still drawn");
  const op = await np.evaluate(() => [...document.querySelectorAll('.dev-layer[data-on="true"] .dev-img')].map((i) => [i.dataset.look, getComputedStyle(i).opacity]));
  ok(JSON.stringify(op) === JSON.stringify([["light", "0"], ["dark", "1"]]), "…in the browser's own look (dark here), chosen by CSS alone", JSON.stringify(op));
  await nojs.close();

  say("11. Less motion");
  const calm = await browser.newContext({ viewport: { width: 1400, height: 1000 }, colorScheme: "light", reducedMotion: "reduce" });
  const cp = await calm.newPage();
  await open(cp);
  const cb = await cp.locator(".shots-stage").boundingBox();
  await cp.mouse.move(cb.x + cb.width * 0.9, cb.y + cb.height * 0.2);
  await cp.waitForTimeout(400);
  const still = await cp.evaluate(() => ({ lean: getComputedStyle(document.querySelector(".shots-stage")).getPropertyValue("--ry").trim(), anim: getComputedStyle(document.querySelector(".dev-wrap")).animationName, thumb: getComputedStyle(document.querySelector(".seg-thumb")).transitionDuration }));
  ok((still.lean === "" || parseFloat(still.lean) === 0) && still.anim === "none" && parseFloat(still.thumb) === 0, "with 'reduce motion' the device does not lean, nothing animates in and the switch thumb jumps", JSON.stringify(still));
  await calm.close();

  say("12. Switching the section off, and the words");
  await call("PUT", `${A}/screenshots/tour/section`, { heading: "Take a look at TUR", intro: "Three screens.", defaultDevice: "phone" });
  rebuild();
  const p2 = await ctx.newPage();
  await p2.addInitScript(() => { try { localStorage.clear(); } catch { /* none */ } });
  await open(p2);
  ok(/Take a look at\s+TUR/.test(await p2.locator("#screens h2").innerText()) && (await p2.locator("#screens .section-head p").innerText()) === "Three screens.", "the heading and the line written in the console show on the page");
  ok((await p2.getByTestId("device-phone").getAttribute("aria-checked")) === "true", "…and the page opens on the device chosen there (phone)");
  await call("PUT", `${A}/screenshots/tour/section`, { enabled: false });
  rebuild();
  await p2.goto(WEB + "/apps/tour", { waitUntil: "load" });
  ok((await p2.locator("#screens").count()) === 0, "switched off in the console: the section is not on the page");
  await p2.close();

  ok(problems.length === 0, "no errors in the browser console", problems.slice(0, 3).join(" | "));
  await ctx.close();
} finally {
  await call("DELETE", `${A}/apps/tour`).catch(() => undefined);
  await browser.close();
}
console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
