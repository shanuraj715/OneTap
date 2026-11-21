// Storage: try a storage without switching it on, count what is stored where, and move the files between this server's
// disk and S3-compatible buckets (a stand-in service plays the bucket). API checks on an in-memory database.
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { fileURLToPath as __f } from "node:url";
import { mkdirSync as __mk } from "node:fs";
const REPO = __f(new URL("../../..", import.meta.url)).replace(/\/$/, "");
const API = `${REPO}/apps/api`;
const PORT = 3084;
const __RUN = __f(new URL("../.bench/suite-run/", import.meta.url));
__mk(__RUN, { recursive: true });
process.chdir(__RUN); // no .env here → the real database URI is never read
const req = createRequire(`${API}/package.json`);
const mms = await import(pathToFileURL(req.resolve("mongodb-memory-server")).href);
const mongod = await (mms.MongoMemoryServer ?? mms.default.MongoMemoryServer).create();
Object.assign(process.env, { NODE_ENV: "development", API_PORT: String(PORT), MONGODB_URI: mongod.getUri(), MONGODB_DB: "sandbox", LOG_LEVEL: "error", RATE_LIMITS: "off", UPLOADS_DIR: ".uploads-storage-test" });
const db = await import(`${REPO}/packages/db/src/index.js`);
await db.connectDb({ uri: mongod.getUri(), dbName: "sandbox" });
const { createApp } = await import(`${API}/src/app.js`);
const server = createApp().listen(PORT);
await new Promise((r) => server.once("listening", r));
const { ensureSuperAdmin } = await import(`${API}/src/modules/auth/auth.service.js`);
await ensureSuperAdmin({ email: "super@sandbox.test", name: "Super", password: "Super123!" });
const schema = await import(`${REPO}/packages/config-schema/src/index.js`);
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

// every database operation the API makes is written down, so a test can say exactly what a request cost
const dbOps = [];
db.mongoose.set("debug", (collection, method) => { dbOps.push(`${collection}.${method}`); });
const cost = async (fn) => { dbOps.length = 0; const r = await fn(); return { r, ops: [...dbOps] }; };

import { mkdirSync, rmSync, writeFileSync, utimesSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createHash, randomUUID } from "node:crypto";

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
const sp = (method, path, body) => call(method, `/api/platform${path}`, { cookie: su, body });

// this suite's own uploads folder (the API is told to use it above), emptied first so the counts are exactly what is made here
const uploadsRoot = join(__RUN, ".uploads-storage-test");
rmSync(uploadsRoot, { recursive: true, force: true });
const uuid = () => randomUUID();
const put = (key, text, ageDays = 0) => {
  const p = join(uploadsRoot, key);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, text);
  if (ageDays) { const t = new Date(Date.now() - ageDays * 86_400_000); utimesSync(p, t, t); }
  return key;
};
const kA1 = `${A.brand}/${A.outlet}/menu-items/${uuid()}.webp`;
const kA2 = `${A.brand}/${A.outlet}/menu-items/${uuid()}.webp`;
const kAlogo = `${A.brand}/store/logos/${uuid()}.png`;
const kB1 = `${B.brand}/${B.outlet}/menu-items/${uuid()}.webp`;
const kUnused = `${A.brand}/${A.outlet}/menu-items/${uuid()}.webp`;
const kBroken = `${B.brand}/${B.outlet}/menu-items/${uuid()}.webp`; // referenced by the database, but the file is nowhere
put(kA1, "picture A one"); put(kA2, "picture A two is a bit longer"); put(kAlogo, "logo"); put(kB1, "picture B");
put(kUnused, "nobody uses me", 3); // older than a day → counts as unused
const sizeOf = (k) => readFileSync(join(uploadsRoot, k)).length;

