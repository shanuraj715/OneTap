import { addDays, dayEnd, dayKey, dayStart, daysBetween, LEDGER_CATEGORIES, PAYMENT_MODES, previousRange, WEEKDAYS, weekdayOf } from "@rasoipulse/config-schema";
import { AnalyticsProfileModel, CouponModel, ExpenseModel, MenuCategoryModel, MenuItemModel, OrderModel, OutletModel, ReservationModel } from "@rasoipulse/db";
import { HttpError } from "../../middleware/error.js";
import { storePlan } from "../platform/plan.service.js";
import * as base from "./analytics.service.js";

/**
 * The reports the Rasoi Pulse Business app adds on top of the store dashboard's analytics: coupon usage, table reservations, stock,
 * plain-English insights, the expenses LEDGER (bills written down on the day they were paid) and the monthly sales goal.
 * Same rules as the rest of analytics: scoped to the store, a range of Indian days, some outlets ([] = every outlet the person may see),
 * money in paise (the expenses are WRITTEN in rupees and read back in rupees: see `shapeExpense`).
 */

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const round1 = (n) => Math.round(n * 10) / 10;
const categoryLabel = new Map(LEDGER_CATEGORIES.map((c) => [c.key, c.label]));
const labelOf = (key) => categoryLabel.get(key) ?? String(key).replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const planHas = async (brandId, feature) => (await storePlan(brandId)).entitlements.features.includes(feature);
const pctChange = (cur, prev) => (prev > 0 ? round1(((cur - prev) / prev) * 100) : null);

/* ================================================================ coupons */

/**
 * How the coupons are used: uses, the discount given, the sales those orders brought, who used them, which outlet; with the previous period
 * beside it. `enabled: false` (nothing else) when the plan has no coupons — the app then simply leaves the section out.
 */
