// Categories inside categories, category pictures, and deleting several categories / items at once —
// API checks on an in-memory database (nothing real is touched), plus the shared section builder the storefront uses.
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { fileURLToPath as __f } from "node:url";
import { mkdirSync as __mk } from "node:fs";
const REPO = __f(new URL("../../..", import.meta.url)).replace(/\/$/, "");
const API = `${REPO}/apps/api`;
const PORT = 3087;
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
const call = async (method, path, { body, cookie, outlet } = {}) => {
  const r = await fetch(base + path, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...(outlet ? { "x-rasoipulse-outlet": outlet } : {}) }, body: body ? JSON.stringify(body) : undefined });
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
const made = (await must(call("POST", "/api/brands", { cookie: su, body: { brandName: "Acme", brandSlug: "acme", outletName: "Main", outletSlug: "main", hostnames: ["acme.test"], ownerEmail: "o@acme.test", ownerName: "Owner", ownerPassword: "Owner123!" } }), "store")).json;
const brand = String(made.brand?._id ?? made.brand?.id ?? made.brandId);
const outlet = String(made.outlet?._id ?? made.outlet?.id ?? made.outletId);
const owner = await login("o@acme.test", "Owner123!");
const mk = async (email, role) => { await must(call("POST", "/api/users", { cookie: owner, outlet, body: { email, name: role, password: "Password123!", role } }), email); return login(email, "Password123!"); };
const kitchen = await mk("k@acme.test", "kitchen");
const second = (await must(call("POST", "/api/outlets", { cookie: owner, body: { name: "Second", slug: "second" } }), "second outlet")).json;
const outlet2 = String(second.outlet?._id ?? second.outlet?.id ?? second.id ?? second._id);

const cat = (body, o = outlet) => call("POST", "/api/menu/categories", { cookie: owner, outlet: o, body });
const patchCat = (id, body, o = outlet) => call("PATCH", `/api/menu/categories/${id}`, { cookie: owner, outlet: o, body });
const item = (categoryId, name, o = outlet, extra = {}) => call("POST", "/api/menu/items", { cookie: owner, outlet: o, body: { categoryId, name, basePrice: 10000, ...extra } });
const menu = async (o = outlet) => (await call("GET", `/api/menu?outletId=${o}`)).json;
const idOf = (r, k) => r.json[k].id;
const nameOf = (m, id) => m.categories.find((c) => c.id === id)?.name;

/* ------------------------------------------------------------------ 1 */
say("1. categories inside categories");
const south = idOf(await must(cat({ name: "South Indian" }), "south"), "category");
const dosa = idOf(await must(cat({ name: "Dosa", parentId: south }), "dosa"), "category");
const idli = idOf(await must(cat({ name: "Idli & Vada", parentId: south }), "idli"), "category");
const rava = idOf(await must(cat({ name: "Rava Dosa", parentId: dosa }), "rava"), "category");
const starters = idOf(await must(cat({ name: "Starters" }), "starters"), "category");
let m = await menu();
ok(m.categories.find((c) => c.id === dosa).parentId === south && m.categories.find((c) => c.id === rava).parentId === dosa && m.categories.find((c) => c.id === south).parentId === null, "a category can be put inside another, as deep as it likes (South Indian → Dosa → Rava Dosa)", m.categories.map((c) => `${c.name}<${nameOf(m, c.parentId) ?? "top"}`).join(", "));
ok(schema.categoryPathLabel(m.categories, rava) === "South Indian › Dosa › Rava Dosa", "…and its full name reads South Indian › Dosa › Rava Dosa");
ok(m.categories.every((c) => "image" in c && c.image === null), "every category carries a picture field (empty until one is added)");
let r = await cat({ name: "Ghost child", parentId: "000000000000000000000000" });
ok(r.status === 400, "a parent that doesn't exist is refused", `${r.status} ${r.json.error}`);
const sib = (await menu()).categories.filter((c) => c.parentId === south).map((c) => c.sortOrder).sort();
ok(sib.join() === "0,1", "new categories go to the end of their own level (Dosa 0, Idli & Vada 1)", sib.join());

