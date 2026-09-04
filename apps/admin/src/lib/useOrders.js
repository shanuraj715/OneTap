import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
                                                         
import * as api from "./api";
                                    

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
  return useQuery({
    queryKey: ["orders", outlet?._id, status ?? "all", paymentPending],
    queryFn: () => api.listOrders(outlet , status, paymentPending),
    enabled: Boolean(outlet),
    refetchInterval: Math.max(3, pollSeconds) * 1000,
  });
}

/** The live load-management read — polled at the same cadence as the queue. */
export function useCapacity(outlet                    , enabled         , pollSeconds = 10) {
  return useQuery({
    queryKey: ["capacity", outlet?._id],
    queryFn: () => api.getCapacity(outlet ),
    enabled: Boolean(outlet) && enabled,
    refetchInterval: Math.max(3, pollSeconds) * 1000,
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

export const useEditOrder = (o                    ) =>
  useOrderMutation                                     (o, (out, a) => api.editOrder(out, a.id, a.body));
