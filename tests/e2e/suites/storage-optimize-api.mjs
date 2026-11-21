// Optimize pictures: find the pictures the stores use that are bigger than the size limit, compress the chosen ones with the
// saved compression settings, and make every stored address follow. Real pictures are made with sharp and compressed by the real
// pipeline; a stand-in S3 service plays a bucket. API checks on an in-memory database.
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { fileURLToPath as __f } from "node:url";
import { mkdirSync as __mk } from "node:fs";
const REPO = __f(new URL("../../..", import.meta.url)).replace(/\/$/, "");
const API = `${REPO}/apps/api`;
const PORT = 3107;
const __RUN = __f(new URL("../.bench/suite-run/", import.meta.url));
__mk(__RUN, { recursive: true });
process.chdir(__RUN); // no .env here → the real database URI is never read
const req = createRequire(`${API}/package.json`);
const mms = await import(pathToFileURL(req.resolve("mongodb-memory-server")).href);
const sharp = (await import(pathToFileURL(req.resolve("sharp")).href)).default;
const mongod = await (mms.MongoMemoryServer ?? mms.default.MongoMemoryServer).create();
Object.assign(process.env, { NODE_ENV: "development", API_PORT: String(PORT), MONGODB_URI: mongod.getUri(), MONGODB_DB: "sandbox", LOG_LEVEL: "error", RATE_LIMITS: "off", UPLOADS_DIR: ".uploads-optimize-test" });
const db = await import(`${REPO}/packages/db/src/index.js`);
await db.connectDb({ uri: mongod.getUri(), dbName: "sandbox" });
const { createApp } = await import(`${API}/src/app.js`);
const server = createApp().listen(PORT);
await new Promise((r) => server.once("listening", r));
const { ensureSuperAdmin } = await import(`${API}/src/modules/auth/auth.service.js`);
await ensureSuperAdmin({ email: "super@sandbox.test", name: "Super", password: "Super123!" });
const schema = await import(`${REPO}/packages/config-schema/src/index.js`);
const links = await import(`${API}/src/modules/storage/storage-links.js`);
const raw = (c) => db.mongoose.connection.db.collection(c);
const oid = (s) => new db.mongoose.Types.ObjectId(String(s));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const base = `http://127.0.0.1:${PORT}`;
const call = async (method, path, { body, cookie, headers = {} } = {}) => {
  const r = await fetch(base + path, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text(); let json = {}; try { json = JSON.parse(text); } catch {}
  return { status: r.status, json, headers: r.headers };
};
const login = async (email, password) => (await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) })).headers.get("set-cookie")?.split(";")[0];
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const say = (s) => console.log(`\n=== ${s}`);
await db.WalletLedgerModel.init();
const must = async (p, what) => { const r = await p; if (r.status >= 400) { console.error("SETUP FAILED", what, r.status, JSON.stringify(r.json).slice(0, 300)); process.exit(1); } return r; };

import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { fakeS3 } from "../bench/fake-s3.mjs";

/* ------------------------------------------------------------------ setup */
const su = await login("super@sandbox.test", "Super123!");
const idOf = (o) => String(o?._id ?? o?.id);
const plan = idOf((await must(call("POST", "/api/platform/plans", { cookie: su, body: { name: "Everything", entitlements: { features: schema.FEATURE_KEYS } } }), "plan")).json.plan);
const mkStore = async (name, slug, host, email) => {
  const j = (await must(call("POST", "/api/brands", { cookie: su, body: { brandName: name, brandSlug: slug, outletName: "Main", outletSlug: "main", hostnames: [host], ownerEmail: email, ownerName: "Owner", ownerPassword: "Owner123!", planId: plan } }), name)).json;
  return { brand: String(j.brand?._id ?? j.brand?.id ?? j.brandId), outlet: String(j.outlet?._id ?? j.outlet?.id ?? j.outletId), name };
};
const A = await mkStore("Acme", "acme", "acme.test", "o@acme.test");
const B = await mkStore("Beta", "beta", "beta.test", "o@beta.test");
const owner = await login("o@acme.test", "Owner123!");
const sp = (method, path, body) => call(method, `/api/platform${path}`, { cookie: su, body });

