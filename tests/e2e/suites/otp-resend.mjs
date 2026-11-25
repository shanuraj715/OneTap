// Resend rule for verification codes — API checks on an in-memory database (nothing real is touched).
// How soon the same number may ask for ANOTHER code: 30 s, then 1 min, 2 min, 5 min, 15 min, 1 h, then 6 h every time.
// The point of these checks: the rule is the server's, so a script calling the API directly (one request, or hundreds at
// once) gets exactly the same answer as the sign-in screen. The per-address flood limiter is switched OFF here so that
// nothing but the resend rule is being tested.
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { fileURLToPath as __f } from "node:url";
import { mkdirSync as __mk } from "node:fs";
import http from "node:http";
const REPO = __f(new URL("../../..", import.meta.url)).replace(/\/$/, "");
const API = `${REPO}/apps/api`;
const PORT = 3091;
const __RUN = __f(new URL("../.bench/suite-run/", import.meta.url));
__mk(__RUN, { recursive: true });
process.chdir(__RUN); // no .env here → the real database URI is never read
const req = createRequire(`${API}/package.json`);
const mms = await import(pathToFileURL(req.resolve("mongodb-memory-server")).href);
const mongod = await (mms.MongoMemoryServer ?? mms.default.MongoMemoryServer).create();
Object.assign(process.env, { NODE_ENV: "development", API_PORT: String(PORT), MONGODB_URI: mongod.getUri(), MONGODB_DB: "sandbox", LOG_LEVEL: "warn", LOGIN_GUARD: "off" });
const db = await import(`${REPO}/packages/db/src/index.js`);
await db.connectDb({ uri: mongod.getUri(), dbName: "sandbox" });
const { createApp } = await import(`${API}/src/app.js`);
const server = createApp().listen(PORT);
await new Promise((r) => server.once("listening", r));
const { ensureSuperAdmin } = await import(`${API}/src/modules/auth/auth.service.js`);
await ensureSuperAdmin({ email: "super@sandbox.test", name: "Super", password: "Super123!" });
const schema = await import(`${REPO}/packages/config-schema/src/index.js`);
const customerService = await import(`${API}/src/modules/customer/customer.service.js`);
const raw = (c) => db.mongoose.connection.db.collection(c);

const base = `http://127.0.0.1:${PORT}`;
let OUTLET = null;
const call = async (method, path, { body, cookie } = {}) => {
  const r = await fetch(base + path, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...(OUTLET ? { "x-rasoipulse-outlet": OUTLET } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text(); let json = {}; try { json = JSON.parse(text); } catch {}
  return { status: r.status, json, headers: r.headers };
};
const login = async (email, password) => (await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) })).headers.get("set-cookie")?.split(";")[0];
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const say = (s) => console.log(`\n=== ${s}`);

/* ------------------------------------------------------------------ setup */
const su = await login("super@sandbox.test", "Super123!");
const made = (await call("POST", "/api/brands", { cookie: su, body: { brandName: "Acme", brandSlug: "acme", outletName: "Main", outletSlug: "main", hostnames: ["acme.test"], ownerEmail: "o@acme.test", ownerName: "Owner", ownerPassword: "Owner123!" } })).json;
const brand = String(made.brand?._id ?? made.brand?.id ?? made.brandId);
OUTLET = String(made.outlet?._id ?? made.outlet?.id ?? made.outletId);
const owner = await login("o@acme.test", "Owner123!");

const request = (phone) => call("POST", "/api/customer/otp/request", { body: { outletId: OUTLET, destination: phone } });
const verify = (phone, code) => call("POST", "/api/customer/otp/verify", { body: { outletId: OUTLET, destination: phone, code, name: "Asha" } });
const throttle = (phone, purpose = "login") => raw("otpthrottles").findOne({ brandId: brand, destination: phone, purpose });
const challenges = (phone) => raw("otpchallenges").countDocuments({ brandId: brand, destination: phone });
/** pretend `ms` have passed: the next request is allowed `ms` from now (negative = already allowed) */
const allowIn = (phone, ms, purpose = "login") => raw("otpthrottles").updateOne({ brandId: brand, destination: phone, purpose }, { $set: { nextAllowedAt: new Date(Date.now() + ms) } });
const WAITS = [30, 60, 120, 300, 900, 3600, 21600, 21600, 21600]; // the 7th code and every one after it: 6 hours

