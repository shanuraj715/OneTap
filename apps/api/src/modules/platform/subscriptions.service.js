import { planMarketingSchema, planPrices } from "@rasoipulse/config-schema";
import { BrandModel, PlanModel, SubscriptionPaymentModel } from "@rasoipulse/db";
import { HttpError } from "../../middleware/error.js";
import { addMonths, daysIn, DAY_MS, istParts, istStart, MONTH_NAMES, monthKey, pct } from "./dashboard.service.js";
import { listStores } from "./platform.service.js";

/**
 * Rasoi Pulse's OWN sales: what the stores pay for their subscription. There is no billing in the app (a store pays outside it), so the
 * platform team writes each payment down (see packages/db/src/models/subscription.js) and everything here is worked out from that list:
 *
 *   new sale          the FIRST payment a store ever made (by the day it was paid)
 *   re-subscription  every later payment of the same store
 *   paid until        each payment buys `months` of service, counted on from where the last one ended (an early renewal does not waste days)
 *
 * This is the product's business, not store data: nothing here reads a store's orders. Money goes out in rupees (stored as paise);
 * days are Indian calendar days.
 */

const OBJECT_ID = /^[a-f\d]{24}$/i;
const idOr404 = (id, what) => {
  if (!OBJECT_ID.test(String(id))) throw new HttpError(404, `${what} not found`);
  return String(id);
};
const rupees = (paise) => Math.round(paise) / 100;
/** "2026-11-28" for a moment, in Indian time */
const dayKey = (date) => {
  const { y, m, d } = istParts(date);
  return `${monthKey(y, m)}-${String(d).padStart(2, "0")}`;
};
const todayStart = (now) => {
  const { y, m, d } = istParts(now);
  return istStart(y, m, d);
};
/** The moment `months` months after the Indian day `date` falls on (the same day number, or the month's last day). */
function plusMonths(date, months) {
  const { y, m, d } = istParts(date);
  const t = addMonths(y, m, months);
  return istStart(t.y, t.m, Math.min(d, daysIn(t.y, t.m)));
}
/** The start of the Monday of the Indian week a moment falls in. */
function weekStart(date) {
  const { y, m, d } = istParts(date);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return istStart(y, m, d - ((dow + 6) % 7));
}

/* ----------------------------------------------------------- working it out */

/**
 * Every payment with what can be worked out about it: new or re-subscription, and the days it covers. `rows` are plain payments (any
 * order). The result is sorted by the day paid, oldest first.
 */
function annotate(rows) {
  const byStore = new Map();
  for (const row of [...rows].sort((a, b) => a.paidOn - b.paidOn || a.createdAt - b.createdAt)) {
    const key = String(row.storeId);
    if (!byStore.has(key)) byStore.set(key, []);
    byStore.get(key).push(row);
  }
  const out = [];
  const ends = new Map(); // the end of each store's cover (the first day NOT covered)
  for (const [storeId, list] of byStore) {
    let end = null;
    list.forEach((row, i) => {
      const from = end && end > row.paidOn ? end : row.paidOn;
      end = plusMonths(from, row.months);
      out.push({ row, kind: i === 0 ? "new" : "renewal", coversFrom: from, coversEnd: end });
    });
    ends.set(storeId, end);
  }
  out.sort((a, b) => a.row.paidOn - b.row.paidOn || a.row.createdAt - b.row.createdAt);
  return { payments: out, ends };
}

const shapePayment = (p) => ({
  id: String(p.row._id),
  storeId: String(p.row.storeId),
  storeName: p.row.storeName,
  planId: p.row.planId ? String(p.row.planId) : null,
  planName: p.row.planName || "",
  amount: rupees(p.row.amountPaise),
  months: p.row.months,
  paidOn: dayKey(p.row.paidOn),
  kind: p.kind, // "new" | "renewal"
  coversFrom: dayKey(p.coversFrom),
  coversTo: dayKey(new Date(p.coversEnd.getTime() - DAY_MS)), // the last day covered
  note: p.row.note || "",
  recordedBy: p.row.recordedByName || "",
  createdAt: p.row.createdAt,
});

