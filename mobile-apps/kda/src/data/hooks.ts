import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ItemState, KitchenItem, Screen } from "@/api/schemas";
import { REFRESH_MS } from "@/lib/config";
import { stateAfter } from "@/features/dishes";
import { useApi, useOutletId } from "@/runtime";
import { keys } from "./keys";

/** The kitchen board. It refreshes by itself while the app is open (a new order must show within seconds) and stops when the app is in the background. */
export function useBoard(screen: Screen) {
  const api = useApi();
  const outletId = useOutletId();
  return useQuery({ queryKey: keys.board(outletId, screen), queryFn: () => api.board(outletId, screen), refetchInterval: REFRESH_MS.board, enabled: !!outletId, placeholderData: keepPreviousData });
}

/** Start / Ready / Recall one order. Asks the board for the truth afterwards, so what the cook sees is what the server holds. */
export function useSetStage(screen: Screen) {
  const api = useApi();
  const outletId = useOutletId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, to }: { orderId: string; to: "preparing" | "ready" }) => api.setStage(outletId, orderId, screen, to),
    onSettled: () => qc.invalidateQueries({ queryKey: ["board", outletId] }),
  });
}

export function useItems() {
  const api = useApi();
  const outletId = useOutletId();
  return useQuery({ queryKey: keys.items(outletId), queryFn: () => api.items(outletId), refetchInterval: REFRESH_MS.items, enabled: !!outletId, placeholderData: keepPreviousData });
}

/**
 * Switch a dish. The list changes the instant the person taps (a kitchen in a rush must not wait for a spinner); if the server refuses, the
 * list goes back and the person is told. Either way the list is then fetched fresh.
 */
export function useSetItemState() {
  const api = useApi();
  const outletId = useOutletId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ item, state, left }: { item: KitchenItem; state: ItemState; left?: number }) => api.setItemState(outletId, item.id, state, left),
    onMutate: async ({ item, state, left }) => {
      await qc.cancelQueries({ queryKey: keys.items(outletId) });
      const before = qc.getQueryData<{ items: KitchenItem[]; categories: unknown[] }>(keys.items(outletId));
      if (before) {
        qc.setQueryData(keys.items(outletId), {
          ...before,
          items: before.items.map((i) => (i.id === item.id ? { ...i, state: stateAfter(i, state, left), switchedOff: state !== "available", stock: i.stock && left !== undefined ? { ...i.stock, left } : i.stock } : i)),
        });
      }
      return { before };
    },
    onError: (_e, _v, ctx) => { if (ctx?.before) qc.setQueryData(keys.items(outletId), ctx.before); },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.items(outletId) }),
  });
}

export function useSummary(enabled = true) {
  const api = useApi();
  const outletId = useOutletId();
  return useQuery({ queryKey: keys.summary(outletId), queryFn: () => api.summary(outletId), refetchInterval: REFRESH_MS.summary, enabled: !!outletId && enabled, placeholderData: keepPreviousData });
}
