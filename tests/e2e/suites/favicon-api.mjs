// Throwaway API on an in-memory database (nothing real is touched), seeded through the real API,
// then API checks for the favicon rules, then it keeps serving for browser checks (READY line).
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { fileURLToPath as __f } from "node:url";
import { mkdirSync as __mk } from "node:fs";
const REPO = __f(new URL("../../..", import.meta.url)).replace(/\/$/, "");
const API = `${REPO}/apps/api`;
const PORT = 3099;
const __RUN = __f(new URL("../.bench/suite-run/", import.meta.url));
__mk(__RUN, { recursive: true });
process.chdir(__RUN); // no .env here → the real database URI is never read
const req = createRequire(`${API}/package.json`);
const mms = await import(pathToFileURL(req.resolve("mongodb-memory-server")).href);
const mongod = await (mms.MongoMemoryServer ?? mms.default.MongoMemoryServer).create();
Object.assign(process.env, { NODE_ENV: "development", API_PORT: String(PORT), MONGODB_URI: mongod.getUri(), MONGODB_DB: "sandbox", CORS_ORIGINS: "http://localhost:3170,http://localhost:3171" });
const db = await import(`${REPO}/packages/db/src/index.js`);
await db.connectDb({ uri: mongod.getUri(), dbName: "sandbox" });
const { createApp } = await import(`${API}/src/app.js`);
const server = createApp().listen(PORT);
await new Promise((r) => server.once("listening", r));
const { ensureSuperAdmin } = await import(`${API}/src/modules/auth/auth.service.js`);
await ensureSuperAdmin({ email: "super@sandbox.test", name: "Super", password: "Super123!" });

const base = `http://127.0.0.1:${PORT}`;
const call = async (method, path, { body, cookie, outlet } = {}) => {
  const r = await fetch(base + path, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...(outlet ? { "x-onetap-outlet": outlet } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text(); let json = {}; try { json = JSON.parse(text); } catch {}
  return { status: r.status, json };
};
const login = async (email, password) => (await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) })).headers.get("set-cookie")?.split(";")[0];
const must = async (p, what) => { const r = await p; if (r.status >= 400) { console.error("SETUP FAILED", what, r.status, JSON.stringify(r.json).slice(0, 300)); process.exit(1); } return r; };

let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };

const su = await login("super@sandbox.test", "Super123!");
// store A: no plan (everything unlocked), served on localhost:3170
const a = (await must(call("POST", "/api/brands", { cookie: su, body: { brandName: "Acme Momos", brandSlug: "acme", outletName: "Main", outletSlug: "main", hostnames: ["localhost:3170"], ownerEmail: "o@acme.test", ownerName: "Owner", ownerPassword: "Owner123!" } }), "store A")).json;
const outletA = String(a.outlet?._id ?? a.outlet?.id ?? a.outletId);
const owner = await login("o@acme.test", "Owner123!");
// store B: a plan WITHOUT the favicon feature
const { FEATURE_KEYS } = await import(`${REPO}/packages/config-schema/src/index.js`);
const plan = (await must(call("POST", "/api/platform/plans", { cookie: su, body: { name: "No favicon", entitlements: { features: FEATURE_KEYS.filter((k) => k !== "favicon") } } }), "plan")).json.plan;
const b = (await must(call("POST", "/api/brands", { cookie: su, body: { brandName: "Beta", brandSlug: "beta", outletName: "Only", outletSlug: "only", hostnames: ["beta.test"], ownerEmail: "o@beta.test", ownerName: "B", ownerPassword: "Owner123!", planId: String(plan._id ?? plan.id) } }), "store B")).json;
const outletB = String(b.outlet?._id ?? b.outlet?.id ?? b.outletId);
const ownerB = await login("o@beta.test", "Owner123!");

