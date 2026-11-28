// The screenshots that ship with the website (apps/website/public/app-screens) and the tooling that takes them (mobile-apps/screenshots): for every app, screen, device
// (tablet held sideways, tablet held upright, phone) and look (light, dark) there is a real picture of the right shape, not blank, small enough for a web page, with the
// dark one darker than the light one; the list the platform copies in the first time (apps/api/src/modules/app-releases/app-shots-builtin.js) agrees with the files and with the
// scenarios; and the tooling can't touch anything real. The pictures themselves are taken by mobile-apps/screenshots/capture.mjs; this suite checks what it left behind.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = fileURLToPath(new URL("../../..", import.meta.url)).replace(/\/$/, "");
const SHOTS_DIR = path.join(REPO, "mobile-apps/screenshots");
const PUBLIC = path.join(REPO, "apps/website/public/app-screens");
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const say = (s) => console.log(`\n=== ${s}`);
const APPS = { oma: "OMA", kda: "KDA", rda: "RDA" };
const sharp = createRequire(path.join(REPO, "apps/api/package.json"))("sharp");
const schema = await import(pathToFileURL(path.join(REPO, "packages/config-schema/src/index.js")).href);
const { BUILTIN_APP_SHOTS: manifest } = await import(pathToFileURL(path.join(REPO, "apps/api/src/modules/app-releases/app-shots-builtin.js")).href);
const { SCREENSHOT_DEVICE_INFO: INFO, SCREENSHOT_DEVICES: DEVICES, SCREENSHOT_THEMES: THEMES } = schema;
/** how wide the website's copy of a picture is, per device (capture.mjs: DEVICES[...].web) */
const WEB_WIDTH = { "tablet-landscape": 1600, "tablet-portrait": 1040, phone: 720 };