// a deep chain, up to the limit
let parent = null, deepest = null;
for (let i = 1; i <= schema.MAX_CATEGORY_DEPTH; i++) { const x = await cat({ name: `Level ${i}`, parentId: parent }); parent = x.json.category.id; deepest = x; }
ok(deepest.status === 201, `${schema.MAX_CATEGORY_DEPTH} levels deep works`, `${deepest.status}`);
r = await cat({ name: `Level ${schema.MAX_CATEGORY_DEPTH + 1}`, parentId: parent });
ok(r.status === 400 && /levels deep/.test(r.json.error), `one level deeper than ${schema.MAX_CATEGORY_DEPTH} is refused`, `${r.status} ${r.json.error}`);

/* ------------------------------------------------------------------ 2 */
say("2. dishes in parents and in children");
const thali = idOf(await must(item(south, "South Indian Thali"), "thali"), "item");
const masala = idOf(await must(item(dosa, "Masala Dosa"), "masala"), "item");
const paneer = idOf(await must(item(dosa, "Paneer Dosa"), "paneer"), "item");
const plain = idOf(await must(item(idli, "Plain Idli"), "plain"), "item");
const ravaMasala = idOf(await must(item(rava, "Rava Masala"), "rm"), "item");
const roll = idOf(await must(item(starters, "Spring Roll"), "roll"), "item");
m = await menu();
ok(m.items.find((i) => i.id === thali).categoryId === south, "a parent category can hold dishes of its own");
r = await patchCat(dosa, { isActive: true });
ok(r.status === 200, "(a category can still be edited as before)");

/* ------------------------------------------------------------------ 3 */
say("3. moving a category");
r = await patchCat(south, { parentId: rava });
ok(r.status === 400 && /inside itself|sub-categories/.test(r.json.error), "a category can't be moved inside one of its own sub-categories", `${r.status} ${r.json.error}`);
r = await patchCat(south, { parentId: south });
ok(r.status === 400, "…nor inside itself", `${r.status}`);
r = await patchCat(idli, { parentId: "000000000000000000000000" });
ok(r.status === 400, "…nor inside a category that doesn't exist");
// the long chain: moving South Indian (3 levels tall) under the deepest category would go too deep
r = await patchCat(south, { parentId: parent });
ok(r.status === 400 && /levels deep/.test(r.json.error), "a move that would make the branch too deep is refused", `${r.status} ${r.json.error}`);
r = await patchCat(idli, { parentId: starters });
m = await menu();
ok(r.status === 200 && m.categories.find((c) => c.id === idli).parentId === starters && m.items.find((i) => i.id === plain).categoryId === idli, "moving a category moves it WITH its dishes", `${r.status}`);
r = await patchCat(idli, { parentId: null });
m = await menu();
ok(r.status === 200 && m.categories.find((c) => c.id === idli).parentId === null, "…and back to the top level");
r = await patchCat(idli, { parentId: south });
ok(r.status === 200, "(put back inside South Indian)");
r = await patchCat(rava, { parentId: south });
m = await menu();
ok(r.status === 200 && m.categories.find((c) => c.id === rava).parentId === south, "a deep category can be lifted one level", `${r.status}`);
await patchCat(rava, { parentId: dosa });

