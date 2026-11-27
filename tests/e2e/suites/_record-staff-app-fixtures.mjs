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
  await item({ categoryId: drinks.id, name: "Masala Chai", foodType: "veg", basePrice: 3000, images: [{ url: "/uploads/masala-chai.webp", key: "masala-chai.webp", ratio: "1:1" }] });
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
  // the menu once, then only "what can't be ordered now?"
  save("menu-unavailable", must(await call("GET", `/api/menu/unavailable?outletId=${outlet}`, { bearer, headers: hdr }), "unavailable"));
  // the dropdown under the mobile-number box: a few digits match several people, a full number exactly one
  must(await call("POST", "/api/orders/staff/quote", { bearer, headers: hdr, body: { cart, phone: "9876543299" } }), "quote with another number");
  save("customers-search-one", must(await call("GET", "/api/orders/staff/customers?q=9876543210", { bearer, headers: hdr }), "customers one"));
  const active = must(await call("GET", "/api/tables/sessions/active", { bearer, headers: hdr }), "sessions");
  save("sessions-active", active);
  save("tables-seated", must(await call("GET", "/api/tables", { bearer, headers: hdr }), "tables"));
  const sessionId = active.sessions[0].id;
  // a second round on the same table
  save("order-placed-second-round", must(await call("POST", "/api/orders/staff", { bearer, headers: hdr, body: { tableId: t1.id, cart: { lines: [{ itemId: menu.items.find((i) => i.name === "Masala Chai").id, quantity: 2 }] }, expectedSessionId: sessionId } }), "second round"));
  const t2first = tables.tables.find((t) => t.number === "T2");
  must(await call("POST", "/api/orders/staff", { bearer, headers: hdr, body: { tableId: t2first.id, cart: { lines: [{ itemId: menu.items.find((i) => i.name === "Masala Chai").id, quantity: 1 }] }, name: "Sita Verma", phone: "9876599999", expectedSessionId: null } }), "second customer");
  save("customers-search-many", must(await call("GET", "/api/orders/staff/customers?q=98765", { bearer, headers: hdr }), "customers many"));
  await call("POST", `/api/tables/sessions/${(await call("GET", "/api/tables/sessions/active", { bearer, headers: hdr })).json.sessions.find((x) => x.tableNumber === "T2").id}/void`, { bearer, headers: hdr, body: {} });
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

  // ---- the Orders tab: takeaway + delivery orders, moving them along, a rider, an edit, a printer, a delete (what the dashboard's Orders page does)
  const own = (method, path, body) => call(method, path, { cookie: owner, headers: hdr, body });
  const raw = (c) => db.mongoose.connection.db.collection(c);
  const oid = (s) => new db.mongoose.Types.ObjectId(String(s));
  must(await own("PATCH", `/api/outlets/${outlet}/config`, { identity: { name: "Gazab Momos Noida", location: { point: { lat: 28.5355, lng: 77.391 } } }, features: { ordering: { takeaway: true, delivery: true } }, operations: { limits: { deliveryRadiusKm: 6 } } }), "outlet config for takeaway + delivery");
  const chaiItem = menu.items.find((i) => i.name === "Masala Chai");
  const asCustomer = async (channel, lines, who, extra = {}) => {
    const order = must(await own("POST", "/api/orders", { outletId: outlet, channel, name: who.name, cart: { lines }, gateway: who.cod ? "cod" : "mock", ...extra }), `${channel} order`).order;
    // a customer's own order carries their mobile number (a staff-placed one doesn't): give it one, as it would have
    await raw("orders").updateOne({ _id: oid(order.id) }, { $set: { "customer.phone": who.phone, "customer.name": who.name, "payment.status": who.paid ? "paid" : "pending" } });
    return order;
  };
  const take = await asCustomer("takeaway", [{ itemId: veg.id, variantId: veg.variants[0].id, quantity: 1, modifierOptionIds: [] }, { itemId: chaiItem.id, quantity: 2, modifierOptionIds: [] }], { name: "Priya Nair", phone: "9811122233", paid: false, cod: true }, { note: "Pack the dip separately" });
  const del1 = await asCustomer("delivery", [{ itemId: kurkure.id, modifierOptionIds: [menu.modifierGroups.find((g) => g.name === "Spice level").options[0].id], quantity: 2 }], { name: "Neha Gupta", phone: "9876512345", paid: true }, { deliveryAddress: { text: "B-14, Sector 18, Noida", landmark: "Opposite the metro station", lat: 28.5455, lng: 77.397 } });
  const del2 = await asCustomer("delivery", [{ itemId: chaiItem.id, quantity: 3, modifierOptionIds: [] }], { name: "Karan Malhotra", phone: "9876554321", paid: true }, { deliveryAddress: { text: "Flat 4B, Tower C, Sector 62, Noida", lat: 28.5655, lng: 77.381 } });
  const waiter = (method, path, body) => call(method, path, { bearer, headers: hdr, body });
  // the waiter moves the takeaway order along (and back, by hand, with a reason)
  save("order-status-accepted", must(await waiter("PATCH", `/api/orders/${take.id}/status`, { status: "accepted" }), "accept"));
  save("order-status-manual", must(await waiter("PATCH", `/api/orders/${take.id}/status/manual`, { status: "placed", reason: "Tapped by mistake" }), "manual"));
  const flow = await waiter("PATCH", `/api/orders/${take.id}/status`, { status: "completed" });
  save("error-status-flow", { status: flow.status, ...flow.json });
  // an edit: the note and the customer, then the items (re-priced by the server)
  save("order-edited-details", must(await waiter("PATCH", `/api/orders/${take.id}`, { note: "No onions please", customerName: "Priya N.", customerPhone: "9811122233" }), "edit details"));
  save("order-edited-items", must(await waiter("PATCH", `/api/orders/${take.id}`, { cart: { lines: [{ itemId: veg.id, variantId: veg.variants[0].id, quantity: 2, modifierOptionIds: [] }, { itemId: chaiItem.id, quantity: 1, modifierOptionIds: [] }] } }), "edit items"));
  // a delivery order: made, then handed to a rider
  for (const s2 of ["accepted", "preparing", "ready"]) { must(await waiter("PATCH", `/api/orders/${del1.id}/status`, { status: s2 }), `del1 ${s2}`); must(await waiter("PATCH", `/api/orders/${del2.id}/status`, { status: s2 }), `del2 ${s2}`); }
  const ramesh = must(await own("POST", "/api/riders", { name: "Ramesh", phone: "98765 43210" }), "rider").rider;
  must(await own("POST", "/api/riders", { name: "Suresh", phone: "98111 22233" }), "rider 2");
  save("riders", must(await waiter("GET", "/api/riders"), "riders"));
  save("order-rider-assigned", must(await waiter("PATCH", `/api/orders/${del1.id}/rider`, { riderId: ramesh.id }), "assign rider"));
  save("order-rider-sendout", must(await waiter("PATCH", `/api/orders/${del2.id}/rider`, { name: "Walk-in rider", phone: "9000011111", sendOut: true }), "send out"));
  const locked = await waiter("PATCH", `/api/orders/${del1.id}`, { note: "too late" });
  save("error-edit-locked", { status: locked.status, ...locked.json });
  // a printer, and printing an order on it
  const printer = must(await own("POST", "/api/printing/printers", { name: "Kitchen printer", station: "kitchen", docType: "kot", target: "agent", paperWidth: "80mm" }), "printer").printer;
  // (the printer's connection details are left out of the file: the app never reads them)
  save("printers", { printers: must(await waiter("GET", "/api/printing/printers"), "printers").printers.map(({ connection, ...p }) => p) });
  const printed = await waiter("POST", `/api/orders/${take.id}/print`.replace("/api/orders", "/api/printing/orders"), { printerId: printer.id });
  save("print-order", { status: printed.status, ...printed.json });
  // the orders as they stand: a takeaway just placed, two deliveries (one ready, one out), the dine-in rounds from before
  save("orders-mixed", must(await waiter("GET", "/api/orders?limit=100"), "orders mixed"));
  // a completed dine-in order put back by hand while its table has another party: the server answers 409 + the free tables
  const done = must(await waiter("GET", "/api/orders?limit=100"), "orders").orders.find((o) => o.channel === "dine-in");
  if (done) {
    await raw("orders").updateOne({ _id: oid(done.id) }, { $set: { status: "completed" } });
    const reopen = await waiter("PATCH", `/api/orders/${done.id}/status/manual`, { status: "preparing" });
    if (reopen.status === 409) save("error-manual-table-taken", { status: reopen.status, ...reopen.json });
  }
  // the owner deletes an order (the staff role may not)
  const doomed = await asCustomer("takeaway", [{ itemId: chaiItem.id, quantity: 1, modifierOptionIds: [] }], { name: "Test Delete", phone: "9000000001", paid: false, cod: true });
  const refused = await waiter("DELETE", `/api/orders/${doomed.id}`);
  save("error-delete-forbidden", { status: refused.status, ...refused.json });
  save("order-deleted", must(await own("DELETE", `/api/orders/${doomed.id}`), "delete"));
} finally {
  server.close();
  await mongod.stop();
}
process.exit(0);
