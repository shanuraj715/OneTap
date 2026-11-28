#!/usr/bin/env node
/**
 * Builds a SCREENSHOT copy of each app: the app with its code inside (a release-type build, so there is no developer overlay on the screen),
 * pointed at the throwaway screenshot server (http://localhost:3098, reached through `adb reverse`), signed with Android's shared DEBUG key.
 *
 *   node mobile-apps/screenshots/build.mjs            all four apps (OMA, KDA, RDA, Business)
 *   node mobile-apps/screenshots/build.mjs oma kda    only these
 *
 * The files go to mobile-apps/screenshots/.build/<app>.apk — NEVER to an app's build-output/ — and no signing key is passed in, so one of
 * these files can't be mistaken for (or uploaded as) a real release. It reuses each app's generated android/ folder, which every normal build
 * regenerates from app.config.ts anyway; your own release APKs in build-output/ are not touched.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { API_URL } from "./serve.mjs";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const APPS = ["oma", "kda", "rda", "business"];
export const BUILD_DIR = join(HERE, ".build");

const sdkDir = () => [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT, join(homedir(), "Library/Android/sdk"), join(homedir(), "Android/Sdk")].find((p) => p && existsSync(join(p, "platforms")));

export function buildApp(app, { say = console.log } = {}) {
  const root = join(HERE, "..", app);
  const sdk = sdkDir();
  if (!sdk) throw new Error("Android SDK not found (set ANDROID_HOME).");
  // never hand a release key to this build, whatever the shell has set
  const env = { ...process.env, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk, CI: "1", EXPO_PUBLIC_API_URL: API_URL, RP_ALLOW_HTTP: "1" };
  for (const k of Object.keys(env)) if (/KEYSTORE_PROPERTIES$/.test(k)) delete env[k];
  const run = (cmd, argv, cwd) => {
    say(`  $ ${cmd} ${argv.join(" ")}`);
    const r = spawnSync(cmd, argv, { cwd, env, stdio: ["ignore", "inherit", "inherit"] });
    if (r.status !== 0) throw new Error(`${cmd} ${argv[0]} failed for ${app} (exit ${r.status})`);
  };
  const t0 = Date.now();
  say(`\n== ${app.toUpperCase()} — building the screenshot copy (server ${API_URL})`);
  run("npx", ["expo", "prebuild", "--platform", "android", "--no-install"], root);
  writeFileSync(join(root, "android", "local.properties"), `sdk.dir=${sdk}\n`);
  run("./gradlew", [":app:assembleRelease", "--console=plain"], join(root, "android"));
  const apk = join(root, "android/app/build/outputs/apk/release/app-release.apk");
  if (!existsSync(apk)) throw new Error(`expected ${apk}`);
  mkdirSync(BUILD_DIR, { recursive: true });
  const out = join(BUILD_DIR, `${app}.apk`);
  copyFileSync(apk, out);
  say(`✔ ${out} (${(Date.now() - t0) / 1000 | 0} s)`);
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const wanted = process.argv.slice(2).filter((a) => APPS.includes(a));
  for (const app of wanted.length ? wanted : APPS) buildApp(app);
}
