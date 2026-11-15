import { planMarketingSchema, planPrices } from "@onetap/config-schema";
import {
  CustomerModel,
  LeadModel,
  LoginLogModel,
  MenuItemModel,
  OrderModel,
  OutletModel,
  PaymentCredentialModel,
  PlanModel,
  TableModel,
  UserModel,
} from "@onetap/db";
import { cache } from "../cache/cache.js";
import { listStores } from "./platform.service.js";

/**
 * The platform dashboard: what is happening across every store — sales going
 * through TablePe month by month, how this month and year compare with the
 * last, which stores sell the most, how many stores are set up, and what the
 * subscriptions add up to.
 *
 * Two different "revenue"s, kept apart on purpose:
 *   sales          the value of orders customers placed with the stores
 *                  (cancelled ones left out). Real data, from the orders.
 *   subscriptions  what the stores pay TablePe, ESTIMATED from each plan's
 *                  listed monthly price × the stores on it. There is no
 *                  billing in the app yet, so there are no payment records
 *                  and no history — only today's picture.
 *
 * Months and days are Indian calendar months and days (Asia/Kolkata), the
 * time zone the restaurants trade in. Money is in paise (÷100 for rupees).
 *
 * The result is cached (see modules/cache) and thrown away whenever a store,
 * plan or outlet changes; `fresh` recomputes it on demand.
 */

const TZ = "Asia/Kolkata";
const IST_OFFSET_MS = 330 * 60_000; // UTC+5:30, no daylight saving
const DAY_MS = 24 * 3_600_000;
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Calendar parts of a moment as seen in India. */
function istParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

/** The instant an Indian calendar day begins. Out-of-range months/days roll over (month 0 = December before). */
const istStart = (y, m, d = 1) => new Date(Date.UTC(y, m - 1, d) - IST_OFFSET_MS);
const monthKey = (y, m) => `${y}-${String(m).padStart(2, "0")}`;
/** "2026-11" for a moment, in Indian time. */
const monthKeyOf = (date) => {
  const { y, m } = istParts(date);
  return monthKey(y, m);
};
const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const addMonths = (y, m, n) => {
  const t = y * 12 + (m - 1) + n;
  return { y: Math.floor(t / 12), m: (t % 12) + 1 };
};
/** Change from `prev` to `cur`, as a percentage with one decimal; null when there is nothing to compare with. */
const pct = (cur, prev) => (prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : null);

const bucket = (format) => ({ $dateToString: { format, date: "$createdAt", timezone: TZ } });
const SUMS = { orders: { $sum: 1 }, revenue: { $sum: "$totals.grandTotal" } };
const LIVE_ORDERS = { status: { $ne: "cancelled" } };

const sumBy = (rows, pick) => {
  const map = new Map();
  for (const row of rows) map.set(pick(row._id), { orders: row.orders, revenue: row.revenue });
  return map;
};

