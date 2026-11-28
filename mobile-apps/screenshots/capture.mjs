#!/usr/bin/env node
/**
 * Takes the screenshots of the three apps that the website's app pages show — from the real apps, running on an Android emulator set to
 * a tablet held sideways, a tablet held upright and a phone (a Galaxy S26 Ultra-sized screen), each in LIGHT and in DARK, talking to a throwaway
 * copy of the real API filled with a fictional restaurant (serve.mjs).
 *
 *   node mobile-apps/screenshots/capture.mjs                everything: 3 apps × 3 devices × light + dark (builds the apps first when they are not built yet)
 *   node mobile-apps/screenshots/capture.mjs --build        build the three apps again first
 *   node mobile-apps/screenshots/capture.mjs --only kda     just one app (oma, kda, rda; comma separated)
 *   node mobile-apps/screenshots/capture.mjs --device phone --theme dark     just one device (tablet-landscape, tablet-portrait, phone) and / or one look
 *   node mobile-apps/screenshots/capture.mjs --shots tables,orders           just these screens (by name, see scenarios.mjs)
 *   node mobile-apps/screenshots/capture.mjs --look oma --device phone --steps "tap:tab-orders;sleep:1000;look;shot:try"
 *                                                           explore: sign in, run the steps, print what is on screen, save raw/look-try.png
 *
 * What it needs: the Android SDK with an emulator and one virtual device (default "Pixel_8_API34"; --avd to change), Java 17, Node.
 * What it never touches: the live server, any real database, your release APKs / signing key (see build.mjs).
 * What it writes: raw full-size PNGs in mobile-apps/screenshots/raw/ (not committed), the web-sized pictures in apps/website/public/app-screens/, and the list
 * the platform reads to fill the console's Screenshots lists the first time (apps/api/src/modules/app-releases/app-shots-builtin.js).
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { adb, ensureEmulator, key, screen, screencap, sh, sleep, swipe, tap, tapAt, typeText, waitFor } from "./adb.mjs";
import { BUILD_DIR, buildApp } from "./build.mjs";
import { API_URL, LOGINS, SHOTS_PORT, STORE, startShotsApi } from "./serve.mjs";
import { SHOTS } from "./scenarios.mjs";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const REPO = join(HERE, "../..");
const RAW = join(HERE, "raw");
const SITE_DIR = join(REPO, "apps/website/public/app-screens");
const MANIFEST = join(REPO, "apps/api/src/modules/app-releases/app-shots-builtin.js");
const PACKAGES = { oma: "com.rasoipulse.oma", kda: "com.rasoipulse.kda", rda: "com.rasoipulse.rda" };

/**
 * The three screens. `w` × `h` is the size of the PICTURE in pixels, `density` the phone's dpi (so dp = px × 160 / dpi), `crop` whether the empty band at the
 * top (the status bar) is cut off — a tablet's frame has its camera in the bezel, a phone's is a punch-hole inside the screen — and `web` the width of the
 * picture the website serves. The tablets are 1280 × 800 dp (a 10-inch tablet); the phone is 411 × 891 dp, the shape of a Galaxy S-Ultra (19.5 : 9, 6.9 inches).
 */
export const DEVICES = {
  "tablet-landscape": { w: 2560, h: 1600, density: 320, crop: true, web: 1600 },
  "tablet-portrait": { w: 1600, h: 2560, density: 320, crop: true, web: 1040 },
  phone: { w: 1440, h: 3120, density: 560, crop: false, web: 720 },
};
const THEMES = ["light", "dark"];

const { values: opt } = parseArgs({
  options: {
    build: { type: "boolean" }, only: { type: "string" }, look: { type: "string" }, steps: { type: "string" }, device: { type: "string" }, theme: { type: "string" },
    shots: { type: "string" }, avd: { type: "string", default: "Pixel_8_API34" }, keep: { type: "boolean" }, "no-site": { type: "boolean" },
  },
});
const say = (s = "") => console.log(s);
const sync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const list = (v) => (v ?? "").split(",").map((x) => x.trim()).filter(Boolean);
const APPS = (opt.look ? [opt.look] : list(opt.only ?? "oma,kda,rda")).filter((a) => PACKAGES[a]);
if (!APPS.length) throw new Error("--only / --look must name oma, kda or rda");
const DEVICE_NAMES = opt.device && opt.device !== "all" ? list(opt.device) : Object.keys(DEVICES);
for (const d of DEVICE_NAMES) if (!DEVICES[d]) throw new Error(`unknown device "${d}" (use ${Object.keys(DEVICES).join(", ")})`);
const THEME_NAMES = opt.theme && opt.theme !== "both" ? list(opt.theme) : THEMES;
for (const t of THEME_NAMES) if (!THEMES.includes(t)) throw new Error(`unknown theme "${t}" (use light or dark)`);
const WANTED_SHOTS = list(opt.shots);

