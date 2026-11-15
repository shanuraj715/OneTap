// WhatsApp chat — API + worker checks on an in-memory database (nothing real is touched). The worker's WhatsApp
// connection is replaced by a stand-in, except the last phase, which asks WhatsApp's servers for a real link QR.
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { fileURLToPath as __f } from "node:url";
import { mkdirSync as __mk } from "node:fs";
const REPO = __f(new URL("../../..", import.meta.url)).replace(/\/$/, "");
const API = `${REPO}/apps/api`;
const PORT = 3098;
const __RUN = __f(new URL("../.bench/suite-run/", import.meta.url));
__mk(__RUN, { recursive: true });
process.chdir(__RUN); // no .env here → the real database URI is never read
const req = createRequire(`${API}/package.json`);
const mms = await import(pathToFileURL(req.resolve("mongodb-memory-server")).href);
const mongod = await (mms.MongoMemoryServer ?? mms.default.MongoMemoryServer).create();
Object.assign(process.env, { NODE_ENV: "development", API_PORT: String(PORT), MONGODB_URI: mongod.getUri(), MONGODB_DB: "sandbox", WHATSAPP_WORKER: "on", LOG_LEVEL: "warn" });
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
await must(call("POST", "/api/users", { cookie: owner, headers: { "x-onetap-brand": brandA }, body: { email: "m@acme.test", name: "Manager", password: "Manager123!", role: "manager" } }), "manager");
await must(call("POST", "/api/users", { cookie: owner, headers: { "x-onetap-brand": brandA }, body: { email: "s@acme.test", name: "Staff", password: "Staff1234!", role: "staff" } }), "staff");
const manager = await login("m@acme.test", "Manager123!");
const staff = await login("s@acme.test", "Staff1234!");
const plan = (await must(call("POST", "/api/platform/plans", { cookie: su, body: { name: "No chat", entitlements: { features: schema.FEATURE_KEYS.filter((k) => k !== "whatsappChat") } } }), "plan")).json.plan;
const b = (await must(call("POST", "/api/brands", { cookie: su, body: { brandName: "Beta", brandSlug: "beta", outletName: "Only", outletSlug: "only", hostnames: ["beta.test"], ownerEmail: "o@beta.test", ownerName: "B", ownerPassword: "Owner123!", planId: String(plan._id ?? plan.id) } }), "store B")).json;
const OUTLET_B = String(b.outlet?._id ?? b.outlet?.id ?? b.outletId);
const ownerB = await login("o@beta.test", "Owner123!");

/* ------------------------------------------------------------------ access */
say("1. who can use it");
let r = await call("GET", "/api/whatsapp/me", { cookie: owner });
ok(r.status === 200 && r.json.level === "manage", "the owner can do everything", r.json.level);
ok((await call("GET", "/api/whatsapp/me", { cookie: manager })).status === 403, "a manager can't, until the owner allows it");
ok((await call("GET", "/api/whatsapp/me", { cookie: staff })).status === 403, "…nor a cashier");
r = await call("PUT", "/api/whatsapp/access", { cookie: owner, body: { access: { manager: "send", staff: "read" } } });
ok(r.status === 200 && r.json.access.manager === "send" && r.json.access.kitchen === "none", "the owner gives managers 'read and reply' and cashiers 'read'");
ok((await call("GET", "/api/whatsapp/me", { cookie: manager })).json.level === "send", "the manager now reads and replies");
ok((await call("GET", "/api/whatsapp/me", { cookie: staff })).json.level === "read", "the cashier now only reads");
ok((await call("PUT", "/api/whatsapp/access", { cookie: manager, body: { access: { staff: "send" } } })).status === 403, "only the owner changes who has access");
ok((await call("POST", "/api/whatsapp/accounts", { cookie: manager, body: { label: "Mine" } })).status === 403, "only the owner links numbers");
ok((await call("GET", "/api/whatsapp/me", { cookie: su })).json.level === "read", "the platform super admin can read");
OUTLET = OUTLET_B;
r = await call("GET", "/api/whatsapp/me", { cookie: ownerB });
ok(r.status === 403 && r.json.details?.code === "not_in_plan", "a store whose plan lacks it is told so", r.json.error);
OUTLET = OUTLET_A;
ok((await call("GET", "/api/whatsapp/chats", { cookie: ownerB })).status === 403, "another store's owner can't read this store's chats");

/* ------------------------------------------------------------------ numbers */
say("2. linking numbers");
r = await call("POST", "/api/whatsapp/accounts", { cookie: owner, body: { label: "Counter phone" } });
ok(r.status === 201 && r.json.account.status === "pending", "linking a number starts as 'waiting for the scan'", r.json.account?.status);
const acc1 = r.json.account.id;
const acc2 = (await call("POST", "/api/whatsapp/accounts", { cookie: owner, body: { label: "Number 2" } })).json.account.id;
ok((await call("POST", "/api/whatsapp/accounts", { cookie: owner, body: { label: "" } })).status === 400, "a number needs a name");
// what the worker writes once the phone has scanned
const online = (id, phone) => raw("waaccounts").updateOne({ _id: oid(id) }, { $set: { status: "connected", phone, seenAt: new Date(), qr: "" } });
await online(acc1, "919000000001");
await online(acc2, "919000000002");
r = await call("GET", "/api/whatsapp/accounts", { cookie: owner });
ok(r.json.accounts.every((x) => x.online) && r.json.accounts[0].label === "Counter phone", "both show as online, with their names");
r = await call("PATCH", `/api/whatsapp/accounts/${acc2}`, { cookie: owner, body: { label: "Delivery phone" } });
ok(r.json.account?.label === "Delivery phone", "a number can be renamed");
ok((await call("DELETE", `/api/whatsapp/accounts/${acc1}`, { cookie: owner })).status === 409, "a linked number must be unlinked before it's removed");
r = await call("GET", "/api/whatsapp/accounts", { cookie: staff });
ok(r.status === 200 && r.json.accounts.every((x) => !x.qr), "people who aren't the owner never see a link QR");

