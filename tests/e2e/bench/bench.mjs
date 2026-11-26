// TEST BENCH controller —   node bench/bench.mjs up | reset | rebuild | website | down | status
//   up       start whatever isn't running: API :3097 (fresh fake data), dashboard :3171, storefront :3170
//            (builds the dashboard/storefront first if they've never been built OR the app code changed since)
//   reset    throw the fake data away and re-seed (restarts only the API; sign in again afterwards)
//   rebuild  force a rebuild of the dashboard + storefront from the CURRENT code, then start everything
//   website  (only when asked, not part of `up`) build + start the marketing website on :3173 from a copy in .bench/website
//   down     stop all of them
// It only ever touches ports 3097 / 3170 / 3171 and kills only the process LISTENING there — your own dev servers on
// 3070-3073 are never touched. The storefront is built in .bench/storefront, NEVER in apps/storefront/.next.
// The real database is never used: the API runs on an in-memory MongoDB (see serve-bench.mjs).
import { spawn, execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(HERE, "../../..");
export const BENCH_DIR = resolve(HERE, "../.bench");
export const PORTS = { api: 3097, admin: 3171, storefront: 3170, website: 3173 };
const LOGS = join(BENCH_DIR, "logs");
mkdirSync(LOGS, { recursive: true });

// pnpm's launcher script for Next — it sets NODE_PATH, which the storefront needs to find lucide-react (the storefront
// imports it but doesn't declare it in its package.json; it only resolves through pnpm hoisting).
const NEXT = join(REPO, "apps/storefront/node_modules/.bin/next");
const NEXT_WEBSITE = join(REPO, "apps/website/node_modules/.bin/next");
const VITE = join(REPO, "apps/admin/node_modules/vite/bin/vite.js");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log("[bench]", ...a);

/* ---------------------------------------------------------------- process helpers */
const listeners = (port) => {
  try { return execFileSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], { encoding: "utf8" }).split("\n").filter(Boolean).map(Number); } catch { return []; }
};
export const isUp = (port) => listeners(port).length > 0;

async function stopPort(port) {
  for (const pid of listeners(port)) { try { process.kill(pid, "SIGTERM"); } catch { /* already gone */ } }
  for (let i = 0; i < 16 && isUp(port); i++) await sleep(500);
  for (const pid of listeners(port)) { try { process.kill(pid, "SIGKILL"); } catch { /* already gone */ } }
}

async function waitHttp(url, status, seconds) {
  for (let i = 0; i < seconds; i++) {
    try { const r = await fetch(url, { signal: AbortSignal.timeout(5000), redirect: "manual" }); if (r.status === status) return true; } catch { /* not yet */ }
    await sleep(1000);
  }
  return false;
}

/** start a long-running child fully detached (it must outlive this script), output to a log file */
function startDetached(cmd, args, logName, opts = {}) {
  const fd = openSync(join(LOGS, logName), "w");
  const child = spawn(cmd, args, { detached: true, stdio: ["ignore", fd, fd], ...opts });
  child.unref();
}

function runToLog(cmd, args, logName, opts = {}) {
  const fd = openSync(join(LOGS, logName), "w");
  try { execFileSync(cmd, args, { stdio: ["ignore", fd, fd], ...opts }); return true; } catch { return false; }
}
const tail = (name, n = 12) => { try { return readFileSync(join(LOGS, name), "utf8").trim().split("\n").slice(-n).join("\n"); } catch { return ""; } };

/* ---------------------------------------------------------------- staleness */
function newestMtime(dir, skip = /node_modules|\.next|dist|\.turbo/) {
  let newest = 0;
  const walk = (p) => {
    for (const e of readdirSync(p, { withFileTypes: true })) {
      if (skip.test(e.name)) continue;
      const f = join(p, e.name);
      if (e.isDirectory()) walk(f);
      else { const m = statSync(f).mtimeMs; if (m > newest) newest = m; }
    }
  };
  if (existsSync(dir)) walk(dir);
  return newest;
}
const mtime = (f) => (existsSync(f) ? statSync(f).mtimeMs : 0);
const sharedNewest = () => Math.max(newestMtime(join(REPO, "packages/config-schema/src")), newestMtime(join(REPO, "packages/ui/src")));