/* ------------------------------------------------------------------ make the emulator the device asked for, with a clean status bar */
/** the empty band at the top of the screen (status bar / camera cut-out) as Android reports it for the current size */
let INSET = 0;
/**
 * Android shows a TASKBAR (a row of app icons, the app's window ending above it with rounded corners) along the bottom of any screen 600 dp or wider. A tablet's
 * picture is of the app alone, so the screen is made that much taller and the band is cropped off the bottom too (the website's frame rounds the corners of
 * the picture, which hides the app window's own). A phone has no taskbar and keeps its gesture bar.
 */
let BOTTOM = 0;
let PROFILE = DEVICES["tablet-landscape"];
function prepareDevice(profile) {
  PROFILE = profile;
  adb("reverse", `tcp:${SHOTS_PORT}`, `tcp:${SHOTS_PORT}`);
  sh(`wm density ${profile.density}`);
  sh(`wm size ${profile.w}x${profile.h + 240}`);
  // how tall that band is at this density: asked of Android (the cut-out frame), else worked out from the phone's 50 dp
  const found = [...sh("dumpsys window | grep -E 'type=displayCutout frame='").out.matchAll(/type=displayCutout frame=\[0,0\]\[\d+,(\d+)\]/g)].map((m) => Number(m[1]));
  const band = found.length ? Math.max(...found) : Math.round((50.3 * profile.density) / 160);
  INSET = profile.crop ? band : 0;
  // the taskbar (a navigation-bar window as tall as the band it occupies): asked of Android once it has drawn itself for this size
  let bar = 0;
  if (profile.crop) {
    for (let i = 0; i < 8 && !bar; i++) {
      const m = [...sh("dumpsys window | grep -E 'InsetsSource id=[0-9a-f]+ type=navigationBars frame='").out.matchAll(/type=navigationBars frame=\[0,(\d+)\]\[\d+,(\d+)\]/g)].map((x) => Number(x[2]) - Number(x[1]));
      bar = m.length ? Math.max(...m) : 0;
      if (!bar) sync(1000);
    }
  }
  BOTTOM = profile.crop ? bar : 0;
  // a tablet's screen is as tall as the picture plus the bands that are cropped off, so that after cropping it the picture is exactly the size asked for
  sh(`wm size ${profile.w}x${profile.h + INSET + BOTTOM}`);
  for (const s of ["window_animation_scale", "transition_animation_scale", "animator_duration_scale"]) sh(`settings put global ${s} 0`);
  sh("settings put system accelerometer_rotation 0");
  sh("settings put system user_rotation 0");
  sh("cmd overlay enable com.android.internal.systemui.navbar.gestural");
  sh("settings put secure show_ime_with_hard_keyboard 0");
  // a clean status bar: a calm time, full battery and wifi, no notifications
  sh("settings put global sysui_demo_allowed 1");
  const demo = (args) => sh(`am broadcast -a com.android.systemui.demo -e command ${args}`);
  demo("enter");
  demo("clock -e hhmm 1030");
  demo("battery -e level 100 -e plugged false");
  demo("network -e wifi show -e level 4 -e fully true");
  demo("network -e mobile show -e datatype none -e level 4");
  demo("notifications -e visible false");
}
const setTheme = (theme) => sh(`cmd uimode night ${theme === "dark" ? "yes" : "no"}`);
function restoreDevice() {
  sh("am broadcast -a com.android.systemui.demo -e command exit");
  sh("wm size reset");
  sh("wm density reset");
  sh("cmd uimode night no");
  for (const s of ["window_animation_scale", "transition_animation_scale", "animator_duration_scale"]) sh(`settings put global ${s} 1`);
  adb("reverse", "--remove", `tcp:${SHOTS_PORT}`);
}

