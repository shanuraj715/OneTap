// Picture compression on upload — API checks against an in-memory database (nothing real is touched).
// Real image files are made here with sharp (a very high-quality photo, a rotated phone photo, a picture with
// hidden metadata, a transparent logo, a pixel bomb…), uploaded through POST /api/storage/upload, and the stored
// file is fetched back and inspected.
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { fileURLToPath as __f } from "node:url";
import { mkdirSync as __mk } from "node:fs";
const REPO = __f(new URL("../../..", import.meta.url)).replace(/\/$/, "");
const API = `${REPO}/apps/api`;
const PORT = 3092;
const __RUN = __f(new URL("../.bench/suite-run/", import.meta.url));
__mk(__RUN, { recursive: true });
process.chdir(__RUN); // no .env here → the real database URI is never read
const req = createRequire(`${API}/package.json`);
const mms = await import(pathToFileURL(req.resolve("mongodb-memory-server")).href);
const mongod = await (mms.MongoMemoryServer ?? mms.default.MongoMemoryServer).create();
Object.assign(process.env, { NODE_ENV: "development", API_PORT: String(PORT), MONGODB_URI: mongod.getUri(), MONGODB_DB: "sandbox", LOG_LEVEL: "error", RATE_LIMITS: "off" });
const db = await import(`${REPO}/packages/db/src/index.js`);
await db.connectDb({ uri: mongod.getUri(), dbName: "sandbox" });
const { createApp } = await import(`${API}/src/app.js`);
const server = createApp().listen(PORT);
await new Promise((r) => server.once("listening", r));
const { ensureSuperAdmin } = await import(`${API}/src/modules/auth/auth.service.js`);
await ensureSuperAdmin({ email: "super@sandbox.test", name: "Super", password: "Super123!" });
const sharp = (await import(pathToFileURL(req.resolve("sharp")).href)).default;
const { DEFAULT_IMAGE_PROCESSING } = await import(`${REPO}/packages/config-schema/src/index.js`);

