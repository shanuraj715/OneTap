#!/usr/bin/env node
/**
 * Build the Android app straight with Gradle — no Expo cloud, no Android Studio needed.
 *
 *   npm run build:debug      a test build you can install on a phone (loads the app code from your Mac while developing)
 *   npm run build:release    the app with its code inside (for handing to staff) — see the signing note below
 *   add --clean to start from a freshly generated android/ folder
 *
 * What it does: (1) writes the native android/ project from app.config.ts (it is generated, never edited by hand),
 * (2) runs Gradle for it, (3) copies the APK to build-output/ with the version in its name, (4) says how long it took.
 *
 * A RELEASE build is signed with our own key (npm run signing:create makes it once) and is checked against that key's fingerprint
 * BEFORE it is copied out: a file signed with the wrong key never reaches build-output/. See scripts/signing-lib.js for why.
 */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const signingLib = require("./signing-lib");

const root = path.join(__dirname, "..");
const args = process.argv.slice(2);
const mode = args.find((a) => a === "debug" || a === "release");
if (!mode) { console.error("Usage: node scripts/build-android.js <debug|release> [--clean]"); process.exit(2); }
const clean = args.includes("--clean");

const version = JSON.parse(fs.readFileSync(path.join(root, "app-version.json"), "utf8")); // read only: the version is never changed by a build

function sdkDir() {
  const candidates = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT, path.join(os.homedir(), "Library/Android/sdk"), path.join(os.homedir(), "Android/Sdk")];
  return candidates.find((p) => p && fs.existsSync(path.join(p, "platforms")));
}
const sdk = sdkDir();
if (!sdk) { console.error("Android SDK not found. Install it (Android Studio, or the command-line tools) or set ANDROID_HOME."); process.exit(1); }

const java = spawnSync(process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, "bin/java") : "java", ["-version"], { encoding: "utf8" });
const javaMajor = Number(/version "(\d+)/.exec(`${java.stderr}${java.stdout}`)?.[1] ?? 0);
if (!javaMajor) { console.error("Java was not found. Install JDK 17 (brew install openjdk@17) and set JAVA_HOME."); process.exit(1); }
if (javaMajor < 17) { console.error(`Java ${javaMajor} is too old: the Android build needs JDK 17 or newer.`); process.exit(1); }

// a release build goes to staff: it must talk to a real https server and never allow plain http
if (mode === "release") {
  const api = process.env.EXPO_PUBLIC_API_URL;
  if (process.env.RP_ALLOW_HTTP === "1") { console.error("✖ RP_ALLOW_HTTP=1 is for debug builds only. Unset it for a release build."); process.exit(1); }
  if (api && !/^https:\/\//i.test(api)) { console.error(`✖ A release build must use an https:// server, not ${api}.`); process.exit(1); }
}

// the release key: found here, handed to Gradle through the environment (nothing secret is written into the generated android/ folder)
let keystoreProperties = null;
const debugSigningAllowed = mode === "release" && process.env.RP_ALLOW_DEBUG_SIGNING === "1";
if (mode === "release") {
  keystoreProperties = signingLib.findKeystoreProperties({ root });
  if (!keystoreProperties && !debugSigningAllowed) {
    console.error(`✖ No release signing key found, so this build would be signed with Android's shared debug key, which cannot be used to update real phones.
  Make the key once:   npm run signing:create
  (to build a throwaway test file anyway: RP_ALLOW_DEBUG_SIGNING=1 npm run build:release)`);
    process.exit(1);
  }
  if (keystoreProperties) {
    const props = signingLib.parseProperties(fs.readFileSync(keystoreProperties, "utf8"));
    const bad = signingLib.propertyProblems(props);
    if (bad.length) { console.error(`✖ ${keystoreProperties} is incomplete: ${bad.join(", ")}.`); process.exit(1); }
    if (!fs.existsSync(props.storeFile)) { console.error(`✖ The key file ${props.storeFile} (named in ${keystoreProperties}) does not exist. Restore it from your backup.`); process.exit(1); }
  }
}

const env = { ...process.env, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk, CI: process.env.CI ?? "1", ...(keystoreProperties ? { OMA_KEYSTORE_PROPERTIES: keystoreProperties } : {}) };
const run = (cmd, argv, cwd) => {
  console.log(`\n$ ${cmd} ${argv.join(" ")}`);
  const r = spawnSync(cmd, argv, { cwd, env, stdio: "inherit" });
  if (r.status !== 0) { console.error(`\n✖ ${cmd} failed (exit ${r.status}).`); process.exit(r.status || 1); }
};
const started = Date.now();
const lap = (label) => console.log(`\n⏱  ${label}: ${((Date.now() - started) / 1000).toFixed(0)} s so far`);

console.log(`Rasoi Pulse OMA ${version.version} (build ${version.versionCode}) — ${mode} — SDK ${sdk} — Java ${javaMajor}`);
run("npx", ["expo", "prebuild", "--platform", "android", "--no-install", ...(clean ? ["--clean"] : [])], root);
lap("native project written");

// Gradle needs to know where the SDK is; the generated folder is rebuilt from config, so this file is too
fs.writeFileSync(path.join(root, "android", "local.properties"), `sdk.dir=${sdk.replace(/\\/g, "/")}\n`);
run("./gradlew", [mode === "debug" ? ":app:assembleDebug" : ":app:assembleRelease", "--console=plain"], path.join(root, "android"));
lap("Gradle finished");

const apk = path.join(root, "android/app/build/outputs/apk", mode, `app-${mode}.apk`);
if (!fs.existsSync(apk)) { console.error(`✖ Expected the APK at ${apk}, but it is not there.`); process.exit(1); }

// a release is checked against the key it must be signed with BEFORE it is copied out (a wrong file never lands in build-output/)
let signedBy = "";
if (mode === "release" && !debugSigningAllowed) {
  const { verifyApk } = require("./signing");
  const { found, problems } = verifyApk(apk);
  if (problems.length) { console.error(`\n✖ This release is NOT fit to hand out, so it was not copied to build-output/:\n${problems.map((p) => `  - ${p}`).join("\n")}`); process.exit(1); }
  signedBy = ` — signed with the release key ${signingLib.prettyFingerprint(found.sha256).slice(0, 23)}…`;
}
fs.mkdirSync(path.join(root, "build-output"), { recursive: true });
// (a file made with RP_ALLOW_DEBUG_SIGNING=1 says so in its name, so it can't be mistaken for a real release)
const suffix = debugSigningAllowed && !keystoreProperties ? "release-DEBUGKEY" : mode;
const out = path.join(root, "build-output", `rasoi-pulse-oma-${version.version}-${suffix}.apk`);
fs.copyFileSync(apk, out);
console.log(`\n✔ ${out} (${(fs.statSync(out).size / 1048576).toFixed(1)} MB) — total ${((Date.now() - started) / 1000).toFixed(0)} s${signedBy}`);
if (suffix === "release-DEBUGKEY") console.log("⚠ Signed with the shared DEBUG key (RP_ALLOW_DEBUG_SIGNING=1): for trying only. Never upload this file for staff.");
