// Ratings, dish by dish: a customer rates a completed order (stars + a review) AND each dish on its own; the store then sees the ratings by customer, by
// outlet and by dish (the same dish at two outlets is ONE row). A private API, in-memory database, no browser. Every expected number is worked out HERE.
import { startApi } from "./_api-harness.mjs";

const t = await startApi(3138);
const { call, ok, say, raw } = t;
const S = await import(`${t.REPO}/packages/config-schema/src/index.js`);
const near = (a, b) => Math.abs(a - b) < 0.0001;

await t.run(async () => {
  const s = await t.makeStore({ slug: "acme", ownerEmail: "o@acme.test", outlets: 2 });
  const [A, A2] = s.outletIds;
  const hdr = { "x-rasoipulse-brand": s.brand };
  const plan = (await call("POST", "/api/platform/plans", { cookie: s.su, body: { name: "Full", limits: { maxUsers: 20, multiOutlet: true, maxOutlets: 5, maxTables: 50 }, entitlements: { features: ["takeaway", "dineInQr", "analytics", "feedback"] } } })).json.plan;
  const noFeedback = (await call("POST", "/api/platform/plans", { cookie: s.su, body: { name: "Plain", entitlements: { features: ["takeaway"] } } })).json.plan;
  await call("PATCH", `/api/platform/stores/${s.brand}/plan`, { cookie: s.su, body: { planId: plan.id } });
  for (const id of [A, A2]) await call("PATCH", `/api/outlets/${id}/config`, { cookie: s.owner, headers: { ...hdr, "x-rasoipulse-outlet": id }, body: { feedback: { enabled: true, googleReviewUrl: "", googleMinStars: 4 } } });
  const mkUser = async (email, role) => { await call("POST", "/api/users", { cookie: s.owner, headers: hdr, body: { email, name: role, password: "Password123!", role } }); return t.cookieLogin(email, "Password123!"); };
  const cashier = await mkUser("c@acme.test", "staff");
  const accountant = await mkUser("a@acme.test", "accountant");
  // a second, unrelated store with the Ratings feature and nothing rated, and a third store whose plan has no Ratings
  const other = await t.makeStore({ slug: "other", ownerEmail: "o@other.test" });
  await call("PATCH", `/api/platform/stores/${other.brand}/plan`, { cookie: other.su, body: { planId: plan.id } });
  const plain = await t.makeStore({ slug: "plain", ownerEmail: "o@plain.test" });
  await call("PATCH", `/api/platform/stores/${plain.brand}/plan`, { cookie: plain.su, body: { planId: noFeedback.id } });

  const signUp = async (store, phone, name) => {
    const r = await call("POST", "/api/customer/otp/request", { body: { outletId: store.outlet, destination: phone, name } });
    const v = await fetch(`${t.base}/api/customer/otp/verify`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.200" }, body: JSON.stringify({ outletId: store.outlet, destination: phone, code: r.json.devCode, name, gender: "female", age: 30 }) });
    const customer = (await v.json()).customer;
    return { cookie: v.headers.get("set-cookie")?.split(";")[0], id: customer.id, name, phone };
  };
  const asha = await signUp({ outlet: A }, "9811700001", "Asha Rao");
  const ravi = await signUp({ outlet: A }, "9811700002", "Ravi Kumar");
  const meera = await signUp({ outlet: A }, "9811700004", "Meera Iyer");

  const asOwner = (method, path, outlet, body) => call(method, path, { cookie: s.owner, headers: { ...hdr, "x-rasoipulse-outlet": outlet }, body });
  const cat = async (outlet) => (await asOwner("POST", "/api/menu/categories", outlet, { name: "Food" })).json.category;
  const item = async (outlet, categoryId, name, basePrice = 10000) => (await asOwner("POST", "/api/menu/items", outlet, { categoryId, name, basePrice })).json.item;
  const catA = await cat(A), catA2 = await cat(A2);
  const momosA = await item(A, catA.id, "Veg Momos"), chaiA = await item(A, catA.id, "Masala Chai", 3000);
  const momosA2 = await item(A2, catA2.id, "veg momos "), rollA2 = await item(A2, catA2.id, "Paneer Roll", 9000); // the same dish, another outlet, another spelling

  let n = 100;
  const totals = (g) => ({ subtotal: g, discount: 0, deliveryFee: 0, coinsRedeemed: 0, coinsDiscount: 0, coinsEarned: 0, taxable: g, cgst: 0, sgst: 0, taxAmount: 0, serviceCharge: 0, roundOff: 0, grandTotal: g });
  const pl = (it, qty) => ({ itemId: it.id, name: it.name, quantity: qty, unitPrice: 10000, lineTotal: 10000 * qty, gstRatePct: 5, modifiers: [] });
  const seed = async (outlet, who, lines, { status = "completed", ageDays = 0 } = {}) => {
    const at = new Date(Date.now() - ageDays * 86_400_000);
    const doc = { brandId: s.brand, outletId: outlet, orderNumber: String(++n), orderDay: "2026-11-20", channel: "takeaway", placedBy: "customer", status, customer: { customerId: who.id, name: who.name, phone: who.phone }, lines, totals: totals(10000 * lines.length), pricesIncludeTax: true, payment: { gateway: "cod", status: "paid" }, createdAt: at, updatedAt: at, statusHistory: [] };
    return String((await raw("orders").insertOne(doc)).insertedId);
  };
  const rate = (who, id, outlet, body) => call("POST", `/api/customer/orders/${id}/feedback`, { cookie: who.cookie, body: { outletId: outlet, ...body } });
  const view = (path, outlet = A, cookie = s.owner) => call("GET", path, { cookie, headers: { ...hdr, "x-rasoipulse-outlet": outlet } });

  const o1 = await seed(A, asha, [pl(momosA, 2), pl(chaiA, 1)]);
  const o2 = await seed(A, ravi, [pl(momosA, 1)]);
  const o3 = await seed(A2, meera, [pl(momosA2, 1), pl(rollA2, 1)]);
  const o4 = await seed(A, asha, [pl(chaiA, 1)]);
  const open = await seed(A, asha, [pl(chaiA, 1)], { status: "preparing" });

  say("1. The customer rates the order AND each dish");
  let h = (await call("GET", `/api/customer/orders?outletId=${A}`, { cookie: asha.cookie })).json;
  const mine = h.orders.find((o) => o.id === o1);
  ok(mine.canRate === true && mine.items.length === 2 && mine.items.every((i) => typeof i.itemId === "string" && i.itemId.length > 10), "her order lists its dishes WITH their ids (so each can be rated)", JSON.stringify(mine.items.map((i) => i.itemId?.length)));
  let r = await rate(asha, o1, A, { rating: 5, comment: "Best day!", tags: ["Tasty"], items: [{ itemId: momosA.id, rating: 5, comment: "  Crispy outside  " }, { itemId: chaiA.id, rating: 4 }] });
  ok(r.status === 200 && r.json.feedback.items.length === 2 && r.json.feedback.items[0].comment === "Crispy outside" && r.json.feedback.items.map((i) => i.name).join() === "Veg Momos,Masala Chai", "order 5★ and dishes 5★ / 4★ are saved; the dish names come from the ORDER; notes are trimmed", JSON.stringify(r.json.feedback.items));
  ok((await rate(ravi, o2, A, { rating: 3, comment: "okay", items: [{ itemId: momosA.id, rating: 2, comment: "was cold" }] })).status === 200, "Ravi rates his order 3★ and the momos 2★ (“was cold”)");
  ok((await rate(meera, o3, A2, { rating: 4, items: [{ itemId: momosA2.id, rating: 4 }, { itemId: rollA2.id, rating: 5, comment: "great" }] })).status === 200, "Meera rates an order at the second outlet: momos 4★, roll 5★");
  ok((await rate(asha, o4, A, { rating: 4 })).status === 200, "Asha also rates a plain order (no dish ratings) 4★");
  h = (await call("GET", `/api/customer/orders?outletId=${A}`, { cookie: asha.cookie })).json;
  const back = h.orders.find((o) => o.id === o1).feedback;
  ok(back.rating === 5 && back.items.length === 2 && back.items.find((i) => i.itemId === chaiA.id).rating === 4, "her order list gives the dish ratings back (so the page can show and change them)");

  say("2. What is refused");
  r = await rate(asha, o1, A, { rating: 5, items: [{ itemId: momosA2.id, rating: 5 }] });
  ok(r.status === 400, "a dish that was NOT in this order (another outlet's momos) is refused", `${r.status} ${r.json.error}`);
  r = await rate(asha, o1, A, { rating: 5, items: [{ itemId: momosA.id, rating: 6 }] });
  ok(r.status === 400, "6 stars for a dish is refused", String(r.status));
  r = await rate(asha, o1, A, { rating: 5, items: [{ itemId: momosA.id, rating: 0 }] });
  ok(r.status === 400, "0 stars for a dish is refused");
  r = await rate(asha, o1, A, { rating: 5, items: Array.from({ length: 31 }, () => ({ itemId: momosA.id, rating: 5 })) });
  ok(r.status === 400, "more than 30 dish ratings in one go is refused");
  r = await rate(asha, o1, A, { rating: 5, items: [{ itemId: momosA.id, rating: 5, comment: "x".repeat(201) }] });
  ok(r.status === 400, "a dish note over 200 characters is refused");
  r = await rate(asha, open, A, { rating: 5, items: [{ itemId: chaiA.id, rating: 5 }] });
  ok(r.status === 409, "rating the dishes of an order that is still being cooked is refused", String(r.status));
  r = await rate(ravi, o1, A, { rating: 1, items: [{ itemId: momosA.id, rating: 1 }] });
  ok(r.status === 404, "nobody can rate dishes of someone else's order", String(r.status));
  r = await rate(asha, o1, A, { rating: 5, items: [{ itemId: momosA.id, rating: 3 }, { itemId: momosA.id, rating: 5 }] });
  ok(r.status === 200 && r.json.feedback.items.length === 1 && r.json.feedback.items[0].rating === 5, "the same dish twice counts once (the last word wins)");
  // put the first order's ratings back as they were
  await rate(asha, o1, A, { rating: 5, comment: "Best day!", tags: ["Tasty"], items: [{ itemId: momosA.id, rating: 5, comment: "Crispy outside" }, { itemId: chaiA.id, rating: 4 }] });

  say("3. Changing a rating");
  r = await rate(asha, o1, A, { rating: 5, comment: "Best day!" });
  ok(r.status === 200 && r.json.feedback.items.length === 2, "sending the order rating WITHOUT a dish list leaves the dish ratings as they were");
  r = await rate(asha, o1, A, { rating: 5, comment: "Best day!", items: [{ itemId: chaiA.id, rating: 4 }] });
  ok(r.status === 200 && r.json.feedback.items.length === 1, "sending a shorter dish list replaces them (the momos rating is gone)");
  r = await rate(asha, o1, A, { rating: 5, comment: "Best day!", items: [] });
  ok(r.status === 200 && r.json.feedback.items.length === 0, "an empty dish list removes them all");
  await rate(asha, o1, A, { rating: 5, comment: "Best day!", tags: ["Tasty"], items: [{ itemId: momosA.id, rating: 5, comment: "Crispy outside" }, { itemId: chaiA.id, rating: 4 }] });
  ok((await raw("feedbacks").countDocuments({ orderId: o1 })) === 1, "still ONE rating for the order");

  say("4. The store: ratings by outlet");
  const by = await view("/api/feedback/by-outlet?days=30");
  ok(by.status === 200 && by.json.outlets.length === 2, "two outlets listed", String(by.status));
  const oA = by.json.outlets.find((o) => o.id === A), oB = by.json.outlets.find((o) => o.id === A2);
  ok(oA.count === 3 && near(oA.average, 4) && oA.byStars[5] === 1 && oA.byStars[4] === 1 && oA.byStars[3] === 1 && oA.withComments === 2, "the first outlet: 3 ratings (5, 3, 4), average 4.0, two with a comment", JSON.stringify(oA));
  ok(oA.dishRatings === 3 && oB.dishRatings === 2, "…and how many dishes were rated on their own (3 and 2)");
  ok(oB.count === 1 && near(oB.average, 4) && oB.name && oB.title, "the second outlet: 1 rating, average 4.0, with its name");
  ok(by.json.total.count === 4 && near(by.json.total.average, 4) && by.json.total.byStars[4] === 2, "all together: 4 ratings, average 4.0", JSON.stringify(by.json.total));
  ok(oA.happyShare === 67 && oB.happyShare === 100, "the share of 4–5★ ratings: 67% and 100%", `${oA.happyShare} ${oB.happyShare}`);
  const only = await view(`/api/feedback/by-outlet?days=30&outlets=${A2}`);
  ok(only.json.outlets.length === 1 && only.json.outlets[0].id === A2 && only.json.total.count === 1, "narrowed to one outlet with ?outlets=");
  await raw("feedbacks").updateOne({ orderId: o2 }, { $set: { createdAt: new Date(Date.now() - 40 * 86_400_000) } });
  const short = await view("/api/feedback/by-outlet?days=30");
  const longer = await view("/api/feedback/by-outlet?days=90");
  ok(short.json.total.count === 3 && longer.json.total.count === 4, "the period matters: a 40-day-old rating is out of 30 days and in 90 days", `${short.json.total.count} / ${longer.json.total.count}`);
  await raw("feedbacks").updateOne({ orderId: o2 }, { $set: { createdAt: new Date(Date.now() - 3_600_000) } }); // (an hour ago: still before Asha's latest)

  say("5. The store: ratings by customer");
  let c = (await view("/api/feedback/by-customer?days=30")).json;
  ok(c.total === 3 && c.customers.length === 3 && c.pages === 1, "three customers rated", JSON.stringify([c.total, c.customers.length]));
  const ca = c.customers.find((x) => x.name === "Asha Rao");
  ok(ca.count === 2 && near(ca.average, 4.5) && ca.lowest === 4 && ca.highest === 5 && ca.dishRatings === 2 && ca.phone === "9811700001", "Asha: 2 ratings, average 4.5, lowest 4, 2 dishes rated, her number", JSON.stringify(ca));
  ok(c.customers[0].name === "Asha Rao" && c.sort === "recent", "newest first by default (Asha rated last)", c.customers[0].name);
  c = (await view("/api/feedback/by-customer?days=30&sort=lowest")).json;
  ok(c.customers[0].name === "Ravi Kumar" && near(c.customers[0].average, 3), "lowest average first: Ravi (3.0)");
  c = (await view("/api/feedback/by-customer?days=30&sort=highest")).json;
  ok(c.customers[0].name === "Asha Rao", "highest average first: Asha");
  c = (await view("/api/feedback/by-customer?days=30&sort=most")).json;
  ok(c.customers[0].name === "Asha Rao" && c.customers[0].count === 2, "most ratings first: Asha (2)");
  c = (await view("/api/feedback/by-customer?days=30&search=ravi")).json;
  ok(c.total === 1 && c.customers[0].name === "Ravi Kumar" && c.customers[0].lastComment === "okay", "search by name finds Ravi and shows what he last said");
  c = (await view("/api/feedback/by-customer?days=30&search=9811700004")).json;
  ok(c.total === 1 && c.customers[0].name === "Meera Iyer" && c.customers[0].outlets.length === 1, "search by phone finds Meera, who rated at one outlet");
  c = (await view("/api/feedback/by-customer?days=30&search=" + encodeURIComponent(".*"))).json;
  ok(c.total === 0, "a search is plain text, never a pattern (.* matches nobody)");
  c = (await view("/api/feedback/by-customer?days=30&limit=2&page=2")).json;
  ok(c.customers.length === 1 && c.pages === 2 && c.page === 2, "paging: 2 per page → page 2 has the third", JSON.stringify([c.customers.length, c.pages]));
  ok((await view("/api/feedback/by-customer?days=30&sort=nonsense")).status === 400, "a made-up sort is refused");

  say("6. The store: ratings by dish (the same dish at two outlets is one row)");
  let it = (await view("/api/feedback/by-item?days=30")).json;
  ok(it.items.length === 3 && it.items[0].key === "veg momos", "three dishes; the most rated first: Veg Momos", it.items.map((i) => i.key).join());
  const vm = it.items[0];
  ok(vm.count === 3 && near(vm.average, 3.7) && vm.byStars[5] === 1 && vm.byStars[4] === 1 && vm.byStars[2] === 1 && vm.withNotes === 2, "Veg Momos: rated 3 times (5, 2, 4) — average 3.7 — two with a note, across BOTH outlets and both spellings", JSON.stringify(vm));
  ok(vm.outlets.length === 2 && vm.outlets.find((o) => o.id === A).count === 2 && near(vm.outlets.find((o) => o.id === A).average, 3.5) && near(vm.outlets.find((o) => o.id === A2).average, 4), "…and per outlet: 3.5 at the first, 4.0 at the second");
  const chai = it.items.find((i) => i.key === "masala chai"), roll = it.items.find((i) => i.key === "paneer roll");
  ok(chai.count === 1 && near(chai.average, 4) && roll.count === 1 && near(roll.average, 5), "Masala Chai 4.0 (once), Paneer Roll 5.0 (once)");
  it = (await view("/api/feedback/by-item?days=30&sort=best")).json;
  ok(it.items[0].key === "paneer roll" && it.items[1].key === "masala chai" && it.items.at(-1).key === "veg momos", "best rated first: Paneer Roll, Masala Chai, then Veg Momos");
  it = (await view("/api/feedback/by-item?days=30&sort=worst")).json;
  ok(it.items[0].key === "veg momos", "worst rated first: Veg Momos");
  it = (await view("/api/feedback/by-item?days=30&search=CHAI")).json;
  ok(it.items.length === 1 && it.items[0].key === "masala chai", "search finds a dish whatever the capitals");
  it = (await view(`/api/feedback/by-item?days=30&outlets=${A2}`)).json;
  ok(it.items.length === 2 && it.items.find((i) => i.key === "veg momos").count === 1, "narrowed to the second outlet: its two dishes, momos rated once");
  it = (await view("/api/feedback/by-item?days=30&limit=1")).json;
  ok(it.items.length === 1, "a limit is respected");
  const rv = (await view("/api/feedback/by-item/Veg%20Momos?days=30")).json;
  ok(rv.reviews.length === 3 && rv.reviews[0].dishRating && rv.reviews.some((x) => x.dishNote === "was cold" && x.customerName === "Ravi Kumar" && x.orderRating === 3) && rv.reviews.some((x) => x.dishNote === "Crispy outside"), "the reviews of Veg Momos: each with the dish's stars and note beside the whole order's stars and the customer", JSON.stringify(rv.reviews[0]));
  ok(rv.reviews.every((x) => x.outlet), "…each says which outlet");
  ok((await view("/api/feedback/by-item/nothing-like-this?days=30")).json.reviews.length === 0, "an unknown dish has no reviews (not an error)");
  const list = (await view("/api/feedback?days=30")).json;
  ok(list.ratings.some((x) => x.itemRatings?.length === 2 && x.itemRatings[0].name), "the ordinary review list now carries each rating's dish ratings too");

  say("7. Who may look");
  for (const path of ["by-outlet", "by-customer", "by-item", "by-item/veg"]) {
    ok((await view(`/api/feedback/${path}`, A, cashier)).status === 403, `a cashier can't see ratings ${path}`);
    ok((await view(`/api/feedback/${path}`, A, accountant)).status === 200, `an accountant can (${path})`);
    ok((await call("GET", `/api/feedback/${path}`)).status === 401, `nobody signed in gets 401 (${path})`);
    ok((await call("GET", `/api/feedback/${path}`, { cookie: plain.owner, headers: { "x-rasoipulse-brand": plain.brand, "x-rasoipulse-outlet": plain.outlet } })).status === 403, `a store whose plan has no Ratings is refused (${path})`);
  }
  const nothing = (await call("GET", "/api/feedback/by-outlet?days=30", { cookie: other.owner, headers: { "x-rasoipulse-brand": other.brand, "x-rasoipulse-outlet": other.outlet } })).json;
  ok(nothing.total.count === 0 && nothing.outlets.every((o) => o.count === 0), "another store sees ITS OWN (empty) ratings, never this store's");
  const nothing2 = (await call("GET", "/api/feedback/by-item?days=30", { cookie: other.owner, headers: { "x-rasoipulse-brand": other.brand, "x-rasoipulse-outlet": other.outlet } })).json;
  ok(nothing2.items.length === 0, "…nor its dishes");
  ok((await view("/api/feedback/by-outlet?days=0")).status === 400 && (await view("/api/feedback/by-outlet?days=400")).status === 400, "the period must be 1 to 365 days");
  const spoof = await view(`/api/feedback/by-outlet?days=30&outlets=${other.outlet}`);
  ok(spoof.status === 403, "asking for ANOTHER store's outlet id is refused", String(spoof.status));
});