/* ------------------------------------------------------------------ signing in */
async function signIn(app) {
  const L = LOGINS[app];
  if (app === "rda") {
    await tap({ id: "signin-phone" });
    typeText(L.phone);
    await tap({ id: "signin-pin" });
    typeText(L.pin);
  } else {
    await tap({ id: "signin-email" });
    typeText(L.email);
    await tap({ id: "signin-password" });
    typeText(L.password);
  }
  await sleep(300);
  // (no BACK key to put the keyboard away: this emulator reports a keyboard that isn't drawn, and BACK would then leave the app)
  await tap({ id: "signin-submit" });
  await waitFor({ id: "signin-submit" }, { gone: true, timeoutMs: 120_000 }); // signed in: the sign-in screen has gone
  await sleep(2500); // …and the first screen has drawn
}

/**
 * start the app from scratch and sign in: a freshly installed copy each time (so what an earlier look or device left in the app — an order half built, the areas a
 * waiter opened — can't change the next picture), started in the look it will draw
 */
let currentApp = "";
async function launch(app, { fresh = false } = {}) {
  currentApp = app;
  const pkg = PACKAGES[app];
  sh(`am force-stop ${pkg}`);
  if (fresh) {
    adb("uninstall", pkg);
    const inst = adb("install", "-r", "-g", join(BUILD_DIR, `${app}.apk`));
    if (!inst.ok) throw new Error(`installing ${app} failed: ${inst.err || inst.out}`);
  }
  await sleep(500);
  sh(`monkey -p ${pkg} -c android.intent.category.LAUNCHER 1`);
  await waitFor({ id: /^signin-(email|phone)$/ }, { timeoutMs: 60_000 });
  await sleep(800);
  await signIn(app);
}

/* ------------------------------------------------------------------ helpers the scenarios use */
const sharp = createRequire(join(REPO, "apps/api/package.json"))("sharp");
/** the screen's picture, without the empty band at the top when the device crops it */
const crop = (png) => (INSET || BOTTOM ? sharp(png).extract({ left: 0, top: INSET, width: PROFILE.w, height: PROFILE.h }).png().toBuffer() : Promise.resolve(png));
const web = async (png, out) => {
  const h = Math.round((PROFILE.h * PROFILE.web) / PROFILE.w);
  await sharp(png).resize(PROFILE.web, h).webp({ quality: 82, effort: 6 }).toFile(out);
  return { width: PROFILE.web, height: h };
};
/** what a scenario can use: the adb helpers, which device this is, and swipes written as fractions of the PICTURE (0–1), so one scenario fits every screen */
const context = (device) => ({
  tap, tapAt, waitFor, screen, typeText, key, swipe, sleep, sh, device,
  w: PROFILE.w, h: PROFILE.h, inset: INSET, density: PROFILE.density, isPhone: device === "phone", isPortrait: PROFILE.h > PROFILE.w,
  /** wide enough (840 dp) for the apps' two-panel layout */
  twoPanel: (PROFILE.w * 160) / PROFILE.density >= 840,
  relaunch: () => launch(currentApp),
  swipeBy: (fx1, fy1, fx2, fy2, ms = 600) => swipe(Math.round(fx1 * PROFILE.w), INSET + Math.round(fy1 * PROFILE.h), Math.round(fx2 * PROFILE.w), INSET + Math.round(fy2 * PROFILE.h), ms),
});

/* ------------------------------------------------------------------ the list the platform copies in the first time */
async function readManifest() {
  if (!existsSync(MANIFEST)) return {};
  try { return structuredClone((await import(`${pathToFileURL(MANIFEST).href}?t=${Date.now()}`)).BUILTIN_APP_SHOTS ?? {}); } catch { return {}; }
}
function writeManifest(manifest) {
  const order = ["oma", "kda", "rda", ...Object.keys(manifest)];
  const sorted = Object.fromEntries([...new Set(order)].filter((a) => manifest[a]).map((a) => [a, manifest[a]]));
  writeFileSync(MANIFEST, `// GENERATED by mobile-apps/screenshots/capture.mjs — the screenshots taken from the real apps (shipped with the website in apps/website/public/app-screens).\n// They fill an app's screenshot list the first time it is read; after that the console owns the list. Run the capture tool to make this file.\nexport const BUILTIN_APP_SHOTS = ${JSON.stringify(sorted, null, 2)};\n`);
}