const uploadsRoot = join(__RUN, ".uploads-optimize-test");
rmSync(uploadsRoot, { recursive: true, force: true });
const uuid = () => randomUUID();
const noisy = (w, h, sigma = 40) => sharp({ create: { width: w, height: h, channels: 3, background: "#808080", noise: { type: "gaussian", mean: 128, sigma } } });
const bigJpeg = await noisy(1200, 900).jpeg({ quality: 95 }).toBuffer(); // ~900 KB
const bigPng = await noisy(800, 800, 25).png().toBuffer(); // ~1.6 MB
const smallWebp = await noisy(64, 64).webp({ quality: 70 }).toBuffer(); // a few KB
const lowJpeg = await noisy(640, 480).jpeg({ quality: 10 }).toBuffer(); // ~10 KB, already squeezed hard: re-encoding it can only make it bigger
const junk = randomBytes(400 * 1024); // "a picture" that isn't one
const disk = (key) => join(uploadsRoot, key);
const put = (key, body) => { mkdirSync(dirname(disk(key)), { recursive: true }); writeFileSync(disk(key), body); return key; };
const onDisk = (key) => existsSync(disk(key));
const sizeOf = (key) => statSync(disk(key)).size;

const kBig1 = put(`${A.brand}/${A.outlet}/menu-items/${uuid()}.jpg`, bigJpeg);
const kBig2 = put(`${A.brand}/store/logos/${uuid()}.png`, bigPng);
const kBig3 = put(`${B.brand}/${B.outlet}/menu-items/${uuid()}.jpg`, bigJpeg);
const kSmall = put(`${A.brand}/${A.outlet}/menu-items/${uuid()}.webp`, smallWebp);
const kOrphan = put(`${A.brand}/${A.outlet}/menu-items/${uuid()}.jpg`, bigJpeg); // big, but nothing uses it
const kChat = put(`${A.brand}/${A.outlet}/whatsapp/${uuid()}.jpg`, bigJpeg); // a chat attachment: kept exactly as sent
const kJunk = put(`${A.brand}/${A.outlet}/menu-items/${uuid()}.jpg`, junk);
const kLow = put(`${B.brand}/${B.outlet}/menu-items/${uuid()}.jpg`, lowJpeg);
const foreign = "https://example.com/not-ours/cat.png";

await raw("menuitems").insertOne({ brandId: A.brand, outletId: A.outlet, name: "Dosa", categoryId: "c", basePrice: 100, images: [{ url: `/uploads/${kBig1}`, key: kBig1, width: 1200, height: 900 }, { url: foreign, key: "" }] });
await raw("menuitems").insertOne({ brandId: A.brand, outletId: A.outlet, name: "Vada", categoryId: "c", basePrice: 100, images: [{ url: `/uploads/${kSmall}`, key: kSmall, width: 64, height: 64 }, { url: `/uploads/${kJunk}`, key: kJunk }] });
await raw("menuitems").insertOne({ brandId: B.brand, outletId: B.outlet, name: "Idli", categoryId: "c", basePrice: 100, images: [{ url: `/uploads/${kBig3}`, key: kBig3, width: 1200, height: 900 }, { url: `/uploads/${kLow}`, key: kLow, width: 640, height: 480 }] });
await raw("outlets").updateOne({ _id: oid(A.outlet) }, { $set: { "config.identity.logoUrl": `http://localhost:3072/uploads/${kBig2}` } }); // saved from another address once
await raw("whatsappmessages").insertOne({ brandId: A.brand, media: { url: `/uploads/${kChat}` } });

