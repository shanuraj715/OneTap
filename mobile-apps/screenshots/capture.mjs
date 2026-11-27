#!/usr/bin/env node
/**
 * Takes the tablet screenshots of the three apps that the website's app pages show — from the real apps, running on an Android emulator
 * set to a tablet-sized screen, talking to a throwaway copy of the real API filled with a fictional restaurant (serve.mjs).
 *
 *   node mobile-apps/screenshots/capture.mjs                everything (builds the apps first when they are not built yet)
 *   node mobile-apps/screenshots/capture.mjs --build        build the three apps again first
 *   node mobile-apps/screenshots/capture.mjs --only kda     just one app (oma, kda, rda; comma separated)
 *   node mobile-apps/screenshots/capture.mjs --look oma     sign in, then list what is on the screen (for writing / fixing a scenario)
 *   --size 2560x1600 --density 320                          the tablet's screen (default: 1280 x 800 dp landscape, a 10-inch tablet)
 *
 * What it needs: the Android SDK with an emulator and one virtual device (default "Pixel_8_API34"; --avd to change), Java 17, Node.
 * What it never touches: the live server, any real database, your release APKs / signing key (see build.mjs).
 * What it writes: raw full-size PNGs in mobile-apps/screenshots/raw/ (not committed), and the web-sized images + a manifest the website reads in
 * apps/website/public/app-screens/ and apps/website/src/lib/app-shots.json.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { adb, devices, ensureEmulator, key, screen, screencap, sh, sleep, swipe, tap, tapAt, typeText, waitFor } from "./adb.mjs";
import { BUILD_DIR, buildApp } from "./build.mjs";
import { API_URL, LOGINS, SHOTS_PORT, STORE, startShotsApi } from "./serve.mjs";
import { SHOTS } from "./scenarios.mjs";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const REPO = join(HERE, "../..");
const RAW = join(HERE, "raw");
const SITE_DIR = join(REPO, "apps/website/public/app-screens");
const MANIFEST = join(REPO, "apps/website/src/lib/app-shots.json");
const PACKAGES = { oma: "com.rasoipulse.oma", kda: "com.rasoipulse.kda", rda: "com.rasoipulse.rda" };

const { values: opt } = parseArgs({ options: { build: { type: "boolean" }, only: { type: "string" }, look: { type: "string" }, steps: { type: "string" }, size: { type: "string", default: "2560x1600" }, density: { type: "string", default: "320" }, avd: { type: "string", default: "Pixel_8_API34" }, keep: { type: "boolean" }, "no-site": { type: "boolean" } } });
const say = (s = "") => console.log(s);
const APPS = (opt.look ? [opt.look] : (opt.only ?? "oma,kda,rda").split(",")).map((s) => s.trim()).filter((a) => PACKAGES[a]);
if (!APPS.length) throw new Error("--only / --look must name oma, kda or rda");

/* ------------------------------------------------------------------ make the device a tablet with a clean status bar */
const [SCREEN_W, SCREEN_H] = opt.size.split("x").map(Number);
/** the empty band at the top of the screen (status bar / camera cut-out): the pictures are cropped to remove it */
let INSET = 0;
function prepareDevice() {
  adb("reverse", `tcp:${SHOTS_PORT}`, `tcp:${SHOTS_PORT}`);
  sh(`wm density ${opt.density}`);
  sh(`wm size ${SCREEN_W}x${SCREEN_H + 240}`);
  // how tall that band is at this density: asked of Android (the cut-out frame), else worked out from the phone's 50 dp
  const found = [...sh("dumpsys window | grep -E 'type=displayCutout frame='").out.matchAll(/type=displayCutout frame=\[0,0\]\[\d+,(\d+)\]/g)].map((m) => Number(m[1]));
  INSET = found.length ? Math.max(...found) : Math.round((50.3 * Number(opt.density)) / 160);
  // the screen is as tall as the picture plus that band, so that after cropping it the picture is exactly the size asked for
  sh(`wm size ${SCREEN_W}x${SCREEN_H + INSET}`);
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
function restoreDevice() {
  sh("am broadcast -a com.android.systemui.demo -e command exit");
  sh("wm size reset");
  sh("wm density reset");
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

/* ------------------------------------------------------------------ helpers the scenarios use */
const sharp = createRequire(join(REPO, "apps/api/package.json"))("sharp");
/** the screen's picture without the empty band at the top */
const crop = (png) => sharp(png).extract({ left: 0, top: INSET, width: SCREEN_W, height: SCREEN_H }).png().toBuffer();
const web = async (png, out, width = 1600) => {
  const h = Math.round((SCREEN_H * width) / SCREEN_W);
  await sharp(png).resize(width, h).webp({ quality: 84, effort: 6 }).toFile(out);
  return { width, height: h };
};

async function main() {
  mkdirSync(RAW, { recursive: true });
  say(`Screenshots of ${APPS.map((a) => a.toUpperCase()).join(", ")} on a ${opt.size} / ${opt.density} dpi tablet screen`);
  const api = await startShotsApi({ log: (m) => say(`  ${m}`) });
  say(`  ${STORE.name} is serving on ${API_URL}`);
  const emu = await ensureEmulator(opt.avd, say);
  prepareDevice();
  const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};
  const size = sh("wm size").out;
  say(`  ${size.replace(/\n/g, " · ")} (the top ${INSET} px are cropped off every picture)`);
  try {
    for (const app of APPS) {
      say(`\n== ${app.toUpperCase()}`);
      let apk = join(BUILD_DIR, `${app}.apk`);
      if (opt.build || !existsSync(apk)) apk = buildApp(app, { say });
      const pkg = PACKAGES[app];
      sh(`am force-stop ${pkg}`);
      adb("uninstall", pkg);
      const inst = adb("install", "-r", "-g", apk);
      if (!inst.ok) throw new Error(`installing ${app} failed: ${inst.err || inst.out}`);
      sh(`monkey -p ${pkg} -c android.intent.category.LAUNCHER 1`);
      await waitFor({ id: /^signin-(email|phone)$/ }, { timeoutMs: 60_000 });
      await sleep(800);
      await signIn(app);
      if (opt.look) {
        // --steps "tap:table-T1;tapText:Momos;sleep:1500;look;shot:name"  tries taps and shows the result (for writing a scenario)
        const show = async () => { for (const n of await screen()) if (n.id || n.text || n.desc) say(`  ${(n.id || "").replace(/^.*:id\//, "").padEnd(28)} ${JSON.stringify(n.text || "").slice(0, 44).padEnd(46)} ${JSON.stringify(n.desc || "").slice(0, 70)}  @${n.cx},${n.cy}`); };
        for (const step of (opt.steps ?? "look").split(";").map((x) => x.trim()).filter(Boolean)) {
          const [cmd, ...rest] = step.split(":");
          const arg = rest.join(":");
          say(`> ${step}`);
          if (cmd === "tap") await tap({ id: arg });
          else if (cmd === "tapText") await tap({ text: arg });
          else if (cmd === "tapDesc") await tap({ desc: arg });
          else if (cmd === "sleep") await sleep(Number(arg));
          else if (cmd === "swipe") swipe(...arg.split(",").map(Number));
          else if (cmd === "shot") { writeFileSync(join(RAW, `look-${arg}.png`), await crop(screencap())); say(`  saved raw/look-${arg}.png`); }
          else if (cmd === "look") await show();
          else if (cmd === "insets") say(`  ${sh("dumpsys window | grep -iE 'InsetsSource.*(statusBars|navigationBars)' | head -6").out}`);
          else say(`  (unknown step ${cmd})`);
        }
        continue;
      }
      const taken = [];
      for (const shot of SHOTS[app]) {
        await shot.run({ tap, tapAt, waitFor, screen, typeText, key, swipe, sleep, sh });
        await sleep(shot.settle ?? 1200);
        const png = await crop(screencap());
        const file = `${app}-${shot.name}`;
        writeFileSync(join(RAW, `${file}.png`), png);
        if (!opt["no-site"]) {
          mkdirSync(SITE_DIR, { recursive: true });
          const dims = await web(png, join(SITE_DIR, `${file}.webp`));
          taken.push({ rank: shot.rank ?? taken.length, name: shot.name, file: `${file}.webp`, title: shot.title, caption: shot.caption, alt: shot.alt, ...dims });
        }
        say(`  ✔ ${file}`);
      }
      if (!opt["no-site"]) {
        // taken in the order that is easiest to drive, shown in the order each shot's `rank` says
        manifest[app] = taken.sort((a, b) => a.rank - b.rank).map(({ rank, ...rest }) => rest);
        mkdirSync(join(MANIFEST, ".."), { recursive: true });
        writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
      }
      sh(`am force-stop ${pkg}`);
    }
  } finally {
    restoreDevice();
    await api.stop().catch(() => undefined);
    if (emu.started && !opt.keep) adb("emu", "kill");
  }
  say(`\nDone. Raw pictures: ${RAW}${opt["no-site"] ? "" : `\nWeb pictures: ${SITE_DIR}\nManifest: ${MANIFEST}`}`);
  void devices; void copyFileSync;
}

main().then(() => process.exit(0), (e) => { console.error(`\nScreenshots stopped: ${e.message}`); try { restoreDevice(); } catch { /* the device may be gone */ } process.exit(1); });