/* -------------------------------------------------------------------- chats */
say("3. chats and sending");
ok((await call("POST", "/api/whatsapp/chats", { cookie: owner, body: { phone: "12345" } })).status === 400, "a number that can't be a phone is refused");
r = await call("POST", "/api/whatsapp/chats", { cookie: owner, body: { phone: "98765 43210", name: "Riya" } });
const chat1 = r.json.chat;
ok(r.status === 201 && chat1.phone === "919876543210", "a 10-digit number becomes an Indian one", chat1?.phone);
ok((await call("POST", "/api/whatsapp/chats", { cookie: owner, body: { phone: "+91 98765-43210" } })).json.chat.id === chat1.id, "the same number written differently opens the same chat");
ok((await call("POST", `/api/whatsapp/chats/${chat1.id}/messages`, { cookie: staff, body: { text: "hi" } })).status === 403, "a read-only role can't send");
ok((await call("POST", `/api/whatsapp/chats/${chat1.id}/messages`, { cookie: owner, body: { text: "  " } })).status === 400, "an empty message is refused");
r = await call("POST", `/api/whatsapp/chats/${chat1.id}/messages`, { cookie: manager, body: { text: "Hello Riya" } });
ok(r.status === 201 && r.json.message.status === "queued" && r.json.message.pace === "cold", "a first message to a new number is queued as a first contact (paced)", `${r.json.message?.status} ${r.json.message?.pace}`);
let c = (await call("GET", `/api/whatsapp/chats/${chat1.id}`, { cookie: owner })).json.chat;
ok(c.accountId, "the chat is given a number automatically", c.accountLabel);
const chat1Account = c.accountId;
r = await call("POST", `/api/whatsapp/chats/${chat1.id}/messages`, { cookie: owner, body: { text: "One more thing" } });
ok(r.json.message.pace === "cold", "…and a follow-up before anything was actually sent is still a first contact");

// the chat's number goes offline
await raw("waaccounts").updateOne({ _id: oid(chat1Account) }, { $set: { seenAt: new Date(Date.now() - 10 * 60_000) } });
r = await call("POST", `/api/whatsapp/chats/${chat1.id}/messages`, { cookie: owner, body: { text: "Are you there?" } });
const other = chat1Account === acc1 ? acc2 : acc1;
ok(r.status === 409 && r.json.details?.code === "number_offline" && r.json.details.others.length === 1 && r.json.details.others[0].id === other, "its number offline → 409 that names the numbers that ARE online", r.json.error);
r = await call("POST", `/api/whatsapp/chats/${chat1.id}/messages`, { cookie: owner, body: { text: "Are you there?", accountId: other } });
ok(r.status === 201, "sending again from the other number works");
c = (await call("GET", `/api/whatsapp/chats/${chat1.id}`, { cookie: owner })).json.chat;
ok(c.accountId === other, "…and that number becomes the chat's number from now on");
const queuedOnOld = await raw("wamessages").countDocuments({ chatId: chat1.id, status: "queued", accountId: chat1Account });
ok(queuedOnOld === 2, "(earlier queued messages stay with the number they were written on)", String(queuedOnOld));
r = await call("PATCH", `/api/whatsapp/chats/${chat1.id}`, { cookie: owner, body: { accountId: other } });
ok(r.status === 200 && (await raw("wamessages").countDocuments({ chatId: chat1.id, status: "queued", accountId: chat1Account })) === 0, "moving a chat to another number takes its waiting messages along");
await raw("waaccounts").updateMany({}, { $set: { seenAt: new Date(Date.now() - 10 * 60_000) } });
const lonely = (await call("POST", "/api/whatsapp/chats", { cookie: owner, body: { phone: "9811111111" } })).json.chat;
r = await call("POST", `/api/whatsapp/chats/${lonely.id}/messages`, { cookie: owner, body: { text: "Hi" } });
ok(r.status === 409 && r.json.details?.code === "no_number", "with no number online, a brand-new chat can't start");
await online(acc1, "919000000001"); await online(acc2, "919000000002");

// attachments
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
r = await call("POST", "/api/whatsapp/media?name=menu%20card.png", { cookie: owner, headers: { "content-type": "image/png" }, rawBody: png });
ok(r.status === 201 && r.json.type === "image" && r.json.media.url && r.json.media.fileName === "menu card.png", "an attachment uploads", r.json.media?.url?.slice(0, 50));
const media = r.json.media;
r = await call("POST", `/api/whatsapp/chats/${chat1.id}/messages`, { cookie: owner, body: { text: "Our menu", media } });
ok(r.status === 201 && r.json.message.type === "image" && r.json.message.media?.url === media.url, "a photo with a caption is queued");
r = await call("POST", "/api/whatsapp/media?name=x.pdf", { cookie: staff, headers: { "content-type": "application/pdf" }, rawBody: png });
ok(r.status === 403, "a read-only role can't upload");