async function main() {
  mkdirSync(RAW, { recursive: true });
  say(`Screenshots of ${APPS.map((a) => a.toUpperCase()).join(", ")} — ${DEVICE_NAMES.join(", ")} — ${THEME_NAMES.join(" + ")}`);
  const api = await startShotsApi({ log: (m) => say(`  ${m}`) });
  say(`  ${STORE.name} is serving on ${API_URL}`);
  const emu = await ensureEmulator(opt.avd, say);
  const manifest = opt["no-site"] || opt.look ? {} : await readManifest();
  try {
    for (const app of APPS) {
      say(`\n== ${app.toUpperCase()}`);
      let apk = join(BUILD_DIR, `${app}.apk`);
      if (opt.build || !existsSync(apk)) apk = buildApp(app, { say });
      const pkg = PACKAGES[app];
      const scenarios = SHOTS[app].filter((x) => !WANTED_SHOTS.length || WANTED_SHOTS.includes(x.name));
      const entries = (manifest[app] ??= []);
      for (const device of DEVICE_NAMES) {
        const profile = DEVICES[device];
        prepareDevice(profile);
        say(`\n  ${device}: ${sh("wm size").out.replace(/\n/g, " · ")} (${INSET || BOTTOM ? `${INSET} px cropped off the top${BOTTOM ? ` and ${BOTTOM} px (the taskbar) off the bottom` : ""}` : "the status bar stays"})`);
        for (const theme of THEME_NAMES) {
          setTheme(theme);
          await sleep(600);
          await launch(app, { fresh: true });
          say(`  — ${device} / ${theme}`);
          if (opt.look) {
            // --steps "tap:table-T1;tapText:Momos;sleep:1500;look;shot:name"  tries taps and shows the result (for writing a scenario)
            const show = async () => { for (const n of await screen()) if (n.id || n.text || n.desc) say(`  ${(n.id || "").replace(/^.*:id\//, "").padEnd(28)} ${JSON.stringify(n.text || "").slice(0, 44).padEnd(46)} ${JSON.stringify(n.desc || "").slice(0, 36).padEnd(38)} [${n.x1},${n.y1} → ${n.x2},${n.y2}]${n.clickable ? " ✋" : ""}`); };
            const c = context(device);
            for (const step of (opt.steps ?? "look").split(";").map((x) => x.trim()).filter(Boolean)) {
              const [cmd, ...rest] = step.split(":");
              const arg = rest.join(":");
              say(`> ${step}`);
              if (cmd === "tap") await tap({ id: arg });
              else if (cmd === "tapText") await tap({ text: arg });
              else if (cmd === "tapDesc") await tap({ desc: arg });
              else if (cmd === "sleep") await sleep(Number(arg));
              else if (cmd === "swipe") swipe(...arg.split(",").map(Number));
              else if (cmd === "swipeBy") c.swipeBy(...arg.split(",").map(Number));
              else if (cmd === "shot") { writeFileSync(join(RAW, `look-${arg}.png`), await crop(screencap())); say(`  saved raw/look-${arg}.png`); }
              else if (cmd === "look") await show();
              else say(`  (unknown step ${cmd})`);
            }
            continue;
          }
          for (const shot of scenarios) {
            if (shot.devices && !shot.devices.includes(device)) continue;
            await shot.run(context(device));
            await sleep(shot.settle ?? 1200);
            const png = await crop(screencap());
            const file = `${app}-${shot.name}.${device}.${theme}`;
            writeFileSync(join(RAW, `${file}.png`), png);
            if (!opt["no-site"]) {
              mkdirSync(SITE_DIR, { recursive: true });
              const dims = await web(png, join(SITE_DIR, `${file}.webp`));
              let entry = entries.find((e) => e.name === shot.name);
              if (!entry) entries.push((entry = { name: shot.name, rank: shot.rank ?? entries.length, title: "", caption: "", alt: "", images: {} }));
              Object.assign(entry, { rank: shot.rank ?? entry.rank, title: shot.title, caption: shot.caption, alt: shot.alt });
              ((entry.images[device] ??= {})[theme]) = { src: `/app-screens/${file}.webp`, ...dims };
            }
            say(`    ✔ ${file}`);
          }
        }
        sh(`am force-stop ${pkg}`);
      }
      if (!opt["no-site"] && !opt.look) {
        manifest[app] = entries.sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0)).map(({ rank, ...rest }) => rest);
        writeManifest(manifest);
      }
      sh(`am force-stop ${pkg}`);
    }
  } finally {
    restoreDevice();
    await api.stop().catch(() => undefined);
    if (emu.started && !opt.keep) adb("emu", "kill");
  }
  say(`\nDone. Raw pictures: ${RAW}${opt["no-site"] || opt.look ? "" : `\nWeb pictures: ${SITE_DIR}\nList: ${MANIFEST}`}`);
}

main().then(() => process.exit(0), (e) => { console.error(`\nScreenshots stopped: ${e.message}`); try { restoreDevice(); } catch { /* the device may be gone */ } process.exit(1); });
