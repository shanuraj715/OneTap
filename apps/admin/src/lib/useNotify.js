import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
                                                                             
import * as api from "./api";
                                    

export function useNotifyConfig(outlet                    , enabled         ) {
  return useQuery({
    queryKey: ["notify-config", outlet?._id],
    queryFn: () => api.getNotifyConfig(outlet ),
    enabled: Boolean(outlet) && enabled,
  });
}

export function useSaveNotifyConfig(outlet                    ) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a                                                                 ) =>
      api.saveNotifyConfig(outlet , a.channel, a.values),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notify-config"] }),
  });
}

export function useClearNotifyConfig(outlet                    ) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (channel                    ) => api.clearNotifyConfig(outlet , channel),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notify-config"] }),
  });
}

export function useNotificationLogs(
  outlet                    ,
  filter                                                                                               ,
) {
  return useQuery({
    queryKey: ["notification-logs", outlet?._id, filter],
    queryFn: () => api.listNotificationLogs(outlet , filter),
    enabled: Boolean(outlet),
    refetchInterval: 15_000,
  });
}