/** Where a store stands: paying until a day, expired since a day, or never paid. */
function standingOf(end, now) {
  if (!end) return { state: "never", paidUntil: null, daysLeft: null };
  const left = Math.round((end.getTime() - todayStart(now).getTime()) / DAY_MS); // whole days still covered, counting today
  return { state: left > 0 ? "active" : "expired", paidUntil: dayKey(new Date(end.getTime() - DAY_MS)), daysLeft: left };
}

/* ------------------------------------------------------------- one store */

async function loadStore(storeId) {
  const brand = await BrandModel.findById(idOr404(storeId, "Store")).lean();
  if (!brand) throw new HttpError(404, "Store not found");
  return brand;
}

/** What the payment form can offer as a starting amount: the store's current plan's listed price. */
async function suggestion(brand) {
  const plan = brand.planId && OBJECT_ID.test(brand.planId) ? await PlanModel.findById(brand.planId).lean() : null;
  if (!plan) return { planId: null, planName: "", monthly: 0, yearly: 0 };
  const prices = planPrices(planMarketingSchema.parse(plan.marketing ?? {}));
  return { planId: String(plan._id), planName: plan.name, monthly: prices.monthly, yearly: prices.yearly?.total ?? 0 };
}

/** A store's payments, newest first, and where it stands. */
export async function listStorePayments(storeId, { now = new Date() } = {}) {
  const brand = await loadStore(storeId);
  const rows = await SubscriptionPaymentModel.find({ storeId: brand._id }).lean();
  const { payments, ends } = annotate(rows);
  const shaped = payments.map(shapePayment).reverse();
  return {
    storeId: String(brand._id),
    storeName: brand.name,
    payments: shaped,
    standing: standingOf(ends.get(String(brand._id)) ?? null, now),
    total: rupees(rows.reduce((sum, r) => sum + r.amountPaise, 0)),
    suggest: await suggestion(brand),
  };
}

/** Write a payment down. The date is the day the money arrived (today or earlier); the amount is in rupees. */
export async function recordPayment(storeId, input, actor, { now = new Date() } = {}) {
  const brand = await loadStore(storeId);
  const paidOn = istStart(...input.paidOn.split("-").map(Number));
  if (paidOn.getTime() > todayStart(now).getTime()) throw new HttpError(400, "The payment date can't be in the future — use the day the money arrived");
  const amountPaise = Math.round(input.amount * 100);

  const planId = input.planId ?? brand.planId ?? null;
  const plan = planId && OBJECT_ID.test(String(planId)) ? await PlanModel.findById(planId).lean() : null;
  if (input.planId && !plan) throw new HttpError(400, "That plan doesn't exist");

  // the same amount for the same store on the same day is almost certainly a second click
  if (await SubscriptionPaymentModel.exists({ storeId: brand._id, paidOn, amountPaise })) {
    throw new HttpError(409, "This exact payment (same store, day and amount) is already written down. To record a longer period, change the number of months instead.");
  }
  const created = await SubscriptionPaymentModel.create({
    storeId: brand._id,
    storeName: brand.name,
    planId: plan?._id ?? null,
    planName: plan?.name ?? "",
    amountPaise,
    months: input.months,
    paidOn,
    note: input.note ?? "",
    recordedById: actor?._id ? String(actor._id) : "",
    recordedByName: actor?.name ?? "",
  });
  const listing = await listStorePayments(storeId, { now });
  return { payment: listing.payments.find((p) => p.id === String(created._id)), ...listing };
}

/** Take a wrongly written payment off the list. */
export async function deletePayment(storeId, paymentId, { now = new Date() } = {}) {
  const brand = await loadStore(storeId);
  const found = await SubscriptionPaymentModel.findOneAndDelete({ _id: idOr404(paymentId, "Payment"), storeId: brand._id });
  if (!found) throw new HttpError(404, "Payment not found");
  return listStorePayments(storeId, { now });
}

