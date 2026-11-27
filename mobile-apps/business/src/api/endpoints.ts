import type { Me } from "@/lib/access";
import type { Range } from "@/lib/dates";
import type { ApiClient } from "./client";

/* ------------------------------------------------------------------ what the store API answers (only the parts the app uses). Money is in PAISE unless it says rupees. */
export type Granularity = "day" | "week" | "month";
export interface Kpis { orders: number; sales: number; net: number; tax: number; discount: number; coins: number; delivery: number; service: number; items: number; customers: number; aov: number }
export interface Cancellations { placed: number; cancelled: number; lost: number; rate: number }
export interface Overview {
  range: Range; previous: Range; granularity: Granularity; kpis: Kpis; previousKpis: Kpis; cancellations: Cancellations; previousCancellations: Cancellations;
  newVsRepeat: { customers: number; newCustomers: number; repeatCustomers: number };
  series: { key: string; sales: number; net: number; orders: number }[];
  hourly: { hour: number; sales: number; orders: number }[];
  /** [Sunday … Saturday][hour] = orders */
  heatmap: number[][];
  channels: { id: string; sales: number; orders: number }[];
  payments: { id: string; sales: number; orders: number }[];
}
export interface SalesReport {
  range: Range; granularity: Granularity; buckets: string[];
  perOutlet: { id: string; name: string; values: number[]; orders: number[] }[];
  weekdays: { name: string; sales: number; orders: number; avgSales: number; avgOrders: number; occurrences: number }[];
  channelsByOutlet: { channel: string; outletId: string; sales: number; orders: number }[];
}
export interface ItemRow { rank: number; key: string; name: string; qty: number; revenue: number; orders: number; daysSold: number; perDay: number; qtyShare: number; revenueShare: number; previousQty: number; change: number | null }
export interface ItemsReport { range: Range; previous: Range; items: ItemRow[]; unsold: string[]; totals: { qty: number; revenue: number } }
export interface CustomersReport {
  range: Range; newVsRepeat: { customers: number; newCustomers: number; repeatCustomers: number };
  top: { id: string; name: string; phone: string; orders: number; spend: number; last: string }[];
  ordersPerCustomer: { bucket: string; customers: number }[];
  lapsed: { days30: number; days60: number; days90: number; ofAll: number };
}
export interface CompareReport {
  range: Range; days: number; dayLabels: string[];
  outlets: { id: string; name: string; kpis: Kpis; cancelled: Cancellations; daily: number[]; topItems: { name: string; qty: number }[]; channels: { channel: string; sales: number; orders: number }[] }[];
}
export interface OperationsReport {
  range: Range; cancellations: Cancellations; cancelledByHour: { hour: number; n: number }[];
  kitchen: { orders: number; acceptMinutes: number | null; cookMinutes: number | null; totalMinutes: number | null; slowShare: number; slowAfterMinutes: number } | null;
  coupons: { code: string; uses: number; discount: number; sales: number }[];
  discounts: { subtotal: number; discount: number; coins: number; discounted: number; withCoins: number; orders: number; discountShare: number };
}
export interface GstReport { range: Range; days: { day: string; orders: number; taxable: number; cgst: number; sgst: number; tax: number; service: number; total: number }[]; totals: { orders: number; taxable: number; cgst: number; sgst: number; tax: number; service: number; total: number } }
export interface CashReport { range: Range; rows: { id: string; label: string; orders: number; amount: number; discount: number }[]; collected: number; pending: { orders: number; amount: number }; cancelled: { orders: number; amount: number } }
export interface PnlInputs {
  range: Range; total: { sales: number; net: number; tax: number; orders: number };
  perOutlet: ({ id: string; name: string } & Kpis)[];
  /** the bills written in the expenses ledger for the range, by category (RUPEES) */
  recorded: { key: string; label: string; amount: number }[];
}
export interface StockPlan { weeks: number; safetyPct: number; range: Range; tomorrow: { day: string; weekday: string; items: { name: string; suggested: number; avg: number; max: number }[] } }

