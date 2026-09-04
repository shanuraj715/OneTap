import { z } from "zod";

export const ROLES = ["super_admin", "owner", "manager", "staff", "kitchen", "editor", "accountant"]         ;
export const roleSchema = z.enum(ROLES);
                                          

export const ROLE_LABELS                       = {
  super_admin: "Super Admin",
  owner: "Owner",
  manager: "Manager",
  staff: "Cashier / Staff",
  kitchen: "Kitchen",
  editor: "Content Editor",
  accountant: "Accountant",
};

export const ROLE_DESCRIPTIONS                       = {
  super_admin: "Platform staff. Everything, across every brand.",
  owner: "Everything inside the brand, including users and billing.",
  manager: "Menu, appearance, orders and tables — not users or payment keys.",
  staff: "Counter billing and orders.",
  kitchen: "Kitchen display only.",
  editor: "Content and appearance only.",
  accountant: "Read-only reports and invoices.",
};

/** `resource:action`. Add new ones here and grant them below. */
export const PERMISSIONS = [
  "outlet:read",
  "outlet:update",
  "menu:read",
  "menu:update",
  "order:read",
  "order:update",
  "order:refund",
  "table:read",
  "table:manage",
  "payment-config:read",
  "payment-config:manage",
  "printer:read",
  "printer:manage",
  "print:job",
  "coupon:read",
  "coupon:manage",
  "appearance:update",
  "theme:update",
  "settings:update",
  "user:read",
  "user:manage",
  "customer:read",
  "notification-config:read",
  "notification-config:manage",
  "notification-log:read",
  "dashboard:configure",
]         ;
                                                      

const ALL = [...PERMISSIONS];

export const ROLE_PERMISSIONS                             = {
  super_admin: ALL,
  owner: ALL,
  manager: ["outlet:read", "menu:read", "menu:update", "order:read", "order:update", "table:read", "table:manage", "payment-config:read", "printer:read", "printer:manage", "print:job", "coupon:read", "coupon:manage", "appearance:update", "theme:update", "settings:update", "customer:read", "notification-config:read", "notification-log:read", "dashboard:configure"],
  // A cashier must be able to reprint a torn receipt without calling a manager.
  staff: ["outlet:read", "menu:read", "order:read", "order:update", "table:read", "table:manage", "printer:read", "print:job", "coupon:read"],
  // Same for the kitchen when a KOT is lost — but they can't reconfigure printers.
  kitchen: ["outlet:read", "menu:read", "order:read", "order:update", "table:read", "printer:read", "print:job"],
  editor: ["outlet:read", "menu:read", "appearance:update", "theme:update"],
  accountant: ["outlet:read", "menu:read", "order:read", "printer:read", "print:job", "coupon:read", "customer:read", "notification-log:read"],
};

export function permissionsForRole(role      )               {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function can(permissions                   , permission            )          {
  return permissions.includes(permission);
}

/** What the admin gets back from /api/auth/me. */
export const sessionUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  isSuperAdmin: z.boolean(),
  role: roleSchema.nullable(),
  brandId: z.string().nullable(),
  permissions: z.array(z.string()),
});
                                                            
