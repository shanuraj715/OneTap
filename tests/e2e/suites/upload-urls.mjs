// Picture addresses: the database keeps only "/uploads/<key>" and the API adds the current domain on the way out.
// An in-memory API whose public address is https://img.example.test (nothing real is touched).
import { createRequire } from "node:module";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { fileURLToPath as __f } from "node:url";
import { mkdirSync as __mk } from "node:fs";
const REPO = __f(new URL("../../..", import.meta.url)).replace(/\/$/, "");
const API = `${REPO}/apps/api`;
const PORT = 3096;
const PUBLIC = "https://img.example.test";
const __RUN = __f(new URL("../.bench/suite-run/", import.meta.url));
__mk(__RUN, { recursive: true });
process.chdir(__RUN); // no .env here → the real database URI is never read
const req = createRequire(`${API}/package.json`);
const mms = await import(pathToFileURL(req.resolve("mongodb-memory-server")).href);
const mongod = await (mms.MongoMemoryServer ?? mms.default.MongoMemoryServer).create();
const ENV = { NODE_ENV: "development", API_PORT: String(PORT), PUBLIC_API_URL: PUBLIC, MONGODB_URI: mongod.getUri(), MONGODB_DB: "sandbox", LOG_LEVEL: "error", RATE_LIMITS: "off" };
Object.assign(process.env, ENV);
const db = await import(`${REPO}/packages/db/src/index.js`);
await db.connectDb({ uri: mongod.getUri(), dbName: "sandbox" });
const { createApp } = await import(`${API}/src/app.js`);
const server = createApp().listen(PORT);
await new Promise((r) => server.once("listening", r));
const { ensureSuperAdmin } = await import(`${API}/src/modules/auth/auth.service.js`);
await ensureSuperAdmin({ email: "super@sandbox.test", name: "Super", password: "Super123!" });
const sharp = (await import(pathToFileURL(req.resolve("sharp")).href)).default;
const urls = await import(`${API}/src/modules/storage/upload-urls.js`);