const base = `http://127.0.0.1:${PORT}`;
const call = async (method, path, { body, cookie, outlet } = {}) => {
  const r = await fetch(base + path, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...(outlet ? { "x-rasoipulse-outlet": outlet } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text(); let json = {}; try { json = JSON.parse(text); } catch {}
  return { status: r.status, json };
};
const login = async (email, password) => (await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const say = (s) => console.log(`\n=== ${s}`);
const must = async (p, what) => { const r = await p; if (r.status >= 400) { console.error("SETUP FAILED", what, r.status, JSON.stringify(r.json).slice(0, 300)); process.exit(1); } return r; };
const kb = (n) => `${Math.round(n / 1024)} KB`;

/* ------------------------------------------------------------------ setup */
const su = await login("super@sandbox.test", "Super123!");
const made = (await must(call("POST", "/api/brands", { cookie: su, body: { brandName: "Acme", brandSlug: "acme", outletName: "Main", outletSlug: "main", hostnames: ["acme.test"], ownerEmail: "o@acme.test", ownerName: "Owner", ownerPassword: "Owner123!" } }), "brand")).json;
const outlet = String(made.outlet?._id ?? made.outlet?.id ?? made.outletId);
const owner = await login("o@acme.test", "Owner123!");
await must(call("POST", "/api/users", { cookie: owner, outlet, body: { email: "k@acme.test", name: "Kitchen", password: "Password123!", role: "kitchen" } }), "kitchen");
const kitchen = await login("k@acme.test", "Password123!");

const upload = async (buf, { cookie = owner, o = outlet, kind = "menu-items" } = {}) => {
  const t = Date.now();
  const r = await fetch(`${base}/api/storage/upload?kind=${kind}`, { method: "POST", headers: { "content-type": "application/octet-stream", ...(cookie ? { cookie } : {}), ...(o ? { "x-rasoipulse-outlet": o } : {}) }, body: buf });
  const text = await r.text(); let json = {}; try { json = JSON.parse(text); } catch {}
  return { status: r.status, json, ms: Date.now() - t };
};
/** the stored file, as a visitor's browser would fetch it */
const stored = async (url) => {
  const r = await fetch(`${base}${new URL(url).pathname}`);
  const buf = Buffer.from(await r.arrayBuffer());
  return { status: r.status, type: r.headers.get("content-type"), buf, meta: r.ok ? await sharp(buf).metadata() : null };
};
const noisy = (w, h, sigma) => sharp({ create: { width: w, height: h, channels: 3, background: "#808080", noise: { type: "gaussian", mean: 128, sigma } } });
const TARGET = DEFAULT_IMAGE_PROCESSING.targetMaxKB * 1024;
const MAXEDGE = DEFAULT_IMAGE_PROCESSING.maxDimension;

/* ------------------------------------------------------------------ 1 */
say("1. a very high-quality photo is made small");
const photo = await noisy(6000, 4000, 40).jpeg({ quality: 95 }).toBuffer();
let r = await upload(photo);
ok(r.status === 201, "a 24-megapixel JPEG at quality 95 (about 19 MB) is accepted", `${r.status} ${kb(photo.length)}`);
const out1 = await stored(r.json.url);
ok(out1.status === 200 && out1.type === "image/webp", "the stored file is WebP and can be fetched from its address", `${out1.status} ${out1.type}`);
ok(out1.buf.length <= TARGET && out1.buf.length < photo.length / 20, `it is now ${kb(out1.buf.length)} — under the ${kb(TARGET)} target and at least 20 times smaller than the original`, `${kb(photo.length)} → ${kb(out1.buf.length)}`);
ok(Math.max(out1.meta.width, out1.meta.height) === MAXEDGE && out1.meta.width === 1600 && out1.meta.height === 1067, `scaled down to ${MAXEDGE} px on the long side, keeping the shape`, `${out1.meta.width}x${out1.meta.height}`);
ok(r.json.width === out1.meta.width && r.json.height === out1.meta.height && r.json.bytes === out1.buf.length && r.json.originalBytes === photo.length, "the answer reports the real final size, bytes and the original's bytes", JSON.stringify({ w: r.json.width, h: r.json.height, bytes: r.json.bytes }));
ok(r.json.key.startsWith(`${made.brand?._id ?? made.brand?.id ?? made.brandId}/${outlet}/menu-items/`) && r.json.key.endsWith(".webp"), "it is stored inside this store's own folder, with a name the uploader doesn't control", r.json.key);

/* ------------------------------------------------------------------ 2 */
say("2. phone photos: rotation and private metadata");
const sideways = await sharp({ create: { width: 800, height: 400, channels: 3, background: "#cc5533" } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
r = await upload(sideways);
const out2 = await stored(r.json.url);
ok(r.status === 201 && out2.meta.width === 400 && out2.meta.height === 800, "a photo the phone saved sideways (orientation tag 6) comes out upright (400 wide, 800 tall)", `${out2.meta.width}x${out2.meta.height}`);
const tagged = await sharp({ create: { width: 600, height: 400, channels: 3, background: "#3366aa" } }).jpeg().withExif({ IFD0: { Copyright: "SECRET-OWNER-NAME", Artist: "SECRET-ARTIST" } }).toBuffer();
ok(tagged.includes("SECRET-OWNER-NAME"), "(the test picture really carries hidden text in its metadata)");
r = await upload(tagged);
const out3 = await stored(r.json.url);
ok(r.status === 201 && !out3.meta.exif && !out3.buf.includes("SECRET-OWNER-NAME") && !out3.buf.includes("SECRET-ARTIST"), "the hidden metadata (author, camera, location…) is gone from the stored file");

/* ------------------------------------------------------------------ 3 */
say("3. small pictures and transparent logos");
const small = await sharp({ create: { width: 300, height: 200, channels: 3, background: "#228844" } }).png().toBuffer();
r = await upload(small);
const out4 = await stored(r.json.url);
ok(r.status === 201 && out4.meta.width === 300 && out4.meta.height === 200, "a small picture is never blown up", `${out4.meta.width}x${out4.meta.height}`);
const logo = await sharp({ create: { width: 400, height: 400, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: await sharp({ create: { width: 200, height: 200, channels: 3, background: "#d33" } }).png().toBuffer(), left: 100, top: 100 }]).png().toBuffer();
r = await upload(logo, { kind: "logo" });
const out5 = await stored(r.json.url);
const px = await sharp(out5.buf).raw().toBuffer({ resolveWithObject: true });
const alphaAt = (x, y) => px.data[(y * px.info.width + x) * px.info.channels + (px.info.channels - 1)];
ok(r.status === 201 && out5.meta.hasAlpha && alphaAt(10, 10) === 0 && alphaAt(200, 200) === 255, "a logo with a see-through background stays see-through (corner transparent, centre solid)", `${out5.type}, alpha corner ${alphaAt(10, 10)} / centre ${alphaAt(200, 200)}`);
ok(r.json.key.includes("/logo/"), "the kind of picture (logo) decides the folder");

/* ------------------------------------------------------------------ 4 */
say("4. detail that quality alone can't shrink: the picture itself is made smaller to fit");
const grainy = await noisy(2400, 1800, 70).png().toBuffer();
r = await upload(grainy);
const out6 = await stored(r.json.url);
ok(r.status === 201 && out6.buf.length <= TARGET, `very grainy detail still ends up under the ${kb(TARGET)} target`, `${kb(grainy.length)} → ${kb(out6.buf.length)}`);
ok(Math.max(out6.meta.width, out6.meta.height) < MAXEDGE && Math.max(out6.meta.width, out6.meta.height) >= 640, "…by reducing its size (not below 640 px), not by turning it into mush", `${out6.meta.width}x${out6.meta.height}, q${r.json.quality ?? "?"}`);
ok(Math.abs(out6.meta.width / out6.meta.height - 2400 / 1800) < 0.02, "…and the shape is kept", `${(out6.meta.width / out6.meta.height).toFixed(3)} vs ${(2400 / 1800).toFixed(3)}`);

/* ------------------------------------------------------------------ 5 */
say("5. things that must be refused, or survived");
const bomb = await sharp({ create: { width: 15000, height: 15000, channels: 3, background: "#336699" } }).png({ compressionLevel: 9 }).toBuffer();
r = await upload(bomb);
const out7 = r.status === 201 ? await stored(r.json.url) : null;
ok(r.status === 201 && r.ms < 10000 && Math.max(out7.meta.width, out7.meta.height) <= MAXEDGE, `a "pixel bomb" (225 megapixels, only ${kb(bomb.length)} on disk) is shrunk safely and quickly`, `${r.status} in ${r.ms} ms`);
ok((await fetch(`${base}/health`)).ok, "the server is still healthy afterwards");
// (sharp's own ceiling would stop the test from MAKING this picture, so it is lifted here — the server's stays on)
const tooMany = await sharp({ create: { width: 17000, height: 17000, channels: 3, background: "#336699" }, limitInputPixels: false }).png({ compressionLevel: 9 }).toBuffer();
r = await upload(tooMany);
ok(r.status === 413 && /too many pixels/i.test(r.json.error ?? ""), "a picture over the 268-megapixel ceiling is refused with a clear message", `${r.status} ${r.json.error}`);
r = await upload(Buffer.from("this is not a picture, just some text"));
ok(r.status === 415 && /isn't an image|image/i.test(r.json.error ?? ""), "a file that isn't a picture is refused (415)", `${r.status} ${r.json.error}`);
r = await upload(Buffer.alloc(0));
ok(r.status === 400, "an empty upload is a 400", `${r.status}`);
r = await upload(Buffer.alloc(31 * 1024 * 1024, 7));
ok(r.status === 413, "a file over 30 MB is refused before any work is done (413)", `${r.status}`);
r = await upload(photo, { cookie: "" });
ok(r.status === 401, "someone not signed in can't upload");
r = await upload(photo, { cookie: kitchen });
ok(r.status === 403, "a role without menu rights (kitchen) can't upload", `${r.status}`);

/* ------------------------------------------------------------------ 6 */
say("6. several big pictures at once");
const t0 = Date.now();
const many = await Promise.all(Array.from({ length: 5 }, () => upload(photo)));
ok(many.every((m) => m.status === 201), "five 19 MB photos uploaded at the same moment all succeed", many.map((m) => m.status).join());
ok(Date.now() - t0 < 30000, "…in a reasonable time", `${Date.now() - t0} ms`);
ok(new Set(many.map((m) => m.json.key)).size === 5, "…each stored under its own name");
ok((await fetch(`${base}/health`)).ok, "the server is still healthy afterwards");

/* ------------------------------------------------------------------ 7 */
say("7. the platform's compression settings are what is applied");
r = await call("PUT", "/api/platform/storage", { cookie: su, body: { processing: { maxDimension: 800, quality: 60, format: "jpeg", targetMaxKB: 100 } } });
ok(r.status === 200 || r.status === 204, "the platform owner can change the compression settings", `${r.status} ${JSON.stringify(r.json).slice(0, 80)}`);
r = await upload(photo);
const out8 = await stored(r.json.url);
ok(r.status === 201 && out8.type === "image/jpeg" && Math.max(out8.meta.width, out8.meta.height) === 800 && out8.buf.length <= 100 * 1024, "the next upload follows them: JPEG, 800 px, under 100 KB", `${out8.type} ${out8.meta.width}x${out8.meta.height} ${kb(out8.buf.length)}`);
r = await call("PUT", "/api/platform/storage", { cookie: owner, body: { processing: { maxDimension: 4096, quality: 100, format: "webp", targetMaxKB: 0 } } });
ok(r.status === 401 || r.status === 403, "a store owner can't change them", `${r.status}`);
r = await call("PUT", "/api/platform/storage", { cookie: su, body: { processing: { maxDimension: 100, quality: 10, format: "webp", targetMaxKB: 400 } } });
ok(r.status === 400, "settings outside the allowed ranges (300 px minimum, quality 30–100) are refused", `${r.status}`);
await call("PUT", "/api/platform/storage", { cookie: su, body: { processing: { ...DEFAULT_IMAGE_PROCESSING } } });
r = await upload(photo);
ok(r.status === 201 && (await stored(r.json.url)).type === "image/webp", "putting the defaults back works");

console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
server.close();
process.exit(fail ? 1 : 0);