/* ------------------------------------------------------------------ 4 */
say("4. a picture for a category");
const pic = { url: "http://127.0.0.1:1/uploads/menu-categories/dosa.webp", key: "menu-categories/dosa.webp", width: 400, height: 300 };
r = await patchCat(dosa, { image: pic });
ok(r.status === 200 && r.json.category.image?.url === pic.url && r.json.category.image.key === pic.key && r.json.category.image.width === 400, "a category can have a picture", `${r.status} ${JSON.stringify(r.json.category?.image)}`);
m = await menu();
ok(m.categories.find((c) => c.id === dosa).image?.url === pic.url, "the public menu carries it");
r = await patchCat(dosa, { name: "Dosa (all)" });
ok(r.json.category.image?.url === pic.url, "renaming keeps the picture");
await patchCat(dosa, { name: "Dosa" });
r = await cat({ name: "With picture", image: { url: "http://x/y.png", key: "k.png" } });
ok(r.status === 201 && r.json.category.image?.key === "k.png", "a picture can be set when the category is created");
const withPic = r.json.category.id;
r = await patchCat(withPic, { image: null });
ok(r.status === 200 && r.json.category.image === null, "…and removed again");
ok((await raw("menucategories").findOne({ _id: oid(withPic) })).image === undefined, "(nothing left behind in the database)");
r = await patchCat(dosa, { image: { url: "" } });
ok(r.status === 400 || r.json.category?.image === null, "an empty picture address is not a picture");
await patchCat(dosa, { image: pic });

/* ------------------------------------------------------------------ 5 */
say("5. the storefront's sections (the shared builder)");
{
  const sections = (mm, layout = { mode: "auto", defaultCardVariant: "card.row-compact", sections: [] }) => schema.resolveMenuSections(mm, layout);
  m = await menu();
  const secs = sections(m).filter((s) => !s.title.startsWith("Level") && s.title !== "With picture");
  const flat = secs.map((s) => `${"  ".repeat(s.depth)}${s.title}${s.headingOnly ? "*" : ""}`);
  ok(flat.join("|") === ["South Indian", "  Dosa", "    Rava Dosa", "  Idli & Vada", "Starters"].join("|"), "in tree order: South Indian (with its own dishes), then Dosa → Rava Dosa, then Idli & Vada, then Starters", flat.join(" | "));
  const south1 = secs.find((s) => s.title === "South Indian");
  ok(south1.items.map((i) => i.name).join() === "South Indian Thali" && !south1.headingOnly, "a parent that has dishes shows them under its own heading");
  ok(secs.find((s) => s.title === "Dosa").imageUrl === pic.url && secs.find((s) => s.title === "Dosa").trail.join() === "South Indian", "a section knows its picture and the names above it");
  ok(secs.find((s) => s.title === "Rava Dosa").rootId === south, "…and which top-level category it belongs to (for the chips)");
  // a parent with NO dishes of its own still gets a heading
  await call("DELETE", `/api/menu/items/${thali}`, { cookie: owner, outlet });
  const noThali = sections(await menu()).find((s) => s.title === "South Indian");
  ok(noThali.headingOnly === true && noThali.items.length === 0, "a parent with no dishes of its own still gets a heading, because dishes sit inside it");
  // switching a parent off hides everything inside it
  await patchCat(south, { isActive: false });
  const off = sections(await menu()).map((s) => s.title);
  ok(!off.includes("South Indian") && !off.includes("Dosa") && !off.includes("Rava Dosa") && !off.includes("Idli & Vada") && off.includes("Starters"), "switching a category off hides it AND everything inside it", off.filter((t) => !t.startsWith("Level")).join(", "));
  await patchCat(south, { isActive: true });
  // a category with nothing in it, anywhere below, is left out
  const lonely = idOf(await cat({ name: "Lonely" }), "category");
  ok(!sections(await menu()).some((s) => s.title === "Lonely"), "a category with no dishes anywhere inside it is left out");
  await call("DELETE", `/api/menu/categories/${lonely}`, { cookie: owner, outlet });
  // filters keep a heading only while something under it is still shown
  const veg = sections(await menu()).map((s) => ({ ...s, items: s.items.filter((i) => i.name !== "Plain Idli") }));
  const pruned = schema.pruneEmptySections(veg).map((s) => s.title);
  ok(!pruned.includes("Idli & Vada") && pruned.includes("Dosa"), "a filter that empties a section drops it, but keeps the headings above sections that remain");
  // a hand-arranged section pointing at a parent
  const layout = { mode: "custom", defaultCardVariant: "card.row-compact", sections: [schema.menuSectionSchema.parse({ id: "s1", title: "All South Indian", source: "category", categoryId: south, visible: true })] };
  const inc = sections(await menu(), layout)[0];
  ok(inc.items.map((i) => i.name).sort().join() === ["Masala Dosa", "Paneer Dosa", "Plain Idli", "Rava Masala"].sort().join(), "a hand-made section for a parent includes the dishes of the categories inside it", inc.items.map((i) => i.name).join());
  const exc = sections(await menu(), { ...layout, sections: [{ ...layout.sections[0], includeSubcategories: false }] });
  ok(exc.length === 0 || exc[0].items.length === 0 || !exc[0].items.some((i) => i.name === "Masala Dosa"), "…unless that is switched off for the section");
  ok(schema.menuSectionSchema.parse({ id: "x" }).includeSubcategories === true, "existing sections default to including what's inside (nothing changes for menus with no nesting)");
}