export interface CouponRow { code: string; description: string; discountType: string | null; value: number; active: boolean; redemptionCount: number; maxRedemptions: number; validUntil: string; uses: number; discount: number; sales: number; customers: number; avgOrder: number; avgDiscount: number; shareOfOrders: number; previousUses: number; change: number | null; lastUsed: string | null }
export type CouponsReport = { enabled: false } | {
  enabled: true; range: Range; previous: Range;
  totals: { uses: number; discount: number; sales: number; codes: number; shareOfOrders: number; avgOrderWithCoupon: number; avgOrderWithoutCoupon: number; previousUses: number; previousDiscount: number; usesChange: number | null; discountChange: number | null };
  coupons: CouponRow[]; unused: { code: string; description: string; validUntil: string }[]; perOutlet: { id: string; name: string; uses: number; discount: number }[];
};
export type ReservationsReport = { enabled: false } | {
  enabled: true; range: Range; previous: Range;
  totals: { bookings: number; previousBookings: number; change: number | null; guests: number; avgParty: number; kept: number; noShows: number; cancelled: number; declined: number; noShowRate: number; cancelRate: number; advanceCollected: number; refundDue: number; bookedValue: number; fromStaff: number; fromCustomers: number; upcomingWeek: number };
  byStatus: { id: string; count: number }[]; series: { day: string; bookings: number }[]; weekdays: { name: string; bookings: number }[]; hours: { hour: number; bookings: number }[];
  busiestWeekday: string | null; busiestHour: number | null; partySizes: { id: string; label: string; bookings: number }[]; events: { event: string; bookings: number }[]; perOutlet: { id: string; name: string; bookings: number }[];
};
export interface InventoryRow { id: string; name: string; category: string; outletId: string; outlet: string; left: number; daily: number | null; lowAt: number; state: "out" | "low" | "ok"; available: boolean; soldPerDay: number; daysLeft: number | null }
export interface InventoryReport { totals: { dishes: number; counted: number; notCounted: number; out: number; low: number; switchedOff: number }; items: InventoryRow[]; switchedOff: { id: string; name: string; outlet: string; reason: string }[] }
export interface Insight { id: string; tone: "good" | "warn" | "info"; title: string; text: string; value: number | null }
export interface Goal { goal: { monthlySales: number | null }; month: { from: string; to: string; days: number; elapsed: number; left: number }; soFar: number; projected: number; pct: number | null; onTrack: boolean | null; neededPerDay: number | null; avgPerDay: number }

export interface Expense { id: string; day: string; category: string; categoryLabel: string; label: string; amount: number; outletId: string | null; outlet: string; vendor: string; note: string; paymentMode: string; createdBy: string; createdAt: string }
export interface ExpenseInput { day: string; amount: number; category: string; label?: string; outletId?: string | null; vendor?: string; note?: string; paymentMode?: string }
export interface ExpensesReport {
  range: Range; previous: Range; granularity: "day" | "month"; entries: Expense[];
  totals: { amount: number; entries: number; previous: number; change: number | null; perDay: number };
  byCategory: { category: string; label: string; amount: number; entries: number; share: number }[];
  byOutlet: { id: string | null; name: string; amount: number; entries: number }[];
  byPaymentMode: { id: string; label: string; amount: number }[];
  byVendor: { name: string; amount: number; entries: number }[];
  series: { key: string; amount: number }[];
}