// the database refers to them the way the app does ("/uploads/<key>" with no domain), plus a picture from another site
const foreign = "https://example.com/not-ours/cat.png";
await raw("menuitems").insertOne({ brandId: A.brand, outletId: A.outlet, name: "Dosa", categoryId: "c", basePrice: 100, images: [{ url: `/uploads/${kA1}`, key: kA1 }, { url: `http://localhost:3072/uploads/${kA2}`, key: kA2 }, { url: foreign, key: "" }] });
await raw("menuitems").insertOne({ brandId: B.brand, outletId: B.outlet, name: "Idli", categoryId: "c", basePrice: 100, images: [{ url: `/uploads/${kB1}`, key: kB1 }, { url: `/uploads/${kBroken}`, key: kBroken }] });
await raw("outlets").updateOne({ _id: oid(A.outlet) }, { $set: { "config.identity.logoUrl": `/uploads/${kAlogo}` } });

const fieldsFor = (s3, extra = {}) => ({ bucket: s3.bucket, region: "auto", endpoint: s3.endpoint, accessKeyId: "AKTEST", secretAccessKey: "sekret", ...extra });
const poll = async (until, ms = 20000) => { const end = Date.now() + ms; let last; while (Date.now() < end) { last = (await sp("GET", "/storage/move")).json.current; if (until(last)) return last; await sleep(150); } return last; };