export async function couponsReport(ctx, range, outletIds) {
  if (!(await planHas(ctx.brandId, "coupons"))) return { enabled: false };
  const prev = previousRange(range);
  const withCoupon = (r) => ({ ...base.salesMatch(ctx, r, outletIds), couponCode: { $type: "string", $nin: ["", null] } });
  const byCode = (r) => OrderModel.aggregate([
    { $match: withCoupon(r) },
    { $group: { _id: { $toUpper: "$couponCode" }, uses: { $sum: 1 }, discount: { $sum: { $ifNull: ["$totals.discount", 0] } }, sales: { $sum: { $ifNull: ["$totals.grandTotal", 0] } }, customers: { $addToSet: "$customer.customerId" }, last: { $max: "$createdAt" } } },
    { $sort: { uses: -1, _id: 1 } },
  ]);
  const [rows, before, perOutlet, k, coupons, outlets] = await Promise.all([
    byCode(range),
    byCode(prev),
    OrderModel.aggregate([{ $match: withCoupon(range) }, { $group: { _id: "$outletId", uses: { $sum: 1 }, discount: { $sum: { $ifNull: ["$totals.discount", 0] } } } }]),
    base.kpis(ctx, range, outletIds),
    CouponModel.find({ brandId: ctx.brandId, ...(outletIds.length ? { outletId: { $in: outletIds } } : {}) }).lean(),
    OutletModel.find({ brandId: ctx.brandId }).select("name config.identity.name").lean(),
  ]);
  const info = new Map();
  for (const c of coupons) {
    const key = String(c.code).toUpperCase();
    const cur = info.get(key) ?? { code: key, description: c.description ?? "", discountType: c.discountType, value: c.value, active: false, redemptionCount: 0, maxRedemptions: 0, validUntil: c.validUntil ?? "" };
    cur.active = cur.active || Boolean(c.active);
    cur.redemptionCount += num(c.redemptionCount);
    cur.maxRedemptions = Math.max(cur.maxRedemptions, num(c.maxRedemptions));
    info.set(key, cur);
  }
  const prevUses = new Map(before.map((r) => [r._id, r.uses]));
  const list = rows.map((r) => ({
    ...(info.get(r._id) ?? { code: r._id, description: "", discountType: null, value: 0, active: false, redemptionCount: 0, maxRedemptions: 0, validUntil: "" }),
    uses: r.uses,
    discount: r.discount,
    sales: r.sales,
    customers: r.customers.filter(Boolean).length,
    avgOrder: r.uses ? Math.round(r.sales / r.uses) : 0,
    avgDiscount: r.uses ? Math.round(r.discount / r.uses) : 0,
    shareOfOrders: k.orders ? r.uses / k.orders : 0,
    previousUses: prevUses.get(r._id) ?? 0,
    change: pctChange(r.uses, prevUses.get(r._id) ?? 0),
    lastUsed: r.last ? dayKey(r.last) : null,
  }));
  const used = new Set(list.map((c) => c.code));
  const sum = (arr, f) => arr.reduce((s, r) => s + f(r), 0);
  const uses = sum(rows, (r) => r.uses);
  const sales = sum(rows, (r) => r.sales);
  const prevTotal = { uses: sum(before, (r) => r.uses), discount: sum(before, (r) => r.discount) };
  const name = new Map(outlets.map((o) => [String(o._id), o.config?.identity?.name || o.name]));
  const noCouponOrders = Math.max(0, k.orders - uses);
  const noCouponSales = Math.max(0, k.sales - sales);
  return {
    enabled: true,
    range,
    previous: prev,
    totals: {
      uses,
      discount: sum(rows, (r) => r.discount),
      sales,
      codes: list.length,
      shareOfOrders: k.orders ? uses / k.orders : 0,
      avgOrderWithCoupon: uses ? Math.round(sales / uses) : 0,
      avgOrderWithoutCoupon: noCouponOrders ? Math.round(noCouponSales / noCouponOrders) : 0,
      previousUses: prevTotal.uses,
      previousDiscount: prevTotal.discount,
      usesChange: pctChange(uses, prevTotal.uses),
      discountChange: pctChange(sum(rows, (r) => r.discount), prevTotal.discount),
    },
    coupons: list,
    // coupons that exist and are switched on but nobody used in this range
    unused: [...info.values()].filter((c) => c.active && !used.has(c.code)).map((c) => ({ code: c.code, description: c.description, validUntil: c.validUntil })),
    perOutlet: perOutlet.map((r) => ({ id: r._id, name: name.get(r._id) ?? r._id, uses: r.uses, discount: r.discount })).sort((a, b) => b.uses - a.uses),
  };
}

/* ========================================================== reservations */

const PARTY_BANDS = [
  { id: "1-2", label: "1–2 guests", min: 1, max: 2 },
  { id: "3-4", label: "3–4 guests", min: 3, max: 4 },
  { id: "5-6", label: "5–6 guests", min: 5, max: 6 },
  { id: "7+", label: "7 or more", min: 7, max: 1e9 },
];

