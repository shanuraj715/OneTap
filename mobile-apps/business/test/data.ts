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

export const person = (over: Record<string, unknown> = {}) => ({ id: "u9", email: "asha@acme.test", name: "Asha Cashier", isActive: true, lastLoginAt: "2026-11-27T09:00:00Z", role: "staff", outletIds: [], blockedAt: null, permissions: [], ...over });
/** The owner (the person signed in), a manager at Noida only, a cashier at every outlet, a kitchen person switched off who never signed in, and an accountant. */
export const staffList = () => [
  person({ id: "u0", email: "owner@acme.test", name: "Olivia Owner", role: "owner", lastLoginAt: "2026-11-28T09:30:00Z" }),
  person({ id: "u1", email: "boss@acme.test", name: "Manu Manager", role: "manager", outletIds: ["o1"], lastLoginAt: "2026-11-26T09:00:00Z" }),
  person({ id: "u2", email: "asha@acme.test", name: "Asha Cashier", role: "staff" }),
  person({ id: "u3", email: "kabir@acme.test", name: "Kabir Kitchen", role: "kitchen", isActive: false, lastLoginAt: null }),
  person({ id: "u4", email: "books@acme.test", name: "Anu Accountant", role: "accountant", lastLoginAt: "2026-10-01T09:00:00Z" }),
];

export const customersReport = (over: Record<string, unknown> = {}) => ({
  range: { from: "2026-10-30", to: "2026-11-28" }, newVsRepeat: { customers: 80, newCustomers: 30, repeatCustomers: 50 },
  top: [
    { id: "c1", name: "Ravi Kumar", phone: "9811111111", orders: 12, spend: 1_800_000, last: "2026-11-27T19:00:00Z" },
    { id: "c2", name: "Sunita Devi", phone: "9822222222", orders: 8, spend: 900_000, last: "2026-11-20T12:00:00Z" },
    { id: "c3", name: "", phone: "9833333333", orders: 1, spend: 120_000, last: "2026-11-02T12:00:00Z" },
  ],
  ordersPerCustomer: [{ bucket: "1 order", customers: 40 }, { bucket: "2 orders", customers: 25 }, { bucket: "3+ orders", customers: 15 }],
  lapsed: { days30: 12, days60: 6, days90: 3, ofAll: 200 }, ...over,
});
const outletRow = (id: string, name: string, kpiOver: Record<string, number>, cancelled: Record<string, number>, daily: number[], topItems: { name: string; qty: number }[]) => ({ id, name, kpis: kpis(kpiOver), cancelled: { placed: 100, cancelled: 5, lost: 100_000, rate: 0.05, ...cancelled }, daily, topItems, channels: [] });
export const compareReport = (over: Record<string, unknown> = {}) => ({
  range: { from: "2026-10-30", to: "2026-11-28" }, days: 3, dayLabels: ["2026-11-26", "2026-11-27", "2026-11-28"],
  outlets: [
    outletRow("o1", "Acme Noida", { sales: 3_000_000, orders: 70, aov: 42_857 }, { cancelled: 5, rate: 0.0667 }, [900_000, 1_000_000, 1_100_000], [{ name: "Veg Momos", qty: 250 }, { name: "Chicken Momos", qty: 120 }, { name: "Tea", qty: 90 }, { name: "Cold Coffee", qty: 10 }]),
    outletRow("o2", "Acme Delhi", { sales: 2_000_000, orders: 50, aov: 40_000 }, { cancelled: 5, rate: 0.1 }, [700_000, 600_000, 700_000], [{ name: "Chicken Momos", qty: 130 }, { name: "Veg Momos", qty: 150 }]),
  ], ...over,
});

