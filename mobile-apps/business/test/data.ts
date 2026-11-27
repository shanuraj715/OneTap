import type { Call, Handler } from "./harness";
import { fakeServer } from "./harness";
import { AccessibilityInfo } from "react-native";
import { presetRange } from "../src/lib/dates";
import { useScope } from "../src/data/scope";

/** Made-up answers of the store API, in the shapes the real server sends. Two outlets: Noida and Delhi. */
export const OUTLETS = [{ id: "o1", name: "Noida", slug: "noida", brandName: "Acme Momos", config: { identity: { name: "Acme Noida" } } }, { id: "o2", name: "Delhi", slug: "delhi", brandName: "Acme Momos", config: { identity: { name: "Acme Delhi" } } }];

export const queryOf = (call: Call): Record<string, string> => Object.fromEntries(new URLSearchParams(call.query));

export const kpis = (over: Partial<Record<string, number>> = {}) => ({ orders: 120, sales: 5_000_000, net: 4_750_000, tax: 250_000, discount: 100_000, coins: 0, delivery: 0, service: 0, items: 300, customers: 80, aov: 41_667, ...over });

export const overview = (over: Record<string, unknown> = {}) => ({
  range: { from: "2026-10-30", to: "2026-11-28" }, previous: { from: "2026-09-30", to: "2026-10-29" }, granularity: "day",
  kpis: kpis(), previousKpis: kpis({ orders: 100, sales: 4_000_000, net: 3_800_000, aov: 40_000, discount: 120_000, customers: 70, items: 250 }),
  cancellations: { placed: 130, cancelled: 10, lost: 300_000, rate: 10 / 130 }, previousCancellations: { placed: 110, cancelled: 5, lost: 100_000, rate: 5 / 110 },
  newVsRepeat: { customers: 80, newCustomers: 30, repeatCustomers: 50 },
  series: [0, 1, 2, 3, 4].map((i) => ({ key: `2026-11-${24 + i}`, sales: 900_000 + i * 50_000, net: 850_000, orders: 20 + i })),
  hourly: Array.from({ length: 24 }, (_, h) => ({ hour: h, sales: h === 20 ? 900_000 : h * 1000, orders: h === 20 ? 30 : h % 5 })),
  heatmap: Array.from({ length: 7 }, (_, d) => Array.from({ length: 24 }, (_, h) => (h === 20 ? 5 + d : h % 4))),
  channels: [{ id: "dine-in", sales: 2_500_000, orders: 60 }, { id: "takeaway", sales: 1_500_000, orders: 40 }, { id: "delivery", sales: 1_000_000, orders: 20 }],
  payments: [{ id: "cod", sales: 3_000_000, orders: 80 }, { id: "razorpay", sales: 2_000_000, orders: 40 }],
  ...over,
});

export const salesReport = (over: Record<string, unknown> = {}) => ({
  range: { from: "2026-10-30", to: "2026-11-28" }, granularity: "day", buckets: ["2026-11-24", "2026-11-25", "2026-11-26"],
  perOutlet: [{ id: "o1", name: "Acme Noida", values: [500_000, 600_000, 550_000], orders: [10, 12, 11] }, { id: "o2", name: "Acme Delhi", values: [400_000, 300_000, 450_000], orders: [8, 6, 9] }],
  weekdays: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((name, i) => ({ name, sales: 100_000 * (i + 1), orders: 10 + i, avgSales: 20_000 * (i + 1), avgOrders: 2 + i, occurrences: 5 })),
  channelsByOutlet: [], ...over,
});

export const itemsReport = (over: Record<string, unknown> = {}) => ({
  range: { from: "2026-10-30", to: "2026-11-28" }, previous: { from: "2026-09-30", to: "2026-10-29" },
  items: [
    { rank: 1, key: "veg momos", name: "Veg Momos", qty: 400, revenue: 4_000_000, orders: 220, daysSold: 29, perDay: 13.8, qtyShare: 0.4, revenueShare: 0.35, previousQty: 300, change: 33.3 },
    { rank: 2, key: "chicken momos", name: "Chicken Momos", qty: 250, revenue: 3_000_000, orders: 160, daysSold: 29, perDay: 8.6, qtyShare: 0.25, revenueShare: 0.3, previousQty: 300, change: -16.7 },
    { rank: 3, key: "tea", name: "Tea", qty: 120, revenue: 600_000, orders: 90, daysSold: 28, perDay: 4.1, qtyShare: 0.12, revenueShare: 0.06, previousQty: 0, change: null },
  ],
  unsold: ["Old Special", "Winter Soup"], totals: { qty: 770, revenue: 7_600_000 }, ...over,
});