const itemOf = async (name) => raw("menuitems").findOne({ name });
const logoOf = async () => (await raw("outlets").findOne({ _id: oid(A.outlet) })).config.identity.logoUrl;
const snapshot = async () => createHash("sha1").update(JSON.stringify([await raw("menuitems").find({}).sort({ name: 1 }).toArray(), await raw("outlets").find({}).sort({ _id: 1 }).toArray()])).digest("hex");
const setProcessing = (p) => sp("PUT", "/storage", { processing: { maxDimension: 800, quality: 70, format: "webp", targetMaxKB: 250, ...p } });
const scan = async () => (await sp("POST", "/storage/optimize/scan")).json.scan;
const job = async () => (await sp("GET", "/storage/optimize")).json.current;
const poll = async (until, ms = 30000) => { const end = Date.now() + ms; let last; while (Date.now() < end) { last = await job(); if (until(last)) return last; await sleep(150); } return last; };
const optimize = async (keys, options) => {
  const r = await sp("POST", "/storage/optimize", { keys, ...(options ? { options } : {}) });
  if (r.status !== 202) return { r };
  return { r, done: await poll((x) => x && x.id === r.json.job.id && x.status !== "running") };
};
const LIMIT = 250 * 1024;

/* ------------------------------------------------------------------ 1 */
say("1. nothing to show before a scan, and only the platform's super admin can use it");
{
  let r = await sp("GET", "/storage/optimize/scan");
  ok(r.status === 200 && r.json.scan === null, "before any scan there is no list");
  r = await sp("POST", "/storage/optimize", { all: true });
  ok(r.status === 409 && /scan first/i.test(r.json.error?.message ?? r.json.message ?? JSON.stringify(r.json)), "optimizing without a scan is refused: 'scan first'", `${r.status}`);
  for (const [m, p] of [["GET", "/storage/optimize"], ["GET", "/storage/optimize/scan"], ["POST", "/storage/optimize/scan"], ["POST", "/storage/optimize"]]) {
    const x = await call(m, `/api/platform${p}`, { cookie: owner, body: m === "POST" ? { all: true } : undefined });
    ok(x.status === 403 || x.status === 401, `a store owner can't use ${m} ${p}`, String(x.status));
  }
  const anon = await call("POST", "/api/platform/storage/optimize/scan");
  ok(anon.status === 401, "nor can someone who isn't signed in", String(anon.status));
}

/* ------------------------------------------------------------------ 2 */
say("2. the scan lists the pictures the stores use that are over the size limit — and changes nothing");
await setProcessing({});
let listed;
{
  const before = await snapshot();
  const sizes = Object.fromEntries([kBig1, kBig2, kBig3, kSmall, kOrphan, kChat, kJunk, kLow].map((k) => [k, sizeOf(k)]));
  const s = await scan();
  listed = s;
  ok(s && !s.noLimit && s.limitBytes === LIMIT, "it uses the size limit saved in Image compression (250 KB)", `${s?.limitBytes}`);
  const keys = s.pictures.map((p) => p.key);
  ok(keys.length === 4 && [kBig1, kBig2, kBig3, kJunk].every((k) => keys.includes(k)), "exactly the 4 used pictures over the limit are listed", keys.length + " listed");
  ok(![kSmall, kLow].some((k) => keys.includes(k)), "pictures under the limit are not listed");
  ok(!keys.includes(kOrphan), "a big file that nothing uses is not listed (it isn't shown to anyone)");
  ok(!keys.includes(kChat), "a chat attachment is not listed (those are kept exactly as they were sent)");
  ok(s.pictures.every((p, i, a) => i === 0 || a[i - 1].size >= p.size), "the biggest come first");
  ok(s.pictures[0].key === kBig2 && s.pictures[0].size === sizes[kBig2], "…starting with the 1.6 MB logo", `${s.pictures[0].size}`);
  const p1 = s.pictures.find((p) => p.key === kBig1);
  ok(p1.brandName === "Acme" && p1.outletName === "Main" && p1.kind === "menu-items" && p1.where === "local", "each picture says its store, outlet, kind and where it is", JSON.stringify({ b: p1.brandName, o: p1.outletName, k: p1.kind, w: p1.where }));
  const p2 = s.pictures.find((p) => p.key === kBig2);
  ok(p2.outletName === "Store-wide" && p2.kind === "logos", "a logo belongs to the store, not to an outlet", `${p2.outletName}/${p2.kind}`);
  ok(s.pictures.every((p) => p.url.endsWith(`/uploads/${p.key}`)), "each has an address the grid can show");
  const shown = await fetch(p1.url.replace(/^https?:\/\/[^/]+/, base));
  ok(shown.status === 200 && (await shown.arrayBuffer()).byteLength === sizes[kBig1], "…and it really opens", String(shown.status));
  ok(s.over.files === 4 && s.over.bytes === keys.reduce((n, k) => n + sizes[k], 0), "totals: how many are over and how big they are together", `${s.over.files} / ${s.over.bytes}`);
  ok(s.atLeastFrees === keys.reduce((n, k) => n + sizes[k] - LIMIT, 0), "'will free at least' = what each loses to get down to the limit", String(s.atLeastFrees));
  ok(s.checked.files === 6, "pictures in use: 6 (the other two files aren't used by anyone / are chat files)", String(s.checked.files));
  ok(s.processing.maxDimension === 800 && s.processing.format === "webp" && s.processing.quality === 70, "the settings it will use are shown");
  ok((await snapshot()) === before && [kBig1, kBig2, kBig3, kSmall, kOrphan, kChat, kJunk, kLow].every((k) => sizeOf(k) === sizes[k]), "looking changed nothing: not a file, not a stored address");
  const again = await sp("GET", "/storage/optimize/scan");
  ok(again.json.scan?.pictures?.length === 4 && again.json.scan.scannedAt === s.scannedAt, "the page can ask for the last scan again without scanning");
}

