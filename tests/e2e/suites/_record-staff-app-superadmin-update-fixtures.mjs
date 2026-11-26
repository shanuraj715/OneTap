// Records the REAL answers the staff Android app needs for (1) a PLATFORM ADMIN signing in (several stores, each with outlets) and
// (2) the update check (nothing published / an optional update / a required update / already current) and the sign-in refusal an old
// build gets when an update is required. Written to mobile-apps/oma/test/fixtures/*.json. Separate from _record-staff-app-fixtures.mjs on
// purpose: running that one renews every id in the other fixtures; this one only adds its own files.
//   node tests/e2e/suites/_record-staff-app-superadmin-update-fixtures.mjs
import { createRequire } from "node:module";
import { pathToFileURL, fileURLToPath as __f } from "node:url";
import { mkdirSync as __mk, writeFileSync } from "node:fs";
const REPO = __f(new URL("../../..", import.meta.url)).replace(/\/$/, "");
const API = `${REPO}/apps/api`;
const OUT = `${REPO}/mobile-apps/oma/test/fixtures`;
const PORT = 3110;
const __RUN = __f(new URL("../.bench/suite-run/", import.meta.url));
__mk(__RUN, { recursive: true }); __mk(OUT, { recursive: true });
process.chdir(__RUN);
const req = createRequire(`${API}/package.json`);
const mms = await import(pathToFileURL(req.resolve("mongodb-memory-server")).href);
const mongod = await (mms.MongoMemoryServer ?? mms.default.MongoMemoryServer).create();
// fixed public addresses, so the recorded pageUrl / downloadUrl are the real, stable ones
Object.assign(process.env, { NODE_ENV: "development", API_PORT: String(PORT), MONGODB_URI: mongod.getUri(), MONGODB_DB: "sandbox", LOG_LEVEL: "silent", WEBSITE_URL: "https://rasoipulse.in", PUBLIC_API_URL: "https://api.rasoipulse.in" });
const db = await import(`${REPO}/packages/db/src/index.js`);
await db.connectDb({ uri: mongod.getUri(), dbName: "sandbox" });
const { env } = await import(`${API}/src/env.js`);
const { createApp } = await import(`${API}/src/app.js`);
const { ensureSuperAdmin } = await import(`${API}/src/modules/auth/auth.service.js`);
const server = createApp().listen(PORT);
await new Promise((r) => server.once("listening", r));
await ensureSuperAdmin({ email: "super@sandbox.test", name: "Platform Admin", password: "Super123!" });
env.RATE_LIMITS = "off";

const base = `http://127.0.0.1:${PORT}`;
const call = async (method, path, { body, cookie, headers = {} } = {}) => {
  const r = await fetch(base + path, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text(); let json = {}; try { json = JSON.parse(text); } catch {}
  return { status: r.status, json, headers: r.headers };
};
const save = (name, value) => { writeFileSync(`${OUT}/${name}.json`, JSON.stringify(value, null, 2) + "\n"); console.log(`recorded ${name}.json`); };
const must = (r, what) => { if (r.status >= 400) { console.error("FAILED", what, r.status, JSON.stringify(r.json).slice(0, 300)); process.exit(1); } return r.json; };

try {
  const login = await call("POST", "/api/auth/login", { body: { email: "super@sandbox.test", password: "Super123!" } });
  const su = login.headers.get("set-cookie").split(";")[0];
  // two stores; the first has two outlets (so "which outlet" is a real question), the second one
  const a = must(await call("POST", "/api/brands", { cookie: su, body: { brandName: "Gazab Momos", brandSlug: "gazab-momos", outletName: "Noida", outletSlug: "noida", hostnames: ["noida.test"], ownerEmail: "owner@gazab.test", ownerName: "Owner", ownerPassword: "Owner123!" } }), "brand A");
  const brandA = String(a.brand?._id ?? a.brand?.id ?? a.brandId);
  must(await call("POST", "/api/outlets", { cookie: su, headers: { "x-rasoipulse-brand": brandA }, body: { name: "Ludhiana", slug: "ludhiana" } }), "second outlet");
  must(await call("POST", "/api/brands", { cookie: su, body: { brandName: "Spice Route", brandSlug: "spice-route", outletName: "Delhi", outletSlug: "delhi", hostnames: ["delhi.test"], ownerEmail: "owner@spice.test", ownerName: "Owner", ownerPassword: "Owner123!" } }), "brand B");

  // ---- the platform admin signs in to the app
  const answer = must(await call("POST", "/api/auth/app-login", { body: { email: "super@sandbox.test", password: "Super123!" } }), "super app-login");
  save("auth-app-login-super", { ...answer, token: "TEST-TOKEN-SUPER-0123456789", expiresAt: "2026-12-10T00:00:00.000Z" });
  const outlets = must(await call("GET", "/api/outlets", { headers: { authorization: `Bearer ${answer.token}` } }), "outlets as super admin");
  save("outlets-super", outlets);

  // ---- the update check
  const file = (v) => ({ name: `oma-${v}.apk`, key: `${v}.apk`, size: 3_400_000, sha256: "a".repeat(64) });
  const publish = (version, versionCode, notes, force) => db.AppReleaseModel.create({ app: "oma", platform: "android", version, versionCode, notes, force, status: "published", publishedAt: new Date("2026-11-27T10:00:00Z"), file: file(version) });
  const check = async (code) => must(await call("GET", `/api/app-updates/check?app=oma&platform=android&versionCode=${code}`), `check ${code}`);
  save("update-check-none", await check(1));
  await publish("v-261127-002", 2, "Menu loads once and stays fast\nTables grouped by floor", false);
  save("update-check-optional", await check(1));
  save("update-check-current", await check(2));
  await publish("v-261128-003", 3, "Security fix: please update", true);
  save("update-check-required", await check(1));
  const old = await call("POST", "/api/auth/app-login", { headers: { "x-oma-version-code": "1" }, body: { email: "super@sandbox.test", password: "Super123!" } });
  if (old.status !== 426) { console.error("expected 426, got", old.status); process.exit(1); }
  save("error-update-required", old.json);
} finally {
  server.close();
  await mongod.stop();
  process.exit(0);
}
