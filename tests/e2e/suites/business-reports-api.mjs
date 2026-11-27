// The server side of the Rasoi Pulse Business app (for store owners): who may sign in, and the reports it adds — coupon usage, table bookings,
// counted stock, plain-English insights, the sales goal, the expenses LEDGER (and profit & loss worked from it) and the Excel / PDF files that hold them.
// A private API on an in-memory database; no browser. Every expected number is worked out HERE from the orders, coupons, bookings and bills
// that were put in, independently of the server's own sums.
import ExcelJS from "exceljs";
import { startApi } from "./_api-harness.mjs";

const t = await startApi(3133);
const { call, ok, say, raw } = t;

const IST = 330 * 60_000, DAY = 86_400_000;
const istDay = (off = 0) => new Date(Date.now() + IST + off * DAY).toISOString().slice(0, 10);
const at = (off, hour = 12) => new Date(Date.parse(`${istDay(off)}T00:00:00Z`) - IST + hour * 3_600_000);
const today = istDay(0);
const range = (a, b) => `from=${istDay(a)}&to=${istDay(b)}`;
const R7 = range(-6, 0);
const sum = (a) => a.reduce((x, y) => x + y, 0);
const near = (a, b, tol = 0.001) => Math.abs(a - b) <= tol;

await t.run(async () => {
  const s = await t.makeStore({ slug: "acme", ownerEmail: "o@acme.test", outlets: 2 });
  const [A, B] = s.outletIds;
  const hdr = { "x-rasoipulse-brand": s.brand };
  const su = s.su;

  /* ---- plans: the main store has everything; a second store has analytics but no coupons / reservations */
  const mkPlan = async (name, features) => (await call("POST", "/api/platform/plans", { cookie: su, body: { name, limits: { maxUsers: 20, multiOutlet: true, maxOutlets: 5, maxTables: 50 }, entitlements: { features } } })).json.plan;
  const full = await mkPlan("Full", ["takeaway", "dineInQr", "analytics", "coupons", "reservations", "feedback"]);
  const lite = await mkPlan("Lite", ["takeaway", "analytics"]);
  const bare = await mkPlan("Bare", ["takeaway"]);
  await call("PATCH", `/api/platform/stores/${s.brand}/plan`, { cookie: su, body: { planId: full.id } });

  /* ---- people */
  const mk = (email, name, role) => call("POST", "/api/users", { cookie: s.owner, headers: hdr, body: { email, name, password: "Staff123!", role } });
  for (const [email, role] of [["boss@acme.test", "manager"], ["books@acme.test", "accountant"], ["waiter@acme.test", "staff"], ["cook@acme.test", "kitchen"]]) await mk(email, email.split("@")[0], role);
  let ip = 0;
  const appLogin = (email, app, extra = {}) => fetch(`${t.base}/api/auth/app-login`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `198.51.100.${100 + ip++}`, ...(app ? { "x-app-id": app } : {}), ...extra }, body: JSON.stringify({ email, password: /^o@/.test(email) ? "Owner123!" : "Staff123!" }) }).then(async (x) => ({ status: x.status, json: await x.json().catch(() => ({})) }));
  const asApp = (login, method, path, body) => fetch(`${t.base}${path}`, { method, headers: { "content-type": "application/json", "x-forwarded-for": `198.51.100.${100 + ip++}`, authorization: `Bearer ${login.json.token}`, "x-rasoipulse-outlet": A, "x-app-id": "business" }, body: body ? JSON.stringify(body) : undefined }).then(async (x) => ({ status: x.status, json: await x.json().catch(() => ({})), headers: x.headers, buf: null }));

  say("1. Who may sign in to the Business app (the server decides, not the app)");
  const owner = await appLogin(s.ownerEmail, "business");
  const boss = await appLogin("boss@acme.test", "business");
  const books = await appLogin("books@acme.test", "business");
  ok([owner, boss, books].every((r) => r.status === 200 && r.json.token), "the owner, a manager and an accountant can sign in", [owner, boss, books].map((r) => r.status).join(","));
  ok(owner.json.user.permissions.includes("analytics:read") && owner.json.user.permissions.includes("user:manage"), "the owner's answer lists what they may do (so the app can show only that)");
  for (const who of ["waiter@acme.test", "cook@acme.test"]) {
    const r = await appLogin(who, "business");
    ok(r.status === 403 && r.json.details?.code === "app_not_allowed" && /Rasoi Pulse Business is for store owners/.test(r.json.error ?? "") && !r.json.token, `${who.split("@")[0]} is turned away, in words`, r.json.error);
  }
  ok((await appLogin("waiter@acme.test", "oma")).status === 200 && (await appLogin("cook@acme.test", "kda")).status === 200, "the other apps' sign-ins are exactly as before (a waiter still signs in to OMA, a cook to the Kitchen app)");
  ok((await appLogin("books@acme.test", "kda")).status === 403 && /kitchen team/.test((await appLogin("books@acme.test", "kda")).json.error ?? ""), "…and the Kitchen app still says it is for the kitchen team");
  const settings = (await call("GET", "/api/platform/app-releases/settings", { cookie: su })).json.settings;
  const biz = settings.find((a) => a.app === "business");
  ok(biz && biz.name === "Rasoi Pulse Business" && biz.code === "BIZ" && biz.public === false && biz.usesRefreshInterval === false, "the console's app list names Rasoi Pulse Business (code BIZ); it starts private, so it is not on the website yet", JSON.stringify(biz ?? {}).slice(0, 140));
  const publicIds = ((await call("GET", "/api/app-updates/apps")).json.apps ?? []).map((a) => a.id);
  ok(!publicIds.includes("business") && ["oma", "kda", "rda"].every((a) => publicIds.includes(a)), "the public list still has only the staff apps", publicIds.join());

  /* ---- data: orders (two outlets), coupons, bookings, dishes with counted stock */
  say("2. Seeding made-up data (worked out independently below)");
  let n = 0;
  const order = (outletId, off, total, o = {}) => ({
    brandId: s.brand, outletId, orderNumber: `T-${String(++n).padStart(4, "0")}`, channel: o.channel ?? "takeaway", status: o.status ?? "completed",
    payment: { gateway: "cod", status: o.paid ?? "paid" }, couponCode: o.coupon, createdAt: at(off, o.hour ?? 12), updatedAt: at(off, o.hour ?? 12),
    customer: { customerId: o.cust ?? `c${n}`, name: `Customer ${o.cust ?? n}`, phone: "9000000000" },
    lines: [{ name: "Veg Momos", quantity: 2, lineTotal: Math.round(total * 0.6) }, { name: o.second ?? "Tea", quantity: 1, lineTotal: total - Math.round(total * 0.6) }],
    totals: { subtotal: total + (o.discount ?? 0), discount: o.discount ?? 0, taxAmount: 0, deliveryFee: 0, grandTotal: total },
  });
  const orders = [
    order(A, -1, 45000, { coupon: "SAVE10", discount: 5000, cust: "c1" }),
    order(A, -2, 52000, { coupon: "SAVE10", discount: 5000, cust: "c2" }),
    order(A, -3, 38000, { coupon: "save10", discount: 5000, cust: "c1" }), // lower case: the same coupon
    order(A, -5, 60000, { coupon: "WELCOME", discount: 10000, cust: "c3" }),
    order(A, -6, 80000, { cust: "c4", hour: 20 }),
    order(A, -7, 41000, { cust: "c5" }), // one day before the 7-day range
    order(A, -8, 30000, { coupon: "SAVE10", discount: 5000, status: "cancelled" }), // cancelled: not a sale
    order(A, -9, 30000, { coupon: "WELCOME", discount: 10000, paid: "pending" }), // unpaid: not a sale
    order(A, -10, 40000, { coupon: "SAVE10", discount: 5000, cust: "c1" }), // the period before
    order(B, -1, 70000, { coupon: "WELCOME", discount: 10000, cust: "c6", channel: "delivery" }),
    order(B, -4, 30000, { coupon: "SAVE10", discount: 5000, cust: "c7" }),
    order(B, -4, 20000, { cust: "c8", channel: "dine-in" }),
  ];
  await raw("orders").insertMany(orders);
  const coupon = (outletId, code, active = true) => ({ brandId: s.brand, outletId, code, description: `${code} test`, discountType: "flat", value: 5000, active, redemptionCount: 0, maxRedemptions: 0, createdAt: new Date(), updatedAt: new Date() });
  await raw("coupons").insertMany([coupon(A, "SAVE10"), coupon(A, "WELCOME"), coupon(A, "UNUSED5"), coupon(B, "SAVE10"), coupon(A, "OLD20", false)]);
  const res = (outletId, off, hour, party, status, o = {}) => ({ brandId: s.brand, outletId, code: `B-${++n}`, status, at: at(off, hour), endsAt: at(off, hour + 2), partySize: party, source: o.source ?? "customer", event: o.event ?? "", pricing: { amountPaise: o.amount ?? 0, prepayPaise: o.prepay ?? 0, couponCode: "" }, payment: { status: o.pay ?? "none" }, customer: { name: "Guest" }, createdAt: new Date(), updatedAt: new Date() });
  await raw("reservations").insertMany([
    res(A, -2, 19, 4, "completed", { amount: 40000, prepay: 20000, pay: "paid", event: "Birthday" }),
    res(A, -2, 20, 2, "no_show"),
    res(A, -3, 13, 6, "cancelled", { prepay: 10000, pay: "refund_due" }),
    res(B, -1, 21, 8, "completed", { amount: 80000, source: "staff", event: "Birthday" }),
    res(A, 2, 19, 3, "confirmed"), // next week: not in the range, counted as upcoming
    res(A, -10, 19, 2, "completed"), // the period before
  ]);
  const cat = (await call("POST", "/api/menu/categories", { cookie: s.owner, headers: { "x-rasoipulse-outlet": A }, body: { name: "Mains" } })).json.category;
  const dish = async (body) => (await call("POST", "/api/menu/items", { cookie: s.owner, headers: { "x-rasoipulse-outlet": A }, body: { categoryId: cat.id, foodType: "veg", basePrice: 9000, ...body } })).json.item;
  await dish({ name: "Veg Momos", stock: { tracked: true, left: 0, daily: 20, lowAt: 5 } });
  await dish({ name: "Paneer Tikka", stock: { tracked: true, left: 4, daily: null, lowAt: 5 } });
  await dish({ name: "Dal Makhani", stock: { tracked: true, left: 40, daily: null, lowAt: 5 } });
  await dish({ name: "Tea" });
  const off = await dish({ name: "Old Special" });
  await call("PATCH", `/api/menu/items/${off.id}`, { cookie: s.owner, headers: { "x-rasoipulse-outlet": A }, body: { isAvailable: false } });
  ok((await raw("orders").countDocuments({ brandId: s.brand })) === orders.length && (await raw("coupons").countDocuments({})) === 5, "the made-up orders, coupons and bookings are in");

  say("3. Business app options: what the plan includes and what the person may do");
  const opt = await asApp(owner, "GET", "/api/analytics/options");
  ok(opt.status === 200 && opt.json.features.includes("coupons") && opt.json.features.includes("reservations") && opt.json.canFinance && opt.json.canExport && opt.json.canWriteExpenses, "the owner's options list the plan's features and that money, files and expenses are allowed", JSON.stringify(opt.json.features));
  ok(opt.json.outlets.length === 2 && opt.json.ledgerCategories.some((c) => c.key === "raw_materials") && opt.json.paymentModes.length === 5, "…the outlets, the expense categories and the payment methods");
  ok(opt.json.sections.some((x) => x.id === "coupons") && opt.json.sections.some((x) => x.id === "reservations") && opt.json.sections.some((x) => x.id === "expenses" && x.finance), "the report sections now include coupons, reservations and (a money figure) expenses");
  const bossOpt = await asApp(boss, "GET", "/api/analytics/options");
  ok(bossOpt.status === 200 && !bossOpt.json.canFinance && !bossOpt.json.canWriteExpenses, "a manager sees analytics but not money figures, and can't write expenses");

  say("4. Coupon usage");
  const cu = await asApp(owner, "GET", `/api/analytics/coupons?${R7}`);
  const c = cu.json;
  ok(cu.status === 200 && c.enabled && c.totals.uses === 6 && c.totals.discount === 40000 && c.totals.sales === 295000, "6 orders used a coupon in the last 7 days: ₹400 given away on ₹2,950 of sales (cancelled, unpaid and older orders left out)", JSON.stringify(c.totals));
  const save = c.coupons.find((x) => x.code === "SAVE10"), wel = c.coupons.find((x) => x.code === "WELCOME");
  ok(save.uses === 4 && save.discount === 20000 && save.sales === 165000 && save.customers === 3 && save.avgOrder === 41250, "SAVE10 (also typed in lower case) was used 4 times by 3 customers: ₹200 given, ₹1,650 of sales", JSON.stringify(save).slice(0, 160));
  ok(wel.uses === 2 && wel.discount === 20000 && wel.sales === 130000, "WELCOME: 2 uses, ₹200 given, ₹1,300 of sales");
  ok(c.coupons[0].code === "SAVE10", "the most used coupon comes first");
  ok(near(c.totals.shareOfOrders, 6 / 8) && c.totals.avgOrderWithCoupon === 49167 && c.totals.avgOrderWithoutCoupon === 50000, "75% of the 8 orders used a coupon; an order with a coupon averaged ₹491.67, one without ₹500");
  ok(c.totals.previousUses === 1 && c.totals.usesChange === 500 && save.previousUses === 1 && save.change === 300, "against the period before (1 use): all coupons up 500%, SAVE10 alone up 300%");
  ok(c.unused.map((x) => x.code).join() === "UNUSED5", "a coupon that is switched on but nobody used is listed as unused (a switched-off one is not)", c.unused.map((x) => x.code).join());
  ok(c.perOutlet.find((o) => o.id === A).uses === 4 && c.perOutlet.find((o) => o.id === B).uses === 2, "by outlet: 4 uses at one, 2 at the other");
  const cuB = (await asApp(owner, "GET", `/api/analytics/coupons?${R7}&outlets=${B}`)).json;
  ok(cuB.totals.uses === 2 && cuB.coupons.find((x) => x.code === "SAVE10").uses === 1, "choosing only the second outlet shows only its coupon uses");
  ok((await asApp(boss, "GET", `/api/analytics/coupons?${R7}`)).status === 200, "a manager can read coupon usage");
  ok((await asApp(owner, "GET", "/api/analytics/coupons?from=2026-02-30&to=2026-03-01")).status === 400 && (await asApp(owner, "GET", "/api/analytics/coupons")).status === 400, "a bad or missing date range is refused (400)");

  say("5. Table reservations");
  const rv = (await asApp(owner, "GET", `/api/analytics/reservations?${R7}`)).json;
  const T = rv.totals;
  ok(rv.enabled && T.bookings === 4 && T.guests === 20 && T.avgParty === 5 && T.kept === 2 && T.noShows === 1 && T.cancelled === 1, "4 bookings for 20 guests (average party 5): 2 came, 1 no-show, 1 cancelled", JSON.stringify(T).slice(0, 200));
  ok(near(T.noShowRate, 0.25) && T.advanceCollected === 20000 && T.refundDue === 10000 && T.bookedValue === 120000, "no-show rate 25%; ₹200 advance collected, ₹100 to refund; ₹1,200 of bookings that count");
  ok(T.upcomingWeek === 1 && T.fromStaff === 1 && T.fromCustomers === 3 && T.previousBookings === 1 && T.change === 300, "1 booking coming up this week; 1 taken by staff; up 300% on the period before");
  const sizes = Object.fromEntries(rv.partySizes.map((p) => [p.id, p.bookings]));
  ok(sizes["1-2"] === 1 && sizes["3-4"] === 1 && sizes["5-6"] === 1 && sizes["7+"] === 1, "party sizes: one booking in each band");
  ok(rv.events[0].event === "Birthday" && rv.events[0].bookings === 2, "the most common reason is a Birthday (2)");
  const wd = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date(`${istDay(-2)}T12:00:00Z`).getUTCDay()];
  ok(rv.busiestWeekday === wd && rv.series.length === 7 && rv.series.find((x) => x.day === istDay(-2)).bookings === 2, "the busiest day is the one with 2 bookings; the chart has a point for each of the 7 days", rv.busiestWeekday);
  ok(rv.perOutlet.find((o) => o.id === A).bookings === 3 && rv.perOutlet.find((o) => o.id === B).bookings === 1, "by outlet: 3 and 1");

  say("6. Counted stock");
  const inv = (await asApp(owner, "GET", "/api/analytics/inventory")).json;
  ok(inv.totals.counted === 3 && inv.totals.notCounted === 2 && inv.totals.out === 1 && inv.totals.low === 1 && inv.totals.switchedOff === 1, "3 dishes are counted (1 out, 1 low), 2 are not, 1 is switched off", JSON.stringify(inv.totals));
  ok(inv.items.map((i) => i.state).join() === "out,low,ok" && inv.items[0].name === "Veg Momos" && inv.items[1].name === "Paneer Tikka", "the riskiest are first: out of stock, then low, then fine");
  const soldMomos = sum(orders.filter((o) => o.status !== "cancelled" && o.payment.status === "paid" && o.createdAt >= at(-7, 0) && o.createdAt < at(0, 0)).map(() => 2));
  ok(inv.items[0].soldPerDay === Math.round((soldMomos / 7) * 10) / 10 && inv.items[2].daysLeft === null, "Veg Momos sells about the number of portions worked out from the last 7 days; a dish nobody ordered has no 'days left'", String(inv.items[0].soldPerDay));
  ok(inv.switchedOff[0].name === "Old Special", "the switched-off dish is named");
  ok(!JSON.stringify(inv).includes("Tea"), "a dish whose stock is not counted is only counted, not listed");

  say("7. Insights in plain words");
  const ins = (await asApp(owner, "GET", `/api/analytics/insights?${R7}`)).json.insights;
  const by = Object.fromEntries(ins.map((i) => [i.id, i]));
  const inRange = orders.filter((o) => o.status !== "cancelled" && o.payment.status === "paid" && o.createdAt >= at(-6, 0) && o.createdAt < at(1, 0));
  const prevRange = orders.filter((o) => o.status !== "cancelled" && o.payment.status === "paid" && o.createdAt >= at(-13, 0) && o.createdAt < at(-6, 0));
  const salesNow = sum(inRange.map((o) => o.totals.grandTotal)), salesBefore = sum(prevRange.map((o) => o.totals.grandTotal));
  const change = Math.round(((salesNow - salesBefore) / salesBefore) * 1000) / 10;
  ok(by["sales-trend"] && by["sales-trend"].value === change && by["sales-trend"].tone === (change > 0 ? "good" : "warn"), `the sales insight says sales are ${change > 0 ? "up" : "down"} ${Math.abs(change)}% on the period before`, JSON.stringify(by["sales-trend"] ?? ins.map((i) => i.id)));
  ok(by["top-item"]?.title === "Veg Momos is your best seller", "the best seller is named", by["top-item"]?.title);
  ok(by.stock?.tone === "warn" && /Veg Momos/.test(by.stock.text), "a warning says dishes are out or low, naming them");
  ok(by.coupons?.title.includes("SAVE10"), "the most used coupon is mentioned");
  ok(ins.length <= 10 && ins.every((i) => i.title && i.text && ["good", "warn", "info"].includes(i.tone)), "every insight has a title, a sentence and a tone");
  const quiet = (await asApp(owner, "GET", `/api/analytics/insights?${range(-400, -380)}`)).json.insights;
  ok(quiet.length === 1 && quiet[0].id === "quiet", "with no orders in the dates it says so, instead of making things up");

  say("8. A plan without coupons or bookings simply leaves them out");
  const s2 = await t.makeStore({ slug: "beta", ownerEmail: "o@beta.test", outlets: 1 });
  await call("PATCH", `/api/platform/stores/${s2.brand}/plan`, { cookie: su, body: { planId: lite.id } });
  const lo = await appLogin("o@beta.test", "business");
  const asLite = (path) => fetch(`${t.base}${path}`, { headers: { authorization: `Bearer ${lo.json.token}`, "x-rasoipulse-outlet": s2.outlet, "x-forwarded-for": `198.51.100.${100 + ip++}` } }).then(async (x) => ({ status: x.status, json: await x.json().catch(() => ({})) }));
  ok((await asLite(`/api/analytics/coupons?${R7}`)).json.enabled === false && (await asLite(`/api/analytics/reservations?${R7}`)).json.enabled === false, "a store whose plan lacks coupons and reservations gets { enabled: false } (the app hides those sections)");
  ok((await asLite("/api/analytics/options")).json.features.join() === "takeaway,analytics" || !(await asLite("/api/analytics/options")).json.features.includes("coupons"), "its options do not list coupons");
  await call("PATCH", `/api/platform/stores/${s2.brand}/plan`, { cookie: su, body: { planId: bare.id } });
  const noAn = await asLite(`/api/analytics/insights?${R7}`);
  ok(noAn.status === 403 && /isn't included in your plan/.test(noAn.json.error ?? ""), "a store whose plan has no analytics is told so (403), in words", noAn.json.error);

  say("9. The expenses ledger");
  const ex = (body) => asApp(owner, "POST", "/api/analytics/expenses", body);
  const bad = async (body, label) => { const r = await ex(body); ok(r.status === 400, label, `${r.status} ${r.json.error ?? ""}`.slice(0, 110)); };
  await bad({ day: today, amount: 0, category: "rent" }, "an amount of 0 is refused");
  await bad({ day: today, amount: -5, category: "rent" }, "a negative amount is refused");
  await bad({ day: today, amount: 10.005, category: "rent" }, "a fraction of a paisa is refused");
  await bad({ day: today, amount: 99_999_999, category: "rent" }, "an absurd amount is refused");
  await bad({ day: "yesterday", amount: 100, category: "rent" }, "a date that is not a date is refused");
  await bad({ day: today, amount: 100 }, "a missing category is refused");
  await bad({ day: today, amount: 100, category: "rent", outletId: "000000000000000000000000" }, "an outlet that is not the store's is refused");
  await bad({ day: today, amount: 100, category: "rent", note: "x".repeat(301) }, "a very long note is refused");
  const e1 = await ex({ day: istDay(-1), amount: 1250.5, category: "raw_materials", label: "Vegetables", vendor: "Sabzi Mandi", paymentMode: "cash", outletId: A });
  ok(e1.status === 201 && e1.json.expense.amount === 1250.5 && e1.json.expense.categoryLabel === "Raw materials & groceries" && e1.json.expense.outlet && e1.json.expense.createdBy, "an expense is written (rupees in, rupees out, paise kept exactly), with its outlet and who wrote it", JSON.stringify(e1.json).slice(0, 160));
  const e2 = await ex({ day: istDay(-2), amount: 30000, category: "rent", label: "November rent", paymentMode: "bank" });
  ok(e2.status === 201 && e2.json.expense.outlet === "Whole store" && e2.json.expense.outletId === null, "an expense with no outlet is a cost of the whole store");
  const e3 = await ex({ day: istDay(-3), amount: 4800, category: "electricity", outletId: B, paymentMode: "upi", vendor: "Power Co" });
  const e4 = await ex({ day: istDay(-4), amount: 700, category: "raw_materials", outletId: A, vendor: "sabzi mandi", paymentMode: "cash" });
  const e5 = await ex({ day: istDay(-10), amount: 1000, category: "raw_materials", outletId: A }); // the period before
  const L = (await asApp(owner, "GET", `/api/analytics/expenses?${R7}`)).json;
  const spent = 1250.5 + 30000 + 4800 + 700;
  ok(L.totals.amount === spent && L.totals.entries === 4 && L.entries.length === 4 && L.entries[0].day === istDay(-1), "the ledger adds up (₹36,750.50 over 4 bills) and lists the newest first", JSON.stringify(L.totals));
  ok(L.totals.previous === 1000 && L.totals.change === Math.round(((spent - 1000) / 1000) * 1000) / 10, "against the period before it is compared", String(L.totals.change));
  ok(L.byCategory[0].category === "rent" && L.byCategory[0].amount === 30000 && near(L.byCategory[0].share, 30000 / spent, 0.0001) && L.byCategory.find((x) => x.category === "raw_materials").amount === 1950.5, "by category: rent first, raw materials ₹1,950.50, each with its share");
  ok(L.byPaymentMode.find((m) => m.id === "cash").amount === 1950.5 && L.byPaymentMode.find((m) => m.id === "bank").amount === 30000, "by payment method");
  ok(L.byVendor.find((v) => v.name.toLowerCase() === "sabzi mandi").amount === 1950.5 && L.byVendor.find((v) => v.name.toLowerCase() === "sabzi mandi").entries === 2, "by vendor (the same shop typed in two ways is one vendor)");
  ok(L.series.length === 7 && sum(L.series.map((p) => p.amount)) === spent && L.series.find((p) => p.key === istDay(-2)).amount === 30000, "the chart has a point a day and they add up to the total");
  ok(L.byOutlet.find((o) => o.id === null).amount === 30000 && L.byOutlet.find((o) => o.id === A).amount === 1950.5, "by outlet, with the whole-store costs on their own line");
  const LB = (await asApp(owner, "GET", `/api/analytics/expenses?${R7}&outlets=${B}`)).json;
  ok(LB.totals.amount === 4800 && LB.entries.length === 1, "choosing one outlet shows only its bills (the whole-store rent is left out)");
  const LC = (await asApp(owner, "GET", `/api/analytics/expenses?${R7}&category=rent`)).json;
  ok(LC.entries.length === 1 && LC.totals.amount === 30000, "a category can be picked");
  const up = await asApp(owner, "PUT", `/api/analytics/expenses/${e1.json.expense.id}`, { day: istDay(-1), amount: 1300, category: "raw_materials", label: "Vegetables + milk", outletId: A, paymentMode: "upi" });
  ok(up.status === 200 && up.json.expense.amount === 1300 && up.json.expense.paymentMode === "upi" && up.json.expense.label === "Vegetables + milk", "an expense can be corrected");
  ok((await asApp(owner, "PUT", "/api/analytics/expenses/000000000000000000000000", { day: today, amount: 5, category: "rent" })).status === 404 && (await asApp(owner, "DELETE", "/api/analytics/expenses/nope")).status === 404, "a bill that is not there is a 404");
  const del = await asApp(owner, "DELETE", `/api/analytics/expenses/${e4.json.expense.id}`);
  ok(del.status === 200 && (await asApp(owner, "GET", `/api/analytics/expenses?${R7}`)).json.totals.amount === spent + 49.5 - 700, "a wrong bill is taken off, and the total follows (the earlier correction to ₹1,300 included)");
  const bks = await asApp(books, "POST", "/api/analytics/expenses", { day: today, amount: 250, category: "other", label: "Soap" });
  ok(bks.status === 201 && bks.json.expense.createdBy === "books", "an accountant can write a bill");
  ok((await asApp(boss, "GET", `/api/analytics/expenses?${R7}`)).status === 403 && (await asApp(boss, "POST", "/api/analytics/expenses", { day: today, amount: 5, category: "rent" })).status === 403, "a manager can neither read nor write the ledger (money figures) — 403");
  const waiterLogin = await appLogin("waiter@acme.test", "oma");
  ok((await asApp(waiterLogin, "GET", `/api/analytics/expenses?${R7}`)).status === 403 && (await asApp(waiterLogin, "GET", `/api/analytics/coupons?${R7}`)).status === 403, "a waiter can't read any of it (403)");
  ok((await fetch(`${t.base}/api/analytics/expenses?${R7}`, { headers: { "x-rasoipulse-outlet": A } })).status === 401, "not signed in: 401");

  say("10. Profit & loss from the recorded bills");
  const pnl = (await asApp(owner, "GET", `/api/analytics/pnl?${R7}`)).json;
  const recSum = (await asApp(owner, "GET", `/api/analytics/expenses?${R7}`)).json.totals.amount;
  ok(Array.isArray(pnl.recorded) && near(sum(pnl.recorded.map((r) => r.amount)), recSum, 0.01) && pnl.recorded.some((r) => r.key === "rent" && r.label === "Rent"), "the profit & loss answer carries the bills recorded for the range, by category", JSON.stringify(pnl.recorded).slice(0, 140));
  const rep = await asApp(owner, "POST", "/api/analytics/export", { format: "json", from: istDay(-6), to: istDay(0), sections: ["pnl"], pnl: { foodCostPct: 30, mode: "recorded" } });
  const rows = rep.json.sections?.pnl?.rows ?? [];
  const lineOf = (re) => rows.find((r) => re.test(r.line))?.amount;
  const netSales = sum(inRange.map((o) => o.totals.grandTotal)) / 100;
  ok(near(lineOf(/Net sales/), netSales, 0.01) && near(lineOf(/Food cost/), -netSales * 0.3, 0.01) && near(lineOf(/Total expenses/), -recSum, 0.01) && near(lineOf(/NET PROFIT/), netSales * 0.7 - recSum, 0.02), "worked from the ledger: net sales − 30% food cost − the recorded bills = net profit (arithmetic done separately)", `${lineOf(/NET PROFIT/)} vs ${netSales * 0.7 - recSum}`);
  ok(rows.some((r) => r.line === "Rent" && r.amount === -30000), "each recorded category is a line of its own");
  const monthly = await asApp(owner, "POST", "/api/analytics/export", { format: "json", from: istDay(-6), to: istDay(0), sections: ["pnl"], pnl: { foodCostPct: 30, expenses: [{ label: "Rent", monthly: 30000 }] } });
  ok(monthly.json.sections.pnl.rows.some((r) => r.line === "Rent"), "the old way (monthly estimates typed in) still works exactly as before");

  say("11. Reports as files: Excel and PDF");
  const file = async (body, login = owner) => { const r = await fetch(`${t.base}/api/analytics/export`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${login.json.token}`, "x-rasoipulse-outlet": A, "x-forwarded-for": `198.51.100.${100 + ip++}` }, body: JSON.stringify(body) }); return { status: r.status, type: r.headers.get("content-type"), disp: r.headers.get("content-disposition"), buf: Buffer.from(await r.arrayBuffer()) }; };
  const all = ["summary", "daily", "items", "coupons", "reservations", "expenses", "pnl"];
  const xl = await file({ format: "xlsx", from: istDay(-6), to: istDay(0), sections: all, pnl: { foodCostPct: 30, mode: "recorded" } });
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(xl.buffer ?? xl.buf);
  const names = wb.worksheets.map((w) => w.name);
  ok(xl.status === 200 && /spreadsheetml/.test(xl.type) && /\.xlsx/.test(xl.disp ?? ""), "Excel: a real .xlsx file comes back");
  ok(["Summary", "Coupon usage", "Table reservations", "Expenses recorded", "Profit & loss"].every((x) => names.includes(x)), "…with a sheet for each section asked for, including the new ones", names.join(" | "));
  const cs = wb.getWorksheet("Coupon usage");
  const csRows = []; cs.eachRow((r, i) => { if (i > 1) csRows.push(r.values.slice(1)); });
  ok(csRows[0][0] === "SAVE10" && csRows[0][1] === 4 && near(csRows[0][2], 200) && near(csRows[0][3], 1650), "the Coupon usage sheet: SAVE10 used 4 times, ₹200 given, ₹1,650 of sales", JSON.stringify(csRows[0]));
  const es = wb.getWorksheet("Expenses recorded"); let lastRow; es.eachRow((r) => { lastRow = r.values.slice(1); });
  ok(lastRow[0] === "Total" && near(lastRow[6], recSum, 0.01), "the Expenses sheet ends with a total equal to the ledger");
  const pdf = await file({ format: "pdf", from: istDay(-6), to: istDay(0), sections: ["summary", "coupons", "reservations", "expenses"] });
  ok(pdf.status === 200 && pdf.buf.subarray(0, 5).toString() === "%PDF-" && pdf.buf.length > 1000 && /\.pdf/.test(pdf.disp ?? ""), "PDF: a real PDF file comes back", `${pdf.buf.length} bytes`);
  const csv = await file({ format: "csv", from: istDay(-6), to: istDay(0), section: "coupons" });
  ok(csv.status === 200 && /Coupon,Times used/.test(csv.buf.toString()) && /SAVE10,4/.test(csv.buf.toString()), "CSV: the coupons table");
  const denied = await file({ format: "xlsx", from: istDay(-6), to: istDay(0), sections: ["expenses"] }, boss);
  ok(denied.status === 403, "a manager can't download a report with money figures (403)");
  const bossAny = await file({ format: "xlsx", from: istDay(-6), to: istDay(0), sections: ["summary", "coupons"] }, boss);
  ok(bossAny.status === 403, "…and a manager can't download any report file (files are for owners and accountants)");
  const nothing = await file({ format: "xlsx", from: "2026-02-30", to: "2026-03-01", sections: ["summary"] });
  ok(nothing.status === 400, "a bad range in a report request is refused (400)");

  say("12. The monthly sales goal");
  const g0 = (await asApp(owner, "GET", "/api/analytics/goals")).json;
  ok(g0.goal.monthlySales === null && g0.pct === null && g0.onTrack === null, "no goal yet: nothing is claimed");
  const g1 = await asApp(owner, "PUT", "/api/analytics/goals", { monthlySales: 500000 });
  const thisMonth = orders.filter((o) => o.status !== "cancelled" && o.payment.status === "paid" && istDay(0).slice(0, 7) === new Date(o.createdAt.getTime() + IST).toISOString().slice(0, 7) && o.createdAt < at(1, 0));
  const soFar = sum(thisMonth.map((o) => o.totals.grandTotal)) / 100;
  ok(g1.status === 200 && g1.json.goal.monthlySales === 500000 && near(g1.json.soFar, soFar, 0.01), "the goal is saved, and 'so far this month' equals the paid orders of this month", `${g1.json.soFar} vs ${soFar}`);
  ok(near(g1.json.pct, Math.round((soFar / 500000) * 1000) / 10, 0.11) && g1.json.month.elapsed === Number(today.slice(8)) && g1.json.avgPerDay === Math.round(soFar / Number(today.slice(8))), "…the percentage reached and the daily average are worked out");
  ok(g1.json.neededPerDay === (g1.json.month.left > 0 ? Math.max(0, Math.round((500000 - soFar) / g1.json.month.left)) : null), "…and what is needed per remaining day");
  ok((await asApp(boss, "GET", "/api/analytics/goals")).status === 200 && (await asApp(boss, "PUT", "/api/analytics/goals", { monthlySales: 1 })).status === 403, "a manager can see the goal but not change it");
  ok((await asApp(owner, "PUT", "/api/analytics/goals", { monthlySales: -5 })).status === 400, "a negative goal is refused");
  ok((await asApp(owner, "PUT", "/api/analytics/goals", { monthlySales: null })).json.goal.monthlySales === null, "the goal can be cleared");

  say("13. The older analytics and the other apps are untouched");
  const ov = (await asApp(owner, "GET", `/api/analytics/overview?${R7}`)).json;
  ok(ov.kpis.orders === inRange.length && ov.kpis.sales === salesNow, "the overview still counts the same orders and sales as before", `${ov.kpis.orders}/${ov.kpis.sales}`);
  const expSections = (await asApp(owner, "GET", "/api/analytics/options")).json.sections.map((x) => x.id);
  ok(["summary", "daily", "hourly", "items", "channels", "payments", "gst", "outlets", "customers", "orders", "pnl"].every((id) => expSections.includes(id)), "every report section that existed before is still there");
  const dashLogin = await call("GET", "/api/analytics/overview?" + R7, { cookie: s.owner, headers: { "x-rasoipulse-outlet": A } });
  ok(dashLogin.status === 200, "the store dashboard (browser cookie) reads analytics exactly as before");
});

t.finish();
