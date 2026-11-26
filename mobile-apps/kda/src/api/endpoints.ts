import type { ApiClient } from "./client";
import { APP_ID } from "@/lib/config";
import { appLoginSchema, guardSchema, itemSetSchema, itemStateSchema, kitchenBoardSchema, kitchenItemsSchema, meSchema, outletsSchema, stagedSchema, summarySchema, updateCheckSchema, type ItemState, type Screen } from "./schemas";

/** Every call the Kitchen app makes, named for what it does. (The server decides who may do what; the app only hides what a person could not use.) */
export function createApi(client: ApiClient) {
  const { request } = client;
  return {
    /* sign-in */
    guard: () => request("/api/auth/guard", { auth: false, schema: guardSchema }),
    signIn: (email: string, password: string) => request("/api/auth/app-login", { method: "POST", body: { email, password }, auth: false, schema: appLoginSchema }),
    signOut: () => request("/api/auth/logout", { method: "POST", body: {} }),
    me: () => request("/api/auth/me", { schema: meSchema }),
    outlets: () => request("/api/outlets", { schema: outletsSchema }),

    /* is there a newer version of the app? (no sign-in needed; the phone says which build it is on) */
    checkForUpdate: (versionCode: number) => request(`/api/app-updates/check?app=${APP_ID}&platform=android&versionCode=${versionCode}`, { auth: false, schema: updateCheckSchema }),

    /* the board: every order the kitchen is making, newest rules from the store's kitchen settings */
    board: (outletId: string, screen: Screen = "all") => request(`/api/kitchen/orders?screen=${screen}`, { outletId, schema: kitchenBoardSchema }),
    /** Start / Ready on one station (or on all of them: `screen: "all"`). Going back to "preparing" from ready is a recall. */
    setStage: (outletId: string, orderId: string, screen: Screen, stage: "preparing" | "ready") =>
      request(`/api/kitchen/orders/${orderId}/stage`, { method: "POST", outletId, body: { screen, stage }, schema: stagedSchema }),

    /* dishes */
    items: (outletId: string) => request("/api/kitchen/items", { outletId, schema: kitchenItemsSchema }),
    /** Mark a dish available / sold out / unavailable. `left` (managers only) puts a number on a counted dish. */
    setItemState: (outletId: string, itemId: string, state: ItemState, left?: number) =>
      request(`/api/kitchen/items/${itemId}/availability`, { method: "POST", outletId, body: { state: itemStateSchema.parse(state), ...(left !== undefined ? { left } : {}) }, schema: itemSetSchema }),

    /* the manager's numbers for today */
    summary: (outletId: string) => request("/api/kitchen/summary", { outletId, schema: summarySchema }),
  };
}
export type Api = ReturnType<typeof createApi>;