/** Table bookings in a range (by the day of the booking itself): how many, how many guests, what happened to them, the advance paid, busiest days and hours. */
export async function reservationsReport(ctx, range, outletIds) {
  if (!(await planHas(ctx.brandId, "reservations"))) return { enabled: false };
  const prev = previousRange(range);
  const scope = (r) => ({ brandId: ctx.brandId, at: { $gte: dayStart(r.from), $lt: dayEnd(r.to) }, ...(outletIds.length ? { outletId: { $in: outletIds } } : {}) });
  const [rows, before, upcoming] = await Promise.all([
    ReservationModel.find(scope(range)).select("status at partySize pricing payment source event outletId customer.customerId").lean(),
    ReservationModel.countDocuments(scope(prev)),
    ReservationModel.countDocuments({ brandId: ctx.brandId, status: { $in: ["requested", "confirmed"] }, at: { $gte: new Date(), $lt: new Date(Date.now() + 7 * 86_400_000) }, ...(outletIds.length ? { outletId: { $in: outletIds } } : {}) }),
  ]);
  const count = (f) => rows.filter(f).length;
  const total = rows.length;
  const kept = rows.filter((r) => ["seated", "completed"].includes(r.status));
  const byStatus = ["requested", "confirmed", "seated", "completed", "declined", "cancelled", "no_show"].map((id) => ({ id, count: count((r) => r.status === id) }));
  const hourOf = (d) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false }).format(d)) % 24;
  const days = new Map();
  const weekdays = Array.from({ length: 7 }, () => 0);
  const hours = Array.from({ length: 24 }, () => 0);
  const events = new Map();
  let guests = 0;
  let advance = 0;
  let refundDue = 0;
  let value = 0;
  for (const r of rows) {
    const day = dayKey(r.at);
    days.set(day, (days.get(day) ?? 0) + 1);
    weekdays[weekdayOf(day)]++;
    hours[hourOf(r.at)]++;
    guests += num(r.partySize);
    if (r.event) events.set(r.event, (events.get(r.event) ?? 0) + 1);
    if (r.payment?.status === "paid") advance += num(r.pricing?.prepayPaise);
    if (r.payment?.status === "refund_due") refundDue += num(r.pricing?.prepayPaise);
    if (!["declined", "cancelled", "no_show"].includes(r.status)) value += num(r.pricing?.amountPaise);
  }
  const series = [];
  for (let k = range.from; k <= range.to && series.length < 400; k = addDays(k, 1)) series.push({ day: k, bookings: days.get(k) ?? 0 });
  const peak = (arr) => arr.reduce((best, v, i) => (v > arr[best] ? i : best), 0);
  const outlets = await OutletModel.find({ brandId: ctx.brandId }).select("name config.identity.name").lean();
  const name = new Map(outlets.map((o) => [String(o._id), o.config?.identity?.name || o.name]));
  const per = new Map();
  for (const r of rows) per.set(r.outletId, (per.get(r.outletId) ?? 0) + 1);
  return {
    enabled: true,
    range,
    previous: prev,
    totals: {
      bookings: total,
      previousBookings: before,
      change: pctChange(total, before),
      guests,
      avgParty: total ? round1(guests / total) : 0,
      kept: kept.length,
      noShows: count((r) => r.status === "no_show"),
      cancelled: count((r) => r.status === "cancelled"),
      declined: count((r) => r.status === "declined"),
      noShowRate: total ? count((r) => r.status === "no_show") / total : 0,
      cancelRate: total ? count((r) => r.status === "cancelled") / total : 0,
      advanceCollected: advance,
      refundDue,
      bookedValue: value,
      fromStaff: count((r) => r.source === "staff"),
      fromCustomers: count((r) => r.source !== "staff"),
      upcomingWeek: upcoming,
    },
    byStatus,
    series,
    weekdays: WEEKDAYS.map((n, i) => ({ name: n, bookings: weekdays[i] })),
    hours: hours.map((n, h) => ({ hour: h, bookings: n })).filter((h) => h.bookings > 0),
    busiestWeekday: total ? WEEKDAYS[peak(weekdays)] : null,
    busiestHour: total ? peak(hours) : null,
    partySizes: PARTY_BANDS.map((b) => ({ id: b.id, label: b.label, bookings: count((r) => r.partySize >= b.min && r.partySize <= b.max) })),
    events: [...events].map(([event, n]) => ({ event, bookings: n })).sort((a, b) => b.bookings - a.bookings).slice(0, 8),
    perOutlet: [...per].map(([id, n]) => ({ id, name: name.get(id) ?? id, bookings: n })).sort((a, b) => b.bookings - a.bookings),
  };
}

/* ============================================================== inventory */

/**
 * Counted stock: every dish whose portions are counted, how many are left, how fast it sells (the last 7 days) and so how long it will last.
 * Dishes whose stock is not counted are only counted, not listed. Risk order: out of stock, then low, then the fewest days left.
 */
