import { z } from "zod";
import { ROLES, roleSchema, type Role } from "./rbac";

/**
 * The admin Dashboard is built from a fixed catalogue of widgets — stat
 * cards, charts, small lists — each computed from the outlet's own data
 * (orders, customers, wallet, coupons, notifications, menu). Nothing here is
 * a user-authored widget; the admin's "Configure dashboard" screen only
 * turns catalogue entries on/off, sets which roles see each one, and orders
 * them. See {@link DASHBOARD_WIDGET_CATALOG} for the full list.
 */
export const DASHBOARD_WIDGET_IDS = [
  "revenue-today",
  "orders-today",
  "avg-order-value-today",
  "active-queue",
  "missed-orders",
  "new-customers-today",
  "coins-issued-today",
  "coupons-redeemed-today",
  "payment-pending",
  "notification-failures-today",
  "revenue-trend",
  "orders-by-channel",
  "orders-by-status",
  "orders-by-hour",
  "top-items",
  "recent-orders",
  "low-stock",
] as const;
export const dashboardWidgetIdSchema = z.enum(DASHBOARD_WIDGET_IDS);
export type DashboardWidgetId = (typeof DASHBOARD_WIDGET_IDS)[number];

export type DashboardWidgetCategory = "stat" | "chart" | "list";

export interface DashboardWidgetMeta {
  id: DashboardWidgetId;
  label: string;
  /** shown in the admin's widget picker, explains what it measures and where the number comes from */
  description: string;
  category: DashboardWidgetCategory;
  /** how much horizontal room it wants in the grid, in the same units as the layout — 1 = one card's width */
  span: 1 | 2 | 3;
  /** who sees it out of the box — a starting point the admin can change per widget */
  defaultRoles: Role[];
}

// Named groups so the reasoning behind each widget's default audience reads
// as a sentence, not a bare array of role strings.
const FINANCE: Role[] = ["super_admin", "owner", "manager", "accountant"];
const KITCHEN_OPS: Role[] = ["super_admin", "owner", "manager", "staff", "kitchen"];
const FRONT_OF_HOUSE: Role[] = ["super_admin", "owner", "manager", "staff", "accountant"];
const MANAGEMENT: Role[] = ["super_admin", "owner", "manager"];
const EVERYONE_BUT_EDITOR: Role[] = ROLES.filter((r) => r !== "editor");

export const DASHBOARD_WIDGET_CATALOG: Record<DashboardWidgetId, DashboardWidgetMeta> = {
  "revenue-today": {
    id: "revenue-today",
    label: "Revenue today",
    description: "Sum of every order marked paid today. A number the kitchen doesn't need but the owner opens the app for.",
    category: "stat",
    span: 1,
    defaultRoles: FINANCE,
  },
  "orders-today": {
    id: "orders-today",
    label: "Orders today",
    description: "Every order placed today, whatever became of it — including cancellations.",
    category: "stat",
    span: 1,
    defaultRoles: EVERYONE_BUT_EDITOR,
  },
  "avg-order-value-today": {
    id: "avg-order-value-today",
    label: "Average order value",
    description: "Today's revenue divided by how many paid orders made it up.",
    category: "stat",
    span: 1,
    defaultRoles: FINANCE,
  },
  "active-queue": {
    id: "active-queue",
    label: "In the queue",
    description: "Orders right now that are placed, accepted, or preparing — what the kitchen is actually holding.",
    category: "stat",
    span: 1,
    defaultRoles: KITCHEN_OPS,
  },
  "missed-orders": {
    id: "missed-orders",
    label: "Missed orders",
    description: "Orders currently over the SLA time limit set in Settings → Missed-order alerts.",
    category: "stat",
    span: 1,
    defaultRoles: KITCHEN_OPS,
  },
  "new-customers-today": {
    id: "new-customers-today",
    label: "New customers today",
    description: "Diners who verified for the first time today.",
    category: "stat",
    span: 1,
    defaultRoles: FINANCE,
  },
  "coins-issued-today": {
    id: "coins-issued-today",
    label: "Coins issued today",
    description: "Loyalty coins credited today, from Settings → Coin wallet. A running cost, not just a perk.",
    category: "stat",
    span: 1,
    defaultRoles: FINANCE,
  },
  "coupons-redeemed-today": {
    id: "coupons-redeemed-today",
    label: "Coupons redeemed today",
    description: "How many coupons were used today, and the total discount they gave away.",
    category: "stat",
    span: 1,
    defaultRoles: FINANCE,
  },
  "payment-pending": {
    id: "payment-pending",
    label: "Payment pending",
    description: "Prepaid orders where the customer never completed payment — the same count the Orders page filters on.",
    category: "stat",
    span: 1,
    defaultRoles: FRONT_OF_HOUSE,
  },
  "notification-failures-today": {
    id: "notification-failures-today",
    label: "Notification failures today",
    description: "WhatsApp/SMS alerts that failed or were skipped today — see the full list under Notifications → Logs.",
    category: "stat",
    span: 1,
    defaultRoles: MANAGEMENT,
  },
  "revenue-trend": {
    id: "revenue-trend",
    label: "Revenue, last 14 days",
    description: "Daily revenue and order count as a line chart.",
    category: "chart",
    span: 2,
    defaultRoles: FINANCE,
  },
  "orders-by-channel": {
    id: "orders-by-channel",
    label: "Orders by type",
    description: "Takeaway vs dine-in vs delivery, last 7 days.",
    category: "chart",
    span: 1,
    defaultRoles: FRONT_OF_HOUSE,
  },
  "orders-by-status": {
    id: "orders-by-status",
    label: "Today's orders by status",
    description: "How today's orders are currently spread across placed / accepted / preparing / ready / completed / cancelled.",
    category: "chart",
    span: 1,
    defaultRoles: KITCHEN_OPS,
  },
  "orders-by-hour": {
    id: "orders-by-hour",
    label: "Orders by hour, today",
    description: "When today's orders actually landed — the rush hours, at a glance.",
    category: "chart",
    span: 2,
    defaultRoles: FRONT_OF_HOUSE,
  },
  "top-items": {
    id: "top-items",
    label: "Top-selling items",
    description: "The 5 best-selling items by quantity, last 7 days.",
    category: "chart",
    span: 1,
    defaultRoles: ["super_admin", "owner", "manager", "kitchen"],
  },
  "recent-orders": {
    id: "recent-orders",
    label: "Recent orders",
    description: "The last 8 orders, whatever their status — a quick pulse without leaving the dashboard.",
    category: "list",
    span: 2,
    defaultRoles: KITCHEN_OPS,
  },
  "low-stock": {
    id: "low-stock",
    label: "Sold out right now",
    description: "Menu items currently marked unavailable, so a stale 86 doesn't get forgotten.",
    category: "list",
    span: 1,
    defaultRoles: KITCHEN_OPS,
  },
};

