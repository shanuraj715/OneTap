// The live connection of the staff apps (OMA, KDA, RDA) — the server's side. A private API on an in-memory database with the realtime hub attached; real WebSocket
// clients (the `ws` package) play the apps. What is checked:
//   1. who may listen (the SAME checks the apps' ordinary calls get: sign-in, role, the outlet, a paused store, the platform's switch);
//   2. what an app is told — only "something changed: orders / tables / menu / deliveries" — never a name, a phone, a price or an order;
//      each app hears only about its own kinds of change, only for its own outlet, and a burst of changes becomes ONE message;
//   3. a change made by ANY code (here: straight through the models, as a webhook or a sweep would) reaches the apps;
//   4. a dish that goes out of its hours at a clock time (no write at all) is noticed by the watcher;
//   5. people who are signed out, switched off, paused — or a rider whose PIN was reset — are let go; a quiet line gets a tick.
// The dashboard's own live connection (cookie, full events) is unchanged.
import { createRequire } from "node:module";
import { startApi } from "./_api-harness.mjs";

const PORT = 3130;
const t = await startApi(PORT, {}, { realtime: true });
const { call, ok, say, raw, db } = t;
const WS = createRequire(`${t.API}/package.json`)("ws");
const hub = await import(`${t.API}/src/realtime/hub.js`);
const feed = await import(`${t.API}/src/realtime/app-feed.js`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 4000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await sleep(40); } return false; };

const schemaPkg = await import(`${t.REPO}/packages/config-schema/src/index.js`);
/** an instant today (India time) at the given minute of the day — the suite pretends the clock says this, so it never depends on the real time of day */
const instant = (minute) => schemaPkg.istDate(schemaPkg.istDayKey(), minute).getTime();
/** run the watcher's look as if the time were `ms` */
async function lookAt(ms) { const real = Date.now; Date.now = () => ms; try { await feed.checkAvailabilityNow(); } finally { Date.now = real; } }

let ipn = 0;
const everyone = [];
/** An app (or a dashboard) listening: resolves once the answer to the upgrade is known. */
function listen(query, headers = {}) {
  return new Promise((resolve) => {
    const ws = new WS(`ws://127.0.0.1:${PORT}/realtime?${query}`, { headers: { "x-forwarded-for": `198.51.100.${(ipn = (ipn % 200) + 1)}`, ...headers } });
    const c = { ws, isApp: query.includes("app="), events: [], status: null, closeCode: null, closed: false, what: () => c.events.filter((e) => e.type === "changed").flatMap((e) => e.what), changes: () => c.events.filter((e) => e.type === "changed") };
    everyone.push(c);
    ws.on("message", (d) => c.events.push(JSON.parse(String(d))));
    ws.on("close", (code) => { c.closeCode = code; c.closed = true; });
    ws.on("unexpected-response", (_rq, res) => { c.status = res.statusCode; resolve(c); });
    ws.on("error", () => {});
    ws.on("open", () => { c.status = 101; resolve(c); });
  });
}
const bearer = (token) => ({ authorization: `Bearer ${token}` });
const appLogin = async (email, app, password = "Staff123!") => {
  const r = await fetch(`${t.base}/api/auth/app-login`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `203.0.113.${(ipn = (ipn % 200) + 1)}`, "x-app-id": app }, body: JSON.stringify({ email, password }) });
  return (await r.json()).token;
};

