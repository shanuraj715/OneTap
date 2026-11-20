import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "./api";

/** The kitchen screen's orders. The live socket refreshes it at once; the poll is the safety net if the socket is down. */
export function useKitchenOrders(outlet, screen, enabled = true) {
  return useQuery({
    queryKey: ["kitchen", outlet?._id, screen],
    queryFn: () => api.listKitchenOrders(outlet, screen),
    enabled: Boolean(outlet) && enabled,
    refetchInterval: 8_000,
    retry: false,
  });
}

export function useKitchenStage(outlet) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, screen, stage }) => api.setKitchenStage(outlet, id, screen, stage),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["kitchen"] });
      void qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}
