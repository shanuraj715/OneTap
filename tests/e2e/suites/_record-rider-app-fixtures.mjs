// Records the REAL answers of the API for everything the Rider app (RDA) calls, into mobile-apps/rda/test/fixtures/*.json. The app's
// tests read these files, so they check the app against the server's real data shapes (a contract), not against shapes someone guessed.
// Run it when an endpoint the app uses changes:   node tests/e2e/suites/_record-rider-app-fixtures.mjs
// (It only writes its own files; the other apps record theirs.)
import { createRequire } from "node:module";
import { pathToFileURL, fileURLToPath as __f } from "node:url";
import { mkdirSync as __mk, writeFileSync } from "node:fs";
const REPO = __f(new URL("../../..", import.meta.url)).replace(/\/$/, "");
const API = `${REPO}/apps/api`;
const OUT = `${REPO}/mobile-apps/rda/test/fixtures`;
const PORT = 3116;
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
const RDA = { "x-app-id": "rda" };
const call = async (method, path, { body, cookie, bearer, headers = {} } = {}) => {
  const r = await fetch(base + path, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...(bearer ? { authorization: `Bearer ${bearer}` } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text(); let json = {}; try { json = JSON.parse(text); } catch { /* an empty answer */ }
  return { status: r.status, json, headers: r.headers };
};
const save = (name, value) => { writeFileSync(`${OUT}/${name}.json`, JSON.stringify(value, null, 2) + "\n"); console.log(`recorded ${name}.json`); };
const must = (r, what) => { if (r.status >= 400) { console.error("FAILED", what, r.status, JSON.stringify(r.json).slice(0, 300)); process.exit(1); } return r.json; };
const login = async (email, password) => (await call("POST", "/api/auth/login", { body: { email, password } })).headers.get("set-cookie").split(";")[0];
let ipn = 10;
const riderLogin = (phone, pin, extra = {}) => call("POST", "/api/rider/login", { headers: { ...RDA, "x-forwarded-for": `198.51.100.${(ipn = (ipn % 240) + 1)}`, ...extra }, body: { phone, pin } });
const raw = (c) => db.mongoose.connection.db.collection(c);
const oid = (s) => new db.mongoose.Types.ObjectId(String(s));
/** fixed, fake token + expiry, so the files don't change every time they are recorded */
const withToken = (answer, token) => ({ ...answer, token, expiresAt: "2026-12-10T00:00:00.000Z" });

try {
  const su = await login("super@sandbox.test", "Super123!");
  const a = must(await call("POST", "/api/brands", { cookie: su, body: { brandName: "Gazab Momos", brandSlug: "gazab-momos", outletName: "Noida", outletSlug: "noida", hostnames: ["noida.test"], ownerEmail: "owner@sandbox.test", ownerName: "Owner", ownerPassword: "Owner123!" } }), "brand");
  const brand = String(a.brand?._id ?? a.brand?.id ?? a.brandId);
  const outlet = String(a.outlet?._id ?? a.outlet?.id ?? a.outletId);
  const owner = await login("owner@sandbox.test", "Owner123!");
  const hdr = { "x-rasoipulse-outlet": outlet };
  const own = (method, path, body) => call(method, path, { cookie: owner, headers: hdr, body });
  must(await own("PATCH", `/api/outlets/${outlet}/config`, { identity: { name: "Gazab Momos Noida", location: { point: { lat: 28.5355, lng: 77.391 } } }, features: { ordering: { delivery: true } }, operations: { limits: { deliveryRadiusKm: 6 } } }), "outlet config");

  const momos = must(await own("POST", "/api/menu/categories", { name: "Momos" }), "category").category;
  const item = async (body) => must(await own("POST", "/api/menu/items", { categoryId: momos.id, foodType: "veg", ...body }), `item ${body.name}`).item;
  const veg = await item({ name: "Veg Steamed Momos", variants: [{ label: "Half (4 pcs)", price: 6000 }, { label: "Full (8 pcs)", price: 9000 }] });
  const chai = await item({ name: "Masala Chai", basePrice: 3000 });
  const paneer = await item({ name: "Paneer Tandoori Momos", basePrice: 13000 });
  const menu = must(await call("GET", `/api/menu?outletId=${outlet}`, { cookie: owner, headers: hdr }), "menu");
  const vegFull = menu.items.find((i) => i.id === veg.id).variants[1].id;

  const ramesh = must(await own("POST", "/api/riders", { name: "Ramesh", phone: "98765 43210" }), "rider").rider;
  const suresh = must(await own("POST", "/api/riders", { name: "Suresh", phone: "98111 22233" }), "rider 2").rider;
  must(await own("PUT", `/api/riders/${ramesh.id}/pin`, { pin: "4821" }), "pin");
  must(await own("PUT", `/api/riders/${suresh.id}/pin`, { pin: "9090" }), "pin 2");

  let phoneNo = 0;
  const place = async (lines, where, extra = {}) => {
    const order = must(await own("POST", "/api/orders", { outletId: outlet, channel: "delivery", name: extra.name ?? "Guest", cart: { lines }, deliveryAddress: where, gateway: "mock" }), "order").order;
    // a customer's own order carries their mobile number (a staff-placed one doesn't) and a delivery is paid online first: give these both, as they would have
    await raw("orders").updateOne({ _id: oid(order.id) }, { $set: { "customer.phone": `98765${String(++phoneNo).padStart(5, "0")}`, "customer.name": extra.name ?? "Guest", "payment.status": "paid" } });
    return order;
  };
  const status = async (id, to) => must(await own("PATCH", `/api/orders/${id}/status`, { status: to }), `status ${to}`);
  const give = async (id, rider, sendOut = false) => must(await own("PATCH", `/api/orders/${id}/rider`, { riderId: rider.id, sendOut }), "assign");
  const upTo = async (id, last) => { for (const s of ["accepted", "preparing", "ready"].slice(0, ["accepted", "preparing", "ready"].indexOf(last) + 1)) await status(id, s); };
  const near = (dy, dx) => ({ lat: 28.5355 + dy, lng: 77.391 + dx });

  // today: one already delivered, one out for delivery, one ready to pick up, one still being made, and another rider's
  const o1 = await place([{ itemId: paneer.id, quantity: 1, modifierOptionIds: [] }], { text: "B-14, Sector 18, Noida", landmark: "Opposite the metro station", ...near(0.01, 0.006) }, { name: "Neha Gupta" });
  await upTo(o1.id, "ready"); await give(o1.id, ramesh, true);
  const code1 = (await raw("orders").findOne({ _id: oid(o1.id) })).deliveryCode;
  const o2 = await place([{ itemId: veg.id, variantId: vegFull, quantity: 2, modifierOptionIds: [] }, { itemId: chai.id, quantity: 2, modifierOptionIds: [] }], { text: "House 220, Sector 50, Noida", landmark: "Near the green park", ...near(-0.02, 0.015) }, { name: "Mehta family" });
  await upTo(o2.id, "ready"); await give(o2.id, ramesh, true);
  const o3 = await place([{ itemId: chai.id, quantity: 3, modifierOptionIds: [] }], { text: "Flat 4B, Tower C, Sector 62, Noida", ...near(0.03, -0.01) }, { name: "Karan" });
  await upTo(o3.id, "ready"); await give(o3.id, ramesh);
  const o4 = await place([{ itemId: paneer.id, quantity: 2, modifierOptionIds: [] }], { text: "Shop 9, Sector 16 market, Noida", landmark: "Next to the pharmacy", ...near(0.005, 0.02) }, { name: "Sita Verma" });
  await upTo(o4.id, "preparing"); await give(o4.id, ramesh);
  const o5 = await place([{ itemId: chai.id, quantity: 1, modifierOptionIds: [] }], { text: "Sector 15A, Noida", ...near(0.008, 0.002) }, { name: "Someone else" });
  await upTo(o5.id, "ready"); await give(o5.id, suresh);
  const o6 = await place([{ itemId: chai.id, quantity: 1, modifierOptionIds: [] }], { text: "A-1, Sector 19, Noida", ...near(0.012, -0.004) }, { name: "Done earlier" });
  await upTo(o6.id, "ready"); await give(o6.id, ramesh, true);
  const code6 = (await raw("orders").findOne({ _id: oid(o6.id) })).deliveryCode;

  // ---- sign-in
  const good = await riderLogin("9876543210", "4821");
  must(good, "rider login");
  const tok = good.json.token;
  save("rider-login", withToken(good.json, "TEST-TOKEN-RIDER-0123456789"));
  save("auth-guard", must(await call("GET", "/api/auth/guard"), "guard"));
  save("error-wrong-pin", (await riderLogin("9876543210", "0000")).json);
  save("error-401", (await call("GET", "/api/rider/deliveries", { headers: RDA })).json);
  const rider = (method, path, body) => call(method, `/api/rider${path}`, { bearer: tok, headers: RDA, body });
  save("rider-me", must(await rider("GET", "/me"), "me"));

  // ---- mark one delivered earlier (it shows under "delivered today")
  must(await rider("POST", `/deliveries/${o6.id}/delivered`, { code: code6 }), "deliver o6");

  // ---- the list, then the steps
  const list = must(await rider("GET", "/deliveries"), "deliveries");
  save("deliveries", { ...list, now: 1795000000000 });
  const bad = await rider("POST", `/deliveries/${o4.id}/pickup`, {});
  save("error-not-ready", { status: bad.status, ...bad.json });
  save("delivery-picked-up", must(await rider("POST", `/deliveries/${o3.id}/pickup`, {}), "pickup"));
  const noCode = await rider("POST", `/deliveries/${o2.id}/delivered`, {});
  save("error-code-missing", { status: noCode.status, ...noCode.json });
  const wrong = await rider("POST", `/deliveries/${o2.id}/delivered`, { code: "0000" });
  save("error-code-wrong", { status: wrong.status, ...wrong.json });
  for (const g of ["1111", "2222", "3333", "4444"]) await rider("POST", `/deliveries/${o2.id}/delivered`, { code: g });
  const locked = await rider("POST", `/deliveries/${o2.id}/delivered`, { code: "9999" });
  save("error-code-locked", { status: locked.status, ...locked.json });
  save("delivery-delivered", must(await rider("POST", `/deliveries/${o1.id}/delivered`, { code: code1 }), "deliver o1"));

  // ---- switched off
  await own("PATCH", `/api/riders/${suresh.id}`, { isActive: false });
  const off = await riderLogin("9811122233", "9090");
  save("error-switched-off", { status: off.status, ...off.json });

  // ---- the update check, for THIS app (rda)
  const file = (v) => ({ name: `rda-${v}.apk`, key: `${v}.apk`, size: 3_400_000, sha256: "a".repeat(64) });
  const publish = (version, versionCode, notes, force) => db.AppReleaseModel.create({ app: "rda", platform: "android", version, versionCode, notes, force, status: "published", publishedAt: new Date("2026-11-27T10:00:00Z"), file: file(version) });
  const check = async (code) => must(await call("GET", `/api/app-updates/check?app=rda&platform=android&versionCode=${code}`), `check ${code}`);
  save("update-check-none", await check(1));
  await publish("v-26.11.28-002", 2, "Directions open faster\nThe list shows how far each delivery is", false);
  save("update-check-optional", await check(1));
  save("update-check-current", await check(2));
  await publish("v-26.11.29-003", 3, "Security fix: please update", true);
  save("update-check-required", await check(1));
  const old = await riderLogin("9876543210", "4821", { "x-app-version-code": "1" });
  if (old.status !== 426) { console.error("expected 426, got", old.status, JSON.stringify(old.json).slice(0, 200)); process.exit(1); }
  save("error-update-required", old.json);
} finally {
  server.close();
  await mongod.stop();
  process.exit(0);
}
