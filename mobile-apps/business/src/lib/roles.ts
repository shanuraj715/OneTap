/**
 * The roles a store's owner can give to people, in plain words. The same names and descriptions as the web dashboard (a test compares them
 * with packages/config-schema/src/rbac.js). Owners are added and managed by Rasoi Pulse, never from the app.
 */
export const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin", owner: "Owner", manager: "Manager", staff: "Cashier / Staff", kitchen: "Kitchen", editor: "Content Editor", accountant: "Accountant",
};
export const ROLE_DESCRIPTIONS: Record<string, string> = {
  super_admin: "Platform staff. Everything, across every brand.",
  owner: "Everything inside the brand, including users and billing.",
  manager: "Menu, appearance, orders and tables — not users, payment keys or deleting orders.",
  staff: "Counter billing and orders.",
  kitchen: "Kitchen display only.",
  editor: "Content and appearance only.",
  accountant: "Read-only reports and invoices.",
};
/** The roles that can be given from the app. */
export const ASSIGNABLE_ROLES = ["manager", "staff", "kitchen", "editor", "accountant"] as const;
export const roleLabel = (role: string | null | undefined) => (role ? ROLE_LABELS[role] ?? role : "No role");