/* ------------------------------------------------------------------ 6 */
say("6. reordering");
{
  m = await menu();
  const level = m.categories.filter((c) => c.parentId === south).sort((a, b) => a.sortOrder - b.sortOrder).map((c) => c.id);
  r = await call("POST", "/api/menu/categories/order", { cookie: owner, outlet, body: { ids: [...level].reverse() } });
  m = await menu();
  const after = m.categories.filter((c) => c.parentId === south).sort((a, b) => a.sortOrder - b.sortOrder).map((c) => c.id);
  ok(r.status === 204 && after.join() === [...level].reverse().join(), "a level can be put in a new order", `${r.status}`);
  const flat = schema.flattenCategories(m.categories).map((e) => e.category.name).filter((n) => !n.startsWith("Level") && n !== "With picture");
  ok(flat.indexOf("Idli & Vada") < flat.indexOf("Dosa"), "…and the tree (and the storefront) follow it", flat.join(" › "));
  r = await call("POST", "/api/menu/categories/order", { cookie: owner, outlet, body: { ids: [dosa, starters] } });
  ok(r.status === 400, "categories from different levels can't be ordered together", `${r.status}`);
  r = await call("POST", "/api/menu/categories/order", { cookie: owner, outlet, body: { ids: ["000000000000000000000000"] } });
  ok(r.status === 404, "an unknown category is a 404", `${r.status}`);
}