export async function inventoryReport(ctx, outletIds, { now = new Date() } = {}) {
  const outletFilter = outletIds.length ? { outletId: { $in: outletIds } } : {};
  const [items, categories, outlets, sold] = await Promise.all([
    MenuItemModel.find({ brandId: ctx.brandId, ...outletFilter }).select("name categoryId outletId price isAvailable offReason stock").lean(),
    MenuCategoryModel.find({ brandId: ctx.brandId }).select("name").lean(),
    OutletModel.find({ brandId: ctx.brandId }).select("name config.identity.name").lean(),
    OrderModel.aggregate([
      { $match: { ...base.salesMatch(ctx, { from: addDays(dayKey(now), -7), to: addDays(dayKey(now), -1) }, outletIds) } },
      { $unwind: "$lines" },
      { $group: { _id: { $toLower: { $trim: { input: { $ifNull: ["$lines.name", ""] } } } }, qty: { $sum: { $ifNull: ["$lines.quantity", 0] } } } },
    ]),
  ]);
  const cat = new Map(categories.map((c) => [String(c._id), c.name]));
  const outName = new Map(outlets.map((o) => [String(o._id), o.config?.identity?.name || o.name]));
  const perDay = new Map(sold.map((r) => [r._id, r.qty / 7]));
  const counted = items.filter((i) => i.stock && i.stock.tracked !== false);
  const rows = counted.map((i) => {
    const left = num(i.stock.left);
    const speed = perDay.get(String(i.name).trim().toLowerCase()) ?? 0;
    const lowAt = i.stock.lowAt ?? 5;
    const state = left <= 0 ? "out" : left <= lowAt ? "low" : "ok";
    return {
      id: String(i._id), name: i.name, category: cat.get(String(i.categoryId)) ?? "", outletId: i.outletId, outlet: outName.get(i.outletId) ?? "",
      left, daily: i.stock.daily ?? null, lowAt, state, available: i.isAvailable !== false,
      soldPerDay: round1(speed), daysLeft: speed > 0 ? round1(left / speed) : null,
    };
  });
  const rank = { out: 0, low: 1, ok: 2 };
  rows.sort((a, b) => rank[a.state] - rank[b.state] || (a.daysLeft ?? 1e9) - (b.daysLeft ?? 1e9) || a.name.localeCompare(b.name));
  return {
    totals: {
      dishes: items.length,
      counted: counted.length,
      notCounted: items.length - counted.length,
      out: rows.filter((r) => r.state === "out").length,
      low: rows.filter((r) => r.state === "low").length,
      switchedOff: items.filter((i) => i.isAvailable === false).length,
    },
    items: rows.slice(0, 300),
    switchedOff: items.filter((i) => i.isAvailable === false).slice(0, 100).map((i) => ({ id: String(i._id), name: i.name, outlet: outName.get(i.outletId) ?? "", reason: i.offReason || "" })),
  };
}

/* ============================================================== insights */

/**
 * Plain-English things worth knowing, worked out from the same numbers as the charts: a sentence each, with a tone (good / warn / info).
 * At most `limit`, the most useful first. Nothing is made up: every line comes from a number it carries in `value`.
 */