/* ------------------------------------------------------------------- worker */
say("4. the worker sends — at a careful pace");
const sent = [];
const presence = [];
const fakeSock = (phone) => ({
  user: { id: `${phone}:1@s.whatsapp.net`, name: "Shop" },
  onWhatsApp: async (jid) => [{ exists: !jid.startsWith("910000"), jid }],
  sendPresenceUpdate: async (s, jid) => presence.push(s),
  sendMessage: async (jid, content, opts) => { sent.push({ jid, content, id: opts?.messageId }); return { key: { id: opts?.messageId } }; },
  signalRepository: { lidMapping: { getPNForLID: async (lid) => (lid === "777@lid" ? "919812345678@s.whatsapp.net" : null) } },
  end() {},
});
const entry = { sock: fakeSock("919000000002"), brandId: brandA, connected: true, busy: false };
worker.__test.sockets.set(other, entry);
const queue = await raw("wamessages").find({ accountId: other, status: "queued" }).toArray();
await raw("waaccounts").updateOne({ _id: oid(other) }, { $set: { coldNextAt: null, coldCount: 0, lastSendAt: null } });
const quiet = schema.waAfterQuietHours(new Date(), 0) > new Date();
await worker.__test.sendNext(other, entry);
if (quiet) {
  const later = await raw("wamessages").findOne({ _id: queue[0]._id });
  ok(sent.length === 0 && later.sendAfter > new Date(), "it's quiet hours now (10 pm–9 am): first contacts wait for the morning", later.sendAfter.toISOString());
  await raw("wamessages").updateMany({ accountId: other }, { $set: { sendAfter: new Date(Date.now() - 1000) } });
  // pretend it's daytime for the rest: give the pace a daytime clock by moving the quiet hours out of the way
  schema.WA_PACING.cold.quietFrom = 24; schema.WA_PACING.cold.quietTo = 0;
  await worker.__test.sendNext(other, entry);
}
ok(sent.length === 1 && sent[0].jid === "919876543210@s.whatsapp.net", "one message goes out, to the right number", sent[0]?.jid);
ok(presence.includes("composing"), "…after showing 'typing…'");
let m1 = await raw("wamessages").findOne({ waId: sent[0]?.id });
ok(m1?.status === "sent", "…and is marked sent, with WhatsApp's id saved first");
let accDoc = await raw("waaccounts").findOne({ _id: oid(other) });
ok(accDoc.coldCount === 1 && accDoc.coldNextAt > new Date(Date.now() + 110_000) && accDoc.coldNextAt < new Date(Date.now() + 250_000), "the next first contact must wait 2–4 minutes", `${Math.round((accDoc.coldNextAt - Date.now()) / 1000)} s`);
await sleep(1300);
await worker.__test.sendNext(other, entry);
ok(sent.length === 1, "so the next queued first-contact message does NOT go out yet");

// a running conversation goes at human speed, even while first contacts wait
const warm = (await call("POST", "/api/whatsapp/chats", { cookie: owner, body: { phone: "9822222222" } })).json.chat;
await raw("wachats").updateOne({ _id: oid(warm.id) }, { $set: { lastInboundAt: new Date(), accountId: other } });
r = await call("POST", `/api/whatsapp/chats/${warm.id}/messages`, { cookie: owner, body: { text: "Yes, it's ready!" } });
ok(r.json.message.pace === "warm", "a reply to someone who wrote to us is a running conversation");
await sleep(1300);
await worker.__test.sendNext(other, entry);
ok(sent.length === 2 && sent[1].content.text === "Yes, it's ready!", "…and goes out straight away, ahead of the waiting first contacts");

// the day's budget
await raw("waaccounts").updateOne({ _id: oid(other) }, { $set: { coldCount: 15, coldDay: schema.waLocalClock().day, coldNextAt: null, lastSendAt: null } });
await worker.__test.sendNext(other, entry);
const waitingCold = await raw("wamessages").find({ accountId: other, status: "queued", pace: "cold" }).toArray();
ok(sent.length === 2 && waitingCold.every((x) => x.sendAfter > new Date(Date.now() + 60_000)), "15 first contacts a day per number: the rest wait for tomorrow", waitingCold[0]?.sendAfter?.toISOString());