/* ------------------------------------------------------------------ 6b */
say("6b. drag and drop: moving a category to a place in the tree");
{
  const mv = (id, parentId, beforeId, cookie = owner, o = outlet) => call("POST", "/api/menu/categories/move", { cookie, outlet: o, body: { id, parentId, beforeId } });
  const mk2 = async (name, parentId = null, o = outlet) => idOf(await cat({ name, parentId }, o), "category");
  const A = await mk2("DnD A"); const B = await mk2("DnD B"); const C = await mk2("DnD C");
  const A1 = await mk2("DnD A1", A); const A2 = await mk2("DnD A2", A);
  const order = async (parentId) => (await menu()).categories.filter((c) => (c.parentId ?? null) === parentId && c.name.startsWith("DnD")).sort((x, y) => x.sortOrder - y.sortOrder).map((c) => c.name).join();
  ok((await order(null)) === "DnD A,DnD B,DnD C", "(three top-level categories, in order)");
  r = await mv(C, null, A);
  ok(r.status === 200 && (await order(null)) === "DnD C,DnD A,DnD B", "dropping a category on the top edge of another puts it just before it", `${r.status} ${await order(null)}`);
  r = await mv(C, null, null);
  ok((await order(null)) === "DnD A,DnD B,DnD C", "…and dropping it on the strip below the tree puts it last");
  r = await mv(B, A, A2);
  ok(r.status === 200 && (await order(A)) === "DnD A1,DnD B,DnD A2" && (await order(null)) === "DnD A,DnD C", "dropping B between A1 and A2 puts it inside A, between them", `${await order(A)} | ${await order(null)}`);
  ok((await menu()).categories.filter((c) => c.parentId === A).map((c) => c.sortOrder).sort().join() === "0,1,2", "the level it joined is renumbered 0, 1, 2");
  r = await mv(A, B, null);
  ok(r.status === 400 && /inside itself|sub-categories/.test(r.json.error), "dropping a category into its own branch is refused", `${r.status} ${r.json.error}`);
  r = await mv(C, A1, A2);
  ok(r.status === 400, "'before' something that isn't on that level is refused", `${r.status} ${r.json.error}`);
  r = await mv("000000000000000000000000", null, null);
  ok(r.status === 404, "an unknown category is a 404");
  r = await mv(C, "000000000000000000000000", null);
  ok(r.status === 400, "an unknown parent is a 400");
  const orderBefore = await order(null);
  r = await mv(A, null, C);
  ok(r.status === 200 && (await order(null)) === orderBefore, "dropping a category where it already is leaves the order exactly as it was", `${r.status} ${orderBefore} → ${await order(null)}`);
  r = await mv(A1, null, null);
  ok(r.status === 200 && (await order(null)).endsWith("DnD A1") && (await order(A)) === "DnD B,DnD A2", "a sub-category dragged out becomes top-level and the level it left closes up", `${await order(null)} | ${await order(A)}`);
  r = await mv(C, null, null, kitchen);
  ok(r.status === 403, "the kitchen can't move categories", `${r.status}`);
  const elsewhere = await mk2("DnD elsewhere", null, outlet2);
  ok((await mv(elsewhere, null, null)).status === 404, "a category of ANOTHER outlet can't be moved through this one");
  // too deep
  let deep = null; for (let i = 0; i < schema.MAX_CATEGORY_DEPTH - 1; i++) deep = await mk2(`DnD deep ${i}`, deep);
  const lone = await mk2("DnD lone");
  const lonely2 = await mk2("DnD lone child", lone);
  r = await mv(lone, deep, null);
  ok(r.status === 400 && /levels deep/.test(r.json.error), "a drop that would make the branch too deep is refused", `${r.status} ${r.json.error}`);
  // and the public menu (cached) follows at once
  r = await mv(C, A, null);
  const pub = await menu();
  ok(pub.categories.find((c) => c.id === C).parentId === A, "the public menu shows the new place straight away");
  void lonely2;
}

