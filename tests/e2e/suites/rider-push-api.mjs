// "A delivery for you", pushed to the rider's phone (Firebase Cloud Messaging) so they hear about it with the app closed or minimised.
// API checks on an in-memory database. Google's two servers (the token one and FCM) are stood in for by a local server that checks what it is
// sent — including that the sign-in request really is signed with the service account's key — and answers as Google would.
import crypto from "node:crypto";
import http from "node:http";
import { startApi } from "./_api-harness.mjs";

/* ---------------------------------------------------------------- a stand-in for Google */
const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048, publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" } });
const SA = { type: "service_account", project_id: "rasoi-test", client_email: "push@rasoi-test.iam.gserviceaccount.com", private_key: privateKey };
const google = { oauthCalls: [], messages: [], rejectOnce401: false, answers: new Map(), jwtProblems: [] };
const gserver = http.createServer(async (req, res) => {
  let body = ""; for await (const c of req) body += c;
  const send = (status, json) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(json)); };
  if (req.url === "/token") {
    const form = new URLSearchParams(body);
    const [h, p, sig] = String(form.get("assertion") ?? "").split(".");
    const claims = JSON.parse(Buffer.from(p ?? "e30", "base64url").toString());
    const signedOk = crypto.verify("RSA-SHA256", Buffer.from(`${h}.${p}`), publicKey, Buffer.from(sig ?? "", "base64url"));
    if (form.get("grant_type") !== "urn:ietf:params:oauth:grant-type:jwt-bearer") google.jwtProblems.push("grant_type");
    if (!signedOk) google.jwtProblems.push("signature");
    if (claims.iss !== SA.client_email) google.jwtProblems.push("iss");
    if (claims.scope !== "https://www.googleapis.com/auth/firebase.messaging") google.jwtProblems.push("scope");
    if (!(claims.exp > claims.iat && claims.exp - claims.iat <= 3600)) google.jwtProblems.push("exp");
    google.oauthCalls.push(Date.now());
    return send(200, { access_token: `ACCESS-${google.oauthCalls.length}`, expires_in: 3600, token_type: "Bearer" });
  }
  const m = /^\/v1\/projects\/([^/]+)\/messages:send$/.exec(req.url ?? "");
  if (!m) return send(404, {});
  const msg = JSON.parse(body).message;
  const auth = req.headers.authorization;
  if (google.rejectOnce401) { google.rejectOnce401 = false; return send(401, { error: { status: "UNAUTHENTICATED" } }); }
  google.messages.push({ project: m[1], auth, ...msg });
  const planned = google.answers.get(msg.token);
  if (planned) return send(planned.status, planned.json);
  return send(200, { name: `projects/${m[1]}/messages/${google.messages.length}` });
});
await new Promise((r) => gserver.listen(0, r));
const GPORT = gserver.address().port;

const t = await startApi(3125, { FCM_SERVICE_ACCOUNT_JSON: JSON.stringify(SA), FCM_API_URL: `http://127.0.0.1:${GPORT}`, FCM_OAUTH_URL: `http://127.0.0.1:${GPORT}/token` });
const { call, ok, say } = t;
const push = await import(`${t.API}/src/modules/notify/push.js`);
const wait = async (cond, ms = 4000) => { const end = Date.now() + ms; while (Date.now() < end) { if (cond()) return true; await new Promise((r) => setTimeout(r, 40)); } return cond(); };
const quiet = (ms = 500) => new Promise((r) => setTimeout(r, ms));
const T = (n) => `fcm-token-${String(n).padStart(2, "0")}-${"x".repeat(60)}`; // looks like a device token

