// AI dish pictures (Gemini): several API keys, who may use it, and what is saved — API checks on an in-memory
// database with a STAND-IN for Google's server (nothing real is called, nothing is billed).
import http from "node:http";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { fileURLToPath as __f } from "node:url";
import { mkdirSync as __mk } from "node:fs";
const REPO = __f(new URL("../../..", import.meta.url)).replace(/\/$/, "");
const API = `${REPO}/apps/api`;
const PORT = 3101;
const __RUN = __f(new URL("../.bench/suite-run/", import.meta.url));
__mk(__RUN, { recursive: true });
process.chdir(__RUN); // no .env here → the real database URI is never read
const req = createRequire(`${API}/package.json`);
const sharp = (await import(pathToFileURL(req.resolve("sharp")).href)).default;

/* ---------------------------------------------------------------- the stand-in for Google */
const K = (n) => `AIzaSyTESTKEY${n}_${"x".repeat(24)}`; // long enough to pass the key check
const google = { calls: [], mode: "interactions", delayMs: 0, behave: {} };
let shade = 0;
const picture = async () => (await sharp({ create: { width: 800, height: 600, channels: 3, background: { r: (shade += 37) % 255, g: 140, b: 90 } } }).png().toBuffer()).toString("base64");
const send = (res, status, body) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
const mock = http.createServer(async (rq, res) => {
  const key = rq.headers["x-goog-api-key"] ?? "";
  let raw = ""; for await (const c of rq) raw += c;
  const body = raw ? JSON.parse(raw) : null;
  const url = new URL(rq.url, "http://x");
  const call = { method: rq.method, path: url.pathname, search: url.search, key, body };
  google.calls.push(call);
  const how = google.behave[key] ?? "ok";
  if (rq.method === "GET" && url.pathname === "/v1beta/models") {
    return how === "badkey" ? send(res, 400, { error: { code: 400, message: "API key not valid. Please pass a valid API key.", status: "INVALID_ARGUMENT" } }) : send(res, 200, { models: [{ name: "models/x" }] });
  }
  if (google.delayMs) await new Promise((r) => setTimeout(r, google.delayMs));
  const isInteractions = url.pathname === "/v1beta/interactions";
  if (isInteractions && google.mode === "legacy") return send(res, 404, { error: { code: 404, message: "not found", status: "NOT_FOUND" } });
  if (how === "quota") return send(res, 429, { error: { code: 429, message: "Quota exceeded for this key", status: "RESOURCE_EXHAUSTED" } });
  if (how === "badkey") return send(res, 400, { error: { code: 400, message: "API key not valid. Please pass a valid API key.", status: "INVALID_ARGUMENT" } });
  // the other ways Google words "this key is at its limit" / "this key's project can't do this"
  if (how === "quota403") return send(res, 403, { error: { code: 403, message: "Quota exceeded for quota metric 'Generate Content API requests per minute'", status: "RESOURCE_EXHAUSTED" } });
  if (how === "quotaRetry") return send(res, 429, { error: { code: 429, message: "You exceeded your current quota. Please retry in 40.2s.", status: "RESOURCE_EXHAUSTED", details: [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "40s" }] } });
  if (how === "quotaDaily") return send(res, 429, { error: { code: 429, message: "Quota exceeded for metric: generate_requests_per_model_per_day, limit: 100", status: "RESOURCE_EXHAUSTED" } });
  if (how === "billing") return send(res, 400, { error: { code: 400, message: "Image generation is only available to projects with billing enabled.", status: "FAILED_PRECONDITION" } });
  if (how === "forbidden") return send(res, 403, { error: { code: 403, message: "Billing is not enabled", status: "PERMISSION_DENIED" } });
  if (how === "busy") return send(res, 503, { error: { code: 503, message: "overloaded", status: "UNAVAILABLE" } });
  if (how === "safety") return send(res, 200, isInteractions ? { steps: [{ type: "model_output", content: [{ type: "text", text: "I can't do that." }] }] } : { promptFeedback: { blockReason: "SAFETY" }, candidates: [] });
  if (how === "words") return send(res, 200, { steps: [{ type: "model_output", content: [{ type: "text", text: "Here is a description instead of a picture" }] }] });
  const data = await picture();
  return send(res, 200, isInteractions
    ? { steps: [{ type: "model_output", content: [{ type: "text", text: "Here you go" }, { type: "image", data }] }] }
    : { candidates: [{ finishReason: "STOP", content: { parts: [{ text: "Here you go" }, { inlineData: { mimeType: "image/png", data } }] } }] });
});
await new Promise((r) => mock.listen(0, "127.0.0.1", r));

