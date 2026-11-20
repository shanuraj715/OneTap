import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
                                                         
import * as api from "./api";
import { useAuth } from "./useAuth";

/** How often lists ask the API when live updates are switched off for the whole platform. */
export const POLL_WITHOUT_SOCKET_MS = 5_000;

function usePollMs(pollSeconds) {
  const { user } = useAuth();
  return user?.realtime?.websocket === false ? POLL_WITHOUT_SOCKET_MS : Math.max(3, pollSeconds) * 1000;
}
                                    

/**
 * The order queue.
 *
 * The WebSocket is what actually keeps this fresh; the poll is the safety net
 * for when the socket is down, which is why the interval is configurable per
 * outlet rather than hard-coded.
 */
export function useOrders(
  outlet                    ,
  status              ,
  pollSeconds = 10,
  paymentPending                          = "hide",
) {
  const pollMs = usePollMs(pollSeconds);
  return useQuery({
    queryKey: ["orders", outlet?._id, status ?? "all", paymentPending],
    queryFn: () => api.listOrders(outlet , status, paymentPending),
    enabled: Boolean(outlet),
    refetchInterval: pollMs,
  });
}

/** The live load-management read — polled at the same cadence as the queue. */
export function useCapacity(outlet                    , enabled         , pollSeconds = 10) {
  const pollMs = usePollMs(pollSeconds);
  return useQuery({
    queryKey: ["capacity", outlet?._id],
    queryFn: () => api.getCapacity(outlet ),
    enabled: Boolean(outlet) && enabled,
    refetchInterval: pollMs,
  });
}

function useOrderMutation   (outlet                    , fn                                       ) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a   ) => fn(outlet , a),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["orders"] });
      void qc.invalidateQueries({ queryKey: ["order-print-status"] });
    },
  });
}

export const useSetOrderStatus = (o                    ) =>
  useOrderMutation                                     (o, (out, a) => api.setOrderStatus(out, a.id, a.status));

/** The correction path — set any status directly after a mis-tap. */
export const useManualStatus = (o                    ) =>
  useOrderMutation                                                      (o, (out, a) =>
    api.setOrderStatusManual(out, a.id, a.status, a.reason),
  );

/** Delete an order (owner / manager). Every open dashboard refreshes its list from the "order.deleted" push. */
export const useDeleteOrder = (o                    ) => useOrderMutation(o, (out, id) => api.deleteOrder(out, id));

export const useEditOrder = (o                    ) =>
  useOrderMutation                                     (o, (out, a) => api.editOrder(out, a.id, a.body));

/** Staff placing a new order — a walk-in, or a second round on an open table
 *  session (`body.sessionId`). Also refreshes the table/session views, since
 *  a dine-in order changes that session's running tab. */
export function usePlaceOrder(outlet                    ) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body   ) => api.placeOrder(outlet , body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["orders"] });
      void qc.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}
