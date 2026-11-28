// Fills the throwaway "Saffron Table" API with 75 days of believable sales (busier weekends, a growing month), bills, coupons, a second outlet and a monthly target, so the
// Business app has something to show. It is applied only for the Business app's pictures (capture.mjs), AFTER the other apps are done: the history would otherwise show up
// in their order lists. Everything is made up and lives in the throwaway in-memory database.
import { fileURLToPath } from "node:url";
const REPO = fileURLToPath(new URL("../..", import.meta.url)).replace(/\/$/, "");
export async function seedBusiness(api) {
  const db = await import(`${REPO}/packages/db/src/index.js`);
  const { FEATURE_KEYS } = await import(`${REPO}/packages/config-schema/src/plan.js`);
  const login = async (email, password) => (await api.call("POST", "/api/auth/login", { body: { email, password } })).headers.get("set-cookie").split(";")[0];
  const su = await login("super@saffrontable.test", "Super123!");
  const owner = await login("owner@saffrontable.test", "Owner123!");
  const hdr = { "x-rasoipulse-outlet": api.outlet, "x-rasoipulse-brand": api.brand };
  const must = (r, what) => { if (r.status >= 400) console.log(`  (seed: ${what} → ${r.status} ${JSON.stringify(r.json).slice(0, 160)})`); return r; };

  // the store gets a plan with every feature (coupons, bookings, ratings …)
  const plan = must(await api.call("POST", "/api/platform/plans", { cookie: su, body: { name: "Everything", limits: { maxUsers: 20, multiOutlet: true, maxOutlets: 5, maxTables: 50 }, entitlements: { features: FEATURE_KEYS }, marketing: { monthly: 2999, yearlyDiscount: 20 } } }), "plan").json.plan;
  const stores = (await api.call("GET", "/api/platform/stores", { cookie: su })).json.stores;
  const store = stores.find((s) => /Saffron/i.test(s.name));
  if (plan) must(await api.call("PATCH", `/api/platform/stores/${store.id}/plan`, { cookie: su, body: { planId: plan.id } }), "set plan");

  // a second outlet, so the comparison screens have two to compare
  const second = must(await api.call("POST", "/api/outlets", { cookie: owner, headers: hdr, body: { name: "Delhi", slug: "delhi" } }), "second outlet").json.outlet;

  // coupons
  for (const c of [{ code: "WELCOME10", description: "10% off for new customers", discountType: "percent", value: 10, maxDiscount: 100, minOrderValue: 300 }, { code: "FLAT50", description: "₹50 off", discountType: "fixed", value: 50, minOrderValue: 400 }, { code: "OLD20", description: "Winter offer", discountType: "percent", value: 20 }])
    must(await api.call("POST", "/api/coupons", { cookie: owner, headers: hdr, body: { active: true, ...c } }), `coupon ${c.code}`);

  // history: copy the paid orders there are, over the last 75 days, a few times each, some with a coupon
  const orders = db.mongoose.connection.db.collection("orders");
  const base = (await orders.find({}).toArray()).filter((o) => o.payment?.status === "paid" || o.paymentStatus === "paid" || o.status === "completed");
  const pool = base.length ? base : await orders.find({}).limit(20).toArray();
  // fifty made-up regulars and occasional guests (and a few who stopped coming), so the Customers screens have something to say
  const FIRST = ["Aarav", "Neha", "Rohan", "Priya", "Karan", "Sita", "Mehul", "Ananya", "Vikram", "Isha", "Rahul", "Pooja", "Aditya", "Kavya", "Sanjay", "Meera", "Arjun", "Tanvi", "Nikhil", "Divya", "Harsh", "Riya", "Manish", "Simran", "Yash"];
  const LAST = ["Gupta", "Mehta", "Verma", "Sharma", "Malhotra", "Kapoor", "Singh", "Joshi", "Bansal", "Arora"];
  const customers = Array.from({ length: 50 }, (_, i) => ({ _id: new db.mongoose.Types.ObjectId(), brandId: String(api.brand), name: `${FIRST[i % 25]} ${LAST[(i * 3 + Math.floor(i / 25)) % 10]}`, phone: `98111${String(20000 + i * 137).slice(-5)}`, orderCount: 0, walletBalance: 0, createdAt: new Date(), updatedAt: new Date() }));
  const tally = new Map(customers.map((c) => [String(c._id), { n: 0, last: null }]));
  const clones = [];
  let n = 0;
  for (let day = 75; day >= 1; day--) {
    const perDay = 3 + ((day * 7) % 9) + (day < 30 ? 3 : 0) + (new Date(Date.now() - day * 86_400_000).getDay() % 6 === 0 ? 4 : 0); // busier weekends and a growing month
    for (let i = 0; i < perDay; i++) {
      const src = pool[(day + i) % pool.length];
      const at = new Date(Date.now() - day * 86_400_000 - ((11 + ((i * 3) % 12)) * 3600_000) - i * 61_000);
      const { _id, ...rest } = src;
      const factor = 0.8 + (((day * 13 + i * 7) % 9) / 10);
      // who ordered: a dozen regulars about half the time, some occasional guests, newcomers who only started this month, and some who came a while ago and stopped
      const r = (day * 17 + i * 31) % 100;
      const who = r < 55 ? customers[r % 12] : r < 72 ? customers[12 + (r % 13)] : r < 90 ? (day <= 30 ? customers[25 + (r % 12)] : customers[r % 12]) : day > 45 ? customers[37 + (r % 13)] : customers[r % 12];
      const t = tally.get(String(who._id)); t.n += 1; if (!t.last || at > t.last) t.last = at;
      const money = (v) => (typeof v === "number" ? Math.round(v * factor) : v);
      const totals = Object.fromEntries(Object.entries(src.totals ?? {}).map(([k, v]) => [k, money(v)]));
      clones.push({ ...rest, _id: new db.mongoose.Types.ObjectId(), customer: { customerId: String(who._id), name: who.name, phone: who.phone }, orderNumber: `H-${++n}`, createdAt: at, updatedAt: at, status: "completed", totals, outletId: i % 3 === 0 && second ? String(second.id ?? second._id) : String(src.outletId), ...(i % 4 === 0 ? { couponCode: i % 8 === 0 ? "WELCOME10" : "FLAT50" } : {}) });
    }
  }
  if (clones.length) await orders.insertMany(clones);
  for (const c of customers) { const t = tally.get(String(c._id)); c.orderCount = t.n; if (t.last) c.lastOrderAt = t.last; }
  await db.mongoose.connection.db.collection("customers").insertMany(customers.filter((c) => c.orderCount > 0));

  // bills and a target
  const day = (off) => new Date(Date.now() + 330 * 60_000 - off * 86_400_000).toISOString().slice(0, 10);
  const bills = [["rent", "Shop rent", 12000, 25], ["salaries", "Staff salaries", 16000, 20], ["electricity", "Electricity", 3200, 12], ["raw_materials", "Vegetables", 2400, 3], ["raw_materials", "Flour and oil", 3000, 8], ["raw_materials", "Chicken", 2800, 2], ["other", "Repairs", 900, 5], ["raw_materials", "Dairy", 1800, 1]];
  for (const [category, label, amount, off] of bills) must(await api.call("POST", "/api/analytics/expenses", { cookie: owner, headers: hdr, body: { day: day(off), amount, category, label, vendor: label.split(" ")[0] + " traders", paymentMode: "bank" } }), `bill ${label}`);
  must(await api.call("PUT", "/api/analytics/goals", { cookie: owner, headers: hdr, body: { monthlySales: 110000 } }), "goal");
  console.log(`  seeded: ${clones.length} orders, ${bills.length} bills, 3 coupons, a second outlet`);
  return { owner, hdr };
}
