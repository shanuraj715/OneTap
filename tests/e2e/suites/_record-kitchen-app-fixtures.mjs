// Records the REAL answers of the API for everything the Kitchen Display app (KDA) calls, into mobile-apps/kda/test/fixtures/*.json. The app's
// tests read these files, so they check the app against the server's real data shapes (a contract), not against shapes someone guessed.
// Run it when an endpoint the app uses changes:   node tests/e2e/suites/_record-kitchen-app-fixtures.mjs
// (It only writes its own files; the OMA fixtures are recorded by _record-staff-app-fixtures.mjs.)
import { createRequire } from "node:module";
import { pathToFileURL, fileURLToPath as __f } from "node:url";
import { mkdirSync as __mk, writeFileSync } from "node:fs";
const REPO = __f(new URL("../../..", import.meta.url)).replace(/\/$/, "");
const API = `${REPO}/apps/api`;
const OUT = `${REPO}/mobile-apps/kda/test/fixtures`;
const PORT = 3111;
const __RUN = __f(new URL("../.bench/suite-run/", import.meta.url));
__mk(__RUN, { recursive: true }); __mk(OUT, { recursive: true });
process.chdir(__RUN);
const req = createRequire(`${API}/package.json`);
const mms = await import(pathToFileURL(req.resolve("mongodb-memory-server")).href);
const mongod = await (mms.MongoMemoryServer ?? mms.default.MongoMemoryServer).create();
// fixed public addresses, so the recorded pageUrl / downloadUrl of the update answers are the real, stable ones
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
const KDA = { "x-app-id": "kda" };
const call = async (method, path, { body, cookie, bearer, headers = {} } = {}) => {
  const r = await fetch(base + path, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...(bearer ? { authorization: `Bearer ${bearer}` } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text(); let json = {}; try { json = JSON.parse(text); } catch { /* an empty answer */ }
  return { status: r.status, json, headers: r.headers };
};
const save = (name, value) => { writeFileSync(`${OUT}/${name}.json`, JSON.stringify(value, null, 2) + "\n"); console.log(`recorded ${name}.json`); };
const must = (r, what) => { if (r.status >= 400) { console.error("FAILED", what, r.status, JSON.stringify(r.json).slice(0, 300)); process.exit(1); } return r.json; };
const login = async (email, password) => (await call("POST", "/api/auth/login", { body: { email, password } })).headers.get("set-cookie").split(";")[0];
const appLogin = (email, password) => call("POST", "/api/auth/app-login", { headers: KDA, body: { email, password } });
/** fixed, fake token + expiry, so the files don't change every time they are recorded */
const withToken = (answer, token) => ({ ...answer, token, expiresAt: "2026-12-10T00:00:00.000Z" });

try {
  const su = await login("super@sandbox.test", "Super123!");
  // two stores; the first has two outlets (so "which outlet" is a real question), the second one
  const a = must(await call("POST", "/api/brands", { cookie: su, body: { brandName: "Gazab Momos", brandSlug: "gazab-momos", outletName: "Noida", outletSlug: "noida", hostnames: ["noida.test"], ownerEmail: "owner@sandbox.test", ownerName: "Owner", ownerPassword: "Owner123!" } }), "brand");
  const brand = String(a.brand?._id ?? a.brand?.id ?? a.brandId);
  const outlet = String(a.outlet?._id ?? a.outlet?.id ?? a.outletId);
  must(await call("POST", "/api/outlets", { cookie: su, headers: { "x-rasoipulse-brand": brand }, body: { name: "Ludhiana", slug: "ludhiana" } }), "second outlet");
  must(await call("POST", "/api/brands", { cookie: su, body: { brandName: "Spice Route", brandSlug: "spice-route", outletName: "Delhi", outletSlug: "delhi", hostnames: ["delhi.test"], ownerEmail: "owner@spice.test", ownerName: "Owner", ownerPassword: "Owner123!" } }), "second brand");
  const owner = await login("owner@sandbox.test", "Owner123!");
  const hdr = { "x-rasoipulse-outlet": outlet };
  const user = async (email, name, role) => must(await call("POST", "/api/users", { cookie: owner, headers: { "x-rasoipulse-brand": brand }, body: { email, name, password: "Staff123!", role } }), `user ${email}`);
  await user("chef@sandbox.test", "Ravi (kitchen)", "kitchen");
  await user("boss@sandbox.test", "Meena (kitchen manager)", "manager");
  await user("waiter@sandbox.test", "Asha (waiter)", "staff");

  // the menu: momos on the kitchen, drinks on the bar; one dish switched off, one counted and running low, one counted and finished
  const momos = must(await call("POST", "/api/menu/categories", { cookie: owner, headers: hdr, body: { name: "Momos" } }), "category").category;
  const drinks = must(await call("POST", "/api/menu/categories", { cookie: owner, headers: hdr, body: { name: "Drinks", prepStation: "bar" } }), "category").category;
  const dip = must(await call("POST", "/api/menu/modifier-groups", { cookie: owner, headers: hdr, body: { name: "Extra dip", required: false, minSelect: 0, maxSelect: 2, options: [{ label: "Mayo dip", priceDelta: 1000 }, { label: "Schezwan dip", priceDelta: 1500 }] } }), "modifier group").group;
  const spice = must(await call("POST", "/api/menu/modifier-groups", { cookie: owner, headers: hdr, body: { name: "Spice level", required: true, minSelect: 1, maxSelect: 1, options: [{ label: "Mild", priceDelta: 0 }, { label: "Hot", priceDelta: 0 }] } }), "required modifier group").group;
  const item = async (body) => must(await call("POST", "/api/menu/items", { cookie: owner, headers: hdr, body }), `item ${body.name}`).item;
  const veg = await item({ categoryId: momos.id, name: "Veg Steamed Momos", description: "Cabbage, carrot and herbs", foodType: "veg", tags: ["bestseller"], variants: [{ label: "Half (4 pcs)", price: 6000 }, { label: "Full (8 pcs)", price: 9000 }], modifierGroupIds: [dip.id] });
  const kurkure = await item({ categoryId: momos.id, name: "Chicken Kurkure Momos", description: "Crispy fried", foodType: "non-veg", tags: ["spicy"], basePrice: 14000, modifierGroupIds: [dip.id, spice.id] });
  const paneer = await item({ categoryId: momos.id, name: "Paneer Tandoori Momos", foodType: "veg", basePrice: 13000 });
  const chai = await item({ categoryId: drinks.id, name: "Masala Chai", foodType: "veg", basePrice: 3000 });
  await item({ categoryId: drinks.id, name: "Cold Coffee", foodType: "veg", basePrice: 8000, isAvailable: false });
  const corn = await item({ categoryId: momos.id, name: "Corn Cheese Momos", foodType: "veg", basePrice: 11000, stock: { tracked: true, left: 2, daily: 20, lowAt: 3 } });
  await item({ categoryId: momos.id, name: "Peri Peri Momos", foodType: "veg", basePrice: 12000, stock: { tracked: true, left: 0, daily: 20, lowAt: 3 } });
  for (const [number, zone, seats] of [["T1", "Ground floor", 4], ["T2", "Ground floor", 2], ["T3", "Terrace", 6]]) must(await call("POST", "/api/tables", { cookie: owner, headers: hdr, body: { number, zone, seats } }), `table ${number}`);
  const tables = must(await call("GET", "/api/tables", { cookie: owner, headers: hdr }), "tables").tables;
  const table = (n) => tables.find((t) => t.number === n);
  const menu = must(await call("GET", `/api/menu?outletId=${outlet}`, { cookie: owner, headers: hdr }), "menu");
  const group = (name) => menu.modifierGroups.find((g) => g.name === name);
  const veg2 = menu.items.find((i) => i.id === veg.id);

  // three orders on the board: a new one (kitchen + bar, with a note and an add-on), one being made, one ready
  const place = async (tableNumber, lines, extra = {}) => must(await call("POST", "/api/orders/staff", { cookie: owner, headers: hdr, body: { tableId: table(tableNumber).id, cart: { lines }, expectedSessionId: null, ...extra } }), `order ${tableNumber}`);
  const first = await place("T3", [{ itemId: veg.id, variantId: veg2.variants[0].id, quantity: 1 }], { name: "Walk-in", phone: "9876500003" });
  const second = await place("T2", [{ itemId: paneer.id, quantity: 2 }], { name: "Sita Verma", phone: "9876599999" });
  await place("T1", [
    { itemId: veg.id, variantId: veg2.variants[1].id, modifierOptionIds: [group("Extra dip").options[0].id], quantity: 2, note: "less salt" },
    { itemId: kurkure.id, modifierOptionIds: [group("Spice level").options[1].id], quantity: 1 },
    { itemId: chai.id, quantity: 2 },
  ], { name: "Mehta family", phone: "9876543210", note: "birthday table, please bring everything together" });
  const orderId = (placed) => String(placed.order?.id ?? placed.order?._id ?? placed.orders?.[0]?.id);

  // ---- who signs in (the server decides which roles may)
  const cook = must(await appLogin("chef@sandbox.test", "Staff123!"), "cook login");
  const boss = must(await appLogin("boss@sandbox.test", "Staff123!"), "manager login");
  const suLogin = must(await appLogin("super@sandbox.test", "Super123!"), "super login");
  save("auth-app-login", withToken(cook, "TEST-TOKEN-KITCHEN-0123456789"));
  save("auth-app-login-manager", withToken(boss, "TEST-TOKEN-MANAGER-0123456789"));
  save("auth-app-login-super", withToken(suLogin, "TEST-TOKEN-SUPER-0123456789"));
  const refused = await appLogin("waiter@sandbox.test", "Staff123!");
  save("error-app-not-allowed", { status: refused.status, ...refused.json });
  save("error-wrong-password", (await appLogin("chef@sandbox.test", "nope")).json);
  save("auth-guard", must(await call("GET", "/api/auth/guard"), "guard"));
  save("auth-me", must(await call("GET", "/api/auth/me", { bearer: cook.token }), "me"));
  save("outlets", must(await call("GET", "/api/outlets", { bearer: cook.token }), "outlets"));
  save("outlets-super", must(await call("GET", "/api/outlets", { bearer: suLogin.token }), "outlets as super admin"));
  save("error-401", (await call("GET", "/api/kitchen/orders", { headers: hdr })).json);

  // ---- the board: a new order, one being made, one ready
  const kitchen = (token) => ({ bearer: token, headers: hdr });
  const stage = async (placed, to) => must(await call("POST", `/api/kitchen/orders/${orderId(placed)}/stage`, { ...kitchen(cook.token), body: { screen: "all", stage: to } }), `stage ${to}`);
  await stage(second, "preparing");
  await stage(first, "preparing"); await stage(first, "ready");
  save("kitchen-board-all", must(await call("GET", "/api/kitchen/orders?screen=all", kitchen(cook.token)), "board all"));
  save("kitchen-board-bar", must(await call("GET", "/api/kitchen/orders?screen=bar", kitchen(cook.token)), "board bar"));
  save("kitchen-stage-set", must(await call("POST", `/api/kitchen/orders/${orderId(second)}/stage`, { ...kitchen(cook.token), body: { screen: "all", stage: "ready" } }), "stage answer"));

  // ---- the dishes
  save("kitchen-items", must(await call("GET", "/api/kitchen/items", kitchen(cook.token)), "items"));
  const switchTo = (token, id, body) => call("POST", `/api/kitchen/items/${id}/availability`, { ...kitchen(token), body });
  save("kitchen-item-set", must(await switchTo(cook.token, paneer.id, { state: "sold-out" }), "sold out"));
  await switchTo(cook.token, paneer.id, { state: "available" });
  const perip = (await call("GET", "/api/kitchen/items", kitchen(cook.token))).json.items.find((i) => i.name === "Peri Peri Momos");
  save("kitchen-item-still-sold-out", must(await switchTo(cook.token, perip.id, { state: "available" }), "counted, none left"));
  save("kitchen-item-restocked", must(await switchTo(boss.token, corn.id, { state: "available", left: 9 }), "restock"));
  const noRight = await switchTo(cook.token, corn.id, { state: "available", left: 9 });
  save("error-no-right", { status: noRight.status, ...noRight.json });

  // ---- the manager's numbers
  save("kitchen-summary", must(await call("GET", "/api/kitchen/summary", kitchen(boss.token)), "summary"));

  // ---- the update check, for THIS app (kda)
  const file = (v) => ({ name: `kda-${v}.apk`, key: `${v}.apk`, size: 3_400_000, sha256: "a".repeat(64) });
  const publish = (version, versionCode, notes, force) => db.AppReleaseModel.create({ app: "kda", platform: "android", version, versionCode, notes, force, status: "published", publishedAt: new Date("2026-11-27T10:00:00Z"), file: file(version) });
  const check = async (code) => must(await call("GET", `/api/app-updates/check?app=kda&platform=android&versionCode=${code}`), `check ${code}`);
  save("update-check-none", await check(1));
  await publish("v-26.11.27-002", 2, "Order alerts are louder\nThe prep list groups the same dish", false);
  save("update-check-optional", await check(1));
  save("update-check-current", await check(2));
  await publish("v-26.11.28-003", 3, "Security fix: please update", true);
  save("update-check-required", await check(1));
  const old = await call("POST", "/api/auth/app-login", { headers: { ...KDA, "x-app-version-code": "1" }, body: { email: "chef@sandbox.test", password: "Staff123!" } });
  if (old.status !== 426) { console.error("expected 426, got", old.status, JSON.stringify(old.json).slice(0, 200)); process.exit(1); }
  save("error-update-required", old.json);
} finally {
  server.close();
  await mongod.stop();
  process.exit(0);
}
