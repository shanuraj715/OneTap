// Sign-in for the staff Android app. The app has no browser cookie jar, so POST /api/auth/app-login hands back the session token in the answer
// and the app sends it as `Authorization: Bearer <token>`. It is the SAME session as the dashboard's cookie (same table, same expiry, signing
// out drops it) and it goes through the SAME brute-force guards — so guessing passwords through the app cannot get around what protects the
// dashboard. A private API on an in-memory database (nothing real is touched); no browser.
import { createRequire } from "node:module";
import { pathToFileURL, fileURLToPath as __f } from "node:url";
import { mkdirSync as __mk } from "node:fs";
const REPO = __f(new URL("../../..", import.meta.url)).replace(/\/$/, "");
const API = `${REPO}/apps/api`;
const PORT = 3108;
const __RUN = __f(new URL("../.bench/suite-run/", import.meta.url));
__mk(__RUN, { recursive: true });
process.chdir(__RUN); // no .env here → the real database URI is never read
const req = createRequire(`${API}/package.json`);
const mms = await import(pathToFileURL(req.resolve("mongodb-memory-server")).href);
const mongod = await (mms.MongoMemoryServer ?? mms.default.MongoMemoryServer).create();
Object.assign(process.env, { NODE_ENV: "development", API_PORT: String(PORT), MONGODB_URI: mongod.getUri(), MONGODB_DB: "sandbox", LOG_LEVEL: "error", LOGIN_FLOOD_PER_MINUTE: "10", LOGIN_MAX_FAILURES: "4", LOGIN_BLOCK_STEPS_SECONDS: "300,900" });
const db = await import(`${REPO}/packages/db/src/index.js`);
await db.connectDb({ uri: mongod.getUri(), dbName: "sandbox" });
const { env } = await import(`${API}/src/env.js`);
const { createApp } = await import(`${API}/src/app.js`);
const { ensureSuperAdmin } = await import(`${API}/src/modules/auth/auth.service.js`);
const server = createApp().listen(PORT);
await new Promise((r) => server.once("listening", r));
await ensureSuperAdmin({ email: "super@sandbox.test", name: "Super", password: "Super123!" });
const raw = (c) => db.mongoose.connection.db.collection(c);

const base = `http://127.0.0.1:${PORT}`;
let n = 0;
/** a public address nobody else is using — what nginx would tell the API a visitor's address is */
const fresh = () => `198.51.100.${(n = (n % 250) + 1)}`;
const call = async (method, path, { body, cookie, bearer, ip, headers = {} } = {}) => {
  const r = await fetch(base + path, {
    method,
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...(bearer ? { authorization: `Bearer ${bearer}` } : {}), "x-forwarded-for": ip ?? fresh(), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text(); let json = {}; try { json = JSON.parse(text); } catch {}
  return { status: r.status, json, headers: r.headers };
};
const cookieLogin = async (email, password, ip) => (await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip ?? fresh() }, body: JSON.stringify({ email, password }) })).headers.get("set-cookie")?.split(";")[0];
const appLogin = (email, password, ip) => call("POST", "/api/auth/app-login", { body: { email, password }, ip });
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const say = (s) => console.log(`\n=== ${s}`);