/* ------------------------------------------------------------- the business */

/**
 * `count` equal stretches of time ending with the one that holds `now`, oldest first. A stretch is a day, a Monday-to-Sunday week or a
 * month; `back` skips that many whole stretches (the comparison period is the same number of stretches, just earlier).
 */
function stretches(unit, count, now, back = 0) {
  const { y, m } = istParts(now);
  const starts = [];
  for (let i = count - 1; i >= 0; i--) {
    const k = i + back;
    if (unit === "day") {
      const t = todayStart(now);
      const p = istParts(new Date(t.getTime() - k * DAY_MS + 12 * 3_600_000));
      starts.push(istStart(p.y, p.m, p.d));
    } else if (unit === "week") {
      const w = weekStart(now);
      const p = istParts(new Date(w.getTime() - k * 7 * DAY_MS + 12 * 3_600_000));
      starts.push(istStart(p.y, p.m, p.d));
    } else {
      const t = addMonths(y, m, -k);
      starts.push(istStart(t.y, t.m, 1));
    }
  }
  const next = (s) => {
    const p = istParts(s);
    if (unit === "day") return istStart(p.y, p.m, p.d + 1);
    if (unit === "week") return istStart(p.y, p.m, p.d + 7);
    const t = addMonths(p.y, p.m, 1);
    return istStart(t.y, t.m, 1);
  };
  return starts.map((start) => {
    const p = istParts(start);
    const label = unit === "month" ? `${MONTH_NAMES[p.m - 1]}${p.m === 1 ? ` ${String(p.y).slice(2)}` : ""}` : `${p.d} ${MONTH_NAMES[p.m - 1]}`;
    return { start, end: next(start), label, date: dayKey(start) };
  });
}

/** One chart: this period against the one before it, with the new / re-subscription split of this period. */
function series(unit, count, payments, now) {
  const current = stretches(unit, count, now);
  const previous = stretches(unit, count, now, count);
  const sum = (b, pick) => payments.filter((p) => p.row.paidOn >= b.start && p.row.paidOn < b.end && pick(p)).reduce((s, p) => s + p.row.amountPaise, 0);
  const all = () => true;
  const cur = current.map((b) => sum(b, all));
  const prev = previous.map((b) => sum(b, all));
  const total = cur.reduce((a, b) => a + b, 0);
  const prevTotal = prev.reduce((a, b) => a + b, 0);
  const inWindow = payments.filter((p) => p.row.paidOn >= current[0].start && p.row.paidOn < current[count - 1].end);
  return {
    unit,
    labels: current.map((b) => b.label),
    dates: current.map((b) => b.date),
    previousLabels: previous.map((b) => b.label),
    current: cur.map(rupees),
    previous: prev.map(rupees),
    newAmount: current.map((b) => rupees(sum(b, (p) => p.kind === "new"))),
    renewalAmount: current.map((b) => rupees(sum(b, (p) => p.kind === "renewal"))),
    total: rupees(total),
    previousTotal: rupees(prevTotal),
    changePct: pct(total, prevTotal),
    newCount: inWindow.filter((p) => p.kind === "new").length,
    renewalCount: inWindow.filter((p) => p.kind === "renewal").length,
  };
}

const sumOf = (list) => list.reduce((s, p) => s + p.row.amountPaise, 0);

/**
 * The product's numbers for the platform dashboard. Everything is rupees.
 *   totals     all the money taken so far, and how many shops have ever paid
 *   newSales   shops that bought for the first time          (all time)
 *   renewals   payments that were not a shop's first         (all time)
 *   month      this month so far, against the same days of last month
 *   standing   shops paid up, run out (not renewed), about to run out, and shops with no payment written down yet
 *   series     one chart each for the last 30 days, 12 weeks and 12 months, each against the period before it
 */