/* --------------------------------------------------------------- settings */

export const dashboardWidgetSettingsSchema = z.object({
  id: dashboardWidgetIdSchema,
  enabled: z.boolean().default(true),
  /** which roles see this widget on their own dashboard */
  roles: z.array(roleSchema).default([]),
});
export type DashboardWidgetSettings = z.infer<typeof dashboardWidgetSettingsSchema>;

function defaultWidgets(): DashboardWidgetSettings[] {
  return DASHBOARD_WIDGET_IDS.map((id) => ({
    id,
    enabled: true,
    roles: DASHBOARD_WIDGET_CATALOG[id].defaultRoles,
  }));
}

/**
 * The whole configured dashboard for an outlet. `widgets` is an ordered
 * array — its order IS the display order, so reordering is just moving an
 * entry, no separate rank field to keep in sync.
 */
export const dashboardSettingsSchema = z.object({
  widgets: z.array(dashboardWidgetSettingsSchema).default(defaultWidgets),
});
export type DashboardSettings = z.infer<typeof dashboardSettingsSchema>;

/**
 * The configured widget list, reconciled against the catalogue: any widget
 * shipped after this outlet's config was last saved (a new build added one)
 * is appended with its catalogue defaults, so it shows up on its own rather
 * than staying invisible until someone happens to re-save Settings.
 */
export function resolveDashboardWidgets(settings: DashboardSettings): DashboardWidgetSettings[] {
  const known = new Set(settings.widgets.map((w) => w.id));
  const missing: DashboardWidgetSettings[] = DASHBOARD_WIDGET_IDS.filter((id) => !known.has(id)).map((id) => ({
    id,
    enabled: true,
    roles: DASHBOARD_WIDGET_CATALOG[id].defaultRoles,
  }));
  return [...settings.widgets, ...missing];
}

/** Which widgets a given role should actually see, enabled-only, in display order. */
export function visibleWidgetsFor(settings: DashboardSettings, role: Role | null): DashboardWidgetSettings[] {
  if (!role) return [];
  return resolveDashboardWidgets(settings).filter((w) => w.enabled && w.roles.includes(role));
}

/* ------------------------------------------------------------------- data */

/**
 * What `GET /api/dashboard/stats` returns — one payload with everything
 * every widget needs, computed once server-side. The admin picks out
 * whichever slice a given widget renders; nothing here is per-widget-shaped,
 * so adding a widget that reuses existing numbers needs no API change.
 */
export interface DashboardStats {
  generatedAt: string;
  today: {
    /** paise */
    revenue: number;
    orders: number;
    /** paise */
    avgOrderValue: number;
    activeQueue: number;
    missedOrders: number;
    newCustomers: number;
    coinsIssued: number;
    couponsRedeemed: number;
    /** paise */
    couponSavings: number;
    paymentPending: number;
    notificationFailures: number;
  };
  /** oldest first, 14 entries, one per calendar day including today */
  revenueTrend: { date: string; revenue: number; orders: number }[];
  /** last 7 days */
  ordersByChannel: { channel: string; count: number }[];
  /** today only */
  ordersByStatus: { status: string; count: number }[];
  /** today, 24 entries, hour 0–23, outlet's local time */
  ordersByHour: { hour: number; count: number }[];
  /** last 7 days, highest quantity first */
  topItems: { name: string; quantity: number; revenue: number }[];
  recentOrders: {
    id: string;
    orderNumber: string;
    customerName: string;
    status: string;
    /** paise */
    amount: number;
    createdAt: string;
  }[];
  lowStock: { id: string; name: string }[];
}