try {
  /* ------------------------------------------------------------------ setup */
  env.RATE_LIMITS = "off";
  const su = await cookieLogin("super@sandbox.test", "Super123!");
  const made = (await call("POST", "/api/brands", { cookie: su, body: { brandName: "Acme", brandSlug: "acme", outletName: "Main", outletSlug: "main", hostnames: ["acme.test"], ownerEmail: "o@acme.test", ownerName: "Owner", ownerPassword: "Owner123!" } })).json;
  const brand = String(made.brand?._id ?? made.brand?.id ?? made.brandId);
  const outlet = String(made.outlet?._id ?? made.outlet?.id ?? made.outletId);
  const owner = await cookieLogin("o@acme.test", "Owner123!");
  const hdr = { "x-rasoipulse-outlet": outlet };
  for (const [email, role] of [["waiter@acme.test", "staff"], ["chef@acme.test", "kitchen"], ["w2@acme.test", "staff"], ["w3@acme.test", "staff"], ["w4@acme.test", "staff"]]) {
    await call("POST", "/api/users", { cookie: owner, headers: { "x-rasoipulse-brand": brand }, body: { email, name: email.split("@")[0], password: "Staff123!", role } });
  }
  await call("POST", "/api/tables", { cookie: owner, headers: hdr, body: { number: "T1", seats: 4 } });

  /* ------------------------------------------------------------------ signing in */
  say("Signing in with the app route");
  const a = await appLogin("waiter@acme.test", "Staff123!");
  ok(a.status === 200 && typeof a.json.token === "string" && a.json.token.length >= 40, "the right email and password give a session token in the answer", `status ${a.status}`);
  ok(!a.headers.get("set-cookie"), "…and nothing is set as a cookie (the app keeps the token itself)");
  ok(a.json.user?.email === "waiter@acme.test" && a.json.user?.role === "staff" && a.json.user?.permissions?.includes("order:create") && a.json.user?.permissions?.includes("table:manage"), "the answer says who signed in, their role and what they may do (the app needs order:create and table access)", `${a.json.user?.role}`);
  ok(new Date(a.json.expiresAt).getTime() > Date.now() + 6 * 86_400_000, "the session lasts days, not minutes (it is the same session the dashboard uses)", a.json.expiresAt);
  ok(!JSON.stringify(a.json).includes("passwordHash"), "the password hash is never in the answer");
  const dash = await call("POST", "/api/auth/login", { body: { email: "waiter@acme.test", password: "Staff123!" } });
  ok(dash.status === 200 && dash.json.token === undefined && Boolean(dash.headers.get("set-cookie")), "the dashboard's own sign-in is unchanged: a cookie, and no token in the answer");

  say("Using the token");
  const token = a.json.token;
  const me = await call("GET", "/api/auth/me", { bearer: token });
  ok(me.status === 200 && me.json.user?.email === "waiter@acme.test", "the token identifies the person on any request (GET /api/auth/me)");
  const tables = await call("GET", "/api/tables", { bearer: token, headers: hdr });
  ok(tables.status === 200 && (tables.json.tables ?? []).some((t) => t.number === "T1"), "…and opens the staff endpoints the app needs (the tables of their outlet)", `status ${tables.status}`);
  ok((await call("GET", "/api/tables/sessions/active", { bearer: token, headers: hdr })).status === 200, "…including the tables currently in service");
  ok((await call("GET", "/api/menu", { bearer: token, headers: hdr })).status === 200, "…and the menu");
  ok((await call("GET", "/api/tables", { headers: hdr })).status === 401, "with no token and no cookie the same request is refused (401)");
  ok((await call("GET", "/api/tables", { bearer: "not-a-real-token-at-all-0123456789abcdef0123456789", headers: hdr })).status === 401, "a made-up token is refused (401)");
  ok((await call("GET", "/api/tables", { bearer: token })).status === 400, "the outlet still has to be named (the token proves who, the header says where)");
  const owner2 = (await appLogin("o@acme.test", "Owner123!")).json;
  ok((await call("POST", "/api/tables", { bearer: owner2.token, headers: hdr, body: { number: "T2", seats: 2 } })).status === 201, "an owner's token can do what an owner can");
  ok((await call("POST", "/api/tables", { bearer: token, headers: hdr, body: { number: "T3", seats: 2 } })).status !== 401, "(and a waiter's token is judged by the waiter's role, not refused as unsigned)");

  say("Roles are still enforced");
  const chef = (await appLogin("chef@acme.test", "Staff123!")).json;
  ok(chef.user?.role === "kitchen" && !chef.user.permissions.includes("order:create"), "a kitchen account can sign in but is told it may not take orders (the app turns it away)");
  const chefOrder = await call("POST", "/api/orders/staff", { bearer: chef.token, headers: hdr, body: { tableId: "x", cart: { lines: [{ itemId: "x", quantity: 1 }] } } });
  ok(chefOrder.status === 403, "…and the server refuses its order attempt (403), whatever the app does", `status ${chefOrder.status}`);

  say("Signing out and expiry");
  const out = await call("POST", "/api/auth/logout", { bearer: token });
  ok(out.status === 204, "signing out with the token answers 204");
  ok((await call("GET", "/api/auth/me", { bearer: token })).status === 401, "…and that token stops working at once");
  ok((await call("GET", "/api/auth/me", { bearer: owner2.token })).status === 200, "other people's tokens are untouched");
  const old = (await appLogin("w2@acme.test", "Staff123!")).json;
  await raw("sessions").updateMany({}, { $set: {} }); // (a no-op: only the one session below is aged)
  const { createHash } = await import("node:crypto");
  await raw("sessions").updateOne({ tokenHash: createHash("sha256").update(old.token).digest("hex") }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  const { cache } = await import(`${API}/src/modules/cache/cache.js`);
  await cache.clear?.().catch?.(() => undefined);
  ok((await call("GET", "/api/auth/me", { bearer: old.token })).status === 401, "a token whose session has expired is refused");
  const second = (await appLogin("w3@acme.test", "Staff123!")).json;
  ok((await call("GET", "/api/auth/me", { bearer: second.token })).status === 200 && (await call("GET", "/api/auth/me", { cookie: await cookieLogin("w3@acme.test", "Staff123!") })).status === 200, "a person can be signed in on the app and in the dashboard at the same time");

  /* ------------------------------------------------------------------ the guards */
  say("The sign-in guards apply to the app route");
  const wrong = await appLogin("waiter@acme.test", "wrong-password", fresh());
  const unknown = await appLogin("nobody@acme.test", "wrong-password", fresh());
  ok(wrong.status === 401 && unknown.status === 401 && wrong.json.error === unknown.json.error, "a wrong password and an unknown email get the very same 401 message (no hint which emails exist)", wrong.json.error);
  const guard = await call("GET", "/api/auth/guard", { ip: fresh() });
  ok(guard.status === 200 && guard.json.blocked === false, "GET /api/auth/guard tells the app whether this address is blocked (so it can show a notice instead of the form)");

  env.RATE_LIMITS = "on";
  // the address block: LOGIN_MAX_FAILURES (4) wrong passwords from one address block that address
  const bad = fresh();
  const tries = [];
  for (let i = 0; i < 4; i++) tries.push((await appLogin("w4@acme.test", `guess-${i}`, bad)).status);
  ok(tries.slice(0, 3).every((s) => s === 401), "wrong passwords are answered 401 at first", tries.join(","));
  const afterBlock = await appLogin("w4@acme.test", "Staff123!", bad);
  ok(afterBlock.status === 429 && /try again in/i.test(afterBlock.json.error ?? ""), "after 4 wrong passwords the address is blocked — even the RIGHT password is now refused (429) with a countdown", `${afterBlock.status} ${afterBlock.json.error}`);
  const blockedInfo = await call("GET", "/api/auth/guard", { ip: bad });
  ok(blockedInfo.json.blocked === true && blockedInfo.json.retryAfterSec > 0, "the guard endpoint now says blocked, and for how long", JSON.stringify(blockedInfo.json));
  const viaDashboard = await call("POST", "/api/auth/login", { body: { email: "w4@acme.test", password: "Staff123!" }, ip: bad });
  ok(viaDashboard.status === 429, "the block is shared: the same address is refused on the DASHBOARD sign-in too (the app route is not a way around it)", `status ${viaDashboard.status}`);
  ok((await appLogin("w4@acme.test", "Staff123!", fresh())).status === 200, "another address is not affected");

  // the account pause: wrong passwords for one email from MANY addresses (a botnet) pause that account everywhere
  const victim = "w3@acme.test";
  const stat = [];
  for (let i = 0; i < 14; i++) stat.push((await appLogin(victim, `botnet-${i}`, fresh())).status);
  const paused = await appLogin(victim, "Staff123!", fresh());
  ok(stat.includes(429) || paused.status === 429, "wrong passwords for one account from many different addresses pause that account", `answers ${[...new Set(stat)].join(",")}, then right password: ${paused.status}`);
  ok(paused.status === 429, "…even with the right password, from a fresh address, on the app route", `status ${paused.status}`);
  ok((await call("POST", "/api/auth/login", { body: { email: victim, password: "Staff123!" }, ip: fresh() })).status === 429, "…and on the dashboard route (one shared pause)");

  // the flood limit: any burst of sign-in requests from one address
  const flood = fresh();
  const burst = [];
  for (let i = 0; i < 14; i++) burst.push((await call("POST", "/api/auth/app-login", { body: { email: "waiter@acme.test", password: "Staff123!" }, ip: flood })).status);
  const limited = burst.findIndex((s) => s === 429);
  ok(limited > 0 && limited <= 11, "a burst of sign-in requests from one address is stopped by the flood limit (10 a minute here)", `first 429 at request ${limited + 1} of ${burst.length}`);
  const lim = await call("POST", "/api/auth/app-login", { body: { email: "waiter@acme.test", password: "Staff123!" }, ip: flood });
  ok(lim.status === 429 && lim.json.details?.policy === "login-flood" && Number(lim.headers.get("retry-after")) > 0, "…with the named policy login-flood and a Retry-After header", `${lim.json.details?.policy} ${lim.headers.get("retry-after")}`);

  say("The limits are on the route inventory");
  const { routeInventory } = await import(`${API}/src/scripts/route-inventory.js`).catch(() => ({}));
  if (routeInventory) {
    const inv = await routeInventory();
    const row = inv.find((r) => r.path === "/api/auth/app-login" && r.method === "POST");
    ok(Boolean(row) && row.policies.includes("login-flood") && row.policies.includes("login-account"), "POST /api/auth/app-login is listed with login-flood and login-account", JSON.stringify(row?.policies));
  } else console.log("   (the route inventory is checked by t28, which fails if a route that changes data has no named limit)");
} finally {
  server.close();
  await mongod.stop();
}
console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