say("1. the schedule — every code makes the next wait longer");
ok(JSON.stringify(schema.OTP_RESEND_WAITS_SEC) === JSON.stringify([30, 60, 120, 300, 900, 3600, 21600]), "the shared schedule is 30 s, 1 min, 2 min, 5 min, 15 min, 1 hour, 6 hours", schema.OTP_RESEND_WAITS_SEC.join(","));
const N1 = "9811300001";
let cycle = true;
for (let i = 0; i < WAITS.length; i++) {
  const first = await request(N1);
  const early = await request(N1);
  const left = early.json.details?.retryAfterSec;
  const header = Number(early.headers.get("retry-after"));
  const good =
    first.status === 200 && first.json.resendAfterSec === WAITS[i] && !!first.json.devCode &&
    early.status === 429 && early.json.details?.code === "otp_wait" && left > WAITS[i] - 5 && left <= WAITS[i] &&
    header === left && (await challenges(N1)) === i + 1 && (await throttle(N1)).count === i + 1;
  ok(good, `code ${i + 1}: sent, the next one must wait ${schema.formatWaitLong(WAITS[i])} — asking at once is refused`, `status ${first.status}/${early.status}, told ${first.json.resendAfterSec}s, left ${left}s, header ${header}, codes stored ${await challenges(N1)}`);
  cycle = cycle && good;
  await allowIn(N1, -1000); // time passes
}
ok(cycle, "…and from the 7th code on the wait stays at 6 hours (the 8th and 9th codes too)");
let r = await request(N1);
const sixHours = await request(N1);
ok(r.status === 200 && sixHours.status === 429 && /^Please wait 6 hours before asking for another code\.$/.test(sixHours.json.error ?? ""), "the refusal says it in words: 'Please wait 6 hours before asking for another code.'", sixHours.json.error);
await allowIn(N1, 2000); // 2 seconds still to go
r = await request(N1);
ok(r.status === 429 && r.json.details.retryAfterSec <= 2 && /^Please wait \d+ seconds? before asking for another code\.$/.test(r.json.error), "even 2 seconds early is refused, and the message says how long is left", `${r.status} ${r.json.error}`);
await allowIn(N1, -1);
ok((await request(N1)).status === 200, "the moment the wait is over the next code is allowed");

say("2. hitting the API directly — many requests at once");
const N2 = "9811300002";
await db.OtpThrottleModel.init();
let burst = await Promise.all(Array.from({ length: 15 }, () => request(N2)));
ok(burst.filter((x) => x.status === 200).length === 1 && burst.filter((x) => x.status === 429).length === 14, "15 requests for a new number at the same moment: exactly ONE code is sent, 14 are refused", burst.map((x) => x.status).join(","));
ok((await challenges(N2)) === 1 && (await throttle(N2)).count === 1, "…only one code exists for it");
await allowIn(N2, -1000);
burst = await Promise.all(Array.from({ length: 15 }, () => request(N2)));
ok(burst.filter((x) => x.status === 200).length === 1 && burst.filter((x) => x.status === 429).length === 14, "after the wait, 15 at the same moment again: exactly one more code", burst.map((x) => x.status).join(","));
ok((await challenges(N2)) === 2 && (await throttle(N2)).count === 2, "…two codes in all, and the next wait is the second step (1 minute)", `${await challenges(N2)} codes, wait ${Math.round(((await throttle(N2)).nextAllowedAt - Date.now()) / 1000)}s`);
// a hundred quick-fire requests, one after another, as a script would send them
let sentFast = 0;
for (let i = 0; i < 100; i++) if ((await request("9811300003")).status === 200) sentFast++;
ok(sentFast === 1, "100 requests in a row for one number: only the first one sends a code", `${sentFast} sent`);
// the way a person might try to get round it: spaces, a +91 prefix, other spellings of the same number
const spellings = ["98113 00003", "+919811300003", "+91 98113 00003", "9811-300003", "919811300003", "00919811300003", "09811300003"];
const spelled = [];
for (const sp of spellings) spelled.push((await request(sp)).status);
ok(spelled.every((x) => x === 429), "writing the same number another way (+91, 0091, spaces, dashes, a leading 0) does NOT get another code", spelled.join(","));
ok((await challenges("9811300003")) === 1 && (await raw("otpchallenges").countDocuments({ brandId: brand, destination: { $regex: "9811300003" } })) === 1, "…there is still only one code for that phone");

say("3. each number has its own clock");
ok((await request("9811300004")).status === 200 && (await request("9811300005")).status === 200, "a different number is not held back by someone else's wait");
const email = (await request("asha@example.com"));
ok(email.status === 200 && email.json.resendAfterSec === 30 && (await request("asha@example.com")).status === 429, "an email address has its own clock too");
// a staff coin code is a different flow: it has its own clock for the same number
let coins = null;
try { coins = await customerService.requestOtp({ brandId: brand, outletId: OUTLET, destination: N1, purpose: "coins" }); } catch (e) { coins = { error: e }; }
ok(!!coins?.resendAfterSec, "the staff coin code for a number that is waiting on a sign-in code is still allowed (separate flow)", JSON.stringify(coins).slice(0, 120));
let coinsAgain = null;
try { await customerService.requestOtp({ brandId: brand, outletId: OUTLET, destination: N1, purpose: "coins" }); } catch (e) { coinsAgain = e; }
ok(coinsAgain?.status === 429 && coinsAgain.details?.code === "otp_wait", "…and the coin code has the same waits (asking again at once is refused)", `${coinsAgain?.status} ${coinsAgain?.message}`);

