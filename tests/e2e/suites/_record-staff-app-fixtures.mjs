// Records the REAL answers of the API for everything the staff Android app calls, into mobile-apps/oma/test/fixtures/*.json. The app's tests
// read these files, so they check the app against the server's real data shapes (a contract), not against shapes someone guessed.
// Run it when an endpoint the app uses changes:   node tests/e2e/suites/_record-staff-app-fixtures.mjs
import { createRequire } from "node:module";
import { pathToFileURL, fileURLToPath as __f } from "node:url";
import { mkdirSync as __mk, writeFileSync } from "node:fs";
const REPO = __f(new URL("../../..", import.meta.url)).replace(/\/$/, "");
const API = `${REPO}/apps/api`;
const OUT = `${REPO}/mobile-apps/oma/test/fixtures`;
const PORT = 3109;
const __RUN = __f(new URL("../.bench/suite-run/", import.meta.url));
__mk(__RUN, { recursive: true }); __mk(OUT, { recursive: true });
process.chdir(__RUN);
const req = createRequire(`${API}/package.json`);
const mms = await import(pathToFileURL(req.resolve("mongodb-memory-server")).href);
const mongod = await (mms.MongoMemoryServer ?? mms.default.MongoMemoryServer).create();
Object.assign(process.env, { NODE_ENV: "development", API_PORT: String(PORT), MONGODB_URI: mongod.getUri(), MONGODB_DB: "sandbox", LOG_LEVEL: "silent" });
const db = await import(`${REPO}/packages/db/src/index.js`);
await db.connectDb({ uri: mongod.getUri(), dbName: "sandbox" });
const { env } = await import(`${API}/src/env.js`);
const { createApp } = await import(`${API}/src/app.js`);
const { ensureSuperAdmin } = await import(`${API}/src/modules/auth/auth.service.js`);
const server = createApp().listen(PORT);
await new Promise((r) => server.once("listening", r));
await ensureSuperAdmin({ email: "super@sandbox.test", name: "Super", password: "Super123!" });
env.RATE_LIMITS = "off";

const base = `http://127.0.0.1:${PORT}`;
let n = 0;
const call = async (method, path, { body, cookie, bearer, headers = {} } = {}) => {
  const r = await fetch(base + path, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...(bearer ? { authorization: `Bearer ${bearer}` } : {}), "x-forwarded-for": `198.51.100.${(n = (n % 250) + 1)}`, ...headers }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text(); let json = {}; try { json = JSON.parse(text); } catch {}
  return { status: r.status, json };
};
const save = (name, value) => { writeFileSync(`${OUT}/${name}.json`, JSON.stringify(value, null, 2) + "\n"); console.log(`recorded ${name}.json`); };
const must = (r, what) => { if (r.status >= 400) { console.error("FAILED", what, r.status, JSON.stringify(r.json).slice(0, 300)); process.exit(1); } return r.json; };