export async function insights(ctx, range, outletIds, { limit = 10 } = {}) {
  const [ov, it, sales, coupons, inv] = await Promise.all([
    base.overview(ctx, range, outletIds, {}),
    base.itemsReport(ctx, range, outletIds),
    base.salesReport(ctx, range, outletIds, {}, []),
    couponsReport(ctx, range, outletIds).catch(() => ({ enabled: false })),
    inventoryReport(ctx, outletIds).catch(() => null),
  ]);
  const out = [];
  const add = (id, tone, title, text, value = null, weight = 5) => out.push({ id, tone, title, text, value, weight });
  const k = ov.kpis;
  const p = ov.previousKpis;
  const ch = pctChange(k.sales, p.sales);
  const rs = (paise) => `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.round(paise / 100))}`;
  if (k.orders === 0) {
    add("quiet", "info", "No sales in this period", "There are no paid orders in these dates yet. Pick a longer range, or check again after your first orders.", 0, 10);
    return { range, insights: out.slice(0, limit) };
  }
  if (ch !== null && Math.abs(ch) >= 5) add("sales-trend", ch > 0 ? "good" : "warn", ch > 0 ? "Sales are up" : "Sales are down", `${rs(k.sales)} against ${rs(p.sales)} in the period before — ${ch > 0 ? "up" : "down"} ${Math.abs(ch)}%.`, ch, 10);
  else if (ch !== null) add("sales-steady", "info", "Sales are steady", `${rs(k.sales)} against ${rs(p.sales)} before (${ch >= 0 ? "+" : ""}${ch}%).`, ch, 4);
  const aovCh = pctChange(k.aov, p.aov);
  if (aovCh !== null && Math.abs(aovCh) >= 5) add("aov", aovCh > 0 ? "good" : "warn", aovCh > 0 ? "Customers are spending more per order" : "Customers are spending less per order", `The average order is ${rs(k.aov)}, ${aovCh > 0 ? "up" : "down"} ${Math.abs(aovCh)}% on before.`, aovCh, 6);
  const rate = ov.cancellations.rate;
  if (rate >= 0.08) add("cancel-high", "warn", "Many orders are being cancelled", `${Math.round(rate * 1000) / 10}% of orders were cancelled (${ov.cancellations.cancelled} of ${ov.cancellations.placed}), about ${rs(ov.cancellations.lost)} of sales lost.`, rate, 9);
  else if (ov.previousCancellations.rate > 0 && rate < ov.previousCancellations.rate * 0.7) add("cancel-better", "good", "Fewer cancellations", `Cancellations fell to ${Math.round(rate * 1000) / 10}% from ${Math.round(ov.previousCancellations.rate * 1000) / 10}%.`, rate, 5);
  const top = it.items[0];
  if (top) add("top-item", "info", `${top.name} is your best seller`, `${top.qty} sold — ${Math.round(top.qtyShare * 100)}% of all items — bringing in ${rs(top.revenue)}.`, top.qty, 7);
  const risers = it.items.filter((r) => r.change !== null && r.previousQty >= 8).sort((a, b) => b.change - a.change);
  if (risers[0] && risers[0].change >= 25) add("riser", "good", `${risers[0].name} is selling faster`, `Up ${risers[0].change}% — ${risers[0].qty} sold against ${risers[0].previousQty} before.`, risers[0].change, 6);
  const fallers = [...risers].sort((a, b) => a.change - b.change);
  if (fallers[0] && fallers[0].change <= -25) add("faller", "warn", `${fallers[0].name} is selling slower`, `Down ${Math.abs(fallers[0].change)}% — ${fallers[0].qty} sold against ${fallers[0].previousQty} before.`, fallers[0].change, 6);
  if (it.unsold.length >= 3) add("unsold", "info", `${it.unsold.length} dishes did not sell at all`, `Nothing was ordered of ${it.unsold.slice(0, 3).join(", ")}${it.unsold.length > 3 ? ` and ${it.unsold.length - 3} more` : ""}. Consider a special offer, or taking them off the menu.`, it.unsold.length, 5);
  const bestDay = [...sales.weekdays].sort((a, b) => b.avgSales - a.avgSales)[0];
  if (bestDay && bestDay.avgSales > 0 && daysBetween(range.from, range.to) >= 14) add("best-day", "info", `${bestDay.name} is your best day`, `An average ${bestDay.name} brings in ${rs(bestDay.avgSales)} across ${bestDay.occurrences} of them.`, bestDay.avgSales, 4);
  const peak = ov.hourly.reduce((b, h) => (h.sales > b.sales ? h : b), ov.hourly[0]);
  if (peak && peak.sales > 0) add("peak-hour", "info", "Your busiest hour", `Most sales come between ${String(peak.hour).padStart(2, "0")}:00 and ${String((peak.hour + 1) % 24).padStart(2, "0")}:00 (${peak.orders} orders). Have your team and stock ready for it.`, peak.hour, 4);
  const nv = ov.newVsRepeat;
  if (nv.customers >= 10) add("repeat", nv.repeatCustomers / nv.customers >= 0.4 ? "good" : "info", `${Math.round((nv.repeatCustomers / nv.customers) * 100)}% of customers came back`, `${nv.repeatCustomers} returning and ${nv.newCustomers} new customers.`, nv.repeatCustomers / nv.customers, 5);
  if (coupons.enabled && coupons.totals.uses > 0) add("coupons", "info", `${coupons.coupons[0].code} is your most used coupon`, `${coupons.totals.uses} orders used a coupon (${Math.round(coupons.totals.shareOfOrders * 100)}%), giving away ${rs(coupons.totals.discount)}.`, coupons.totals.uses, 5);
  if (inv && (inv.totals.out > 0 || inv.totals.low > 0)) add("stock", "warn", `${inv.totals.out + inv.totals.low} dishes are out of stock or running low`, `${inv.items.filter((i) => i.state !== "ok").slice(0, 3).map((i) => i.name).join(", ")}${inv.totals.out + inv.totals.low > 3 ? " and more" : ""}.`, inv.totals.out + inv.totals.low, 8);
  out.sort((a, b) => b.weight - a.weight);
  return { range, insights: out.slice(0, limit).map(({ weight, ...rest }) => rest) };
}