await t.run(async () => {
  const s = await t.makeStore({ slug: "push", ownerEmail: "o@push.test" });
  const H = { "x-rasoipulse-outlet": s.outlet, "x-rasoipulse-brand": s.brand };
  const own = (method, path, body) => call(method, path, { cookie: s.owner, headers: H, body });
  const RDA = { "x-app-id": "rda" };
  let n = 0;
  const makeRider = async (name, phone, pin) => {
    const r = (await own("POST", "/api/riders", { name, phone })).json.rider;
    await own("PUT", `/api/riders/${r.id}/pin`, { pin });
    const login = await call("POST", "/api/rider/login", { headers: { ...RDA, "x-forwarded-for": `203.0.113.${++n}` }, body: { phone, pin } });
    return { ...r, token: login.json.token };
  };
  const ramesh = await makeRider("Ramesh", "98765 43210", "4821");
  const suresh = await makeRider("Suresh", "98111 22233", "9090");
  const rid = (r, method, path, body) => call(method, path, { bearer: r.token, headers: RDA, body });
  const tokensOf = async (r) => ((await t.raw("riders").findOne({ _id: new t.db.mongoose.Types.ObjectId(r.id) }))?.pushTokens ?? []).map((x) => x.token);

  // an outlet that delivers, with a dish, and a few delivery orders
  await own("PATCH", `/api/outlets/${s.outlet}/config`, { identity: { name: "Push Momos", location: { point: { lat: 28.5355, lng: 77.391 } } }, features: { ordering: { delivery: true } }, operations: { limits: { deliveryRadiusKm: 6 } } });
  const cat = (await own("POST", "/api/menu/categories", { name: "Momos" })).json.category;
  const dish = (await own("POST", "/api/menu/items", { categoryId: cat.id, name: "Paneer Momos", foodType: "veg", basePrice: 13000 })).json.item;
  const delivery = async (name, text) => {
    const o = (await own("POST", "/api/orders", { outletId: s.outlet, channel: "delivery", name, cart: { lines: [{ itemId: dish.id, quantity: 2, modifierOptionIds: [] }] }, deliveryAddress: { text, lat: 28.5455, lng: 77.397 }, gateway: "mock" })).json.order;
    await t.raw("orders").updateOne({ _id: new t.db.mongoose.Types.ObjectId(o.id) }, { $set: { "customer.phone": "9876512345", "customer.name": name, "payment.status": "paid" } });
    return o;
  };
  const assign = (order, body) => own("PATCH", `/api/orders/${order.id}/rider`, body);
  const pushed = () => google.messages.length;

  say("1. The phone asks for notifications");
  ok((await call("PUT", "/api/rider/push-token", { headers: RDA, body: { token: T(1) } })).status === 401, "no sign-in → refused (401)");
  ok((await rid(ramesh, "PUT", "/api/rider/push-token", { token: "short" })).status === 400, "a token that can't be one is refused (400)");
  ok((await rid(ramesh, "PUT", "/api/rider/push-token", {})).status === 400, "no token is refused (400)");
  ok((await rid(ramesh, "PUT", "/api/rider/push-token", { token: T(1) })).status === 204, "a rider registers a phone (204)");
  ok((await rid(ramesh, "PUT", "/api/rider/push-token", { token: T(1) })).status === 204 && (await tokensOf(ramesh)).length === 1, "the same phone again is kept once");
  for (let i = 2; i <= 7; i++) await rid(ramesh, "PUT", "/api/rider/push-token", { token: T(i) });
  const kept = await tokensOf(ramesh);
  ok(kept.length === 5 && kept.at(-1) === T(7) && !kept.includes(T(1)) && !kept.includes(T(2)), "a rider keeps their five newest phones", kept.map((k) => k.slice(10, 12)).join(","));
  await rid(suresh, "PUT", "/api/rider/push-token", { token: T(7) });
  ok(!(await tokensOf(ramesh)).includes(T(7)) && (await tokensOf(suresh)).includes(T(7)), "a phone signed in as someone else moves to them (one phone, one rider)");
  ok((await rid(suresh, "DELETE", "/api/rider/push-token", { token: T(7) })).status === 204 && (await tokensOf(suresh)).length === 0, "signing out takes the phone off");
  const list = await own("GET", "/api/riders");
  ok(!JSON.stringify(list.json).includes("fcm-token"), "the manager's rider list never carries a device token");
  // start the real tests from known phones
  await t.raw("riders").updateMany({}, { $set: { pushTokens: [] } });
  await rid(ramesh, "PUT", "/api/rider/push-token", { token: T(10) });
  await rid(suresh, "PUT", "/api/rider/push-token", { token: T(20) });

  say("2. A delivery is handed to a rider → a push, with the app closed");
  const o1 = await delivery("Neha Gupta", "B-14, Sector 18, Noida");
  const r1 = await assign(o1, { riderId: ramesh.id });
  ok(r1.status === 200, "the hand-over itself works", `HTTP ${r1.status}`);
  ok(await wait(() => pushed() >= 1), "Google is asked to send a notification");
  const m = google.messages[0];
  ok(m.token === T(10) && m.project === "rasoi-test", "…to Ramesh's phone only, through the right Firebase project");
  ok(m.notification.title === `New delivery #${o1.orderNumber}`, "title: 'New delivery #0001'", m.notification.title);
  ok(/Sector 18/.test(m.notification.body) && /₹/.test(m.notification.body) && /km/.test(m.notification.body) && /Neha/.test(m.notification.body), "body: where it goes, how far, what it is worth, who for", m.notification.body);
  ok(m.data.type === "delivery.assigned" && m.data.orderId === o1.id && m.data.orderNumber === o1.orderNumber && Object.values(m.data).every((v) => typeof v === "string"), "data (all text): what happened, which order — so a tap can open it", JSON.stringify(m.data));
  ok(m.android.priority === "HIGH" && m.android.notification.channel_id === "deliveries" && /^\d+s$/.test(m.android.ttl), "high priority (wakes a sleeping phone), on the 'deliveries' channel, with a time limit", JSON.stringify(m.android));
  ok(/^Bearer ACCESS-\d+$/.test(m.auth), "sent with the access token Google gave");
  ok(google.jwtProblems.length === 0, "the sign-in request to Google was signed with the service account's key, with the right claims", google.jwtProblems.join(","));
  ok(!JSON.stringify(m).includes("delivery code") && !("deliveryCode" in m.data), "no delivery code in the notification");

  say("3. Only when it is a NEW hand-over");
  const before = pushed();
  await assign(o1, { riderId: ramesh.id });
  await quiet();
  ok(pushed() === before, "saving the same rider again sends nothing");
  await assign(o1, { name: "Walk-in", phone: "9000011111" });
  await quiet();
  ok(pushed() === before, "a rider typed in by name (no phone app) gets no push");
  await assign(o1, { riderId: suresh.id });
  ok(await wait(() => pushed() === before + 1), "moving it to another rider pushes the NEW rider");
  ok(google.messages.at(-1).token === T(20), "…to Suresh's phone, not Ramesh's");
  await assign(o1, { riderId: null });
  await quiet();
  ok(pushed() === before + 1, "taking the rider off sends nothing");
  // the rider taking it themselves ("picked up" in their app) is not a new hand-over
  const o2 = await delivery("Aarav", "House 220, Sector 50, Noida");
  await assign(o2, { riderId: ramesh.id });
  await wait(() => pushed() === before + 2);
  for (const st of ["accepted", "preparing", "ready"]) await own("PATCH", `/api/orders/${o2.id}/status`, { status: st });
  const mark = pushed();
  const pick = await rid(ramesh, "POST", `/api/rider/deliveries/${o2.id}/pickup`, {});
  ok(pick.status === 200, "the rider marks it picked up", `HTTP ${pick.status}`);
  await quiet();
  ok(pushed() === mark, "…which does not push the rider about their own delivery");

  say("4. The access token is kept, and renewed once if Google says it ran out");
  const calls = google.oauthCalls.length;
  const o3 = await delivery("Sita", "Shop 9, Sector 16, Noida");
  await assign(o3, { riderId: ramesh.id });
  await wait(() => pushed() === mark + 1);
  ok(google.oauthCalls.length === calls, "many messages, one sign-in to Google (the access token is reused)", `${google.oauthCalls.length} vs ${calls}`);
  google.rejectOnce401 = true;
  const o4 = await delivery("Karan", "Tower C, Sector 62, Noida");
  await assign(o4, { riderId: suresh.id });
  ok(await wait(() => pushed() === mark + 2), "a 401 from Google → a fresh access token and one more try → delivered");
  ok(google.oauthCalls.length === calls + 1, "…exactly one new sign-in to Google");

  say("5. A phone Google says is gone is forgotten; a hiccup is not");
  await rid(ramesh, "PUT", "/api/rider/push-token", { token: T(11) });
  google.answers.set(T(11), { status: 404, json: { error: { status: "NOT_FOUND", details: [{ errorCode: "UNREGISTERED" }] } } });
  const o5 = await delivery("Divya", "A-1, Sector 19, Noida");
  await assign(o5, { riderId: ramesh.id });
  ok(await wait(async () => true) && (await wait(() => google.messages.filter((x) => x.token === T(10)).length >= 4)), "the good phone still got its notification");
  ok(await wait(() => google.messages.some((x) => x.token === T(11))), "the dead one was tried");
  await quiet(400);
  const after = await tokensOf(ramesh);
  ok(after.includes(T(10)) && !after.includes(T(11)), "…and the dead phone was removed from the rider", after.map((k) => k.slice(10, 12)).join(","));
  google.answers.set(T(10), { status: 500, json: { error: { status: "INTERNAL" } } });
  const o6 = await delivery("Meera", "Sector 15A, Noida");
  const r6 = await assign(o6, { riderId: ramesh.id });
  await quiet(500);
  ok(r6.status === 200 && (await tokensOf(ramesh)).includes(T(10)), "a failure on Google's side does NOT remove the phone, and the hand-over still works");
  google.answers.delete(T(10));

  say("6. No Firebase key set up: nothing breaks");
  t.env.FCM_SERVICE_ACCOUNT_JSON = ""; push.resetPush();
  ok(push.configured() === false, "push reports itself off");
  const frozen = pushed();
  const o7 = await delivery("Ishaan", "Sector 22, Noida");
  const r7 = await assign(o7, { riderId: ramesh.id });
  await quiet();
  ok(r7.status === 200 && r7.json.order.rider.name === "Ramesh" && pushed() === frozen, "the hand-over works and nothing is sent");
  ok((await rid(ramesh, "PUT", "/api/rider/push-token", { token: T(12) })).status === 204, "a phone can still register (it will be used once push is set up)");
  t.env.FCM_SERVICE_ACCOUNT_JSON = "{ not json"; push.resetPush();
  ok(push.configured() === false, "a broken key file is 'off' too (and logged), not a crash");
  t.env.FCM_SERVICE_ACCOUNT_JSON = JSON.stringify(SA); push.resetPush();
  ok(push.configured() === true && push.projectId() === "rasoi-test", "…and a good one switches it on again");
});
gserver.close();
