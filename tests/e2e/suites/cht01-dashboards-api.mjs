// The numbers behind the CHT01 stacked chart in the two dashboards: the platform dashboard sends each of the last 12 months' sales split by order type,
// and a store's dashboard sends each of the last 14 days' sales split by order type. No browser — a private API, in-memory database.
import { startApi } from "./_api-harness.mjs";

const t = await startApi(3135);
const { call, ok, say } = t;

const IST = 5.5 * 3_600_000;
const nowIst = new Date(Date.now() + IST);
const y = nowIst.getUTCFullYear(), m = nowIst.getUTCMonth(); // m: 0-11
const at = (yy, mm, dd, hh) => new Date(Date.UTC(yy, mm, dd, hh) - IST); // an instant, given as an Indian wall-clock time
const keyOf = (yy, mm) => `${yy}-${String(mm + 1).padStart(2, "0")}`;
const prev = { y: m === 0 ? y - 1 : y, m: m === 0 ? 11 : m - 1 };
const today0 = Date.UTC(nowIst.getUTCFullYear(), nowIst.getUTCMonth(), nowIst.getUTCDate()) - IST;

await t.run(async () => {
  const s = await t.makeStore({ slug: "cht", ownerEmail: "o@cht.test" });
  const base = { brandId: s.brand, outletId: s.outlet, customer: { name: "Asha" }, status: "completed", lines: [{ name: "Veg Momos", quantity: 1, lineTotal: 10000 }], payment: { status: "paid", gateway: "cod" } };
  const order = (n, channel, paise, when, extra = {}) => ({ ...base, orderNumber: n, channel, totals: { grandTotal: paise }, createdAt: when, updatedAt: when, ...extra });
  const thisMonth = at(y, m, 1, 12); // the 1st of this month, noon in India: always inside this month and never in the future
  await t.db.OrderModel.collection.insertMany([
    order(1, "dine-in", 30000, thisMonth), order(2, "takeaway", 20000, thisMonth), order(3, "delivery", 10000, thisMonth), order(4, "pos", 5000, thisMonth), // "pos" is none of the three: it must land in "other"
    order(5, "dine-in", 99900, thisMonth, { status: "cancelled" }), // a cancelled order is never counted
    order(6, "takeaway", 40000, at(prev.y, prev.m, 15, 12)),
  ]);

  say("1. The platform dashboard: last 12 months, split by order type");
  const dash = await call("GET", "/api/platform/dashboard", { cookie: s.su });
  const sales = dash.json.sales ?? dash.json.dashboard?.sales;
  ok(dash.status === 200 && Array.isArray(sales?.monthlyChannels), "the dashboard sends sales.monthlyChannels", String(dash.status));
  const mc = sales.monthlyChannels;
  ok(mc.length === 12 && mc[11].key === keyOf(y, m) && mc[10].key === keyOf(prev.y, prev.m), "twelve months, the last one this month", `${mc[0]?.key} … ${mc[11]?.key}`);
  ok(mc.every((r, i) => r.key === sales.monthly[i].key && typeof r.label === "string" && typeof r.year === "number" && typeof r.month === "number"), "they line up with the 12 monthly bars: same keys, each with a label, year and month");
  const last = mc[11];
  ok(last["dine-in"] === 30000 && last.takeaway === 20000 && last.delivery === 10000 && last.other === 5000, "this month: dine-in ₹300, takeaway ₹200, delivery ₹100, anything else ₹50 (the cancelled ₹999 is not counted)", JSON.stringify(last));
  const before = mc[10];
  ok(before.takeaway === 40000 && before["dine-in"] === 0 && before.delivery === 0 && before.other === 0, "last month: takeaway ₹400 only", JSON.stringify(before));
  ok(mc.slice(0, 10).every((r) => r["dine-in"] + r.takeaway + r.delivery + r.other === 0), "the months before had no sales: all zero");
  ok(mc.every((r, i) => r["dine-in"] + r.takeaway + r.delivery + r.other === sales.monthly[i].revenue), "in every month the layers add up to that month's sales bar (so the stacked chart and the column chart agree)");

  say("2. A store's dashboard: last 14 days, split by order type");
  const day = (daysAgo, hh) => new Date(today0 - daysAgo * 86_400_000 + hh * 3_600_000);
  await t.raw("orders").deleteMany({});
  await t.db.OrderModel.collection.insertMany([
    order(11, "dine-in", 30000, day(0, 2)), order(12, "takeaway", 20000, day(0, 3)), order(13, "dine-in", 10000, day(1, 4)),
    order(14, "delivery", 50000, day(1, 5), { payment: { status: "paid", gateway: "cod" } }),
    order(15, "takeaway", 77700, day(1, 6), { payment: { status: "pending", gateway: "cod" }, status: "placed" }), // not paid: not in the trend
    order(16, "takeaway", 25000, day(13, 6)),
  ]);
  const st = await call("GET", "/api/dashboard/stats", { cookie: s.owner, headers: { "x-rasoipulse-outlet": s.outlet } });
  const tr = st.json.revenueTrend;
  ok(st.status === 200 && tr.length === 14, "the trend still has 14 days", String(tr?.length));
  ok(tr.every((r) => typeof r.channels === "object" && r.channels !== null), "every day has a channels split");
  ok(tr[13].revenue === 50000 && tr[13].channels["dine-in"] === 30000 && tr[13].channels.takeaway === 20000 && !("delivery" in tr[13].channels), "today: ₹300 dine-in + ₹200 takeaway = ₹500", JSON.stringify(tr[13]));
  ok(tr[12].revenue === 60000 && tr[12].channels["dine-in"] === 10000 && tr[12].channels.delivery === 50000 && !("takeaway" in tr[12].channels), "yesterday: ₹100 dine-in + ₹500 delivery; the unpaid ₹777 takeaway is not counted", JSON.stringify(tr[12]));
  ok(tr[0].revenue === 25000 && tr[0].channels.takeaway === 25000, "the oldest day (13 days ago) is in it too", JSON.stringify(tr[0]));
  ok(tr.every((r) => Object.values(r.channels).reduce((a, b) => a + b, 0) === r.revenue), "on every day the layers add up to that day's revenue");
  ok(tr[5].revenue === 0 && Object.keys(tr[5].channels).length === 0, "a day with no sales has an empty split, not missing data");
  ok(st.json.today.revenueYesterday === 60000, "'compared with yesterday' still reads the same trend", String(st.json.today.revenueYesterday));
});
