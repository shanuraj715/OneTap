// TEST BENCH API — a complete throwaway TablePe API on an in-memory database, seeded through the real API with two
// fake stores. Nothing real is touched: no .env is read (we chdir away), the database lives in memory and dies with
// this process. Run it, then use the admin console (:3171) and storefront (:3170) pointed at it.
//
//   Platform console   super@sandbox.test / Super123!
//   Acme Momos (Pro plan — every feature)       owner o@acme.test / Owner123!   manager m@acme.test / Manager123!
//                                               cashier s@acme.test / Staff1234!  kitchen k@acme.test / Kitchen123!
//     storefront  http://localhost:3170/main   (Main: takeaway + delivery + dine-in)     /second (takeaway only)
//   Beta Bites (Starter plan — takeaway, dine-in, coupons only)   owner o@beta.test / Owner123!
//     storefront  http://beta.localhost:3170/only
//   A customer can sign in with ANY phone number; the code is always 123456.
//   Returning customer with 50 coins: 9876543210 (Asha Rao).
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const API = `${REPO}/apps/api`;
const HERE = resolve(fileURLToPath(new URL("../.bench", import.meta.url))) + "/";
mkdirSync(HERE, { recursive: true });
process.chdir(HERE); // no .env here → the real database URI is never read; uploads go to .bench/.uploads
mkdirSync(`${HERE}.uploads`, { recursive: true });

const req = createRequire(`${API}/package.json`);
const mms = await import(pathToFileURL(req.resolve("mongodb-memory-server")).href);
const mongod = await (mms.MongoMemoryServer ?? mms.default.MongoMemoryServer).create();
Object.assign(process.env, {
  NODE_ENV: "development",
  API_PORT: "3097",
  MONGODB_URI: mongod.getUri(),
  MONGODB_DB: "bench",
  WHATSAPP_WORKER: "off",
  STORE_SUBDOMAIN_BASE: "localhost:3170", // store addresses like  acme.localhost:3170  (Chrome opens *.localhost with no DNS)
  CORS_ORIGINS: "http://localhost:3171,http://127.0.0.1:3171",
  PUBLIC_API_URL: "http://localhost:3097",
  STOREFRONT_ORIGIN: "http://localhost:3170",
  LOG_LEVEL: "warn",
});
const db = await import(`${REPO}/packages/db/src/index.js`);
await db.connectDb({ uri: mongod.getUri(), dbName: "bench" });
const { createApp } = await import(`${API}/src/app.js`);
const server = createApp().listen(3097);
await new Promise((r) => server.once("listening", r));
// the live order feed (/realtime) and the live menu preview, attached the way the real server.js does
(await import(`${API}/src/realtime/hub.js`)).attachRealtime(server);
(await import(`${API}/src/realtime/preview.js`)).attachPreview(server);
const { ensureSuperAdmin } = await import(`${API}/src/modules/auth/auth.service.js`);
await ensureSuperAdmin({ email: "super@sandbox.test", name: "Platform Admin", password: "Super123!" });
const { FEATURE_KEYS } = await import(`${REPO}/packages/config-schema/src/index.js`);

const base = "http://127.0.0.1:3097";
const call = async (method, path, { body, cookie, outlet, brand } = {}) => {
  const r = await fetch(base + path, {
    method,
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...(outlet ? { "x-onetap-outlet": outlet } : {}), ...(brand ? { "x-onetap-brand": brand } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  let j = {};
  try { j = JSON.parse(t); } catch { /* not json */ }
  if (r.status >= 400) { console.error("SETUP FAILED", method, path, r.status, t.slice(0, 300)); process.exit(1); }
  return j;
};
const login = async (email, password) => (await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) })).headers.get("set-cookie")?.split(";")[0];
const raw = (c) => db.mongoose.connection.db.collection(c);
const oid = (s) => new db.mongoose.Types.ObjectId(String(s));
const idOf = (o) => String(o?._id ?? o?.id);

