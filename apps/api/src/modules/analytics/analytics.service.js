import {
  ANALYTICS_TZ,
  addDays,
  dayEnd,
  dayKey,
  dayStart,
  daysBetween,
  DEFAULT_STOCK_SAFETY_PCT,
  previousRange,
  SALES_MATCH,
  WEEKDAYS,
  weekdayOf,
} from "@rasoipulse/config-schema";
import { CustomerModel, MenuItemModel, OrderModel, OutletModel } from "@rasoipulse/db";
import { HttpError } from "../../middleware/error.js";

/**
 * The sums behind Analytics. Everything is scoped to the store (brandId) and a range of Indian days; "outletIds"
 * narrows it to some outlets (empty = every outlet the person may see). Money is in paise. A SALE is a paid order that
 * wasn't cancelled (SALES_MATCH) — the same rule as the dashboard's revenue.
 */

const TZ = ANALYTICS_TZ;
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const NET = { $subtract: [{ $ifNull: ["$totals.grandTotal", 0] }, { $ifNull: ["$totals.taxAmount", 0] }] };
const dayOf = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: TZ } };

/* ------------------------------------------------------------------ scope */

/** The outlets a person may look at, and the ids to filter by ([] = every outlet of the store). */
export async function resolveOutlets(ctx, user, requested = []) {
  const outlets = await OutletModel.find({ brandId: ctx.brandId }).sort({ createdAt: 1 }).lean();
  const membership = user.isSuperAdmin ? null : user.memberships?.find((m) => m.brandId === ctx.brandId);
  const restricted = membership?.outletIds?.length ? new Set(membership.outletIds) : null;
  const visible = outlets.filter((o) => !restricted || restricted.has(String(o._id)));
  const list = visible.map((o) => ({ id: String(o._id), name: o.name, title: o.config?.identity?.name || o.name }));
  const wanted = requested.filter((id) => list.some((o) => o.id === id));
  if (requested.length && !wanted.length) throw new HttpError(403, "You can't see those outlets.");
  const ids = wanted.length ? wanted : restricted ? list.map((o) => o.id) : [];
  return { ids, outlets: list };
}

const scope = (ctx, range, outletIds) => ({
  brandId: ctx.brandId,
  createdAt: { $gte: dayStart(range.from), $lt: dayEnd(range.to) },
  ...(outletIds.length ? { outletId: { $in: outletIds } } : {}),
});
const sales = (ctx, range, outletIds) => ({ ...scope(ctx, range, outletIds), ...SALES_MATCH });

/** every day key in a range */
export const daysOf = (range) => {
  const out = [];
  for (let k = range.from; k <= range.to; k = addDays(k, 1)) out.push(k);
  return out;
};

/* ------------------------------------------------------- periods (day / week / month) */

const FORMAT = { day: "%Y-%m-%d", week: "%G-W%V", month: "%Y-%m" };
export const pickGranularity = (range, asked) => (["day", "week", "month"].includes(asked) ? asked : daysBetween(range.from, range.to) <= 62 ? "day" : daysBetween(range.from, range.to) <= 400 ? "week" : "month");

