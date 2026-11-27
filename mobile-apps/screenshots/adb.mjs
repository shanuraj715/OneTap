/**
 * The little bit of Android Debug Bridge the screenshots need: run a command on the emulator, read what is on its screen (uiautomator),
 * tap, type, and take a picture. Nothing here knows about Rasoi Pulse.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const sdk = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT, join(homedir(), "Library/Android/sdk"), join(homedir(), "Android/Sdk")].find((p) => p && existsSync(join(p, "platforms")));
export const ADB = join(sdk ?? "", "platform-tools/adb");
export const EMULATOR = join(sdk ?? "", "emulator/emulator");
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const adb = (...args) => {
  const r = spawnSync(ADB, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return { ok: r.status === 0, out: String(r.stdout ?? "").trim(), err: String(r.stderr ?? "").trim() };
};
export const sh = (cmd) => adb("shell", cmd);

/** the picture on the screen, as PNG bytes */
export function screencap() {
  const r = spawnSync(ADB, ["exec-out", "screencap", "-p"], { maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0 || !r.stdout?.length) throw new Error("could not take a screenshot");
  return r.stdout;
}

export const devices = () => adb("devices").out.split("\n").slice(1).map((l) => l.trim().split(/\s+/)).filter((p) => p[1] === "device").map((p) => p[0]);

export async function waitForBoot(timeoutMs = 240_000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (devices().length && sh("getprop sys.boot_completed").out === "1") return true;
    await sleep(2000);
  }
  return false;
}

/** start the emulator (headless) when none is running; resolves when Android has finished booting */
export async function ensureEmulator(avd, say = console.log) {
  if (devices().length) return { started: false };
  if (!existsSync(EMULATOR)) throw new Error(`No emulator found at ${EMULATOR}. Install one with Android Studio, or start any device yourself.`);
  say(`  starting the emulator "${avd}" (headless)…`);
  const p = spawn(EMULATOR, ["-avd", avd, "-no-window", "-no-audio", "-no-boot-anim", "-no-snapshot", "-gpu", "swiftshader_indirect", "-memory", "4096"], { detached: true, stdio: "ignore" });
  p.unref();
  if (!(await waitForBoot())) throw new Error("the emulator did not finish starting in 4 minutes");
  return { started: true };
}

/* ------------------------------------------------------------------ reading the screen */

const attr = (s, name) => (new RegExp(`${name}="([^"]*)"`).exec(s)?.[1] ?? "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&apos;/g, "'").replace(/&#10;/g, "\n");

/** everything on screen right now: [{ id, text, desc, clickable, x1, y1, x2, y2, cx, cy }] */
export async function screen(tries = 4) {
  for (let i = 0; i < tries; i++) {
    const d = sh("uiautomator dump /sdcard/rp-ui.xml");
    if (d.ok && !/ERROR/i.test(d.out)) {
      const xml = adb("exec-out", "cat", "/sdcard/rp-ui.xml").out;
      const nodes = [];
      for (const m of xml.matchAll(/<node [^>]*>/g)) {
        const n = m[0];
        const b = /bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(n);
        if (!b) continue;
        const [x1, y1, x2, y2] = b.slice(1).map(Number);
        nodes.push({ id: attr(n, "resource-id"), text: attr(n, "text"), desc: attr(n, "content-desc"), clickable: attr(n, "clickable") === "true", x1, y1, x2, y2, cx: Math.round((x1 + x2) / 2), cy: Math.round((y1 + y2) / 2) });
      }
      if (nodes.length) return nodes;
    }
    await sleep(700);
  }
  return [];
}

/** a matcher: { id: "table-T1" } | { text: "Sign in" } | { desc: /Table T1/ } (strings match exactly, expressions loosely) */
const same = (want, got) => (want instanceof RegExp ? want.test(got) : got === want);
export const matches = (n, q) => (q.id === undefined || same(q.id, n.id.replace(/^.*:id\//, ""))) && (q.text === undefined || same(q.text, n.text)) && (q.desc === undefined || same(q.desc, n.desc));

export async function waitFor(q, { timeoutMs = 25_000, gone = false } = {}) {
  const end = Date.now() + timeoutMs;
  let last = [];
  while (Date.now() < end) {
    last = await screen(1);
    const hit = last.find((n) => matches(n, q));
    if (gone ? !hit : hit) return hit ?? true;
    await sleep(600);
  }
  throw new Error(`${gone ? "still on screen" : "never appeared"}: ${JSON.stringify(q, (_, v) => (v instanceof RegExp ? v.toString() : v))}\n   on screen: ${last.map((n) => n.id || n.text || n.desc).filter(Boolean).slice(0, 40).join(" | ")}`);
}

export const tapAt = (x, y) => sh(`input tap ${x} ${y}`);
export async function tap(q, opts) {
  const n = await waitFor(q, opts);
  tapAt(n.cx, n.cy);
  await sleep(350);
  return n;
}
/** type into the field that has focus */
export const typeText = (text) => sh(`input text '${String(text).replace(/ /g, "%s").replace(/'/g, "'\\''")}'`);
export const key = (code) => sh(`input keyevent ${code}`);
export const swipe = (x1, y1, x2, y2, ms = 300) => sh(`input swipe ${x1} ${y1} ${x2} ${y2} ${ms}`);
