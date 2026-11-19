// Message sending — API checks on an in-memory database (nothing real is touched): how verification codes are sent over linked
// WhatsApp / WhatsApp Business / SMS, what is stored (never the code), who is kept out of the inbox, the daily cap, plan rules and
// stores that set up SMS codes the old way. The WhatsApp worker's connection is replaced by a stand-in.
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { fileURLToPath as __f } from "node:url";
import { mkdirSync as __mk } from "node:fs";
const REPO = __f(new URL("../../..", import.meta.url)).replace(/\/$/, "");
const API = `${REPO}/apps/api`;
const PORT = 3094;
const __RUN = __f(new URL("../.bench/suite-run/", import.meta.url));
__mk(__RUN, { recursive: true });
process.chdir(__RUN); // no .env here → the real database URI is never read
const req = createRequire(`${API}/package.json`);
const mms = await import(pathToFileURL(req.resolve("mongodb-memory-server")).href);
const mongod = await (mms.MongoMemoryServer ?? mms.default.MongoMemoryServer).create();
Object.assign(process.env, { NODE_ENV: "development", API_PORT: String(PORT), MONGODB_URI: mongod.getUri(), MONGODB_DB: "sandbox", WHATSAPP_WORKER: "on", LOG_LEVEL: "warn", WHATSAPP_GRAPH_URL: "http://127.0.0.1:3093", LOGIN_FLOOD_PER_MINUTE: "1000" });
const db = await import(`${REPO}/packages/db/src/index.js`);
await db.connectDb({ uri: mongod.getUri(), dbName: "sandbox" });
const { createApp } = await import(`${API}/src/app.js`);
const server = createApp().listen(PORT);
await new Promise((r) => server.once("listening", r));
const { ensureSuperAdmin } = await import(`${API}/src/modules/auth/auth.service.js`);
await ensureSuperAdmin({ email: "super@sandbox.test", name: "Super", password: "Super123!" });
const schema = await import(`${REPO}/packages/config-schema/src/index.js`);
const worker = await import(`${API}/src/modules/whatsapp/worker.js`);
const service = await import(`${API}/src/modules/whatsapp/whatsapp.service.js`);
const raw = (c) => db.mongoose.connection.db.collection(c);
const oid = (s) => new db.mongoose.Types.ObjectId(String(s));