/** ISO week key like "2026-W46" for an Indian day */
function isoWeek(key) {
  const d = new Date(`${key}T12:00:00.000Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d - firstThursday) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
const bucketOf = (key, granularity) => (granularity === "day" ? key : granularity === "month" ? key.slice(0, 7) : isoWeek(key));
export function bucketsOf(range, granularity) {
  const seen = [];
  for (const k of daysOf(range)) {
    const b = bucketOf(k, granularity);
    if (seen[seen.length - 1] !== b) seen.push(b);
  }
  return seen;
}

/* --------------------------------------------------------------------- KPIs */

const KPI_GROUP = {
  _id: null,
  orders: { $sum: 1 },
  sales: { $sum: { $ifNull: ["$totals.grandTotal", 0] } },
  net: { $sum: NET },
  tax: { $sum: { $ifNull: ["$totals.taxAmount", 0] } },
  discount: { $sum: { $ifNull: ["$totals.discount", 0] } },
  coins: { $sum: { $ifNull: ["$totals.coinsDiscount", 0] } },
  delivery: { $sum: { $ifNull: ["$totals.deliveryFee", 0] } },
  service: { $sum: { $ifNull: ["$totals.serviceCharge", 0] } },
  items: { $sum: { $sum: "$lines.quantity" } },
  customers: { $addToSet: "$customer.customerId" },
};

function shapeKpis(row) {
  const r = row ?? {};
  const orders = num(r.orders);
  return {
    orders,
    sales: num(r.sales),
    net: num(r.net),
    tax: num(r.tax),
    discount: num(r.discount),
    coins: num(r.coins),
    delivery: num(r.delivery),
    service: num(r.service),
    items: num(r.items),
    customers: (r.customers ?? []).filter(Boolean).length,
    aov: orders ? Math.round(num(r.sales) / orders) : 0,
  };
}
export async function kpis(ctx, range, outletIds) {
  const [row] = await OrderModel.aggregate([{ $match: sales(ctx, range, outletIds) }, { $group: KPI_GROUP }]);
  return shapeKpis(row);
}

/** orders that were cancelled, and everything placed (for the cancellation rate) */
async function cancellations(ctx, range, outletIds) {
  const rows = await OrderModel.aggregate([
    { $match: scope(ctx, range, outletIds) },
    { $group: { _id: "$status", n: { $sum: 1 }, value: { $sum: { $ifNull: ["$totals.grandTotal", 0] } } } },
  ]);
  const total = rows.reduce((s, r) => s + r.n, 0);
  const c = rows.find((r) => r._id === "cancelled");
  return { placed: total, cancelled: c?.n ?? 0, lost: c?.value ?? 0, rate: total ? (c?.n ?? 0) / total : 0 };
}

/* ----------------------------------------------------------------- overview */

export async function overview(ctx, range, outletIds, { granularity } = {}) {
  const g = pickGranularity(range, granularity);
  const prev = previousRange(range);
  const match = sales(ctx, range, outletIds);
  const [current, previous, series, hours, heat, channels, payments, cancel, prevCancel, newRepeat] = await Promise.all([
    kpis(ctx, range, outletIds),
    kpis(ctx, prev, outletIds),
    OrderModel.aggregate([{ $match: match }, { $group: { _id: { $dateToString: { format: FORMAT[g], date: "$createdAt", timezone: TZ } }, sales: { $sum: { $ifNull: ["$totals.grandTotal", 0] } }, net: { $sum: NET }, orders: { $sum: 1 } } }]),
    OrderModel.aggregate([{ $match: match }, { $group: { _id: { $hour: { date: "$createdAt", timezone: TZ } }, sales: { $sum: { $ifNull: ["$totals.grandTotal", 0] } }, orders: { $sum: 1 } } }]),
    OrderModel.aggregate([{ $match: match }, { $group: { _id: { dow: { $dayOfWeek: { date: "$createdAt", timezone: TZ } }, hour: { $hour: { date: "$createdAt", timezone: TZ } } }, orders: { $sum: 1 } } }]),
    OrderModel.aggregate([{ $match: match }, { $group: { _id: "$channel", sales: { $sum: { $ifNull: ["$totals.grandTotal", 0] } }, orders: { $sum: 1 } } }]),
    OrderModel.aggregate([{ $match: match }, { $group: { _id: "$payment.gateway", sales: { $sum: { $ifNull: ["$totals.grandTotal", 0] } }, orders: { $sum: 1 } } }]),
    cancellations(ctx, range, outletIds),
    cancellations(ctx, prev, outletIds),
    newVersusRepeat(ctx, range, outletIds),
  ]);
  const by = new Map(series.map((r) => [r._id, r]));
  const buckets = bucketsOf(range, g).map((b) => ({ key: b, sales: by.get(b)?.sales ?? 0, net: by.get(b)?.net ?? 0, orders: by.get(b)?.orders ?? 0 }));
  const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, sales: hours.find((r) => r._id === h)?.sales ?? 0, orders: hours.find((r) => r._id === h)?.orders ?? 0 }));
  const heatmap = Array.from({ length: 7 }, (_, d) => Array.from({ length: 24 }, (_, h) => heat.find((r) => r._id.dow === d + 1 && r._id.hour === h)?.orders ?? 0));
  return {
    range,
    previous: prev,
    granularity: g,
    kpis: current,
    previousKpis: previous,
    cancellations: cancel,
    previousCancellations: prevCancel,
    newVsRepeat: newRepeat,
    series: buckets,
    hourly,
    heatmap, // [Sunday…Saturday][hour] = orders
    channels: channels.map((r) => ({ id: r._id, sales: r.sales, orders: r.orders })).sort((a, b) => b.sales - a.sales),
    payments: payments.map((r) => ({ id: r._id, sales: r.sales, orders: r.orders })).sort((a, b) => b.sales - a.sales),
  };
}

/* ------------------------------------------------------------- new vs repeat */

async function newVersusRepeat(ctx, range, outletIds) {
  const rows = await OrderModel.aggregate([{ $match: { ...sales(ctx, range, outletIds), "customer.customerId": { $type: "string" } } }, { $group: { _id: "$customer.customerId" } }, { $limit: 50_000 }]);
  const ids = rows.map((r) => r._id);
  if (!ids.length) return { customers: 0, newCustomers: 0, repeatCustomers: 0 };
  const earlier = await OrderModel.aggregate([
    { $match: { brandId: ctx.brandId, ...SALES_MATCH, "customer.customerId": { $in: ids }, createdAt: { $lt: dayStart(range.from) } } },
    { $group: { _id: "$customer.customerId" } },
  ]);
  return { customers: ids.length, newCustomers: ids.length - earlier.length, repeatCustomers: earlier.length };
}

/* ------------------------------------------------------------------- sales */

/** the series, split by outlet, plus breakdown tables */
export async function salesReport(ctx, range, outletIds, { granularity } = {}, outletList = []) {
  const g = pickGranularity(range, granularity);
  const match = sales(ctx, range, outletIds);
  const [rows, weekdays, channelHour] = await Promise.all([
    OrderModel.aggregate([{ $match: match }, { $group: { _id: { b: { $dateToString: { format: FORMAT[g], date: "$createdAt", timezone: TZ } }, o: "$outletId" }, sales: { $sum: { $ifNull: ["$totals.grandTotal", 0] } }, orders: { $sum: 1 } } }]),
    OrderModel.aggregate([{ $match: match }, { $group: { _id: { $dayOfWeek: { date: "$createdAt", timezone: TZ } }, sales: { $sum: { $ifNull: ["$totals.grandTotal", 0] } }, orders: { $sum: 1 }, days: { $addToSet: dayOf } } }]),
    OrderModel.aggregate([{ $match: match }, { $group: { _id: { c: "$channel", o: "$outletId" }, sales: { $sum: { $ifNull: ["$totals.grandTotal", 0] } }, orders: { $sum: 1 } } }]),
  ]);
  const buckets = bucketsOf(range, g);
  const ids = outletIds.length ? outletIds : outletList.map((o) => o.id);
  const perOutlet = ids.map((id) => ({
    id,
    name: outletList.find((o) => o.id === id)?.title ?? id,
    values: buckets.map((b) => rows.find((r) => r._id.b === b && r._id.o === id)?.sales ?? 0),
    orders: buckets.map((b) => rows.find((r) => r._id.b === b && r._id.o === id)?.orders ?? 0),
  }));
  const totalDays = daysOf(range);
  const weekdayRows = WEEKDAYS.map((name, i) => {
    const r = weekdays.find((x) => x._id === i + 1);
    const occurrences = totalDays.filter((d) => weekdayOf(d) === i).length;
    return { name, sales: r?.sales ?? 0, orders: r?.orders ?? 0, avgSales: occurrences ? Math.round((r?.sales ?? 0) / occurrences) : 0, avgOrders: occurrences ? (r?.orders ?? 0) / occurrences : 0, occurrences };
  });
  return {
    range,
    granularity: g,
    buckets,
    perOutlet,
    weekdays: weekdayRows,
    channelsByOutlet: channelHour.map((r) => ({ channel: r._id.c, outletId: r._id.o, sales: r.sales, orders: r.orders })),
  };
}

/* ------------------------------------------------------------------- items */

export async function itemsReport(ctx, range, outletIds) {
  const prev = previousRange(range);
  const group = {
    _id: { $toLower: { $trim: { input: { $ifNull: ["$lines.name", ""] } } } },
    name: { $first: "$lines.name" },
    qty: { $sum: { $ifNull: ["$lines.quantity", 0] } },
    revenue: { $sum: { $ifNull: ["$lines.lineTotal", 0] } },
    orders: { $sum: 1 },
    days: { $addToSet: dayOf },
  };
  const [cur, before] = await Promise.all([
    OrderModel.aggregate([{ $match: sales(ctx, range, outletIds) }, { $unwind: "$lines" }, { $group: group }, { $sort: { qty: -1, revenue: -1, _id: 1 } }]), // ties: the dearer item first, then by name — so the list never reshuffles between requests
    OrderModel.aggregate([{ $match: sales(ctx, prev, outletIds) }, { $unwind: "$lines" }, { $group: { _id: group._id, qty: group.qty } }]),
  ]);
  const prevQty = new Map(before.map((r) => [r._id, r.qty]));
  const span = daysBetween(range.from, range.to);
  const totalQty = cur.reduce((s, r) => s + r.qty, 0) || 1;
  const totalRevenue = cur.reduce((s, r) => s + r.revenue, 0) || 1;
  const items = cur.map((r, i) => ({
    rank: i + 1,
    key: r._id,
    name: r.name,
    qty: r.qty,
    revenue: r.revenue,
    orders: r.orders,
    daysSold: r.days.length,
    perDay: Math.round((r.qty / span) * 10) / 10,
    qtyShare: r.qty / totalQty,
    revenueShare: r.revenue / totalRevenue,
    previousQty: prevQty.get(r._id) ?? 0,
    change: prevQty.get(r._id) ? Math.round(((r.qty - prevQty.get(r._id)) / prevQty.get(r._id)) * 1000) / 10 : null,
  }));
  // menu items that sold nothing at all in this range
  const menu = await MenuItemModel.find({ brandId: ctx.brandId, ...(outletIds.length ? { outletId: { $in: outletIds } } : {}) }).select("name isAvailable").lean();
  const sold = new Set(cur.map((r) => r._id));
  const unsold = [...new Map(menu.filter((m) => !sold.has(String(m.name).trim().toLowerCase())).map((m) => [String(m.name).trim().toLowerCase(), m.name])).values()].sort();
  return { range, previous: prev, items, unsold, totals: { qty: totalQty, revenue: totalRevenue } };
}

/* ------------------------------------------------------- stock suggestions */

/**
 * What to prepare each weekday, per item: the average number sold on that weekday over the last few weeks, plus a safety
 * margin. The window is whole weeks ending yesterday, so every weekday appears the same number of times. Only items
 * with some sales appear. Nothing here knows about ingredients — it is "how many portions", not "how many kg".
 */
export async function stockSuggestions(ctx, outletIds, { weeks = 6, safetyPct = DEFAULT_STOCK_SAFETY_PCT, now = new Date() } = {}) {
  const w = Math.max(2, Math.min(12, Math.round(weeks)));
  const safety = Math.max(0, Math.min(100, Number(safetyPct) || 0));
  const today = dayKey(now);
  const range = { from: addDays(today, -7 * w), to: addDays(today, -1) };
  const rows = await OrderModel.aggregate([
    { $match: sales(ctx, range, outletIds) },
    { $unwind: "$lines" },
    { $group: { _id: { k: { $toLower: { $trim: { input: { $ifNull: ["$lines.name", ""] } } } }, d: dayOf }, name: { $first: "$lines.name" }, qty: { $sum: { $ifNull: ["$lines.quantity", 0] } } } },
  ]);
  const items = new Map();
  for (const r of rows) {
    if (!items.has(r._id.k)) items.set(r._id.k, { name: r.name, perDay: new Map() });
    items.get(r._id.k).perDay.set(r._id.d, r.qty);
  }
  const days = daysOf(range);
  const out = [];
  for (const [key, it] of items) {
    const weekday = WEEKDAYS.map((_, wd) => {
      const mine = days.filter((d) => weekdayOf(d) === wd);
      const qtys = mine.map((d) => it.perDay.get(d) ?? 0);
      const avg = qtys.reduce((s, q) => s + q, 0) / (mine.length || 1);
      const max = Math.max(0, ...qtys);
      return { avg: Math.round(avg * 10) / 10, max, suggested: avg > 0 ? Math.max(1, Math.ceil(avg * (1 + safety / 100))) : 0, sellingDays: qtys.filter((q) => q > 0).length };
    });
    const total = days.reduce((s, d) => s + (it.perDay.get(d) ?? 0), 0);
    out.push({ key, name: it.name, total, perDay: Math.round((total / days.length) * 10) / 10, weekday });
  }
  out.sort((a, b) => b.total - a.total);
  const tomorrow = addDays(today, 1);
  const tw = weekdayOf(tomorrow);
  return {
    weeks: w,
    safetyPct: safety,
    range,
    tomorrow: { day: tomorrow, weekday: WEEKDAYS[tw], items: out.filter((i) => i.weekday[tw].suggested > 0).map((i) => ({ name: i.name, suggested: i.weekday[tw].suggested, avg: i.weekday[tw].avg, max: i.weekday[tw].max })).sort((a, b) => b.suggested - a.suggested) },
    weekdays: WEEKDAYS,
    items: out,
  };
}

/* --------------------------------------------------------------- customers */

export async function customersReport(ctx, range, outletIds, now = new Date()) {
  const [top, buckets, newRepeat] = await Promise.all([
    OrderModel.aggregate([
      { $match: { ...sales(ctx, range, outletIds), "customer.customerId": { $type: "string" } } },
      { $group: { _id: "$customer.customerId", name: { $last: "$customer.name" }, phone: { $last: "$customer.phone" }, orders: { $sum: 1 }, spend: { $sum: { $ifNull: ["$totals.grandTotal", 0] } }, last: { $max: "$createdAt" } } },
      { $sort: { spend: -1 } },
      { $limit: 15 },
    ]),
    OrderModel.aggregate([
      { $match: { ...sales(ctx, range, outletIds), "customer.customerId": { $type: "string" } } },
      { $group: { _id: "$customer.customerId", n: { $sum: 1 } } },
      { $group: { _id: { $switch: { branches: [{ case: { $eq: ["$n", 1] }, then: "1" }, { case: { $eq: ["$n", 2] }, then: "2" }, { case: { $lte: ["$n", 4] }, then: "3-4" }], default: "5+" } }, customers: { $sum: 1 } } },
    ]),
    newVersusRepeat(ctx, range, outletIds),
  ]);
  const cutoff = (days) => new Date(now.getTime() - days * 86_400_000);
  const base = { brandId: ctx.brandId, orderCount: { $gte: 1 } };
  const [l30, l60, l90, all] = await Promise.all([
    CustomerModel.countDocuments({ ...base, lastOrderAt: { $lt: cutoff(30) } }),
    CustomerModel.countDocuments({ ...base, lastOrderAt: { $lt: cutoff(60) } }),
    CustomerModel.countDocuments({ ...base, lastOrderAt: { $lt: cutoff(90) } }),
    CustomerModel.countDocuments(base),
  ]);
  return {
    range,
    newVsRepeat: newRepeat,
    top: top.map((r) => ({ id: r._id, name: r.name || "—", phone: r.phone ? `•••• ${String(r.phone).slice(-4)}` : "", orders: r.orders, spend: r.spend, last: r.last })),
    ordersPerCustomer: ["1", "2", "3-4", "5+"].map((b) => ({ bucket: b, customers: buckets.find((x) => x._id === b)?.customers ?? 0 })),
    lapsed: { days30: l30, days60: l60, days90: l90, ofAll: all },
  };
}

/* ------------------------------------------------------- compare outlets */

export async function compareOutlets(ctx, range, outletIds, outletList) {
  const ids = outletIds.length ? outletIds : outletList.map((o) => o.id);
  const match = sales(ctx, range, ids);
  const [k, daily, items, channels] = await Promise.all([
    OrderModel.aggregate([{ $match: match }, { $group: { ...KPI_GROUP, _id: "$outletId" } }]),
    OrderModel.aggregate([{ $match: match }, { $group: { _id: { o: "$outletId", d: dayOf }, sales: { $sum: { $ifNull: ["$totals.grandTotal", 0] } } } }]),
    OrderModel.aggregate([{ $match: match }, { $unwind: "$lines" }, { $group: { _id: { o: "$outletId", k: { $toLower: { $trim: { input: { $ifNull: ["$lines.name", ""] } } } } }, name: { $first: "$lines.name" }, qty: { $sum: { $ifNull: ["$lines.quantity", 0] } } } }]),
    OrderModel.aggregate([{ $match: match }, { $group: { _id: { o: "$outletId", c: "$channel" }, sales: { $sum: { $ifNull: ["$totals.grandTotal", 0] } }, orders: { $sum: 1 } } }]),
  ]);
  const days = daysOf(range);
  const cancel = await Promise.all(ids.map((id) => cancellations(ctx, range, [id])));
  return {
    range,
    days: days.length,
    outlets: ids.map((id, i) => {
      const row = k.find((r) => r._id === id);
      return {
        id,
        name: outletList.find((o) => o.id === id)?.title ?? id,
        kpis: shapeKpis(row),
        cancelled: cancel[i],
        daily: days.map((d) => daily.find((r) => r._id.o === id && r._id.d === d)?.sales ?? 0),
        topItems: items.filter((r) => r._id.o === id).sort((a, b) => b.qty - a.qty || String(a.name).localeCompare(String(b.name))).slice(0, 8).map((r) => ({ name: r.name, qty: r.qty })),
        channels: channels.filter((r) => r._id.o === id).map((r) => ({ channel: r._id.c, sales: r.sales, orders: r.orders })),
      };
    }),
    dayLabels: days,
  };
}

/* --------------------------------------------------------------- operations */

export async function operationsReport(ctx, range, outletIds) {
  const thresholdPlaced = { $arrayElemAt: [{ $filter: { input: "$statusHistory", cond: { $eq: ["$$this.status", "placed"] } } }, 0] };
  const step = (s) => ({ $arrayElemAt: [{ $filter: { input: "$statusHistory", cond: { $eq: ["$$this.status", s] } } }, 0] });
  const mins = (a, b) => ({ $cond: [{ $and: ["$" + a + ".at", "$" + b + ".at"] }, { $divide: [{ $subtract: ["$" + b + ".at", "$" + a + ".at"] }, 60000] }, null] });
  const [cancel, byHour, kitchen, coupons, discountTotals] = await Promise.all([
    cancellations(ctx, range, outletIds),
    OrderModel.aggregate([{ $match: { ...scope(ctx, range, outletIds), status: "cancelled" } }, { $group: { _id: { $hour: { date: "$createdAt", timezone: TZ } }, n: { $sum: 1 } } }]),
    OrderModel.aggregate([
      { $match: { ...scope(ctx, range, outletIds), status: { $in: ["ready", "completed"] } } },
      { $project: { placed: thresholdPlaced, accepted: step("accepted"), ready: step("ready") } },
      { $project: { accept: mins("placed", "accepted"), cook: mins("accepted", "ready"), total: mins("placed", "ready") } },
      { $group: { _id: null, n: { $sum: 1 }, accept: { $avg: "$accept" }, cook: { $avg: "$cook" }, total: { $avg: "$total" }, slow: { $sum: { $cond: [{ $gt: ["$total", 30] }, 1, 0] } } } },
    ]),
    OrderModel.aggregate([
      { $match: { ...sales(ctx, range, outletIds), couponCode: { $type: "string" } } },
      { $group: { _id: "$couponCode", uses: { $sum: 1 }, discount: { $sum: { $ifNull: ["$totals.discount", 0] } }, sales: { $sum: { $ifNull: ["$totals.grandTotal", 0] } } } },
      { $sort: { discount: -1 } },
      { $limit: 20 },
    ]),
    OrderModel.aggregate([{ $match: sales(ctx, range, outletIds) }, { $group: { _id: null, subtotal: { $sum: { $ifNull: ["$totals.subtotal", 0] } }, discount: { $sum: { $ifNull: ["$totals.discount", 0] } }, coins: { $sum: { $ifNull: ["$totals.coinsDiscount", 0] } }, discounted: { $sum: { $cond: [{ $gt: [{ $ifNull: ["$totals.discount", 0] }, 0] }, 1, 0] } }, withCoins: { $sum: { $cond: [{ $gt: [{ $ifNull: ["$totals.coinsDiscount", 0] }, 0] }, 1, 0] } }, orders: { $sum: 1 } } }]),
  ]);
  const k = kitchen[0];
  const d = discountTotals[0] ?? { subtotal: 0, discount: 0, coins: 0, discounted: 0, withCoins: 0, orders: 0 };
  const round = (v) => (v === null || v === undefined ? null : Math.round(v * 10) / 10);
  return {
    range,
    cancellations: cancel,
    cancelledByHour: Array.from({ length: 24 }, (_, h) => ({ hour: h, n: byHour.find((r) => r._id === h)?.n ?? 0 })),
    kitchen: k ? { orders: k.n, acceptMinutes: round(k.accept), cookMinutes: round(k.cook), totalMinutes: round(k.total), slowShare: k.n ? k.slow / k.n : 0, slowAfterMinutes: 30 } : null,
    coupons: coupons.map((c) => ({ code: c._id, uses: c.uses, discount: c.discount, sales: c.sales })),
    discounts: { ...d, discountShare: d.subtotal ? d.discount / d.subtotal : 0 },
  };
}

/* ----------------------------------------------------------- GST and cash */

export async function gstReport(ctx, range, outletIds) {
  const rows = await OrderModel.aggregate([
    { $match: sales(ctx, range, outletIds) },
    { $group: { _id: dayOf, orders: { $sum: 1 }, taxable: { $sum: { $ifNull: ["$totals.taxable", 0] } }, cgst: { $sum: { $ifNull: ["$totals.cgst", 0] } }, sgst: { $sum: { $ifNull: ["$totals.sgst", 0] } }, tax: { $sum: { $ifNull: ["$totals.taxAmount", 0] } }, service: { $sum: { $ifNull: ["$totals.serviceCharge", 0] } }, total: { $sum: { $ifNull: ["$totals.grandTotal", 0] } } } },
    { $sort: { _id: 1 } },
  ]);
  const days = rows.map((r) => ({ day: r._id, orders: r.orders, taxable: r.taxable, cgst: r.cgst, sgst: r.sgst, tax: r.tax, service: r.service, total: r.total }));
  const sum = (key) => days.reduce((s, r) => s + r[key], 0);
  return { range, days, totals: { orders: sum("orders"), taxable: sum("taxable"), cgst: sum("cgst"), sgst: sum("sgst"), tax: sum("tax"), service: sum("service"), total: sum("total") } };
}

const GATEWAY_LABEL = { cod: "Cash (paid at the counter)", razorpay: "Online (Razorpay)", mock: "Test gateway" };
/** the till for a range (usually one day): what came in how, what is still unpaid, what was cancelled */
export async function cashClose(ctx, range, outletIds) {
  const [paid, pending, cancelled] = await Promise.all([
    OrderModel.aggregate([{ $match: sales(ctx, range, outletIds) }, { $group: { _id: "$payment.gateway", orders: { $sum: 1 }, amount: { $sum: { $ifNull: ["$totals.grandTotal", 0] } }, discount: { $sum: { $ifNull: ["$totals.discount", 0] } } } }]),
    OrderModel.aggregate([{ $match: { ...scope(ctx, range, outletIds), status: { $ne: "cancelled" }, "payment.status": "pending" } }, { $group: { _id: null, orders: { $sum: 1 }, amount: { $sum: { $ifNull: ["$totals.grandTotal", 0] } } } }]),
    OrderModel.aggregate([{ $match: { ...scope(ctx, range, outletIds), status: "cancelled" } }, { $group: { _id: null, orders: { $sum: 1 }, amount: { $sum: { $ifNull: ["$totals.grandTotal", 0] } } } }]),
  ]);
  const rows = paid.map((r) => ({ id: r._id, label: GATEWAY_LABEL[r._id] ?? r._id, orders: r.orders, amount: r.amount, discount: r.discount })).sort((a, b) => b.amount - a.amount);
  return { range, rows, collected: rows.reduce((s, r) => s + r.amount, 0), pending: { orders: pending[0]?.orders ?? 0, amount: pending[0]?.amount ?? 0 }, cancelled: { orders: cancelled[0]?.orders ?? 0, amount: cancelled[0]?.amount ?? 0 } };
}

/* ------------------------------------------------------- profit & loss inputs */

/** What the server knows for the calculator: net sales, overall and per outlet. The owner's expenses come from the browser. */
export async function pnlInputs(ctx, range, outletIds, outletList) {
  const rows = await OrderModel.aggregate([{ $match: sales(ctx, range, outletIds) }, { $group: { ...KPI_GROUP, _id: "$outletId" } }]);
  const perOutlet = (outletIds.length ? outletIds : outletList.map((o) => o.id)).map((id) => ({ id, name: outletList.find((o) => o.id === id)?.title ?? id, ...shapeKpis(rows.find((r) => r._id === id)) }));
  const total = perOutlet.reduce((acc, o) => ({ sales: acc.sales + o.sales, net: acc.net + o.net, tax: acc.tax + o.tax, orders: acc.orders + o.orders }), { sales: 0, net: 0, tax: 0, orders: 0 });
  return { range, total, perOutlet };
}