/* ============================================================== expenses */

const OBJECT_ID = /^[a-f\d]{24}$/i;
const rupees = (paise) => Math.round(paise) / 100;

export const shapeExpense = (e, outletName = new Map()) => ({
  id: String(e._id),
  day: e.day,
  category: e.category,
  categoryLabel: labelOf(e.category),
  label: e.label || "",
  amount: rupees(e.amountPaise),
  outletId: e.outletId ?? null,
  outlet: e.outletId ? outletName.get(e.outletId) ?? "" : "Whole store",
  vendor: e.vendor || "",
  note: e.note || "",
  paymentMode: e.paymentMode || "cash",
  createdBy: e.createdByName || "",
  createdAt: e.createdAt,
});

/** A ledger match: the range of days, and the outlets (store-wide costs show only when every outlet is in view). */
function expenseMatch(ctx, range, outletIds, extra = {}) {
  return {
    brandId: ctx.brandId,
    day: { $gte: range.from, $lte: range.to },
    ...(outletIds.length ? { outletId: { $in: outletIds } } : {}),
    ...extra,
  };
}

async function outletNames(brandId) {
  const outlets = await OutletModel.find({ brandId }).select("name config.identity.name").lean();
  return new Map(outlets.map((o) => [String(o._id), o.config?.identity?.name || o.name]));
}