/* --------------------------------------------------------------- pictures */
const svg = (a, b) => "data:image/svg+xml," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 4' preserveAspectRatio='none'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/></linearGradient></defs><rect width='8' height='4' fill='url(#g)'/></svg>`);
const logo = "data:image/svg+xml," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'><circle cx='60' cy='60' r='56' fill='#c6362f'/><path d='M30 70c0-20 14-34 30-34s30 14 30 34z' fill='white'/><rect x='26' y='72' width='68' height='10' rx='5' fill='white'/></svg>`);

const su = await login("super@sandbox.test", "Super123!");

/* ------------------------------------------------------------------ plans */
const ALL_EFFECTS = undefined; // omitted = every effect
const starter = (await call("POST", "/api/platform/plans", {
  cookie: su,
  body: {
    name: "Starter",
    description: "Takeaway, dine-in QR and coupons",
    limits: { maxUsers: 3, multiOutlet: false, maxOutlets: 1 },
    entitlements: { features: ["takeaway", "dineInQr", "coupons"], effects: [] },
  },
})).plan;
const pro = (await call("POST", "/api/platform/plans", { cookie: su, body: { name: "Pro", description: "Everything", entitlements: { features: FEATURE_KEYS } } })).plan;

/* ----------------------------------------------------------------- stores */
const A = await call("POST", "/api/brands", { cookie: su, body: { brandName: "Acme Momos", brandSlug: "acme", outletName: "Main", outletSlug: "main", hostnames: ["localhost:3170"], ownerEmail: "o@acme.test", ownerName: "Owner", ownerPassword: "Owner123!", planId: idOf(pro) } });
const brandA = idOf(A.brand) !== "undefined" ? idOf(A.brand) : String(A.brandId);
const main = idOf(A.outlet) !== "undefined" ? idOf(A.outlet) : String(A.outletId);
const ownerA = await login("o@acme.test", "Owner123!");
for (const [email, name, password, role] of [["m@acme.test", "Manager", "Manager123!", "manager"], ["s@acme.test", "Cashier", "Staff1234!", "staff"], ["k@acme.test", "Kitchen", "Kitchen123!", "kitchen"]]) {
  await call("POST", "/api/users", { cookie: ownerA, brand: brandA, body: { email, name, password, role } });
}
const second = idOf((await call("POST", "/api/outlets", { cookie: ownerA, body: { name: "Second", slug: "second" } })).outlet);
await raw("outlets").updateMany({ brandId: brandA }, { $set: { hostnames: ["localhost:3170"], canonicalHostname: "localhost:3170" } });

const B = await call("POST", "/api/brands", { cookie: su, body: { brandName: "Beta Bites", brandSlug: "beta", outletName: "Only", outletSlug: "only", hostnames: ["beta.localhost:3170"], ownerEmail: "o@beta.test", ownerName: "Beta Owner", ownerPassword: "Owner123!", planId: idOf(starter) } });
const brandB = idOf(B.brand) !== "undefined" ? idOf(B.brand) : String(B.brandId);
const only = idOf(B.outlet) !== "undefined" ? idOf(B.outlet) : String(B.outletId);
const ownerB = await login("o@beta.test", "Owner123!");

/* ---------------------------------------------------------- store settings */
const cfg = (outlet, cookie, body) => call("PATCH", `/api/outlets/${outlet}/config`, { cookie, outlet, body });
const place = (name, address, lat, lng, extra = {}) => ({
  identity: { name, tagline: "Steamed, fried and made to order", address, phone: "+91 98765 43210", email: "hello@acme.test", logoUrl: logo, location: { point: { lat, lng }, formattedAddress: address } },
  operations: { hours: { enabled: true, opensAt: "11:00", closesAt: "23:00" }, ...(extra.operations ?? {}) },
  features: { ordering: { takeaway: true, dineInQr: true, delivery: extra.delivery ?? false } },
  ...(extra.delivery ? { payments: { enabled: ["cod", "mock"] } } : {}),
  wallet: { enabled: true },
});
await cfg(main, ownerA, place("Acme Momos — Connaught Place", "12 Janpath, Connaught Place, New Delhi 110001", 28.6315, 77.2167, { delivery: true, operations: { limits: { deliveryRadiusKm: 5, deliveryFee: 3000, freeDeliveryAbove: 49900 } } }));
await cfg(second, ownerA, place("Acme Momos — Noida Sector 18", "Atta Market, Sector 18, Noida 201301", 28.5707, 77.3219));
await cfg(only, ownerB, {
  identity: { name: "Beta Bites", tagline: "Quick bites, fresh daily", address: "Shop 4, Hauz Khas Village, New Delhi", phone: "+91 91234 56789", location: { point: { lat: 28.5494, lng: 77.1944 }, formattedAddress: "Hauz Khas Village, New Delhi" } },
  features: { ordering: { takeaway: true, dineInQr: true, delivery: false } },
});

// the message bar + promo carousel + store pages (Main only)
await cfg(main, ownerA, {
  announcement: { enabled: true, showPhone: true, dismissible: true, rotateSeconds: 5, messages: [
    { id: "m1", text: "Free delivery on orders above ₹499", linkLabel: "Order now", linkHref: "#menu" },
    { id: "m2", text: "Fresh momos, steamed to order — open till 11 pm", linkLabel: "", linkHref: "" },
  ] },
  carousel: { enabled: true, autoplay: true, intervalSeconds: 5, showArrows: true, showDots: true, height: "regular", slides: [
    { id: "s1", imageUrl: svg("#c6362f", "#f2a65a"), title: "Festival feast", subtitle: "Buy 2 plates of momos, get a lassi free this weekend", ctaLabel: "Order now", ctaHref: "#menu" },
    { id: "s2", imageUrl: svg("#0f766e", "#84cc16"), title: "New: Kurkure momos", subtitle: "Crisp outside, juicy inside", ctaLabel: "See the menu", ctaHref: "#menu" },
    { id: "s3", imageUrl: svg("#4338ca", "#e879f9"), title: "Smoky tandoori momos", subtitle: "Char-grilled to order", ctaLabel: "", ctaHref: "" },
  ] },
});
// one favicon for the whole store (a store-level setting, shown on every outlet)
await cfg(main, ownerA, { branding: { faviconUrl: "data:image/svg+xml," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><circle cx='8' cy='8' r='8' fill='#c6362f'/></svg>") } });
await call("POST", "/api/pages/starter", { cookie: ownerA, outlet: main });
for (const p of (await call("GET", "/api/pages", { cookie: ownerA, outlet: main })).pages) {
  await call("PATCH", `/api/pages/${p.id}`, { cookie: ownerA, outlet: main, body: { status: "published", showInFooter: true } });
}

/* ------------------------------------------------------------------- menu */
const V = (a, b) => [{ label: "5 pcs", price: a }, { label: "8 pcs", price: b }];
const MENU = [
  ["Steamed Momos", [
    ["Veg Steamed Momos", "veg", V(6000, 9000), ["bestseller"]], ["Paneer Steamed Momos", "veg", V(8000, 12000), []],
    ["Chicken Steamed Momos", "non-veg", V(9000, 14000), ["bestseller"]], ["Corn Cheese Steamed Momos", "veg", V(9000, 13000), []],
  ]],
  ["Kurkure Momos", [
    ["Veg Kurkure Momos", "veg", V(8000, 12000), ["spicy"]], ["Chicken Kurkure Momos", "non-veg", V(10000, 15000), ["spicy"]],
    ["Paneer Kurkure Momos", "veg", V(10000, 15000), []], ["Chicken Cheese Momos", "non-veg", V(11000, 16000), [], false],
  ]],
  ["Tandoori Momos", [
    ["Veg Tandoori Momos", "veg", V(9000, 14000), []], ["Chicken Tandoori Momos", "non-veg", V(11000, 17000), ["spicy"]], ["Afghani Malai Momos", "veg", V(12000, 18000), []],
  ]],
  ["Gravy Momos", [
    ["Schezwan Gravy Momos", "veg", [{ label: "Plate", price: 11000 }], ["spicy"]], ["Butter Gravy Momos", "veg", [{ label: "Plate", price: 12000 }], []], ["Peri Peri Chicken Gravy", "non-veg", [{ label: "Plate", price: 13000 }], ["spicy"]],
  ]],
  ["Beverages", [
    ["Cold Coffee", "veg", null, [], true, 7000], ["Masala Coke", "veg", null, [], true, 4000], ["Sweet Lassi", "veg", null, [], true, 6000], ["Water Bottle", "veg", null, [], true, 2000],
  ]],
];
async function seedMenu(outlet, cookie, menu) {
  let order = 0;
  for (const [cat, items] of menu) {
    const c = (await call("POST", "/api/menu/categories", { cookie, outlet, body: { name: cat, sortOrder: order++ } })).category;
    let i = 0;
    for (const [name, foodType, variants, tags, available = true, price] of items) {
      await call("POST", "/api/menu/items", {
        cookie, outlet,
        body: { categoryId: idOf(c), name, description: `${name} — made fresh to order`, foodType, tags, isAvailable: available, sortOrder: i++, ...(variants ? { variants } : { basePrice: price }) },
      });
    }
  }
}
await seedMenu(main, ownerA, MENU);
await seedMenu(second, ownerA, MENU.slice(0, 2));
await seedMenu(only, ownerB, [["Burgers", [["Veg Burger", "veg", null, ["bestseller"], true, 9000], ["Chicken Burger", "non-veg", null, [], true, 12000]]], ["Shakes", [["Chocolate Shake", "veg", null, [], true, 11000], ["Mango Shake", "veg", null, [], true, 10000]]]]);

/* ------------------------------------------------------- coupons + tables */
for (const c of [
  { code: "SAVE20", description: "20% off up to ₹100", discountType: "percent", value: 20, maxDiscount: 10000, minOrderValue: 19900, maxPerCustomer: 0 },
  { code: "FLAT50", description: "₹50 off orders above ₹299", discountType: "fixed", value: 5000, minOrderValue: 29900, maxPerCustomer: 0 },
  { code: "WELCOME15", description: "15% off your first order", discountType: "percent", value: 15, newCustomersOnly: true, maxPerCustomer: 1 },
]) await call("POST", "/api/coupons", { cookie: ownerA, outlet: main, body: c });
await call("POST", "/api/coupons", { cookie: ownerB, outlet: only, body: { code: "BETA10", description: "10% off", discountType: "percent", value: 10, maxPerCustomer: 0 } });
for (const [n, z, s] of [["T1", "Ground floor", 4], ["T2", "Ground floor", 2], ["T3", "Ground floor", 6], ["T4", "Terrace", 4], ["T5", "Terrace", 4]]) await call("POST", "/api/tables", { cookie: ownerA, outlet: main, body: { number: n, zone: z, seats: s } });
for (const n of ["T1", "T2"]) await call("POST", "/api/tables", { cookie: ownerB, outlet: only, body: { number: n, seats: 4 } });

/* -------------------------------------------------------------- customers */
await raw("customers").insertOne({ brandId: brandA, phone: "9876543210", name: "Asha Rao", gender: "female", age: 29, walletBalance: 50, createdAt: new Date(), updatedAt: new Date() });

/* ------------------------------------------------- WhatsApp (worker is off) */
// Four numbers (online / offline / waiting for a QR scan / online) and five chats covering what the WhatsApp suites
// check: an ongoing chat with media, a month-old chat that opted out, a queued broadcast and a failed send.
const wa = async (label) => (await call("POST", "/api/whatsapp/accounts", { cookie: ownerA, outlet: main, body: { label } })).account.id;
await call("PUT", "/api/whatsapp/access", { cookie: ownerA, outlet: main, body: { access: { manager: "send", staff: "read" } } });
const counter = await wa("Counter phone");
const number2 = await wa("Number 2");
const pending = await wa("New phone");
const number3 = await wa("Number 3");
const today = new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
await raw("waaccounts").updateOne({ _id: oid(counter) }, { $set: { status: "connected", phone: "919000000001", pushName: "Acme Momos", seenAt: new Date(), linkedAt: new Date(), coldDay: today, coldCount: 4, orderDay: today, orderCount: 2 } });
await raw("waaccounts").updateOne({ _id: oid(number2) }, { $set: { status: "disconnected", phone: "919000000002", seenAt: new Date(Date.now() - 3600_000), linkedAt: new Date(), lastError: "Connection lost — trying again." } });
await raw("waaccounts").updateOne({ _id: oid(pending) }, { $set: { qr: "2@sandbox-qr-not-a-real-code,AbCdEf,GhIjKl,MnOpQr", qrAt: new Date() } });
await raw("waaccounts").updateOne({ _id: oid(number3) }, { $set: { status: "connected", phone: "919000000003", seenAt: new Date(), linkedAt: new Date() } });
setInterval(() => void raw("waaccounts").updateMany({ _id: { $in: [oid(counter), oid(number3)] } }, { $set: { seenAt: new Date() } }), 20_000); // the "worker"
const ago = (min) => new Date(Date.now() - min * 60000);
const wsvg = (c) => "data:image/svg+xml," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 4 3'><rect width='4' height='3' fill='${c}'/></svg>`);
const addChat = async (phone, name, accountId, msgs, extra = {}) => {
  const r = await raw("wachats").insertOne({ brandId: brandA, phone, name, accountId, createdAt: ago(3000), updatedAt: new Date(), unread: 0, ...extra });
  const id = String(r.insertedId);
  for (const m of msgs) await raw("wamessages").insertOne({ brandId: brandA, chatId: id, accountId, type: "text", text: "", media: null, source: "chat", pace: "warm", waId: "", error: "", sendAfter: new Date(), createdAt: new Date(), updatedAt: new Date(), ...m });
  const last = msgs[msgs.length - 1];
  await raw("wachats").updateOne({ _id: r.insertedId }, { $set: { lastMessageAt: last.at, lastPreview: last.text || "📎 photo", lastDirection: last.direction, ...(msgs.some((m) => m.direction === "in") ? { lastInboundAt: msgs.filter((m) => m.direction === "in").pop().at } : {}) } });
  return id;
};
await addChat("919876543210", "Riya Sharma", counter, [
  { direction: "in", text: "Hi! Do you deliver to Laxmi Nagar Block J?", status: "received", at: ago(1500) },
  { direction: "out", text: "Yes we do 🙂 Free delivery above ₹499.", status: "read", at: ago(1490) },
  { direction: "in", text: "Can you send the menu?", status: "received", at: ago(62) },
  { direction: "out", type: "image", text: "Here's today's menu", media: { url: wsvg("#c6362f"), key: "", mime: "image/svg+xml", fileName: "menu.svg", size: 2048 }, status: "delivered", waId: "WA-MENU", at: ago(60) },
  { direction: "out", type: "document", text: "", media: { url: "https://example.com/menu.pdf", key: "", mime: "application/pdf", fileName: "Full menu.pdf", size: 412000 }, status: "sent", at: ago(59) },
  { direction: "in", text: "Great, 2 plates of kurkure momos please\nand one cold coffee", status: "received", at: ago(3) },
], { unread: 1 });
await addChat("919833333333", "Kabir", number2, [
  { direction: "in", text: "Old question from last month", status: "received", at: ago(40 * 1440) },
  { direction: "out", text: "Old answer from last month", status: "read", waId: "WA-OLD", at: ago(40 * 1440 - 5) },
  { direction: "in", text: "Is the Preet Vihar outlet open today?", status: "received", at: ago(240) },
  { direction: "out", text: "Order #0042 at Acme Momos is Ready. Total ₹350.", status: "sent", source: "order", pace: "order", at: ago(200) },
]);
await addChat("919844444444", "", counter, [
  { direction: "out", text: "Diwali special: 20% off this weekend!\n\nReply STOP to stop offers.", status: "queued", source: "broadcast", pace: "cold", sendAfter: new Date(Date.now() + 14 * 3600_000), at: ago(30) },
]);
await addChat("919855555555", "Meera", counter, [
  { direction: "out", text: "Hello Meera, your table is booked for 8 pm.", status: "failed", error: "This number isn't on WhatsApp.", pace: "cold", at: ago(20) },
]);
// customers for the broadcast audience (Asha Rao above is the sixth)
await raw("customers").insertMany(["9833333333", "9844444444", "9855555555", "9866666666", "9877777777"].map((p, i) => ({ brandId: brandA, phone: p, name: `Customer ${i + 2}`, createdAt: new Date(), updatedAt: new Date() })));
await raw("wachats").updateOne({ phone: "919833333333" }, { $set: { optedOut: true } });

/* ------------------------------------------------------------------ done */
const ids = { brandA, main, second, brandB, only, planStarter: idOf(starter), planPro: idOf(pro) };
writeFileSync(`${HERE}ids.json`, JSON.stringify(ids, null, 2));
console.log("READY", JSON.stringify(ids));
setInterval(() => {}, 1 << 30);
