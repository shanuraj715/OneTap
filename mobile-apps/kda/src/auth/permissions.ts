import type { User } from "@/api/schemas";

/** What a person may do is decided by the server (every call is checked there). The app only hides buttons the person could not use anyway. */
export const can = (user: User | null, permission: string): boolean => !!user && user.permissions.includes(permission);

/** Mark a dish available / sold out / unavailable: the kitchen team. */
export const canSwitchDishes = (user: User | null): boolean => can(user, "menu:availability");
/** Put a number on a counted dish, and see the day's numbers: the kitchen MANAGER (and owners) — `menu:update` is theirs, not the cook's. */
export const isKitchenManager = (user: User | null): boolean => can(user, "menu:update");

/** The role in the words a kitchen uses. */
export const roleTitle = (user: User | null): string => {
  if (!user) return "";
  if (user.isSuperAdmin) return "Platform admin";
  if (user.role === "owner") return "Owner";
  if (user.role === "manager") return "Kitchen manager";
  if (user.role === "kitchen") return "Kitchen staff";
  return user.role ?? "—";
};