export async function businessAnalytics({ now = new Date() } = {}) {
  const [rows, stores] = await Promise.all([SubscriptionPaymentModel.find({}).lean(), listStores()]);
  const { payments, ends } = annotate(rows);
  const live = new Map(stores.map((s) => [s.id, s]));

  const news = payments.filter((p) => p.kind === "new");
  const renewals = payments.filter((p) => p.kind === "renewal");

  const { y, m, d } = istParts(now);
  const monthStart = istStart(y, m, 1);
  const prev = addMonths(y, m, -1);
  const prevStart = istStart(prev.y, prev.m, 1);
  const sameDaysEnd = istStart(prev.y, prev.m, Math.min(d, daysIn(prev.y, prev.m)) + 1);
  const inRange = (list, from, to) => list.filter((p) => p.row.paidOn >= from && p.row.paidOn < to);
  const thisNew = inRange(news, monthStart, new Date(8.64e15));
  const thisRenew = inRange(renewals, monthStart, new Date(8.64e15));
  const sameDaysLast = inRange(payments, prevStart, sameDaysEnd);

  const standings = stores.map((s) => ({ store: s, ...standingOf(ends.get(s.id) ?? null, now) }));
  const byPlan = new Map();
  for (const s of standings) {
    if (s.state !== "active") continue;
    const name = s.store.plan?.name ?? "No plan";
    byPlan.set(name, { name, activeShops: (byPlan.get(name)?.activeShops ?? 0) + 1, amount: 0 });
  }
  for (const p of payments) {
    const name = p.row.planName || "No plan";
    const row = byPlan.get(name) ?? { name, activeShops: 0, amount: 0 };
    row.amount += p.row.amountPaise;
    byPlan.set(name, row);
  }

  const unrecorded = standings.filter((s) => s.state === "never");
  return {
    generatedAt: now.toISOString(),
    today: { year: y, month: m, day: d, label: `${d} ${MONTH_NAMES[m - 1]} ${y}` },
    totals: {
      sales: rupees(sumOf(payments)),
      payments: payments.length,
      shops: news.length,
      averagePerShop: news.length ? rupees(sumOf(payments) / news.length) : 0,
    },
    newSales: { shops: news.length, amount: rupees(sumOf(news)) },
    renewals: { payments: renewals.length, shops: new Set(renewals.map((p) => String(p.row.storeId))).size, amount: rupees(sumOf(renewals)) },
    month: {
      label: `${MONTH_NAMES[m - 1]} ${y}`,
      sales: rupees(sumOf(thisNew) + sumOf(thisRenew)),
      newShops: thisNew.length,
      newAmount: rupees(sumOf(thisNew)),
      renewals: thisRenew.length,
      renewalAmount: rupees(sumOf(thisRenew)),
      samePeriodLastMonth: rupees(sumOf(sameDaysLast)),
      changePct: pct(sumOf(thisNew) + sumOf(thisRenew), sumOf(sameDaysLast)),
    },
    standing: {
      active: standings.filter((s) => s.state === "active").length,
      expired: standings.filter((s) => s.state === "expired").length,
      expiringSoon: standings.filter((s) => s.state === "active" && s.daysLeft <= 14).length,
      neverPaid: unrecorded.length,
      neverPaidStores: unrecorded.slice(0, 6).map((s) => ({ id: s.store.id, name: s.store.name })),
      expiredStores: standings.filter((s) => s.state === "expired").slice(0, 6).map((s) => ({ id: s.store.id, name: s.store.name, paidUntil: s.paidUntil })),
    },
    series: { day: series("day", 30, payments, now), week: series("week", 12, payments, now), month: series("month", 12, payments, now) },
    byPlan: [...byPlan.values()].map((p) => ({ ...p, amount: rupees(p.amount) })).sort((a, b) => b.amount - a.amount || b.activeShops - a.activeShops),
    recent: payments
      .slice(-8)
      .reverse()
      .map((p) => ({ ...shapePayment(p), storeDeleted: !live.has(String(p.row.storeId)) })),
  };
}
