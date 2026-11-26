// A customer's saved delivery place (one per outlet, filled when they order delivery, read when they next choose Delivery at that outlet) and
// the customer sign-in that lasts: 180 days, pushed out again by every visit. A private API on an in-memory database; no browser.
import { startApi } from "./_api-harness.mjs";
const t = await startApi(3117, { WEBSITE_URL: "https://site.example.test" });
const { call, ok, say, raw, db, base } = t;
const oid = (s) => new db.mongoose.Types.ObjectId(String(s));

await t.run(async () => {
  const A = await t.makeStore({ slug: "acme", ownerEmail: "o@acme.test", outlets: 2 });
  const B = await t.makeStore({ slug: "beta", ownerEmail: "o@beta.test" });
  const [noida, delhi] = A.outletIds;
  const own = (store, outlet, method, path, body) => call(method, path, { cookie: store.owner, headers: { "x-rasoipulse-outlet": outlet }, body });

  // both of Acme's outlets deliver (from different places), each with one dish
  const where = { [noida]: { lat: 28.5355, lng: 77.391 }, [delhi]: { lat: 28.6315, lng: 77.2167 } };
  const dish = {};
  for (const o of [noida, delhi]) {
    await own(A, o, "PATCH", `/api/outlets/${o}/config`, { features: { ordering: { delivery: true } }, identity: { location: { point: where[o] } }, operations: { limits: { deliveryRadiusKm: 8 } } });
    const cat = (await own(A, o, "POST", "/api/menu/categories", { name: "Momos" })).json.category;
    dish[o] = (await own(A, o, "POST", "/api/menu/items", { categoryId: cat.id, name: "Veg Momos", foodType: "veg", basePrice: 9000 })).json.item;
  }

  const signUp = async (store, outlet, phone, name) => {
    const r = await call("POST", "/api/customer/otp/request", { body: { outletId: outlet, destination: phone, name } });
    const v = await fetch(`${base}/api/customer/otp/verify`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 200) + 20}` }, body: JSON.stringify({ outletId: outlet, destination: phone, code: r.json.devCode, name, gender: "female", age: 30 }) });
    const raw = v.headers.get("set-cookie");
    return { cookie: raw?.split(";")[0], rawCookie: raw, id: (await v.json()).customer?.id };
  };
  const asha = await signUp(A, noida, "9811700001", "Asha Rao");
  const ravi = await signUp(A, noida, "9811700002", "Ravi Kumar");
  const bela = await signUp(B, B.outlet, "9811700003", "Bela Shah");
  const as = (who, method, path, body) => call(method, path, { cookie: who.cookie, body });
  const order = (who, outlet, deliveryAddress) => as(who, "POST", "/api/orders", { outletId: outlet, channel: "delivery", cart: { lines: [{ itemId: dish[outlet].id, quantity: 1, modifierOptionIds: [] }] }, deliveryAddress, gateway: "mock" });
  const saved = async (who, outlet) => (await as(who, "GET", `/api/customer/address?outletId=${outlet}`)).json.address;
  const settle = () => new Promise((r) => setTimeout(r, 250)); // the order saves the place in the background

  say("1. Nothing saved yet");
  ok(await saved(asha, noida) === null, "a customer who never ordered delivery has no saved place");
  ok((await call("GET", `/api/customer/address?outletId=${noida}`)).json.address === null, "someone not signed in gets 'nothing saved' (no error: the picker just starts at the restaurant)");
  ok((await call("GET", "/api/customer/address")).status === 400, "no outlet named is a 400");

  say("2. Ordering delivery saves the place, for THAT outlet");
  let r = await order(asha, noida, { text: "B-14, Sector 18, Noida", landmark: "Opposite the metro", lat: 28.55, lng: 77.4 });
  ok(r.status === 201, "a delivery order is placed from a pin on the map", `${r.status} ${JSON.stringify(r.json).slice(0, 160)}`);
  const stored = await raw("orders").findOne({ _id: oid(r.json.order.id) });
  ok(/^\d{4}$/.test(r.json.order.deliveryCode ?? "") && r.json.order.deliveryCode === stored.deliveryCode, "the customer who placed it is told the 4-digit delivery code right away (for the 'order placed' screen)", String(r.json.order.deliveryCode));
  await settle();
  let a = await saved(asha, noida);
  ok(a && a.lat === 28.55 && a.lng === 77.4 && a.text === "B-14, Sector 18, Noida" && a.landmark === "Opposite the metro", "the pin AND the whole address (text and landmark) are saved for the Noida outlet", JSON.stringify(a));
  ok(await saved(asha, delhi) === null, "the Delhi outlet has nothing saved yet (each outlet has its own)");
  ok(await saved(ravi, noida) === null, "another customer's saved place is not visible to Ravi");

  say("3. A second outlet keeps its own place");
  r = await order(asha, delhi, { text: "Flat 4, Janpath, Delhi", landmark: "", lat: 28.64, lng: 77.22 });
  ok(r.status === 201, "the same customer orders delivery from the Delhi outlet");
  await settle();
  const d = await saved(asha, delhi);
  ok(d && d.lat === 28.64 && d.text === "Flat 4, Janpath, Delhi", "Delhi has its own saved place");
  a = await saved(asha, noida);
  ok(a && a.lat === 28.55 && a.text === "B-14, Sector 18, Noida", "…and Noida's is untouched: two places for two outlets");
  ok((await raw("customeraddresses").countDocuments({ customerId: asha.id })) === 2, "two rows in the database for this customer");

  say("4. The next order from the same outlet replaces it");
  await order(asha, noida, { text: "New place, Sector 62", landmark: "Gate 2", lat: 28.6, lng: 77.36 });
  await settle();
  a = await saved(asha, noida);
  ok(a && a.lat === 28.6 && a.text === "New place, Sector 62" && a.landmark === "Gate 2", "ordering again with another pin updates Noida's saved place");
  const row = await raw("customeraddresses").findOne({ customerId: asha.id, outletId: noida });
  ok(row.timesUsed === 2 && (await raw("customeraddresses").countDocuments({ customerId: asha.id })) === 2, "still one row per outlet (used twice at Noida)", `timesUsed ${row.timesUsed}`);

  say("5. What is NOT saved");
  const before = await raw("customeraddresses").countDocuments({});
  const staff = await own(A, noida, "POST", "/api/orders", { outletId: noida, channel: "delivery", name: "Walk-in", cart: { lines: [{ itemId: dish[noida].id, quantity: 1, modifierOptionIds: [] }] }, deliveryAddress: { text: "Phoned-in order", lat: 28.54, lng: 77.39 }, gateway: "mock" });
  ok(staff.status === 201, "(staff place a phoned-in delivery order)");
  ok(!("deliveryCode" in staff.json.order), "the dashboard's answer for an order does not carry the delivery code");
  const take = await as(ravi, "POST", "/api/orders", { outletId: noida, channel: "takeaway", cart: { lines: [{ itemId: dish[noida].id, quantity: 1, modifierOptionIds: [] }] }, gateway: "cod" });
  ok(take.status === 201 && !("deliveryCode" in take.json.order), "(a customer places a takeaway order: no delivery code)");
  const far = await order(ravi, noida, { text: "Too far away", lat: 19.07, lng: 72.87 });
  ok(far.status === 409, "(a delivery order outside the area is refused)");
  await settle();
  ok((await raw("customeraddresses").countDocuments({})) === before, "none of those saved anything: no customer on a staff order, no delivery on a takeaway, no order on a refused pin");

  say("6. Saving and clearing by hand");
  r = await as(ravi, "PUT", "/api/customer/address", { outletId: noida, lat: 28.58, lng: 77.41, text: "Saved by hand", landmark: "Near the park" });
  ok(r.status === 200 && r.json.address.text === "Saved by hand", "a customer can save a place directly");
  ok((await saved(ravi, noida)).landmark === "Near the park", "and it is read back");
  ok((await as(ravi, "PUT", "/api/customer/address", { outletId: noida, lat: 99, lng: 77, text: "x" })).status === 400, "an impossible latitude is refused");
  ok((await as(ravi, "PUT", "/api/customer/address", { outletId: noida, lat: 28, lng: 200, text: "x" })).status === 400, "…and an impossible longitude");
  ok((await call("PUT", "/api/customer/address", { body: { outletId: noida, lat: 28, lng: 77 } })).status === 401, "saving needs a sign-in");
  r = await as(ravi, "DELETE", `/api/customer/address?outletId=${noida}`);
  ok(r.status === 204 && await saved(ravi, noida) === null, "'forget my saved place' removes it");
  ok(await saved(asha, noida) !== null, "…and only Ravi's (Asha's is still there)");

  say("7. Only the customer's own, only their own store");
  ok((await as(bela, "GET", `/api/customer/address?outletId=${noida}`)).status === 403, "a customer of ANOTHER store can't read this store's outlet (403)");
  ok((await as(bela, "PUT", "/api/customer/address", { outletId: noida, lat: 28, lng: 77, text: "x" })).status === 403, "…nor save to it");
  ok((await as(bela, "DELETE", `/api/customer/address?outletId=${noida}`)).status === 403, "…nor clear it");
  ok(await saved(asha, noida) !== null, "Asha's place is unharmed");

  say("8. The sign-in lasts, and every visit extends it");
  const day = 86_400_000;
  const sessionOf = async (who) => raw("customersessions").findOne({ customerId: who.id });
  let s = await sessionOf(asha);
  const days = (sess) => (new Date(sess.expiresAt) - Date.now()) / day;
  ok(days(s) > 179 && days(s) <= 180.01, "a new sign-in lasts 180 days", `${days(s).toFixed(1)} days`);
  ok(/Expires=/i.test(asha.rawCookie), "the cookie carries the same end date");
  // within the day it was made or last extended: nothing is written
  r = await as(asha, "GET", "/api/customer/me");
  ok(r.json.customer?.name === "Asha Rao" && !r.headers.get("set-cookie"), "a visit right after signing in changes nothing (no new cookie, no write)");
  // 100 days left: a visit pushes it out to 180 again and re-issues the cookie
  await raw("customersessions").updateOne({ _id: s._id }, { $set: { expiresAt: new Date(Date.now() + 100 * day) } });
  await t.db.CustomerSessionModel.findOne({ _id: s._id }); // (a read, to make sure nothing is cached from the old date)
  r = await as(asha, "GET", "/api/customer/me");
  s = await sessionOf(asha);
  const sc = r.headers.get("set-cookie") ?? "";
  ok(r.json.customer?.name === "Asha Rao" && days(s) > 179, "a visit with 100 days left pushes it out to 180 days again", `${days(s).toFixed(1)} days`);
  ok(/rasoipulse_customer=/.test(sc) && /HttpOnly/i.test(sc) && /SameSite=Lax/i.test(sc) && new Date(/Expires=([^;]+)/i.exec(sc)?.[1] ?? 0) - Date.now() > 179 * day, "…and the cookie is re-issued with the new end date (still HttpOnly, SameSite=Lax)", sc.slice(0, 140));
  ok(sc.split(";")[0] === asha.cookie, "…carrying the SAME token (nothing else changes)");
  // an ended sign-in is not revived by a visit
  await raw("customersessions").updateOne({ _id: s._id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  await new Promise((r2) => setTimeout(r2, 100));
  const cache = await import(`${t.API}/src/modules/cache/cache.js`);
  await cache.cache.expireAll?.().catch?.(() => undefined);
  r = await as(asha, "GET", "/api/customer/me");
  ok(r.json.customer === null, "a sign-in whose end date has passed is NOT revived by a visit", JSON.stringify(r.json));
  // signing out still ends it for good
  r = await as(ravi, "POST", "/api/customer/logout", {});
  ok(r.status === 204 && (await as(ravi, "GET", "/api/customer/me")).json.customer === null, "signing out still ends the sign-in at once");
  ok(await raw("customersessions").countDocuments({ customerId: ravi.id }) === 0, "…and removes it from the database");
});
