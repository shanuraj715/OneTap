// The Rider app's server side: riders sign in with a phone number + a PIN the manager sets; a rider's token opens only the rider routes; the
// delivery steps (picked up, delivered with the customer's 4-digit code); and that nothing of the dashboard or the other apps changed.
// A private API on an in-memory database; no browser.
import { startApi } from "./_api-harness.mjs";
const t = await startApi(3115, { WEBSITE_URL: "https://site.example.test" });
const { call, ok, say, raw, db } = t;
const orders = await import(`${t.API}/src/modules/orders/orders.service.js`);
const schema = await import(`${t.REPO}/packages/config-schema/src/index.js`);

await t.run(async () => {
  const A = await t.makeStore({ slug: "acme", ownerEmail: "o@acme.test" });
  const HA = { "x-rasoipulse-outlet": A.outlet };
  const own = (method, path, body) => call(method, path, { cookie: A.owner, headers: HA, body });
  const rider = (method, path, token, body, headers = {}) => call(method, `/api/rider${path}`, { bearer: token, body, headers: { "x-app-id": "rda", ...headers } });
  const login = (phone, pin, headers = {}) => call("POST", "/api/rider/login", { body: { phone, pin }, headers: { "x-app-id": "rda", ...headers } });

  // a store whose plan has no Delivery (its riders must not get in), and a second store (a phone number is one rider's across stores)
  const plan = (await call("POST", "/api/platform/plans", { cookie: A.su, body: { name: "No delivery", entitlements: { features: schema.FEATURE_KEYS.filter((k) => k !== "delivery") } } })).json.plan;
  const mkB = (await call("POST", "/api/brands", { cookie: A.su, body: { brandName: "Beta", brandSlug: "beta", outletName: "Main", outletSlug: "main", hostnames: ["beta.test"], ownerEmail: "o@beta.test", ownerName: "Owner", ownerPassword: "Owner123!", planId: String(plan._id ?? plan.id) } })).json;
  const B = { brand: String(mkB.brand?._id ?? mkB.brand?.id ?? mkB.brandId), outlet: String(mkB.outlet?._id ?? mkB.outlet?.id ?? mkB.outletId) };

  say("1. The manager gives a rider an app login");
  const ramesh = (await own("POST", "/api/riders", { name: "Ramesh", phone: "98765 43210" })).json.rider;
  const suresh = (await own("POST", "/api/riders", { name: "Suresh", phone: "98111 22233" })).json.rider;
  const nophone = (await own("POST", "/api/riders", { name: "No Phone", phone: "" })).json.rider;
  ok(ramesh.appLogin === false, "a new rider has no app login yet");
  ok((await own("PUT", `/api/riders/${nophone.id}/pin`, { pin: "1234" })).status === 400, "a rider with no phone number can't be given a login (the number IS the login name)");
  for (const bad of ["123", "1234567", "12ab", ""]) ok((await own("PUT", `/api/riders/${ramesh.id}/pin`, { pin: bad })).status === 400, `a PIN of "${bad}" is refused (4 to 6 digits)`);
  let r = await own("PUT", `/api/riders/${ramesh.id}/pin`, { pin: "4821" });
  ok(r.status === 200 && r.json.rider.appLogin === true && !JSON.stringify(r.json).includes("4821") && !("pinHash" in r.json.rider), "setting a PIN turns the login on, and the answer never carries the PIN or its hash");
  const stored = await raw("riders").findOne({ name: "Ramesh" });
  ok(/^s1\$[0-9a-f]{32}\$[0-9a-f]{64}$/.test(stored.pinHash) && !stored.pinHash.includes("4821") && stored.loginPhone === "9876543210", "only a salted hash is stored, and the login name is the last 10 digits of the phone");
  ok((await own("GET", "/api/riders")).json.riders.every((x) => !("pinHash" in x)), "the rider list never carries a hash");
  await own("PUT", `/api/riders/${suresh.id}/pin`, { pin: "9090" });
  const staffNoRight = (await call("POST", "/api/users", { cookie: A.owner, headers: { "x-rasoipulse-brand": A.brand }, body: { email: "cook@acme.test", name: "Cook", password: "Staff123!", role: "kitchen" } })).status;
  const cookCookie = await t.cookieLogin("cook@acme.test", "Staff123!");
  ok(staffNoRight < 300 && (await call("PUT", `/api/riders/${ramesh.id}/pin`, { cookie: cookCookie, headers: HA, body: { pin: "1111" } })).status === 403, "a person without 'manage riders' can't set a PIN");

  say("2. Signing in");
  let bad = await login("9876543210", "0000");
  ok(bad.status === 401 && /Incorrect phone number or PIN/.test(bad.json.error) && bad.json.details?.attemptsLeft >= 0, "a wrong PIN: 401, with how many tries are left", JSON.stringify(bad.json));
  const unknown = await login("9000000000", "4821");
  ok(unknown.status === 401 && unknown.json.error === bad.json.error, "an unknown phone number gets the SAME answer (nobody can find out who is a rider)");
  ok((await login("123", "4821")).status === 400 && (await login("9876543210", "12")).status === 400, "a short number or PIN is refused before anything is checked");
  const okLogin = await login("+91 98765 43210", "4821");
  ok(okLogin.status === 200 && okLogin.json.token?.startsWith("rdr1.") && okLogin.json.rider.name === "Ramesh" && okLogin.json.rider.storeName === "acme" && okLogin.json.rider.outletName, "the right PIN signs in (the number may be typed with +91 and spaces), and says who and where", JSON.stringify(okLogin.json.rider));
  const token = okLogin.json.token;
  ok(!("pinHash" in okLogin.json.rider) && !JSON.stringify(okLogin.json).includes("pinHash"), "the sign-in answer has no hash");
  ok((await rider("GET", "/me", token)).json.rider.name === "Ramesh", "GET /me says who is signed in");
  const sureshToken = (await login("9811122233", "9090")).json.token;

  say("3. A rider's token opens the rider routes and nothing else");
  ok((await call("GET", "/api/orders", { bearer: token, headers: HA })).status === 401, "the dashboard's orders say 401 to a rider's token");
  ok((await call("GET", "/api/riders", { bearer: token, headers: HA })).status === 401, "…and so does the rider list");
  ok((await call("GET", "/api/kitchen/orders", { bearer: token, headers: HA })).status === 401, "…and the kitchen board");
  ok((await rider("GET", "/deliveries", undefined)).status === 401, "no token: 401");
  ok((await call("GET", "/api/rider/deliveries", { cookie: A.owner, headers: { "x-app-id": "rda" } })).status === 401, "a dashboard cookie (even the owner's) does not open the rider routes");
  const forged = token.slice(0, -3) + (token.endsWith("aaa") ? "bbb" : "aaa");
  ok((await rider("GET", "/deliveries", forged)).status === 401, "a token with its signature changed is refused");
  const parts = token.split("."); const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
  const swapped = `rdr1.${Buffer.from(JSON.stringify({ ...payload, r: suresh.id })).toString("base64url")}.${parts[2]}`;
  ok((await rider("GET", "/deliveries", swapped)).status === 401, "a token edited to name another rider is refused");
  const expired = `rdr1.${Buffer.from(JSON.stringify({ ...payload, e: Date.now() - 1000 })).toString("base64url")}.${parts[2]}`;
  ok((await rider("GET", "/deliveries", expired)).status === 401, "an expired or re-signed-by-nobody token is refused");

  say("4. The deliveries");
  const chai = (await own("POST", "/api/menu/items", { categoryId: (await own("POST", "/api/menu/categories", { name: "Drinks" })).json.category.id, name: "Masala Chai", foodType: "veg", basePrice: 3000 })).json.item;
  const seed = async (over = {}) => {
    const doc = {
      brandId: A.brand, outletId: A.outlet, orderNumber: String(7000 + Math.floor(Math.random() * 900)), orderDay: "2026-11-27", channel: "delivery", placedBy: "customer", status: "ready",
      customer: { customerId: "c1", name: "Asha Verma", phone: "9811700001" },
      lines: [{ itemId: chai.id, name: "Masala Chai", quantity: 2, unitPrice: 3000, lineTotal: 6000, gstRatePct: 5, modifiers: [] }],
      totals: { subtotal: 6000, discount: 0, deliveryFee: 0, coinsRedeemed: 0, coinsDiscount: 0, coinsEarned: 0, taxable: 5714, cgst: 143, sgst: 143, taxAmount: 286, serviceCharge: 0, roundOff: 0, grandTotal: 6000 },
      pricesIncludeTax: true, payment: { gateway: "mock", status: "paid" },
      deliveryAddress: { text: "12 Janpath, Connaught Place", landmark: "Opp. metro gate 3", lat: 28.6315, lng: 77.2167, distanceKm: 2.4 },
      rider: { riderId: ramesh.id, name: "Ramesh", phone: "98765 43210", assignedAt: new Date() },
      deliveryCode: "4821", deliveryCodeTries: 0,
      statusHistory: [{ status: "placed", at: new Date() }, { status: "accepted", at: new Date() }, { status: "ready", at: new Date() }],
      createdAt: new Date(), updatedAt: new Date(),
      ...over,
    };
    return String((await raw("orders").insertOne(doc)).insertedId);
  };
  const mine1 = await seed();
  const mine2 = await seed({ status: "out_for_delivery", statusHistory: [{ status: "placed", at: new Date() }, { status: "ready", at: new Date() }, { status: "out_for_delivery", at: new Date() }] });
  const others = await seed({ rider: { riderId: suresh.id, name: "Suresh", phone: "98111 22233", assignedAt: new Date() } });
  const unassigned = await seed({ rider: undefined });
  const takeaway = await seed({ channel: "takeaway", deliveryAddress: undefined });
  const cooking = await seed({ status: "preparing" });
  const old = await seed({ deliveryCode: undefined, status: "out_for_delivery", statusHistory: [{ status: "out_for_delivery", at: new Date() }] });
  r = await rider("GET", "/deliveries", token);
  const ids = r.json.deliveries.map((d) => d.id);
  ok(r.status === 200 && ids.includes(mine1) && ids.includes(mine2) && ids.includes(cooking) && !ids.includes(others) && !ids.includes(unassigned) && !ids.includes(takeaway), "a rider sees the deliveries handed to THEM (ready, being made, out) — not another rider's, not an unassigned one, not a takeaway", ids.length + " rows");
  const d1 = r.json.deliveries.find((d) => d.id === mine1);
  ok(d1.address.text.startsWith("12 Janpath") && d1.address.lat === 28.6315 && d1.address.lng === 77.2167 && d1.address.landmark && d1.address.distanceKm === 2.4 && d1.customer.phone === "9811700001" && d1.items[0].name === "Masala Chai" && d1.items[0].quantity === 2, "each delivery has the address, the pin, the landmark, the distance, who to call and what is in the bag");
  ok(d1.needsCode === true && !r.text.includes("4821") && !JSON.stringify(r.json).includes("deliveryCode"), "the delivery code is NEVER sent to the rider (only that one is needed)");
  ok(r.json.deliveries.find((d) => d.id === old).needsCode === false, "an older order with no code needs none");
  ok(!("rider" in d1) && !("totals" in d1) && !JSON.stringify(d1).includes("brandId"), "nothing else of the order or the store leaks (no ids of the store, no totals)");
  ok((await rider("GET", "/deliveries", sureshToken)).json.deliveries.map((d) => d.id).join() === others, "the other rider sees only theirs");

  say("5. Picked up");
  ok((await rider("POST", `/deliveries/${cooking}/pickup`, token)).status === 409, "an order still being made can't be picked up (409, in words)");
  ok((await rider("POST", `/deliveries/${others}/pickup`, token)).status === 404, "someone else's delivery is 'not found' (a rider can't tell it exists)");
  ok((await rider("POST", `/deliveries/${unassigned}/pickup`, token)).status === 404, "an unassigned order too");
  ok((await rider("POST", `/deliveries/${takeaway}/pickup`, token)).status === 404, "a takeaway order too");
  ok((await rider("POST", `/deliveries/nonsense/pickup`, token)).status === 404, "a bad id is a 404, not an error");
  r = await rider("POST", `/deliveries/${mine1}/pickup`, token);
  ok(r.status === 200 && r.json.delivery.status === "out_for_delivery", "picking up a Ready order sends it Out for delivery");
  const afterPick = await raw("orders").findOne({ _id: new db.mongoose.Types.ObjectId(mine1) });
  ok(afterPick.status === "out_for_delivery" && afterPick.statusHistory.at(-1).by === `rider:${ramesh.id}`, "the order's history says the rider did it");
  ok((await rider("POST", `/deliveries/${mine1}/pickup`, token)).status === 200, "picking up twice is harmless");
  const view = await call("GET", "/api/orders", { cookie: A.owner, headers: HA });
  ok(view.status === 200 && !view.text.includes("4821"), "the dashboard's orders list never shows the delivery code");

  say("6. Delivered, with the customer's code");
  r = await rider("POST", `/deliveries/${mine1}/delivered`, token, {});
  ok(r.status === 409 && r.json.details?.code === "delivery_code_wrong" && /4-digit/.test(r.json.error), "no code: asked for it, in words");
  r = await rider("POST", `/deliveries/${mine1}/delivered`, token, { code: "0000" });
  ok(r.status === 409 && r.json.details.triesLeft === 4 && /4 tries left/.test(r.json.error), "a wrong code: 409 and how many tries are left (asking for the code without typing one did not use a try)");
  ok((await raw("orders").findOne({ _id: new db.mongoose.Types.ObjectId(mine1) })).status === "out_for_delivery", "…and the order is still out for delivery");
  r = await rider("POST", `/deliveries/${mine1}/delivered`, token, { code: "4821" });
  ok(r.status === 200 && r.json.delivery.status === "completed" && r.json.delivery.deliveredAt, "the right code completes the order");
  const done = await raw("orders").findOne({ _id: new db.mongoose.Types.ObjectId(mine1) });
  ok(done.status === "completed" && done.statusHistory.at(-1).by === `rider:${ramesh.id}` && /delivered by the rider/.test(done.statusHistory.at(-1).reason), "the history says who delivered it and why");
  ok((await rider("POST", `/deliveries/${mine1}/delivered`, token, { code: "4821" })).status === 200, "marking it again is harmless");
  r = await rider("GET", "/deliveries", token);
  ok(r.json.deliveredToday.some((d) => d.id === mine1) && !r.json.deliveries.some((d) => d.id === mine1), "it moves from 'to deliver' to 'delivered today'");
  // guessing
  const locked = await seed({ status: "out_for_delivery", statusHistory: [{ status: "out_for_delivery", at: new Date() }] });
  const guesses = [];
  for (const g of ["1111", "2222", "3333", "4444", "5555"]) guesses.push((await rider("POST", `/deliveries/${locked}/delivered`, token, { code: g })).status);
  ok(guesses.every((s) => s === 409), "five wrong guesses are each refused");
  r = await rider("POST", `/deliveries/${locked}/delivered`, token, { code: "4821" });
  ok(r.status === 429 && r.json.details?.code === "delivery_code_locked" && /Call the store/.test(r.json.error), "after that even the RIGHT code is refused: a code can't be guessed (the store can still mark it delivered)");
  ok((await own("PATCH", `/api/orders/${locked}/status`, { status: "completed" })).status === 200, "…and the manager can still complete it from the dashboard");
  r = await rider("POST", `/deliveries/${old}/delivered`, token, {});
  ok(r.status === 200 && r.json.delivery.status === "completed", "an older order with no code is completed without one");
  ok((await rider("POST", `/deliveries/${mine2}/delivered`, sureshToken, { code: "4821" })).status === 404, "another rider can't complete my delivery");
  ok((await rider("POST", `/deliveries/${cooking}/delivered`, token, { code: "4821" })).status === 409, "an order that was never picked up can't be marked delivered");

  say("7. The customer sees the code while the food is on its way");
  const view1 = await orders.customerOrderById({ brandId: A.brand, outletId: A.outlet, customerId: "c1", orderId: mine2 });
  ok(view1.deliveryCode === "4821" && view1.rider?.name === "Ramesh", "an Out-for-delivery order shows the customer the 4 digits and the rider");
  const view2 = await orders.customerOrderById({ brandId: A.brand, outletId: A.outlet, customerId: "c1", orderId: cooking });
  ok(view2.deliveryCode === null, "before it is out, no code is shown");
  const view3 = await orders.customerOrderById({ brandId: A.brand, outletId: A.outlet, customerId: "c1", orderId: mine1 });
  ok(view3.deliveryCode === null, "after it is delivered, no code is shown");

  say("8. A new delivery order gets a code");
  await own("PATCH", `/api/outlets/${A.outlet}/config`, { features: { ordering: { delivery: true } }, identity: { location: { point: { lat: 28.6315, lng: 77.2167 } } }, operations: { limits: { deliveryRadiusKm: 5 } } });
  const placed = await own("POST", "/api/orders", { outletId: A.outlet, channel: "delivery", name: "Walk-in", cart: { lines: [{ itemId: chai.id, quantity: 1, modifierOptionIds: [] }] }, deliveryAddress: { text: "14 Janpath, New Delhi", lat: 28.64, lng: 77.22 }, gateway: "mock" });
  ok(placed.status === 201, "a delivery order is placed (from a pin on the map)", `${placed.status} ${JSON.stringify(placed.json).slice(0, 200)}`);
  const newDoc = await raw("orders").findOne({ _id: new db.mongoose.Types.ObjectId(placed.json.order.id) });
  ok(/^\d{4}$/.test(newDoc.deliveryCode ?? ""), "it has a 4-digit delivery code", String(newDoc.deliveryCode));
  ok(newDoc.deliveryAddress.distanceKm > 0 && newDoc.deliveryAddress.distanceKm < 5 && newDoc.deliveryAddress.lat === 28.64, "the distance was measured by the server from the chosen pin to the outlet", String(newDoc.deliveryAddress.distanceKm));
  const noPin = await own("POST", "/api/orders", { outletId: A.outlet, channel: "delivery", name: "Walk-in", cart: { lines: [{ itemId: chai.id, quantity: 1, modifierOptionIds: [] }] }, deliveryAddress: { text: "14 Janpath, New Delhi" }, gateway: "mock" });
  ok(noPin.status === 400, "a delivery order with NO pin is refused (the location is mandatory)", String(noPin.status));
  const far = await own("POST", "/api/orders", { outletId: A.outlet, channel: "delivery", name: "Walk-in", cart: { lines: [{ itemId: chai.id, quantity: 1, modifierOptionIds: [] }] }, deliveryAddress: { text: "Far away place", lat: 19.07, lng: 72.87 }, gateway: "mock" });
  ok(far.status === 409, "a pin outside the delivery area is refused", String(far.status));
  const takeawayOrder = await own("POST", "/api/orders", { outletId: A.outlet, channel: "takeaway", name: "Walk-in", cart: { lines: [{ itemId: chai.id, quantity: 1, modifierOptionIds: [] }] }, gateway: "mock" });
  ok(takeawayOrder.status === 201 && !(await raw("orders").findOne({ _id: new db.mongoose.Types.ObjectId(takeawayOrder.json.order.id) })).deliveryCode, "a takeaway order has no code");

  say("9. Handing an order to a rider never fails because of WhatsApp");
  const handed = await seed({ rider: undefined, status: "ready" });
  r = await own("PATCH", `/api/orders/${handed}/rider`, { riderId: ramesh.id, sendOut: true });
  ok(r.status === 200 && r.json.order.status === "out_for_delivery", "with no WhatsApp number linked the hand-over still works (the message to the rider is just not sent)");

  say("10. Taking the login away");
  const wasToken = (await login("9876543210", "4821")).json.token;
  ok((await rider("GET", "/me", wasToken)).status === 200, "(the rider is signed in)");
  r = await own("PUT", `/api/riders/${ramesh.id}/pin`, { pin: "7777" });
  ok(r.status === 200, "the manager sets a new PIN");
  ok((await rider("GET", "/me", wasToken)).status === 401, "every earlier sign-in ends at once");
  ok((await login("9876543210", "4821")).status === 401 && (await login("9876543210", "7777")).status === 200, "the old PIN stops working, the new one works");
  const t2 = (await login("9876543210", "7777")).json.token;
  await own("PATCH", `/api/riders/${ramesh.id}`, { isActive: false });
  ok((await rider("GET", "/me", t2)).status === 403 && /switched off/.test((await rider("GET", "/me", t2)).json.error), "a rider switched off in the list is refused, in words");
  r = await login("9876543210", "7777");
  ok(r.status === 403 && /switched off/.test(r.json.error), "…and can't sign in either");
  await own("PATCH", `/api/riders/${ramesh.id}`, { isActive: true });
  ok((await rider("GET", "/me", t2)).status === 200, "switched back on, the same sign-in works again");
  r = await own("DELETE", `/api/riders/${ramesh.id}/pin`);
  ok(r.status === 200 && r.json.rider.appLogin === false, "the manager switches the app login off");
  ok((await rider("GET", "/me", t2)).status === 401 && (await login("9876543210", "7777")).status === 401, "the rider is signed out everywhere and can't sign in");
  await own("PUT", `/api/riders/${ramesh.id}/pin`, { pin: "5555" });
  ok((await rider("GET", "/me", t2)).status === 401, "turning it on again does not revive an old sign-in");
  const t3 = (await login("9876543210", "5555")).json.token;
  await own("PATCH", `/api/riders/${ramesh.id}`, { phone: "98765 00000" });
  ok((await login("9876500000", "5555")).status === 200 && (await login("9876543210", "5555")).status === 401, "changing the rider's phone number changes the number they sign in with");
  ok((await own("PATCH", `/api/riders/${ramesh.id}`, { phone: "98111 22233" })).status === 409, "…and it can't be a number another rider signs in with");
  ok((await own("PATCH", `/api/riders/${ramesh.id}`, { phone: "12345" })).status === 400, "…nor one too short to sign in with");
  await own("DELETE", `/api/riders/${ramesh.id}`);
  ok((await rider("GET", "/me", t3)).status === 401, "a rider removed from the list is signed out");

  say("11. Plan, store and app version");
  const rb = (await call("POST", "/api/riders", { cookie: A.su, headers: { "x-rasoipulse-outlet": B.outlet }, body: { name: "Beta rider", phone: "97000 11111" } }));
  ok(rb.status === 403, "a store whose plan has no Delivery can't even list riders (so none can get a login)");
  await raw("riders").insertOne({ brandId: B.brand, outletId: B.outlet, name: "Beta rider", phone: "9700011111", isActive: true, loginPhone: "9700011111", pinHash: (await import(`${t.API}/src/modules/riders/rider-auth.js`)).hashPin ? await (await import(`${t.API}/src/modules/riders/rider-auth.js`)).hashPin("1234") : "", pinVersion: 1 });
  r = await login("9700011111", "1234");
  ok(r.status === 403 && /Delivery/.test(r.json.error), "a rider of such a store is refused at sign-in, in words", JSON.stringify(r.json));
  const off0 = await call("POST", `/api/platform/stores/${A.brand}/disable`, { cookie: A.su, body: { message: "Late payment" } });
  const off = await rider("GET", "/me", sureshToken);
  ok(off0.status < 300 && off.status === 403 && /disabled/i.test(off.json.error), "a store the platform switched off turns its riders away too", `${off0.status} / ${off.status} ${off.json.error ?? ""}`);
  ok((await login("9811122233", "9090")).status === 403, "…and they can't sign in either");
  await call("POST", `/api/platform/stores/${A.brand}/enable`, { cookie: A.su, body: {} });
  ok((await rider("GET", "/me", sureshToken)).status === 200, "switched back on, the same sign-in works again");
  await db.AppReleaseModel.create({ app: "rda", platform: "android", version: "v-26.11.28-002", versionCode: 2, notes: "x", force: true, status: "published", publishedAt: new Date(), file: { name: "a.apk", key: "a.apk", size: 1, sha256: "a".repeat(64) } });
  r = await login("9811122233", "9090", { "x-app-version-code": "1" });
  ok(r.status === 426, "an old build of the rider app is turned away (426) while an update is required, before any PIN is checked", String(r.status));
  ok((await login("9811122233", "9090", { "x-app-version-code": "2" })).status === 200, "the current build signs in");
  ok((await call("GET", "/api/app-updates/check?app=rda&platform=android&versionCode=1")).json.updateAvailable === true, "the update check knows the rider app");
  ok((await call("GET", "/api/app-updates/check?app=oma&platform=android&versionCode=1")).json.latest === null, "…and OMA's releases are separate");

  say("12. Guessing PINs");
  const codes = [];
  for (let i = 0; i < 12; i++) codes.push((await login("9811122233", String(1000 + i), { "x-forwarded-for": `203.0.113.${i + 1}` })).status);
  ok(codes.includes(429), "many wrong PINs for one phone number — even from different addresses — pause that login", codes.join(","));
  ok((await login("9811122233", "9090", { "x-forwarded-for": "203.0.113.99" })).status === 429, "…and then even the right PIN waits");
});
