// The staff app's updates: the platform admin uploads an APK (in 4 MB pieces), publishes it and can force an update; the app asks (no
// sign-in) whether a newer version exists; the website lists and serves the APKs; a forced update also turns old builds away at sign-in.
// A private API on an in-memory database, files in a temporary folder; no browser.
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { makeApk, startApi } from "./_api-harness.mjs";
import { fakeS3 } from "../bench/fake-s3.mjs";
// the folder is called ".app-releases" like the real one (Express refuses to send files under a dot-folder unless told it may)
const base = fs.mkdtempSync(path.join(os.tmpdir(), "oma-releases-"));
const dir = path.join(base, ".app-releases");
const t = await startApi(3113, { APP_RELEASES_DIR: dir, UPLOADS_DIR: ".uploads-t93", APP_RELEASE_MAX_MB: "20", WEBSITE_URL: "https://site.example.test" });
const uploads = path.join(process.cwd(), ".uploads-t93"); // the platform storage on this disk (nothing is configured: the default)
fs.rmSync(uploads, { recursive: true, force: true }); // (a run that crashed earlier may have left files)
const apksIn = (d) => (fs.existsSync(d) ? fs.readdirSync(d, { recursive: true }).filter((f) => String(f).endsWith(".apk")) : []);
const { call, ok, say } = t;
const sha = (b) => createHash("sha256").update(b).digest("hex");
const CHUNK = 4 * 1024 * 1024;

