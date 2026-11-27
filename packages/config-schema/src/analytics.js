import { z } from "zod";

/**
 * Analytics — what the store sold, to whom, when, and what is left over after the bills.
 * Shared by the API (which does the sums) and the dashboard (which draws and, for the profit calculator, adds up
 * the owner's own expenses), so a number can never be worked out two different ways.
 *
 * Days are Indian days: an order at 11:40 pm belongs to that day, not the next one in UTC.
 */

export const ANALYTICS_TZ = "Asia/Kolkata";
const IST_MS = 330 * 60_000;

/* -------------------------------------------------------------------- days */

const pad = (n) => String(n).padStart(2, "0");

/** "2026-11-16" — the Indian calendar day of a moment. */
export function dayKey(date) {
  const d = new Date(new Date(date).getTime() + IST_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
/** The moment an Indian day starts (midnight there), as a Date. */
export const dayStart = (key) => new Date(Date.parse(`${key}T00:00:00.000Z`) - IST_MS);
/** The first moment AFTER an Indian day (the next midnight). */
export const dayEnd = (key) => new Date(dayStart(key).getTime() + 86_400_000);
export const addDays = (key, n) => dayKey(new Date(dayStart(key).getTime() + n * 86_400_000 + 3_600_000));
export const daysBetween = (from, to) => Math.round((dayStart(to) - dayStart(from)) / 86_400_000) + 1;
/** 0 = Sunday … 6 = Saturday, for an Indian day. */
export const weekdayOf = (key) => new Date(`${key}T12:00:00.000Z`).getUTCDay();
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** A real calendar day: "2026-02-30" has the right shape but is not a day. */
const isRealDay = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
};
const dayString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-11-16").refine(isRealDay, "That is not a real date");

/** A range of whole days, both ends included. At most about three years, so one request can't read the whole database. */
export const analyticsRangeSchema = z
  .object({ from: dayString, to: dayString })
  .refine((r) => r.from <= r.to, { message: "The start date is after the end date" })
  .refine((r) => daysBetween(r.from, r.to) <= 1100, { message: "Pick a range of up to 3 years" });

/** The same number of days straight before a range — what "compared with the previous period" means. */
export function previousRange({ from, to }) {
  const n = daysBetween(from, to);
  return { from: addDays(from, -n), to: addDays(from, -1) };
}

export const RANGE_PRESETS = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last7", label: "Last 7 days" },
  { id: "last30", label: "Last 30 days" },
  { id: "thisWeek", label: "This week" },
  { id: "lastWeek", label: "Last week" },
  { id: "thisMonth", label: "This month" },
  { id: "lastMonth", label: "Last month" },
  { id: "thisYear", label: "This year" },
  { id: "lastYear", label: "Last year" },
];

/** A preset as a range (weeks run Monday to Sunday). */
export function presetRange(id, now = new Date()) {
  const today = dayKey(now);
  const [y, m] = today.split("-").map(Number);
  const monday = (key) => addDays(key, -((weekdayOf(key) + 6) % 7));
  const lastDayOfMonth = (yy, mm) => `${yy}-${pad(mm)}-${pad(new Date(Date.UTC(yy, mm, 0)).getUTCDate())}`;
  switch (id) {
    case "today": return { from: today, to: today };
    case "yesterday": return { from: addDays(today, -1), to: addDays(today, -1) };
    case "last7": return { from: addDays(today, -6), to: today };
    case "last30": return { from: addDays(today, -29), to: today };
    case "thisWeek": return { from: monday(today), to: addDays(monday(today), 6) };
    case "lastWeek": return { from: addDays(monday(today), -7), to: addDays(monday(today), -1) };
    case "thisMonth": return { from: `${y}-${pad(m)}-01`, to: lastDayOfMonth(y, m) };
    case "lastMonth": { const pm = m === 1 ? 12 : m - 1; const py = m === 1 ? y - 1 : y; return { from: `${py}-${pad(pm)}-01`, to: lastDayOfMonth(py, pm) }; }
    case "thisYear": return { from: `${y}-01-01`, to: `${y}-12-31` };
    case "lastYear": return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
    default: return { from: addDays(today, -29), to: today };
  }
}

/** How many "months" of a monthly bill a range costs: each day pays its month's share (so a calendar month is exactly 1). */
export function monthsInRange({ from, to }) {
  let total = 0;
  for (let k = from; k <= to; k = addDays(k, 1)) {
    const [y, m] = k.split("-").map(Number);
    total += 1 / new Date(Date.UTC(y, m, 0)).getUTCDate();
  }
  return total;
}

