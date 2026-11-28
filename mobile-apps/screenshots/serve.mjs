#!/usr/bin/env node
/**
 * A throwaway copy of the REAL API (same code, an in-memory database) filled with a believable, fictional restaurant — "Saffron Table" — so the
 * apps can be photographed with something worth looking at: a full menu with photos, tables with guests seated, kitchen tickets of different ages,
 * deliveries on a rider's list. Nothing here touches a real database or the live server.
 *
 *   node mobile-apps/screenshots/serve.mjs            start it and keep it running (Ctrl+C stops it)
 *
 * It listens on 127.0.0.1:3098 only. An emulator reaches it through `adb reverse tcp:3098 tcp:3098` (capture.mjs does that), so the apps
 * are built to talk to http://localhost:3098 and nothing is opened to the network.
 *
 * Also imported by capture.mjs (`startShotsApi`).
 */
import { createRequire } from "node:module";
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const REPO = join(HERE, "../..");
const API = join(REPO, "apps/api");

export const SHOTS_PORT = 3098;
export const API_URL = `http://localhost:${SHOTS_PORT}`;
export const STORE = { name: "Saffron Table", slug: "saffron-table", outlet: "Noida", outletSlug: "noida" };
/** Who signs in to each app (all fictional, all on the throwaway server). */
export const LOGINS = {
  oma: { email: "asha@saffrontable.test", password: "Staff123!", who: "Asha (waiter)" },
  kda: { email: "meena@saffrontable.test", password: "Staff123!", who: "Meena (kitchen manager)" },
  rda: { phone: "9876543210", pin: "4821", who: "Ramesh (rider)" },
  business: { email: "owner@saffrontable.test", password: "Owner123!", who: "the owner" },
};

const FOOD = { steamed: "steamed.webp", paneer: "paneer.webp", tandoori: "tandoori.webp", coffee: "cold-coffee.webp" };

