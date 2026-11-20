// A dish's pictures in four shapes — square (the default), landscape 4:3, wide 16:9 and portrait 3:4 — API checks on an
// in-memory database (nothing real is touched). The point that matters most: dishes that already have square pictures
// keep every one of them, untouched, and still show them everywhere.
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { fileURLToPath as __f } from "node:url";
import { mkdirSync as __mk } from "node:fs";
const REPO = __f(new URL("../../..", import.meta.url)).replace(/\/$/, "");
const API = `${REPO}/apps/api`;
const PORT = 3106;
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
const schema = await import(`${REPO}/packages/config-schema/src/index.js`);
const raw = (c) => db.mongoose.connection.db.collection(c);
const oid = (s) => new db.mongoose.Types.ObjectId(String(s));

const base = `http://127.0.0.1:${PORT}`;
const call = async (method, path, { body, cookie, headers = {} } = {}) => {
  const r = await fetch(base + path, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text(); let json = {}; try { json = JSON.parse(text); } catch {}
  return { status: r.status, json };
};
const login = async (email, password) => (await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) })).headers.get("set-cookie")?.split(";")[0];
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const say = (s) => console.log(`\n=== ${s}`);
const must = async (p, what) => { const r = await p; if (r.status >= 400) { console.error("SETUP FAILED", what, r.status, JSON.stringify(r.json).slice(0, 300)); process.exit(1); } return r; };

/* ------------------------------------------------------------------ setup */
const su = await login("super@sandbox.test", "Super123!");
const idOf = (o) => String(o?._id ?? o?.id);
const plan = idOf((await must(call("POST", "/api/platform/plans", { cookie: su, body: { name: "Everything", entitlements: { features: schema.FEATURE_KEYS } } }), "plan")).json.plan);
const j = (await must(call("POST", "/api/brands", { cookie: su, body: { brandName: "Acme", brandSlug: "acme", outletName: "Main", outletSlug: "main", hostnames: ["acme.test"], ownerEmail: "o@acme.test", ownerName: "Owner", ownerPassword: "Owner123!", planId: plan } }), "store")).json;
const A = { brand: String(j.brand?._id ?? j.brand?.id ?? j.brandId), outlet: String(j.outlet?._id ?? j.outlet?.id ?? j.outletId) };
const owner = await login("o@acme.test", "Owner123!");
const H = { "x-onetap-outlet": A.outlet, "x-onetap-brand": A.brand };
const own = (method, path, body) => call(method, path, { cookie: owner, headers: H, body });
const cat = (await must(own("POST", "/api/menu/categories", { name: "Food" }), "category")).json.category;
const menu = async () => (await call("GET", `/api/menu?outletId=${A.outlet}`)).json;
const itemNow = async (id) => (await menu()).items.find((i) => i.id === id);
const img = (name, ratio, extra = {}) => ({ url: `https://img.test/${name}.webp`, key: `menu-items/${name}.webp`, width: 800, height: 800, ...(ratio ? { ratio } : {}), ...extra });
const urls = (item, ratio) => schema.imagesOfRatio(item, ratio).map((i) => i.url.split("/").pop());

/* ------------------------------------------------------------------ 1 */
say("1. a dish that already has square pictures keeps every one of them");
let legacyId;
{
  // written the way the database holds a dish saved BEFORE shapes existed: pictures with no shape at all
  const doc = { brandId: A.brand, outletId: A.outlet, categoryId: cat.id, name: "Old Momos", description: "", foodType: "veg", tags: [], images: [{ url: "https://img.test/old1.webp", key: "menu-items/old1.webp", width: 800, height: 800 }, { url: "https://img.test/old2.webp", key: "menu-items/old2.webp", width: 800, height: 800 }], basePrice: 6000, variants: [], modifierGroupIds: [], gstRatePct: 5, isAvailable: true, sortOrder: 0, createdAt: new Date(), updatedAt: new Date() };
  legacyId = String((await raw("menuitems").insertOne(doc)).insertedId);
  const it = await itemNow(legacyId);
  ok(it.images.length === 2 && it.images.every((i) => i.ratio === "1:1"), "both old pictures come back, each as a square (1:1) one", JSON.stringify(it.images.map((i) => i.ratio)));
  ok(it.images[0].url === "https://img.test/old1.webp" && it.images[0].key === "menu-items/old1.webp", "…with their address and file key exactly as they were");
  ok(schema.itemImageUrl(it, "1:1").endsWith("old1.webp") && schema.itemImageUrl(it, "4:3").endsWith("old1.webp") && schema.itemImageUrl(it, "16:9").endsWith("old1.webp") && schema.itemImageUrl(it, "3:4").endsWith("old1.webp"), "a card of ANY shape shows the first square picture — the dish looks exactly as before");
  ok(schema.itemGallery(it, "16:9").length === 2, "…and the dish pop-up still cycles through both");
  let r = await own("PATCH", `/api/menu/items/${legacyId}`, { basePrice: 6500 });
  const after = await raw("menuitems").findOne({ _id: oid(legacyId) });
  ok(r.status === 200 && after.images.length === 2 && after.images[0].key === "menu-items/old1.webp", "changing the price (not the pictures) leaves the pictures alone", `${r.status}`);
  r = await own("PATCH", `/api/menu/items/${legacyId}`, { images: it.images });
  ok(r.status === 200 && (await itemNow(legacyId)).images.length === 2, "saving the dish form (which sends the pictures back) keeps both");
}