try {
  const suCookie = (await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.250" }, body: JSON.stringify({ email: "super@sandbox.test", password: "Super123!" }) })).headers.get("set-cookie").split(";")[0];
  const made = must(await call("POST", "/api/brands", { cookie: suCookie, body: { brandName: "Gazab Momos", brandSlug: "gazab-momos", outletName: "Noida", outletSlug: "noida", hostnames: ["noida.test"], ownerEmail: "owner@sandbox.test", ownerName: "Owner", ownerPassword: "Owner123!" } }), "brand");
  const brand = String(made.brand?._id ?? made.brand?.id ?? made.brandId);
  const outlet = String(made.outlet?._id ?? made.outlet?.id ?? made.outletId);
  const ownerLogin = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.251" }, body: JSON.stringify({ email: "owner@sandbox.test", password: "Owner123!" }) });
  const owner = ownerLogin.headers.get("set-cookie").split(";")[0];
  const hdr = { "x-rasoipulse-outlet": outlet };
  must(await call("POST", "/api/users", { cookie: owner, headers: { "x-rasoipulse-brand": brand }, body: { email: "waiter@sandbox.test", name: "Asha (waiter)", password: "Staff123!", role: "staff" } }), "staff user");
  must(await call("POST", "/api/users", { cookie: owner, headers: { "x-rasoipulse-brand": brand }, body: { email: "chef@sandbox.test", name: "Ravi (kitchen)", password: "Staff123!", role: "kitchen" } }), "kitchen user");

  // a small menu: two categories, a dish with sizes + an optional add-on group, a plain dish, a drink, one sold out
  const momos = must(await call("POST", "/api/menu/categories", { cookie: owner, headers: hdr, body: { name: "Momos" } }), "category").category;
  const drinks = must(await call("POST", "/api/menu/categories", { cookie: owner, headers: hdr, body: { name: "Drinks" } }), "category").category;
  const dip = must(await call("POST", "/api/menu/modifier-groups", { cookie: owner, headers: hdr, body: { name: "Extra dip", required: false, minSelect: 0, maxSelect: 2, options: [{ label: "Mayo dip", priceDelta: 1000 }, { label: "Schezwan dip", priceDelta: 1500 }] } }), "modifier group").group;
  const size = must(await call("POST", "/api/menu/modifier-groups", { cookie: owner, headers: hdr, body: { name: "Spice level", required: true, minSelect: 1, maxSelect: 1, options: [{ label: "Mild", priceDelta: 0 }, { label: "Hot", priceDelta: 0 }] } }), "required modifier group").group;
  const item = async (body) => must(await call("POST", "/api/menu/items", { cookie: owner, headers: hdr, body }), `item ${body.name}`).item;
  await item({ categoryId: momos.id, name: "Veg Steamed Momos", description: "Cabbage, carrot and herbs", foodType: "veg", tags: ["bestseller"], variants: [{ label: "Half (4 pcs)", price: 6000 }, { label: "Full (8 pcs)", price: 9000 }], modifierGroupIds: [dip.id] });
  await item({ categoryId: momos.id, name: "Chicken Kurkure Momos", description: "Crispy fried", foodType: "non-veg", tags: ["spicy"], basePrice: 14000, modifierGroupIds: [dip.id, size.id] });
  await item({ categoryId: momos.id, name: "Paneer Tandoori Momos", foodType: "veg", basePrice: 13000 });
  await item({ categoryId: drinks.id, name: "Masala Chai", foodType: "veg", basePrice: 3000 });
  await item({ categoryId: drinks.id, name: "Cold Coffee", foodType: "veg", basePrice: 8000, isAvailable: false });
  must(await call("POST", "/api/tables", { cookie: owner, headers: hdr, body: { number: "T1", zone: "Ground floor", seats: 4 } }), "table");
  must(await call("POST", "/api/tables", { cookie: owner, headers: hdr, body: { number: "T2", zone: "Ground floor", seats: 2 } }), "table");
  must(await call("POST", "/api/tables", { cookie: owner, headers: hdr, body: { number: "T3", zone: "Terrace", seats: 6 } }), "table");

  // ---- what the app calls, as the waiter
  const tokenAnswer = must(await call("POST", "/api/auth/app-login", { body: { email: "waiter@sandbox.test", password: "Staff123!" } }), "app-login");
  const bearer = tokenAnswer.token;
  save("auth-app-login", { ...tokenAnswer, token: "TEST-TOKEN-0123456789", expiresAt: "2026-12-10T00:00:00.000Z" });
  save("auth-guard", must(await call("GET", "/api/auth/guard"), "guard"));
  save("auth-me", must(await call("GET", "/api/auth/me", { bearer }), "me"));
  save("outlets", must(await call("GET", "/api/outlets", { bearer }), "outlets"));
  const menu = must(await call("GET", `/api/menu?outletId=${outlet}`, { bearer, headers: hdr }), "menu");
  save("menu", menu);
  const tables = must(await call("GET", "/api/tables", { bearer, headers: hdr }), "tables");
  save("tables-free", tables);
  const veg = menu.items.find((i) => i.name === "Veg Steamed Momos");
  const kurkure = menu.items.find((i) => i.name === "Chicken Kurkure Momos");
  const t1 = tables.tables.find((t) => t.number === "T1");
  const cart = { lines: [
    { itemId: veg.id, variantId: veg.variants[1].id, modifierOptionIds: [menu.modifierGroups.find((g) => g.name === "Extra dip").options[0].id], quantity: 2, note: "less salt" },
    { itemId: kurkure.id, modifierOptionIds: [menu.modifierGroups.find((g) => g.name === "Spice level").options[1].id], quantity: 1 },
  ] };
  save("quote", must(await call("POST", "/api/orders/staff/quote", { bearer, headers: hdr, body: { cart, tableId: t1.id } }), "quote"));
  const placed = must(await call("POST", "/api/orders/staff", { bearer, headers: hdr, body: { tableId: t1.id, cart, name: "Mehta family", phone: "9876543210", note: "birthday table", expectedSessionId: null } }), "place order");
  save("order-placed", placed);
  save("cart-example", cart);
  const active = must(await call("GET", "/api/tables/sessions/active", { bearer, headers: hdr }), "sessions");
  save("sessions-active", active);
  save("tables-seated", must(await call("GET", "/api/tables", { bearer, headers: hdr }), "tables"));
  const sessionId = active.sessions[0].id;
  // a second round on the same table
  save("order-placed-second-round", must(await call("POST", "/api/orders/staff", { bearer, headers: hdr, body: { tableId: t1.id, cart: { lines: [{ itemId: menu.items.find((i) => i.name === "Masala Chai").id, quantity: 2 }] }, expectedSessionId: sessionId } }), "second round"));
  save("orders-list", must(await call("GET", "/api/orders?limit=50", { bearer, headers: hdr }), "orders"));
  // the screen believed T1 was free, but a party is already seated there
  const clash = await call("POST", "/api/orders/staff", { bearer, headers: hdr, body: { tableId: t1.id, cart, phone: "9876500002", expectedSessionId: null } });
  save("error-table-conflict", { status: clash.status, ...clash.json });
  const t2 = tables.tables.find((t) => t.number === "T2");
  save("session-move", must(await call("POST", `/api/tables/sessions/${sessionId}/move`, { bearer, headers: hdr, body: { toTableId: t2.id } }), "move"));
  save("session-confirm-payment", must(await call("POST", `/api/tables/sessions/${sessionId}/confirm-payment`, { bearer, headers: hdr, body: {} }), "confirm payment"));
  save("session-close", must(await call("POST", `/api/tables/sessions/${sessionId}/close`, { bearer, headers: hdr, body: {} }), "close"));
  // errors the app must show well
  save("error-401", (await call("GET", "/api/tables", { headers: hdr })).json);
  save("error-wrong-password", (await call("POST", "/api/auth/app-login", { body: { email: "waiter@sandbox.test", password: "nope" } })).json);
  // errors the app must explain well
  const t3 = tables.tables.find((t) => t.number === "T3");
  const coffee = { lines: [{ itemId: menu.items.find((i) => i.name === "Cold Coffee").id, quantity: 1 }] };
  save("error-phone-required", { ...(await call("POST", "/api/orders/staff", { bearer, headers: hdr, body: { tableId: t3.id, cart: cart } })).json });
  const soldOut = await call("POST", "/api/orders/staff", { bearer, headers: hdr, body: { tableId: t3.id, cart: coffee, phone: "9876500001", name: "Walk-in" } });
  save("error-sold-out", { status: soldOut.status, ...soldOut.json });
  const quoteSoldOut = await call("POST", "/api/orders/staff/quote", { bearer, headers: hdr, body: { cart: coffee, tableId: t3.id } });
  save("error-quote-sold-out", { status: quoteSoldOut.status, ...quoteSoldOut.json });
  const chefLogin = must(await call("POST", "/api/auth/app-login", { body: { email: "chef@sandbox.test", password: "Staff123!" } }), "chef login");
  save("auth-app-login-kitchen", { ...chefLogin, token: "TEST-TOKEN-KITCHEN-0123456789", expiresAt: "2026-12-10T00:00:00.000Z" });
} finally {
  server.close();
  await mongod.stop();
}
process.exit(0);