/* ------------------------------------------------------------------ 6c */
say("6c. several categories at once, each with its own name and picture");
{
  const bulk = (body, cookie = owner, o = outlet) => call("POST", "/api/menu/categories/bulk", { cookie, outlet: o, body });
  const names = async (parentId) => (await menu()).categories.filter((c) => (c.parentId ?? null) === parentId && c.name.startsWith("Bulk")).sort((x, y) => x.sortOrder - y.sortOrder);
  const picture = (n) => ({ url: `https://example.test/bulk-${n}.png`, key: `bulk-${n}`, width: 20, height: 20 });

  const parent = idOf(await cat({ name: "Bulk Parent", parentId: null }), "category");
  let r = await bulk({ parentId: parent, categories: [{ name: "Bulk Dosa", image: picture(1) }, { name: "  Bulk   Idli &  Vada " }, { name: "Bulk Uttapam", image: picture(3) }] });
  ok(r.status === 201 && r.json.categories?.length === 3, "three categories are made in one request (201)", `${r.status} ${JSON.stringify(r.json).slice(0, 120)}`);
  const made = await names(parent);
  ok(made.map((c) => c.name).join("|") === "Bulk Dosa|Bulk Idli & Vada|Bulk Uttapam", "they are in the order given, with the spaces tidied", made.map((c) => c.name).join("|"));
  ok(made.every((c) => c.parentId === parent) && made.map((c) => c.sortOrder).join() === "0,1,2", "all sit inside the parent, numbered 0, 1, 2");
  ok(made[0].image?.url === picture(1).url && !made[1].image && made[2].image?.key === "bulk-3", "each keeps ITS OWN picture — the first and third have one, the second has none", JSON.stringify(made.map((c) => !!c.image)));

  r = await bulk({ parentId: parent, categories: [{ name: "Bulk Vada" }], isActive: false });
  const more = await names(parent);
  ok(r.status === 201 && more.at(-1).name === "Bulk Vada" && more.at(-1).sortOrder === 3 && more.at(-1).isActive === false, "more can be added later: they go to the end of the level and can be created switched off", `${more.map((c) => c.sortOrder).join()}`);

  r = await bulk({ categories: [{ name: "Bulk Top 1" }, { name: "Bulk Top 2" }] });
  ok(r.status === 201 && (await names(null)).filter((c) => /^Bulk Top/.test(c.name)).length === 2, "without a parent they are top-level");

  const before = (await menu()).categories.length;
  r = await bulk({ parentId: parent, categories: [{ name: "Bulk Same" }, { name: "bulk same " }] });
  ok(r.status === 400 && /twice/.test(r.json.error) && (await menu()).categories.length === before, "the same name twice (any capitals) is refused and NOTHING is created", `${r.status} ${r.json.error}`);
  r = await bulk({ parentId: parent, categories: [{ name: "Bulk Fine" }, { name: "   " }] });
  ok(r.status === 400 && /name/.test(r.json.error) && (await menu()).categories.length === before, "a box with no name is refused and NOTHING is created (the good one isn't left behind)", `${r.status} ${r.json.error}`);
  r = await bulk({ parentId: parent, categories: [] });
  ok(r.status === 400, "an empty list is a 400");
  r = await bulk({ parentId: parent, categories: Array.from({ length: schema.MAX_CATEGORIES_AT_ONCE + 1 }, (_, i) => ({ name: `Bulk Many ${i}` })) });
  ok(r.status === 400 && /or fewer/.test(r.json.error) && (await menu()).categories.length === before, `more than ${schema.MAX_CATEGORIES_AT_ONCE} at a time is refused`, `${r.status} ${r.json.error}`);
  r = await bulk({ parentId: "000000000000000000000000", categories: [{ name: "Bulk Orphan" }] });
  ok(r.status === 400 && /parent/.test(r.json.error), "an unknown parent is a 400", `${r.status} ${r.json.error}`);
  let deep = null; for (let i = 0; i < schema.MAX_CATEGORY_DEPTH; i++) deep = idOf(await cat({ name: `Bulk deep ${i}`, parentId: deep }), "category");
  r = await bulk({ parentId: deep, categories: [{ name: "Bulk Too Deep" }] });
  ok(r.status === 400 && /levels deep/.test(r.json.error), "inside a category that is already at the deepest level is refused", `${r.status} ${r.json.error}`);
  ok((await bulk({ parentId: parent, categories: [{ name: "Bulk Kitchen" }] }, kitchen)).status === 403, "the kitchen can't add categories");
  ok((await call("POST", "/api/menu/categories/bulk", { outlet, body: { categories: [{ name: "Bulk Nobody" }] } })).status === 401, "someone not signed in can't either");
  r = await bulk({ parentId: parent, categories: [{ name: "Bulk Elsewhere" }] }, owner, outlet2);
  ok(r.status === 400, "a parent of ANOTHER outlet is not found through this one", `${r.status} ${r.json.error}`);
  ok(schema.cleanCategoryName("  a   b ") === "a b" && schema.duplicateCategoryName(["Dosa", " dosa", "x"]) === "Dosa" && schema.duplicateCategoryName(["a", "b"]) === null, "the shared name helpers agree (spaces tidied; a repeat is found and reported with its first spelling)");
  ok(typeof schema.splitCategoryNames === "undefined", "(the comma splitter is gone — names come from separate boxes)");
}

