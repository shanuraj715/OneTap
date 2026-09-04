import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Gateway } from "@onetap/config-schema";
import * as api from "./api";
import type { Outlet } from "./api";

export function usePaymentConfig(outlet: Outlet | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["payment-config", outlet?._id],
    queryFn: () => api.getPaymentConfig(outlet!),
    enabled: Boolean(outlet) && enabled,
  });
}

export function useSavePaymentConfig(outlet: Outlet | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: { gateway: Gateway; values: Record<string, string> }) =>
      api.savePaymentConfig(outlet!, a.gateway, a.values),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payment-config"] }),
  });
}

export function useClearPaymentConfig(outlet: Outlet | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (gateway: Gateway) => api.clearPaymentConfig(outlet!, gateway),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payment-config"] }),
  });
}