// not on WhatsApp
await raw("waaccounts").updateOne({ _id: oid(other) }, { $set: { coldCount: 0, coldNextAt: null, lastSendAt: null } });
await raw("wamessages").updateMany({ accountId: other, status: "queued" }, { $set: { status: "failed" } });
const ghost = (await call("POST", "/api/whatsapp/chats", { cookie: owner, body: { phone: "+91 0000 000 0000" } }));
const ghostChat = (await call("POST", "/api/whatsapp/chats", { cookie: owner, body: { phone: "910000000099" } })).json.chat;
await call("PATCH", `/api/whatsapp/chats/${ghostChat.id}`, { cookie: owner, body: { accountId: other } });
await call("POST", `/api/whatsapp/chats/${ghostChat.id}/messages`, { cookie: owner, body: { text: "hello?" } });
await worker.__test.sendNext(other, entry);
const ghostMsg = await raw("wamessages").findOne({ chatId: ghostChat.id });
ok(ghostMsg.status === "failed" && /isn't on WhatsApp/.test(ghostMsg.error), "a number that isn't on WhatsApp is never messaged", ghostMsg.error);
r = await call("POST", `/api/whatsapp/chats/${ghostChat.id}/messages/${ghostMsg._id}/retry`, { cookie: owner });
ok(r.status === 204 && (await raw("wamessages").findOne({ _id: ghostMsg._id })).status === "queued", "a failed message can be tried again");

// photo
await raw("wamessages").deleteMany({ chatId: ghostChat.id });
await raw("waaccounts").updateOne({ _id: oid(other) }, { $set: { coldNextAt: null, lastSendAt: null } });
await raw("wamessages").updateMany({ accountId: other, type: "image" }, { $set: { status: "queued", sendAfter: new Date(Date.now() - 1000), pace: "warm" } });
await worker.__test.sendNext(other, entry);
const photo = sent.find((s) => s.content.image);
ok(photo && Buffer.isBuffer(photo.content.image) && photo.content.image.length === png.length && photo.content.caption === "Our menu", "a photo goes out as a photo, with its caption, read back from storage");

/* ------------------------------------------------------------------ incoming */
say("5. incoming messages");
const now = Math.floor(Date.now() / 1000);
await worker.__test.record(other, entry, { key: { remoteJid: "919833333333@s.whatsapp.net", id: "IN1", fromMe: false }, message: { conversation: "Do you deliver to Sector 18?" }, messageTimestamp: now, pushName: "Kabir" }, "notify");
let kabir = await raw("wachats").findOne({ phone: "919833333333" });
ok(kabir && kabir.unread === 1 && kabir.name === "Kabir" && kabir.accountId === other && kabir.lastInboundAt, "a customer's message opens a chat on the number they wrote to, unread, with their WhatsApp name");
await worker.__test.record(other, entry, { key: { remoteJid: "919833333333@s.whatsapp.net", id: "IN1", fromMe: false }, message: { conversation: "Do you deliver to Sector 18?" }, messageTimestamp: now }, "notify");
ok((await raw("wamessages").countDocuments({ chatId: String(kabir._id) })) === 1, "the same message delivered twice is kept once");
await worker.__test.record(other, entry, { key: { remoteJid: "777@lid", id: "IN2", fromMe: false }, message: { extendedTextMessage: { text: "hello from a hidden-number id" } }, messageTimestamp: now }, "notify");
ok(await raw("wachats").findOne({ phone: "919812345678" }), "a message addressed by WhatsApp's private id is matched to the real phone number");
await worker.__test.record(other, entry, { key: { remoteJid: "120363@g.us", id: "G1", fromMe: false }, message: { conversation: "group chatter" }, messageTimestamp: now }, "notify");
ok(!(await raw("wamessages").findOne({ waId: "G1" })), "group chats are ignored");
await worker.__test.record(other, entry, { key: { remoteJid: "919833333333@s.whatsapp.net", id: "PHONE1", fromMe: true }, message: { conversation: "typed on the phone" }, messageTimestamp: now }, "notify");
const fromPhone = await raw("wamessages").findOne({ waId: "PHONE1" });
ok(fromPhone?.direction === "out" && fromPhone.source === "phone", "a reply typed on the phone itself shows in the dashboard too");
await worker.__test.record(other, entry, { key: { remoteJid: "919876543210@s.whatsapp.net", id: sent[0].id, fromMe: true }, message: { conversation: "Hello Riya" }, messageTimestamp: now }, "append");
ok((await raw("wamessages").countDocuments({ waId: sent[0].id })) === 1, "WhatsApp's echo of our own message isn't recorded twice");
await worker.__test.record(other, entry, { key: { remoteJid: "919833333333@s.whatsapp.net", id: "OLD", fromMe: false }, message: { conversation: "old history" }, messageTimestamp: now - 86400 }, "append");
ok(!(await raw("wamessages").findOne({ waId: "OLD" })), "old history the phone hands over when linking isn't replayed");
await worker.__test.record(other, entry, { key: { remoteJid: "919833333333@s.whatsapp.net", id: "IN3", fromMe: false }, message: { conversation: "STOP" }, messageTimestamp: now }, "notify");
ok((await raw("wachats").findOne({ phone: "919833333333" })).optedOut === true, "'STOP' opts them out of offers");
r = await call("GET", "/api/whatsapp/chats?unread=1", { cookie: owner });
ok(r.json.chats.some((x) => x.phone === "919833333333" && x.unread === 2), "the unread filter finds them", JSON.stringify(r.json.chats.map((x) => x.unread)));
await call("POST", `/api/whatsapp/chats/${kabir._id}/read`, { cookie: su });
ok((await raw("wachats").findOne({ _id: kabir._id })).unread === 2, "the super admin reading doesn't clear the store's unread badge");
r = await call("GET", `/api/whatsapp/chats/${kabir._id}/messages`, { cookie: su });
ok(r.status === 200 && r.json.messages.length === 3, "…but can read the messages", String(r.json.messages?.length));
await call("POST", `/api/whatsapp/chats/${kabir._id}/read`, { cookie: staff });
ok((await raw("wachats").findOne({ _id: kabir._id })).unread === 0, "the store's own team reading does");
r = await call("GET", "/api/whatsapp/chats?q=kab", { cookie: owner });
ok(r.json.chats.length === 1 && r.json.chats[0].name === "Kabir", "search by name");
r = await call("GET", "/api/whatsapp/chats?q=98333", { cookie: owner });
ok(r.json.chats.length === 1, "search by number");

/* -------------------------------------------------------------- broadcasts */
say("6. broadcasts");
ok((await call("GET", "/api/whatsapp/broadcasts", { cookie: manager })).status === 403, "only the owner sends broadcasts");
await raw("customers").insertMany([
  { brandId: brandA, phone: "9833333333", name: "Kabir" }, // opted out
  { brandId: brandA, phone: "+91 98765 43210", name: "Riya" }, // has a chat (on `other`)
  { brandId: brandA, phone: "9844444444", name: "New One" },
  { brandId: brandA, phone: "9855555555", name: "New Two" },
  { brandId: brandA, phone: "98444 44444", name: "Duplicate" },
]);
r = await call("GET", "/api/whatsapp/broadcasts", { cookie: owner });
ok(r.json.preview.recipients === 3 && r.json.preview.optedOut === 1, "preview: 3 people (duplicates merged), 1 opted out", JSON.stringify(r.json.preview));
r = await call("POST", "/api/whatsapp/broadcasts", { cookie: owner, body: { text: "Diwali: 20% off this weekend!" } });
ok(r.status === 201 && r.json.broadcast.waiting === 3, "a broadcast queues one message per person", JSON.stringify(r.json.broadcast));
const bc = await raw("wamessages").find({ campaignId: r.json.broadcast.id }).toArray();
ok(bc.every((x) => x.text.endsWith("Reply STOP to stop offers.")), "every one says how to stop offers");
ok(!bc.some((x) => x.chatId === String(kabir._id)), "the opted-out customer gets nothing");
const riya = bc.find((x) => x.chatId === chat1.id);
ok(riya?.accountId === other, "someone with a chat gets it from that chat's number");
const newcomers = bc.filter((x) => x.chatId !== chat1.id);
ok(new Set(newcomers.map((x) => x.accountId)).size === 2, "new people are spread across the online numbers");
ok(bc.every((x) => x.pace === "cold"), "nobody here has written to us, so all are paced as first contacts");
r = await call("POST", `/api/whatsapp/broadcasts/${r.json.broadcast.id}/cancel`, { cookie: owner });
ok(r.status === 204 && (await raw("wamessages").countDocuments({ campaignId: bc[0].campaignId, status: "queued" })) === 0, "cancelling removes what hadn't gone yet");

/* ------------------------------------------------------------ order updates */
say("7. order updates");
const cfg = { identity: { name: "Acme Momos" }, orderNotify: { linked: { enabled: true, events: ["accepted", "ready"], templates: { ready: { body: "{{customerName}}, order #{{orderNumber}} is {{statusLabel}} — come pick it up!" } } } } };
const order = { _id: oid("6a0000000000000000000001"), orderNumber: "0042", customer: { phone: "9866666666", name: "Meera" }, totals: { grandTotal: 35000 } };
await service.queueOrderUpdate({ brandId: brandA, outletId: OUTLET_A }, order, "accepted", cfg);
let om = await raw("wamessages").findOne({ orderId: String(order._id) });
ok(om && om.source === "order" && om.pace === "order" && /Meera, your order #0042 at Acme Momos is Accepted\. Total ₹350/.test(om.text), "accepted → the default message, paced as an order update", om?.text);
await service.queueOrderUpdate({ brandId: brandA, outletId: OUTLET_A }, order, "ready", cfg);
ok((await raw("wamessages").findOne({ orderId: String(order._id), text: /pick it up/ })), "ready → the store's own wording");
await service.queueOrderUpdate({ brandId: brandA, outletId: OUTLET_A }, order, "preparing", cfg);
ok((await raw("wamessages").countDocuments({ orderId: String(order._id) })) === 2, "a status that isn't switched on sends nothing");
await service.queueOrderUpdate({ brandId: brandA, outletId: OUTLET_A }, order, "accepted", { ...cfg, orderNotify: { linked: { ...cfg.orderNotify.linked, enabled: false } } });
ok((await raw("wamessages").countDocuments({ orderId: String(order._id) })) === 2, "switched off sends nothing");
r = await call("PATCH", `/api/outlets/${OUTLET_A}/config`, { cookie: owner, body: { orderNotify: { linked: { enabled: true, events: ["ready"] } } } });
ok(r.status === 200 && r.json.config?.orderNotify?.linked?.enabled === true, "the setting saves with the outlet's notification settings");
{
  const { fireOrderNotifications } = await import(`${API}/src/modules/notify/notify.service.js`);
  const order2 = { _id: oid("6a0000000000000000000002"), orderNumber: "0043", customer: { phone: "9877777777", name: "Dev" }, totals: { grandTotal: 12000 } };
  await fireOrderNotifications({ brandId: brandA, outletId: OUTLET_A }, order2, "ready");
  const viaOrders = await raw("wamessages").findOne({ orderId: String(order2._id) });
  ok(viaOrders && /Dev, your order #0043/.test(viaOrders.text), "an order's status change (the real notification path) queues the WhatsApp update", viaOrders?.text);
  await fireOrderNotifications({ brandId: brandA, outletId: OUTLET_A }, order2, "accepted");
  ok((await raw("wamessages").countDocuments({ orderId: String(order2._id) })) === 1, "…only for the statuses the outlet switched on");
}
r = await call("GET", "/api/whatsapp/me", { cookie: owner });
ok(typeof r.json.unreadChats === "number", "the dashboard gets the number of chats with unread messages (for the menu badge)", String(r.json.unreadChats));

/* --------------------------------------------------------------- clean up */
say("8. clear and delete");
r = await call("POST", `/api/whatsapp/chats/${kabir._id}/clear`, { cookie: owner });
ok(r.status === 204 && (await raw("wamessages").countDocuments({ chatId: String(kabir._id) })) === 0 && (await raw("wachats").findOne({ _id: kabir._id })), "clear empties the chat but keeps it");
const msgInRiya = await raw("wamessages").findOne({ chatId: chat1.id });
ok((await call("DELETE", `/api/whatsapp/chats/${chat1.id}/messages/${msgInRiya._id}`, { cookie: owner })).status === 200 && !(await raw("wamessages").findOne({ _id: msgInRiya._id })), "a single message can be deleted");
ok((await call("DELETE", `/api/whatsapp/chats/${kabir._id}`, { cookie: staff })).status === 403, "a read-only role can't delete chats");
r = await call("DELETE", `/api/whatsapp/chats/${kabir._id}`, { cookie: owner });
ok(r.status === 204 && !(await raw("wachats").findOne({ _id: kabir._id })), "delete removes the chat");
r = await call("POST", `/api/whatsapp/accounts/${acc1}/unlink`, { cookie: owner });
ok(r.status === 200 && (await raw("waaccounts").findOne({ _id: oid(acc1) })).wantsLogout === true, "unlink asks the worker to log the number out");

/* ------------------------------------------------- a real QR from WhatsApp */
say("10. colours, stats, sharing chats out, cleanup, delete for everyone");
{
  await raw("waaccounts").updateMany({}, { $set: { wantsLogout: false } });
  await online(acc1, "919000000001"); await online(acc2, "919000000002");
  const acc3 = (await call("POST", "/api/whatsapp/accounts", { cookie: owner, body: { label: "Number 3" } })).json.account;
  const acc4 = (await call("POST", "/api/whatsapp/accounts", { cookie: owner, body: { label: "Number 4" } })).json.account;
  await online(acc3.id, "919000000003"); await online(acc4.id, "919000000004");
  let accs = (await call("GET", "/api/whatsapp/accounts", { cookie: owner })).json.accounts;
  ok(new Set(accs.map((x) => x.color)).size === accs.length && accs.every((x) => /^#[0-9A-F]{6}$/i.test(x.color)), "every number gets its own colour", accs.map((x) => x.color).join(" "));
  r = await call("PATCH", `/api/whatsapp/accounts/${acc3.id}`, { cookie: owner, body: { color: "#ff00aa" } });
  ok(r.status === 200 && r.json.account.color === "#FF00AA", "the owner can pick a colour");
  ok((await call("PATCH", `/api/whatsapp/accounts/${acc3.id}`, { cookie: owner, body: { color: "pink" } })).status === 400, "…a real colour only");
  ok((await call("PATCH", `/api/whatsapp/accounts/${acc3.id}`, { cookie: manager, body: { color: "#000000" } })).status === 403, "…and only the owner");

  // 100 chats on the two old numbers: 60 + 40, a third of them people who never wrote
  await raw("wachats").deleteMany({});
  await raw("wamessages").deleteMany({});
  const docs = [];
  for (let i = 0; i < 100; i++) docs.push({ brandId: brandA, phone: `9198${String(10000000 + i)}`, name: `C${i}`, accountId: i < 60 ? acc1 : acc2, lastInboundAt: i % 3 ? new Date(Date.now() - i * 3600_000) : null, lastMessageAt: new Date(Date.now() - i * 3600_000), unread: i === 5 ? 2 : 0, createdAt: new Date(), updatedAt: new Date() });
  await raw("wachats").insertMany(docs);
  const sample = await raw("wachats").findOne({ accountId: acc1, lastInboundAt: { $ne: null } });
  await raw("wamessages").insertOne({ brandId: brandA, chatId: String(sample._id), accountId: acc1, direction: "out", type: "text", text: "waiting", status: "queued", source: "chat", pace: "warm", sendAfter: new Date(Date.now() + 3600_000), at: new Date(), waId: "" });
  r = await call("GET", "/api/whatsapp/stats", { cookie: owner });
  const st = Object.fromEntries(r.json.numbers.map((n) => [n.label, n]));
  ok(st["Counter phone"].chats === 60 && st["Delivery phone"].chats === 40 && st["Number 3"].chats === 0 && r.json.total === 100, "stats: chats per number", r.json.numbers.map((n) => `${n.label}=${n.chats}`).join(", "));
  ok(st["Counter phone"].replied === 40 && st["Counter phone"].unread === 1, "…how many of them wrote to us, and unread", `${st["Counter phone"].replied} replied, ${st["Counter phone"].unread} unread`);
  ok((await call("GET", "/api/whatsapp/stats", { cookie: manager })).status === 403, "stats are the owner's");

  const all = [acc1, acc2, acc3.id, acc4.id];
  r = await call("POST", "/api/whatsapp/distribute/preview", { cookie: owner, body: { share: all } });
  ok(r.json.numbers.filter((n) => all.includes(n.id)).every((n) => n.after === 25) && r.json.moving === 50, "preview: share evenly → 25 each, 50 chats move", r.json.numbers.map((n) => `${n.label} ${n.before}→${n.after}`).join(", "));
  ok((await raw("wachats").countDocuments({ accountId: acc3.id })) === 0, "a preview changes nothing");
  r = await call("POST", "/api/whatsapp/distribute/preview", { cookie: owner, body: { share: [acc3.id, acc4.id], giveAway: [acc1, acc2] } });
  ok(r.json.numbers.find((n) => n.id === acc3.id).after === 50 && r.json.numbers.find((n) => n.id === acc1).after === 0, "…or empty numbers 1 and 2 into 3 and 4, 50 / 50", r.json.numbers.map((n) => `${n.label} ${n.before}→${n.after}`).join(", "));
  const notLinked = (await call("POST", "/api/whatsapp/accounts", { cookie: owner, body: { label: "Not scanned" } })).json.account.id;
  ok((await call("POST", "/api/whatsapp/distribute/preview", { cookie: owner, body: { share: [acc1, notLinked] } })).status === 400, "only linked numbers can take chats");
  await call("DELETE", `/api/whatsapp/accounts/${notLinked}`, { cookie: owner });
  r = await call("POST", "/api/whatsapp/distribute", { cookie: owner, body: { share: all } });
  const counts = await Promise.all(all.map((id) => raw("wachats").countDocuments({ accountId: id })));
  ok(counts.join(",") === "25,25,25,25", "sharing out: every number now has 25 chats", counts.join(","));
  const movedNever = await raw("wachats").countDocuments({ accountId: { $in: [acc3.id, acc4.id] }, lastInboundAt: null });
  ok(movedNever === 34, "people who never wrote move first (all 34 of them moved), active conversations stay put as far as possible", `${movedNever} of the 50 moved never wrote`);
  r = await call("POST", "/api/whatsapp/distribute/preview", { cookie: owner, body: { share: all } });
  ok(r.json.moving === 0, "running it again moves nothing");
  const sampleNow = await raw("wachats").findOne({ _id: sample._id });
  const waitingNow = await raw("wamessages").findOne({ chatId: String(sample._id), status: "queued" });
  ok(waitingNow.accountId === sampleNow.accountId, "a message waiting to go out moves with its chat");
  const movedReplied = await raw("wachats").findOne({ accountId: { $in: [acc3.id, acc4.id] }, lastInboundAt: { $ne: null } });
  ok(movedReplied && movedReplied.lastInboundAccountId && movedReplied.lastInboundAccountId !== movedReplied.accountId, "a moved chat remembers which number the customer was talking to");
  r = await call("POST", `/api/whatsapp/chats/${movedReplied._id}/messages`, { cookie: owner, body: { text: "Hello from our new number!" } });
  ok(r.json.message?.pace === "cold", "…so the new number's first message to them is paced as a first contact (ban safety)", r.json.message?.pace);
  const stay = await raw("wachats").findOne({ accountId: acc1, lastInboundAt: { $ne: null } });
  r = await call("POST", `/api/whatsapp/chats/${stay._id}/messages`, { cookie: owner, body: { text: "Same number as always" } });
  ok(r.json.message?.pace === "warm", "a chat that stayed on its number carries on at normal speed");
  r = (await call("GET", "/api/whatsapp/chats", { cookie: owner })).json.chats.find((c) => c.accountId === acc3.id);
  ok(r.accountColor === "#FF00AA", "the chat list carries each chat's number colour");
  // the customer writes to the OLD number again → the chat goes back to it
  await worker.__test.record(acc1, { ...entry, brandId: brandA }, { key: { remoteJid: `${movedReplied.phone}@s.whatsapp.net`, id: "BACK1", fromMe: false }, message: { conversation: "hi again" }, messageTimestamp: Math.floor(Date.now() / 1000) }, "notify");
  const back = await raw("wachats").findOne({ _id: movedReplied._id });
  ok(back.accountId === acc1 && back.lastInboundAccountId === acc1, "if the customer writes to the old number, the chat follows them back to it");

  // cleanup
  await raw("wamessages").insertMany([
    { brandId: brandA, chatId: String(stay._id), accountId: acc1, direction: "in", type: "text", text: "old 1", status: "received", source: "chat", at: new Date(Date.now() - 40 * 86400_000), waId: "" },
    { brandId: brandA, chatId: String(stay._id), accountId: acc1, direction: "in", type: "text", text: "old 2", status: "received", source: "chat", at: new Date(Date.now() - 35 * 86400_000), waId: "" },
    { brandId: brandA, chatId: String(stay._id), accountId: acc1, direction: "out", type: "text", text: "old but waiting", status: "queued", source: "chat", at: new Date(Date.now() - 35 * 86400_000), waId: "" },
  ]);
  const cut = new Date(Date.now() - 30 * 86400_000).toISOString();
  r = await call("POST", "/api/whatsapp/cleanup/preview", { cookie: owner, body: { before: cut, scope: "messages" } });
  ok(r.json.messages === 2 && r.json.chats === 1, "cleanup preview: 2 messages older than 30 days, in 1 chat (a message still waiting is never removed)", JSON.stringify(r.json));
  ok((await call("POST", "/api/whatsapp/cleanup/preview", { cookie: owner, body: { before: new Date(Date.now() + 86400_000).toISOString(), scope: "messages" } })).status === 400, "a date in the future is refused");
  ok((await call("POST", "/api/whatsapp/cleanup", { cookie: manager, body: { before: cut, scope: "messages" } })).status === 403, "cleanup is the owner's");
  r = await call("POST", "/api/whatsapp/cleanup", { cookie: owner, body: { before: cut, scope: "messages" } });
  ok(r.json.messages === 2 && (await raw("wamessages").countDocuments({ text: /^old/ })) === 1 && (await raw("wachats").findOne({ _id: stay._id })), "old messages removed, the waiting one and the chat kept");
  r = await call("POST", "/api/whatsapp/cleanup/preview", { cookie: owner, body: { before: new Date(Date.now() - 2 * 3600_000).toISOString(), scope: "chats", accountId: acc1 } });
  const expectChats = await raw("wachats").countDocuments({ accountId: acc1, lastMessageAt: { $lt: new Date(Date.now() - 2 * 3600_000) } });
  ok(r.json.chats === expectChats && expectChats > 0, "whole chats quiet since a date, for one number", `${r.json.chats} chats`);
  r = await call("POST", "/api/whatsapp/cleanup", { cookie: owner, body: { before: new Date(Date.now() - 2 * 3600_000).toISOString(), scope: "chats", accountId: acc1 } });
  ok((await raw("wachats").countDocuments({ accountId: acc1, lastMessageAt: { $lt: new Date(Date.now() - 2 * 3600_000) } })) === 0 && (await raw("wachats").countDocuments({ accountId: acc2 })) > 0, "…removed, other numbers' chats untouched");

  // delete for everyone
  const dChat = await raw("wachats").findOne({ accountId: acc2 });
  const mk = (extra) => raw("wamessages").insertOne({ brandId: brandA, chatId: String(dChat._id), accountId: acc2, direction: "out", type: "text", text: "oops wrong price", status: "delivered", source: "chat", at: new Date(), waId: "WAID-1", ...extra });
  const recent = (await mk({})).insertedId;
  const old = (await mk({ at: new Date(Date.now() - 3 * 86400_000), waId: "WAID-OLD" })).insertedId;
  const theirs = (await mk({ direction: "in", status: "received", waId: "WAID-IN" })).insertedId;
  let list = (await call("GET", `/api/whatsapp/chats/${dChat._id}/messages`, { cookie: owner })).json.messages;
  ok(list.find((m) => m.id === String(recent)).canRevoke && !list.find((m) => m.id === String(old)).canRevoke && !list.find((m) => m.id === String(theirs)).canRevoke, "only our own recent sent messages offer 'delete for everyone'");
  ok((await call("DELETE", `/api/whatsapp/chats/${dChat._id}/messages/${theirs}?everyone=1`, { cookie: owner })).status === 409, "a customer's message can't be deleted for everyone");
  ok((await call("DELETE", `/api/whatsapp/chats/${dChat._id}/messages/${old}?everyone=1`, { cookie: owner })).status === 409, "nor one older than 48 hours");
  r = await call("DELETE", `/api/whatsapp/chats/${dChat._id}/messages/${recent}?everyone=1`, { cookie: owner });
  ok(r.status === 200 && r.json.deleted === "everyone-requested", "deleting for everyone is handed to the worker");
  const sockCalls = [];
  const delEntry = { sock: { ...fakeSock("919000000002"), sendMessage: async (jid, content) => { sockCalls.push({ jid, content }); return {}; } }, brandId: brandA, connected: true, busy: false };
  await worker.__test.sendNext(acc2, delEntry);
  ok(sockCalls.length === 1 && sockCalls[0].content.delete?.id === "WAID-1" && sockCalls[0].content.delete.fromMe === true && sockCalls[0].jid === `${dChat.phone}@s.whatsapp.net`, "the worker asks WhatsApp to delete it for everyone", JSON.stringify(sockCalls[0]?.content));
  const gone = await raw("wamessages").findOne({ _id: recent });
  ok(gone.deleted && gone.text === "" && gone.revoke === "done", "…and it shows as deleted");
  await worker.__test.record(acc2, delEntry, { key: { remoteJid: `${dChat.phone}@s.whatsapp.net`, id: "PROTO", fromMe: false }, message: { protocolMessage: { type: 0, key: { id: "WAID-IN" } } }, messageTimestamp: Math.floor(Date.now() / 1000) }, "notify");
  ok((await raw("wamessages").findOne({ _id: theirs })).deleted === true, "when the customer deletes theirs for everyone, it shows as deleted here too");
  r = await call("DELETE", `/api/whatsapp/chats/${dChat._id}/messages/${old}`, { cookie: owner });
  ok(r.status === 200 && !(await raw("wamessages").findOne({ _id: old })), "'delete for me' removes it from the dashboard only");
}

say("9. a real link QR from WhatsApp's servers (nothing is linked)");
worker.__test.sockets.clear();
await raw("waaccounts").deleteMany({});
const qrAcc = (await call("POST", "/api/whatsapp/accounts", { cookie: owner, body: { label: "QR check" } })).json.account.id;
// Asking WhatsApp's servers for a link QR is a real network call (nothing gets linked) — only when WA_REAL_QR=1
const REAL_QR = process.env.WA_REAL_QR === "1";
if (REAL_QR) {
  worker.startWhatsAppWorker();
  let qr = "";
  for (let i = 0; i < 40 && !qr; i++) { await sleep(1000); qr = (await call("GET", `/api/whatsapp/accounts/${qrAcc}`, { cookie: owner })).json.account?.qr ?? ""; }
  ok(qr.length > 50, "the worker connects and a scannable link code appears for the owner", qr ? `${qr.slice(0, 24)}… (${qr.length} chars)` : "none in 40 s");
} else console.log("(skipped: the real link-QR check talks to WhatsApp's servers — run with WA_REAL_QR=1)");
{
  const { useMongoAuthState } = await import(`${API}/src/modules/whatsapp/auth-state.js`);
  const st = await useMongoAuthState({ brandId: brandA, accountId: "test-account" });
  await st.saveCreds();
  await st.state.keys.set({ "pre-key": { 1: { public: Buffer.from([1, 2, 3]), private: Buffer.from([4, 5, 6]) } } });
  const rows = await raw("waauthkeys").find({ accountId: "test-account" }).toArray();
  ok(rows.length === 2 && rows.every((x) => x.value.startsWith("v1.") && !x.value.includes("noiseKey")), "a session's keys are stored encrypted", rows.map((x) => x.key).join(","));
  const again = await useMongoAuthState({ brandId: brandA, accountId: "test-account" });
  const pk = (await again.state.keys.get("pre-key", ["1"]))["1"];
  ok(Buffer.from(pk.private).equals(Buffer.from([4, 5, 6])) && again.state.creds.noiseKey, "…and read back intact (what lets a number stay linked after a restart)");
}
await call("DELETE", `/api/whatsapp/accounts/${qrAcc}`, { cookie: owner });
if (REAL_QR) { await sleep(2500); ok(worker.__test.sockets.size === 0, "removing the number closes its connection"); }

console.log(`\nTOTAL ${pass} passed, ${fail} failed`);
process.exit(0);