/* ------------------------------------------------------------------ 7 */
say("7. deleting several categories at once");
{
  // who may
  r = await call("POST", "/api/menu/categories/bulk-delete", { cookie: kitchen, outlet, body: { ids: [starters] } });
  ok(r.status === 403, "the kitchen can't delete categories", `${r.status}`);
  r = await call("POST", "/api/menu/categories/bulk-delete", { outlet, body: { ids: [starters] } });
  ok(r.status === 401, "nobody signed in can't either", `${r.status}`);
  ok((await call("POST", "/api/menu/categories/bulk-delete", { cookie: owner, outlet, body: { ids: [] } })).status === 400, "an empty list is a 400");
  ok((await call("POST", "/api/menu/categories/bulk-delete", { cookie: owner, outlet, body: { ids: ["000000000000000000000000"] } })).status === 404, "an unknown category is a 404 and nothing is deleted");
  // items inside: refused with the numbers, nothing removed
  m = await menu();
  const before = { cats: m.categories.length, items: m.items.length };
  r = await call("POST", "/api/menu/categories/bulk-delete", { cookie: owner, outlet, body: { ids: [south, starters] } });
  m = await menu();
  ok(r.status === 409 && r.json.details?.code === "category_has_items" && r.json.details.itemCount === 5 && r.json.details.categoryCount === 5, "categories that hold dishes are refused — with how many dishes and categories it would take", `${r.status} ${JSON.stringify(r.json.details)}`);
  ok(m.categories.length === before.cats && m.items.length === before.items, "…and nothing was removed");
  // empty branch goes (with its sub-categories) without the flag
  const emptyParent = idOf(await cat({ name: "Empty parent" }), "category");
  await cat({ name: "Empty child", parentId: emptyParent });
  r = await call("POST", "/api/menu/categories/bulk-delete", { cookie: owner, outlet, body: { ids: [emptyParent] } });
  ok(r.status === 200 && r.json.deletedCategories === 2 && r.json.deletedItems === 0, "an empty category goes together with the empty categories inside it", JSON.stringify(r.json));
  // with deleteItems: the whole branches and their dishes
  r = await call("POST", "/api/menu/categories/bulk-delete", { cookie: owner, outlet, body: { ids: [south, starters], deleteItems: true } });
  m = await menu();
  ok(r.status === 200 && r.json.deletedCategories === 5 && r.json.deletedItems === 5, "two categories chosen: both go, with every category inside them and all their dishes", JSON.stringify(r.json));
  ok(!m.categories.some((c) => [south, dosa, idli, rava, starters].includes(c.id)) && !m.items.some((i) => [masala, paneer, plain, ravaMasala, roll].includes(i.id)), "…none of them is left");
  ok(m.categories.some((c) => c.name === "Level 1"), "…and unrelated categories are untouched");
  // the single-delete route follows the same rules
  const solo = idOf(await cat({ name: "Solo" }), "category");
  await item(solo, "Solo dish");
  r = await call("DELETE", `/api/menu/categories/${solo}`, { cookie: owner, outlet });
  ok(r.status === 409, "deleting one category that holds dishes is still refused", `${r.status}`);
  const soloEmpty = idOf(await cat({ name: "Solo empty" }), "category");
  ok((await call("DELETE", `/api/menu/categories/${soloEmpty}`, { cookie: owner, outlet })).status === 204, "…and an empty one still deletes with 204");
}