/* -------------------------------------------------------- what counts as a sale */

/**
 * A SALE is an order that wasn't cancelled and has been paid (cash orders are marked paid when completed, online
 * orders when the money arrives) — the same rule as the dashboard's "revenue today".
 * Money is in paise. "Net sales" leaves out the GST, which is the government's, not the store's.
 */
export const SALES_MATCH = { status: { $ne: "cancelled" }, "payment.status": "paid" };

/* ---------------------------------------------------------------- expenses */

/** The usual monthly bills — the owner can rename, remove or add their own. `scope` says where they usually belong. */
export const EXPENSE_LINES = [
  { key: "rent", label: "Rent", scope: "outlet" },
  { key: "salaries", label: "Staff salaries", scope: "outlet" },
  { key: "electricity", label: "Electricity", scope: "outlet" },
  { key: "water", label: "Water", scope: "outlet" },
  { key: "gas", label: "Gas / fuel", scope: "outlet" },
  { key: "internet", label: "Internet & phone", scope: "outlet" },
  { key: "packaging", label: "Packaging", scope: "outlet" },
  { key: "maintenance", label: "Repairs & maintenance", scope: "outlet" },
  { key: "marketing", label: "Marketing & ads", scope: "store" },
  { key: "software", label: "Software & subscriptions", scope: "store" },
  { key: "licences", label: "Licences & insurance", scope: "store" },
  { key: "other", label: "Other", scope: "store" },
];

/**
 * The expenses LEDGER: bills the owner writes down on the day they are paid (vegetables bought, a repair, the electricity bill), as opposed to
 * the monthly ESTIMATES above that the profit calculator spreads over a range. A ledger entry's category is one of these keys.
 */
export const LEDGER_CATEGORIES = [
  { key: "raw_materials", label: "Raw materials & groceries" },
  { key: "vegetables_dairy", label: "Vegetables, dairy & meat" },
  ...EXPENSE_LINES.map(({ key, label }) => ({ key, label })),
];
export const LEDGER_CATEGORY_KEYS = LEDGER_CATEGORIES.map((c) => c.key);
export const PAYMENT_MODES = [
  { id: "cash", label: "Cash" },
  { id: "upi", label: "UPI" },
  { id: "card", label: "Card" },
  { id: "bank", label: "Bank transfer" },
  { id: "other", label: "Other" },
];

/** What a person sends to write an expense down (money in rupees, written to the ledger as paise). `outletId: null` = a cost of the whole store. */
export const expenseInputSchema = z.object({
  day: dayString,
  amount: z
    .number({ invalid_type_error: "Enter the amount in rupees", required_error: "Enter the amount in rupees" })
    .positive("The amount must be more than 0")
    .max(10_000_000, "That amount looks too big — check the number")
    .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, "Use at most two decimals (paise)"),
  category: z.string().min(1, "Pick a category").max(40),
  label: z.string().trim().max(80, "Keep the title under 80 characters").default(""),
  outletId: z.string().max(40).nullable().default(null),
  vendor: z.string().trim().max(80, "Keep the vendor under 80 characters").default(""),
  note: z.string().trim().max(300, "Keep the note under 300 characters").default(""),
  paymentMode: z.enum(["cash", "upi", "card", "bank", "other"]).default("cash"),
});

/** The sales target an owner sets: a monthly amount for the whole store (rupees), 0/null = none. */
export const salesGoalSchema = z.object({
  monthlySales: z.number().min(0).max(1e10).nullable().default(null),
});

export const DEFAULT_FOOD_COST_PCT = 35;
export const DEFAULT_STOCK_SAFETY_PCT = 15;

/**
 * The profit calculator. All money in rupees here (what the owner types), except `netSales` which is paise from the
 * server — converted once, at the top. `expenses`: [{ label, monthly }] (monthly amounts).
 */
export function computeProfitLoss({ netSalesPaise, foodCostPct, expenses, range }) {
  const sales = (netSalesPaise ?? 0) / 100;
  const foodCost = (sales * Math.max(0, Math.min(100, Number(foodCostPct) || 0))) / 100;
  const grossProfit = sales - foodCost;
  const months = monthsInRange(range);
  const lines = (expenses ?? [])
    .map((e) => ({ label: e.label, monthly: Number(e.monthly) || 0, cost: (Number(e.monthly) || 0) * months }))
    .filter((l) => l.monthly > 0);
  const totalExpenses = lines.reduce((s, l) => s + l.cost, 0);
  const net = grossProfit - totalExpenses;
  const days = daysBetween(range.from, range.to);
  return {
    sales,
    foodCost,
    grossProfit,
    lines,
    totalExpenses,
    net,
    marginPct: sales > 0 ? (net / sales) * 100 : null,
    days,
    months,
    /** the sales needed just to cover the food cost and the bills: expenses ÷ (1 − food-cost share) */
    breakEvenSales: foodCostPct < 100 ? totalExpenses / (1 - (Number(foodCostPct) || 0) / 100) : null,
    breakEvenPerDay: foodCostPct < 100 ? totalExpenses / (1 - (Number(foodCostPct) || 0) / 100) / days : null,
  };
}