// menu: many categories, so the phone category sheet has something to show
const cats = ["Steamed Momos", "Kurkure Momos", "Tandoori Momos", "Gravy Momos", "Fried Momos", "Pan Fried Momos", "Soups", "Noodles", "Combos", "Beverages", "Desserts"];
let n = 0;
for (const name of cats) {
  const c = (await must(call("POST", "/api/menu/categories", { cookie: owner, outlet: outletA, body: { name, sortOrder: n } }), "cat")).json.category;
  for (let i = 0; i < 4; i++) await must(call("POST", "/api/menu/items", { cookie: owner, outlet: outletA, body: { categoryId: String(c.id ?? c._id), name: `${name.split(" ")[0]} ${i + 1}`, basePrice: 9900 + i * 1000, foodType: i % 2 ? "non-veg" : "veg" } }), "item");
  n++;
}
// message bar: one message with a button, one without (the jump the user saw), in the "with button" style
await must(call("PATCH", `/api/outlets/${outletA}/config`, { cookie: owner, outlet: outletA, body: {
  identity: { name: "Acme Momos", phone: "+91 98765 43210" },
  announcement: { enabled: true, dismissible: false, rotateSeconds: 3, messages: [
    { id: "m1", text: "Flat 20% off on order above 599", linkLabel: "Order Now", linkHref: "#menu" },
    { id: "m2", text: "Fresh momos, steamed to order", linkLabel: "", linkHref: "" },
  ] },
  layout: { announcementVariant: "announcement.button" },
} }), "bar");

const FAV = "data:image/svg+xml," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><circle cx='8' cy='8' r='8' fill='%23c6362f'/></svg>");
console.log("== favicon");
let r = await call("PATCH", `/api/outlets/${outletA}/config`, { cookie: owner, outlet: outletA, body: { branding: { faviconUrl: FAV } } });
ok(r.status === 200 && r.json.config?.branding?.faviconUrl === FAV, "a store whose plan includes it can set a favicon", String(r.status));
const second = (await must(call("POST", "/api/outlets", { cookie: owner, body: { name: "Second", slug: "second" } }), "outlet 2")).json.outlet;
const outletA2 = String(second._id ?? second.id);
const pub = async (slug, host = "localhost:3170") => (await call("GET", `/api/outlets/resolve?host=${encodeURIComponent(host)}&slug=${slug}`)).json.outlet?.config;
ok((await pub("main"))?.branding?.faviconUrl === FAV, "the public config carries it");
ok((await pub("second"))?.branding?.faviconUrl === FAV, "…and a NEW outlet of the same store has it too — one favicon for the whole store");
r = await call("PATCH", `/api/outlets/${outletA2}/config`, { cookie: owner, outlet: outletA2, body: { branding: { faviconUrl: "" } } });
ok(r.status === 200 && (await pub("main"))?.branding?.faviconUrl === "", "removing it on any outlet removes it for the store");
await call("PATCH", `/api/outlets/${outletA}/config`, { cookie: owner, outlet: outletA, body: { branding: { faviconUrl: FAV } } });
r = await call("PATCH", `/api/outlets/${outletB}/config`, { cookie: ownerB, outlet: outletB, body: { branding: { faviconUrl: FAV } } });
ok(r.status === 403 && /favicon/i.test(r.json.error ?? ""), "a plan without the feature can't set one", `${r.status} ${r.json.error}`);
// set it behind the plan's back, then check the public side hides it
const brandB = String(b.brand?._id ?? b.brand?.id ?? b.brandId);
await db.mongoose.connection.db.collection("brands").updateOne({ _id: new db.mongoose.Types.ObjectId(brandB) }, { $set: { appearance: { branding: { faviconUrl: FAV } } } });
const { cache } = await import(`${API}/src/modules/cache/cache.js`);
cache.expireAll();
ok((await pub("only", "beta.test"))?.branding?.faviconUrl === "", "…and even if one is stored, visitors don't get it while the plan lacks the feature");
r = await call("PATCH", `/api/platform/stores/${brandB}/plan`, { cookie: su, body: { planId: String(plan._id ?? plan.id), overrides: { entitlements: { features: { unlock: ["favicon"] } } } } });
cache.expireAll();
ok(r.status === 200 && (await pub("only", "beta.test"))?.branding?.faviconUrl === FAV, "switching the feature on for that ONE store (override) shows it", String(r.status));
r = await call("PATCH", `/api/outlets/${outletA}/config`, { cookie: owner, outlet: outletA, body: { layout: { announcementVariant: "announcement.button" } } });
ok(r.status === 200, "other appearance saves still work");
console.log(`TOTAL ${pass} passed, ${fail} failed`);
process.exit(0);