export interface OutletRef { id: string; name: string; title: string }
export interface ReportSection { id: string; label: string; csv?: boolean; finance?: boolean }
export interface ReportFormat { id: "xlsx" | "csv" | "pdf" | "json"; label: string; help: string }
export interface AnalyticsOptions {
  outlets: OutletRef[]; canFinance: boolean; canExport: boolean; canWriteExpenses: boolean;
  formats: ReportFormat[]; sections: ReportSection[]; defaults: { foodCostPct: number; safetyPct: number };
  /** the plan's features (coupons, reservations, feedback …) */
  features: string[]; ledgerCategories: { key: string; label: string }[]; paymentModes: { id: string; label: string }[];
}
export interface ExportRequest { format: ReportFormat["id"]; from: string; to: string; outletIds: string[]; sections: string[]; section?: string; pnl?: { foodCostPct: number; mode: "monthly" | "recorded"; expenses?: { label: string; monthly: number }[] } | null }

export interface StaffMember { id: string; email: string; name: string; isActive: boolean; lastLoginAt: string | null; role: string | null; outletIds: string[]; blockedAt: string | null; permissions: string[] }
export interface StaffInput { name?: string; email?: string; password?: string; role?: string; isActive?: boolean; outletIds?: string[] }
export interface Booking {
  id: string; code: string; status: string; statusLabel?: string; at: string; endsAt: string; minutes?: number; partySize: number;
  customer?: { name: string; phone: string; whatsapp?: string }; event: string; note: string; tableNumber?: string;
  pricing: { amountPaise: number; prepayPaise: number; remainingPaise: number; couponCode?: string }; payment: { status: string };
}
export interface Rating { id: string; orderId: string; orderNumber: string; channel: string; rating: number; comment: string; tags: string[]; items: string[]; orderTotal: number; customerName: string; customerPhone: string; createdAt: string; updatedAt: string }
export interface RatingsPage { summary: { days: number; count: number; average: number; byStars: Record<"1" | "2" | "3" | "4" | "5", number>; withComments: number }; ratings: Rating[]; nextBefore: string | null }
export interface StoreCoupon { id: string; code: string; description: string; discountType: string; value: number; maxDiscount: number; minOrderValue: number; validFrom?: string | null; validUntil: string | null; maxRedemptions: number; redemptionCount: number; active: boolean }
export interface UpdateCheck { updateAvailable: boolean; force: boolean; latest: { version: string; notes?: string; fileSize?: number } | null; pageUrl?: string }

const outletHeader = (outletId: string) => ({ "x-rasoipulse-outlet": outletId });
const q = (params: Record<string, string | number | boolean | undefined | null>) => {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") u.set(k, String(v));
  const s = u.toString();
  return s ? `?${s}` : "";
};