/** true when the code of the dashboard changed after the bench's build of it */
export const adminStale = () => mtime(join(BENCH_DIR, "admin-dist/index.html")) < Math.max(newestMtime(join(REPO, "apps/admin/src")), mtime(join(REPO, "apps/admin/index.html")), sharedNewest());
export const websiteStale = () => mtime(join(BENCH_DIR, "website/.next/BUILD_ID")) < Math.max(newestMtime(join(REPO, "apps/website/src")), newestMtime(join(REPO, "apps/website/public")), mtime(join(REPO, "apps/website/next.config.mjs")), sharedNewest());
export const storefrontStale = () => mtime(join(BENCH_DIR, "storefront/.next/BUILD_ID")) < Math.max(newestMtime(join(REPO, "apps/storefront/src")), sharedNewest());

/* ---------------------------------------------------------------- the three services */
async function startApi() {
  if (isUp(PORTS.api)) return true;
  const logFile = join(LOGS, "api.log");
  startDetached(process.execPath, [join(HERE, "serve-bench.mjs")], "api.log");
  for (let i = 0; i < 120; i++) {
    const t = existsSync(logFile) ? readFileSync(logFile, "utf8") : "";
    if (/READY|SETUP FAILED/.test(t)) break;
    await sleep(1000);
  }
  const ok = /READY/.test(existsSync(logFile) ? readFileSync(logFile, "utf8") : "");
  log(ok ? "api        :3097  ready (fresh fake data)" : "api failed:\n" + tail("api.log", 6));
  return ok;
}

function buildAdmin() {
  log("dashboard  building…");
  const ok = runToLog(process.execPath, [VITE, "build", "--outDir", join(BENCH_DIR, "admin-dist"), "--emptyOutDir"], "admin-build.log", {
    cwd: join(REPO, "apps/admin"),
    env: { ...process.env, VITE_API_URL: `http://localhost:${PORTS.api}`, VITE_STOREFRONT_URL: `http://localhost:${PORTS.storefront}` },
  });
  if (!ok) log("dashboard build failed:\n" + tail("admin-build.log", 8));
  return ok;
}
async function startAdmin() {
  if (!existsSync(join(BENCH_DIR, "admin-dist/index.html")) || adminStale()) { if (isUp(PORTS.admin)) await stopPort(PORTS.admin); if (!buildAdmin()) return false; }
  if (isUp(PORTS.admin)) return true;
  startDetached(process.execPath, [VITE, "preview", "--outDir", join(BENCH_DIR, "admin-dist"), "--port", String(PORTS.admin), "--strictPort", "--host", "localhost"], "admin.log", { cwd: join(REPO, "apps/admin") });
  const ok = await waitHttp(`http://localhost:${PORTS.admin}/`, 200, 30);
  log(ok ? "dashboard  :3171  ready" : "dashboard failed to start");
  return ok;
}

function buildStorefront() {
  log("storefront building (about a minute)…");
  const sf = join(BENCH_DIR, "storefront");
  mkdirSync(sf, { recursive: true });
  rmSync(join(sf, "src"), { recursive: true, force: true });
  cpSync(join(REPO, "apps/storefront/src"), join(sf, "src"), { recursive: true });
  for (const f of ["package.json", "jsconfig.json"]) cpSync(join(REPO, "apps/storefront", f), join(sf, f));
  // the real config minus the monorepo-root file-tracing setting (this copy lives outside the app's folder)
  const cfg = readFileSync(join(REPO, "apps/storefront/next.config.mjs"), "utf8").split("\n").filter((l) => !/monorepo root|const workspaceRoot|outputFileTracingRoot/.test(l)).join("\n");
  writeFileSync(join(sf, "next.config.mjs"), cfg);
  try { unlinkSync(join(sf, "node_modules")); } catch { /* none yet */ }
  symlinkSync(join(REPO, "apps/storefront/node_modules"), join(sf, "node_modules"));
  rmSync(join(sf, ".next"), { recursive: true, force: true });
  const ok = runToLog(NEXT, ["build"], "storefront-build.log", {
    cwd: sf,
    env: { ...process.env, API_INTERNAL_URL: `http://127.0.0.1:${PORTS.api}`, NEXT_PUBLIC_API_URL: `http://localhost:${PORTS.api}` },
  });
  if (!ok) log("storefront build failed:\n" + tail("storefront-build.log", 15));
  return ok;
}
async function startStorefront() {
  const sf = join(BENCH_DIR, "storefront");
  if (!existsSync(join(sf, ".next/BUILD_ID")) || storefrontStale()) { if (isUp(PORTS.storefront)) await stopPort(PORTS.storefront); if (!buildStorefront()) return false; }
  if (isUp(PORTS.storefront)) return true;
  startDetached(NEXT, ["start", "-p", String(PORTS.storefront)], "storefront.log", {
    cwd: sf,
    env: { ...process.env, API_INTERNAL_URL: `http://127.0.0.1:${PORTS.api}`, NEXT_PUBLIC_API_URL: `http://localhost:${PORTS.api}` },
  });
  const ok = await waitHttp(`http://localhost:${PORTS.storefront}/main`, 200, 60);
  log(ok ? "storefront :3170  ready" : "storefront failed to start");
  return ok;
}