/* ------------------------------------------------------------------ 3 */
say("3. no size limit set → nothing counts as too big; and only listed pictures can be chosen");
{
  await setProcessing({ targetMaxKB: 0 });
  const s = await scan();
  ok(s.noLimit === true && s.pictures.length === 0, "with no 'Target max size' the scan says so and lists nothing");
  const r = await sp("POST", "/storage/optimize", { all: true });
  ok(r.status === 409, "…and nothing can be started", String(r.status));
  await setProcessing({});
  await scan();
  const bad = await sp("POST", "/storage/optimize", { keys: [kSmall, kOrphan, "../../etc/passwd", `${A.brand}/x/y/${uuid()}.jpg`] });
  ok(bad.status === 400, "a picture the scan didn't list (small, unused, or just a name made up) can't be optimized", String(bad.status));
  const none = await sp("POST", "/storage/optimize", { keys: [] });
  ok(none.status === 400, "choosing nothing is refused", String(none.status));
  ok(onDisk(kSmall) && onDisk(kOrphan), "…and the files are still there");
}

/* ------------------------------------------------------------------ 4 */
say("4. optimizing: compressed with the saved settings, the addresses follow, the big originals go");
let newItemKey, newLogoKey;
{
  const { r, done } = await optimize([kBig1, kBig2]);
  ok(r.status === 202 && r.json.job.status === "running", "starting answers at once and works in the background");
  ok(done.status === "done" && done.progress.optimized === 2 && done.progress.failed === 0 && done.progress.unchanged === 0, "the job finishes by itself: 2 optimized, none failed", JSON.stringify(done.progress));
  ok(done.progress.bytesAfter < done.progress.bytesBefore * 0.25 && done.progress.bytesBefore === bigJpeg.length + bigPng.length, "the pictures went from ~2.5 MB to a fraction of it", `${done.progress.bytesBefore} → ${done.progress.bytesAfter}`);
  ok(done.progress.linksUpdated === 5 && done.progress.deleted === 2, "5 stored values were updated (address, key, width, height of the dish picture + the logo) and the 2 big originals deleted", `${done.progress.linksUpdated} / ${done.progress.deleted}`);

  const dosa = await itemOf("Dosa");
  const img = dosa.images[0];
  newItemKey = img.key;
  ok(newItemKey !== kBig1 && newItemKey.startsWith(`${A.brand}/${A.outlet}/menu-items/`) && newItemKey.endsWith(".webp"), "the dish picture is a NEW file (new name, so no cache shows the old one) in the same folder, as WebP", newItemKey);
  ok(img.url === `/uploads/${newItemKey}`, "its stored address is the new one, still without a domain", img.url);
  ok(img.width === 800 && img.height === 600, "its width/height now describe the new picture (800 × 600)", `${img.width}×${img.height}`);
  ok(dosa.images[1].url === foreign && dosa.images[1].key === "", "a picture from another website is left alone");
  const logo = await logoOf();
  newLogoKey = logo.replace("/uploads/", "");
  ok(logo.startsWith("/uploads/") && !logo.includes("://") && logo.endsWith(".webp") && newLogoKey.startsWith(`${A.brand}/store/logos/`), "the logo's address (saved long ago with another domain) is now the new file, in the stored form", logo);
  ok(!onDisk(kBig1) && !onDisk(kBig2), "the big originals are gone from the disk");
  const meta = await sharp(disk(newItemKey)).metadata();
  ok(onDisk(newItemKey) && sizeOf(newItemKey) <= LIMIT && meta.format === "webp" && meta.width === 800, "the new file is a real 800 px WebP under the limit", `${sizeOf(newItemKey)} B ${meta.format} ${meta.width}`);
  ok(onDisk(newLogoKey) && sizeOf(newLogoKey) <= LIMIT, "so is the logo", `${sizeOf(newLogoKey)} B`);
  const shown = await fetch(`${base}/uploads/${newItemKey}`);
  ok(shown.status === 200 && shown.headers.get("content-type") === "image/webp", "…and it opens from its new address as image/webp", `${shown.status} ${shown.headers.get("content-type")}`);
  const idli = await itemOf("Idli");
  ok(idli.images[0].url === `/uploads/${kBig3}` && onDisk(kBig3), "a picture that wasn't chosen was not touched");
  const s = await scan();
  ok(s.pictures.length === 2 && !s.pictures.some((p) => p.key === kBig1 || p.key === kBig2), "after it, those two are no longer on the list", String(s.pictures.length));
  const st = (await sp("GET", "/storage/optimize")).json;
  ok(st.current.id === done.id && st.current.plan.files === 2, "the page can show the finished job");
}

