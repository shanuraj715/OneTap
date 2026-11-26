import type { z } from "zod";
import type { ApiClient } from "./client";
import {
  appLoginSchema, closedSchema, customersSchema, guardSchema, meSchema, menuSchema, moveSchema, ordersSchema, outletsSchema, paymentSchema, placedOrderSchema, quoteSchema, sessionsSchema, tablesSchema, unavailableSchema,
} from "./schemas";

/** One line of an order being put together: the dish, the size, the add-ons, how many, a note for the kitchen. */
export interface CartLineInput { itemId: string; variantId?: string; modifierOptionIds: string[]; quantity: number; note?: string }
export interface CartInput { lines: CartLineInput[] }
export interface PlaceOrderInput { tableId: string; cart: CartInput; phone?: string; name?: string; note?: string; expectedSessionId?: string | null }

/** Every call the app makes, named for what it does. (The server decides every price; the app only shows them.) */
export function createApi(client: ApiClient) {
  const { request } = client;
  return {
    /* sign-in */
    guard: () => request("/api/auth/guard", { auth: false, schema: guardSchema }),
    signIn: (email: string, password: string) => request("/api/auth/app-login", { method: "POST", body: { email, password }, auth: false, schema: appLoginSchema }),
    signOut: () => request("/api/auth/logout", { method: "POST", body: {} }),
    me: () => request("/api/auth/me", { schema: meSchema }),
    outlets: () => request("/api/outlets", { schema: outletsSchema }),

    /* what the waiter works with */
    menu: (outletId: string) => request(`/api/menu?outletId=${encodeURIComponent(outletId)}`, { outletId, schema: menuSchema }),
    /** only what can't be ordered right now (the menu itself is loaded once) */
    unavailable: (outletId: string) => request(`/api/menu/unavailable?outletId=${encodeURIComponent(outletId)}`, { outletId, schema: unavailableSchema }),
    /** customers whose number starts with what was typed (3 digits or more) */
    searchCustomers: (outletId: string, digits: string, signal?: AbortSignal) => request(`/api/orders/staff/customers?q=${encodeURIComponent(digits)}`, { outletId, schema: customersSchema, signal }),
    tables: (outletId: string) => request("/api/tables", { outletId, schema: tablesSchema }),
    sessions: (outletId: string) => request("/api/tables/sessions/active", { outletId, schema: sessionsSchema }),
    orders: (outletId: string, limit = 100) => request(`/api/orders?limit=${limit}`, { outletId, schema: ordersSchema }),

    /* taking an order */
    quote: (outletId: string, cart: CartInput, tableId?: string, phone?: string) =>
      request("/api/orders/staff/quote", { method: "POST", outletId, body: { cart, ...(tableId ? { tableId } : {}), ...(phone ? { phone } : {}) }, schema: quoteSchema }),
    placeOrder: (outletId: string, input: PlaceOrderInput) => request("/api/orders/staff", { method: "POST", outletId, body: input, schema: placedOrderSchema }),

    /* a table in service */
    moveSession: (outletId: string, sessionId: string, toTableId: string) => request(`/api/tables/sessions/${sessionId}/move`, { method: "POST", outletId, body: { toTableId }, schema: moveSchema }),
    confirmPayment: (outletId: string, sessionId: string) => request(`/api/tables/sessions/${sessionId}/confirm-payment`, { method: "POST", outletId, body: {}, schema: paymentSchema }),
    closeSession: (outletId: string, sessionId: string) => request(`/api/tables/sessions/${sessionId}/close`, { method: "POST", outletId, body: {}, schema: closedSchema }),
    voidSession: (outletId: string, sessionId: string, reason?: string) => request(`/api/tables/sessions/${sessionId}/void`, { method: "POST", outletId, body: { reason: reason ?? "" }, schema: closedSchema }),
  };
}
export type Api = ReturnType<typeof createApi>;
export type Parsed<S extends z.ZodType> = z.infer<S>;