export function createApi(client: ApiClient) {
  const r = client.request;
  const json = (method: "POST" | "PUT" | "PATCH" | "DELETE", body?: unknown) => ({ method, body });
  /** `scope` is the ready-made `from=…&to=…&outlets=…` part (see data/scope.ts scopeQuery) */
  const report = <T>(name: string, scope: string) => r<T>(`/api/analytics/${name}?${scope}`);
  return {
    signIn: (email: string, password: string) => r<{ token: string; expiresAt: string; user: Me }>("/api/auth/app-login", { ...json("POST", { email, password }), auth: false }),
    signOut: (token: string) => r<void>("/api/auth/logout", { method: "POST", token }),
    me: () => r<{ user: Me }>("/api/auth/me"),
    guard: () => r<{ blocked: boolean; retryAfterSec?: number }>("/api/auth/guard", { auth: false }),
    updateCheck: (versionCode: number) => r<UpdateCheck>(`/api/app-updates/check?app=business&versionCode=${versionCode}`, { auth: false }),

    /** the outlets (the app needs one to send as the header) — before the options are known */
    outlets: () => r<{ outlets: { id: string; name: string; slug: string; brandName?: string; config?: { identity?: { name?: string } } }[] }>("/api/outlets"),
    options: () => r<AnalyticsOptions>("/api/analytics/options"),
    overview: (scope: string) => report<Overview>("overview", scope),
    sales: (scope: string) => report<SalesReport>("sales", scope),
    items: (scope: string) => report<ItemsReport>("items", scope),
    customers: (scope: string) => report<CustomersReport>("customers", scope),
    compare: (scope: string) => report<CompareReport>("compare", scope),
    operations: (scope: string) => report<OperationsReport>("operations", scope),
    gst: (scope: string) => report<GstReport>("gst", scope),
    cash: (scope: string) => report<CashReport>("cash", scope),
    pnl: (scope: string) => report<PnlInputs>("pnl", scope),
    stock: (outlets: string) => r<StockPlan>(`/api/analytics/stock${q({ outlets })}`),
    coupons: (scope: string) => report<CouponsReport>("coupons", scope),
    reservations: (scope: string) => report<ReservationsReport>("reservations", scope),
    inventory: (outlets: string) => r<InventoryReport>(`/api/analytics/inventory${q({ outlets })}`),
    insights: (scope: string) => report<{ insights: Insight[] }>("insights", scope),
    goals: (outlets: string) => r<Goal>(`/api/analytics/goals${q({ outlets })}`),
    setGoal: (monthlySales: number | null) => r<Goal>("/api/analytics/goals", json("PUT", { monthlySales })),

    expenses: (scope: string, category = "") => r<ExpensesReport>(`/api/analytics/expenses?${scope}${category ? `&category=${encodeURIComponent(category)}` : ""}`),
    addExpense: (body: ExpenseInput) => r<{ expense: Expense }>("/api/analytics/expenses", json("POST", body)),
    updateExpense: (id: string, body: ExpenseInput) => r<{ expense: Expense }>(`/api/analytics/expenses/${id}`, json("PUT", body)),
    deleteExpense: (id: string) => r<{ id: string }>(`/api/analytics/expenses/${id}`, json("DELETE")),

    /** a report as a file: Excel, PDF, CSV or JSON */
    exportReport: (body: ExportRequest) => client.download("/api/analytics/export", { method: "POST", body }),

    staff: () => r<{ users: StaffMember[] }>("/api/users"),
    addStaff: (body: Required<Pick<StaffInput, "name" | "email" | "password" | "role">> & { outletIds?: string[] }) => r<{ user: StaffMember }>("/api/users", json("POST", body)),
    updateStaff: (id: string, body: StaffInput) => r<{ user: StaffMember }>(`/api/users/${id}`, json("PATCH", body)),
    removeStaff: (id: string) => r<void>(`/api/users/${id}`, json("DELETE")),

    /** these four belong to ONE outlet: it is sent in the header (the person picks which on the screen) */
    bookings: (outletId: string, scope: "upcoming" | "earlier" | "all", day = "") => r<{ reservations: Booking[]; waiting?: number }>(`/api/reservations${q({ scope, day })}`, { headers: outletHeader(outletId) }),
    ratings: (outletId: string, o: { days: number; stars?: number[]; withComment?: boolean; before?: string | null }) =>
      r<RatingsPage>(`/api/feedback${q({ days: o.days, stars: o.stars?.join(","), withComment: o.withComment ? "1" : undefined, before: o.before ?? undefined, limit: 30 })}`, { headers: outletHeader(outletId) }),
    storeCoupons: (outletId: string) => r<{ coupons: StoreCoupon[] }>("/api/coupons", { headers: outletHeader(outletId) }),
    setCouponActive: (outletId: string, id: string, active: boolean) => r<{ coupon: StoreCoupon }>(`/api/coupons/${id}`, { ...json("PATCH", { active }), headers: outletHeader(outletId) }),
    /** change a dish's counted stock or switch it on / off — the dish belongs to ONE outlet */
    updateDish: (id: string, outletId: string, body: { stock?: { tracked: boolean; left: number; daily: number | null; lowAt: number } | null; isAvailable?: boolean }) =>
      r<{ item: { id: string } }>(`/api/menu/items/${id}`, { ...json("PATCH", body), headers: outletHeader(outletId) }),
  };
}
export type Api = ReturnType<typeof createApi>;
