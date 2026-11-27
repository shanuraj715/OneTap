import { z } from "zod";
import { permissionsForRole, ROLES, roleSchema,           } from "./rbac.js";

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
  "deliveries-active",
  "bookings-today",
  "customer-rating",
  "revenue-trend",
  "orders-by-channel",
  "orders-by-status",
  "orders-by-hour",
  "top-items",
  "recent-orders",
  "low-stock",
]         ;
export const dashboardWidgetIdSchema = z.enum(DASHBOARD_WIDGET_IDS);
                                                                      

                                                                

                                      
                        
                
                                                                                                      
                      
                                    
                                                                                                              
                  
                                                                                      
                       
 

// Named groups so the reasoning behind each widget's default audience reads
// as a sentence, not a bare array of role strings.
const FINANCE         = ["super_admin", "owner", "manager", "accountant"];
const KITCHEN_OPS         = ["super_admin", "owner", "manager", "staff", "kitchen"];
const FRONT_OF_HOUSE         = ["super_admin", "owner", "manager", "staff", "accountant"];
const MANAGEMENT         = ["super_admin", "owner", "manager"];
const FRONT_DESK         = ["super_admin", "owner", "manager", "staff"];
const EVERYONE_BUT_EDITOR         = ROLES.filter((r) => r !== "editor");

/**
 * What a widget needs before ANYONE may see it: a permission the role must hold (the numbers behind it are that sensitive) and, for a few, a plan
 * feature (a store without Delivery has no use for a deliveries widget). The audience of a widget can only ever contain roles that hold its
 * permission: `defaultRoles` is the intended audience cut down to them, and the console offers no other role. So a new role or permission can't
 * leave a widget showing data to someone who may not read it.
 */
const NEEDS = {
  "revenue-today": { permission: "analytics:read" },
  "orders-today": { permission: "order:read" },
  "avg-order-value-today": { permission: "analytics:read" },
  "active-queue": { permission: "order:read" },
  "missed-orders": { permission: "order:read" },
  "new-customers-today": { permission: "customer:read" },
  "coins-issued-today": { permission: "analytics:read", feature: "wallet" },
  "coupons-redeemed-today": { permission: "coupon:read", feature: "coupons" },
  "payment-pending": { permission: "order:read" },
  "notification-failures-today": { permission: "notification-log:read", feature: "notifications" },
  "deliveries-active": { permission: "order:read", feature: "delivery" },
  "bookings-today": { permission: "reservation:read", feature: "reservations" },
  "customer-rating": { permission: "feedback:read", feature: "feedback" },
  "revenue-trend": { permission: "analytics:read" },
  "orders-by-channel": { permission: "order:read" },
  "orders-by-status": { permission: "order:read" },
  "orders-by-hour": { permission: "order:read" },
  "top-items": { permission: "order:read" },
  "recent-orders": { permission: "order:read" },
  "low-stock": { permission: "menu:read" },
};

const widget = (id, label, description, category, span, audience) => ({
  id,
  label,
  description,
  category,
  span,
  requires: NEEDS[id],
  defaultRoles: audience.filter((r) => permissionsForRole(r).includes(NEEDS[id].permission)),
});

export const DASHBOARD_WIDGET_CATALOG                                                 = {
  "revenue-today": widget("revenue-today", "Revenue today", "Sum of every order marked paid today, and how it compares with yesterday.", "stat", 1, FINANCE),
  "orders-today": widget("orders-today", "Orders today", "Every order placed today, whatever became of it — including cancellations.", "stat", 1, EVERYONE_BUT_EDITOR),
  "avg-order-value-today": widget("avg-order-value-today", "Average order value", "Today's revenue divided by how many paid orders made it up.", "stat", 1, FINANCE),
  "active-queue": widget("active-queue", "In the queue", "Orders right now that are placed, accepted, or preparing — what the kitchen is actually holding.", "stat", 1, KITCHEN_OPS),
  "missed-orders": widget("missed-orders", "Missed orders", "Orders currently over the SLA time limit set in Settings → Missed-order alerts.", "stat", 1, KITCHEN_OPS),
  "new-customers-today": widget("new-customers-today", "New customers today", "Diners who verified for the first time today.", "stat", 1, FINANCE),
  "coins-issued-today": widget("coins-issued-today", "Coins issued today", "Loyalty coins credited today, from Settings → Coin wallet. A running cost, not just a perk.", "stat", 1, FINANCE),
  "coupons-redeemed-today": widget("coupons-redeemed-today", "Coupons redeemed today", "How many coupons were used today, and the total discount they gave away.", "stat", 1, FINANCE),
  "payment-pending": widget("payment-pending", "Payment pending", "Prepaid orders where the customer never completed payment — the same count the Orders page filters on.", "stat", 1, FRONT_OF_HOUSE),
  "notification-failures-today": widget("notification-failures-today", "Notification failures today", "WhatsApp/SMS alerts that failed or were skipped today — see the full list under Notifications → Logs.", "stat", 1, MANAGEMENT),
  "deliveries-active": widget("deliveries-active", "Out for delivery", "Delivery orders on their way to the customer right now, and how many are ready and waiting for a rider.", "stat", 1, KITCHEN_OPS),
  "bookings-today": widget("bookings-today", "Table bookings today", "Bookings for today still to come or being served, and how many wait for you to confirm them.", "stat", 1, FRONT_DESK),
  "customer-rating": widget("customer-rating", "Customer rating", "The average rating customers gave their orders over the last 30 days, and how many ratings that is.", "stat", 1, MANAGEMENT),
  "revenue-trend": widget("revenue-trend", "Revenue, last 14 days", "Daily revenue and order count as a line chart.", "chart", 2, FINANCE),
  "orders-by-channel": widget("orders-by-channel", "Orders by type", "Takeaway vs dine-in vs delivery, last 7 days.", "chart", 1, FRONT_OF_HOUSE),
  "orders-by-status": widget("orders-by-status", "Today's orders by status", "How today's orders are currently spread across placed / accepted / preparing / ready / completed / cancelled.", "chart", 1, KITCHEN_OPS),
  "orders-by-hour": widget("orders-by-hour", "Orders by hour, today", "When today's orders actually landed — the rush hours, at a glance.", "chart", 2, FRONT_OF_HOUSE),
  "top-items": widget("top-items", "Top-selling items", "The 5 best-selling items by quantity, last 7 days.", "chart", 1, ["super_admin", "owner", "manager", "kitchen"]),
  "recent-orders": widget("recent-orders", "Recent orders", "The last 8 orders, whatever their status — a quick pulse without leaving the dashboard.", "list", 2, KITCHEN_OPS),
  "low-stock": widget("low-stock", "Sold out right now", "Menu items currently marked unavailable, so a stale 86 doesn't get forgotten.", "list", 1, KITCHEN_OPS),
};