async function build() {
  const { y, m, d } = istParts();
  const prev = addMonths(y, m, -1);
  const thisKey = monthKey(y, m);
  const prevKey = monthKey(prev.y, prev.m);
  const since30d = new Date(Date.now() - 30 * DAY_MS);

  // Sales are counted for the stores that exist. (Deleting a store removes its orders; this also keeps the
  // totals equal to the sum of the stores shown even if some stray orders were ever left behind.)
  const stores = await listStores();
  const ofStores = { brandId: { $in: stores.map((s) => s.id) } };

  const [monthlyRows, dailyRows, storeRows, channelRows, lastYearPartial, outletCount, peopleCount, customerCount, plans, withMenu, withTables, withPayments, activeIds, newLeads] =
    await Promise.all([
      // 5 years of months, for the yearly bars, the 12-month chart and year-on-year
      OrderModel.aggregate([{ $match: { createdAt: { $gte: istStart(y - 4, 1) }, ...LIVE_ORDERS, ...ofStores } }, { $group: { _id: bucket("%Y-%m"), ...SUMS } }]),
      // this month and last, day by day
      OrderModel.aggregate([{ $match: { createdAt: { $gte: istStart(prev.y, prev.m) }, ...LIVE_ORDERS, ...ofStores } }, { $group: { _id: bucket("%Y-%m-%d"), ...SUMS } }]),
      // per store, with "the same days" of the month too: this month is only part-way through, so it must be compared with last month's first days, not all of it
      OrderModel.aggregate([
        { $match: { createdAt: { $gte: istStart(prev.y, prev.m) }, ...LIVE_ORDERS, ...ofStores } },
        {
          $group: {
            _id: { brandId: "$brandId", month: bucket("%Y-%m") },
            ...SUMS,
            toDate: { $sum: { $cond: [{ $lte: [{ $dayOfMonth: { date: "$createdAt", timezone: TZ } }, d] }, "$totals.grandTotal", 0] } },
          },
        },
      ]),
      OrderModel.aggregate([{ $match: { createdAt: { $gte: istStart(prev.y, prev.m) }, ...LIVE_ORDERS, ...ofStores } }, { $group: { _id: { channel: "$channel", month: bucket("%Y-%m") }, ...SUMS } }]),
      // the same stretch of the month last year, for a fair year-to-date comparison
      OrderModel.aggregate([{ $match: { createdAt: { $gte: istStart(y - 1, m), $lt: istStart(y - 1, m, d + 1) }, ...LIVE_ORDERS, ...ofStores } }, { $group: { _id: null, ...SUMS } }]),
      OutletModel.countDocuments({}).setOptions({ allowGlobalQuery: true }),
      UserModel.countDocuments({ isSuperAdmin: { $ne: true }, "memberships.0": { $exists: true } }),
      CustomerModel.countDocuments({}).setOptions({ allowGlobalQuery: true }),
      PlanModel.find({}).lean(),
      MenuItemModel.distinct("brandId"),
      TableModel.distinct("brandId"),
      PaymentCredentialModel.distinct("brandId"),
      OrderModel.distinct("brandId", { createdAt: { $gte: since30d }, ...ofStores }),
      LeadModel.countDocuments({ status: "new" }),
    ]);

  /* ------------------------------------------------------------- sales */
  const months = sumBy(monthlyRows, (id) => id);
  const at = (k) => months.get(k) ?? { orders: 0, revenue: 0 };

  const monthly = Array.from({ length: 12 }, (_, i) => {
    const t = addMonths(y, m, i - 11);
    const before = addMonths(t.y, t.m, -1);
    const row = { key: monthKey(t.y, t.m), year: t.y, month: t.m, label: MONTH_NAMES[t.m - 1], ...at(monthKey(t.y, t.m)) };
    // how this month's sales compare with the month before it (the "progress / downfall" bars)
    return { ...row, changePct: pct(row.revenue, at(monthKey(before.y, before.m)).revenue) };
  });

  const yearly = Array.from({ length: 5 }, (_, i) => {
    const year = y - 4 + i;
    let orders = 0;
    let revenue = 0;
    for (let month = 1; month <= 12; month++) {
      const row = at(monthKey(year, month));
      orders += row.orders;
      revenue += row.revenue;
    }
    return { year, orders, revenue };
  }).map((row, i, all) => ({ ...row, changePct: i === 0 ? null : pct(row.revenue, all[i - 1].revenue) }));

  const yearOverYear = {
    thisYear: Array.from({ length: 12 }, (_, i) => (i + 1 <= m ? at(monthKey(y, i + 1)).revenue : null)),
    lastYear: Array.from({ length: 12 }, (_, i) => at(monthKey(y - 1, i + 1)).revenue),
  };

  const daily = sumBy(dailyRows, (id) => id);
  const dayRevenue = (yy, mm, dd) => daily.get(`${monthKey(yy, mm)}-${String(dd).padStart(2, "0")}`)?.revenue ?? 0;
  const dayOrders = (yy, mm, dd) => daily.get(`${monthKey(yy, mm)}-${String(dd).padStart(2, "0")}`)?.orders ?? 0;
  const dailySeries = {
    current: Array.from({ length: daysIn(y, m) }, (_, i) => (i + 1 <= d ? dayRevenue(y, m, i + 1) : null)),
    previous: Array.from({ length: daysIn(prev.y, prev.m) }, (_, i) => dayRevenue(prev.y, prev.m, i + 1)),
  };

  const thisMonth = at(thisKey);
  let prevSamePeriod = { orders: 0, revenue: 0 };
  for (let day = 1; day <= Math.min(d, daysIn(prev.y, prev.m)); day++) {
    prevSamePeriod = { orders: prevSamePeriod.orders + dayOrders(prev.y, prev.m, day), revenue: prevSamePeriod.revenue + dayRevenue(prev.y, prev.m, day) };
  }
  const prevFull = at(prevKey);
  // the month still in progress can't be compared with a whole month: use the same days, and say it is partial
  const lastMonthly = monthly.length - 1;
  monthly[lastMonthly] = { ...monthly[lastMonthly], partial: true, changePct: pct(thisMonth.revenue, prevSamePeriod.revenue) };

  const ytd = { orders: 0, revenue: 0 };
  const lastYtd = { orders: lastYearPartial[0]?.orders ?? 0, revenue: lastYearPartial[0]?.revenue ?? 0 };
  for (let month = 1; month <= m; month++) {
    ytd.orders += at(monthKey(y, month)).orders;
    ytd.revenue += at(monthKey(y, month)).revenue;
  }
  for (let month = 1; month < m; month++) {
    lastYtd.orders += at(monthKey(y - 1, month)).orders;
    lastYtd.revenue += at(monthKey(y - 1, month)).revenue;
  }

  const nameOf = new Map(stores.map((s) => [s.id, s.name]));
  const perStore = new Map();
  for (const row of storeRows) {
    if (!nameOf.has(row._id.brandId)) continue; // a store that has been deleted
    const entry = perStore.get(row._id.brandId) ?? { id: row._id.brandId, name: nameOf.get(row._id.brandId), orders: 0, revenue: 0, prevRevenue: 0, prevRevenueFull: 0 };
    if (row._id.month === thisKey) {
      entry.orders = row.orders;
      entry.revenue = row.revenue;
    } else if (row._id.month === prevKey) {
      entry.prevRevenue = row.toDate; // last month, the same days
      entry.prevRevenueFull = row.revenue;
    }
    perStore.set(entry.id, entry);
  }
  const topStores = [...perStore.values()]
    .filter((s) => s.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8)
    .map((s) => ({ ...s, changePct: pct(s.revenue, s.prevRevenue) }));

  const channels = ["dine-in", "takeaway", "delivery"].map((channel) => {
    const now = channelRows.find((r) => r._id.channel === channel && r._id.month === thisKey);
    const before = channelRows.find((r) => r._id.channel === channel && r._id.month === prevKey);
    return { channel, orders: now?.orders ?? 0, revenue: now?.revenue ?? 0, prevOrders: before?.orders ?? 0, prevRevenue: before?.revenue ?? 0 };
  });

  /* ------------------------------------------------------------ stores */
  const byPlanMap = new Map();
  for (const s of stores) {
    const name = s.plan?.name ?? "No plan";
    byPlanMap.set(name, (byPlanMap.get(name) ?? 0) + 1);
  }
  const firstMonth = addMonths(y, m, -11);
  const created = Array.from({ length: 12 }, (_, i) => {
    const t = addMonths(y, m, i - 11);
    const k = monthKey(t.y, t.m);
    return { key: k, label: MONTH_NAMES[t.m - 1], added: stores.filter((s) => monthKeyOf(new Date(s.createdAt)) === k).length };
  });
  let running = stores.filter((s) => new Date(s.createdAt) < istStart(firstMonth.y, firstMonth.m)).length;
  for (const row of created) {
    running += row.added;
    row.total = running;
  }
  const set = (ids) => new Set(ids.map(String));
  const menu = set(withMenu);
  const tables = set(withTables);
  const payments = set(withPayments);
  const active = set(activeIds);
  const ids = stores.map((s) => s.id);

  /* ----------------------------------------------------- subscriptions */
  const priceOf = new Map(plans.map((p) => [String(p._id), planPrices(planMarketingSchema.parse(p.marketing ?? {})).monthly]));
  const subs = new Map();
  let mrr = 0;
  let paying = 0;
  let unpriced = 0;
  for (const s of stores) {
    if (!s.plan) continue;
    const price = priceOf.get(s.plan.id) ?? 0;
    const row = subs.get(s.plan.name) ?? { name: s.plan.name, stores: 0, monthly: price, mrr: 0 };
    row.stores++;
    if (price > 0) {
      row.mrr += price;
      mrr += price;
      paying++;
    } else {
      unpriced++;
    }
    subs.set(s.plan.name, row);
  }

  return {
    generatedAt: new Date().toISOString(),
    timezone: TZ,
    today: { year: y, month: m, day: d, label: `${d} ${MONTH_NAMES[m - 1]} ${y}` },
    totals: {
      stores: stores.length,
      outlets: outletCount,
      people: peopleCount,
      customers: customerCount,
      ordersToday: dayOrders(y, m, d),
      revenueToday: dayRevenue(y, m, d),
    },
    sales: {
      month: {
        label: `${MONTH_NAMES[m - 1]} ${y}`,
        ...thisMonth,
        avgOrder: thisMonth.orders ? Math.round(thisMonth.revenue / thisMonth.orders) : 0,
        samePeriodLastMonth: prevSamePeriod,
        lastMonth: prevFull,
        revenueChangePct: pct(thisMonth.revenue, prevSamePeriod.revenue),
        ordersChangePct: pct(thisMonth.orders, prevSamePeriod.orders),
      },
      year: {
        label: String(y),
        ...ytd,
        samePeriodLastYear: lastYtd,
        revenueChangePct: pct(ytd.revenue, lastYtd.revenue),
        ordersChangePct: pct(ytd.orders, lastYtd.orders),
      },
      monthly,
      yearly,
      yearOverYear,
      daily: dailySeries,
      topStores,
      channels,
    },
    stores: {
      total: stores.length,
      byPlan: [...byPlanMap].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
      status: { ok: stores.filter((s) => s.status === "ok").length, grace: stores.filter((s) => s.status === "grace").length, overLimit: stores.filter((s) => s.status === "over-limit").length },
      // stores the platform has switched off (a separate matter from plan limits, so it isn't part of `status`)
      disabled: stores.filter((s) => s.disabled).length,
      activeLast30Days: ids.filter((id) => active.has(id)).length,
      setup: {
        withMenu: ids.filter((id) => menu.has(id)).length,
        withTables: ids.filter((id) => tables.has(id)).length,
        withPayments: ids.filter((id) => payments.has(id)).length,
      },
      created,
      attention: stores
        .filter((s) => s.status !== "ok" || s.disabled)
        .map((s) => ({ id: s.id, name: s.name, status: s.status, disabled: Boolean(s.disabled), plan: s.plan?.name ?? null, graceUntil: s.grace?.until ?? null })),
    },
    subscriptions: {
      monthlyRecurring: mrr, // rupees per month
      yearlyRecurring: mrr * 12,
      payingStores: paying,
      unpricedStores: unpriced,
      byPlan: [...subs.values()].sort((a, b) => b.mrr - a.mrr),
      estimate: true,
    },
    leads: { new: newLeads },
  };
}

/** The platform dashboard. Served from the cache; `fresh` recomputes it now. */
export async function dashboard({ fresh = false } = {}) {
  if (fresh) cache.expireKey("dash:platform");
  return cache.wrap("dash:platform", build, { tags: ["ns:dash"] });
}