/* ------------------------------------------------------------------ 8 */
say("8. deleting several items at once");
{
  const c1 = idOf(await cat({ name: "Bulk items" }), "category");
  const ids = [];
  for (const n of ["A", "B", "C", "D"]) ids.push(idOf(await item(c1, `Dish ${n}`, outlet, { images: [{ url: `http://x/${n}.png`, key: `menu-items/${n}.png` }] }), "item"));
  r = await call("POST", "/api/menu/items/bulk-delete", { cookie: kitchen, outlet, body: { ids: [ids[0]] } });
  ok(r.status === 403, "the kitchen can't delete items", `${r.status}`);
  r = await call("POST", "/api/menu/items/bulk-delete", { cookie: owner, outlet, body: { ids: [ids[0], "000000000000000000000000"] } });
  m = await menu();
  ok(r.status === 404 && m.items.some((i) => i.id === ids[0]), "if one of them isn't an item, nothing is deleted", `${r.status}`);
  const otherItem = idOf(await (async () => { const c2 = idOf(await cat({ name: "Elsewhere" }, outlet2), "category"); return item(c2, "Other outlet dish", outlet2); })(), "item");
  r = await call("POST", "/api/menu/items/bulk-delete", { cookie: owner, outlet, body: { ids: [ids[0], otherItem] } });
  ok(r.status === 404 && (await menu(outlet2)).items.some((i) => i.id === otherItem), "an item of ANOTHER outlet can't be deleted through this one", `${r.status}`);
  r = await call("POST", "/api/menu/items/bulk-delete", { cookie: owner, outlet, body: { ids: [ids[0], ids[1], ids[2]] } });
  m = await menu();
  ok(r.status === 200 && r.json.deletedItems === 3 && m.items.filter((i) => ids.includes(i.id)).map((i) => i.name).join() === "Dish D", "three of four are deleted in one go; the fourth stays", JSON.stringify(r.json));
  ok((await call("POST", "/api/menu/items/bulk-delete", { cookie: owner, outlet, body: { ids: [] } })).status === 400, "an empty list is a 400");
}

/* ------------------------------------------------------------------ 9 */
say("9. importing a menu from another outlet keeps the tree and the pictures");
{
  // build a tree in outlet 2's source: North → Curries → Paneer Curries (+ Dosa under South, Dosa under North)
  const north = idOf(await cat({ name: "North Indian", image: { url: "http://x/north.png", key: "menu-categories/north.png" } }, outlet2), "category");
  const curries = idOf(await cat({ name: "Curries", parentId: north }, outlet2), "category");
  const s2 = idOf(await cat({ name: "South Indian" }, outlet2), "category");
  const dosaS = idOf(await cat({ name: "Dosa", parentId: s2 }, outlet2), "category");
  const dosaN = idOf(await cat({ name: "Dosa", parentId: north }, outlet2), "category");
  const i1 = idOf(await item(curries, "Dal Makhani", outlet2), "item");
  const i2 = idOf(await item(dosaS, "Masala Dosa", outlet2), "item");
  const i3 = idOf(await item(dosaN, "Tandoori Dosa", outlet2), "item");
  r = await call("POST", "/api/menu/import", { cookie: owner, outlet, body: { sourceOutletId: outlet2, categoryIds: [curries, dosaS, dosaN], itemIds: [i1, i2, i3] } });
  const im = await menu();
  const path = (id) => schema.categoryPathLabel(im.categories, id);
  const paths = im.categories.map((c) => path(c.id));
  ok(r.status === 201 && paths.includes("North Indian › Curries") && paths.includes("South Indian › Dosa") && paths.includes("North Indian › Dosa"), "imported categories keep their parents (North Indian › Curries, South Indian › Dosa)", paths.filter((p) => /Indian/.test(p)).join(" | "));
  ok(im.categories.filter((c) => c.name === "Dosa").length === 2, "two categories both called 'Dosa' under different parents stay two categories (not merged by name)");
  ok(im.categories.find((c) => path(c.id) === "North Indian")?.image?.url === "http://x/north.png", "a category's picture comes across too");
  const dalCat = im.items.find((i) => i.name === "Dal Makhani")?.categoryId;
  ok(path(dalCat) === "North Indian › Curries" && path(im.items.find((i) => i.name === "Tandoori Dosa").categoryId) === "North Indian › Dosa", "each dish lands in the right one", `${path(dalCat)}`);
  const before = im.categories.length;
  r = await call("POST", "/api/menu/import", { cookie: owner, outlet, body: { sourceOutletId: outlet2, categoryIds: [curries, dosaS, dosaN], itemIds: [] } });
  ok((await menu()).categories.length === before, "importing again doesn't duplicate categories (matched by place in the tree)", `${(await menu()).categories.length} vs ${before}`);
}

console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
server.close();
process.exit(fail ? 1 : 0);