/** The ledger for a range: the entries (newest first, up to 500) and the sums — by category, outlet, payment mode and period — against the period before. */
export async function listExpenses(ctx, range, outletIds, { category = "" } = {}) {
  const prev = previousRange(range);
  const extra = category ? { category } : {};
  // the expenses chart groups by day (up to two months) or by month: a ledger day is a plain "YYYY-MM-DD" string
  const g = daysBetween(range.from, range.to) <= 62 ? "day" : "month";
  const bucketFormat = g === "day" ? "$day" : { $substrCP: ["$day", 0, 7] };
  const [rows, byCategory, byOutlet, byMode, byPeriod, byVendor, before, names] = await Promise.all([
    ExpenseModel.find(expenseMatch(ctx, range, outletIds, extra)).sort({ day: -1, createdAt: -1 }).limit(500).lean(),
    ExpenseModel.aggregate([{ $match: expenseMatch(ctx, range, outletIds, extra) }, { $group: { _id: "$category", amount: { $sum: "$amountPaise" }, entries: { $sum: 1 } } }, { $sort: { amount: -1 } }]),
    ExpenseModel.aggregate([{ $match: expenseMatch(ctx, range, outletIds, extra) }, { $group: { _id: { $ifNull: ["$outletId", null] }, amount: { $sum: "$amountPaise" }, entries: { $sum: 1 } } }, { $sort: { amount: -1 } }]),
    ExpenseModel.aggregate([{ $match: expenseMatch(ctx, range, outletIds, extra) }, { $group: { _id: "$paymentMode", amount: { $sum: "$amountPaise" } } }, { $sort: { amount: -1 } }]),
    ExpenseModel.aggregate([{ $match: expenseMatch(ctx, range, outletIds, extra) }, { $group: { _id: bucketFormat, amount: { $sum: "$amountPaise" } } }]),
    ExpenseModel.aggregate([{ $match: expenseMatch(ctx, range, outletIds, { ...extra, vendor: { $ne: "" } }) }, { $group: { _id: { $toLower: "$vendor" }, name: { $first: "$vendor" }, amount: { $sum: "$amountPaise" }, entries: { $sum: 1 } } }, { $sort: { amount: -1 } }, { $limit: 8 }]),
    ExpenseModel.aggregate([{ $match: expenseMatch(ctx, prev, outletIds, extra) }, { $group: { _id: null, amount: { $sum: "$amountPaise" } } }]),
    outletNames(ctx.brandId),
  ]);
  const total = byCategory.reduce((s, r) => s + r.amount, 0);
  const prevTotal = before[0]?.amount ?? 0;
  const periodMap = new Map(byPeriod.map((r) => [r._id, r.amount]));
  const series = base.bucketsOf(range, g).map((b) => ({ key: b, amount: rupees(periodMap.get(b) ?? 0) }));
  return {
    range,
    previous: prev,
    granularity: g,
    entries: rows.map((e) => shapeExpense(e, names)),
    totals: { amount: rupees(total), entries: byCategory.reduce((s, r) => s + r.entries, 0), previous: rupees(prevTotal), change: pctChange(total, prevTotal), perDay: rupees(total / daysBetween(range.from, range.to)) },
    byCategory: byCategory.map((r) => ({ category: r._id, label: labelOf(r._id), amount: rupees(r.amount), entries: r.entries, share: total ? r.amount / total : 0 })),
    byOutlet: byOutlet.map((r) => ({ id: r._id, name: r._id ? names.get(r._id) ?? r._id : "Whole store", amount: rupees(r.amount), entries: r.entries })),
    byPaymentMode: byMode.map((r) => ({ id: r._id, label: PAYMENT_MODES.find((m) => m.id === r._id)?.label ?? r._id, amount: rupees(r.amount) })),
    byVendor: byVendor.map((r) => ({ name: r.name, amount: rupees(r.amount), entries: r.entries })),
    series,
  };
}

/** Totals by category for a range, in rupees: what the profit & loss uses when it works from recorded expenses. */
export async function recordedByCategory(ctx, range, outletIds) {
  const rows = await ExpenseModel.aggregate([{ $match: expenseMatch(ctx, range, outletIds) }, { $group: { _id: "$category", amount: { $sum: "$amountPaise" } } }, { $sort: { amount: -1 } }]);
  return rows.map((r) => ({ key: r._id, label: labelOf(r._id), amount: rupees(r.amount) }));
}

async function checkOutlet(ctx, outletId, user) {
  if (!outletId) return null;
  if (!OBJECT_ID.test(String(outletId)) || !(await OutletModel.exists({ _id: outletId, brandId: ctx.brandId }))) throw new HttpError(400, "That outlet doesn't belong to your store.");
  // a person limited to some outlets can't write costs for others
  const m = user?.memberships?.find((x) => x.brandId === ctx.brandId);
  if (m?.outletIds?.length && !m.outletIds.includes(String(outletId))) throw new HttpError(403, "You can't write expenses for that outlet.");
  return String(outletId);
}

