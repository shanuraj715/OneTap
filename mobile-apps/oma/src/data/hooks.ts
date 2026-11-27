import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CartInput, EditOrderInput, PlaceOrderInput, RiderInput } from "@/api/endpoints";
import { keys } from "./keys";
import { useApi, useOutletId, useRuntime, useSession, useRefreshPlan } from "@/runtime";
import { useStore } from "zustand";
import { ApiError } from "@/api/client";
import { withAvailability } from "@/features/menu";
import { useCallback, useEffect, useMemo } from "react";


/** The table board's two halves: the tables, and who is sitting at them. Both refresh by themselves while the app is open. */
export function useTables() {
  const wait = useRefreshPlan();
  const api = useApi();
  const outletId = useOutletId();
  return useQuery({ queryKey: keys.tables(outletId), queryFn: () => api.tables(outletId), select: (d) => d.tables, refetchInterval: wait.tables, enabled: !!outletId });
}
export function useActiveSessions() {
  const wait = useRefreshPlan();
  const api = useApi();
  const outletId = useOutletId();
  return useQuery({ queryKey: keys.sessions(outletId), queryFn: () => api.sessions(outletId), select: (d) => d.sessions, refetchInterval: wait.tables, enabled: !!outletId });
}
export function useOrders() {
  const wait = useRefreshPlan();
  const api = useApi();
  const outletId = useOutletId();
  return useQuery({ queryKey: keys.orders(outletId), queryFn: () => api.orders(outletId), select: (d) => d.orders, refetchInterval: wait.orders, enabled: !!outletId });
}
/**
 * The menu is loaded ONCE (right after signing in, see runtime.tsx) and kept: it never refetches by itself. What changes minute to minute —
 * a dish selling out, coming back, going out of its serving hours — comes from `useUnavailable` below. `refresh()` is the manual way to
 * load it again (pull-to-refresh, "Try again").
 */
export function useMenu() {
  const api = useApi();
  const outletId = useOutletId();
  return useQuery({ queryKey: keys.menu(outletId), queryFn: () => api.menu(outletId), staleTime: Infinity, gcTime: Infinity, refetchOnMount: false, refetchOnReconnect: false, refetchOnWindowFocus: false, enabled: !!outletId });
}

/**
 * What can't be ordered right now. Asked EVERY time the order screen opens (and once a minute while it stays open): a few lines, not the
 * whole menu. A dish missing from the answer can be ordered.
 */
export function useUnavailable(enabled = true) {
  const wait = useRefreshPlan();
  const api = useApi();
  const outletId = useOutletId();
  return useQuery({
    queryKey: keys.unavailable(outletId),
    queryFn: () => api.unavailable(outletId),
    enabled: enabled && !!outletId,
    staleTime: 0,
    refetchOnMount: "always",
    refetchInterval: wait.unavailable,
    retry: false,
  });
}

/**
 * The menu to order from: the copy loaded once, with the live "can't be ordered now" laid over it.
 *  - the server's menu version differs from the copy's (a price, a dish or a picture was changed): the menu is loaded again, once;
 *  - an older server that has no "unavailable" call: the whole menu is loaded again each time (what the app did before).
 */
export function useOrderableMenu() {
  const menuQ = useMenu();
  const unavailQ = useUnavailable();
  const serverVersion = unavailQ.data?.version;
  const copyVersion = menuQ.data?.version;
  const answeredAt = unavailQ.dataUpdatedAt;
  const loadedAt = menuQ.dataUpdatedAt;
  useEffect(() => {
    if (serverVersion && copyVersion && serverVersion !== copyVersion && loadedAt < answeredAt && !menuQ.isFetching) void menuQ.refetch();
  }, [serverVersion, copyVersion, loadedAt, answeredAt, menuQ]);
  const oldServer = unavailQ.error instanceof ApiError && unavailQ.error.status === 404;
  useEffect(() => { if (oldServer) void menuQ.refetch(); }, [oldServer]); // eslint-disable-line react-hooks/exhaustive-deps
  const menu = useMemo(() => (menuQ.data ? withAvailability(menuQ.data, unavailQ.data) : undefined), [menuQ.data, unavailQ.data]);
  const { refetch: reloadMenu } = menuQ;
  const { refetch: reloadUnavailable } = unavailQ;
  const refresh = useCallback(() => Promise.all([reloadMenu(), reloadUnavailable()]), [reloadMenu, reloadUnavailable]);
  return { menu, query: menuQ, refresh };
}

