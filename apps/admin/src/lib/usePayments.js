import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
                                                     
import * as api from "./api";
                                    

export function usePaymentConfig(outlet                    , enabled         ) {
  return useQuery({
    queryKey: ["payment-config", outlet?._id],
    queryFn: () => api.getPaymentConfig(outlet ),
    enabled: Boolean(outlet) && enabled,
  });
}

export function useSavePaymentConfig(outlet                    ) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a                                                      ) =>
      api.savePaymentConfig(outlet , a.gateway, a.values),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payment-config"] }),
  });
}

export function useClearPaymentConfig(outlet                    ) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (gateway         ) => api.clearPaymentConfig(outlet , gateway),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payment-config"] }),
  });
}