/**
 * The same profit calculation, but from expenses that were actually RECORDED in the range (the ledger) instead of monthly estimates.
 * `recorded`: [{ label, amount }] in rupees, already summed for the range. Same answer shape as {@link computeProfitLoss}
 * (`months` is the range in months; each line's `monthly` is what that cost per month on average over the range).
 */
export function computeProfitLossRecorded({ netSalesPaise, foodCostPct, recorded, range }) {
  const sales = (netSalesPaise ?? 0) / 100;
  const pct = Math.max(0, Math.min(100, Number(foodCostPct) || 0));
  const foodCost = (sales * pct) / 100;
  const grossProfit = sales - foodCost;
  const months = monthsInRange(range) || 1;
  const lines = (recorded ?? [])
    .map((e) => ({ label: e.label, cost: Number(e.amount) || 0, monthly: (Number(e.amount) || 0) / months }))
    .filter((l) => l.cost > 0);
  const totalExpenses = lines.reduce((s, l) => s + l.cost, 0);
  const net = grossProfit - totalExpenses;
  const days = daysBetween(range.from, range.to);
  return {
    sales, foodCost, grossProfit, lines, totalExpenses, net,
    marginPct: sales > 0 ? (net / sales) * 100 : null,
    days, months,
    breakEvenSales: pct < 100 ? totalExpenses / (1 - pct / 100) : null,
    breakEvenPerDay: pct < 100 ? totalExpenses / (1 - pct / 100) / days : null,
  };
}

/* ------------------------------------------------------------------ exports */

export const EXPORT_FORMATS = [
  { id: "xlsx", label: "Excel", ext: "xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", help: "Every section as its own sheet." },
  { id: "csv", label: "CSV", ext: "csv", mime: "text/csv", help: "One section as a plain table, for any spreadsheet." },
  { id: "pdf", label: "PDF", ext: "pdf", mime: "application/pdf", help: "A printable summary report." },
  { id: "json", label: "JSON", ext: "json", mime: "application/json", help: "Everything, for other software." },
];

/** The sections a report can hold. `csv: true` = can be chosen as the one table of a CSV. */
export const EXPORT_SECTIONS = [
  { id: "summary", label: "Summary", csv: true },
  { id: "daily", label: "Sales by day", csv: true },
  { id: "hourly", label: "Sales by hour", csv: true },
  { id: "items", label: "Items sold", csv: true },
  { id: "channels", label: "Order types", csv: true },
  { id: "payments", label: "Payment methods", csv: true },
  { id: "gst", label: "GST", csv: true },
  { id: "outlets", label: "Outlets compared", csv: true },
  { id: "customers", label: "Top customers", csv: true },
  { id: "coupons", label: "Coupon usage", csv: true },
  { id: "reservations", label: "Table reservations", csv: true },
  { id: "orders", label: "Every order", csv: true },
  { id: "pnl", label: "Profit & loss", csv: true, finance: true },
  { id: "expenses", label: "Expenses recorded", csv: true, finance: true },
];

export const exportRequestSchema = z.object({
  format: z.enum(["xlsx", "csv", "pdf", "json"]),
  from: dayString,
  to: dayString,
  /** [] = the whole store */
  outletIds: z.array(z.string()).default([]),
  sections: z.array(z.string()).default([]),
  /** for a CSV: the one section to export */
  section: z.string().default("daily"),
  /** the profit & loss inputs, typed by the owner (never stored by the export) */
  pnl: z
    .object({
      foodCostPct: z.number().min(0).max(100),
      /** "monthly" = the owner's monthly estimates (`expenses`); "recorded" = the bills written in the expenses ledger for the range (the server reads them) */
      mode: z.enum(["monthly", "recorded"]).default("monthly"),
      expenses: z.array(z.object({ label: z.string().max(80), monthly: z.number().min(0).max(1e9) })).max(60).default([]),
    })
    .nullable()
    .default(null),
});