/* the marketing website: built in .bench/website (never in apps/website/.next, which belongs to the dev server on :3073) */
function buildWebsite() {
  log("website    building (about a minute)…");
  const w = join(BENCH_DIR, "website");
  mkdirSync(w, { recursive: true });
  rmSync(join(w, "src"), { recursive: true, force: true });
  cpSync(join(REPO, "apps/website/src"), join(w, "src"), { recursive: true });
  rmSync(join(w, "public"), { recursive: true, force: true });
  if (existsSync(join(REPO, "apps/website/public"))) cpSync(join(REPO, "apps/website/public"), join(w, "public"), { recursive: true });
  for (const f of ["package.json", "jsconfig.json"]) cpSync(join(REPO, "apps/website", f), join(w, f));
  const cfg = readFileSync(join(REPO, "apps/website/next.config.mjs"), "utf8").split("\n").filter((l) => !/monorepo root|const workspaceRoot|outputFileTracingRoot/.test(l)).join("\n");
  writeFileSync(join(w, "next.config.mjs"), cfg);
  try { unlinkSync(join(w, "node_modules")); } catch { /* none yet */ }
  symlinkSync(join(REPO, "apps/website/node_modules"), join(w, "node_modules"));
  rmSync(join(w, ".next"), { recursive: true, force: true });
  const ok = runToLog(NEXT_WEBSITE, ["build"], "website-build.log", { cwd: w, env: websiteEnv() });
  if (!ok) log("website build failed:\n" + tail("website-build.log", 15));
  return ok;
}
const websiteEnv = () => ({ ...process.env, API_INTERNAL_URL: `http://127.0.0.1:${PORTS.api}`, NEXT_PUBLIC_API_URL: `http://localhost:${PORTS.api}`, NEXT_PUBLIC_SITE_URL: `http://localhost:${PORTS.website}` });
export async function website() {
  if (!(await startApi())) return false;
  const w = join(BENCH_DIR, "website");
  if (!existsSync(join(w, ".next/BUILD_ID")) || websiteStale()) { if (isUp(PORTS.website)) await stopPort(PORTS.website); if (!buildWebsite()) return false; }
  if (isUp(PORTS.website)) return true;
  startDetached(NEXT_WEBSITE, ["start", "-p", String(PORTS.website)], "website.log", { cwd: w, env: websiteEnv() });
  const ok = await waitHttp(`http://localhost:${PORTS.website}/app`, 200, 60);
  log(ok ? "website    :3173  ready" : "website failed to start:\n" + tail("website.log", 8));
  return ok;
}

/* ---------------------------------------------------------------- public commands */
export async function up() { return (await startApi()) && (await startAdmin()) && (await startStorefront()); }
export async function reset() { await stopPort(PORTS.api); return startApi(); }
export async function rebuild() {
  await stopPort(PORTS.admin); await stopPort(PORTS.storefront);
  rmSync(join(BENCH_DIR, "admin-dist"), { recursive: true, force: true });
  rmSync(join(BENCH_DIR, "storefront/.next"), { recursive: true, force: true });
  return up();
}
export async function down() { await stopPort(PORTS.website); await stopPort(PORTS.admin); await stopPort(PORTS.storefront); await stopPort(PORTS.api); log("stopped"); }
export function status() { for (const [n, p] of Object.entries(PORTS)) log(`${n.padEnd(10)} :${p}  ${isUp(p) ? "up" : "down"}`); }
export const ids = () => JSON.parse(readFileSync(join(BENCH_DIR, "ids.json"), "utf8"));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const cmd = process.argv[2];
  const fns = { up, reset, rebuild, website, down, status };
  if (!fns[cmd]) { console.log("usage: node bench/bench.mjs up|reset|rebuild|website|down|status"); process.exit(1); }
  const ok = await fns[cmd]();
  process.exit(ok === false ? 1 : 0);
}