const base = `http://127.0.0.1:${PORT}`;
let OUTLET = null;
const call = async (method, path, { body, cookie, headers = {}, rawBody } = {}) => {
  const r = await fetch(base + path, {
    method,
    headers: { ...(rawBody ? {} : { "content-type": "application/json" }), ...(cookie ? { cookie } : {}), ...(OUTLET ? { "x-onetap-outlet": OUTLET } : {}), ...headers },
    body: rawBody ?? (body ? JSON.stringify(body) : undefined),
  });
  const text = await r.text(); let json = {}; try { json = JSON.parse(text); } catch {}
  return { status: r.status, json };
};
const login = async (email, password) => (await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) })).headers.get("set-cookie")?.split(";")[0];
const must = async (p, what) => { const r = await p; if (r.status >= 400) { console.error("SETUP FAILED", what, r.status, JSON.stringify(r.json).slice(0, 300)); process.exit(1); } return r; };
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const say = (s) => console.log(`\n=== ${s}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ setup */
const su = await login("super@sandbox.test", "Super123!");
const a = (await must(call("POST", "/api/brands", { cookie: su, body: { brandName: "Acme", brandSlug: "acme", outletName: "Main", outletSlug: "main", hostnames: ["acme.test"], ownerEmail: "o@acme.test", ownerName: "Owner", ownerPassword: "Owner123!" } }), "store A")).json;
const brandA = String(a.brand?._id ?? a.brand?.id ?? a.brandId);
OUTLET = String(a.outlet?._id ?? a.outlet?.id ?? a.outletId);
const OUTLET_A = OUTLET;
const owner = await login("o@acme.test", "Owner123!");

import http from "node:http";
const sent = [];
const fakeSock = (phone) => ({
  user: { id: `${phone}:1@s.whatsapp.net`, name: "Shop" },
  onWhatsApp: async (jid) => [{ exists: !jid.split("@")[0].endsWith("0000"), jid }],
  sendPresenceUpdate: async () => {},
  sendMessage: async (jid, content, opts) => { sent.push({ jid, text: content.text, id: opts?.messageId, from: phone }); return { key: { id: opts?.messageId } }; },
  end() {},
});
const sms = [];
const gateway = http.createServer((rq, rs) => { sms.push(new URL(rq.url, "http://x")); rs.end("OK"); });
await new Promise((r) => gateway.listen(3092, "127.0.0.1", r));
const meta = [];
const fakeMeta = http.createServer((rq, rs) => { let b = ""; rq.on("data", (c) => (b += c)); rq.on("end", () => { meta.push({ path: rq.url, body: JSON.parse(b || "{}") }); rs.setHeader("content-type", "application/json"); rs.end(JSON.stringify({ messages: [{ id: "wamid.1" }] })); }); });
await new Promise((r) => fakeMeta.listen(3093, "127.0.0.1", r));

await must(call("POST", "/api/users", { cookie: owner, headers: { "x-onetap-brand": brandA }, body: { email: "m@acme.test", name: "Manager", password: "Manager123!", role: "manager" } }), "manager");
const manager = await login("m@acme.test", "Manager123!");
const acc = (await must(call("POST", "/api/whatsapp/accounts", { cookie: owner, body: { label: "Counter phone" } }))).json.account.id;
const mapping = (method, extra = {}) => ({ codes: { method, linkedMessage: "", whatsappTemplate: { name: "", language: "en", copyButton: false }, ...extra } });
// (this suite is about HOW codes go out, so the "wait before asking again" history is cleared first — the waits have their own suite, otp-resend.mjs)
const request = async (phone) => { await raw("otpthrottles").deleteMany({}); return call("POST", "/api/customer/otp/request", { body: { outletId: OUTLET, destination: phone } }); };

say("1. before anything is chosen");
let r = await call("GET", "/api/notify/messaging", { cookie: owner });
ok(r.status === 200 && r.json.codes.method === "screen" && r.json.codes.explicit === false, "a store that never chose sends nothing and shows the code on screen", r.json.codes?.method);
ok(r.json.ready.linked.ok === false && r.json.storeName === "Acme", "linked WhatsApp says why it can't be chosen yet, and the page knows the store's name", r.json.ready.linked.reason);
r = await request("9876543210");
ok(r.status === 200 && r.json.devCode && !r.json.sent, "the sign-in screen still gets the code (as before)");

say("2. choosing a way that can't send is refused");
r = await call("PUT", "/api/notify/messaging", { cookie: owner, body: mapping("linked") });
ok(r.status === 409, "linked WhatsApp with no connected number is refused", `${r.status} ${r.json.error}`);
r = await call("PUT", "/api/notify/messaging", { cookie: owner, body: mapping("sms") });
ok(r.status === 409, "SMS with no gateway is refused", `${r.status} ${r.json.error}`);
r = await call("PUT", "/api/notify/messaging", { cookie: owner, body: mapping("whatsapp") });
ok(r.status === 400, "WhatsApp Business without a template name is refused", `${r.status} ${r.json.error}`);
ok((await call("PUT", "/api/notify/messaging", { cookie: owner, body: mapping("linked", { linkedMessage: "no code here" }) })).status === 400, "a message without {{code}} is refused");
ok((await call("PUT", "/api/notify/messaging", { cookie: owner, body: { codes: { method: "bogus" } } })).status === 400, "an unknown way is refused");
ok((await call("PUT", "/api/notify/messaging", { cookie: manager, body: mapping("screen") })).status === 403, "only people allowed to manage notifications can change it (a manager can't)");
ok((await call("GET", "/api/notify/messaging", { cookie: manager })).status === 200, "…but a manager can read it");

say("3. linked WhatsApp");
await raw("waaccounts").updateOne({ _id: oid(acc) }, { $set: { status: "connected", phone: "919000000001", seenAt: new Date(), qr: "" } });
const entry = { sock: fakeSock("919000000001"), brandId: brandA, connected: true, busy: false };
worker.__test.sockets.set(acc, entry);
const loop = setInterval(() => { raw("waaccounts").updateOne({ _id: oid(acc) }, { $set: { seenAt: new Date() } }).catch(() => {}); worker.__test.sendNext(acc, entry).catch(() => {}); }, 300);
r = await call("PUT", "/api/notify/messaging", { cookie: owner, body: mapping("linked", { linkedMessage: "Your {{store}} code: {{code}}" }) });
ok(r.status === 200 && r.json.codes.method === "linked" && r.json.codes.explicit === true && r.json.ready.linked.ok, "linked WhatsApp can be chosen once a number is online", r.json.error ?? "");
const t0 = Date.now();
r = await request("9876543210");
ok(r.status === 200 && r.json.sent === true && r.json.via === "linked" && !r.json.devCode, "the request is answered 'sent' and the code is NOT returned", JSON.stringify(r.json));
ok(sent.length === 1 && sent[0].jid === "919876543210@s.whatsapp.net", "the code went out over the linked number, to the right person", sent[0]?.jid);
const code = (sent[0]?.text ?? "").match(/\d{6}/)?.[0];
ok(/^Your Acme code: \d{6}$/.test(sent[0]?.text ?? ""), "…in the store's own words", sent[0]?.text);
ok(Date.now() - t0 < 8000, "…within seconds", `${Date.now() - t0} ms`);
const stored = await raw("wamessages").findOne({ source: "code" });
ok(stored?.status === "sent" && stored.text === schema.WA_CODE_REDACTED && stored.pace === "code", "the stored message says a code was sent — never the code itself", stored?.text);
ok(!JSON.stringify(await raw("wamessages").find({}).toArray()).includes(code), "the code is nowhere in any stored WhatsApp message");
const chat = await raw("wachats").findOne({ phone: "919876543210" });
ok(chat?.hidden === true && !chat.lastMessageAt && !chat.lastOutboundAt, "the stranger's chat is hidden, and sending the code didn't count as a conversation", JSON.stringify({ hidden: chat?.hidden, last: chat?.lastMessageAt }));
r = await call("GET", "/api/whatsapp/chats", { cookie: owner });
ok(r.status === 200 && !r.json.chats.some((c) => c.phone === "919876543210"), "…so the owner's chat list doesn't show them");
r = await call("POST", `/api/whatsapp/chats/${chat._id}/messages/${stored._id}/retry`, { cookie: owner });
ok(r.status === 404, "a failed code can't be re-sent from the inbox", `${r.status}`);
r = await call("POST", "/api/customer/otp/verify", { body: { outletId: OUTLET, destination: "9876543210", code: "123456", name: "Asha" } });
ok(r.status === 400, "the test code 123456 no longer works once codes are really sent", `${r.status}`);
r = await call("POST", "/api/customer/otp/verify", { body: { outletId: OUTLET, destination: "9876543210", code, name: "Asha" } });
ok(r.status === 200 && r.json.customer?.name === "Asha", "the code that was sent signs the customer up", `${r.status}`);
r = await call("POST", "/api/whatsapp/chats", { cookie: owner, body: { phone: "9876543210", name: "Asha" } });
ok(r.status === 200 || r.status === 201, "when the store starts a real chat with that customer…", `${r.status}`);
r = await call("GET", "/api/whatsapp/chats", { cookie: owner });
ok(r.json.chats.some((c) => c.phone === "919876543210"), "…they show up in the inbox");

// the message can run over several lines and use variables
say("3b. the message — several lines and variables");
await raw("outlets").updateOne({ _id: oid(OUTLET_A) }, { $set: { "config.identity.phone": "+91 98765 43210" } });
const multi = "Hi {{name}}\n{{code}} — {{store}} / {{outlet}}\nPhone {{phone}} · {{date}} {{time}}\nValid {{minutes}} min · Help: {{store_phone}}";
r = await call("PUT", "/api/notify/messaging", { cookie: owner, body: mapping("linked", { linkedMessage: multi }) });
ok(r.status === 200 && r.json.codes.linkedMessage === multi, "a four-line message using every variable is saved exactly as typed (line breaks kept)", `${r.status} ${r.json.error ?? ""}`);
const asCustomer = (phone, name) => call("POST", "/api/customer/otp/request", { body: { outletId: OUTLET, destination: phone, ...(name ? { name } : {}) } });
const sentAt = sent.length;
await raw("otpthrottles").deleteMany({});
r = await asCustomer("9811200031", "Ravi Kumar");
const line = (sent[sentAt]?.text ?? "");
ok(r.status === 200 && /^Hi Ravi\n\d{6} — Acme \/ Main\nPhone 98112 00031 · \d{1,2} [A-Z][a-z]{2} \d{4} \d{1,2}:\d{2} (am|pm)\nValid 10 min · Help: \+91 98765 43210$/.test(line), "every variable is filled in, the four lines arrive as four lines", JSON.stringify(line));
ok(line.split("\n").length === 4, "…the line breaks reach WhatsApp as typed");
await raw("otpthrottles").deleteMany({});
r = await asCustomer("9876543210", "Mallory Evil");
ok(r.status === 200 && /^Hi Asha\n/.test(sent.at(-1)?.text ?? ""), "a customer we already know is greeted by the name on file, not by what was typed into the form", sent.at(-1)?.text?.split("\n")[0]);
const names = [["http://evil.example/pay", "9811200032"], ["12345", "9811200033"], [undefined, "9811200034"], ["  ", "9811200035"], ["Zoë", "9811200036"]];
const greeted = [];
for (const [nm, ph] of names) { await raw("otpthrottles").deleteMany({}); await asCustomer(ph, nm); greeted.push((sent.at(-1)?.text ?? "").split("\n")[0]); }
ok(greeted.slice(0, 4).every((g) => g === "Hi there") && greeted[4] === "Hi Zoë", "a typed name that isn't a plain name (a link, digits, nothing) is replaced by 'there'; an accented name is kept", JSON.stringify(greeted));
r = await call("PUT", "/api/notify/messaging", { cookie: owner, body: mapping("linked", { linkedMessage: "{{code}} for {{store}} {{cod}} {{foo}}" }) });
ok(r.status === 400 && /\{\{cod\}\}, \{\{foo\}\} aren't variables/.test(r.json.error ?? ""), "a variable that doesn't exist is refused, naming the ones that are wrong", `${r.status} ${r.json.error}`);
r = await call("PUT", "/api/notify/messaging", { cookie: owner, body: mapping("linked", { linkedMessage: "{{ CODE }}\n\n{{ Store }}" }) });
ok(r.status === 200, "spaces and capitals inside the brackets are fine, blank lines too", `${r.status} ${r.json.error ?? ""}`);
r = await call("PUT", "/api/notify/messaging", { cookie: owner, body: mapping("linked", { linkedMessage: "{{code}} " + "x".repeat(1001) }) });
ok(r.status === 400, "a message longer than 1000 characters is refused", `${r.status}`);
r = await call("PUT", "/api/notify/messaging", { cookie: owner, body: mapping("linked", { linkedMessage: "Your {{store}} code: {{code}}" }) });
ok(r.status === 200, "(the earlier wording is put back for the checks below)");

// a big broadcast is waiting in the same number's queue: a sign-in code must not wait behind it
// (daytime for this check — in quiet hours the broadcast would simply be put off until morning, hiding the problem)
const quiet = { from: schema.WA_PACING.cold.quietFrom, to: schema.WA_PACING.cold.quietTo };
schema.WA_PACING.cold.quietFrom = 24; schema.WA_PACING.cold.quietTo = 0;
const asha = await raw("wachats").findOne({ phone: "919876543210" });
await raw("wamessages").insertMany(Array.from({ length: 30 }, (_, i) => ({ brandId: brandA, chatId: String(asha._id), accountId: acc, direction: "out", type: "text", text: `Offer ${i}`, status: "queued", source: "broadcast", pace: "cold", sendAfter: new Date(Date.now() - 5000 - i), at: new Date(), createdAt: new Date(Date.now() - 5000 - i), updatedAt: new Date(), deleted: false, revoke: "" })));
const sentBeforeBacklog = sent.length;
const tBack = Date.now();
r = await request("9811200020");
ok(r.status === 200 && r.json.sent === true && sent.length === sentBeforeBacklog + 1 && /\d{6}/.test(sent.at(-1)?.text ?? "") && sent.at(-1)?.jid === "919811200020@s.whatsapp.net", "a code goes out at once even with 30 broadcast messages queued ahead of it", `${r.status} in ${Date.now() - tBack} ms`);
ok((await raw("wamessages").countDocuments({ source: "broadcast", status: "queued" })) >= 28, "…while the broadcast keeps waiting for its own slow pace");
await raw("wamessages").deleteMany({ source: "broadcast" });
schema.WA_PACING.cold.quietFrom = quiet.from; schema.WA_PACING.cold.quietTo = quiet.to;

// two connected numbers: each code goes out from one of them, picked at random
const acc2 = (await must(call("POST", "/api/whatsapp/accounts", { cookie: owner, body: { label: "Second phone" } }))).json.account.id;
await raw("waaccounts").updateOne({ _id: oid(acc2) }, { $set: { status: "connected", phone: "919000000002", seenAt: new Date(), qr: "" } });
const entry2 = { sock: fakeSock("919000000002"), brandId: brandA, connected: true, busy: false };
worker.__test.sockets.set(acc2, entry2);
const loop2 = setInterval(() => { raw("waaccounts").updateOne({ _id: oid(acc2) }, { $set: { seenAt: new Date() } }).catch(() => {}); worker.__test.sendNext(acc2, entry2).catch(() => {}); }, 300);
const sentBeforeSpread = sent.length;
const people = Array.from({ length: 16 }, (_, i) => `98112003${String(i).padStart(2, "0")}`);
await raw("otpthrottles").deleteMany({});
const spread = await Promise.all(people.map((p) => call("POST", "/api/customer/otp/request", { body: { outletId: OUTLET, destination: p } })));
ok(spread.every((x) => x.status === 200 && x.json.sent === true), "16 customers ask for a code at once with two numbers online — all are sent", spread.map((x) => x.status).join(","));
const byNumber = sent.slice(sentBeforeSpread).reduce((m, x) => ({ ...m, [x.from]: (m[x.from] ?? 0) + 1 }), {});
ok(Object.keys(byNumber).length === 2, "the codes were spread over BOTH connected numbers (picked at random)", JSON.stringify(byNumber));
ok(people.every((p) => sent.slice(sentBeforeSpread).filter((x) => x.jid === `91${p}@s.whatsapp.net`).length === 1), "…and each customer got exactly one code");
// only ONLINE numbers are picked: with the second one gone, everything goes through the first again
clearInterval(loop2); worker.__test.sockets.delete(acc2);
await raw("waaccounts").updateOne({ _id: oid(acc2) }, { $set: { status: "disconnected", seenAt: new Date(Date.now() - 3600_000) } });
const sentBeforeOne = sent.length;
r = await request("9811200400");
ok(r.status === 200 && sent.slice(sentBeforeOne).every((x) => x.from === "919000000001") && sent.length === sentBeforeOne + 1, "a number that is offline is never picked", sent.at(-1)?.from);
await raw("waaccounts").deleteOne({ _id: oid(acc2) });

say("4. problems");
r = await request("9811230000");
ok(r.status === 502 && /isn't on WhatsApp/.test(r.json.error) && !r.json.devCode, "a number that isn't on WhatsApp is told so", `${r.status} ${r.json.error}`);
const before = sent.length;
const savedPerDay = schema.WA_PACING.code.perDay;
schema.WA_PACING.code.perDay = 2; // two codes have already gone out today (+ the failed one counts too)
r = await request("9811200009");
ok(r.status === 502 && /Too many codes/.test(r.json.error) && sent.length === before, "past the daily cap no more codes go out (the number is protected from a flood)", `${r.status} ${r.json.error}`);
schema.WA_PACING.code.perDay = savedPerDay;
await raw("waaccounts").updateOne({ _id: oid(acc) }, { $set: { status: "disconnected" } });
clearInterval(loop);
r = await request("9811111111");
ok(r.status === 502 && !r.json.devCode && /can't send the code/.test(r.json.error), "with the number offline the customer is asked to try later — and is NOT shown the code", `${r.status} ${r.json.error}`);
ok(sent.length === before, "nothing else was sent");
r = await call("POST", "/api/customer/otp/verify", { body: { outletId: OUTLET, destination: "9811111111", code: "123456", name: "Bob" } });
ok(r.status === 400, "…and 123456 does not let them in", `${r.status}`);

say("5. SMS");
ok((await call("PUT", "/api/notify/config/sms", { cookie: owner, body: { values: { requestUrl: "http://127.0.0.1:3092/sms?key={{apiKey}}&to={{to}}&msg={{message}}", apiKey: "K9", otpTemplate: "Code {{code}} for {{store}}" } } })).status === 200, "the owner sets up the SMS gateway");
r = await call("PUT", "/api/notify/messaging", { cookie: owner, body: mapping("sms") });
ok(r.status === 200 && r.json.codes.method === "sms" && r.json.codes.smsMessage === "Code {{code}} for {{store}}", "SMS can now be chosen", r.json.error ?? "");
r = await request("9811200010");
const hit = sms.at(-1);
ok(r.status === 200 && r.json.via === "sms" && !r.json.devCode && hit?.searchParams.get("to") === "9811200010" && /^Code \d{6} for Acme$/.test(hit?.searchParams.get("msg") ?? ""), "the code goes through the gateway in the 'Code message' wording", `${r.status} ${hit?.searchParams.get("msg")}`);

// the SMS "Code message" can use the same variables
const smsUrl = "http://127.0.0.1:3092/sms?key={{apiKey}}&to={{to}}&msg={{message}}";
await call("PUT", "/api/notify/config/sms", { cookie: owner, body: { values: { requestUrl: smsUrl, apiKey: "K9", otpTemplate: "{{code}} is your {{store}} code, {{name}} ({{outlet}})" } } });
r = await request("9811200050");
ok(r.status === 200 && /^\d{6} is your Acme code, there \(Main\)$/.test(sms.at(-1)?.searchParams.get("msg") ?? ""), "an SMS 'Code message' can use the same variables", sms.at(-1)?.searchParams.get("msg"));
await call("PUT", "/api/notify/config/sms", { cookie: owner, body: { values: { requestUrl: smsUrl, apiKey: "K9", otpTemplate: "Code {{code}} for {{store}}" } } });

say("6. WhatsApp Business");
ok((await call("PUT", "/api/notify/config/whatsapp", { cookie: owner, body: { values: { phoneNumberId: "109876543", accessToken: "tok_abc" } } })).status === 200, "the owner adds the WhatsApp Business connection");
r = await call("PUT", "/api/notify/messaging", { cookie: owner, body: mapping("whatsapp", { whatsappTemplate: { name: "login_code", language: "en_US", copyButton: true } }) });
ok(r.status === 200 && r.json.codes.method === "whatsapp" && r.json.codes.whatsappTemplate.copyButton === true, "WhatsApp Business can now be chosen, with a template", r.json.error ?? "");
r = await request("9811200011");
const m = meta.at(-1);
const mcode = m?.body?.template?.components?.[0]?.parameters?.[0]?.text;
ok(r.status === 200 && r.json.via === "whatsapp" && !r.json.devCode && m?.path === "/v20.0/109876543/messages" && m?.body?.to === "919811200011" && m?.body?.template?.name === "login_code" && m?.body?.template?.language?.code === "en_US", "Meta receives the template, language and number", `${r.status} ${m?.path}`);
ok(/^\d{6}$/.test(mcode ?? "") && m?.body?.template?.components?.[1]?.type === "button" && m.body.template.components[1].parameters[0].text === mcode, "…with the code in {{1}} and in the Copy-code button");
await call("PUT", "/api/notify/messaging", { cookie: owner, body: mapping("whatsapp", { whatsappTemplate: { name: "login_code", language: "en", copyButton: false } }) });
await request("9811200012");
ok(meta.at(-1)?.body?.template?.components?.length === 1, "without the button ticked only the body carries the code");

say("7. staff coin codes and plan rules");
await call("PUT", "/api/notify/messaging", { cookie: owner, body: mapping("sms") });
r = await call("POST", "/api/orders/staff/coins-code", { cookie: owner, body: { phone: "9811200010" } });
ok(r.status === 404, "coin codes need a customer who has coins (a number that never ordered has none)", `${r.status}`);
await raw("customers").updateOne({ phone: "9876543210" }, { $set: { walletBalance: 50 } });
r = await call("POST", "/api/orders/staff/coins-code", { cookie: owner, body: { phone: "9876543210" } });
ok(r.status === 200 && r.json.sent === true && sms.at(-1)?.searchParams.get("to") === "9876543210", "a staff coin code uses the chosen way too (SMS here)", `${r.status}`);
const noAlerts = (await must(call("POST", "/api/platform/plans", { cookie: su, body: { name: "Bare", entitlements: { features: schema.FEATURE_KEYS.filter((k) => k !== "whatsappChat" && k !== "notifications") } } }), "plan")).json.plan;
const b = (await must(call("POST", "/api/brands", { cookie: su, body: { brandName: "Bare Bites", brandSlug: "bare", outletName: "Only", outletSlug: "only", hostnames: ["bare.test"], ownerEmail: "o@bare.test", ownerName: "Owner", ownerPassword: "Owner123!", planId: noAlerts.id ?? noAlerts._id } }), "bare store")).json;
OUTLET = String(b.outlet?._id ?? b.outlet?.id ?? b.outletId);
const ownerBare = await login("o@bare.test", "Owner123!");
r = await call("PUT", "/api/notify/messaging", { cookie: ownerBare, body: mapping("linked") });
ok(r.status === 409 && /isn't in this store's plan/.test(r.json.error), "a store whose plan lacks WhatsApp chat can't choose linked WhatsApp", `${r.status} ${r.json.error}`);
r = await call("PUT", "/api/notify/messaging", { cookie: ownerBare, body: mapping("sms") });
ok(r.status === 409, "…nor SMS or WhatsApp Business (WhatsApp & SMS alerts)", `${r.status}`);
ok((await call("PUT", "/api/notify/messaging", { cookie: ownerBare, body: mapping("screen") })).status === 200, "…but 'Don't send' is always allowed");
OUTLET = OUTLET_A;

say("8. a store that turned SMS codes on the old way keeps working");
await call("PUT", "/api/notify/messaging", { cookie: owner, body: mapping("screen") });
await raw("brands").updateOne({ _id: oid(brandA) }, { $set: { messaging: null } });
await raw("notificationcredentials").updateOne({ brandId: brandA, channel: "sms" }, { $set: { "publicFields.otpEnabled": "on" } });
r = await call("GET", "/api/notify/messaging", { cookie: owner });
ok(r.json.codes.method === "sms" && r.json.codes.explicit === false, "with no choice saved, the old 'codes by SMS' switch still counts: SMS", JSON.stringify({ m: r.json.codes.method, e: r.json.codes.explicit }));
const nSms = sms.length;
r = await request("9811200013");
ok(r.status === 200 && r.json.sent === true && sms.length === nSms + 1, "…and codes still go out by SMS");
await call("PUT", "/api/notify/messaging", { cookie: owner, body: mapping("screen") });
r = await request("9811200014");
ok(r.status === 200 && r.json.devCode, "once the owner chooses 'Don't send' that wins over the old switch");

gateway.close(); fakeMeta.close();
console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
