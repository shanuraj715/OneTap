import type { ApiClient } from "./client";
import { APP_ID } from "@/lib/config";
import { deliveriesSchema, deliveryResultSchema, guardSchema, meSchema, riderLoginSchema, updateCheckSchema } from "./schemas";

/** Every call the Rider app makes, named for what it does. (The server decides what a rider may do; every route checks the rider's own token.) */
export function createApi(client: ApiClient) {
  const { request } = client;
  return {
    /* sign-in: a phone number and the PIN the manager set */
    guard: () => request("/api/auth/guard", { auth: false, schema: guardSchema }),
    signIn: (phone: string, pin: string) => request("/api/rider/login", { method: "POST", body: { phone, pin }, auth: false, schema: riderLoginSchema }),
    signOut: () => request("/api/rider/logout", { method: "POST", body: {} }),
    me: () => request("/api/rider/me", { schema: meSchema }),

    /* is there a newer version of the app? (no sign-in needed; the phone says which build it is on) */
    checkForUpdate: (versionCode: number) => request(`/api/app-updates/check?app=${APP_ID}&platform=android&versionCode=${versionCode}`, { auth: false, schema: updateCheckSchema }),

    /* notifications when the app is closed: this phone's Firebase token (sent again whenever Google changes it; removed when signing out) */
    registerPush: (token: string) => request("/api/rider/push-token", { method: "PUT", body: { token } }),
    unregisterPush: (token: string) => request("/api/rider/push-token", { method: "DELETE", body: { token } }),

    /* the rider's own deliveries: to do now, and done today */
    deliveries: () => request("/api/rider/deliveries", { schema: deliveriesSchema }),
    /** "I have the food": Ready → Out for delivery (the customer is told) */
    pickUp: (id: string) => request(`/api/rider/deliveries/${id}/pickup`, { method: "POST", body: {}, schema: deliveryResultSchema }),
    /** "I handed it over": needs the customer's 4-digit code when the order has one */
    deliver: (id: string, code?: string) => request(`/api/rider/deliveries/${id}/delivered`, { method: "POST", body: code ? { code } : {}, schema: deliveryResultSchema }),
  };
}
export type Api = ReturnType<typeof createApi>;