/* ------------------------------------------------------------------ 5 */
say("5. 'keep the originals' keeps them");
{
  const { done } = await optimize([kBig3], { deleteOriginals: false });
  ok(done.status === "done" && done.progress.optimized === 1 && done.progress.deleted === 0, "optimized, nothing deleted", JSON.stringify(done.progress));
  const idli = await itemOf("Idli");
  ok(idli.images[0].key !== kBig3 && idli.images[0].url === `/uploads/${idli.images[0].key}` && onDisk(idli.images[0].key), "the store uses the new, small file");
  ok(onDisk(kBig3) && sizeOf(kBig3) === bigJpeg.length, "the original is still on the disk (it keeps using the space)");
  const s = await scan();
  ok(!s.pictures.some((p) => p.key === kBig3), "…and since nothing uses it any more it isn't offered again");
}

/* ------------------------------------------------------------------ 6 */
say("6. a file that isn't a picture is reported and left exactly as it was");
{
  const dayBefore = await itemOf("Vada");
  const { done } = await optimize([kJunk]);
  ok(done.status === "done_with_errors" && done.progress.failed === 1 && done.progress.optimized === 0, "the job says it finished with problems", `${done.status} ${JSON.stringify(done.progress)}`);
  ok(done.failures.length === 1 && done.failures[0].key === kJunk && /isn't an image/i.test(done.failures[0].error), "the problem names the file and says why", JSON.stringify(done.failures[0]));
  ok(onDisk(kJunk) && sizeOf(kJunk) === junk.length && JSON.stringify((await itemOf("Vada")).images) === JSON.stringify(dayBefore.images), "the file and the address are untouched");
}

/* ------------------------------------------------------------------ 7 */
say("7. a store owner's edit made while this runs is never overwritten");
{
  const kRace = put(`${A.brand}/${A.outlet}/menu-items/${uuid()}.jpg`, bigJpeg);
  const newKey = `${A.brand}/${A.outlet}/menu-items/${uuid()}.webp`;
  await raw("menuitems").insertOne({ brandId: A.brand, outletId: A.outlet, name: "Uttapam", categoryId: "c", basePrice: 100, images: [{ url: `/uploads/${kRace}`, key: kRace, width: 1200, height: 900 }] });
  const rep = new Map([[kRace, { key: newKey, url: `/uploads/${newKey}`, forms: { local: true, bases: [] }, width: 800, height: 600 }]]);
  const { changes } = await links.planKeyReplacements({ replacements: rep });
  ok(changes.length === 4 && changes.every((c) => c.collection === "menuitems"), "the plan is: address, key, width, height of that one picture", `${changes.length}`);
  await raw("menuitems").updateOne({ name: "Uttapam" }, { $set: { "images.0.url": "/uploads/someone-elses-new-choice.webp" } }); // the owner changes the picture meanwhile
  let r = await links.applyChangesIfUnchanged(changes);
  const now = await itemOf("Uttapam");
  ok(r.changed === 0 && r.skipped === 1 && now.images[0].url === "/uploads/someone-elses-new-choice.webp" && now.images[0].key === kRace, "that document is left alone — their change stays, nothing half-written", JSON.stringify(r));
  await raw("menuitems").updateOne({ name: "Uttapam" }, { $set: { "images.0.url": `/uploads/${kRace}` } });
  r = await links.applyChangesIfUnchanged(changes);
  const done = await itemOf("Uttapam");
  ok(r.changed === 4 && done.images[0].key === newKey && done.images[0].width === 800, "with nothing changed in between, it is applied", JSON.stringify(r));
  await raw("menuitems").deleteOne({ name: "Uttapam" });
}

/* ------------------------------------------------------------------ 8 */
say("8. one run at a time, and it never runs together with a move");
{
  const fakeRunning = (extra = {}) => raw("storageoptimizes").insertOne({ status: "running", stage: "reading", options: {}, processing: {}, plan: { files: 1 }, progress: {}, failures: [], cancelRequested: false, createdAt: new Date(), updatedAt: new Date(), ...extra });
  await scan();
  const live = await fakeRunning();
  let r = await sp("POST", "/storage/optimize", { all: true });
  ok(r.status === 409, "while one runs, another can't be started", String(r.status));
  const c = await sp("POST", `/storage/optimize/${live.insertedId}/cancel`);
  ok(c.status === 200 && c.json.current.cancelRequested === true, "cancel asks the running job to stop", String(c.json.current?.cancelRequested));
  ok((await sp("POST", `/storage/optimize/${oid("0".repeat(24))}/cancel`)).status === 404, "cancelling something that isn't running says so");
  await raw("storageoptimizes").deleteOne({ _id: live.insertedId });

  const mv = await raw("storagemigrations").insertOne({ status: "running", stage: "copying", source: {}, target: {}, scope: {}, options: {}, plan: {}, progress: {}, failures: [], createdAt: new Date(), updatedAt: new Date() });
  r = await sp("POST", "/storage/optimize", { all: true });
  ok(r.status === 409 && /moved/i.test(JSON.stringify(r.json)), "while files are being moved, optimizing is refused", String(r.status));
  await raw("storagemigrations").deleteOne({ _id: mv.insertedId });

  const opt = await fakeRunning();
  const s3x = await fakeS3({ bucket: "tmp", accessKey: "AKTMP" });
  r = await sp("POST", "/storage/move", { source: { type: "local" }, target: { type: "s3", values: { bucket: "tmp", region: "auto", endpoint: s3x.endpoint, accessKeyId: "AKTMP", secretAccessKey: "x" } } });
  ok(r.status === 409 && /optimized/i.test(JSON.stringify(r.json)), "…and while pictures are being optimized, a move is refused", String(r.status));
  await s3x.close();
  await raw("storageoptimizes").deleteOne({ _id: opt.insertedId });

  const dead = await fakeRunning({ updatedAt: new Date(Date.now() - 5 * 60_000) });
  const st = (await sp("GET", "/storage/optimize")).json.current;
  ok(String(st.id) === String(dead.insertedId) && st.status === "interrupted" && /restarted/.test(st.error), "a job whose server died is marked interrupted, not 'running' for ever", st.status);
  await raw("storageoptimizes").deleteOne({ _id: dead.insertedId });
}

/* ------------------------------------------------------------------ 9 */
say("9. a picture that can't get smaller is left alone and not offered again");
{
  await setProcessing({ format: "original", targetMaxKB: Math.max(1, Math.floor(lowJpeg.length / 1024) - 2) });
  const s = await scan();
  ok(s.pictures.some((p) => p.key === kLow), "with a tighter limit the already-squeezed picture is over it", `limit ${s.limitBytes}, file ${lowJpeg.length}`);
  const dayBefore = await snapshot();
  const { done } = await optimize([kLow]);
  ok(done.status === "done" && done.progress.unchanged === 1 && done.progress.optimized === 0, "re-compressing it would make it BIGGER, so it is counted as 'already as small as possible'", JSON.stringify(done.progress));
  ok(onDisk(kLow) && sizeOf(kLow) === lowJpeg.length && (await snapshot()) === dayBefore, "the file and the addresses are untouched");
  const again = await scan();
  ok(!again.pictures.some((p) => p.key === kLow) && again.settled >= 1, "the next scan doesn't list it again (it says how many it skipped)", `settled ${again.settled}`);
  await setProcessing({ format: "original", targetMaxKB: Math.max(1, Math.floor(lowJpeg.length / 1024) - 3) });
  ok((await scan()).pictures.some((p) => p.key === kLow), "…until the compression settings change: then it may get smaller, so it is offered again");
  await setProcessing({});
}

/* ------------------------------------------------------------------ 10 */
say("10. with a bucket (Cloudflare R2 / S3) in use, pictures there are optimized there");
const s3 = await fakeS3();
{
  const fields = { bucket: s3.bucket, region: "auto", endpoint: s3.endpoint, accessKeyId: "AKTEST", secretAccessKey: "sekret" };
  await sp("PUT", "/storage", { provider: "s3", values: fields });
  await setProcessing({});
  const kCloud = `${B.brand}/${B.outlet}/menu-items/${uuid()}.jpg`;
  s3.store.set(kCloud, { body: bigJpeg, type: "image/jpeg", modified: new Date() });
  await raw("menuitems").insertOne({ brandId: B.brand, outletId: B.outlet, name: "Poha", categoryId: "c", basePrice: 100, images: [{ url: `${s3.endpoint}/${s3.bucket}/${kCloud}`, key: kCloud, width: 1200, height: 900 }] });
  const s = await scan();
  const pc = s.pictures.find((p) => p.key === kCloud);
  ok(pc && pc.where === "cloud" && pc.url === `${s3.endpoint}/${s3.bucket}/${kCloud}`, "the picture in the bucket is listed as being in the cloud, with its bucket address", pc?.where);
  ok(/media/.test(s.storage), "the scan says which storage it looked at", s.storage);
  ok(s.pictures.some((p) => p.key === kJunk && p.where === "local"), "pictures still on this server's disk are listed too, as being on the disk");
  const { done } = await optimize([kCloud]);
  ok(done.status === "done" && done.progress.optimized === 1 && done.progress.deleted === 1, "optimized in the bucket and the big original deleted from it", JSON.stringify(done.progress));
  const item = await itemOf("Poha");
  const nk = item.images[0].key;
  ok(nk !== kCloud && s3.store.has(nk) && !s3.store.has(kCloud), "the bucket now holds the new file and not the old one", nk);
  ok(item.images[0].url === `${s3.endpoint}/${s3.bucket}/${nk}` && item.images[0].width === 800, "the address is the new bucket address", item.images[0].url);
  ok(s3.store.get(nk).body.length <= LIMIT && s3.store.get(nk).type === "image/webp", "it is a small WebP with the right content type", `${s3.store.get(nk).body.length} B ${s3.store.get(nk).type}`);
  await sp("DELETE", "/storage");
}

await s3.close();
console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
await new Promise((r) => server.close(r));
rmSync(uploadsRoot, { recursive: true, force: true });
await mongod.stop();
process.exit(fail ? 1 : 0);