say("4. the screen is told what to do");
const N3 = "9811300006";
r = await request(N3);
const again = await request(N3);
ok(again.status === 429 && again.json.details.liveCode === true, "refused too early, with the code just sent still good → 'liveCode' lets the screen take the customer straight to typing it", JSON.stringify(again.json.details));
await raw("otpchallenges").updateMany({ brandId: brand, destination: N3 }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
const stale = await request(N3);
ok(stale.status === 429 && stale.json.details.liveCode === false, "once that code has expired, 'liveCode' is false — the customer only has to wait", JSON.stringify(stale.json.details));
ok((await request("12")).status === 400, "a number that isn't valid is a plain 400 and doesn't start a clock", `${(await request("12")).status}`);
ok((await raw("otpthrottles").countDocuments({ brandId: brand, destination: "12" })) === 0, "…nothing was recorded for it");

say("5. signing in starts the number over");
const N4 = "9811300007";
r = await request(N4);
const code4 = r.json.devCode;
await allowIn(N4, -1000);
await request(N4); // a second code: the wait is now 1 minute
const second = await throttle(N4);
ok(second.count === 2, "(two codes so far)");
const real = await raw("otpchallenges").find({ brandId: brand, destination: N4 }).sort({ createdAt: -1 }).limit(1).toArray();
r = await verify(N4, "123456");
ok(r.status === 200, "the customer signs in (dev code accepted on a store that sends nothing)", `${r.status} ${r.json.error ?? ""}`);
ok((await throttle(N4)) === null, "…and the number's waits are wiped");
r = await request(N4);
ok(r.status === 200 && r.json.resendAfterSec === 30, "asking again right after signing in works, and starts at 30 seconds", `${r.status} ${r.json.resendAfterSec}`);
void code4; void real;
// a number nobody asked about for a day is forgotten
await raw("otpthrottles").updateOne({ brandId: brand, destination: N1, purpose: "login" }, { $set: { expiresAt: new Date(Date.now() - 1000), nextAllowedAt: new Date(Date.now() + 3_600_000), count: 7 } });
r = await request(N1);
ok(r.status === 200 && r.json.resendAfterSec === 30 && (await throttle(N1)).count === 1, "after a day without a request the count starts again at 30 seconds", `${r.status} ${r.json.resendAfterSec}`);

say("6. a code that could not be sent doesn't count");
let failing = false;
const gateway = http.createServer((rq, rs) => { const u = new URL(rq.url, "http://x"); gateways.push(u); rs.statusCode = failing ? 500 : 200; rs.end(failing ? "down" : "OK"); });
const gateways = [];
await new Promise((r2) => gateway.listen(3090, "127.0.0.1", r2));
ok((await call("PUT", "/api/notify/config/sms", { cookie: owner, body: { values: { requestUrl: "http://127.0.0.1:3090/sms?key={{apiKey}}&to={{to}}&msg={{message}}", apiKey: "K9", otpTemplate: "Code {{code}}" } } })).status === 200, "(the store's SMS gateway is set up and chosen)");
ok((await call("PUT", "/api/notify/messaging", { cookie: owner, body: { codes: { method: "sms", linkedMessage: "", whatsappTemplate: { name: "", language: "en", copyButton: false } } } })).status === 200, "(…as the way codes are sent)");
const N5 = "9811300008";
failing = true;
r = await request(N5);
ok(r.status === 502 && r.json.details?.code === "otp_send_failed", "the gateway is down: the customer is told the code couldn't be sent", `${r.status} ${r.json.error}`);
ok((await challenges(N5)) === 0, "…and no unsent code is left behind");
let t5 = await throttle(N5);
ok(t5.count === 0 && t5.nextAllowedAt - Date.now() > 20_000 && t5.nextAllowedAt - Date.now() <= 31_000, "…it doesn't count as a code sent; the number can try again after 30 seconds (not at once)", `count ${t5.count}, in ${Math.round((t5.nextAllowedAt - Date.now()) / 1000)}s`);
ok((await request(N5)).status === 429, "trying again at once is refused")
await allowIn(N5, -1000);
failing = false;
r = await request(N5);
ok(r.status === 200 && r.json.resendAfterSec === 30 && (await throttle(N5)).count === 1, "once it works, this is the FIRST code (next wait 30 s, not 1 minute)", `${r.status} ${r.json.resendAfterSec}`);
// a resend that fails must not take away the code the customer already has
const codeA = new URL(gateways.at(-1)).searchParams.get("msg")?.match(/\d{6}/)?.[0];
await allowIn(N5, -1000);
failing = true;
r = await request(N5);
ok(r.status === 502, "a resend while the gateway is down fails");
failing = false;
r = await verify(N5, codeA);
ok(r.status === 200, "…and the code the customer already had still signs them in", `${r.status} ${r.json.error ?? ""}`);

gateway.close();
console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
