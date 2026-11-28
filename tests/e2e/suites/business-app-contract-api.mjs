// The Business app's CONTRACT with the real server: for every address the app calls, the answer has the fields the app reads, with the types it
// reads them as. (A first run on a real phone found the app reading `id` where /api/outlets says `_id`; the app's own tests had made up the same
// wrong answer. This suite asks the real API, with real data, and checks the app's field list against what comes back.) No browser — a private
// API on an in-memory database.
import { startApi } from "./_api-harness.mjs";

const t = await startApi(3136);
const { call, ok, say, raw } = t;

const IST = 330 * 60_000, DAY = 86_400_000;
const istDay = (off = 0) => new Date(Date.now() + IST + off * DAY).toISOString().slice(0, 10);
const at = (off, hour = 12) => new Date(Date.parse(`${istDay(off)}T00:00:00Z`) - IST + hour * 3_600_000);

/** Check `value` against `spec`; returns a list of what does not match. spec: "string" | "number" | "boolean" | "object" | "array" | "any", a trailing "?" also allows null;
 *  { key: spec, "key?": spec } an object (a key ending in "?" may be missing); [spec] an array whose every element matches (an empty one is fine). */
function mismatches(value, spec, path = "$") {
  const kind = (v) => (v === null ? "null" : Array.isArray(v) ? "array" : typeof v);
  if (typeof spec === "string") {
    if (spec === "any") return [];
    const nullable = spec.endsWith("?");
    const want = nullable ? spec.slice(0, -1) : spec;
    if (value === null && nullable) return [];
    if (kind(value) === want) return [];
    return [`${path} should be ${spec} but is ${kind(value)}${value !== null && typeof value !== "object" ? ` (${JSON.stringify(value)})` : ""}`];
  }
  if (Array.isArray(spec)) {
    if (!Array.isArray(value)) return [`${path} should be an array but is ${kind(value)}`];
    return value.slice(0, 5).flatMap((v, i) => mismatches(v, spec[0], `${path}[${i}]`));
  }
  if (kind(value) !== "object") return [`${path} should be an object but is ${kind(value)}`];
  return Object.entries(spec).flatMap(([key, sub]) => {
    const optional = key.endsWith("?");
    const name = optional ? key.slice(0, -1) : key;
    if (!(name in value)) return optional ? [] : [`${path}.${name} is missing`];
    return mismatches(value[name], sub, `${path}.${name}`);
  });
}
const matches = (label, value, spec) => { const bad = mismatches(value, spec); ok(bad.length === 0, label, bad.slice(0, 4).join("; ")); };

const KPIS = { orders: "number", sales: "number", net: "number", tax: "number", discount: "number", coins: "number", delivery: "number", service: "number", items: "number", customers: "number", aov: "number" };
const RANGE = { from: "string", to: "string" };
const CANCEL = { placed: "number", cancelled: "number", lost: "number", rate: "number" };