const base = `http://127.0.0.1:${PORT}`;
const call = async (method, path, { body, cookie, outlet } = {}) => {
  const r = await fetch(base + path, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...(outlet ? { "x-onetap-outlet": outlet } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text(); let json = {}; try { json = JSON.parse(text); } catch {}
  return { status: r.status, json, text };
};
const login = async (email, password) => (await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const say = (s) => console.log(`\n=== ${s}`);
const must = async (p, what) => { const r = await p; if (r.status >= 400) { console.error("SETUP FAILED", what, r.status, JSON.stringify(r.json).slice(0, 300)); process.exit(1); } return r; };
const raw = (c) => db.mongoose.connection.db.collection(c);
const oid = (s) => new db.mongoose.Types.ObjectId(String(s));

/* ------------------------------------------------------------------ setup */
const su = await login("super@sandbox.test", "Super123!");
const made = (await must(call("POST", "/api/brands", { cookie: su, body: { brandName: "Acme", brandSlug: "acme", outletName: "Main", outletSlug: "main", hostnames: ["acme.test"], ownerEmail: "o@acme.test", ownerName: "Owner", ownerPassword: "Owner123!" } }), "brand")).json;
const brand = String(made.brand?._id ?? made.brand?.id ?? made.brandId);
const outlet = String(made.outlet?._id ?? made.outlet?.id ?? made.outletId);
const owner = await login("o@acme.test", "Owner123!");
const cat = idOf(await must(call("POST", "/api/menu/categories", { cookie: owner, outlet, body: { name: "Momos" } }), "category"), "category");
function idOf(r, k) { return r.json[k].id; }
const menu = async () => (await call("GET", `/api/menu?outletId=${outlet}`)).json;
const upload = async () => {
  const buf = await sharp({ create: { width: 64, height: 48, channels: 3, background: "#cc5533" } }).png().toBuffer();
  const r = await fetch(`${base}/api/storage/upload?kind=menu-items`, { method: "POST", headers: { "content-type": "application/octet-stream", cookie: owner, "x-onetap-outlet": outlet }, body: buf });
  return { status: r.status, json: await r.json() };
};
const KEYS = (n) => `${brand}/${outlet}/menu-items/${"0123456789abcdef".repeat(2).slice(0, 8)}-1111-4222-8333-${String(n).padStart(12, "0")}.webp`;

/* ------------------------------------------------------------------ 1 */
say("1. a new upload: the domain is added on the way out, only the path is kept");
const up = await upload();
ok(up.status === 201 && up.json.url === `${PUBLIC}/uploads/${up.json.key}`, "the upload's answer carries THIS deployment's domain", up.json.url);
ok((await fetch(up.json.url.replace(PUBLIC, base))).status === 200, "…and the file is served at that path");
const created = await must(call("POST", "/api/menu/items", { cookie: owner, outlet, body: { categoryId: cat, name: "Steamed Momos", basePrice: 9000, images: [{ url: up.json.url, key: up.json.key, width: 64, height: 48 }] } }), "item");
const dbItem = await raw("menuitems").findOne({ _id: oid(created.json.item.id) });
ok(dbItem.images[0].url === `/uploads/${up.json.key}`, "the dashboard sent the full address — the database keeps only the path", dbItem.images[0].url);
ok(dbItem.images[0].key === up.json.key, "the key is kept too");
const m1 = await menu();
ok(m1.items.find((i) => i.id === created.json.item.id).images[0].url === `${PUBLIC}/uploads/${up.json.key}`, "the menu the storefront reads has the domain again");

const catUp = await upload();
await must(call("POST", "/api/menu/categories", { cookie: owner, outlet, body: { name: "With picture", image: { url: catUp.json.url, key: catUp.json.key } } }), "category with picture");
const dbCat = await raw("menucategories").findOne({ name: "With picture" });
ok(dbCat.image.url === `/uploads/${catUp.json.key}`, "a category's picture is kept domain-free as well", dbCat.image.url);
ok((await menu()).categories.find((c) => c.name === "With picture").image.url === `${PUBLIC}/uploads/${catUp.json.key}`, "…and comes out with the domain");

/* ------------------------------------------------------------------ 2 */
say("2. pictures saved the OLD way heal on the way out, no migration needed");
const legacy = { local: KEYS(1), old: KEYS(2), bare: KEYS(3) };
await raw("menuitems").insertMany([
  { brandId: brand, outletId: outlet, categoryId: cat, name: "Saved on a laptop", basePrice: 100, variants: [], tags: [], modifierGroupIds: [], gstRatePct: 5, isAvailable: true, sortOrder: 5, images: [{ url: `http://localhost:3072/uploads/${legacy.local}`, key: legacy.local }] },
  { brandId: brand, outletId: outlet, categoryId: cat, name: "Saved on an old domain", basePrice: 100, variants: [], tags: [], modifierGroupIds: [], gstRatePct: 5, isAvailable: true, sortOrder: 6, images: [{ url: `https://api.old-domain.example/uploads/${legacy.old}`, key: legacy.old }] },
  { brandId: brand, outletId: outlet, categoryId: cat, name: "Saved without a domain", basePrice: 100, variants: [], tags: [], modifierGroupIds: [], gstRatePct: 5, isAvailable: true, sortOrder: 7, images: [{ url: `/uploads/${legacy.bare}`, key: legacy.bare }] },
]);
// these rows went straight into the database (as old data would be) — expire the API's cache like the console does after an outside edit
await must(call("POST", "/api/platform/cache/expire", { cookie: su, body: { scope: "all" } }), "expire cache");
const m2 = await menu();
const img = (name) => m2.items.find((i) => i.name === name)?.images[0]?.url;
ok(img("Saved on a laptop") === `${PUBLIC}/uploads/${legacy.local}`, "an address saved from localhost now points at this deployment", img("Saved on a laptop"));
ok(img("Saved on an old domain") === `${PUBLIC}/uploads/${legacy.old}`, "an address saved with an OLD domain now points at this deployment", img("Saved on an old domain"));
ok(img("Saved without a domain") === `${PUBLIC}/uploads/${legacy.bare}`, "a domain-free path gets the domain");
ok(!JSON.stringify(m2).includes("localhost") && !JSON.stringify(m2).includes("old-domain"), "no localhost or old domain is left anywhere in the menu the storefront reads");

/* ------------------------------------------------------------------ 3 */
say("3. other people's addresses are left exactly as they are");
const outside = { cdn: "https://cdn.other-site.example/photos/momo.png", lookalike: "https://other-site.example/uploads/photo.png", prefixed: `https://other-site.example/prefix/uploads/${KEYS(4)}`, data: "data:image/png;base64,iVBORw0KGgo=" };
const ext = await must(call("POST", "/api/menu/items", { cookie: owner, outlet, body: { categoryId: cat, name: "Elsewhere", basePrice: 100, description: `see ${PUBLIC}/uploads/${KEYS(5)} for the photo`, images: Object.values(outside).map((url) => ({ url })) } }), "external item");
const dbExt = await raw("menuitems").findOne({ _id: oid(ext.json.item.id) });
ok(Object.values(outside).every((u, i) => dbExt.images[i].url === u), "a CDN link, a look-alike /uploads/ path, a path under another prefix and a data: picture are stored untouched", dbExt.images.map((i) => i.url.slice(0, 30)).join(" | "));
const outItem = (await menu()).items.find((i) => i.name === "Elsewhere");
ok(Object.values(outside).every((u, i) => outItem.images[i].url === u), "…and sent out untouched");
ok(outItem.description === `see ${PUBLIC}/uploads/${KEYS(5)} for the photo` && dbExt.description === outItem.description, "an address mentioned inside a sentence is not rewritten either");

/* ------------------------------------------------------------------ 4 */
say("4. saving what the dashboard received keeps the database clean");
const patched = await must(call("PATCH", `/api/menu/items/${created.json.item.id}`, { cookie: owner, outlet, body: { name: "Steamed Momos (new)", images: [{ url: `${PUBLIC}/uploads/${up.json.key}`, key: up.json.key }] } }), "patch");
const dbPatched = await raw("menuitems").findOne({ _id: oid(created.json.item.id) });
ok(patched.status === 200 && dbPatched.images[0].url === `/uploads/${up.json.key}`, "an edit that sends the full address back still stores only the path", dbPatched.images[0].url);
const viaLocalhost = await must(call("PATCH", `/api/menu/items/${created.json.item.id}`, { cookie: owner, outlet, body: { images: [{ url: `http://localhost:3072/uploads/${up.json.key}`, key: up.json.key }] } }), "patch localhost");
ok((await raw("menuitems").findOne({ _id: oid(created.json.item.id) })).images[0].url === `/uploads/${up.json.key}` && viaLocalhost.status === 200, "…even when the editor still holds a localhost address");
ok(!(await menu()).items.some((i) => i.images.some((im) => /localhost/.test(im.url) && /\/uploads\//.test(im.url))), "nothing the menu returns mentions localhost");

/* ------------------------------------------------------------------ 5 */
say("5. a new domain needs no data changes");
const stored = "/uploads/" + up.json.key;
const doc = JSON.stringify({ images: [{ url: stored }], other: "https://cdn.other-site.example/x.png" });
ok(urls.rewriteJsonText(doc, "https://api.new-domain.example").includes(`"https://api.new-domain.example${stored}"`) && urls.rewriteJsonText(doc, "https://tablepe.in").includes(`"https://tablepe.in${stored}"`), "the same stored data comes out on whichever domain the API is configured with");
ok(urls.toPublicUrl(stored, "https://a.example") === `https://a.example${stored}` && urls.toPublicUrl("https://x.example/y.png", "https://a.example") === "https://x.example/y.png", "toPublicUrl adds the domain to ours and leaves others");
ok(urls.toStoredUrl(`https://anything.example/uploads/${up.json.key}`) === stored, "toStoredUrl removes whatever domain was there");

/* ------------------------------------------------------------------ 6 */
say("6. receipts: the logo gets a real address too");
const prev = await call("POST", "/api/printing/preview", { cookie: owner, outlet, body: { template: { name: "Preview", docType: "receipt", paperWidth: "80mm", logoUrl: stored, blocks: [{ key: "logo", enabled: true, align: "center" }] } } });
if (prev.status === 200) {
  ok(prev.json.html.includes(`src="${PUBLIC}${stored}"`), "the receipt preview's logo is an absolute address on this domain", prev.json.html.match(/<img[^>]*logo[^>]*>/)?.[0]?.slice(0, 120) ?? "no logo tag");
} else ok(false, "the receipt preview answered", `${prev.status} ${JSON.stringify(prev.json).slice(0, 200)}`);

/* ------------------------------------------------------------------ 7 */
say("7. the clean-up script removes the domain from what is already stored");
// async on purpose: a blocking call would freeze this process while the in-memory database waits for it to read its output
const run = async (...args) => {
  try {
    const { stdout } = await promisify(execFile)(process.execPath, [`${API}/src/scripts/normalize-upload-urls.js`, ...args], { cwd: __RUN, env: { ...process.env, ...ENV }, encoding: "utf8" });
    return stdout;
  } catch (e) {
    console.error("SCRIPT FAILED:", String(e.stderr || e.message).split("\n").slice(0, 8).join(" | ").slice(0, 600));
    process.exit(1);
  }
};
const before = await raw("menuitems").find({ name: { $in: ["Saved on a laptop", "Saved on an old domain"] } }).toArray();
ok(before[0].images[0].url.startsWith("http"), "(two items still carry a full address)");
const dry = await run();
ok(/would become|Dry run/.test(dry) && /localhost:3072/.test(dry) && /api\.old-domain\.example/.test(dry), "the dry run lists the domains it would remove", dry.split("\n").filter((l) => /domains|localhost|old-domain/.test(l)).join(" / ").slice(0, 160));
ok((await raw("menuitems").findOne({ name: "Saved on a laptop" })).images[0].url.startsWith("http"), "…and changes nothing");
const applied = await run("--apply");
ok(/updated \d+ document/.test(applied), "applying it updates the documents", applied.split("\n").find((l) => /updated/.test(l)));
const after = Object.fromEntries((await raw("menuitems").find({}).toArray()).map((d) => [d.name, d.images?.map((i) => i.url)]));
ok(after["Saved on a laptop"][0] === `/uploads/${legacy.local}` && after["Saved on an old domain"][0] === `/uploads/${legacy.old}`, "both now keep only the path", after["Saved on a laptop"][0].slice(0, 40));
ok(after["Elsewhere"].join() === Object.values(outside).join(), "other people's addresses were not touched");
ok(/nothing to do/i.test(await run()), "running it again finds nothing to do (safe to repeat)");

console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
server.close();
process.exit(fail ? 1 : 0);
