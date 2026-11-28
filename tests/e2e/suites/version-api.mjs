// The web version system: ONE file (version.json at the repository root), a script that only changes it when told to, the rules for a good version,
// and the API saying its version on EVERY answer (also errors, also cross-origin pages may read it). No browser — a private API, in-memory database.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { startApi } from "./_api-harness.mjs";

const t = await startApi(3137);
const { call, ok, say } = t;
const S = await import(`${t.REPO}/packages/config-schema/src/index.js`);
const file = JSON.parse(readFileSync(`${t.REPO}/version.json`, "utf8"));
const script = (...args) => { try { return { code: 0, out: execFileSync(process.execPath, [`${t.REPO}/scripts/version.mjs`, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }) }; } catch (e) { return { code: e.status, out: `${e.stdout ?? ""}${e.stderr ?? ""}` }; } };

await t.run(async () => {
  say("1. The rules for a version");
  ok(S.isValidVersion("v-26.11.28-001") && S.isValidVersion("v-27.01.05-012") && S.isValidVersion("v-26.11.28-1000"), "v-YY.MM.DD-NNN is a good version");
  for (const bad of ["26.11.28-001", "v-26.13.28-001", "v-26.11.32-001", "v-26.11.28-1", "v-26.11.28-000", "dev", "", null, undefined]) ok(!S.isValidVersion(bad), `${JSON.stringify(bad)} is not a good version`);
  ok(S.versionProblems("v-26.13.01-001").some((p) => /month/.test(p)) && S.versionProblems("nonsense")[0].includes("v-YY.MM.DD-NNN"), "a bad version says what is wrong, in words");
  const noon = (iso) => new Date(`${iso}T06:30:00Z`); // 12:00 in India
  ok(S.nextVersion("v-26.11.28-001", noon("2026-11-28")) === "v-26.11.28-002", "the same day counts up: 001 → 002");
  ok(S.nextVersion("v-26.11.28-009", noon("2026-11-28")) === "v-26.11.28-010" && S.nextVersion("v-26.11.28-099", noon("2026-11-28")) === "v-26.11.28-100", "…keeping three digits and going past 99");
  ok(S.nextVersion("v-26.11.28-007", noon("2026-11-29")) === "v-26.11.29-001", "a new day starts again at 001");
  ok(S.nextVersion("v-26.12.31-004", noon("2027-01-01")) === "v-27.01.01-001", "…across a new year too");
  ok(S.nextVersion("v-26.11.28-001", new Date("2026-11-28T20:00:00Z")) === "v-26.11.29-001", "the day is India's day: 01:30 in India on the 29th is already the 29th");
  ok(S.nextVersion("garbage", noon("2026-11-28")) === "v-26.11.28-001" && S.nextVersion(undefined, noon("2026-11-28")) === "v-26.11.28-001", "nothing usable before it: start at 001");

  say("2. The one file and the script");
  ok(S.isValidVersion(file.version) && Object.keys(file).join() === "version", "version.json holds one good version", file.version);
  const show = script("show");
  ok(show.code === 0 && show.out.trim() === file.version, "`show` prints exactly what is in the file", show.out.trim());
  const check = script("check");
  ok(check.code === 0 && check.out.includes(file.version), "`check` passes for the file as it is");
  const refused = script("bump");
  ok(refused.code === 2 && /ONLY when the owner asks/.test(refused.out), "`bump` without --confirm refuses, and says why (a build or a deploy must never change the version)");
  ok(JSON.parse(readFileSync(`${t.REPO}/version.json`, "utf8")).version === file.version, "…and the file is untouched");
  ok(script("frobnicate").code === 2, "an unknown command is refused");

  say("3. The API says its version on every answer");
  const health = await call("GET", "/health");
  ok(health.status === 200 && health.headers.get("x-rasoipulse-version") === file.version, "the health check carries the version in the X-RasoiPulse-Version header", String(health.headers.get("x-rasoipulse-version")));
  ok(health.json.version === file.version, "…and in its body", health.json.version);
  const missing = await call("GET", "/api/nothing-here");
  ok(missing.status === 404 && missing.headers.get("x-rasoipulse-version") === file.version, "even an error answer (a 404) carries it");
  const noAuth = await call("GET", "/api/analytics/options");
  ok(noAuth.status === 401 && noAuth.headers.get("x-rasoipulse-version") === file.version, "…and a refused answer (401)");
  const login = await call("POST", "/api/auth/login", { body: { email: "super@sandbox.test", password: "Super123!" } });
  ok(login.status === 200 && login.headers.get("x-rasoipulse-version") === file.version, "…and a sign-in");
  const cors = await fetch(`${t.base}/health`, { headers: { origin: "http://localhost:3171" } });
  ok((cors.headers.get("access-control-expose-headers") ?? "").toLowerCase().includes("x-rasoipulse-version"), "a browser page on another address is allowed to READ the header (Access-Control-Expose-Headers)", cors.headers.get("access-control-expose-headers") ?? "");
  const pre = await fetch(`${t.base}/health`, { method: "OPTIONS", headers: { origin: "http://localhost:3171", "access-control-request-method": "GET" } });
  ok(pre.status < 400 && pre.headers.get("x-rasoipulse-version") === file.version, "even the browser's pre-flight question carries it");
  const text = await fetch(`${t.base}/health`);
  ok((await text.text()).length > 10 && text.headers.get("x-rasoipulse-version") === file.version, "the header is exactly the version string, nothing else added (no build or machine details)");
});