export async function startShotsApi({ log = () => undefined } = {}) {
  const run = mkdtempSync(join(tmpdir(), "rp-shots-"));
  const uploads = join(run, "uploads");
  mkdirSync(uploads, { recursive: true });
  for (const f of readdirSync(join(REPO, "apps/website/public/food"))) copyFileSync(join(REPO, "apps/website/public/food", f), join(uploads, f));
  process.chdir(run); // no .env here: the real database address is never read

  const req = createRequire(`${API}/package.json`);
  const mms = await import(pathToFileURL(req.resolve("mongodb-memory-server")).href);
  const mongod = await (mms.MongoMemoryServer ?? mms.default.MongoMemoryServer).create();
  Object.assign(process.env, {
    NODE_ENV: "development", API_PORT: String(SHOTS_PORT), MONGODB_URI: mongod.getUri(), MONGODB_DB: "sandbox", LOG_LEVEL: "silent",
    PUBLIC_API_URL: API_URL, UPLOADS_DIR: "uploads", /* relative to the folder we chdir into (the API joins it to the current directory) */ WEBSITE_URL: "https://rasoipulse.in", RATE_LIMITS: "off",
  });
  const db = await import(`${REPO}/packages/db/src/index.js`);
  await db.connectDb({ uri: mongod.getUri(), dbName: "sandbox" });
  const { env } = await import(`${API}/src/env.js`);
  const { logger } = await import(`${API}/src/logger.js`);
  logger.level = "silent";
  const { createApp } = await import(`${API}/src/app.js`);
  const { ensureSuperAdmin } = await import(`${API}/src/modules/auth/auth.service.js`);
  const server = createApp().listen(SHOTS_PORT, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  await ensureSuperAdmin({ email: "super@saffrontable.test", name: "Platform Admin", password: "Super123!" });
  env.RATE_LIMITS = "off";

  const base = `http://127.0.0.1:${SHOTS_PORT}`;
  let ipn = 10;
  const call = async (method, path, { body, cookie, bearer, headers = {} } = {}) => {
    const r = await fetch(base + path, { method, headers: { "content-type": "application/json", "x-forwarded-for": `198.51.100.${(ipn = (ipn % 240) + 1)}`, ...(cookie ? { cookie } : {}), ...(bearer ? { authorization: `Bearer ${bearer}` } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
    const text = await r.text();
    let json = {};
    try { json = JSON.parse(text); } catch { /* an empty answer */ }
    return { status: r.status, json, headers: r.headers };
  };
  const must = (r, what) => { if (r.status >= 400) throw new Error(`seeding failed at "${what}": ${r.status} ${JSON.stringify(r.json).slice(0, 300)}`); return r.json; };
  const login = async (email, password) => (await call("POST", "/api/auth/login", { body: { email, password } })).headers.get("set-cookie").split(";")[0];
  const raw = (c) => db.mongoose.connection.db.collection(c);
  const oid = (s) => new db.mongoose.Types.ObjectId(String(s));

  /* ---------------------------------------------------------------- the store, its team and its menu */
  const su = await login("super@saffrontable.test", "Super123!");
  const made = must(await call("POST", "/api/brands", { cookie: su, body: { brandName: STORE.name, brandSlug: STORE.slug, outletName: STORE.outlet, outletSlug: STORE.outletSlug, hostnames: ["saffrontable.test"], ownerEmail: "owner@saffrontable.test", ownerName: "Owner", ownerPassword: "Owner123!" } }), "brand");
  const brand = String(made.brand?._id ?? made.brand?.id ?? made.brandId);
  const outlet = String(made.outlet?._id ?? made.outlet?.id ?? made.outletId);
  const owner = await login("owner@saffrontable.test", "Owner123!");
  const hdr = { "x-rasoipulse-outlet": outlet };
  const own = (method, path, body) => call(method, path, { cookie: owner, headers: hdr, body });
  must(await own("PATCH", `/api/outlets/${outlet}/config`, { identity: { name: `${STORE.name} ${STORE.outlet}`, location: { point: { lat: 28.5355, lng: 77.391 } } }, features: { ordering: { delivery: true } }, operations: { limits: { deliveryRadiusKm: 6 } } }), "outlet config");
  const user = async (email, name, role) => must(await call("POST", "/api/users", { cookie: owner, headers: { "x-rasoipulse-brand": brand }, body: { email, name, password: "Staff123!", role } }), `user ${email}`);
  await user(LOGINS.oma.email, "Asha", "staff");
  await user(LOGINS.kda.email, "Meena", "manager");
  await user("ravi@saffrontable.test", "Ravi", "kitchen");

  const cat = async (name, extra = {}) => must(await own("POST", "/api/menu/categories", { name, ...extra }), `category ${name}`).category;
  const momos = await cat("Momos");
  const starters = await cat("Starters");
  const mains = await cat("Noodles & Rice");
  const drinks = await cat("Drinks", { prepStation: "bar" });
  const desserts = await cat("Desserts");
  const group = async (body) => must(await own("POST", "/api/menu/modifier-groups", body), `group ${body.name}`).group;
  const dip = await group({ name: "Extra dip", required: false, minSelect: 0, maxSelect: 2, options: [{ label: "Mayo dip", priceDelta: 1000 }, { label: "Schezwan dip", priceDelta: 1500 }] });
  const spice = await group({ name: "Spice level", required: true, minSelect: 1, maxSelect: 1, options: [{ label: "Mild", priceDelta: 0 }, { label: "Medium", priceDelta: 0 }, { label: "Hot", priceDelta: 0 }] });
  const photo = (file) => ({ images: [{ url: `/uploads/${file}`, key: file, ratio: "1:1" }] });
  const dish = async (categoryId, name, foodType, basePrice, more = {}) => must(await own("POST", "/api/menu/items", { categoryId, name, foodType, basePrice, ...more }), `item ${name}`).item;
  const veg = await dish(momos.id, "Veg Steamed Momos", "veg", undefined, { description: "Cabbage, carrot and herbs", tags: ["bestseller"], variants: [{ label: "Half (4 pcs)", price: 6000 }, { label: "Full (8 pcs)", price: 9000 }], modifierGroupIds: [dip.id], ...photo(FOOD.steamed) });
  const paneer = await dish(momos.id, "Paneer Tandoori Momos", "veg", 13000, { description: "Smoky, charred, with mint chutney", tags: ["bestseller"], modifierGroupIds: [dip.id], ...photo(FOOD.paneer) });
  const chickenT = await dish(momos.id, "Chicken Tandoori Momos", "non-veg", 15000, { description: "Tandoor-roasted with spiced curd", modifierGroupIds: [dip.id], ...photo(FOOD.tandoori) });
  const kurkure = await dish(momos.id, "Chicken Kurkure Momos", "non-veg", 14000, { description: "Crispy fried, juicy inside", tags: ["spicy"], modifierGroupIds: [dip.id, spice.id] });
  await dish(momos.id, "Corn Cheese Momos", "veg", 11000, { description: "Sweet corn and molten cheese", stock: { tracked: true, left: 2, daily: 20, lowAt: 3 } });
  await dish(momos.id, "Peri Peri Momos", "veg", 12000, { description: "Tossed in peri peri masala", stock: { tracked: true, left: 0, daily: 20, lowAt: 3 } });
  await dish(momos.id, "Afghani Malai Momos", "veg", 14000, { description: "Creamy, mild and rich" });
  await dish(momos.id, "Jhol Momos", "non-veg", 13000, { description: "In a tangy sesame-tomato broth", tags: ["spicy"] });
  const chilliPaneer = await dish(starters.id, "Chilli Paneer", "veg", 18000, { description: "Dry, with peppers and spring onion" });
  await dish(starters.id, "Honey Chilli Potato", "veg", 15000, { description: "Crisp, sticky and sweet-hot" });
  await dish(starters.id, "Chicken 65", "non-veg", 19000, { description: "South Indian style, curry leaf", tags: ["spicy"] });
  await dish(starters.id, "Crispy Spring Rolls", "veg", 12000);
  const noodles = await dish(mains.id, "Veg Hakka Noodles", "veg", 14000, { description: "Wok-tossed, smoky" });
  await dish(mains.id, "Schezwan Noodles", "veg", 15000, { tags: ["spicy"] });
  const rice = await dish(mains.id, "Chicken Fried Rice", "non-veg", 17000);
  await dish(mains.id, "Veg Thukpa", "veg", 16000, { description: "Himalayan noodle soup" });
  await dish(mains.id, "Chicken Thukpa", "non-veg", 19000);
  const chai = await dish(drinks.id, "Masala Chai", "veg", 3000);
  const coffee = await dish(drinks.id, "Cold Coffee", "veg", 8000, { description: "Thick, with ice cream", isAvailable: false, ...photo(FOOD.coffee) });
  const lime = await dish(drinks.id, "Fresh Lime Soda", "veg", 7000);
  const lassi = await dish(drinks.id, "Mango Lassi", "veg", 9000, { tags: ["bestseller"] });
  await dish(drinks.id, "Iced Tea", "veg", 8000);
  await dish(desserts.id, "Chocolate Brownie", "veg", 12000, { description: "Warm, with a scoop of vanilla" });
  await dish(desserts.id, "Fried Ice Cream", "veg", 14000);

  const zones = [["Ground floor", [["T1", 4], ["T2", 2], ["T3", 6], ["T4", 4], ["T5", 4]]], ["Terrace", [["T6", 4], ["T7", 4], ["T8", 2]]], ["Family hall", [["T9", 8], ["T10", 6]]]];
  for (const [zone, list] of zones) for (const [number, seats] of list) must(await own("POST", "/api/tables", { number, zone, seats }), `table ${number}`);
  const tables = must(await own("GET", "/api/tables"), "tables").tables;
  const table = (n) => tables.find((t) => t.number === n);
  const menu = must(await own("GET", `/api/menu?outletId=${outlet}`), "menu");
  const grp = (name) => menu.modifierGroups.find((g) => g.name === name);
  const vegFull = menu.items.find((i) => i.id === veg.id).variants[1].id;
  const vegHalf = menu.items.find((i) => i.id === veg.id).variants[0].id;
  const L = (itemId, quantity, extra = {}) => ({ itemId, quantity, modifierOptionIds: [], ...extra });
  log("menu, tables and team created");

  /* ---------------------------------------------------------------- dine-in: guests at the tables, orders at different stages */
  const waiter = must(await call("POST", "/api/auth/app-login", { headers: { "x-app-id": "oma" }, body: { email: LOGINS.oma.email, password: LOGINS.oma.password } }), "waiter sign-in").token;
  const sit = async (tableNo, lines, who, phone, note) => must(await call("POST", "/api/orders/staff", { bearer: waiter, headers: hdr, body: { tableId: table(tableNo).id, cart: { lines }, name: who, phone, ...(note ? { note } : {}), expectedSessionId: null } }), `order ${tableNo}`);
  const more = async (tableNo, lines) => {
    const sessions = must(await call("GET", "/api/tables/sessions/active", { bearer: waiter, headers: hdr }), "sessions").sessions;
    const s = sessions.find((x) => x.tableNumber === tableNo);
    return must(await call("POST", "/api/orders/staff", { bearer: waiter, headers: hdr, body: { tableId: table(tableNo).id, cart: { lines }, expectedSessionId: s.id } }), `second round ${tableNo}`);
  };
  const idOf = (placed) => String(placed.order?.id ?? placed.order?._id ?? placed.orders?.[0]?.id);
  const stage = async (orderId, to, screen = "all") => must(await call("POST", `/api/kitchen/orders/${orderId}/stage`, { cookie: owner, headers: hdr, body: { screen, stage: to } }), `stage ${to}`);
  /** make an order look like it was accepted `minutes` ago (the kitchen board's timers and the orders list read these) */
  const age = async (orderId, minutes) => {
    const o = await raw("orders").findOne({ _id: oid(orderId) });
    const shift = (d) => new Date(new Date(d).getTime() - minutes * 60_000);
    await raw("orders").updateOne({ _id: oid(orderId) }, { $set: { createdAt: shift(o.createdAt), statusHistory: (o.statusHistory ?? []).map((h) => ({ ...h, at: shift(h.at) })) } });
  };

  const o1 = await sit("T1", [L(veg.id, 2, { variantId: vegFull, modifierOptionIds: [grp("Extra dip").options[0].id], note: "less salt" }), L(kurkure.id, 1, { modifierOptionIds: [grp("Spice level").options[1].id] }), L(chai.id, 2)], "Mehta family", "9876543210", "birthday table, please bring everything together");
  await age(idOf(o1), 2);
  const o2 = await sit("T2", [L(paneer.id, 2), L(lime.id, 2)], "Sita Verma", "9876599999");
  await age(idOf(o2), 14); await stage(idOf(o2), "preparing"); await stage(idOf(o2), "ready", "all");
  const o3 = await sit("T4", [L(veg.id, 1, { variantId: vegHalf }), L(chilliPaneer.id, 1), L(noodles.id, 1)], "Rohan & friends", "9811100022");
  await age(idOf(o3), 1);
  const o4 = await sit("T6", [L(chickenT.id, 2, { modifierOptionIds: [grp("Extra dip").options[1].id] }), L(rice.id, 1), L(lassi.id, 3), L(kurkure.id, 1, { modifierOptionIds: [grp("Spice level").options[2].id] })], "Karan Singh", "9899955512", "no onion in the rice");
  await age(idOf(o4), 8); await stage(idOf(o4), "preparing");
  const o5 = await sit("T9", [L(veg.id, 3, { variantId: vegFull }), L(paneer.id, 2), L(chilliPaneer.id, 2), L(noodles.id, 2), L(chai.id, 4)], "Gupta family", "9810012345", "grandparents with us: mild please");
  await age(idOf(o5), 12); await stage(idOf(o5), "preparing");
  const o6 = await sit("T7", [L(lassi.id, 2), L(lime.id, 1)], "Priya", "9818899001");
  await age(idOf(o6), 4);
  await more("T7", [L(paneer.id, 1)]).then((r) => age(idOf(r), 3));
  log("guests seated, orders at different stages");

  /* ---------------------------------------------------------------- deliveries for the rider (the same shape the rider app's tests use) */
  const ramesh = must(await own("POST", "/api/riders", { name: "Ramesh", phone: "98765 43210" }), "rider").rider;
  const suresh = must(await own("POST", "/api/riders", { name: "Suresh", phone: "98111 22233" }), "rider 2").rider;
  must(await own("PUT", `/api/riders/${ramesh.id}/pin`, { pin: LOGINS.rda.pin }), "pin");
  must(await own("PUT", `/api/riders/${suresh.id}/pin`, { pin: "9090" }), "pin 2");
  let phoneNo = 0;
  const deliver = async (lines, where, name, to, rider, sendOut, minutes) => {
    const order = must(await own("POST", "/api/orders", { outletId: outlet, channel: "delivery", name, cart: { lines }, deliveryAddress: where, gateway: "mock" }), `delivery ${name}`).order;
    await raw("orders").updateOne({ _id: oid(order.id) }, { $set: { "customer.phone": `98765${String(++phoneNo + 20).padStart(5, "0")}`, "customer.name": name, "payment.status": "paid" } });
    for (const s of ["accepted", "preparing", "ready"].slice(0, ["accepted", "preparing", "ready"].indexOf(to) + 1)) must(await own("PATCH", `/api/orders/${order.id}/status`, { status: s }), `status ${s}`);
    must(await own("PATCH", `/api/orders/${order.id}/rider`, { riderId: rider.id, sendOut }), "assign");
    await age(order.id, minutes);
    return order;
  };
  const near = (dy, dx) => ({ lat: 28.5355 + dy, lng: 77.391 + dx });
  const d1 = await deliver([L(paneer.id, 1), L(chai.id, 2)], { text: "B-14, Sector 18, Noida", landmark: "Sector 18 metro station", ...near(0.01, 0.006) }, "Neha Gupta", "ready", ramesh, true, 18);
  await deliver([L(veg.id, 2, { variantId: vegFull }), L(chai.id, 2)], { text: "House 220, Sector 50, Noida", landmark: "Green park", ...near(-0.02, 0.015) }, "Aarav Mehta", "ready", ramesh, true, 11);
  await deliver([L(lassi.id, 3), L(kurkure.id, 1, { modifierOptionIds: [grp("Spice level").options[0].id] })], { text: "Flat 4B, Tower C, Sector 62, Noida", ...near(0.03, -0.01) }, "Karan Malhotra", "ready", ramesh, false, 7);
  await deliver([L(paneer.id, 2), L(chilliPaneer.id, 1)], { text: "Shop 9, Sector 16 market, Noida", landmark: "Apollo pharmacy", ...near(0.005, 0.02) }, "Sita Verma", "preparing", ramesh, false, 4);
  await deliver([L(chai.id, 1)], { text: "Sector 15A, Noida", ...near(0.008, 0.002) }, "Someone else", "ready", suresh, false, 6);
  // one already delivered today (it shows under "Done")
  const done = await deliver([L(noodles.id, 1), L(lime.id, 1)], { text: "A-1, Sector 19, Noida", landmark: "Gate 2", ...near(0.012, -0.004) }, "Divya Rao", "ready", ramesh, true, 40);
  const doneCode = (await raw("orders").findOne({ _id: oid(done.id) })).deliveryCode;
  const rt = must(await call("POST", "/api/rider/login", { headers: { "x-app-id": "rda" }, body: { phone: LOGINS.rda.phone, pin: LOGINS.rda.pin } }), "rider sign-in").token;
  must(await call("POST", `/api/rider/deliveries/${done.id}/delivered`, { bearer: rt, headers: { "x-app-id": "rda" }, body: { code: doneCode } }), "deliver one");
  void d1;
  log("deliveries created");

  return {
    base, outlet, brand, call,
    stop: async () => { server.closeAllConnections?.(); server.close(); await db.disconnectDb(); await mongod.stop(); },
  };
}

/* ------------------------------------------------------------------ run on its own */
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const api = await startShotsApi({ log: (m) => console.log(`  ${m}`) });
  console.log(`\n${STORE.name} is serving on ${API_URL} (this machine only).`);
  console.log(`  OMA  ${LOGINS.oma.email} / ${LOGINS.oma.password}\n  KDA  ${LOGINS.kda.email} / ${LOGINS.kda.password}\n  RDA  phone ${LOGINS.rda.phone}, PIN ${LOGINS.rda.pin}\nCtrl+C to stop.`);
  process.on("SIGINT", async () => { await api.stop(); process.exit(0); });
}