export const insights = [
  { id: "sales-trend", tone: "good", title: "Sales are up", text: "₹50,000 against ₹40,000 in the period before — up 25%.", value: 25 },
  { id: "stock", tone: "warn", title: "2 dishes are out of stock or running low", text: "Veg Momos, Paneer Tikka.", value: 2 },
  { id: "top-item", tone: "info", title: "Veg Momos is your best seller", text: "400 sold — 40% of all items.", value: 400 },
];

export const options = (over: Record<string, unknown> = {}) => ({
  outlets: OUTLETS.map((o) => ({ id: o.id, name: o.name, title: o.config.identity.name })),
  canFinance: true, canExport: true, canWriteExpenses: true,
  formats: [{ id: "xlsx", label: "Excel", help: "Every section as its own sheet." }, { id: "csv", label: "CSV", help: "One section as a plain table." }, { id: "pdf", label: "PDF", help: "A printable summary report." }, { id: "json", label: "JSON", help: "Everything, for other software." }],
  sections: [{ id: "summary", label: "Summary", csv: true }, { id: "daily", label: "Sales by day", csv: true }, { id: "items", label: "Items sold", csv: true }, { id: "coupons", label: "Coupon usage", csv: true }, { id: "reservations", label: "Table reservations", csv: true }, { id: "gst", label: "GST", csv: true }, { id: "pnl", label: "Profit & loss", csv: true, finance: true }, { id: "expenses", label: "Expenses recorded", csv: true, finance: true }],
  defaults: { foodCostPct: 35, safetyPct: 15 }, features: ["takeaway", "analytics", "coupons", "reservations", "feedback"],
  ledgerCategories: [{ key: "raw_materials", label: "Raw materials & groceries" }, { key: "rent", label: "Rent" }, { key: "salaries", label: "Staff salaries" }, { key: "electricity", label: "Electricity" }, { key: "other", label: "Other" }],
  paymentModes: [{ id: "cash", label: "Cash" }, { id: "upi", label: "UPI" }, { id: "card", label: "Card" }, { id: "bank", label: "Bank transfer" }, { id: "other", label: "Other" }],
  ...over,
});

export const goal = (over: Record<string, unknown> = {}) => ({ goal: { monthlySales: 10_000_000 / 100 * 100 }, month: { from: "2026-11-01", to: "2026-11-30", days: 30, elapsed: 28, left: 2 }, soFar: 82_000, projected: 87_857, pct: 82, onTrack: false, neededPerDay: 9_000, avgPerDay: 2_929, ...over });

/** A request for days before the default "Last 30 days" (the comparison, or last year) is answered with the older, smaller numbers. */
const olderPeriod = (call: Call) => (queryOf(call).to ?? "~") < presetRange("last30").from;
const overviewFor = (call: Call) => { const now = overview(); return { json: olderPeriod(call) ? { ...now, kpis: now.previousKpis, previousKpis: now.previousKpis } : now }; };

/** Net sales ₹40,000, five bills in the ledger: Rent ₹10,000 and groceries ₹8,000 (₹18,000 in all). */
export const pnlInputs = (over: Record<string, unknown> = {}) => ({
  range: { from: "2026-10-30", to: "2026-11-28" }, total: { sales: 5_000_000, net: 4_000_000, tax: 250_000, orders: 100 },
  perOutlet: [{ id: "o1", name: "Acme Noida", ...kpis({ net: 2_500_000 }) }, { id: "o2", name: "Acme Delhi", ...kpis({ net: 1_500_000 }) }],
  recorded: [{ key: "rent", label: "Rent", amount: 10_000 }, { key: "raw_materials", label: "Raw materials & groceries", amount: 8_000 }], ...over,
});