/** What each permission is called in the screen that explains why a role can't be given a widget. */
export const DASHBOARD_PERMISSION_LABELS = Object.freeze({
  "order:read": "Orders",
  "analytics:read": "Reports",
  "customer:read": "Customers",
  "coupon:read": "Coupons",
  "notification-log:read": "Notification logs",
  "reservation:read": "Table bookings",
  "feedback:read": "Ratings",
  "menu:read": "Menu",
});

/** Roles that have a dashboard at all: it is built from the outlet's orders, so a role that can't read orders (the content editor) has none. */
export const DASHBOARD_ROLES = ROLES.filter((r) => permissionsForRole(r).includes("order:read"));

/**
 * May this role ever see this widget? { ok: true } or { ok: false, reason: "role" | "permission" | "plan", need }.
 * `features` is the store's plan features; leave it out to ask only about the role.
 */
export function widgetAvailability(id, role, features) {
  const meta = DASHBOARD_WIDGET_CATALOG[id];
  if (!meta || !role || !DASHBOARD_ROLES.includes(role)) return { ok: false, reason: "role", need: "order:read" };
  if (!permissionsForRole(role).includes(meta.requires.permission)) return { ok: false, reason: "permission", need: meta.requires.permission };
  if (features && meta.requires.feature && !features.includes(meta.requires.feature)) return { ok: false, reason: "plan", need: meta.requires.feature };
  return { ok: true };
}

/* --------------------------------------------------------------- settings */

export const dashboardWidgetSettingsSchema = z.object({
  id: dashboardWidgetIdSchema,
  enabled: z.boolean().default(true),
  /** which roles see this widget on their own dashboard */
  roles: z.array(roleSchema).default([]),
});
                                                                                    

function defaultWidgets()                            {
  return DASHBOARD_WIDGET_IDS.map((id) => ({
    id,
    enabled: true,
    roles: DASHBOARD_WIDGET_CATALOG[id].defaultRoles,
  }));
}

/** The recommended dashboard: every widget on, each shown to the roles it was designed for (and that may read its numbers). */
export const recommendedDashboardWidgets = defaultWidgets;

/**
 * The whole configured dashboard for an outlet. `widgets` is an ordered
 * array — its order IS the display order, so reordering is just moving an
 * entry, no separate rank field to keep in sync.
 */
export const dashboardSettingsSchema = z.object({
  widgets: z.array(dashboardWidgetSettingsSchema).default(defaultWidgets),
});
                                                                        

/**
 * The configured widget list, reconciled against the catalogue: any widget
 * shipped after this outlet's config was last saved (a new build added one)
 * is appended with its catalogue defaults, so it shows up on its own rather
 * than staying invisible until someone happens to re-save Settings.
 */
export function resolveDashboardWidgets(settings                   )                            {
  const known = new Set(settings.widgets.map((w) => w.id));
  const missing                            = DASHBOARD_WIDGET_IDS.filter((id) => !known.has(id)).map((id) => ({
    id,
    enabled: true,
    roles: DASHBOARD_WIDGET_CATALOG[id].defaultRoles,
  }));
  return [...settings.widgets, ...missing];
}

/**
 * Which widgets a given role should actually see, enabled-only, in display order: the ones switched on, ticked for the role, that the role is
 * allowed to read, and (when `features` is given) that the store's plan covers. A tick left over from before a permission changed shows nothing.
 */
export function visibleWidgetsFor(settings                   , role             , features                    )                            {
  if (!role) return [];
  // (the platform's own super admin is not one of the roles an owner configures: they see every widget that is switched on)
  return resolveDashboardWidgets(settings).filter((w) => w.enabled && (w.roles.includes(role) || role === "super_admin") && DASHBOARD_WIDGET_CATALOG[w.id] && widgetAvailability(w.id, role, features).ok);
}

/* ------------------------------------------------------------------- data */

/**
 * What `GET /api/dashboard/stats` returns — one payload with everything
 * every widget needs, computed once server-side. The admin picks out
 * whichever slice a given widget renders; nothing here is per-widget-shaped,
 * so adding a widget that reuses existing numbers needs no API change.
 */
;                                
                      
          
                
                    
                   
                
                          
                        
                         
                         
                        
                            
                
                          
                           
                                 
    
                                                                       
                                                                    
                    
                                                        
                   
                                                      
                                                          
                                                  
                                            
                                                                  
                 
               
                        
                         
                   
                
                   
                      
      
                                           
 