export async function createExpense(ctx, user, input) {
  const outletId = await checkOutlet(ctx, input.outletId, user);
  const m = user?.memberships?.find((x) => x.brandId === ctx.brandId);
  if (!outletId && m?.outletIds?.length) throw new HttpError(403, "Pick one of your outlets — whole-store costs are for people who see every outlet.");
  const doc = await ExpenseModel.create({
    brandId: ctx.brandId,
    ...(outletId ? { outletId } : {}),
    day: input.day,
    category: input.category,
    label: input.label,
    amountPaise: Math.round(input.amount * 100),
    vendor: input.vendor,
    note: input.note,
    paymentMode: input.paymentMode,
    createdBy: String(user?._id ?? user?.id ?? ""),
    createdByName: user?.name ?? "",
  });
  return shapeExpense(doc.toObject(), await outletNames(ctx.brandId));
}

async function loadExpense(ctx, id) {
  if (!OBJECT_ID.test(String(id))) throw new HttpError(404, "Expense not found");
  const e = await ExpenseModel.findOne({ _id: id, brandId: ctx.brandId });
  if (!e) throw new HttpError(404, "Expense not found");
  return e;
}

export async function updateExpense(ctx, user, id, input) {
  const e = await loadExpense(ctx, id);
  const outletId = await checkOutlet(ctx, input.outletId, user);
  e.day = input.day;
  e.category = input.category;
  e.label = input.label;
  e.amountPaise = Math.round(input.amount * 100);
  e.vendor = input.vendor;
  e.note = input.note;
  e.paymentMode = input.paymentMode;
  e.outletId = outletId ?? undefined;
  await e.save();
  return shapeExpense(e.toObject(), await outletNames(ctx.brandId));
}

export async function deleteExpense(ctx, id) {
  await loadExpense(ctx, id); // a 404 when it is not this store's
  await ExpenseModel.deleteOne({ _id: id, brandId: ctx.brandId });
  return { id: String(id) };
}

/* ================================================================= goals */

/** The monthly sales target of the store, and how this month is going against it (so far, at this pace, what is needed per day). */
export async function goalProgress(ctx, outletIds, { now = new Date() } = {}) {
  const row = await AnalyticsProfileModel.findOne({ brandId: ctx.brandId, key: "goals" }).lean();
  const target = num(row?.data?.monthlySales);
  const today = dayKey(now);
  const [y, m] = today.split("-").map(Number);
  const monthStart = `${y}-${String(m).padStart(2, "0")}-01`;
  const monthDays = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const monthEnd = `${y}-${String(m).padStart(2, "0")}-${String(monthDays).padStart(2, "0")}`;
  const elapsed = Number(today.slice(8));
  const k = await base.kpis(ctx, { from: monthStart, to: today }, outletIds);
  const soFar = k.sales / 100; // sales as the dashboard counts them (what customers paid, GST included)
  const projected = elapsed > 0 ? (soFar / elapsed) * monthDays : 0;
  const left = Math.max(0, monthDays - elapsed);
  return {
    goal: { monthlySales: target || null },
    month: { from: monthStart, to: monthEnd, days: monthDays, elapsed, left },
    soFar,
    projected: Math.round(projected),
    pct: target ? Math.round((soFar / target) * 1000) / 10 : null,
    onTrack: target ? projected >= target : null,
    neededPerDay: target && left > 0 ? Math.max(0, Math.round((target - soFar) / left)) : null,
    avgPerDay: elapsed ? Math.round(soFar / elapsed) : 0,
  };
}

export async function setGoal(ctx, userId, monthlySales) {
  await AnalyticsProfileModel.findOneAndUpdate({ brandId: ctx.brandId, key: "goals" }, { $set: { data: { monthlySales: monthlySales || null }, savedBy: userId } }, { upsert: true });
}
