#!/usr/bin/env node
/**
 * Start the code server for trying the app live on a phone (Expo Go, or a debug build), already pointed at the RIGHT server.
 *
 *   npm run phone            the throwaway TEST server on this Mac (fake restaurant, fake data) over Wi-Fi   <- the usual one
 *   npm run phone:usb        the same test server, through a USB cable (no Wi-Fi needed; needs adb + USB debugging)
 *   npm run phone:live       the real, live server (only once it has the app's sign-in route)
 *   node scripts/phone.js --api https://some.server   any other server
 *
 * Before starting it asks the server whether it knows the app's sign-in — so a wrong server is caught here, in one clear
 * sentence, instead of as "Not found" on the phone.
 */
const { spawn, spawnSync } = require("node:child_process");
const os = require("node:os");

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };

const BENCH_PORT = 3097;
const lan = () => {
  const all = Object.entries(os.networkInterfaces()).flatMap(([name, list]) => (list ?? []).filter((n) => n.family === "IPv4" && !n.internal).map((n) => ({ name, address: n.address })));
  const wifi = all.find((n) => /^en\d$/.test(n.name) && /^(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))\./.test(n.address));
  return (wifi ?? all[0])?.address;
};

let api; let label; let hint = "";
if (value("api")) { api = value("api"); label = "the server you named"; }
else if (flag("live")) { api = "https://api.rasoipulse.in"; label = "the LIVE server"; }
else if (flag("usb")) {
  api = `http://localhost:${BENCH_PORT}`; label = "the test server on this Mac (through the USB cable)";
  for (const port of [BENCH_PORT, 8081]) {
    const r = spawnSync(process.env.ANDROID_HOME ? `${process.env.ANDROID_HOME}/platform-tools/adb` : "adb", ["reverse", `tcp:${port}`, `tcp:${port}`], { encoding: "utf8" });
    if (r.status !== 0) { console.error(`✖ adb reverse failed (${(r.stderr || r.error?.message || "").trim()}). Is the phone plugged in with USB debugging on?`); process.exit(1); }
  }
} else {
  const ip = lan();
  if (!ip) { console.error("✖ Could not find this Mac's Wi-Fi address. Connect to Wi-Fi, or use --usb."); process.exit(1); }
  api = `http://${ip}:${BENCH_PORT}`; label = "the test server on this Mac (over Wi-Fi)";
}
if (/^https?:\/\/(localhost|127\.|10\.|192\.168\.)/.test(api) || /^http:\/\//.test(api)) hint = "test sign-in:  s@acme.test  /  Staff1234!   (fake data)";

async function probe() {
  const ask = async (path, init) => { const c = new AbortController(); const t = setTimeout(() => c.abort(), 4000); try { return await fetch(api + path, { ...init, signal: c.signal }); } finally { clearTimeout(t); } };
  try {
    const health = await ask("/health");
    if (!health.ok) throw new Error(`/health answered ${health.status}`);
    // an empty sign-in is refused with 400 by a server that has the route, 404 by one that has not (nothing is counted as a wrong password)
    const login = await ask("/api/auth/app-login", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    if (login.status === 404) return `✖ ${api} is running, but it does not have the app's sign-in (POST /api/auth/app-login) yet.\n  That route has to be deployed there first. For now use the test server: npm run phone`;
  } catch (e) {
    const test = api.includes(String(BENCH_PORT));
    return `✖ Can't reach ${api} (${e.message}).${test ? "\n  Start the test server first, from the repository root:   node tests/e2e/bench/bench.mjs up\n  and make sure the phone is on the same Wi-Fi as this Mac." : ""}`;
  }
  return null;
}

probe().then((problem) => {
  if (problem && !flag("force")) { console.error(`\n${problem}\n`); process.exit(1); }
  console.log(`\n▶ Rasoi Pulse RDA will talk to ${label}:\n    ${api}${hint ? `\n    ${hint}` : ""}\n  (the sign-in screen shows the server's name at the bottom)\n`);
  const child = spawn("npx", ["expo", "start", "--clear"], { stdio: "inherit", env: { ...process.env, EXPO_PUBLIC_API_URL: api } });
  child.on("exit", (code) => process.exit(code ?? 0));
});