/* ------------------------------------------------------------------ 2 */
say("2. adding a landscape, a wide and a portrait picture next to the squares");
{
  const it = await itemNow(legacyId);
  let r = await own("PATCH", `/api/menu/items/${legacyId}`, { images: [...it.images, img("land", "4:3", { width: 1200, height: 900 }), img("wide", "16:9", { width: 1600, height: 900 }), img("tall", "3:4", { width: 900, height: 1200 })] });
  const now = await itemNow(legacyId);
  ok(r.status === 200 && now.images.length === 5, "the dish now has five pictures: two squares and one of each other shape", `${r.status} ${now.images.length}`);
  ok(urls(now, "1:1").join() === "old1.webp,old2.webp" && urls(now, "4:3").join() === "land.webp" && urls(now, "16:9").join() === "wide.webp" && urls(now, "3:4").join() === "tall.webp", "each is kept in its own shape, the old squares first and unchanged");
  ok(schema.itemImageUrl(now, "4:3").endsWith("land.webp") && schema.itemImageUrl(now, "16:9").endsWith("wide.webp") && schema.itemImageUrl(now, "3:4").endsWith("tall.webp") && schema.itemImageUrl(now, "1:1").endsWith("old1.webp"), "a landscape card gets the landscape picture, a wide card the wide one, a portrait card the portrait one, a small card the square one");
  ok(schema.itemGallery(now, "16:9").map((i) => i.url.split("/").pop()).join() === "wide.webp", "the pop-up shows the wide picture when there is one");
  ok(schema.itemGallery(now, "1:1").length === 2, "the square gallery is still the two squares");
  ok(now.images.find((i) => i.ratio === "16:9").width === 1600 && now.images.find((i) => i.ratio === "3:4").height === 1200, "their sizes are kept");
  const stored = await raw("menuitems").findOne({ _id: oid(legacyId) });
  ok(stored.images.map((i) => i.ratio).join() === "1:1,1:1,4:3,16:9,3:4", "the database holds the shape on every picture (the old ones now say 1:1)", stored.images.map((i) => i.ratio).join());
}

/* ------------------------------------------------------------------ 3 */
say("3. only the shapes that were uploaded are used; the rest fall back to square");
{
  const onlyLand = (await must(own("POST", "/api/menu/items", { categoryId: cat.id, name: "Landscape Only", basePrice: 5000, images: [img("sq", "1:1"), img("l", "4:3")] }), "item")).json.item;
  ok(schema.itemImageUrl(onlyLand, "4:3").endsWith("l.webp") && schema.itemImageUrl(onlyLand, "16:9").endsWith("sq.webp") && schema.itemImageUrl(onlyLand, "3:4").endsWith("sq.webp"), "a dish with a square and a landscape picture: landscape cards use the landscape one, wide and portrait cards fall back to the square one");
  const noPic = (await must(own("POST", "/api/menu/items", { categoryId: cat.id, name: "No Pictures", basePrice: 5000 }), "item")).json.item;
  ok(schema.itemImageUrl(noPic, "4:3") === undefined && schema.itemGallery(noPic, "16:9").length === 0, "a dish with no pictures has none for any shape (the card shows its placeholder)");
  const wideOnly = (await must(own("POST", "/api/menu/items", { categoryId: cat.id, name: "Wide Only", basePrice: 5000, images: [img("w", "16:9")] }), "item")).json.item;
  ok(schema.itemImageUrl(wideOnly, "1:1").endsWith("w.webp"), "a dish that has only a wide picture still shows it on a square card rather than nothing");
  const unlabeled = (await must(own("POST", "/api/menu/items", { categoryId: cat.id, name: "Unlabelled", basePrice: 5000, images: [{ url: "https://img.test/u.webp", key: "menu-items/u.webp" }] }), "item")).json.item;
  ok(unlabeled.images[0].ratio === "1:1", "a picture sent without a shape (an older dashboard tab, say) is stored as square");
}

