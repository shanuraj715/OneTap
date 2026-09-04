import { z } from "zod";
import { ROLES, roleSchema,           } from "./rbac.js";

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
]         ;
export const dashboardWidgetIdSchema = z.enum(DASHBOARD_WIDGET_IDS);
                                                                      

                                                                

                                      
                        
                
                                                                                                      
                      
                                    
                                                                                                              
                  
                                                                                      
                       
 

// Named groups so the reasoning behind each widget's default audience reads
// as a sentence, not a bare array of role strings.
const FINANCE         = ["super_admin", "owner", "manager", "accountant"];
const KITCHEN_OPS         = ["super_admin", "owner", "manager", "staff", "kitchen"];
const FRONT_OF_HOUSE         = ["super_admin", "owner", "manager", "staff", "accountant"];
const MANAGEMENT         = ["super_admin", "owner", "manager"];
const EVERYONE_BUT_EDITOR         = ROLES.filter((r) => r !== "editor");

export const DASHBOARD_WIDGET_CATALOG                                                 = {
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
                                                                                    

function defaultWidgets()                            {
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

/** Which widgets a given role should actually see, enabled-only, in display order. */
export function visibleWidgetsFor(settings                   , role             )                            {
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
;                                
                      
          
                
                    
                   
                
                          
                        
                         
                         
                        
                            
                
                          
                           
                                 
    
                                                                       
                                                                    
                    
                                                        
                   
                                                      
                                                          
                                                  
                                            
                                                                  
                 
               
                        
                         
                   
                
                   
                      
      
                                           
 