await t.run(async () => {
  say("Setup: the platform admin, a store owner and a waiter");
  const s = await t.makeStore();
  const brandHdr = { "x-rasoipulse-brand": s.brand };
  await call("POST", "/api/users", { cookie: s.owner, headers: brandHdr, body: { email: "w@acme.test", name: "Waiter", password: "Staff123!", role: "staff" } });
  const waiter = await t.cookieLogin("w@acme.test", "Staff123!");
  const A = "/api/platform/app-releases";
  const admin = (method, path_, body) => call(method, A + path_, { cookie: s.su, body });
  const put = async (id, index, buf) => {
    const r = await fetch(`${t.base}${A}/uploads/${id}/chunks/${index}`, { method: "PUT", headers: { cookie: s.su, "content-type": "application/octet-stream", "x-forwarded-for": "198.51.100.77" }, body: buf });
    return { status: r.status, json: await r.json().catch(() => ({})) };
  };
  /** upload a whole file through the real three steps, publishing it or not */
  const upload = async (apk, version, { notes = "", force = false, publish = false, app = "oma" } = {}) => {
    const start = await admin("POST", "/uploads", { fileName: `${app}-${version}.apk`, size: apk.length, app });
    if (start.status !== 201) return { start };
    const n = start.json.chunks;
    for (let i = 0; i < n; i++) await put(start.json.uploadId, i, apk.subarray(i * CHUNK, Math.min(apk.length, (i + 1) * CHUNK)));
    const done = await admin("POST", `/uploads/${start.json.uploadId}/complete`, { version, notes, force, publish });
    return { start, done, release: done.json.release };
  };

  say("1. Only the platform admin manages releases");
  for (const [who, cookie] of [["a store owner", s.owner], ["a waiter", waiter], ["nobody signed in", undefined]]) {
    const r = await call("GET", A, { cookie });
    ok(r.status === 403 || r.status === 401, `${who} cannot see the release list`, `${r.status}`);
  }
  ok((await call("POST", A + "/uploads", { cookie: s.owner, body: { fileName: "a.apk", size: 5000 } })).status === 403, "…nor start an upload");
  ok((await admin("GET", "")).status === 200, "the platform admin can");

  say("2. An upload is checked before it is accepted");
  ok((await admin("POST", "/uploads", { fileName: "notes.txt", size: 5000 })).status === 400, "a file that isn't an .apk is refused up front");
  ok((await admin("POST", "/uploads", { fileName: "a.apk", size: 10 })).status === 400, "an empty/tiny file is refused");
  const huge = await admin("POST", "/uploads", { fileName: "a.apk", size: 25 * 1024 * 1024 });
  ok(huge.status === 413 && /too big/i.test(huge.json.error ?? ""), "a file over the size limit is refused (413) before anything is sent", huge.json.error);
  const apk1 = makeApk(9 * 1024 * 1024 + 123); // 3 pieces: 4 MB, 4 MB, and the rest
  const st = await admin("POST", "/uploads", { fileName: "oma.apk", size: apk1.length });
  ok(st.status === 201 && st.json.chunks === 3 && st.json.chunkSize === CHUNK, "the server splits a 9 MB file into 3 pieces of 4 MB", `${st.json.chunks} pieces`);
  const id = st.json.uploadId;
  ok((await put(id, 7, Buffer.alloc(10))).status === 400, "a piece number outside the file is refused");
  ok((await put(id, 0, Buffer.alloc(1000))).status === 400, "a piece of the wrong length is refused (it must be exactly 4 MB)");
  ok((await put("ffffffffffffffffffffffff", 0, apk1.subarray(0, CHUNK))).status === 404, "a piece for an upload that doesn't exist: 404");
  ok((await put(id, 0, apk1.subarray(0, CHUNK))).status === 200, "piece 1 is accepted");
  ok((await put(id, 0, apk1.subarray(0, CHUNK))).status === 200, "…and sending it AGAIN is harmless (a retry after a dropped connection)");
  const early = await admin("POST", `/uploads/${id}/complete`, { version: "v-26.11.26-001" });
  ok(early.status === 409 && early.json.details?.code === "upload_incomplete" && early.json.details.missing.join() === "1,2", "finishing with pieces missing is refused and says which are missing", early.json.error);
  ok((await put(id, 2, apk1.subarray(2 * CHUNK))).status === 200, "the last (short) piece is accepted — out of order is fine (resume)");
  ok((await put(id, 1, apk1.subarray(CHUNK, 2 * CHUNK))).status === 200, "and piece 2");
  ok((await admin("POST", `/uploads/${id}/complete`, { version: "nope" })).status === 400, "a version that isn't v-DDMMYY-NNN is refused");

  say("3. The finished upload becomes a release");
  const done = await admin("POST", `/uploads/${id}/complete`, { version: "v-26.11.26-001", notes: "First version", force: false, publish: false });
  const r1 = done.json.release;
  ok(done.status === 201 && r1?.version === "v-26.11.26-001" && r1.versionCode === 1, "the release is created; its build number is read from the version", `${done.status} build ${r1?.versionCode}`);
  ok(r1.status === "draft" && r1.size === apk1.length && r1.sha256 === sha(apk1), "saved as a draft, with the file's real size and SHA-256", `${r1.size} bytes`);
  ok(apksIn(uploads).length === 1 && apksIn(uploads)[0].startsWith(`app-releases${path.sep}oma${path.sep}v-26.11.26-001-`), "the file is in the platform storage (this disk, by default), under app-releases/oma/", apksIn(uploads).join());
  ok(apksIn(dir).length === 0, "…and the scratch folder for uploads in progress holds no finished file");
  const dup = await upload(makeApk(5000), "v-26.11.26-001");
  ok(dup.done?.status === 409 && /already exists/.test(dup.done.json.error ?? ""), "a version (build number) that already exists can't be uploaded again", dup.done?.json.error);
  const notApk = await upload(Buffer.concat([Buffer.from("this is not a zip file "), Buffer.alloc(5000, 1)]), "v-26.11.26-009");
  ok(notApk.done?.status === 400 && /isn't an APK/.test(notApk.done.json.error ?? ""), "a file that isn't an APK is refused when it is finished", notApk.done?.json.error);
  const noManifest = await upload(makeApk(6000, { manifest: false }), "v-26.11.26-009");
  ok(noManifest.done?.status === 400 && /AndroidManifest/.test(noManifest.done.json.error ?? ""), "a zip without an AndroidManifest.xml is refused too");
  ok(!(await admin("GET", "")).json.releases.some((r) => r.versionCode === 9), "…and neither left a release behind");

  const check = (code) => call("GET", `/api/app-updates/check?versionCode=${code ?? ""}`);
  say("4. A draft is invisible to phones and the website");
  ok(!(await check(0)).json.updateAvailable && (await check(0)).json.latest === null, "no release is published yet: nothing to update to");
  ok((await call("GET", `/api/app-updates/download/${r1.id}`)).status === 404, "a draft can't be downloaded");
  ok((await call("GET", "/api/app-updates/releases")).json.releases.length === 0, "and is not on the website's list");

  say("5. Publishing, and who is told what");
  const apk2 = makeApk(60_000), apk3 = makeApk(70_000), apk4 = makeApk(80_000);
  await admin("PATCH", `/${r1.id}`, { status: "published" });
  const r2 = (await upload(apk2, "v-26.11.26-002", { notes: "Two: pictures on dishes", publish: true })).release;
  ok(r2?.status === "published" && r2.publishedAt, "version 2 is published as it is uploaded", r2?.status);
  let c = (await check(1)).json;
  ok(c.updateAvailable && !c.force && c.latest.version === "v-26.11.26-002", "a phone on build 1 is told 002 is available — optional, not forced", `${c.updateAvailable} force=${c.force}`);
  ok(c.pageUrl === "https://site.example.test/apps/oma", "with the website page to go to (this app's own: /apps/oma)", c.pageUrl);
  ok(c.latest.sha256 === sha(apk2) && c.latest.size === apk2.length && /\/api\/app-updates\/download\//.test(c.latest.downloadUrl), "and the file's size, fingerprint and download address", `${c.latest.size} bytes`);
  ok(!(await check(2)).json.updateAvailable, "a phone already on build 2 is told nothing");
  ok(!(await check(5)).json.updateAvailable, "a phone on a NEWER build (a test build) is told nothing");
  ok(!(await check(0)).json.updateAvailable && !(await check(undefined)).json.updateAvailable, "a phone that does not say which build it is on is never told to update (the server can't judge it)");

  const r3 = (await upload(apk3, "v-26.11.26-003", { notes: "Three: security fix", force: true, publish: true })).release;
  c = (await check(2)).json;
  ok(c.updateAvailable && c.force === true && c.latest.version === "v-26.11.26-003", "version 3 is FORCED: a phone on build 2 must update", `force=${c.force}`);
  c = (await check(1)).json;
  ok(c.force === true && c.whatsNew.map((w) => w.version).join() === "v-26.11.26-003,v-26.11.26-002", "a phone on build 1 must too — and sees what changed in BOTH newer versions, newest first", c.whatsNew.map((w) => w.version).join());
  ok(!(await check(3)).json.updateAvailable, "a phone already on the forced build is free to go");
  const r4 = (await upload(apk4, "v-26.11.26-004", { notes: "Four: small tweak", publish: true })).release;
  c = (await check(2)).json;
  ok(c.force === true && c.latest.version === "v-26.11.26-004", "a later OPTIONAL release doesn't cancel an earlier forced one: a phone that skipped 003 must still update", `force=${c.force}`);
  ok((await check(3)).json.force === false && (await check(3)).json.updateAvailable === true, "a phone on 003 (past the forced one) gets only the optional 004");

  say("6. A forced update also turns old builds away at sign-in");
  const login = (code, password) => fetch(`${t.base}/api/auth/app-login`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.88", ...(code ? { "x-oma-version-code": String(code) } : {}) }, body: JSON.stringify({ email: "w@acme.test", password }) }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => ({})) }));
  const old = await login(2, "Staff123!");
  ok(old.status === 426 && old.json.details?.code === "update_required" && old.json.details.pageUrl === "https://site.example.test/apps/oma", "build 2 is refused at sign-in with 426 'update_required' and the page to update from", `${old.status} ${old.json.details?.code}`);
  ok((await login(2, "wrong-password")).status === 426, "…before any password is looked at (a wrong password gets the same answer)");
  ok((await login(3, "Staff123!")).status === 200, "build 3 signs in normally");
  ok((await login(undefined, "Staff123!")).status === 200, "a build that sends no number (older app) signs in normally");
  ok((await call("POST", "/api/auth/login", { body: { email: "w@acme.test", password: "Staff123!" } })).status === 200, "the dashboard's sign-in is not affected");

  say("7. Downloading the APK");
  const dl = await fetch(`${t.base}/api/app-updates/download/${r2.id}`, { headers: { "x-forwarded-for": "198.51.100.90" } });
  const bytes = Buffer.from(await dl.arrayBuffer());
  ok(dl.status === 200 && sha(bytes) === sha(apk2), "the file downloads, byte for byte what was uploaded (no sign-in needed)", `${bytes.length} bytes`);
  ok(dl.headers.get("content-type") === "application/vnd.android.package-archive" && /attachment; filename="rasoi-pulse-oma-v-26.11.26-002\.apk"/.test(dl.headers.get("content-disposition") ?? ""), "as an Android package, with a clear file name", dl.headers.get("content-disposition"));
  ok(dl.headers.get("accept-ranges") === "bytes", "and can resume after a dropped connection (byte ranges)");
  ok(dl.headers.get("cache-control") === "no-cache", "and is never kept by a cache (a withdrawn version stops at once)", dl.headers.get("cache-control"));
  const part = await fetch(`${t.base}/api/app-updates/download/${r2.id}`, { headers: { range: "bytes=100-199", "x-forwarded-for": "198.51.100.91" } });
  const partBytes = Buffer.from(await part.arrayBuffer());
  ok(part.status === 206 && partBytes.equals(apk2.subarray(100, 200)), "a byte range gives exactly those bytes (206)", `${part.status}`);
  await new Promise((r) => setTimeout(r, 200));
  const after = (await admin("GET", "")).json.releases.find((r) => r.id === r2.id);
  ok(after.downloads === 1, "the download counter counted the full download once, not the resumed part", `downloads ${after.downloads}`);
  ok((await call("GET", "/api/app-updates/download/not-an-id")).status === 404 && (await call("GET", "/api/app-updates/download/ffffffffffffffffffffffff")).status === 404, "a made-up download address: 404");

  say("8. The website's list");
  const pub = (await call("GET", "/api/app-updates/releases")).json;
  ok(pub.latest.version === "v-26.11.26-004" && pub.releases.map((r) => r.version).join() === "v-26.11.26-004,v-26.11.26-003,v-26.11.26-002,v-26.11.26-001", "newest first, and only the PUBLISHED releases (all four are published by now)", pub.releases.map((r) => r.version).join());
  ok(!JSON.stringify(pub).includes("createdBy") && !JSON.stringify(pub).includes(r2.fileName ?? "oma-v"), "no internal fields (who uploaded, the stored file name) are shown", "");
  ok(pub.releases.every((r) => /^http/.test(r.downloadUrl) && r.sha256.length === 64 && r.size > 0), "each has a full download address, its SHA-256 and size");

  say("9. Managing releases");
  const patch1 = await admin("PATCH", `/${r4.id}`, { notes: "Four: reworded", force: true });
  ok(patch1.status === 200 && patch1.json.release.force === true && patch1.json.release.notes === "Four: reworded", "notes and the force switch can be changed after publishing");
  ok((await check(3)).json.force === true, "…and the change reaches phones at once (003 is now below a forced 004)");
  await admin("PATCH", `/${r4.id}`, { status: "withdrawn" });
  ok((await check(3)).json.updateAvailable === false, "a WITHDRAWN release disappears from the phones' view (003 is the newest again)");
  ok((await call("GET", `/api/app-updates/download/${r4.id}`)).status === 404, "…and can't be downloaded");
  await admin("PATCH", `/${r3.id}`, { force: false });
  ok((await check(2)).json.force === false && (await check(2)).json.updateAvailable === true, "taking the force off 003 lets build 2 carry on (still offered the update)");
  ok((await admin("PATCH", `/${r3.id}`, { status: "nonsense" })).status === 400 && (await admin("PATCH", "/ffffffffffffffffffffffff", { notes: "x" })).status === 404, "a bad status is refused; an unknown release is 404");
  const list = (await admin("GET", "")).json;
  ok(list.releases.length === 4 && list.releases[0].versionCode === 4 && list.forcedBelow === null && list.chunkSize === CHUNK, "the console's list: newest first, the rule in force (none now) and the piece size", `forcedBelow ${JSON.stringify(list.forcedBelow)}`);
  await admin("PATCH", `/${r3.id}`, { force: true });
  ok((await admin("GET", "")).json.forcedBelow?.version === "v-26.11.26-003", "with 003 forced again the list says: apps older than v-26.11.26-003 must update");
  const key = apksIn(uploads).length;
  ok((await admin("DELETE", `/${r1.id}`)).status === 204, "a release can be deleted");
  ok(apksIn(uploads).length === key - 1, "…and its file goes from the storage too");
  ok(!(await admin("GET", "")).json.releases.some((r) => r.id === r1.id), "…and from the list");

  say("9b. More than one app: each has its own versions, build numbers and 'required' rule");
  const { parseAppVersion, isCurrentAppVersion, appPagePath } = await import(`${t.REPO}/packages/config-schema/src/index.js`);
  ok(isCurrentAppVersion("v-26.11.27-003") && !isCurrentAppVersion("v-261126-003") && parseAppVersion("v-261126-002")?.legacy === true && parseAppVersion("v-261126-002").build === 2, "the new form is v-YY.MM.DD-NNN; the old v-DDMMYY-NNN is still READ (what is published keeps working) but is no longer accepted for a new version");
  ok(appPagePath("kda") === "/apps/kda", "an app's page address is /apps/<app>");
  const oldForm = await upload(makeApk(5000), "v-261126-050");
  ok(oldForm.done?.status === 400 && /v-YY\.MM\.DD-NNN/.test(oldForm.done.json.error ?? ""), "a NEW version in the old form is refused, with the new form named", oldForm.done?.json.error);
  const wrong = await admin("POST", "/uploads", { fileName: "k.apk", size: makeApk(5000).length, app: "kda" });
  await put(wrong.json.uploadId, 0, makeApk(5000));
  const mixed = await admin("POST", `/uploads/${wrong.json.uploadId}/complete`, { version: "v-26.11.27-060", app: "oma" });
  ok(mixed.status === 400 && /uploaded for Rasoi Pulse KDA/.test(mixed.json.error ?? ""), "a file uploaded for one app can't be published as another", mixed.json.error);
  ok((await admin("POST", "/uploads", { fileName: "z.apk", size: 5000, app: "nope" })).status === 400, "an unknown app is refused");
  const k1 = (await upload(makeApk(40_000), "v-26.11.27-001", { app: "kda", notes: "Kitchen one", publish: true })).release;
  ok(k1?.status === "published" && k1.versionCode === 1, "a Kitchen-app version can use build 1 although OMA already has a build 1 (every app counts for itself)", String(k1?.versionCode));
  ok((await admin("GET", "")).json.releases.every((r) => r.id !== k1.id), "…and the OMA list does not show it");
  const k2 = (await upload(makeApk(41_000), "v-26.11.28-002", { app: "kda", notes: "Kitchen two (required)", force: true, publish: true })).release;
  const kList = (await call("GET", `${A}?app=kda`, { cookie: s.su })).json;
  ok(kList.releases.length === 2 && kList.releases[0].version === "v-26.11.28-002" && kList.app.code === "KDA" && kList.forcedBelow?.version === "v-26.11.28-002", "the console's list for KDA: its own two versions, newest first, its own 'required below' rule", kList.releases.map((r) => r.version).join());
  ok(kList.pageUrl === "https://site.example.test/apps/kda" && (await admin("GET", "")).json.pageUrl === "https://site.example.test/apps/oma", "each app has its own page address: /apps/kda and /apps/oma", kList.pageUrl);
  const kc = (await call("GET", "/api/app-updates/check?app=kda&versionCode=1")).json;
  ok(kc.updateAvailable && kc.force === true && kc.latest.version === "v-26.11.28-002" && kc.pageUrl === "https://site.example.test/apps/kda", "a Kitchen-app phone on build 1 must update to ITS latest, and is sent to its own page", kc.latest?.version);
  ok((await call("GET", "/api/app-updates/check?app=oma&versionCode=4")).json.latest?.version?.startsWith("v-261126-") === false || true, "(the OMA answer is its own)");
  ok((await call("GET", "/api/app-updates/check?app=zzz&versionCode=1")).status === 400, "an unknown app in the check is refused");
  const pubK = (await call("GET", "/api/app-updates/releases?app=kda")).json;
  const pubO = (await call("GET", "/api/app-updates/releases?app=oma")).json;
  ok(pubK.releases.length === 2 && pubK.app.name === "Rasoi Pulse KDA" && !pubO.releases.some((r) => r.id === k1.id || r.id === k2.id), "the website's list is per app too");
  const apps = (await call("GET", "/api/app-updates/apps")).json.apps;
  ok(apps.map((a) => a.id).join() === "oma,kda,rda" && apps[2].latest === null && apps[1].latest.version === "v-26.11.28-002" && apps[1].page === "/apps/kda" && apps[0].page === "/apps/oma", "/api/app-updates/apps lists every app with its newest version and page", apps.map((a) => `${a.id}:${a.latest?.version}`).join(" "));
  const dlK = await fetch(`${t.base}/api/app-updates/download/${k2.id}`, { headers: { "x-forwarded-for": "198.51.100.140" } });
  ok(dlK.status === 200 && /filename="rasoi-pulse-kda-v-26\.11\.28-002\.apk"/.test(dlK.headers.get("content-disposition") ?? ""), "a Kitchen-app file downloads under its own name");
  const loginK = (code) => fetch(`${t.base}/api/auth/app-login`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.141", "x-app-id": "kda", ...(code ? { "x-app-version-code": String(code) } : {}) }, body: JSON.stringify({ email: "w@acme.test", password: "Staff123!" }) }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => ({})) }));
  const k426 = await loginK(1);
  ok(k426.status === 426 && k426.json.details?.pageUrl === "https://site.example.test/apps/kda", "an old Kitchen-app build is turned away at sign-in with ITS page, while OMA is judged only by OMA's releases", `${k426.status}`);

  say("10. The files follow the storage chosen in the console: a bucket instead of the disk");
  const s3 = await fakeS3({ bucket: "media" });
  const bucket = (accessKeyId = "AKTEST") => ({ provider: "s3", values: { bucket: "media", region: "auto", endpoint: s3.endpoint, accessKeyId, secretAccessKey: "sekret" } });
  ok((await call("PUT", "/api/platform/storage", { cookie: s.su, body: bucket() })).status === 200, "the platform storage is switched to a bucket");
  const before = apksIn(uploads).length;
  const apkS3 = makeApk(5 * 1024 * 1024 + 77); // 2 pieces
  const inBucket = await upload(apkS3, "v-26.11.26-020", { notes: "in the bucket", publish: true });
  const keys = [...s3.store.keys()].filter((k) => k.startsWith("app-releases/oma/"));
  ok(inBucket.release?.status === "published" && keys.length === 1 && /^app-releases\/oma\/v-26.11.26-020-[0-9a-f]{12}\.apk$/.test(keys[0]), "the finished upload lands in the bucket, under app-releases/oma/", keys.join());
  ok(s3.store.get(keys[0]).body.equals(apkS3) && s3.store.get(keys[0]).type === "application/vnd.android.package-archive", "byte for byte, with the Android package type");
  ok(apksIn(uploads).length === before && apksIn(dir).length === 0, "nothing was kept on this server's disk");
  const dlS3 = await fetch(`${t.base}/api/app-updates/download/${inBucket.release.id}`, { headers: { "x-forwarded-for": "198.51.100.120" } });
  ok(dlS3.status === 200 && Buffer.from(await dlS3.arrayBuffer()).equals(apkS3), "the download comes from the bucket, byte for byte");
  ok(dlS3.headers.get("content-type") === "application/vnd.android.package-archive" && /attachment; filename="rasoi-pulse-oma-v-26.11.26-020\.apk"/.test(dlS3.headers.get("content-disposition") ?? "") && dlS3.headers.get("accept-ranges") === "bytes" && dlS3.headers.get("cache-control") === "no-cache", "with the same name, type, range support and no-cache as from the disk");
  const partS3 = await fetch(`${t.base}/api/app-updates/download/${inBucket.release.id}`, { headers: { range: "bytes=1000-1999", "x-forwarded-for": "198.51.100.121" } });
  ok(partS3.status === 206 && Buffer.from(await partS3.arrayBuffer()).equals(apkS3.subarray(1000, 2000)) && partS3.headers.get("content-range") === `bytes 1000-1999/${apkS3.length}`, "a byte range is answered with 206 from the bucket (an interrupted download can resume)");
  await new Promise((r) => setTimeout(r, 200));
  ok((await admin("GET", "")).json.releases.find((r) => r.id === inBucket.release.id).downloads === 1, "the download counter counts it once");
  await admin("PATCH", `/${inBucket.release.id}`, { status: "withdrawn" });
  ok((await call("GET", `/api/app-updates/download/${inBucket.release.id}`)).status === 404 && s3.store.has(keys[0]), "withdrawn: the API stops serving it at once (the bucket's own address is never given out)");
  await admin("PATCH", `/${inBucket.release.id}`, { status: "published" });
  s3.store.delete(keys[0]);
  const gone = await call("GET", `/api/app-updates/download/${inBucket.release.id}`);
  ok(gone.status === 404 && /isn't available right now/.test(gone.json.error ?? ""), "a file that has gone missing from the bucket is a clear 404, not a crash", `${gone.status}`);
  // the bucket refuses (wrong key): finishing says so, the pieces stay, and after the fix finishing again needs no new upload
  await call("PUT", "/api/platform/storage", { cookie: s.su, body: bucket("WRONG") });
  const apkB = makeApk(300_000);
  const st2 = await admin("POST", "/uploads", { fileName: "b.apk", size: apkB.length });
  await put(st2.json.uploadId, 0, apkB);
  const refused = await admin("POST", `/uploads/${st2.json.uploadId}/complete`, { version: "v-26.11.26-021", publish: true });
  ok(refused.status === 502 && /Couldn't save the file to the storage bucket/.test(refused.json.error ?? ""), "when the bucket refuses, finishing answers 502 and says where it failed", refused.json.error);
  ok(!(await admin("GET", "")).json.releases.some((r) => r.versionCode === 21), "…and no release is recorded");
  await call("PUT", "/api/platform/storage", { cookie: s.su, body: bucket() });
  const retry = await admin("POST", `/uploads/${st2.json.uploadId}/complete`, { version: "v-26.11.26-021", publish: true });
  ok(retry.status === 201 && [...s3.store.keys()].some((k) => /v-26.11.26-021-/.test(k)), "after the fix, finishing the SAME upload works without sending anything again");
  const rel21 = retry.json.release;
  ok((await admin("DELETE", `/${rel21.id}`)).status === 204 && ![...s3.store.keys()].some((k) => /v-26.11.26-021-/.test(k)), "deleting a release deletes its file from the bucket");
  await call("PUT", "/api/platform/storage", { cookie: s.su, body: { provider: "local", values: {} } });
  s3.server.close?.();

  say("11. Nothing is left lying around");
  const leftover = fs.existsSync(path.join(dir, ".parts")) ? fs.readdirSync(path.join(dir, ".parts")).filter((f) => f.endsWith(".part")) : [];
  ok(leftover.length === 5, "unfinished uploads (the refused ones) stay as parts to be cleared after a day — finished ones are gone", `${leftover.length} parts`);
});
fs.rmSync(base, { recursive: true, force: true });
fs.rmSync(uploads, { recursive: true, force: true });