/* ---------------------------------------------------------------- the API under test */
const mms = await import(pathToFileURL(req.resolve("mongodb-memory-server")).href);
const mongod = await (mms.MongoMemoryServer ?? mms.default.MongoMemoryServer).create();
Object.assign(process.env, { NODE_ENV: "development", API_PORT: String(PORT), GEMINI_API_BASE_URL: `http://127.0.0.1:${mock.address().port}`, MONGODB_URI: mongod.getUri(), MONGODB_DB: "sandbox", LOG_LEVEL: "error", RATE_LIMITS: "off" });
const db = await import(`${REPO}/packages/db/src/index.js`);
await db.connectDb({ uri: mongod.getUri(), dbName: "sandbox" });
const { createApp } = await import(`${API}/src/app.js`);
const server = createApp().listen(PORT);
await new Promise((r) => server.once("listening", r));
const { ensureSuperAdmin } = await import(`${API}/src/modules/auth/auth.service.js`);
await ensureSuperAdmin({ email: "super@sandbox.test", name: "Super", password: "Super123!" });
const schema = await import(`${REPO}/packages/config-schema/src/index.js`);

const base = `http://127.0.0.1:${PORT}`;
const call = async (method, path, { body, cookie, outlet } = {}) => {
  const r = await fetch(base + path, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...(outlet ? { "x-rasoipulse-outlet": outlet } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text(); let json = {}; try { json = JSON.parse(text); } catch {}
  return { status: r.status, json, text };
};
const login = async (email, password) => (await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const say = (s) => console.log(`\n=== ${s}`);
const must = async (p, what) => { const r = await p; if (r.status >= 400) { console.error("SETUP FAILED", what, r.status, r.text.slice(0, 300)); process.exit(1); } return r; };
const raw = (c) => db.mongoose.connection.db.collection(c);
const oid = (s) => new db.mongoose.Types.ObjectId(String(s));

/* ---------------------------------------------------------------- setup */
const su = await login("super@sandbox.test", "Super123!");
const made = (await must(call("POST", "/api/brands", { cookie: su, body: { brandName: "Acme", brandSlug: "acme", outletName: "Main", outletSlug: "main", hostnames: ["acme.test"], ownerEmail: "o@acme.test", ownerName: "Owner", ownerPassword: "Owner123!" } }), "brand")).json;
const brand = String(made.brand?._id ?? made.brand?.id ?? made.brandId);
const outlet = String(made.outlet?._id ?? made.outlet?.id ?? made.outletId);
const owner = await login("o@acme.test", "Owner123!");
await must(call("POST", "/api/users", { cookie: owner, outlet, body: { email: "k@acme.test", name: "Kitchen", password: "Password123!", role: "kitchen" } }), "kitchen");
const kitchen = await login("k@acme.test", "Password123!");
const second = (await must(call("POST", "/api/outlets", { cookie: owner, body: { name: "Second", slug: "second" } }), "second outlet")).json;
const outlet2 = String(second.outlet?._id ?? second.outlet?.id ?? second.id ?? second._id);
const cat = (await must(call("POST", "/api/menu/categories", { cookie: owner, outlet, body: { name: "Paneer" } }), "cat")).json.category.id;
const mkItem = async (name, extra = {}, o = outlet) => (await must(call("POST", "/api/menu/items", { cookie: owner, outlet: o, body: { categoryId: o === outlet ? cat : (await must(call("POST", "/api/menu/categories", { cookie: owner, outlet: o, body: { name: "Other" } }), "cat2")).json.category.id, name, basePrice: 24000, foodType: "veg", description: "Paneer in a spicy tomato gravy", ...extra } }), name)).json.item;
const kadai = await mkItem("Kadai Paneer");
const gen = (id, body, cookie = su, o = outlet) => call("POST", `/api/menu/items/${id}/generate-images`, { cookie, outlet: o, body });
const settings = async () => (await call("GET", "/api/platform/ai", { cookie: su })).json;
const itemNow = async (id) => (await call("GET", `/api/menu?outletId=${outlet}`)).json.items.find((i) => i.id === id);
const resetGoogle = () => { google.calls = []; google.mode = "interactions"; google.delayMs = 0; };

/* ------------------------------------------------------------------ 1 */
say("1. only the platform's super admin");
let r = await call("GET", "/api/platform/ai", { cookie: su });
ok(r.status === 200 && r.json.configured === false && r.json.keys.length === 0 && r.json.model === schema.DEFAULT_AI_IMAGE_MODEL, "the super admin sees an empty setup with the default model", `${r.status} ${r.json.model}`);
for (const [who, cookie] of [["a store owner", owner], ["the kitchen", kitchen], ["someone not signed in", ""]]) {
  const a = await call("GET", "/api/platform/ai", { cookie });
  const b = await call("POST", "/api/platform/ai/keys", { cookie, body: { apiKey: K(1) } });
  const c = await gen(kadai.id, { aspectRatio: "1:1", count: 1 }, cookie);
  ok([a.status, b.status, c.status].every((s) => s === 401 || s === 403), `${who} can neither see the keys, add one, nor make a picture`, `${a.status}/${b.status}/${c.status}`);
}
ok(google.calls.length === 0, "…and Google was never called for them");

/* ------------------------------------------------------------------ 2 */
say("2. adding keys");
r = await call("POST", "/api/platform/ai/keys", { cookie: su, body: { apiKey: "short" } });
ok(r.status === 400, "something that isn't a key is refused", `${r.status} ${r.json.error}`);
r = await call("POST", "/api/platform/ai/keys", { cookie: su, body: { label: "Main account", apiKey: K(1) } });
ok(r.status === 201 && r.json.keys.length === 1 && r.json.keys[0].label === "Main account" && r.json.configured === true, "a key can be added with a name");
ok(!JSON.stringify(r.json).includes(K(1)) && /•/.test(r.json.keys[0].keyHint), "the answer carries only a masked hint, never the key", r.json.keys[0].keyHint);
const stored = await raw("platformais").findOne({ key: "platform" });
ok(stored.keys.length === 1 && !JSON.stringify(stored).includes(K(1)) && stored.keys[0].encryptedKey.startsWith("v1."), "in the database the key is encrypted");
r = await call("POST", "/api/platform/ai/keys", { cookie: su, body: { apiKey: K(1) } });
ok(r.status === 409 && /already/.test(r.json.error), "the same key can't be added twice", r.json.error);
for (const n of [2, 3]) await must(call("POST", "/api/platform/ai/keys", { cookie: su, body: { label: `Key ${n}`, apiKey: K(n) } }), `key ${n}`);
ok((await settings()).keys.length === 3, "three keys are in the list");
r = await call("PUT", "/api/platform/ai", { cookie: su, body: { model: "gemini-3.1-flash-lite-image" } });
ok(r.status === 200 && r.json.model === "gemini-3.1-flash-lite-image", "the model can be chosen");
r = await call("PUT", "/api/platform/ai", { cookie: su, body: { model: "bad model!" } });
ok(r.status === 400, "a model name with odd characters is refused");

/* ------------------------------------------------------------------ 3 */
say("3. testing, pausing and removing a key");
const ids = (await settings()).keys.map((k) => k.id);
r = await call("POST", `/api/platform/ai/keys/${ids[0]}/test`, { cookie: su });
ok(r.status === 200 && r.json.ok === true, "a good key tests fine (a free model-list call, no picture)");
ok(google.calls.at(-1).path === "/v1beta/models" && google.calls.at(-1).key === K(1) && !google.calls.at(-1).search.includes("AIza"), "the key travels in a header, never in the address", google.calls.at(-1).search);
google.behave[K(3)] = "badkey";
r = await call("POST", `/api/platform/ai/keys/${ids[2]}/test`, { cookie: su });
ok(r.status === 400 && /rejected this API key/.test(r.json.error) && (await settings()).keys[2].lastError.includes("rejected"), "a refused key says so and remembers it", r.json.error);
google.behave[K(3)] = "ok";
r = await call("PATCH", `/api/platform/ai/keys/${ids[1]}`, { cookie: su, body: { enabled: false } });
ok(r.json.keys[1].status === "off" && r.json.readyKeys === 2, "a key can be paused");
r = await call("PATCH", `/api/platform/ai/keys/${ids[1]}`, { cookie: su, body: { enabled: true, label: "Second account" } });
ok(r.json.keys[1].status === "ready" && r.json.keys[1].label === "Second account", "…and switched on again, or renamed");
r = await call("DELETE", `/api/platform/ai/keys/${ids[2]}`, { cookie: su });
ok(r.json.keys.length === 2 && !r.json.keys.some((k) => k.id === ids[2]), "a key can be removed");
r = await call("DELETE", `/api/platform/ai/keys/nope`, { cookie: su });
ok(r.status === 404, "removing one that isn't there is a 404");
const keyA = K(1), keyB = K(2);

/* ------------------------------------------------------------------ 4 */
say("4. one picture");
resetGoogle();
r = await gen(kadai.id, { aspectRatio: "16:9", count: 1 });
ok(r.status === 200 && r.json.added.length === 1 && r.json.failed.length === 0, "a picture is made and added to the dish", `${r.status} ${r.text.slice(0, 120)}`);
const g1 = google.calls.at(-1);
ok(g1.path === "/v1beta/interactions" && g1.body.model === "gemini-3.1-flash-lite-image" && g1.body.response_format.aspect_ratio === "16:9" && g1.body.response_format.type === "image", "Google was asked for the chosen model and shape (16:9)", JSON.stringify(g1.body.response_format));
ok(/Kadai Paneer/.test(g1.body.input[0].text) && /vegetarian/.test(g1.body.input[0].text) && /Paneer/.test(g1.body.input[0].text), "the request describes the dish: its name, that it's vegetarian, its section");
ok([keyA, keyB].includes(g1.key) && !g1.path.includes("AIza"), "one of the saved keys was used, in a header");
let now = await itemNow(kadai.id);
const dbItem = await raw("menuitems").findOne({ _id: oid(kadai.id) });
ok(now.images.length === 1 && dbItem.images[0].url === `/uploads/${dbItem.images[0].key}` && dbItem.images[0].key.startsWith(`${brand}/${outlet}/menu-items/`) && dbItem.images[0].key.endsWith(".webp"), "the picture was compressed to WebP, stored in the store's own folder, and saved without a domain", dbItem.images[0].url.slice(0, 60));
ok(/^https?:\/\/[^/]+\/uploads\//.test(now.images[0].url), "…and the menu hands out a full address", now.images[0].url.slice(0, 50));
const file = await fetch(now.images[0].url.replace(/^https?:\/\/[^/]+/, base));
ok(file.status === 200 && file.headers.get("content-type") === "image/webp", "the file opens");

/* ------------------------------------------------------------------ 5 */
say("5. several pictures — at once, on different keys, from different angles");
await must(call("POST", "/api/platform/ai/keys", { cookie: su, body: { label: "Third", apiKey: K(4) } }), "key 4");
resetGoogle(); google.delayMs = 400;
const t0 = Date.now();
r = await gen(kadai.id, { aspectRatio: "1:1", count: 3 });
const took = Date.now() - t0;
const used = google.calls.filter((c) => c.path === "/v1beta/interactions");
ok(r.status === 200 && r.json.added.length === 3, "three pictures are made", `${r.status} added ${r.json.added?.length}`);
ok(took < 1100, "…at the same time, not one after another (3 × 0.4 s took under 1.1 s)", `${took} ms`);
ok(new Set(used.map((c) => c.key)).size === 3, "…each on a DIFFERENT key", [...new Set(used.map((c) => c.key.slice(-26, -24)))].join());
ok(new Set(used.map((c) => c.body.input[0].text)).size === 3, "…and each asked for from a different angle, so they aren't copies");
ok(used.every((c) => c.body.response_format.aspect_ratio === "1:1"), "all in the chosen shape (1:1)");
now = await itemNow(kadai.id);
ok(now.images.length === 4, "the dish now has four pictures", String(now.images.length));
google.delayMs = 0;

/* ------------------------------------------------------------------ 6 */
say("6. spreading the work across keys over time");
const dish2 = await mkItem("Paneer Tikka");
for (const k of (await settings()).keys) await call("PATCH", `/api/platform/ai/keys/${k.id}`, { cookie: su, body: { enabled: k.label === "Main account" || k.label === "Second account" } });
const before = Object.fromEntries((await settings()).keys.map((k) => [k.label, k.uses]));
resetGoogle();
for (let i = 0; i < 2; i++) await must(gen(dish2.id, { aspectRatio: "1:1", count: 1 }), "single");
const after = Object.fromEntries((await settings()).keys.map((k) => [k.label, k.uses]));
ok(after["Main account"] - before["Main account"] === 1 && after["Second account"] - before["Second account"] === 1, "two single-picture requests in a row use two different keys (the one used longest ago goes first)", JSON.stringify(after));
ok((await settings()).keys.every((k) => k.label === "Main account" || k.label === "Second account" || k.status === "off") && !google.calls.some((c) => [K(3), K(4)].includes(c.key)), "paused keys are never used");
for (const k of (await settings()).keys) await call("PATCH", `/api/platform/ai/keys/${k.id}`, { cookie: su, body: { enabled: true } });

/* ------------------------------------------------------------------ 7 */
say("7. a key that has used up its limit is skipped — the picture is still made");
const allKeys = () => raw("platformais").findOne({ key: "platform" }).then((d) => d.keys.map((k) => ({ id: k.id, label: k.label })));
const retestAll = async () => { google.behave = {}; for (const k of await allKeys()) await call("POST", `/api/platform/ai/keys/${k.id}/test`, { cookie: su }); };
const dish3 = await mkItem("Palak Paneer");
resetGoogle();
google.behave[keyA] = "quota";
r = await gen(dish3.id, { aspectRatio: "1:1", count: 3 }); // three pictures, three keys: every key is tried, so the full one is certainly found
ok(r.status === 200 && r.json.added.length === 3 && r.json.failed.length === 0, "all three pictures are made even though one key is over its limit", `${r.status} ${JSON.stringify(r.json.failed)}`);
let s = await settings();
const a = s.keys.find((k) => k.label === "Main account");
ok(a.status === "cooling" && /quota|limit/i.test(a.lastError) && a.cooldownUntil, "that key now rests, with the reason shown", `${a.status} · ${a.lastError}`);
ok(google.calls.filter((c) => c.key === keyA).length === 1, "it was tried exactly once — that is how its limit was found");
resetGoogle();
await must(gen(dish3.id, { aspectRatio: "1:1", count: 1 }), "next");
ok(!google.calls.some((c) => c.key === keyA), "the next request doesn't even try the resting key");
await retestAll();
ok((await settings()).keys.every((k) => k.status === "ready"), "testing the keys again ends their rest");

/* ------------------------------------------------------------------ 8 */
say("8. a key Google refuses");
const dish4 = await mkItem("Matar Paneer");
resetGoogle();
google.behave[keyB] = "badkey";
r = await gen(dish4.id, { aspectRatio: "1:1", count: 3 });
s = await settings();
const b = s.keys.find((k) => k.label === "Second account");
ok(r.status === 200 && r.json.added.length === 3, "all three pictures are made on the other keys", `${r.status}`);
ok(b.status === "cooling" && /rejected/i.test(b.lastError), "the refused key is set aside, with Google's reason", b.lastError);
const restsFor = (await raw("platformais").findOne({ key: "platform" })).keys.find((k) => k.label === "Second account").cooldownUntil.getTime() - Date.now();
ok(restsFor > 20 * 3600_000, "…for a long time (it won't work until someone fixes it)", `${Math.round(restsFor / 3600_000)} h`);
await retestAll();

/* ------------------------------------------------------------------ 9 */
say("9. every key at its limit");
const dish5 = await mkItem("Shahi Paneer");
resetGoogle();
for (const k of [K(1), K(2), K(4)]) google.behave[k] = "quota";
r = await gen(dish5.id, { aspectRatio: "1:1", count: 1 });
ok(r.status === 429 && /limit/i.test(r.json.error), "with every key used up the answer says so (429)", r.json.error);
ok((await itemNow(dish5.id)).images.length === 0, "nothing was saved");
resetGoogle();
r = await gen(dish5.id, { aspectRatio: "1:1", count: 1 });
ok(r.status === 429 && /resting/i.test(r.json.error) && google.calls.length === 0, "the next try doesn't bother Google while they all rest, and says when they're back", r.json.error);
await retestAll();
r = await gen(dish5.id, { aspectRatio: "1:1", count: 1 });
ok(r.status === 200, "once the keys are tested again it works");

/* ------------------------------------------------------------------ 10 */
say("10. when Google won't make it, or is busy");
const dish6 = await mkItem("Chilli Paneer");
for (const [how, expect] of [["safety", /safety filter/], ["words", /words instead of a picture/]]) {
  resetGoogle();
  if (how === "safety") google.mode = "legacy"; // a block reason is part of the older interface's answer
  for (const k of [K(1), K(2), K(4)]) google.behave[k] = how;
  r = await gen(dish6.id, { aspectRatio: "1:1", count: 1 });
  ok(r.status === 502 && expect.test(r.json.error), `${how === "safety" ? "a refusal" : "a text-only answer"} is explained in plain words`, r.json.error);
}
ok((await itemNow(dish6.id)).images.length === 0 && (await settings()).keys.every((k) => k.status === "ready"), "nothing was saved, and no key was punished for it");
resetGoogle();
google.behave = {};
let n = 0; const realBehave = google.behave;
google.behave = new Proxy(realBehave, { get: (o, k) => (typeof k === "string" && k.startsWith("AIza") ? (++n === 2 ? "busy" : "ok") : o[k]) });
r = await gen(dish6.id, { aspectRatio: "1:1", count: 3 });
ok(r.status === 200 && r.json.added.length === 2 && r.json.failed.length === 1, "one picture failing doesn't lose the others: 2 saved, 1 reported", `added ${r.json.added?.length} failed ${r.json.failed?.length}: ${r.json.failed?.[0]}`);
ok((await itemNow(dish6.id)).images.length === 2, "the two that worked are on the dish");
google.behave = {};

/* ------------------------------------------------------------------ 11 */
say("11. the older Google interface is the fallback");
const dish7 = await mkItem("Paneer Butter Masala");
resetGoogle(); google.mode = "legacy";
r = await gen(dish7.id, { aspectRatio: "3:4", count: 1 });
const legacy = google.calls.find((c) => c.path.includes(":generateContent"));
ok(r.status === 200 && r.json.added.length === 1, "when the newer interface answers 'not found', the older one makes the picture", `${r.status} ${r.json.error ?? ""}`);
ok(legacy && legacy.path === "/v1beta/models/gemini-3.1-flash-lite-image:generateContent" && legacy.body.generationConfig.imageConfig.aspectRatio === "3:4" && legacy.body.contents[0].parts[0].text.includes("Paneer Butter Masala"), "…with the same shape and description", legacy?.path);
resetGoogle();

/* ------------------------------------------------------------------ 12 */
say("12. the limits");
const dish8 = await mkItem("Paneer Lababdar");
r = await gen(dish8.id, { aspectRatio: "7:5", count: 1 });
ok(r.status === 400, "a shape that isn't offered is refused", `${r.status}`);
for (const count of [0, 5, 1.5]) ok((await gen(dish8.id, { aspectRatio: "1:1", count })).status === 400, `a count of ${count} is refused`);
ok((await gen("000000000000000000000000", { aspectRatio: "1:1", count: 1 })).status === 404, "a dish that doesn't exist is a 404");
const other = await mkItem("Other outlet dish", {}, outlet2);
ok((await gen(other.id, { aspectRatio: "1:1", count: 1 }, su, outlet)).status === 404, "a dish of ANOTHER outlet can't be reached through this one");
ok(google.calls.length === 0, "none of those cost anything (Google wasn't called)");
// fill a dish to six pictures
const full = await mkItem("Full dish");
const sixImgs = Array.from({ length: 6 }, (_, i) => ({ url: `https://cdn.example/p${i}.png` }));
await must(call("PATCH", `/api/menu/items/${full.id}`, { cookie: owner, outlet, body: { images: sixImgs } }), "six");
r = await gen(full.id, { aspectRatio: "1:1", count: 1 });
ok(r.status === 409 && /already has 6 square pictures/.test(r.json.error), "a dish with six pictures can't take more", r.json.error);
const five = await mkItem("Nearly full dish", { images: sixImgs.slice(0, 5) });
r = await gen(five.id, { aspectRatio: "1:1", count: 2 });
ok(r.status === 400 && /Only 1 more square picture fits/.test(r.json.error) && google.calls.length === 0, "asking for more than fit is refused before anything is spent", r.json.error);
r = await gen(five.id, { aspectRatio: "1:1", count: 1 });
ok(r.status === 200 && (await itemNow(five.id)).images.length === 6, "…and exactly the room left works");
ok((await itemNow(five.id)).images.slice(0, 5).every((im, i) => im.url === sixImgs[i].url), "the pictures the dish already had are kept, in order");

/* ------------------------------------------------------------------ 13 */
say("13. the description you type is used");
resetGoogle();
const dish9 = await mkItem("Kadai Paneer Special");
r = await gen(dish9.id, { aspectRatio: "1:1", count: 1, prompt: "Kadai paneer in a black iron kadai, garnished with coriander, rustic wooden table" });
ok(r.status === 200 && google.calls.at(-1).body.input[0].text === "Kadai paneer in a black iron kadai, garnished with coriander, rustic wooden table", "an edited description is sent as typed (one picture, so no angle added)");

/* ------------------------------------------------------------------ 14 */
say("14. however Google says 'limit reached', the next key takes over — and the key rests for as long as Google said");
const restOf = async (label) => { const k = (await raw("platformais").findOne({ key: "platform" })).keys.find((x) => x.label === label); return k.cooldownUntil ? k.cooldownUntil.getTime() - Date.now() : 0; };
/** make "Main account" the key that would be picked FIRST, so the limit is certain to be met by a single picture */
const mainFirst = async () => {
  await retestAll();
  await raw("platformais").updateOne({ key: "platform", "keys.label": "Main account" }, { $set: { "keys.$.lastUsedAt": new Date(0) } });
  for (const label of ["Second account", "Third"]) await raw("platformais").updateOne({ key: "platform", "keys.label": label }, { $set: { "keys.$.lastUsedAt": new Date() } });
  resetGoogle();
};
const dishL = await mkItem("Limit test dish");
const scenarios = [
  ["quota403", "a limit reported as HTTP 403 with 'quota' in the words", 9 * 60_000, 11 * 60_000],
  ["quotaRetry", "a limit that says 'retry in 40 s'", 40_000, 50_000],
  ["quotaDaily", "a per-DAY limit", 5.5 * 3600_000, 6.5 * 3600_000],
  ["quota", "a plain limit with no hint (429)", 9 * 60_000, 11 * 60_000],
  ["billing", "a key whose Google project can't make pictures (billing off)", 20 * 3600_000, 25 * 3600_000],
];
for (const [how, what, lo, hi] of scenarios) {
  await mainFirst();
  google.behave[K(1)] = how;
  r = await gen(dishL.id, { aspectRatio: "1:1", count: 1 });
  const triedFirst = google.calls.filter((c) => c.path === "/v1beta/interactions" && c.key === K(1)).length;
  ok(r.status === 200 && r.json.added.length === 1 && triedFirst === 1, `${what}: the picture is still made, on another key (the limited key was tried once)`, `${r.status} ${r.json.error ?? ""} tried ${triedFirst}`);
  ok(r.json.rested?.length === 1 && r.json.rested[0].label === "Main account" && !r.json.usedKeys.includes("Main account"), "…and the answer says which key was switched away from, and which made the picture", JSON.stringify({ rested: r.json.rested?.map((x) => x.label), used: r.json.usedKeys }));
  const rest = await restOf("Main account");
  ok(rest >= lo && rest <= hi, `…that key rests ${how === "quotaRetry" ? "about as long as Google said" : how === "quotaDaily" ? "for hours (a daily limit)" : how === "billing" ? "for a day" : "10 minutes"}`, `${Math.round(rest / 1000)} s`);
}
await mainFirst();
google.behave[K(1)] = "quota";
google.behave[K(2)] = "quota";
const dishM = await mkItem("Two limited keys dish");
r = await gen(dishM.id, { aspectRatio: "1:1", count: 2 });
ok(r.status === 200 && r.json.added.length === 2 && r.json.rested.length === 2 && r.json.usedKeys.join() === "Third", "with TWO keys at their limit the third carries the whole batch, and both are reported", JSON.stringify({ rested: r.json.rested?.map((x) => x.label), used: r.json.usedKeys }));
await retestAll();


/* ------------------------------------------------------------------ 14 */
say("14. a picture is kept in the shape it was made in");
{
  resetGoogle();
  const shaped = await mkItem("Shape test dish");
  let r2 = await gen(shaped.id, { aspectRatio: "16:9", count: 1 });
  let it = await itemNow(shaped.id);
  ok(r2.status === 200 && it.images.length === 1 && it.images[0].ratio === "16:9", "a 16:9 picture is saved as the dish's WIDE picture", JSON.stringify(it.images.map((i) => i.ratio)));
  r2 = await gen(shaped.id, { aspectRatio: "16:9", count: 1 });
  ok(r2.status === 409 && /already has its wide \(16:9\) picture/.test(r2.json.error) && google.calls.length === 1, "a second wide picture is refused before anything is spent — a dish holds one", r2.json.error);
  r2 = await gen(shaped.id, { aspectRatio: "3:2", count: 1 });
  it = await itemNow(shaped.id);
  ok(r2.status === 200 && it.images.some((i) => i.ratio === "4:3"), "the 3:2 'Photo' shape is saved as the dish's LANDSCAPE 4:3 picture", JSON.stringify(it.images.map((i) => i.ratio)));
  r2 = await gen(shaped.id, { aspectRatio: "4:3", count: 2 });
  ok(r2.status === 409, "the landscape place is now full too (3:2 and 4:3 share it)", `${r2.status} ${r2.json.error}`);
  r2 = await gen(shaped.id, { aspectRatio: "1:1", count: 3 });
  it = await itemNow(shaped.id);
  ok(r2.status === 200 && it.images.filter((i) => i.ratio === "1:1").length === 3 && it.images.length === 5, "square pictures still add up as a gallery next to them (three more)", JSON.stringify(it.images.map((i) => i.ratio)));
  r2 = await gen(shaped.id, { aspectRatio: "3:4", count: 2 });
  ok(r2.status === 400 && /Only 1 more portrait picture fits/.test(r2.json.error), "asking for two portrait pictures says only one fits", r2.json.error);
}

console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
server.close(); mock.close();
process.exit(fail ? 1 : 0);
