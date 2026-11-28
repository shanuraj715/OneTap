// Adding an app release from an APK file on the machine (apps/api/src/scripts/publish-app-release.js): the same checks and the same storage as the console's upload.
// A private API on an in-memory database; the script is run as a separate process against that database, as it is on the server. No browser.
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { makeApk, startApi } from "./_api-harness.mjs";

const t = await startApi(3121, { UPLOADS_DIR: ".uploads-t149", WEBSITE_URL: "https://site.example.test" });
const uploads = path.join(process.cwd(), ".uploads-t149");
fs.rmSync(uploads, { recursive: true, force: true });
const filesIn = () => (fs.existsSync(uploads) ? fs.readdirSync(uploads, { recursive: true }).filter((f) => String(f).endsWith(".apk")) : []);
const { call, ok, say } = t;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rp-publish-"));
const sha = (b) => createHash("sha256").update(b).digest("hex");
const run = (...args) => new Promise((resolve) => {
  const c = spawn(process.execPath, [`${t.API}/src/scripts/publish-app-release.js`, ...args], { cwd: process.cwd(), env: { ...process.env } });
  let out = ""; let err = "";
  c.stdout.on("data", (d) => { out += d; }); c.stderr.on("data", (d) => { err += d; });
  const timer = setTimeout(() => c.kill("SIGKILL"), 120_000);
  c.on("close", (code) => { clearTimeout(timer); resolve({ status: code, stdout: out, stderr: err }); });
});

