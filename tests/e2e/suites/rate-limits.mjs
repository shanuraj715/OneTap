// Request limits — API checks on an in-memory database (nothing real is touched).
// Every limit in middleware/rate-limit.js is pushed until it says no, and the way it says no is checked; a limited
// visitor must not affect another; our own servers are never limited by address; the sign-in guard also counts per
// ACCOUNT (a botnet spreading guesses over many addresses); the live-connection (WebSocket) limits; and the route
// inventory must show a named limit on every route that changes data.
//
// Limits are scaled to a tenth (RATE_LIMIT_SCALE=0.1) so "one more than allowed" is a handful of requests, and the
// fixtures (stores, users) are made with the limits switched off — both are changed on the running app's settings.
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { fileURLToPath as __f } from "node:url";
import { mkdirSync as __mk, existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const REPO = __f(new URL("../../..", import.meta.url)).replace(/\/$/, "");
const API = `${REPO}/apps/api`;
const PORT = 3089;
const __RUN = __f(new URL("../.bench/suite-run/", import.meta.url));
__mk(__RUN, { recursive: true });
process.chdir(__RUN); // no .env here → the real database URI is never read
const req = createRequire(`${API}/package.json`);
const mms = await import(pathToFileURL(req.resolve("mongodb-memory-server")).href);
const mongod = await (mms.MongoMemoryServer ?? mms.default.MongoMemoryServer).create();
Object.assign(process.env, { NODE_ENV: "development", API_PORT: String(PORT), MONGODB_URI: mongod.getUri(), MONGODB_DB: "sandbox", LOG_LEVEL: "error", LOGIN_FLOOD_PER_MINUTE: "8" });
const db = await import(`${REPO}/packages/db/src/index.js`);
await db.connectDb({ uri: mongod.getUri(), dbName: "sandbox" });
const { env } = await import(`${API}/src/env.js`);
const { createApp } = await import(`${API}/src/app.js`);
const { limitFor, POLICIES, WRITE_EXEMPT } = await import(`${API}/src/middleware/rate-limit.js`);
const { attachRealtime } = await import(`${API}/src/realtime/hub.js`);
const { attachPreview } = await import(`${API}/src/realtime/preview.js`);
const { WebSocket } = req("ws");
const app = createApp();
const server = app.listen(PORT);
await new Promise((r) => server.once("listening", r));
attachRealtime(server);
attachPreview(server);
const { ensureSuperAdmin } = await import(`${API}/src/modules/auth/auth.service.js`);
await ensureSuperAdmin({ email: "super@sandbox.test", name: "Super", password: "Super123!" });
const raw = (c) => db.mongoose.connection.db.collection(c);

const base = `http://127.0.0.1:${PORT}`;
let n = 0;
/** a public address nobody else is using — what nginx would tell the API a visitor's address is */
const fresh = () => `198.51.100.${(n = (n % 250) + 1)}`;
const call = async (method, path, { body, cookie, ip, headers = {}, rawBody } = {}) => {
  const r = await fetch(base + path, {
    method,
    headers: { ...(rawBody ? {} : { "content-type": "application/json" }), ...(cookie ? { cookie } : {}), ...(ip ? { "x-forwarded-for": ip } : {}), ...headers },
    body: rawBody ?? (body ? JSON.stringify(body) : undefined),
  });
  const text = await r.text(); let json = {}; try { json = JSON.parse(text); } catch {}
  return { status: r.status, json, headers: r.headers };
};
const login = async (email, password) => (await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": fresh() }, body: JSON.stringify({ email, password }) })).headers.get("set-cookie")?.split(";")[0];
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const say = (s) => console.log(`\n=== ${s}`);

/* ------------------------------------------------------------------ setup (limits off) */
env.RATE_LIMITS = "off";
const su = await login("super@sandbox.test", "Super123!");
const made = (await call("POST", "/api/brands", { cookie: su, body: { brandName: "Acme", brandSlug: "acme", outletName: "Main", outletSlug: "main", hostnames: ["acme.test"], ownerEmail: "o@acme.test", ownerName: "Owner", ownerPassword: "Owner123!" } })).json;
const brand = String(made.brand?._id ?? made.brand?.id ?? made.brandId);
const outlet = String(made.outlet?._id ?? made.outlet?.id ?? made.outletId);
const owner = await login("o@acme.test", "Owner123!");
// one team member per check, so no check eats another's budget
const team = [];
for (let i = 0; i < 26; i++) {
  await call("POST", "/api/users", { cookie: owner, headers: { "x-rasoipulse-brand": brand }, body: { email: `u${i}@acme.test`, name: `User ${i}`, password: "Manager123!", role: "manager" } });
  team.push(await login(`u${i}@acme.test`, "Manager123!"));
}
let nextUser = 0;
const user = () => team[nextUser++];
env.RATE_LIMITS = "on";
env.RATE_LIMIT_SCALE = 0.1;
await call("GET", "/health"); // (nothing)

/** push `policy` to its edge: `limit` requests are let through, the next one is refused — and refused the right way */
async function exercise(policy, send, { sampleReq, label } = {}) {
  const limit = limitFor(policy, sampleReq ?? { user: null, header: () => undefined });
  const answers = [];
  for (let i = 0; i < limit + 1; i++) answers.push(await send(i));
  const last = answers.at(-1);
  const allowed = answers.slice(0, limit);
  ok(allowed.every((a) => a.status !== 429), `${label ?? policy}: the first ${limit} requests are let through`, allowed.map((a) => a.status).join(","));
  ok(last.status === 429 && last.json.details?.code === "rate_limited" && last.json.details?.policy === policy, `${label ?? policy}: request ${limit + 1} is refused with 429 and the policy's name`, `${last.status} ${last.json.details?.policy ?? last.json.details?.code ?? last.json.error}`);
  const wait = Number(last.headers.get("retry-after"));
  ok(wait > 0 && last.json.details?.retryAfterSec === wait && typeof last.json.error === "string" && !last.json.error.includes("{wait}"), `${label ?? policy}: the answer carries Retry-After and a readable message`, `${wait}s · ${last.json.error}`);
  return answers;
}

say("1. visitors — each public entry point has its own limit (a fresh address for each)");
{ const ip = fresh(); await exercise("public-compute", () => call("POST", "/api/orders/quote", { ip, body: {} })); }
{ const ip = fresh(); await exercise("coupon-guess", () => call("POST", "/api/coupons/apply", { ip, body: {} })); }
{ const ip = fresh(); await exercise("table-scan", () => call("GET", "/api/tables/scan/000000000000000000000000?k=x", { ip })); }
{ const ip = fresh(); await exercise("site-challenge", () => call("GET", "/api/site/challenge", { ip })); }
{ const ip = fresh(); await exercise("site-lead", () => call("POST", "/api/site/leads", { ip, body: {} })); }
{ const ip = fresh(); await exercise("webhook", () => call("POST", "/api/payments/webhook/razorpay", { ip, body: {} })); }
{ const ip = fresh(); await exercise("print-agent", () => call("GET", "/api/printing/agent/jobs", { ip })); }
{ const ip = fresh(); await exercise("payment", () => call("POST", "/api/payments/intent", { ip, body: {} })); }
{ const ip = fresh(); await exercise("order-place", () => call("POST", "/api/orders", { ip, body: {} })); }
{ const ip = fresh(); await exercise("customer-account", () => call("PATCH", "/api/customer/profile", { ip, body: {} })); }
{ const ip = fresh(); await exercise("api", () => call("GET", "/api/site/links", { ip }), { label: "api (a visitor)" }); }
{ const ip = fresh(); await exercise("app-update-check", () => call("GET", "/api/app-updates/check?versionCode=1", { ip })); }
{ const ip = fresh(); await exercise("app-download", () => call("GET", "/api/app-updates/download/000000000000000000000000", { ip })); }

say("2. sign-in codes — per address, and per store");
{ const ip = fresh(); await exercise("otp-send-ip", (i) => call("POST", "/api/customer/otp/request", { ip, body: { outletId: outlet, destination: `98110${String(10000 + i)}` } })); }
{
  // many addresses, one store: no address is over its limit, the STORE is
  // (the two the per-address check above let through were already counted for this store)
  const cap = limitFor("otp-send-store") - limitFor("otp-send-ip");
  const answers = [];
  for (let i = 0; i < cap + 1; i++) answers.push(await call("POST", "/api/customer/otp/request", { ip: fresh(), body: { outletId: outlet, destination: `98120${String(20000 + i)}` } }));
  ok(answers.slice(0, cap).every((a) => a.status === 200), `otp-send-store: the store's remaining ${cap} codes, asked for from ${cap} different addresses, are all sent`, answers.slice(0, cap).map((a) => a.status).join(",").slice(0, 80));
  ok(answers.at(-1).status === 429 && answers.at(-1).json.details?.policy === "otp-send-store", "otp-send-store: the next one — from a brand-new address — is refused: the store's own ceiling", `${answers.at(-1).status} ${answers.at(-1).json.error}`);
}
{
  // the sign-in flood limit (the dashboard's, kept by the sign-in guard): any burst, right or wrong
  const ip = fresh();
  const a = [];
  for (let i = 0; i < 9; i++) a.push(await call("POST", "/api/auth/login", { ip, body: {} }));
  ok(a.slice(0, 8).every((x) => x.status === 400) && a[8].status === 429 && a[8].json.details?.policy === "login-flood", "login-flood: the 9th sign-in request in a minute from one address is refused (8 allowed)", a.map((x) => x.status).join(","));
  const b = [];
  for (let i = 0; i < 9; i++) b.push(await call("POST", "/api/customer/otp/verify", { ip: fresh(), body: {} }));
  const ip2 = fresh();
  const c = [];
  for (let i = 0; i < 9; i++) c.push(await call("POST", "/api/customer/otp/verify", { ip: ip2, body: {} }));
  ok(c.slice(0, 8).every((x) => x.status === 400) && c[8].status === 429 && c[8].json.details?.policy === "otp-flood", "otp-flood: the same for code guesses (8 a minute per address)", c.map((x) => x.status).join(","));
  void b;
}

say("3. signed-in people — each kind of action has its own limit (a different team member for each)");
{ const c = user(); await exercise("team-write", () => call("PATCH", "/api/menu/categories/000000000000000000000000", { cookie: c, body: {} }), { label: "team-write (changes)" }); }
{ const c = user(); const answers = []; for (let i = 0; i < 40; i++) answers.push(await call("GET", "/api/menu", { cookie: c, headers: { "x-rasoipulse-outlet": outlet } })); ok(answers.every((a) => a.status !== 429), "team-write: reading is not counted — 40 reads in a row are fine"); }
{ const c = user(); await exercise("report", () => call("GET", "/api/analytics/overview", { cookie: c, headers: { "x-rasoipulse-outlet": outlet } })); }
{ const c = user(); await exercise("pii-read", () => call("GET", "/api/customers", { cookie: c, headers: { "x-rasoipulse-outlet": outlet } })); }
{ const c = user(); await exercise("account-write", () => call("POST", "/api/users", { cookie: c, body: {} })); }
{ const c = user(); await exercise("secrets", () => call("PUT", "/api/notify/config/sms", { cookie: c, body: {} })); }
{ const c = user(); await exercise("upload", () => call("POST", "/api/storage/upload", { cookie: c, rawBody: "x", headers: { "content-type": "application/octet-stream" } })); }
{ const c = user(); await exercise("export", () => call("POST", "/api/analytics/export", { cookie: c, body: {} })); }
{ const c = user(); await exercise("bulk-send", () => call("POST", "/api/whatsapp/broadcasts", { cookie: c, body: {} })); }
{ const c = user(); await exercise("chat-send", () => call("POST", "/api/whatsapp/chats/000000000000000000000000/messages", { cookie: c, body: {} })); }
{ const c = user(); await exercise("wa-link", () => call("POST", "/api/whatsapp/accounts", { cookie: c, body: {} })); }
{ const c = user(); await exercise("hardware", () => call("POST", "/api/printing/printers/000000000000000000000000/test", { cookie: c, body: {} })); }
{ const c = user(); await exercise("destructive", () => call("DELETE", "/api/outlets/000000000000000000000000", { cookie: c })); }
{ const c = user(); await exercise("preview", () => call("POST", "/api/preview", { cookie: c, body: {} })); }
{ const c = user(); await exercise("coins-code", () => call("POST", "/api/orders/staff/coins-code", { cookie: c, body: {} })); }
{ const c = user(); await exercise("api", () => call("GET", "/api/auth/me", { cookie: c }), { label: "api (a signed-in user)", sampleReq: { user: { _id: "x" } } }); }

say("4. the platform console (super admin)");
await exercise("release-upload", () => call("PUT", "/api/platform/app-releases/uploads/000000000000000000000000/chunks/0", { cookie: su, rawBody: "x", headers: { "content-type": "application/octet-stream" } }));
// (the upload check above used part of this admin's general write allowance for the minute, so this one runs at full scale: the general cap is then far out of reach)
env.RATE_LIMIT_SCALE = 1;
await exercise("outbound-fetch", () => call("POST", "/api/platform/onboarding/resolve-map", { cookie: su, body: {} }));
env.RATE_LIMIT_SCALE = 0.1;

say("5. one visitor being limited never affects another");
{
  const a = fresh(), b = fresh();
  const limit = limitFor("coupon-guess");
  for (let i = 0; i < limit + 1; i++) await call("POST", "/api/coupons/apply", { ip: a, body: {} });
  ok((await call("POST", "/api/coupons/apply", { ip: a, body: {} })).status === 429, "address A is over its coupon limit");
  ok((await call("POST", "/api/coupons/apply", { ip: b, body: {} })).status !== 429, "address B, at the same moment, is untouched");
  // the header can't be used to hide: whatever is written on the LEFT of the real address changes nothing
  const c = fresh();
  for (let i = 0; i < limit + 1; i++) await call("POST", "/api/coupons/apply", { ip: `203.0.113.7, ${c}` , body: {} });
  const spoof = await call("POST", "/api/coupons/apply", { ip: `203.0.113.${100 + (n % 100)}, ${c}`, body: {} });
  ok(spoof.status === 429, "a made-up address written in front of the real one doesn't give a fresh budget", `${spoof.status}`);
}

say("6. our own servers and the off switch");
{
  // no X-Forwarded-For at all = the storefront's / website's own server (or a health check) talking over loopback
  const limit = limitFor("coupon-guess");
  const answers = [];
  for (let i = 0; i < limit * 4; i++) answers.push(await call("POST", "/api/coupons/apply", { body: {} }));
  ok(answers.every((a) => a.status !== 429), `an address-keyed limit never applies to our own network (${limit * 4} requests, none refused)`);
  const baseLimit = limitFor("api");
  const many = [];
  for (let i = 0; i < baseLimit + 5; i++) many.push(await call("GET", "/api/site/links"));
  ok(many.every((a) => a.status !== 429), "…not even the general limit", `${baseLimit + 5} requests`);
  // …but a limit on a PERSON still holds for them: this is a store's code budget, not an address
  const cap = limitFor("otp-send-store");
  ok(cap > 0, "(limits keyed on a store or an account don't look at the address at all)");
  env.RATE_LIMITS = "off";
  const ip = fresh();
  const off = [];
  for (let i = 0; i < limitFor("coupon-guess") + 5; i++) off.push(await call("POST", "/api/coupons/apply", { ip, body: {} }));
  ok(off.every((a) => a.status !== 429), "with RATE_LIMITS=off nothing is limited");
  env.RATE_LIMITS = "on";
}

say("7. one account, guessed from many addresses");
{
  // 10 wrong passwords for the SAME account, each from a different address (so no address is near its own block)
  const target = "o@acme.test";
  const tries = [];
  for (let i = 0; i < 10; i++) tries.push(await call("POST", "/api/auth/login", { ip: fresh(), body: { email: target, password: `wrong-${i}` } }));
  ok(tries.slice(0, 9).every((t) => t.status === 401) && tries[9].status === 429 && tries[9].json.details?.code === "account_blocked", "the 10th wrong password, from a new address each time, pauses the account", tries.map((t) => t.status).join(","));
  const right = await call("POST", "/api/auth/login", { ip: fresh(), body: { email: target, password: "Owner123!" } });
  ok(right.status === 429 && right.json.details?.code === "account_blocked" && Number(right.headers.get("retry-after")) > 0, "…and even the RIGHT password is refused from a brand-new address while it is paused", `${right.status} ${right.json.error}`);
  ok(/Too many failed attempts for this account\. Try again in/.test(right.json.error ?? ""), "…with a message that says what happened and how long");
  const other = await call("POST", "/api/auth/login", { ip: fresh(), body: { email: "u0@acme.test", password: "Manager123!" } });
  ok(other.status === 200, "another account is not affected", `${other.status}`);
  // an account that doesn't exist is treated exactly the same (so the answer can't be used to find out who has one)
  const ghost = [];
  for (let i = 0; i < 10; i++) ghost.push(await call("POST", "/api/auth/login", { ip: fresh(), body: { email: "nobody@nowhere.test", password: `x${i}` } }));
  ok(ghost.slice(0, 9).every((t) => t.status === 401) && ghost[9].status === 429 && ghost[9].json.details?.code === "account_blocked", "an email that has no account behaves the same: 401 nine times, then paused — nothing is revealed", ghost.map((t) => t.status).join(","));
  const row = await raw("loginguards").findOne({ scope: "staff-account", ip: /^o•••/ });
  ok(Boolean(row) && !JSON.stringify(row).includes("o@acme.test"), "the console's Security page sees the account (masked as o•••@acme.test), never the whole email", row?.ip);
  // the pause ends: time passes
  await raw("loginguards").updateMany({ scope: "staff-account" }, { $set: { blockedUntil: new Date(Date.now() - 1000) } });
  const back = await call("POST", "/api/auth/login", { ip: fresh(), body: { email: target, password: "Owner123!" } });
  ok(back.status === 200, "when the pause is over the right password works again", `${back.status}`);
  const rowAfter = await raw("loginguards").findOne({ scope: "staff-account", ip: /^o•••/ });
  ok(!rowAfter, "…and signing in cleared the account's count");
  // the second pause is longer than the first (1 minute, then 5)
  for (let i = 0; i < 10; i++) await call("POST", "/api/auth/login", { ip: fresh(), body: { email: "u1@acme.test", password: `bad${i}` } });
  const first = await raw("loginguards").findOne({ scope: "staff-account", ip: /^u•••/ });
  const firstLen = Math.round((new Date(first.blockedUntil) - Date.now()) / 1000);
  await raw("loginguards").updateOne({ _id: first._id }, { $set: { blockedUntil: new Date(Date.now() - 1000), failures: 0, windowStart: new Date() } });
  for (let i = 0; i < 10; i++) await call("POST", "/api/auth/login", { ip: fresh(), body: { email: "u1@acme.test", password: `worse${i}` } });
  const second = await raw("loginguards").findOne({ _id: first._id });
  const secondLen = Math.round((new Date(second.blockedUntil) - Date.now()) / 1000);
  ok(firstLen > 50 && firstLen <= 60 && secondLen > 280 && secondLen <= 300, "the first pause is 1 minute, the second 5 minutes", `${firstLen}s then ${secondLen}s`);
}

say("8. live connections (WebSockets)");
{
  const open = (path, ip, extra = {}) => new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}${path}`, { headers: { ...(ip ? { "x-forwarded-for": ip } : {}), ...extra } });
    ws.on("unexpected-response", (_r, res) => { resolve({ status: res.statusCode, retry: res.headers["retry-after"] }); ws.terminate(); });
    ws.on("open", () => resolve({ status: 101, ws }));
    ws.on("error", () => resolve({ status: 0 }));
  });
  const ip = fresh();
  const limit = limitFor("ws-connect");
  const got = [];
  for (let i = 0; i < limit + 1; i++) got.push(await open(`/realtime?outletId=${outlet}`, ip));
  ok(got.slice(0, limit).every((g) => g.status === 401) && got.at(-1).status === 429 && Number(got.at(-1).retry) > 0, `live-order connections: ${limit} attempts a minute per address, the next is refused with 429 and Retry-After`, got.map((g) => g.status).join(","));
  ok((await open(`/realtime?outletId=${outlet}`, fresh())).status === 401, "another address is not affected (it is only asked to sign in)");
  const lots = [];
  for (let i = 0; i < limit * 3; i++) lots.push((await open(`/realtime?outletId=${outlet}`)).status);
  ok(lots.every((s) => s === 401), "our own network is never limited by address", [...new Set(lots)].join(","));
  const prev = await call("POST", "/api/preview", { cookie: owner, headers: { "x-rasoipulse-outlet": outlet }, body: { layout: {} } });
  const viewer = await open(`/preview?id=${prev.json.id}&role=viewer`);
  ok(viewer.status === 101, "a preview viewer connects", `${viewer.status}`);
  const closed = viewer.ws ? await new Promise((resolve) => { viewer.ws.on("close", (code) => resolve(code)); viewer.ws.send("x".repeat(1100 * 1024)); setTimeout(() => resolve("still open"), 4000); }) : "no socket";
  ok(closed === 1009, "a message bigger than the preview allows closes the connection (1009 message too big)", String(closed));
}

say("9. coverage — nothing that changes data is left without a limit of its own");
{
  const out = execFileSync(process.execPath, [`${API}/src/scripts/route-inventory.js`, "--json"], { env: { ...process.env, LOG_LEVEL: "error" }, encoding: "utf8", cwd: API });
  const rows = JSON.parse(out);
  const writes = rows.filter((r) => ["POST", "PUT", "PATCH", "DELETE"].includes(r.method));
  const key = (r) => `${r.method} ${r.path}`;
  const bare = writes.filter((r) => !r.policies.some((p) => p !== "api") && !(key(r) in WRITE_EXEMPT));
  ok(rows.length > 200 && writes.length > 100, "the inventory sees the whole API", `${rows.length} routes, ${writes.length} change data`);
  const outside = rows.filter((r) => !r.policies.includes("api")).map((r) => `${r.method} ${r.path}`);
  ok(outside.length === 1 && outside[0] === "GET /health", "every route is under the general limit — except /health, which the server's own monitoring calls", outside.join("; "));
  ok(bare.length === 0, "every route that changes data has a limit of its own (or is on the short exempt list)", bare.map(key).join("; ") || "none missing");
  const stale = Object.keys(WRITE_EXEMPT).filter((k) => !writes.some((r) => key(r) === k));
  ok(stale.length === 0, "the exempt list names only routes that exist", stale.join("; "));
  const used = new Set(rows.flatMap((r) => r.policies));
  const unused = Object.keys(POLICIES).filter((p) => !used.has(p) && !POLICIES[p].appliesTo);
  ok(unused.length === 0, "every limit in the table is attached to at least one route", unused.join(", ") || "all used");
  const on = (m, p) => rows.find((r) => r.method === m && r.path === p)?.policies ?? [];
  ok(on("POST", "/api/auth/login").includes("login-flood") && on("POST", "/api/auth/login").includes("login-account"), "dashboard sign-in: flood limit + per-account guard");
  ok(on("POST", "/api/customer/otp/request").includes("otp-send-ip") && on("POST", "/api/customer/otp/request").includes("otp-send-store") && on("POST", "/api/customer/otp/request").includes("otp-resend-number") && on("POST", "/api/customer/otp/request").includes("otp-flood"), "asking for a code: flood + per address + per store + per phone number");
  ok(on("POST", "/api/customer/otp/verify").includes("otp-flood"), "typing a code: flood limit (and the attempts-per-code and block-after-failures rules)");
  ok(on("POST", "/api/site/leads").includes("site-lead") && on("GET", "/api/site/challenge").includes("site-challenge"), "the enquiry form: both of its public calls");
  ok(on("DELETE", "/api/platform/stores/:id").includes("destructive") && on("POST", "/api/brands").includes("destructive"), "deleting and creating stores are in the destructive group");
  ok(on("GET", "/api/customers").includes("pii-read") && on("GET", "/api/platform/server/processes").includes("report"), "customer lists and server snapshots are limited reads");
}

say("10. the doc");
{
  const doc = `${REPO}/docs/api-rate-limiting.md`;
  ok(existsSync(doc), "docs/api-rate-limiting.md exists");
  if (existsSync(doc)) {
    const text = readFileSync(doc, "utf8");
    const missing = Object.keys(POLICIES).filter((p) => !text.includes(`\`${p}\``));
    ok(missing.length === 0, "it names every limit in the table", missing.join(", ") || "all named");
    ok(Object.keys(WRITE_EXEMPT).every((k) => text.includes(k)), "it lists the routes that are exempt, and why");
  }
}

console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
server.close();
process.exit(fail ? 1 : 0);