await t.run(async () => {
  const A = await t.makeStore({ slug: "acme", ownerEmail: "o@acme.test" });
  const B = await t.makeStore({ slug: "beta", ownerEmail: "o@beta.test" });
  const hdr = { "x-rasoipulse-brand": A.brand };
  const own = (method, path, body) => call(method, path, { cookie: A.owner, headers: { "x-rasoipulse-outlet": A.outlet }, body });
  for (const [email, role] of [["cook@acme.test", "kitchen"], ["waiter@acme.test", "staff"], ["ed@acme.test", "editor"], ["boss@acme.test", "manager"]]) await call("POST", "/api/users", { cookie: A.owner, headers: hdr, body: { email, name: email, password: "Staff123!", role } });
  await call("POST", "/api/users", { cookie: B.owner, headers: { "x-rasoipulse-brand": B.brand }, body: { email: "waiter@beta.test", name: "Beta waiter", password: "Staff123!", role: "staff" } });
  const waiter = await appLogin("waiter@acme.test", "oma");
  const cook = await appLogin("cook@acme.test", "kda");
  const editor = await appLogin("ed@acme.test", "oma");
  const betaWaiter = await appLogin("waiter@beta.test", "oma");
  // a second outlet of the same store, and a rider (with an app login) on the first
  const second = (await call("POST", "/api/outlets", { cookie: A.owner, headers: hdr, body: { name: "Second", slug: "second" } })).json.outlet;
  const secondId = String(second._id ?? second.id);
  const rider = (await own("POST", "/api/riders", { name: "Ramesh", phone: "98765 43210" })).json.rider;
  await own("PUT", `/api/riders/${rider.id}/pin`, { pin: "4821" });
  const riderLogin = await call("POST", "/api/rider/login", { body: { phone: "9876543210", pin: "4821" }, headers: { "x-app-id": "rda" } });
  const riderToken = riderLogin.json.token;
  ok(Boolean(waiter && cook && editor && betaWaiter && riderToken), "set-up: a waiter, a cook, an editor, another store's waiter and a rider can sign in to their apps");

  say("1. Who may listen");
  const q = (app, outlet = A.outlet) => `app=${app}&outletId=${outlet}`;
  const w = await listen(q("oma"), bearer(waiter));
  ok(w.status === 101 && (await until(() => w.events.some((e) => e.type === "hello" && e.app === "oma" && e.outletId === A.outlet))), "a waiter's OMA connects with the same Bearer sign-in its other calls use, and is greeted");
  const k = await listen(q("kda"), bearer(cook));
  ok(k.status === 101 && (await until(() => k.events.some((e) => e.type === "hello" && e.app === "kda"))), "a cook's KDA connects");
  const r = await listen("app=rda", bearer(riderToken));
  ok(r.status === 101 && (await until(() => r.events.some((e) => e.type === "hello" && e.app === "rda"))), "a rider's RDA connects with the rider's own token (no outlet needed: the token knows it)");
  ok((await listen(q("kda"), bearer(waiter))).status === 403, "a waiter can NOT listen as the kitchen app (the kitchen permission is checked): 403");
  ok((await listen(q("oma"), bearer(editor))).status === 403, "an editor (no right to see orders) can NOT listen as OMA: 403");
  ok((await listen(q("oma"))).status === 401 && (await listen(q("oma"), bearer("not-a-token"))).status === 401, "nobody signed in, or a made-up token: 401");
  ok((await listen("app=rda")).status === 401 && (await listen("app=rda", bearer("rdr1.abc.def"))).status === 401, "the rider app with no token or a forged one: 401");
  ok((await listen("app=nope&outletId=" + A.outlet, bearer(waiter))).status === 400 && (await listen("app=oma", bearer(waiter))).status === 400, "an unknown app name, or no outlet: 400");
  ok((await listen(q("oma", B.outlet), bearer(waiter))).status === 403, "another store's outlet is refused (403)");
  ok((await listen(q("oma", A.outlet), bearer(betaWaiter))).status === 403, "…and another store's waiter can't listen to this one (403)");
  await call("PATCH", `/api/users/${(await raw("users").findOne({ email: "waiter@acme.test" }))._id}`, { cookie: A.owner, headers: hdr, body: { outletIds: [A.outlet] } }).catch(() => undefined);
  const dash = await listen(`outletId=${A.outlet}`, { cookie: A.owner });
  ok(dash.status === 101 && (await until(() => dash.events.some((e) => e.type === "hello" && e.app === null))), "the dashboard's own connection (session cookie, no app) works exactly as before");
  ok((await listen(`outletId=${A.outlet}`, bearer(waiter))).status === 401, "…and a Bearer token alone does NOT open a dashboard connection (apps must say which app they are)");

  say("2. What an app is told — never the data");
  const gapStart = w.events.length;
  const secret = "Asha Verma";
  hub.broadcast(A.outlet, { type: "order.updated", order: { id: "o1", customer: { name: secret, phone: "9811700001" }, totals: { grandTotal: 99900 } } });
  await sleep(300);
  ok(dash.events.some((e) => e.type === "order.updated" && e.order?.customer?.name === secret), "the dashboard still receives the full order event (data inside)");
  ok(!w.events.slice(gapStart).some((e) => e.type === "order.updated") && !k.events.some((e) => e.type === "order.updated") && !r.events.some((e) => e.type === "order.updated"), "an app never receives it");
  const order = await db.OrderModel.create({
    brandId: A.brand, outletId: A.outlet, orderNumber: "7001", orderDay: "2026-11-27", channel: "delivery", placedBy: "customer", status: "placed",
    customer: { customerId: "c1", name: secret, phone: "9811700001" },
    lines: [{ itemId: "i1", name: "Masala Chai", quantity: 2, unitPrice: 3000, lineTotal: 6000, gstRatePct: 5, modifiers: [] }],
    totals: { subtotal: 6000, discount: 0, deliveryFee: 0, coinsRedeemed: 0, coinsDiscount: 0, coinsEarned: 0, taxable: 5714, cgst: 143, sgst: 143, taxAmount: 286, serviceCharge: 0, roundOff: 0, grandTotal: 6000 },
    pricesIncludeTax: true, payment: { gateway: "mock", status: "paid" }, deliveryAddress: { text: "12 Janpath", lat: 28.6, lng: 77.2, distanceKm: 2.4 },
    rider: { riderId: rider.id, name: "Ramesh", phone: "98765 43210", assignedAt: new Date() }, statusHistory: [{ status: "placed", at: new Date() }],
  });
  ok(await until(() => w.what().includes("orders") && k.what().includes("orders") && r.what().includes("deliveries")), "an order written to the database (by ANY code) tells OMA and KDA 'orders' and RDA 'deliveries'", `${w.what()} | ${k.what()} | ${r.what()}`);
  ok(!w.what().includes("deliveries") && !k.what().includes("deliveries") && !r.what().includes("orders") && !k.what().includes("tables"), "each app hears only its own kinds of change (the rider isn't told about orders, the kitchen not about tables)");
  const all = JSON.stringify([w.events, k.events, r.events]);
  ok(!all.includes(secret) && !all.includes("9811700001") && !all.includes("Masala") && !all.includes("grandTotal") && !all.includes(String(order._id)), "nothing the apps received holds a name, a phone, a dish, a price or an order id");
  ok(w.changes().every((e) => Array.isArray(e.what) && typeof e.at === "string" && Object.keys(e).sort().join() === "at,type,what"), "a message is exactly { type: 'changed', what: [...], at }");

  say("3. Several changes at once are one message; other stores and outlets hear nothing");
  const bw = await listen(q("oma", B.outlet), bearer(betaWaiter));
  const sw = await listen(q("oma", secondId), bearer(await appLogin("boss@acme.test", "oma")));
  await sleep(100);
  const before = { w: w.changes().length, bw: bw.changes().length, sw: sw.changes().length };
  for (let i = 0; i < 6; i++) await db.OrderModel.updateOne({ brandId: A.brand, outletId: A.outlet, _id: order._id }, { $set: { note: `n${i}` } });
  await sleep(700);
  ok(w.changes().length === before.w + 1, "six writes within a moment reach OMA as ONE message", `${w.changes().length - before.w} messages`);
  ok(bw.changes().length === before.bw && sw.changes().length === before.sw, "another store's app, and another outlet's app of the same store, hear nothing");
  ok(bw.events.every((e) => e.type === "hello" || e.type === "tick"), "…not even a stray event");

  say("4. Tables, dishes — and a dish that goes out of its hours");
  const tableDoc = await db.TableModel.create({ brandId: A.brand, outletId: A.outlet, number: "T1", seats: 4, qrSecret: "x".repeat(16) });
  ok(await until(() => w.what().includes("tables")) && !k.what().includes("tables") && !r.what().includes("tables"), "a table written → OMA hears 'tables' (the kitchen and the rider do not)");
  const w1 = w.changes().length;
  await db.TableSessionModel.create({ brandId: A.brand, outletId: A.outlet, tableId: String(tableDoc._id), customerId: "c1", status: "open" });
  ok(await until(() => w.changes().length > w1 && w.changes().at(-1).what.includes("tables")), "a party seated at it (a table-session write) → 'tables' again");
  const cat = (await own("POST", "/api/menu/categories", { name: "Drinks" })).json.category;
  const allDays = [0, 1, 2, 3, 4, 5, 6];
  const chai = (await own("POST", "/api/menu/items", { categoryId: cat.id, name: "Masala Chai", foodType: "veg", basePrice: 3000, availability: { windows: [{ days: allDays, from: "00:00", to: "23:58" }] } })).json.item;
  ok(await until(() => w.what().includes("menu") && k.what().includes("menu")), "a dish added in the dashboard → OMA and KDA hear 'menu'", `${w.what()} | ${k.what()}`);
  ok(!r.what().includes("menu"), "…the rider does not");
  const m1 = w.changes().length;
  await own("PATCH", `/api/menu/items/${chai.id}`, { name: "Masala Chai (large)" });
  ok(await until(() => w.changes().length > m1), "changing a dish → they hear 'menu' again");
  // …and a change that is NOT a write: the dish's serving hours end at 11:58 PM. Nothing is written when the clock passes it,
  // so the watcher compares the "can't be ordered now" list with the one it saw last time.
  await sleep(500);
  await lookAt(instant(10 * 60)); // 10 AM: the dish is on sale — the watcher remembers the list
  await sleep(500);
  const m2 = { w: w.changes().length, k: k.changes().length };
  await lookAt(instant(10 * 60 + 5)); // 10:05 AM: nothing changed
  await sleep(500);
  ok(w.changes().length === m2.w, "looking again with nothing changed sends nothing");
  await lookAt(instant(23 * 60 + 59)); // 11:59 PM: the serving hours have ended
  ok(await until(() => w.changes().length > m2.w && w.changes().at(-1).what.includes("menu") && k.changes().length > m2.k), "when the clock passes the dish's serving hours — no write at all — OMA and KDA are told 'menu'", `${w.changes().length - m2.w} new for OMA`);

  say("5. People who must be let go");
  const rider2 = (await own("POST", "/api/riders", { name: "Suresh", phone: "98111 22233" })).json.rider;
  await own("PUT", `/api/riders/${rider2.id}/pin`, { pin: "9090" });
  const r2token = (await call("POST", "/api/rider/login", { body: { phone: "9811122233", pin: "9090" }, headers: { "x-app-id": "rda" } })).json.token;
  const r2 = await listen("app=rda", bearer(r2token));
  ok(r2.status === 101, "a second rider connects");
  await own("PUT", `/api/riders/${rider2.id}/pin`, { pin: "1357" }); // the manager sets a new PIN: every older token stops working
  ok(await until(() => r2.closed && r2.closeCode === 4401), "a rider whose PIN was reset is let go at once (close 4401)", String(r2.closeCode));
  ok(!r.closed, "…the other rider's connection stays");
  await own("PATCH", `/api/riders/${rider.id}`, { isActive: false });
  ok(await until(() => r.closed && r.closeCode === 4401), "a rider switched off is let go at once too");
  const r3 = await listen("app=rda", bearer(riderToken));
  ok(r3.status === 403, "…and can't connect again (403, 'switched off')");

  // signing out on the phone ends the live connection at the next check
  const cookW = await listen(q("oma"), bearer(waiter));
  ok(cookW.status === 101, "(a fresh waiter connection)");
  await call("POST", "/api/auth/logout", { bearer: waiter });
  await hub.recheckClients(() => true);
  ok(await until(() => cookW.closed && cookW.closeCode === 4401), "a waiter who signs out has the live connection ended at the next check (close 4401)", String(cookW.closeCode));
  ok(!k.closed, "…while the cook's stays");

  // a paused store turns its team's apps away at once
  const kb = await listen(q("kda"), bearer(await appLogin("cook@acme.test", "kda")));
  ok(kb.status === 101, "(a fresh cook connection)");
  const off = await call("POST", `/api/platform/stores/${A.brand}/disable`, { cookie: A.su, body: { message: "Payment due" } });
  ok(off.status === 200, "the platform switches the store off");
  ok(await until(() => kb.closed && kb.closeCode === 4403), "the team's apps are cut off at once (close 4403)", String(kb.closeCode));
  ok((await listen(q("kda"), bearer(cook))).status === 403, "…and can't reconnect while it is off (403)");
  await call("POST", `/api/platform/stores/${A.brand}/enable`, { cookie: A.su });

  say("6. The platform's switch for live updates");
  const cook2 = await appLogin("cook@acme.test", "kda");
  const live = await listen(q("kda"), bearer(cook2));
  ok(live.status === 101, "(a connection while live updates are on)");
  await call("PUT", "/api/platform/settings", { cookie: A.su, body: { realtimeWebsocket: false } });
  ok(await until(() => live.closed && live.closeCode === 4410), "switching live updates off lets every connection go (close 4410: 'ask on a timer')", String(live.closeCode));
  ok((await listen(q("kda"), bearer(cook2))).status === 503, "…and a new connection is refused with 503 while it is off");
  await call("PUT", "/api/platform/settings", { cookie: A.su, body: { realtimeWebsocket: true } });
  await sleep(300);
  ok((await listen(q("kda"), bearer(cook2))).status === 101, "switched on again: apps can connect again with nothing else to do");

  say("7. A quiet line is not a dead line");
  const quiet = await listen(q("oma"), bearer(await appLogin("waiter@acme.test", "oma")));
  ok(quiet.status === 101, "(a fresh connection)");
  ok(await until(() => quiet.events.some((e) => e.type === "tick"), 24_000), "within about 20 seconds an app gets a 'tick', so it can tell silence from a dead connection");
  await sleep(200);
  const stillOpen = everyone.filter((c) => c.isApp && c.status === 101 && !c.closed);
  ok(stillOpen.length >= 2 && hub.appConnectionCount() === stillOpen.length, "the server counts exactly the apps still connected", `${hub.appConnectionCount()} counted, ${stillOpen.length} open`);
  void tableDoc;
});