export const expense = (over: Record<string, unknown> = {}) => ({ id: "e1", day: "2026-11-27", category: "rent", categoryLabel: "Rent", label: "November rent", amount: 10_000, outletId: "o1", outlet: "Acme Noida", vendor: "Mr Shah", note: "", paymentMode: "bank", createdBy: "Olivia Owner", createdAt: "2026-11-27T10:00:00Z", ...over });
export const expensesReport = (over: Record<string, unknown> = {}) => ({
  range: { from: "2026-10-30", to: "2026-11-28" }, previous: { from: "2026-09-30", to: "2026-10-29" }, granularity: "day",
  entries: [expense(), expense({ id: "e2", day: "2026-11-26", category: "raw_materials", categoryLabel: "Raw materials & groceries", label: "Vegetables", amount: 8_000, outletId: null, outlet: "Whole store", vendor: "Fresh Co", paymentMode: "cash" })],
  totals: { amount: 18_000, entries: 2, previous: 12_000, change: 50, perDay: 600 },
  byCategory: [{ category: "rent", label: "Rent", amount: 10_000, entries: 1, share: 10 / 18 }, { category: "raw_materials", label: "Raw materials & groceries", amount: 8_000, entries: 1, share: 8 / 18 }],
  byOutlet: [{ id: "o1", name: "Acme Noida", amount: 10_000, entries: 1 }, { id: null, name: "Whole store", amount: 8_000, entries: 1 }],
  byPaymentMode: [{ id: "bank", label: "Bank transfer", amount: 10_000 }, { id: "cash", label: "Cash", amount: 8_000 }],
  byVendor: [{ name: "Mr Shah", amount: 10_000, entries: 1 }, { name: "Fresh Co", amount: 8_000, entries: 1 }],
  series: [{ key: "2026-11-26", amount: 8_000 }, { key: "2026-11-27", amount: 10_000 }], ...over,
});
export const gstReport = (over: Record<string, unknown> = {}) => ({
  range: { from: "2026-10-30", to: "2026-11-28" },
  days: [{ day: "2026-11-26", orders: 10, taxable: 200_000, cgst: 5_000, sgst: 5_000, tax: 10_000, service: 2_000, total: 212_000 }, { day: "2026-11-27", orders: 15, taxable: 300_000, cgst: 7_500, sgst: 7_500, tax: 15_000, service: 3_000, total: 318_000 }],
  totals: { orders: 25, taxable: 500_000, cgst: 12_500, sgst: 12_500, tax: 25_000, service: 5_000, total: 530_000 }, ...over,
});
export const cashReport = (over: Record<string, unknown> = {}) => ({
  range: { from: "2026-10-30", to: "2026-11-28" },
  rows: [{ id: "cod", label: "cod", orders: 80, amount: 3_000_000, discount: 50_000 }, { id: "razorpay", label: "razorpay", orders: 40, amount: 2_000_000, discount: 0 }],
  collected: 5_000_000, pending: { orders: 3, amount: 120_000 }, cancelled: { orders: 1, amount: 40_000 }, ...over,
});

/** A pretend server that knows every report. A test passes the answers it wants different; every call is remembered (`server.calls`). */
export function reportsServer(routes: Record<string, Handler> = {}) {
  return fakeServer({
    "GET /api/outlets": { json: { outlets: OUTLETS } },
    "GET /api/analytics/options": { json: options() },
    "GET /api/analytics/overview": overviewFor,
    "GET /api/analytics/sales": { json: salesReport() },
    "GET /api/analytics/items": { json: itemsReport() },
    "GET /api/analytics/insights": { json: { insights } },
    "GET /api/analytics/goals": { json: goal() },
    "GET /api/analytics/pnl": { json: pnlInputs() },
    "GET /api/analytics/expenses": { json: expensesReport() },
    "GET /api/analytics/gst": { json: gstReport() },
    "GET /api/analytics/cash": { json: cashReport() },
    ...routes,
  });
}

/** The chosen outlet (the app picks one as soon as the outlet list is known) and a fresh period / outlet choice, with numbers shown at once (no counting up). Call before rendering a screen. */
export function freshScope(home: string | null = "o1") {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
  useScope.getState().reset();
  useScope.setState({ home, ready: true });
}