/** Customers whose number starts with the digits typed (3 or more) — for the list under the mobile-number box. */
export function useCustomerSearch(digits: string, enabled = true) {
  const api = useApi();
  const outletId = useOutletId();
  return useQuery({
    queryKey: keys.customers(outletId, digits),
    queryFn: ({ signal }) => api.searchCustomers(outletId, digits, signal),
    select: (d) => d.customers,
    enabled: enabled && !!outletId && digits.length >= 3,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

/** After anything that changes a table or an order, fetch the board again so every screen agrees. */
export function useRefreshBoard() {
  const qc = useQueryClient();
  const outletId = useOutletId();
  return () => Promise.all([qc.invalidateQueries({ queryKey: keys.tables(outletId) }), qc.invalidateQueries({ queryKey: keys.sessions(outletId) }), qc.invalidateQueries({ queryKey: keys.orders(outletId) })]);
}

/**
 * The server's price for the order being put together (taxes, service charge, coupons, rounding). Asked again whenever the order changes.
 * A dish that sold out meanwhile comes back as an error the screen shows, so the waiter finds out before sending, not after.
 */
export function useQuoteQuery(cart: CartInput, options: { tableId?: string; phone?: string; enabled: boolean }) {
  const api = useApi();
  const outletId = useOutletId();
  return useQuery({
    queryKey: ["quote", outletId, options.tableId ?? "", options.phone ?? "", cart],
    queryFn: () => api.quote(outletId, cart, options.tableId, options.phone),
    enabled: !!outletId && options.enabled && cart.lines.length > 0,
    staleTime: 0,
    gcTime: 30_000,
    retry: false,
    placeholderData: keepPreviousData,
  });
}
export function usePlaceOrder() {
  const api = useApi();
  const outletId = useOutletId();
  const refresh = useRefreshBoard();
  return useMutation({ mutationFn: (input: PlaceOrderInput) => api.placeOrder(outletId, input), onSettled: () => void refresh() });
}
/* ------------------------------------------------------------------ managing an order */

/** The outlet's riders, for the "who is taking it?" pop-up. Asked only when it is opened. */
export function useRiders(enabled: boolean) {
  const api = useApi();
  const outletId = useOutletId();
  return useQuery({ queryKey: keys.riders(outletId), queryFn: () => api.riders(outletId), select: (d) => d.riders.filter((r) => r.isActive), enabled: enabled && !!outletId, staleTime: 60_000 });
}
/** The outlet's printers, for "print this order on…". */
export function usePrinters(enabled: boolean) {
  const api = useApi();
  const outletId = useOutletId();
  return useQuery({ queryKey: keys.printers(outletId), queryFn: () => api.printers(outletId), select: (d) => d.printers.filter((p) => p.isActive), enabled: enabled && !!outletId, staleTime: 60_000 });
}
/** Move an order to the next step (or cancel it). */
export function useSetOrderStatus() {
  const api = useApi();
  const outletId = useOutletId();
  const refresh = useRefreshBoard();
  return useMutation({ mutationFn: (v: { id: string; status: string }) => api.setOrderStatus(outletId, v.id, v.status), onSettled: () => void refresh() });
}
/** Set any status by hand (the correction for a mis-tap); `tableId` seats a re-opened order's party at another free table. */
export function useSetOrderStatusManual() {
  const api = useApi();
  const outletId = useOutletId();
  const refresh = useRefreshBoard();
  return useMutation({ mutationFn: (v: { id: string; status: string; reason?: string; tableId?: string }) => api.setOrderStatusManual(outletId, v.id, v.status, v.reason, v.tableId), onSettled: () => void refresh() });
}
export function useAssignRider() {
  const api = useApi();
  const outletId = useOutletId();
  const refresh = useRefreshBoard();
  return useMutation({ mutationFn: (v: { id: string; body: RiderInput }) => api.assignRider(outletId, v.id, v.body), onSettled: () => void refresh() });
}
export function useEditOrder() {
  const api = useApi();
  const outletId = useOutletId();
  const refresh = useRefreshBoard();
  return useMutation({ mutationFn: (v: { id: string; body: EditOrderInput }) => api.editOrder(outletId, v.id, v.body), onSettled: () => void refresh() });
}
export function useDeleteOrder() {
  const api = useApi();
  const outletId = useOutletId();
  const refresh = useRefreshBoard();
  return useMutation({ mutationFn: (id: string) => api.deleteOrder(outletId, id), onSettled: () => void refresh() });
}
export function usePrintOrder() {
  const api = useApi();
  const outletId = useOutletId();
  return useMutation({ mutationFn: (v: { orderId: string; printerId: string }) => api.printOrder(outletId, v.orderId, v.printerId) });
}

export function useMoveSession() {
  const api = useApi();
  const outletId = useOutletId();
  const refresh = useRefreshBoard();
  return useMutation({ mutationFn: (v: { sessionId: string; toTableId: string }) => api.moveSession(outletId, v.sessionId, v.toTableId), onSettled: () => void refresh() });
}
export function useConfirmPayment() {
  const api = useApi();
  const outletId = useOutletId();
  const refresh = useRefreshBoard();
  return useMutation({ mutationFn: (sessionId: string) => api.confirmPayment(outletId, sessionId), onSettled: () => void refresh() });
}
export function useCloseSession() {
  const api = useApi();
  const outletId = useOutletId();
  const refresh = useRefreshBoard();
  return useMutation({ mutationFn: (sessionId: string) => api.closeSession(outletId, sessionId), onSettled: () => void refresh() });
}
export function useVoidSession() {
  const api = useApi();
  const outletId = useOutletId();
  const refresh = useRefreshBoard();
  return useMutation({ mutationFn: (v: { sessionId: string; reason?: string }) => api.voidSession(outletId, v.sessionId, v.reason), onSettled: () => void refresh() });
}

/**
 * The table areas this person keeps open (see prefs/areas.ts). `ready` turns true once the saved choices have been read — the board waits
 * for it, so areas never flash open and then shut. `known` (all areas that exist) is passed when changing one, to drop stale entries.
 */
export function useAreaPrefs() {
  const { areas } = useRuntime();
  const userId = useSession((s) => s.user?.id);
  const outletId = useSession((s) => s.outletId);
  const key = userId && outletId ? `${userId}:${outletId}` : null;
  useEffect(() => { if (key) void areas.getState().load(key); }, [areas, key]);
  const open = useStore(areas, (s) => s.open);
  const ready = useStore(areas, (s) => s.ready && s.key === key);
  const setOpen = useCallback((label: string, value: boolean, known?: readonly string[]) => areas.getState().set(label, value, known), [areas]);
  return { open, ready, setOpen };
}
