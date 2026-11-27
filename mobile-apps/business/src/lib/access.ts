import type { IconName } from "@/ui";

/**
 * Who may open what. The SERVER decides what each request may do (and turns away a role that may not); this only decides what the app SHOWS.
 * An area needs a permission (from the person's role) and, for a few, a feature of the store's plan (coupons, bookings, ratings).
 * `analytics:read` is what lets a person into the app at all (owners, managers and accountants hold it).
 */
export interface Me {
  id: string; email: string; name: string; isSuperAdmin: boolean;
  role: string | null; brandId: string | null; permissions: string[];
  storeDisabled?: { at: string; message?: string; storeName?: string } | null;
}
export interface Area { id: string; label: string; icon: IconName; permission: string; /** a plan feature the store must have (coupons, reservations, feedback) */ feature?: string; hint: string }

export const AREAS: Area[] = [
  { id: "home", label: "Home", icon: "dashboard", permission: "analytics:read", hint: "Today, this week, this month and this year at a glance" },
  { id: "sales", label: "Sales", icon: "chart", permission: "analytics:read", hint: "Sales by day, week, month and year — and how they compare" },
  { id: "money", label: "Money", icon: "wallet", permission: "analytics:finance", hint: "Profit & loss, expenses, GST and the daily till" },
  { id: "dishes", label: "Dishes", icon: "utensils", permission: "analytics:read", hint: "Best sellers by store and outlet, rising and falling dishes" },
  { id: "customers", label: "Customers", icon: "user", permission: "analytics:read", hint: "New and returning customers, your best customers, who stopped coming" },
  { id: "outlets", label: "Outlets", icon: "outlet", permission: "analytics:read", hint: "Compare your outlets side by side" },
  { id: "bookings", label: "Bookings", icon: "calendarCheck", permission: "analytics:read", feature: "reservations", hint: "Table reservations, guests, no-shows and advance paid" },
  { id: "coupons", label: "Coupons", icon: "tag", permission: "analytics:read", feature: "coupons", hint: "Which coupons are used, what they cost and what they bring" },
  { id: "stock", label: "Stock", icon: "bag", permission: "analytics:read", hint: "Counted stock, what is running low, what to prepare tomorrow" },
  { id: "staff", label: "Staff", icon: "team", permission: "user:read", hint: "Your team: roles, outlets, who signed in lately" },
  { id: "reports", label: "Reports", icon: "receipt", permission: "analytics:export", hint: "Excel and PDF reports you can download and share" },
  { id: "ratings", label: "Ratings", icon: "star", permission: "analytics:read", feature: "feedback", hint: "What customers rate and say" },
];

export const can = (me: Me | null | undefined, permission: string) => Boolean(me && (me.isSuperAdmin || me.permissions?.includes(permission)));
/** The app is for the people who may read analytics: owners, managers, accountants. */
export const canUseApp = (me: Me | null | undefined) => can(me, "analytics:read");
/** The areas this person sees. `features` = what the store's plan includes (null while it is not known yet: then only the permission decides). */
export const areasFor = (me: Me | null | undefined, features: string[] | null = null): Area[] =>
  AREAS.filter((a) => can(me, a.permission) && (!a.feature || features === null || features.includes(a.feature)));
