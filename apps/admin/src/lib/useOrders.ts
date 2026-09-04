import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { OrderStatus } from "@onetap/config-schema";
import * as api from "./api";
import type { Outlet } from "./api";

/**
 * The order queue.
 *
 * The WebSocket is what actually keeps this fresh; the poll is the safety net
 * for when the socket is down, which is why the interval is configurable per
 * outlet rather than hard-coded.
 */
export function useOrders(
  outlet: Outlet | undefined,
  status?: OrderStatus,
  pollSeconds = 10,
  paymentPending: "hide" | "only" | "all" = "hide",
) {
  return useQuery({
    queryKey: ["orders", outlet?._id, status ?? "all", paymentPending],
    queryFn: () => api.listOrders(outlet!, status, paymentPending),
    enabled: Boolean(outlet),
    refetchInterval: Math.max(3, pollSeconds) * 1000,
  });
}

/** The live load-management read — polled at the same cadence as the queue. */
export function useCapacity(outlet: Outlet | undefined, enabled: boolean, pollSeconds = 10) {
  return useQuery({
    queryKey: ["capacity", outlet?._id],
    queryFn: () => api.getCapacity(outlet!),
    enabled: Boolean(outlet) && enabled,
    refetchInterval: Math.max(3, pollSeconds) * 1000,
  });
}

function useOrderMutation<T>(outlet: Outlet | undefined, fn: (o: Outlet, a: T) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: T) => fn(outlet!, a),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["orders"] });
      void qc.invalidateQueries({ queryKey: ["order-print-status"] });
    },
  });
}

export const useSetOrderStatus = (o: Outlet | undefined) =>
  useOrderMutation<{ id: string; status: OrderStatus }>(o, (out, a) => api.setOrderStatus(out, a.id, a.status));

/** The correction path — set any status directly after a mis-tap. */
export const useManualStatus = (o: Outlet | undefined) =>
  useOrderMutation<{ id: string; status: OrderStatus; reason?: string }>(o, (out, a) =>
    api.setOrderStatusManual(out, a.id, a.status, a.reason),
  );

export const useEditOrder = (o: Outlet | undefined) =>
  useOrderMutation<{ id: string; body: api.OrderEdit }>(o, (out, a) => api.editOrder(out, a.id, a.body));