/* ------------------------------------------------------------------ 1 */
say("1. the S3 signature is the one AWS documents");
{
  const { signedRequest } = await import(`${API}/src/modules/storage/providers/s3.js`);
  const cfg = { bucket: "examplebucket", region: "us-east-1", accessKeyId: "AKIAIOSFODNN7EXAMPLE", secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY" };
  const r = signedRequest(cfg, { method: "GET", key: "", query: { "max-keys": 2, prefix: "J" }, now: new Date("2013-05-24T00:00:00Z") });
  ok(r.headers.Authorization.endsWith("Signature=34b48302e7b5fa45bde8084f4b7868a86f0a534bc59db6670ed5711ef69dc6f7"), "a bucket listing (with a query) is signed exactly like AWS's own worked example");
  ok(r.url === "https://examplebucket.s3.amazonaws.com/?max-keys=2&prefix=J", "…and goes to the right address", r.url);
}

/* ------------------------------------------------------------------ 2 */
say("2. try a storage without switching it on");
const s3 = await fakeS3();
{
  const before = (await sp("GET", "/storage")).json;
  ok(before.provider === "local" && before.saved === false, "to start with, pictures are on this server's disk and nothing is saved");
  let r = await sp("POST", "/storage/test", { provider: "s3", values: fieldsFor(s3) });
  ok(r.status === 200 && r.json.ok === true && r.json.provider === "s3", "typed-in bucket details are tried (and work)", `${r.status} ${JSON.stringify(r.json).slice(0, 160)}`);
  ok(r.json.steps.map((s) => s.id).join() === "write,read,public,delete" && r.json.steps.every((s) => s.ok), "every step is reported: save, read back, open from the public address, delete", r.json.steps?.map((s) => `${s.id}:${s.ok}`).join(" "));
  ok(r.json.publicOk === true && /^http:\/\/127\.0\.0\.1:\d+\/media\/platform\/_probe\//.test(r.json.sampleUrl), "…including that a customer's browser could open it", r.json.sampleUrl);
  ok(s3.store.size === 0, "the test file is deleted again — nothing is left in the bucket");
  const after = (await sp("GET", "/storage")).json;
  ok(after.provider === "local" && after.saved === false, "trying it did NOT switch anything on or save anything");

  r = await sp("POST", "/storage/test", { provider: "s3", values: fieldsFor(s3, { accessKeyId: "WRONG" }) });
  ok(r.status === 200 && r.json.ok === false && r.json.steps[0].id === "write" && /does not exist|access key/i.test(r.json.steps[0].detail), "wrong keys: the first step fails and says what the service answered", r.json.steps?.[0]?.detail);
  ok(r.json.steps.length === 1, "…and nothing else is tried after it");
  r = await sp("POST", "/storage/test", { provider: "s3", values: fieldsFor(s3, { bucket: "nope" }) });
  ok(r.json.ok === false && /bucket/i.test(r.json.steps[0].detail), "a bucket that doesn't exist is named in the answer", r.json.steps?.[0]?.detail);
  r = await sp("POST", "/storage/test", { provider: "s3", values: { bucket: "media" } });
  ok(r.status === 400 && /Fill in/.test(r.json.error), "missing details are asked for by name", r.json.error);

  s3.state.publicRead = false;
  r = await sp("POST", "/storage/test", { provider: "s3", values: fieldsFor(s3) });
  ok(r.json.ok === true && r.json.publicOk === false, "a bucket that takes uploads but isn't public passes the keys test and fails the public one", `ok=${r.json.ok} public=${r.json.publicOk}`);
  ok(/public|403/i.test(r.json.steps.find((s) => s.id === "public").detail), "…with a plain explanation", r.json.steps.find((s) => s.id === "public")?.detail?.slice(0, 120));
  s3.state.publicRead = true;

  r = await sp("POST", "/storage/test", { provider: "local" });
  ok(r.json.ok === true && r.json.provider === "local" && r.json.steps.some((s) => s.id === "write"), "this server's disk can be tried the same way");

  // a saved storage can be tried without typing its secret again
  await sp("PUT", "/storage", { provider: "s3", values: fieldsFor(s3) });
  r = await sp("POST", "/storage/test", { provider: "s3", values: { ...fieldsFor(s3), secretAccessKey: "" } });
  ok(r.json.ok === true, "a blank secret means 'the saved one' when that storage is the one saved");
  r = await sp("POST", "/storage/test", {});
  ok(r.json.ok === true && r.json.label.includes("media"), "with no details it tries what is saved and in use", r.json.label);
  await sp("DELETE", "/storage"); // back to this server's disk
}

/* ------------------------------------------------------------------ 3 */
say("3. what is stored where");
{
  // the bucket already has one of A's files and one file nobody uses
  const kInCloud = `${A.brand}/${A.outlet}/menu-items/${uuid()}.webp`;
  s3.store.set(kInCloud, { body: Buffer.from("already in the cloud"), type: "image/webp", modified: new Date() });
  await raw("menuitems").insertOne({ brandId: A.brand, outletId: A.outlet, name: "Vada", categoryId: "c", basePrice: 100, images: [{ url: s3.endpoint + "/media/" + kInCloud, key: kInCloud }] });
  await sp("PUT", "/storage", { provider: "s3", values: fieldsFor(s3) });
  const r = await sp("POST", "/storage/usage/scan");
  const u = r.json.usage;
  ok(r.status === 200 && u.locations.map((l) => l.id).join() === "local,cloud", "the scan covers this server's disk and the storage in use", u?.locations?.map((l) => l.id).join());
  const local = u.locations.find((l) => l.id === "local");
  ok(local.files === 5 && local.bytes === [kA1, kA2, kAlogo, kB1, kUnused].reduce((n, k) => n + sizeOf(k), 0), "…counting the files and bytes on the disk exactly", `${local.files} files ${local.bytes} B`);
  const cloud = u.locations.find((l) => l.id === "cloud");
  ok(cloud.files === 1 && /media/.test(cloud.label), "…and in the bucket (listed over several pages)", `${cloud.files} ${cloud.label}`);
  ok(u.total.files === 6, "the whole app: every file in every place", String(u.total.files));
  const acme = u.stores.find((s) => s.name === "Acme");
  ok(acme.by.local.files === 4 && acme.by.cloud.files === 1, "per store: Acme has 4 files on the disk and 1 in the bucket", JSON.stringify(acme.by));
  ok(acme.outlets.some((o) => o.name === "Main" && o.by.local.files === 3) && acme.outlets.some((o) => o.id === "store" && o.by.local.files === 1), "per outlet: Main holds its pictures, 'Store-wide files' holds the logo", acme.outlets.map((o) => `${o.name}:${o.by.local?.files ?? 0}`).join(" "));
  ok(u.stores.find((s) => s.name === "Beta").by.local.files === 1, "Beta has 1");
  ok(u.kinds.find((k) => k.kind === "menu-items").by.local.files === 4 && u.kinds.find((k) => k.kind === "logos").by.local.files === 1, "per kind of file: menu pictures and logos");
  ok(u.health.broken === 1 && u.health.brokenExamples[0].key === kBroken && u.health.brokenExamples[0].store === "Beta", "a picture a store uses but that is NOWHERE is reported (and which store)", JSON.stringify(u.health.brokenExamples[0]));
  ok(u.health.unused.local.files === 1 && u.health.unused.local.bytes === sizeOf(kUnused), "a file nothing refers to (older than a day) is counted as unused; a fresh one isn't", JSON.stringify(u.health.unused.local));
  ok(u.health.waiting.files === 5, "files on the disk that are not in the bucket yet are counted (what a move would copy)", JSON.stringify(u.health.waiting));
  ok((await sp("GET", "/storage/usage")).json.usage.scannedAt === u.scannedAt, "the last scan can be read back without scanning again");
  await sp("DELETE", "/storage");
  s3.store.delete(kInCloud);
  await raw("menuitems").deleteOne({ name: "Vada" });
}

/* ------------------------------------------------------------------ 4 */
say("4. moving the files from this server's disk to the bucket");
const linksOf = async (name) => (await raw("menuitems").findOne({ name })).images.map((i) => i.url);
{
  const move = (extra = {}) => sp("POST", "/storage/move", { source: { type: "local" }, target: { type: "s3", values: fieldsFor(s3) }, ...extra });
  let r = await sp("POST", "/storage/move", { source: { type: "local" }, target: { type: "local" } });
  ok(r.status === 400 && /same storage/i.test(r.json.error), "moving a storage onto itself is refused", r.json.error);
  r = await sp("POST", "/storage/move/preview", { source: { type: "local" }, target: { type: "s3", values: { bucket: "media" } } });
  ok(r.status === 400 && /fill in/i.test(r.json.error), "a destination with missing details is refused by name", r.json.error);

  r = await sp("POST", "/storage/move/preview", { source: { type: "local" }, target: { type: "s3", values: fieldsFor(s3) } });
  const p = r.json.preview;
  ok(r.status === 200 && p.plan.files === 5 && p.plan.toCopy === 5 && p.plan.alreadyThere === 0, "the preview says how many files would move", JSON.stringify(p.plan));
  ok(p.linksToUpdate === 4, "…and how many stored picture addresses would be rewritten (4: A's two pictures, A's logo, B's picture)", String(p.linksToUpdate));
  ok(s3.store.size === 0 && (await linksOf("Dosa"))[0] === `/uploads/${kA1}`, "the preview changed nothing");

  r = await move();
  ok(r.status === 202 && r.json.move.status === "running", "starting a move answers at once (it runs in the background)", `${r.status} ${r.json.move?.status}`);
  const busy = await move();
  ok(busy.status === 409, "a second move can't start while one is running", String(busy.status));
  const done = await poll((j) => j && j.status !== "running");
  ok(done.status === "done" && done.stage === "done", "the move finishes", `${done.status} ${done.stage} ${done.error}`);
  ok(done.progress.copied === 5 && done.progress.failed === 0 && done.progress.bytesCopied === [kA1, kA2, kAlogo, kB1, kUnused].reduce((n, k) => n + sizeOf(k), 0), "every file was copied, with the byte count", JSON.stringify(done.progress));
  ok([kA1, kA2, kAlogo, kB1, kUnused].every((k) => s3.store.get(k)?.body.equals(readFileSync(join(uploadsRoot, k)))), "each file in the bucket is identical to the original");
  ok(s3.store.get(kA1).type === "image/webp" && s3.store.get(kAlogo).type === "image/png", "…and has the right content type");
  const links = await linksOf("Dosa");
  ok(links[0] === `${s3.endpoint}/media/${kA1}` && links[1] === `${s3.endpoint}/media/${kA2}`, "the menu pictures now point at the bucket (the old domain-free and old-domain forms alike)", links.join(" | "));
  ok(links[2] === foreign, "a picture from another website is left alone");
  ok((await raw("menuitems").findOne({ name: "Dosa" })).images[0].key === kA1, "the stored keys are unchanged");
  ok((await raw("outlets").findOne({ _id: oid(A.outlet) })).config.identity.logoUrl === `${s3.endpoint}/media/${kAlogo}`, "a logo (any field of any collection) is rewritten too");
  const idli = await linksOf("Idli");
  ok(idli[0] === `${s3.endpoint}/media/${kB1}` && idli[1] === `/uploads/${kBroken}`, "Beta's picture moves; the one whose file doesn't exist is left as it was (nothing to point at)", idli.join(" | "));
  ok(done.progress.linksUpdated === 4 && existsSync(join(uploadsRoot, kA1)), "four addresses were updated and the originals are still on the disk (nothing deleted)");

  // again: nothing is copied twice
  const puts = s3.seen.puts;
  r = await move();
  const again = await poll((j) => j && j.id === r.json.move.id && j.status !== "running");
  ok(again.status === "done" && again.progress.copied === 0 && again.progress.skipped === 5 && s3.seen.puts === puts, "moving again copies nothing (all 5 are already there)", JSON.stringify(again.progress));

  // and clears the disk when asked, but only what is verified in the bucket
  r = await move({ options: { deleteSource: true } });
  const cleaned = await poll((j) => j && j.id === r.json.move.id && j.status !== "running");
  ok(cleaned.status === "done" && cleaned.progress.deleted === 5 && ![kA1, kA2, kAlogo, kB1, kUnused].some((k) => existsSync(join(uploadsRoot, k))), "'delete the old copies' removes the verified files from the disk", JSON.stringify(cleaned.progress));
  ok(s3.store.size === 5, "…and the bucket still has all of them");
}

/* ------------------------------------------------------------------ 5 */
say("5. moving them back, one store at a time, and what goes wrong");
{
  // the bucket → this server's disk, for Beta only
  let r = await sp("POST", "/storage/move", { source: { type: "s3", values: fieldsFor(s3) }, target: { type: "local" }, scope: { brandId: B.brand } });
  const j = await poll((x) => x && x.id === r.json.move.id && x.status !== "running");
  ok(j.status === "done" && j.progress.copied === 1 && existsSync(join(uploadsRoot, kB1)) && !existsSync(join(uploadsRoot, kA1)), "one store only: just Beta's file comes back to the disk", JSON.stringify(j.progress));
  ok(j.scope.brandName === "Beta", "…and the record says which store");
  ok((await linksOf("Idli"))[0] === `/uploads/${kB1}` && (await linksOf("Dosa"))[0] === `${s3.endpoint}/media/${kA1}`, "Beta's address is domain-free again; Acme's still points at the bucket", `${(await linksOf("Idli"))[0]} | ${(await linksOf("Dosa"))[0]}`);

  // a file the bucket refuses
  const bad = `${A.brand}/${A.outlet}/menu-items/${uuid()}.webp`;
  put(bad, "this one cannot be uploaded");
  await raw("menuitems").insertOne({ brandId: A.brand, outletId: A.outlet, name: "Poha", categoryId: "c", basePrice: 100, images: [{ url: `/uploads/${bad}`, key: bad }] });
  s3.fail.add(bad);
  r = await sp("POST", "/storage/move", { source: { type: "local" }, target: { type: "s3", values: fieldsFor(s3) }, options: { deleteSource: true } });
  const e = await poll((x) => x && x.id === r.json.move.id && x.status !== "running");
  ok(e.status === "done_with_errors" && e.progress.failed === 1 && e.failures[0].key === bad && /500|try again/i.test(e.failures[0].error), "a file the bucket refuses is listed with why, and the move says 'done with errors'", `${e.status} ${JSON.stringify(e.failures[0])}`);
  ok(existsSync(join(uploadsRoot, bad)), "…it is NOT deleted from the disk, even though deleting was asked for");
  ok((await linksOf("Poha"))[0] === `/uploads/${bad}`, "…and its address is not rewritten (it still works from the disk)");
  ok(e.progress.copied + e.progress.skipped >= 1 && e.progress.linksUpdated >= 1 && (await linksOf("Idli"))[0] === `${s3.endpoint}/media/${kB1}`, "the other files were linked (and their old copies deleted) regardless of that one failure", `${JSON.stringify(e.progress)} ${(await linksOf("Idli"))[0]}`);
  s3.fail.delete(bad);
  r = await sp("POST", "/storage/move", { source: { type: "local" }, target: { type: "s3", values: fieldsFor(s3) }, options: { deleteSource: true } });
  const retry = await poll((x) => x && x.id === r.json.move.id && x.status !== "running");
  ok(retry.status === "done" && (await linksOf("Poha"))[0] === `${s3.endpoint}/media/${bad}` && !existsSync(join(uploadsRoot, bad)), "starting it again finishes just that file (the rest is skipped)", `${retry.status} ${JSON.stringify(retry.progress)}`);

  // cancel
  for (let i = 0; i < 24; i++) put(`${A.brand}/${A.outlet}/menu-items/${uuid()}.webp`, `bulk ${i}`);
  s3.state.slow = 300;
  r = await sp("POST", "/storage/move", { source: { type: "local" }, target: { type: "s3", values: fieldsFor(s3) } });
  await sleep(700);
  const c = await sp("POST", `/storage/move/${r.json.move.id}/cancel`);
  ok(c.status === 200, "a running move can be cancelled");
  const stopped = await poll((x) => x && x.id === r.json.move.id && x.status !== "running", 15000);
  ok(stopped.status === "cancelled" && stopped.progress.done < 24, "it stops before the end and says 'cancelled'", `${stopped.status} ${stopped.progress.done}`);
  s3.state.slow = 0;

  // a restart while running
  const ghost = (await raw("storagemigrations").insertOne({ status: "running", stage: "copying", source: { label: "x" }, target: { label: "y" }, progress: {}, failures: [], createdAt: new Date(Date.now() - 600_000), updatedAt: new Date(Date.now() - 600_000) })).insertedId;
  await sp("GET", "/storage/move");
  const ghosted = await raw("storagemigrations").findOne({ _id: ghost });
  ok(ghosted.status === "interrupted" && /restarted/.test(ghosted.error), "a move whose server died is marked interrupted, not 'running' for ever", `${ghosted.status}`);

  // moving makes another storage the one in use, when asked
  r = await sp("POST", "/storage/move", { source: { type: "local" }, target: { type: "s3", values: fieldsFor(s3) }, options: { activate: true } });
  await poll((x) => x && x.id === r.json.move.id && x.status !== "running");
  const cfg = (await sp("GET", "/storage")).json;
  ok(cfg.provider === "s3" && cfg.saved === true, "'make it the storage for new uploads' saves the destination as the platform's", `${cfg.provider} saved=${cfg.saved}`);
  ok(cfg.providers.find((x) => x.id === "s3").fields.find((f) => f.key === "bucket").value === "media", "…with its details (the secret stays hidden)");
  // from the storage in use to another bucket
  const other = await fakeS3({ bucket: "backup", accessKey: "AKOTHER" });
  r = await sp("POST", "/storage/move", { source: { type: "active" }, target: { type: "s3", values: { bucket: "backup", region: "auto", endpoint: other.endpoint, accessKeyId: "AKOTHER", secretAccessKey: "x" } } });
  const j2 = await poll((x) => x && x.id === r.json.move.id && x.status !== "running");
  ok(j2.status === "done" && other.store.size === s3.store.size && j2.progress.linksUpdated > 0, "from the storage in use to ANOTHER bucket (S3 → S3)", `${j2.status} ${other.store.size} vs ${s3.store.size} ${JSON.stringify(j2.progress)}`);
  ok((await linksOf("Dosa"))[0] === `${other.endpoint}/backup/${kA1}`, "the addresses follow the files to the other bucket", (await linksOf("Dosa"))[0]);
  const hist = (await sp("GET", "/storage/move")).json;
  ok(hist.current && hist.history.length >= 3, "the page can show the latest move and the earlier ones", String(hist.history?.length));
  await other.close();
}

await s3.close();
console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
await new Promise((r) => server.close(r));
rmSync(uploadsRoot, { recursive: true, force: true });
await mongod.stop();
process.exit(fail ? 1 : 0);