/* ---------------------------------------------------------------- 1. the list and the pictures */
say("1. The list of screenshots and the pictures");
ok(Object.keys(manifest).sort().join() === "kda,oma,rda", "there are screenshots for all three apps", Object.keys(manifest).join(","));
ok(!fs.existsSync(path.join(REPO, "apps/website/src/lib/app-shots.json")), "the old list (app-shots.json) is gone: the platform's database is the only list now");
const files = new Set(fs.readdirSync(PUBLIC).filter((f) => !f.startsWith(".")));
const used = new Set();
const { SHOTS } = await import(pathToFileURL(path.join(SHOTS_DIR, "scenarios.mjs")).href + `?t=${Date.now()}`);
const lum = async (file) => { const { channels } = await sharp(file).stats(); return channels.slice(0, 3).reduce((a, c) => a + c.mean, 0) / 3; };
for (const app of Object.keys(APPS)) {
  const list = manifest[app] ?? [];
  const wanted = (SHOTS[app] ?? []).map((s, i) => ({ ...s, rank: s.rank ?? i })).sort((a, b) => a.rank - b.rank);
  ok(list.length >= 3 && new Set(list.map((s) => s.name)).size === list.length, `${APPS[app]}: at least three screenshots, each with its own name`, `${list.length}`);
  ok(JSON.stringify(list.map((s) => s.name)) === JSON.stringify(wanted.map((s) => s.name)), `${APPS[app]}: the list and the scenarios agree on which screens, in which order`, list.map((s) => s.name).join(","));
  for (const s of list) {
    const sc = wanted.find((w) => w.name === s.name);
    ok(s.title === sc?.title && s.caption === sc?.caption && s.alt === sc?.alt, `${APPS[app]} · ${s.name}: its words are the scenario's`);
    ok(s.title?.length >= 3 && s.caption?.length >= 30 && s.alt?.length >= 30 && !/tablet|phone/i.test(s.alt), `${APPS[app]} · ${s.name}: a title, a caption and a description that doesn't name a device (the website adds it)`);
    const devicesWanted = DEVICES.filter((d) => !sc?.devices || sc.devices.includes(d));
    ok(JSON.stringify(Object.keys(s.images).sort()) === JSON.stringify([...devicesWanted].sort()), `${APPS[app]} · ${s.name}: a picture for every device the scenario runs on`, Object.keys(s.images).join(","));
    for (const d of devicesWanted) {
      ok(JSON.stringify(Object.keys(s.images[d] ?? {}).sort()) === JSON.stringify([...THEMES].sort()), `${APPS[app]} · ${s.name} · ${d}: a light and a dark picture`, Object.keys(s.images[d] ?? {}).join(","));
      const tones = {};
      for (const t of THEMES) {
        const im = s.images[d]?.[t];
        const label = `${APPS[app]}-${s.name}.${d}.${t}`;
        const name = im?.src?.replace("/app-screens/", "");
        ok(im?.src === `/app-screens/${label.replace(`${APPS[app]}-`, `${app}-`)}.webp`, `${label}: has the expected path`, im?.src);
        used.add(name);
        const f = path.join(PUBLIC, name ?? "missing");
        if (!files.has(name)) { ok(false, `${label}: the file is in public/app-screens`); continue; }
        const bytes = fs.readFileSync(f);
        const meta = await sharp(bytes).metadata();
        const want = INFO[d];
        ok(bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP", `${label}: is a real WebP file`);
        ok(meta.width === im.width && meta.height === im.height && meta.width === WEB_WIDTH[d], `${label}: the list says ${im.width}×${im.height} and the picture is ${meta.width}×${meta.height} (${WEB_WIDTH[d]} wide)`);
        ok(Math.abs(meta.width / meta.height - want.width / want.height) < 0.01, `${label}: the shape of a ${want.label.toLowerCase()} ${want.sub.toLowerCase()} screen`, `${(meta.width / meta.height).toFixed(3)} vs ${(want.width / want.height).toFixed(3)}`);
        ok(bytes.length < 260 * 1024, `${label}: small enough for a web page (under 260 KB)`, `${(bytes.length / 1024).toFixed(0)} KB`);
        const { channels } = await sharp(bytes).stats();
        ok(channels.slice(0, 3).some((c) => c.stdev > (t === "dark" ? 12 : 20)), `${label}: has real content on it (not a blank screen)`, `${channels.slice(0, 3).map((c) => c.stdev.toFixed(0)).join("/")}`);
        tones[t] = await lum(bytes);
      }
      ok(tones.dark !== undefined && tones.light !== undefined && tones.dark < tones.light - 40, `${APPS[app]} · ${s.name} · ${d}: the dark picture is clearly darker than the light one`, `light ${Math.round(tones.light)}, dark ${Math.round(tones.dark)}`);
    }
  }
}
ok([...files].every((f) => used.has(f)), "no picture sits in the folder without being listed (so nothing old is left behind)", [...files].filter((f) => !used.has(f)).join(", "));

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
const fictional = ["Saffron Table"];
ok(fictional.every((n) => serve.includes(n)) && !/Gazab|rasoipulse\.in\/noida|rp-demo/.test(serve), "the restaurant in the pictures is fictional (Saffron Table), not a real customer");
ok(!/(\+?91)?[6-9]\d{9}/.test(serve.replace(/9876543210|98765 43210|9811122233|98111 22233|98\d{8,}/g, "")), "only made-up phone numbers are used");


ok(/launch\(app, \{ fresh: true \}\)/.test(capture) && /adb\("uninstall", pkg\)/.test(capture), "every device and look starts from a freshly installed app (nothing an earlier picture left behind can show)");
ok(/cmd uimode night/.test(capture) && /setTheme/.test(capture), "dark mode is the phone's own dark mode (cmd uimode night), not a filter");
ok(/1440/.test(capture) && /3120/.test(capture) && /density: 560/.test(capture), "the phone is a Galaxy S-Ultra-sized screen (1440 × 3120, 19.5 : 9)");
ok(/crop: true/.test(capture) && /taskbar/i.test(capture), "a tablet's picture has the status band and the taskbar cropped off");

console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