export const reservationsReport = (over: Record<string, unknown> = {}) => ({
  enabled: true, range: { from: "2026-10-30", to: "2026-11-28" }, previous: { from: "2026-09-30", to: "2026-10-29" },
  totals: { bookings: 40, previousBookings: 32, change: 25, guests: 150, avgParty: 3.75, kept: 30, noShows: 4, cancelled: 3, declined: 1, noShowRate: 0.1, cancelRate: 0.075, advanceCollected: 2_000_000, refundDue: 150_000, bookedValue: 6_000_000, fromStaff: 12, fromCustomers: 28, upcomingWeek: 9 },
  byStatus: [{ id: "completed", count: 30 }, { id: "no_show", count: 4 }, { id: "cancelled", count: 3 }, { id: "confirmed", count: 3 }],
  series: [{ day: "2026-11-26", bookings: 3 }, { day: "2026-11-27", bookings: 5 }, { day: "2026-11-28", bookings: 4 }],
  weekdays: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((name, i) => ({ name, bookings: i + 1 })), hours: [{ hour: 19, bookings: 12 }, { hour: 20, bookings: 20 }],
  busiestWeekday: "Saturday", busiestHour: 20, partySizes: [{ id: "2", label: "2 people", bookings: 18 }, { id: "4", label: "3–4 people", bookings: 15 }], events: [{ event: "Birthday", bookings: 8 }],
  perOutlet: [{ id: "o1", name: "Acme Noida", bookings: 25 }, { id: "o2", name: "Acme Delhi", bookings: 15 }], ...over,
});
export const booking = (over: Record<string, unknown> = {}) => ({ id: "b1", code: "BK1", status: "confirmed", statusLabel: "Confirmed", at: "2026-11-29T14:00:00Z", endsAt: "2026-11-29T15:30:00Z", partySize: 4, customer: { name: "Rohit Sharma", phone: "9844444444" }, event: "Birthday", note: "", tableNumber: "T5", pricing: { amountPaise: 400_000, prepayPaise: 200_000, remainingPaise: 200_000 }, payment: { status: "paid" }, ...over });
export const couponRow = (over: Record<string, unknown> = {}) => ({ code: "WELCOME10", description: "10% off for new customers", discountType: "percent", value: 10, active: true, redemptionCount: 40, maxRedemptions: 0, validUntil: "2026-12-31", uses: 40, discount: 160_000, sales: 1_600_000, customers: 35, avgOrder: 40_000, avgDiscount: 4_000, shareOfOrders: 0.33, previousUses: 30, change: 33.3, lastUsed: "2026-11-27T18:00:00Z", ...over });
export const couponsReport = (over: Record<string, unknown> = {}) => ({
  enabled: true, range: { from: "2026-10-30", to: "2026-11-28" }, previous: { from: "2026-09-30", to: "2026-10-29" },
  totals: { uses: 55, discount: 220_000, sales: 2_200_000, codes: 2, shareOfOrders: 0.46, avgOrderWithCoupon: 40_000, avgOrderWithoutCoupon: 30_000, previousUses: 40, previousDiscount: 200_000, usesChange: 37.5, discountChange: 10 },
  coupons: [couponRow(), couponRow({ code: "FLAT50", uses: 15, discount: 75_000, sales: 600_000, customers: 14, active: false, change: -10, lastUsed: null })],
  unused: [{ code: "OLD20", description: "Winter offer", validUntil: "2026-12-15" }], perOutlet: [{ id: "o1", name: "Acme Noida", uses: 35, discount: 140_000 }, { id: "o2", name: "Acme Delhi", uses: 20, discount: 80_000 }], ...over,
});
export const storeCoupon = (over: Record<string, unknown> = {}) => ({ id: "k1", code: "WELCOME10", description: "10% off for new customers", discountType: "percent", value: 10, maxDiscount: 100, minOrderValue: 300, validFrom: null, validUntil: "2026-12-31", maxRedemptions: 100, redemptionCount: 40, active: true, ...over });
export const invRow = (over: Record<string, unknown> = {}) => ({ id: "d1", name: "Veg Momos", category: "Momos", outletId: "o1", outlet: "Acme Noida", left: 0, daily: 50, lowAt: 5, state: "out", available: true, soldPerDay: 13, daysLeft: null, ...over });
export const inventoryReport = (over: Record<string, unknown> = {}) => ({
  totals: { dishes: 40, counted: 12, notCounted: 28, out: 1, low: 1, switchedOff: 1 },
  items: [invRow(), invRow({ id: "d2", name: "Paneer Tikka", category: "Starters", left: 3, state: "low", daysLeft: 0.6, soldPerDay: 5 }), invRow({ id: "d3", name: "Tea", category: "Drinks", left: 80, state: "ok", daysLeft: 9.8, soldPerDay: 8 })],
  switchedOff: [{ id: "d9", name: "Winter Soup", outlet: "Acme Noida", reason: "Seasonal" }], ...over,
});
export const stockPlan = (over: Record<string, unknown> = {}) => ({ weeks: 4, safetyPct: 15, range: { from: "2026-11-01", to: "2026-11-28" }, tomorrow: { day: "2026-11-29", weekday: "Sunday", items: [{ name: "Veg Momos", suggested: 62, avg: 54, max: 70 }, { name: "Tea", suggested: 30, avg: 26, max: 40 }] }, ...over });
export const rating = (over: Record<string, unknown> = {}) => ({ id: "r1", orderId: "ord1", orderNumber: "A-102", channel: "dine-in", rating: 5, comment: "Loved the momos!", tags: ["Tasty"], items: ["2× Veg Momos"], orderTotal: 45_000, customerName: "Priya", customerPhone: "9855555555", createdAt: "2026-11-27T19:00:00Z", updatedAt: "2026-11-27T19:00:00Z", ...over });
export const ratingsPage = (over: Record<string, unknown> = {}) => ({ summary: { days: 30, count: 20, average: 4.3, byStars: { 1: 1, 2: 1, 3: 2, 4: 6, 5: 10 }, withComments: 7 }, ratings: [rating(), rating({ id: "r2", rating: 2, comment: "", customerName: "", orderNumber: "A-99", tags: [], createdAt: "2026-11-26T19:00:00Z" })], nextBefore: null, ...over });

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
    "GET /api/users": { json: { users: staffList() } },
    "GET /api/analytics/customers": { json: customersReport() },
    "GET /api/analytics/compare": { json: compareReport() },
    "GET /api/analytics/reservations": { json: reservationsReport() },
    "GET /api/analytics/coupons": { json: couponsReport() },
    "GET /api/analytics/inventory": { json: inventoryReport() },
    "GET /api/analytics/stock": { json: stockPlan() },
    "GET /api/reservations": { json: { reservations: [booking(), booking({ id: "b2", at: "2026-11-29T16:00:00Z", status: "requested", statusLabel: "Waiting to be confirmed", partySize: 2, customer: { name: "Meera", phone: "9866666666" }, tableNumber: "", pricing: { amountPaise: 0, prepayPaise: 0, remainingPaise: 0 } }), booking({ id: "b3", at: "2026-11-30T14:00:00Z" })], waiting: 1 } },
    "GET /api/coupons": { json: { coupons: [storeCoupon(), storeCoupon({ id: "k2", code: "FLAT50", discountType: "flat", value: 50, maxDiscount: 0, active: false })] } },
    "GET /api/feedback": { json: ratingsPage() },
    ...routes,
  });
}

/** The chosen outlet (the app picks one as soon as the outlet list is known) and a fresh period / outlet choice, with numbers shown at once (no counting up). Call before rendering a screen. */
export function freshScope(home: string | null = "o1") {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
  useScope.getState().reset();
  useScope.setState({ home, ready: true });
}

