import type { User } from "@/api/schemas";

/** What a person may do is decided by the server (every call is checked there). The app only hides buttons the person could not use anyway. */
export const can = (user: User | null, permission: string): boolean => !!user && user.permissions.includes(permission);

/** Move a party, confirm payment, close or void a table. */
export const canManageTables = (user: User | null): boolean => can(user, "table:manage");
export const canTakeOrders = (user: User | null): boolean => can(user, "order:create");

/** Move an order along, correct its status, hand it to a rider, edit it (the server also refuses a role without `order:update`). */
export const canUpdateOrders = (user: User | null): boolean => can(user, "order:update");
/** Delete an order from the list and the reports (the store owner and the platform admin only). */
export const canDeleteOrders = (user: User | null): boolean => can(user, "order:delete");
/** Print an order on one of the outlet's printers. */
export const canPrintOrders = (user: User | null): boolean => can(user, "print:job") && can(user, "printer:read");
/** Add a rider to the outlet's list (handing an order to a rider only needs `order:update`). */
export const canManageRiders = (user: User | null): boolean => can(user, "rider:manage");