await t.run(async () => {
  const s = await t.makeStore({ slug: "acme", ownerEmail: "o@acme.test", outlets: 2 });
  const [A, B] = s.outletIds;
  const hdr = { "x-rasoipulse-brand": s.brand };
  const plan = (await call("POST", "/api/platform/plans", { cookie: s.su, body: { name: "Full", limits: { maxUsers: 20, multiOutlet: true, maxOutlets: 5, maxTables: 50 }, entitlements: { features: ["takeaway", "dineInQr", "analytics", "coupons", "reservations", "feedback"] } } })).json.plan;
  await call("PATCH", `/api/platform/stores/${s.brand}/plan`, { cookie: s.su, body: { planId: plan.id } });
  await call("POST", "/api/users", { cookie: s.owner, headers: hdr, body: { email: "boss@acme.test", name: "Boss", password: "Staff123!", role: "manager", outletIds: [A] } });

  say("0. Made-up data: orders in two outlets, coupons, bookings, dishes with counted stock, ratings, a bill and a target");
  let n = 0;
  const order = (outletId, off, total, o = {}) => ({
    brandId: s.brand, outletId, orderNumber: `T-${String(++n).padStart(4, "0")}`, channel: o.channel ?? "takeaway", status: o.status ?? "completed", payment: { gateway: "cod", status: "paid" }, couponCode: o.coupon,
    createdAt: at(off, o.hour ?? 12), updatedAt: at(off, o.hour ?? 12), customer: { customerId: o.cust ?? `c${n}`, name: `Customer ${n}`, phone: `90000000${String(n).padStart(2, "0")}` },
    lines: [{ name: "Veg Momos", quantity: 2, lineTotal: Math.round(total * 0.6) }, { name: "Tea", quantity: 1, lineTotal: total - Math.round(total * 0.6) }],
    totals: { subtotal: total + (o.discount ?? 0), discount: o.discount ?? 0, taxAmount: Math.round(total * 0.05), deliveryFee: 0, grandTotal: total }, deliveredAt: at(off, 13),
  });
  await raw("orders").insertMany([order(A, -1, 45000, { coupon: "SAVE10", discount: 5000, cust: "c1" }), order(A, -2, 52000, { cust: "c2", channel: "dine-in" }), order(A, -3, 38000, { cust: "c1", channel: "delivery" }), order(B, -1, 70000, { cust: "c6" }), order(B, -12, 20000, { cust: "c8" }), order(A, -40, 30000, { cust: "c9" })]);
  await raw("coupons").insertMany([{ brandId: s.brand, outletId: A, code: "SAVE10", description: "Save", discountType: "fixed", value: 50, active: true, redemptionCount: 1, maxRedemptions: 0, createdAt: new Date(), updatedAt: new Date() }]);
  await raw("reservations").insertMany([{ brandId: s.brand, outletId: A, code: "B-1", status: "confirmed", at: at(2, 19), endsAt: at(2, 21), partySize: 4, source: "customer", event: "Birthday", note: "", tableNumber: "T5", customer: { name: "Rohit", phone: "9811111111" }, pricing: { amountPaise: 40000, prepayPaise: 20000, remainingPaise: 20000 }, payment: { status: "paid" }, history: [], createdAt: new Date(), updatedAt: new Date() }]);
  const cat = (await call("POST", "/api/menu/categories", { cookie: s.owner, headers: { "x-rasoipulse-outlet": A }, body: { name: "Mains" } })).json.category;
  const dish = async (body) => (await call("POST", "/api/menu/items", { cookie: s.owner, headers: { "x-rasoipulse-outlet": A }, body: { categoryId: cat.id, foodType: "veg", basePrice: 9000, ...body } })).json.item;
  const veg = await dish({ name: "Veg Momos", stock: { tracked: true, left: 0, daily: 20, lowAt: 5 } });
  await dish({ name: "Paneer Tikka", stock: { tracked: true, left: 4, daily: null, lowAt: 5 } });
  const off = await dish({ name: "Old Special" });
  await call("PATCH", `/api/menu/items/${off.id}`, { cookie: s.owner, headers: { "x-rasoipulse-outlet": A }, body: { isAvailable: false } });
  await raw("feedbacks").insertMany([{ brandId: s.brand, outletId: A, orderId: "o1", orderNumber: "T-0001", channel: "takeaway", rating: 5, comment: "Great", tags: ["Tasty"], items: ["2× Veg Momos"], orderTotal: 45000, customerName: "Priya", customerPhone: "9855555555", createdAt: new Date(), updatedAt: new Date() }]).catch(() => undefined);

  // sign in the way the app does
  const login = await fetch(`${t.base}/api/auth/app-login`, { method: "POST", headers: { "content-type": "application/json", "x-app-id": "business", "x-forwarded-for": "198.51.100.77" }, body: JSON.stringify({ email: s.ownerEmail, password: "Owner123!" }) });
  const lj = await login.json();
  const app = async (method, path, body, outlet = A) => {
    const r = await fetch(`${t.base}${path}`, { method, headers: { "content-type": "application/json", "x-forwarded-for": `198.51.100.${100 + Math.floor(Math.random() * 100)}`, authorization: `Bearer ${lj.token}`, "x-rasoipulse-outlet": outlet, "x-app-id": "business" }, body: body ? JSON.stringify(body) : undefined });
    const text = await r.text(); let json; try { json = JSON.parse(text); } catch { json = undefined; }
    return { status: r.status, json, text, headers: r.headers };
  };
  const Q = `from=${istDay(-29)}&to=${istDay(0)}`;

  say("1. Signing in and the outlet list");
  matches("sign-in answers token, expiry and the person with what they may do", lj, { token: "string", expiresAt: "string", user: { id: "string", email: "string", name: "string", isSuperAdmin: "boolean", role: "string?", brandId: "string?", permissions: ["string"] } });
  const outlets = await app("GET", "/api/outlets");
  matches("/api/outlets: each outlet has `_id` (not `id`), a name, a slug and its settings", outlets.json, { outlets: [{ _id: "string", name: "string", slug: "string", config: "object" }] });
  ok(outlets.json.outlets.length === 2 && outlets.json.outlets.every((o) => !("id" in o)), "…and says `_id` ONLY — the app must read `_id`", Object.keys(outlets.json.outlets[0] ?? {}).slice(0, 6).join());
  const upd = await fetch(`${t.base}/api/app-updates/check?app=business&versionCode=1`);
  matches("the update check says whether there is a newer version", await upd.json(), { updateAvailable: "boolean", force: "boolean", latest: "object?" });

  say("2. The reports (each with real data)");
  const opt = await app("GET", "/api/analytics/options");
  matches("options", opt.json, { outlets: [{ id: "string", name: "string", title: "string" }], canFinance: "boolean", canExport: "boolean", canWriteExpenses: "boolean", formats: [{ id: "string", label: "string", help: "string" }], sections: [{ id: "string", label: "string", "csv?": "boolean", "finance?": "boolean" }], defaults: { foodCostPct: "number", safetyPct: "number" }, features: ["string"], ledgerCategories: [{ key: "string", label: "string" }], paymentModes: [{ id: "string", label: "string" }] });
  const ov = await app("GET", `/api/analytics/overview?${Q}&granularity=day`);
  matches("overview", ov.json, { range: RANGE, previous: RANGE, granularity: "string", kpis: KPIS, previousKpis: KPIS, cancellations: CANCEL, previousCancellations: CANCEL, newVsRepeat: { customers: "number", newCustomers: "number", repeatCustomers: "number" }, series: [{ key: "string", sales: "number", net: "number", orders: "number" }], hourly: [{ hour: "number", sales: "number", orders: "number" }], heatmap: [["number"]], channels: [{ id: "string", sales: "number", orders: "number" }], payments: [{ id: "string", sales: "number", orders: "number" }] });
  ok(ov.json.heatmap.length === 7 && ov.json.heatmap[0].length === 24, "…its heat map is 7 weekdays × 24 hours");
  const sales = await app("GET", `/api/analytics/sales?${Q}`);
  matches("sales (by outlet, by weekday)", sales.json, { range: RANGE, granularity: "string", buckets: ["string"], perOutlet: [{ id: "string", name: "string", values: ["number"], orders: ["number"] }], weekdays: [{ name: "string", sales: "number", orders: "number", avgSales: "number", avgOrders: "number", occurrences: "number" }], channelsByOutlet: [{ channel: "string", outletId: "string", sales: "number", orders: "number" }] });
  const items = await app("GET", `/api/analytics/items?${Q}`);
  matches("items", items.json, { range: RANGE, previous: RANGE, items: [{ rank: "number", key: "string", name: "string", qty: "number", revenue: "number", orders: "number", daysSold: "number", perDay: "number", qtyShare: "number", revenueShare: "number", previousQty: "number", change: "number?" }], unsold: ["string"], totals: { qty: "number", revenue: "number" } });
  const cust = await app("GET", `/api/analytics/customers?${Q}`);
  matches("customers", cust.json, { range: RANGE, newVsRepeat: { customers: "number", newCustomers: "number", repeatCustomers: "number" }, top: [{ id: "string", name: "string", phone: "string", orders: "number", spend: "number", last: "string" }], ordersPerCustomer: [{ bucket: "string", customers: "number" }], lapsed: { days30: "number", days60: "number", days90: "number", ofAll: "number" } });
  const cmp = await app("GET", `/api/analytics/compare?${Q}`);
  matches("compare (outlets side by side)", cmp.json, { range: RANGE, days: "number", dayLabels: ["string"], outlets: [{ id: "string", name: "string", kpis: KPIS, cancelled: CANCEL, daily: ["number"], topItems: [{ name: "string", qty: "number" }], channels: [{ channel: "string", sales: "number", orders: "number" }] }] });
  const gst = await app("GET", `/api/analytics/gst?${Q}`);
  const G = { orders: "number", taxable: "number", cgst: "number", sgst: "number", tax: "number", service: "number", total: "number" };
  matches("gst", gst.json, { range: RANGE, days: [{ day: "string", ...G }], totals: G });
  const cash = await app("GET", `/api/analytics/cash?${Q}`);
  matches("cash", cash.json, { range: RANGE, rows: [{ id: "string", label: "string", orders: "number", amount: "number", discount: "number" }], collected: "number", pending: { orders: "number", amount: "number" }, cancelled: { orders: "number", amount: "number" } });
  const pnl = await app("GET", `/api/analytics/pnl?${Q}`);
  matches("pnl inputs", pnl.json, { range: RANGE, total: { sales: "number", net: "number", tax: "number", orders: "number" }, perOutlet: [{ id: "string", name: "string", ...KPIS }], recorded: [{ key: "string", label: "string", amount: "number" }] });
  const stock = await app("GET", "/api/analytics/stock");
  matches("tomorrow's prep list", stock.json, { weeks: "number", safetyPct: "number", range: RANGE, tomorrow: { day: "string", weekday: "string", items: [{ name: "string", suggested: "number", avg: "number", max: "number" }] } });
  const cp = await app("GET", `/api/analytics/coupons?${Q}`);
  matches("coupon usage", cp.json, { enabled: "boolean", range: RANGE, previous: RANGE, totals: { uses: "number", discount: "number", sales: "number", codes: "number", shareOfOrders: "number", avgOrderWithCoupon: "number", avgOrderWithoutCoupon: "number", previousUses: "number", previousDiscount: "number", usesChange: "number?", discountChange: "number?" }, coupons: [{ code: "string", description: "string", discountType: "string?", value: "number", active: "boolean", redemptionCount: "number", maxRedemptions: "number", validUntil: "string?", uses: "number", discount: "number", sales: "number", customers: "number", avgOrder: "number", avgDiscount: "number", shareOfOrders: "number", previousUses: "number", change: "number?", lastUsed: "string?" }], unused: [{ code: "string", description: "string", validUntil: "string?" }], perOutlet: [{ id: "string", name: "string", uses: "number", discount: "number" }] });
  const rs = await app("GET", `/api/analytics/reservations?${Q}`);
  matches("booking report", rs.json, { enabled: "boolean", range: RANGE, previous: RANGE, totals: { bookings: "number", previousBookings: "number", change: "number?", guests: "number", avgParty: "number", kept: "number", noShows: "number", cancelled: "number", declined: "number", noShowRate: "number", cancelRate: "number", advanceCollected: "number", refundDue: "number", bookedValue: "number", fromStaff: "number", fromCustomers: "number", upcomingWeek: "number" }, byStatus: [{ id: "string", count: "number" }], series: [{ day: "string", bookings: "number" }], weekdays: [{ name: "string", bookings: "number" }], hours: [{ hour: "number", bookings: "number" }], busiestWeekday: "string?", busiestHour: "number?", partySizes: [{ id: "string", label: "string", bookings: "number" }], events: [{ event: "string", bookings: "number" }], perOutlet: [{ id: "string", name: "string", bookings: "number" }] });
  const inv = await app("GET", "/api/analytics/inventory");
  matches("inventory", inv.json, { totals: { dishes: "number", counted: "number", notCounted: "number", out: "number", low: "number", switchedOff: "number" }, items: [{ id: "string", name: "string", category: "string", outletId: "string", outlet: "string", left: "number", daily: "number?", lowAt: "number", state: "string", available: "boolean", soldPerDay: "number", daysLeft: "number?" }], switchedOff: [{ id: "string", name: "string", outlet: "string", reason: "string" }] });
  const ins = await app("GET", `/api/analytics/insights?${Q}`);
  matches("insights", ins.json, { insights: [{ id: "string", tone: "string", title: "string", text: "string", value: "number?" }] });
  const set = await app("PUT", "/api/analytics/goals", { monthlySales: 100000 });
  const goal = await app("GET", "/api/analytics/goals");
  const GOAL = { goal: { monthlySales: "number?" }, month: { from: "string", to: "string", days: "number", elapsed: "number", left: "number" }, soFar: "number", projected: "number", pct: "number?", onTrack: "boolean?", neededPerDay: "number?", avgPerDay: "number" };
  ok(set.status === 200, "setting the monthly target works", String(set.status));
  matches("goal", goal.json, GOAL);
  const add = await app("POST", "/api/analytics/expenses", { day: istDay(-1), amount: 1250.5, category: "raw_materials", label: "Gas", vendor: "Indane", paymentMode: "cash", outletId: A });
  const EXP = { id: "string", day: "string", category: "string", categoryLabel: "string", label: "string", amount: "number", outletId: "string?", outlet: "string", vendor: "string", note: "string", paymentMode: "string", createdBy: "string", createdAt: "string" };
  ok(add.status === 201, "writing a bill down works (201)", String(add.status));
  matches("the saved bill", add.json, { expense: EXP });
  const ex = await app("GET", `/api/analytics/expenses?${Q}`);
  matches("expenses", ex.json, { range: RANGE, previous: RANGE, granularity: "string", entries: [EXP], totals: { amount: "number", entries: "number", previous: "number", change: "number?", perDay: "number" }, byCategory: [{ category: "string", label: "string", amount: "number", entries: "number", share: "number" }], byOutlet: [{ id: "string?", name: "string", amount: "number", entries: "number" }], byPaymentMode: [{ id: "string", label: "string", amount: "number" }], byVendor: [{ name: "string", amount: "number", entries: "number" }], series: [{ key: "string", amount: "number" }] });
  const put = await app("PUT", `/api/analytics/expenses/${add.json.expense.id}`, { day: istDay(-1), amount: 1300, category: "raw_materials", label: "Gas", outletId: A });
  ok(put.status === 200 && put.json.expense.amount === 1300, "changing a bill works", `${put.status}`);
  const del = await app("DELETE", `/api/analytics/expenses/${add.json.expense.id}`);
  ok(del.status === 200 && del.json.id === add.json.expense.id, "removing a bill answers its id", `${del.status} ${JSON.stringify(del.json)}`);

  say("3. People, bookings, ratings, coupons, dishes");
  const users = await app("GET", "/api/users");
  matches("/api/users", users.json, { users: [{ id: "string", email: "string", name: "string", isActive: "boolean", lastLoginAt: "string?", role: "string?", outletIds: ["string"], blockedAt: "string?", permissions: ["string"] }] });
  const made = await app("POST", "/api/users", { name: "Nina New", email: "nina@acme.test", password: "Secret12345", role: "kitchen", outletIds: [B] });
  ok(made.status === 201 && made.json.user.role === "kitchen" && made.json.user.outletIds[0] === B, "adding a person answers the person (201)", `${made.status} ${JSON.stringify(made.json).slice(0, 100)}`);
  const patched = await app("PATCH", `/api/users/${made.json.user.id}`, { isActive: false, role: "manager", outletIds: [] });
  ok(patched.status === 200 && patched.json.user.isActive === false && patched.json.user.role === "manager", "changing a person works", String(patched.status));
  const removed = await app("DELETE", `/api/users/${made.json.user.id}`);
  ok(removed.status === 204, "removing a person answers 204", String(removed.status));
  const bk = await app("GET", "/api/reservations?scope=upcoming");
  matches("upcoming bookings of the outlet", bk.json, { reservations: [{ id: "string", code: "string", status: "string", statusLabel: "string", at: "string", endsAt: "string", partySize: "number", event: "string", note: "string", tableNumber: "string", pricing: { amountPaise: "number", prepayPaise: "number", remainingPaise: "number" }, payment: { status: "string" }, customer: { name: "string", phone: "string" } }], counts: { bookings: "number", guests: "number", requested: "number", waitingAhead: "number" }, more: "boolean" });
  const fb = await app("GET", "/api/feedback?days=30&limit=30");
  matches("ratings", fb.json, { summary: { days: "number", count: "number", average: "number", byStars: { 1: "number", 2: "number", 3: "number", 4: "number", 5: "number" }, withComments: "number" }, ratings: [{ id: "string", orderId: "string", orderNumber: "string", channel: "string", rating: "number", comment: "string", tags: ["string"], items: ["string"], orderTotal: "number", customerName: "string", customerPhone: "string", createdAt: "string", updatedAt: "string" }], nextBefore: "string?" });
  const cps = await app("GET", "/api/coupons");
  const COUPON = { id: "string", code: "string", description: "string", discountType: "string", value: "number", maxDiscount: "number", minOrderValue: "number", validUntil: "string?", maxRedemptions: "number", redemptionCount: "number", active: "boolean" };
  matches("the outlet's coupons", cps.json, { coupons: [COUPON] });
  ok(cps.json.coupons.length === 1 && cps.json.coupons.every((c) => ["fixed", "percent", "bogo"].includes(c.discountType)), "…their discount type is one of fixed / percent / bogo (the app words each)", cps.json.coupons.map((c) => c.discountType).join());
  const togg = await app("PATCH", `/api/coupons/${cps.json.coupons[0].id}`, { active: false });
  matches("switching a coupon off answers the coupon", togg.json, { coupon: { id: "string", active: "boolean" } });
  ok(togg.json.coupon?.active === false, "…and it is off");
  const stk = await app("PATCH", `/api/menu/items/${veg.id}`, { stock: { tracked: true, left: 12, daily: 30, lowAt: 4 } });
  ok(stk.status === 200 && stk.json.item?.id === veg.id, "changing a dish's counted stock works and answers the dish", `${stk.status} ${JSON.stringify(stk.json).slice(0, 100)}`);
  const stk2 = await app("PATCH", `/api/menu/items/${veg.id}`, { stock: { tracked: true, left: 12, daily: null, lowAt: 4 } });
  ok(stk2.status === 200, "…and an empty 'each day' (null) is accepted", String(stk2.status));
  const inv2 = await app("GET", "/api/analytics/inventory");
  const vm = inv2.json.items.find((i) => i.name === "Veg Momos");
  ok(vm && vm.left === 12 && vm.daily === null, "…and the inventory report shows the new count", JSON.stringify(vm ?? {}).slice(0, 120));

  say("4. Report files");
  for (const [format, magic, type, ext] of [["xlsx", "PK", "spreadsheetml", "xlsx"], ["pdf", "%PDF", "pdf", "pdf"], ["csv", "", "csv", "csv"], ["json", "{", "json", "json"]]) {
    const r = await app("POST", "/api/analytics/export", { format, from: istDay(-29), to: istDay(0), outletIds: [], sections: ["summary", "daily", "items"], section: "daily", pnl: null });
    ok(r.status === 200 && r.text.startsWith(magic) && new RegExp(type).test(r.headers.get("content-type") ?? "") && new RegExp(`filename="?[^";]+\\.${ext}"?`).test(r.headers.get("content-disposition") ?? ""), `${format}: 200, the right kind of file, named .${ext} in content-disposition`, `${r.status} ${r.headers.get("content-type")} | ${r.headers.get("content-disposition")}`);
  }
});