/* ------------------------------------------------------------------ 4 */
say("4. how many of each shape a dish can hold");
{
  const created = (await must(own("POST", "/api/menu/items", { categoryId: cat.id, name: "Limits", basePrice: 5000 }), "item")).json.item;
  let r = await own("PATCH", `/api/menu/items/${created.id}`, { images: [img("l1", "4:3"), img("l2", "4:3"), img("w1", "16:9"), img("w2", "16:9"), img("t1", "3:4"), img("t2", "3:4")] });
  let now = await itemNow(created.id);
  ok(r.status === 200 && urls(now, "4:3").join() === "l1.webp" && urls(now, "16:9").join() === "w1.webp" && urls(now, "3:4").join() === "t1.webp", "a second picture of the same landscape / wide / portrait shape is not kept (one each)", now.images.map((i) => `${i.ratio}:${i.url.split("/").pop()}`).join(" "));
  r = await own("PATCH", `/api/menu/items/${created.id}`, { images: Array.from({ length: 8 }, (_, n) => img(`s${n}`, "1:1")) });
  now = await itemNow(created.id);
  ok(r.status === 200 && now.images.length === 6 && urls(now, "1:1").join() === "s0.webp,s1.webp,s2.webp,s3.webp,s4.webp,s5.webp", "squares: the first six are kept (the gallery limit it always had)", `${now.images.length}`);
  r = await own("PATCH", `/api/menu/items/${created.id}`, { images: [...Array.from({ length: 6 }, (_, n) => img(`q${n}`, "1:1")), img("l", "4:3"), img("w", "16:9"), img("t", "3:4")] });
  ok(r.status === 200 && (await itemNow(created.id)).images.length === 9, "six squares plus one of each other shape — nine in all — fit");
  r = await own("PATCH", `/api/menu/items/${created.id}`, { images: Array.from({ length: 10 }, (_, n) => img(`z${n}`, "1:1")) });
  ok(r.status === 400, "ten pictures in one save is refused", `${r.status}`);
  r = await own("PATCH", `/api/menu/items/${created.id}`, { images: [img("x", "2:1")] });
  ok(r.status === 400, "a shape that doesn't exist (2:1) is refused", `${r.status}`);
  r = await own("PATCH", `/api/menu/items/${created.id}`, { images: [] });
  ok(r.status === 200 && (await itemNow(created.id)).images.length === 0, "taking every picture off works");
}

/* ------------------------------------------------------------------ 5 */
say("5. importing a menu from another outlet brings the shapes along");
{
  const second = (await must(own("POST", "/api/outlets", { name: "Second", slug: "second" }), "second outlet")).json.outlet;
  const secondId = idOf(second);
  const H2 = { "x-onetap-outlet": secondId, "x-onetap-brand": A.brand };
  const r = await call("POST", "/api/menu/import", { cookie: owner, headers: H2, body: { sourceOutletId: A.outlet, itemIds: [legacyId] } });
  ok(r.status === 201 && r.json.importedItemsCount === 1, "an item with all four shapes is imported into the second outlet", `${r.status} ${JSON.stringify(r.json)}`);
  const copied = (await call("GET", `/api/menu?outletId=${secondId}`)).json.items.find((i) => i.name === "Old Momos");
  ok(copied && copied.images.map((i) => i.ratio).join() === "1:1,1:1,4:3,16:9,3:4" && copied.images[0].url.endsWith("old1.webp"), "…with every picture still in its own shape", copied?.images.map((i) => i.ratio).join());
}

/* ------------------------------------------------------------------ 6 */
say("6. the card variants ask for the right shape");
{
  const map = schema.CARD_IMAGE_RATIO;
  ok(map["card.image-top"] === "4:3" && map["card.image-top-badge"] === "4:3" && map["card.image-overlay"] === "4:3", "photo-on-top and overlay cards use landscape 4:3");
  ok(map["card.text-above-image"] === "16:9" && map["card.featured-wide"] === "16:9", "the wide cards use 16:9");
  ok(map["card.portrait"] === "3:4", "the tall card uses portrait 3:4");
  ok(map["card.row-thumb-left"] === "1:1" && map["card.row-thumb-right"] === "1:1" && map["card.circle"] === "1:1", "thumbnail and round cards use the square picture");
  ok(Object.values(map).every((r) => schema.ITEM_IMAGE_RATIO_IDS.includes(r)), "every card asks for a shape that exists");
}

console.log(`\n${pass} passed, ${fail} failed`);
await server.close();
await db.mongoose.disconnect();
await mongod.stop();
process.exit(fail ? 1 : 0);