await t.run(async () => {
  const s = await t.makeStore();
  const A = "/api/platform/app-releases";
  const admin = (method, p, body) => call(method, A + p, { cookie: s.su, body });
  const apk = makeApk(2 * 1024 * 1024 + 321);
  const file = path.join(tmp, "oma.apk");
  fs.writeFileSync(file, apk);

  say("1. Checks before anything is stored");
  const dry = await run("--app", "oma", "--file", file, "--version", "v-26.11.28-002", "--dry-run");
  ok(dry.status === 0 && /DRY RUN/.test(dry.stdout) && /the file is an APK/.test(dry.stdout), "--dry-run says the file is an APK", dry.stdout.split("\n").filter(Boolean).join(" | "));
  ok(filesIn().length === 0 && (await admin("GET", "")).json.releases.length === 0, "…and stores and saves nothing");
  const notApk = path.join(tmp, "notes.apk"); fs.writeFileSync(notApk, Buffer.concat([Buffer.from("this is not a zip "), Buffer.alloc(4000, 1)]));
  const bad = await run("--app", "oma", "--file", notApk, "--version", "v-26.11.28-002");
  ok(bad.status === 1 && /isn't an APK/.test(bad.stderr), "a file that is not an APK is refused with the console's words", bad.stderr.trim());
  const badVer = await run("--app", "oma", "--file", file, "--version", "26.11.28-2");
  ok(badVer.status === 1 && /v-YY\.MM\.DD-NNN/.test(badVer.stderr), "a version in the wrong form is refused", badVer.stderr.trim().slice(0, 120));
  const noApp = await run("--app", "nope", "--file", file, "--version", "v-26.11.28-002");
  ok(noApp.status === 1 && /doesn't exist/.test(noApp.stderr), "an app that doesn't exist is refused");
  const missing = await run("--app", "oma", "--file", path.join(tmp, "missing.apk"), "--version", "v-26.11.28-002");
  ok(missing.status === 1 && /isn't there/.test(missing.stderr), "a file that isn't there is refused");
  const noArgs = await run("--app", "oma");
  ok(noArgs.status === 1 && /Usage/.test(noArgs.stderr), "missing arguments print how to use it");
  ok(filesIn().length === 0, "(none of those stored anything)");

  say("2. A draft (no --publish): saved, but not visible to phones or the website");
  const draft = await run("--app", "oma", "--file", file, "--version", "v-26.11.28-002", "--notes", "Light and dark follow the phone.");
  ok(draft.status === 0 && /is draft/.test(draft.stdout) && /update optional/.test(draft.stdout.split("\n")[0]), "the draft is saved, and the script says the update is optional", draft.stdout.split("\n").filter(Boolean).pop());
  const rel1 = (await admin("GET", "")).json.releases[0];
  ok(rel1?.version === "v-26.11.28-002" && rel1.versionCode === 2 && rel1.status === "draft" && rel1.force === false && rel1.notes === "Light and dark follow the phone.", "the record has the version, build number, notes, not forced", JSON.stringify({ v: rel1?.version, c: rel1?.versionCode, s: rel1?.status }));
  ok(rel1.size === apk.length && rel1.sha256 === sha(apk), "…the file's real size and SHA-256");
  ok(filesIn().length === 1 && filesIn()[0].startsWith(`app-releases${path.sep}oma${path.sep}v-26.11.28-002-`), "…and the file is in the platform's storage, under app-releases/oma/", filesIn().join());
  ok((await call("GET", "/api/app-updates/check?app=oma&versionCode=1")).json.updateAvailable === false && (await call("GET", `/api/app-updates/download/${rel1.id}`)).status === 404, "a draft is not offered to phones and can't be downloaded");
  const row = await t.raw("appreleases").findOne({ version: "v-26.11.28-002", app: "oma" });
  const su = await t.raw("users").findOne({ email: "super@sandbox.test" });
  ok(row && String(row.createdBy) === String(su._id), "…recorded under the platform admin");

  say("3. Published, optional: phones are told, the website lists it, the file downloads");
  const apk2 = makeApk(1024 * 1024 + 77);
  const f2 = path.join(tmp, "oma3.apk"); fs.writeFileSync(f2, apk2);
  const pub = await run("--app", "oma", "--file", f2, "--version", "v-26.11.28-003", "--notes", "A fix.", "--publish");
  ok(pub.status === 0 && /is published/.test(pub.stdout) && /will be PUBLISHED; update optional/.test(pub.stdout), "--publish publishes it, optional", pub.stdout.split("\n").filter(Boolean).join(" | ").slice(0, 200));
  const chk = (await call("GET", "/api/app-updates/check?app=oma&versionCode=1")).json;
  ok(chk.updateAvailable === true && chk.force === false && chk.latest?.version === "v-26.11.28-003", "a phone on build 1 is told about the new version, and it is optional", JSON.stringify({ u: chk.updateAvailable, f: chk.force, v: chk.latest?.version }));
  const page = (await call("GET", "/api/app-updates/releases?app=oma")).json;
  ok(page.latest?.version === "v-26.11.28-003" && page.releases.length === 1, "the website's data lists it (the draft is not there)");
  const dl = await call("GET", `/api/app-updates/download/${page.latest.id}`);
  ok(dl.status === 200 && /oma3\.apk|rasoi-pulse-oma-v-26\.11\.28-003\.apk/.test(dl.headers.get("content-disposition") ?? ""), "the file downloads under a clear name", dl.headers.get("content-disposition") ?? "");
  const full = await fetch(`${t.base}/api/app-updates/download/${page.latest.id}`);
  ok(sha(Buffer.from(await full.arrayBuffer())) === sha(apk2), "…byte for byte");

  say("4. A required update, and a version that already exists");
  const f3 = path.join(tmp, "kda.apk"); fs.writeFileSync(f3, makeApk(900_000));
  const forced = await run("--app", "kda", "--file", f3, "--version", "v-26.11.28-002", "--publish", "--force");
  ok(forced.status === 0 && /update REQUIRED/.test(forced.stdout) && /update required/.test(forced.stdout.split("\n").filter(Boolean).pop()), "--force makes it required, and says so");
  ok((await call("GET", "/api/app-updates/check?app=kda&versionCode=1")).json.force === true, "…phones on an older build are told they must update");
  const dup = await run("--app", "oma", "--file", f2, "--version", "v-26.11.28-003");
  ok(dup.status === 1 && /already exists/.test(dup.stderr), "the same version again is refused (each build number is used once)", dup.stderr.trim());
  const n = filesIn().length;
  ok(n === 3, "…and no file was stored for it (3 files in all: OMA draft, OMA published, KDA)", `${n}`);
  const other = await run("--app", "kda", "--file", f3, "--version", "v-26.11.28-002");
  ok(other.status === 1 && /already exists/.test(other.stderr), "(the build number is per app: KDA's 002 is taken too)");
  const bizFile = path.join(tmp, "biz.apk"); fs.writeFileSync(bizFile, makeApk(800_000));
  const biz = await run("--app", "business", "--file", bizFile, "--version", "v-26.11.28-002", "--publish");
  ok(biz.status === 0 && (await call("GET", "/api/app-updates/releases?app=business")).json.latest?.version === "v-26.11.28-002", "a different app's 002 is fine (build numbers are per app)");
  ok(filesIn().length === 4, "…four files in storage now");
});
fs.rmSync(tmp, { recursive: true, force: true });
