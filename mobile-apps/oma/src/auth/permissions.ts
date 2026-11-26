import type { User } from "@/api/schemas";

/** What a person may do is decided by the server (every call is checked there). The app only hides buttons the person could not use anyway. */
export const can = (user: User | null, permission: string): boolean => !!user && user.permissions.includes(permission);

/** Move a party, confirm payment, close or void a table. */
export const canManageTables = (user: User | null): boolean => can(user, "table:manage");
export const canTakeOrders = (user: User | null): boolean => can(user, "order:create");
