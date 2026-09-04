import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NotifyOrderChannel, OrderStatus } from "@onetap/config-schema";
import * as api from "./api";
import type { Outlet } from "./api";

export function useNotifyConfig(outlet: Outlet | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["notify-config", outlet?._id],
    queryFn: () => api.getNotifyConfig(outlet!),
    enabled: Boolean(outlet) && enabled,
  });
}

export function useSaveNotifyConfig(outlet: Outlet | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: { channel: NotifyOrderChannel; values: Record<string, string> }) =>
      api.saveNotifyConfig(outlet!, a.channel, a.values),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notify-config"] }),
  });
}

export function useClearNotifyConfig(outlet: Outlet | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (channel: NotifyOrderChannel) => api.clearNotifyConfig(outlet!, channel),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notify-config"] }),
  });
}

export function useNotificationLogs(
  outlet: Outlet | undefined,
  filter: { channel?: NotifyOrderChannel; event?: OrderStatus; status?: "sent" | "failed" | "skipped" },
) {
  return useQuery({
    queryKey: ["notification-logs", outlet?._id, filter],
    queryFn: () => api.listNotificationLogs(outlet!, filter),
    enabled: Boolean(outlet),
    refetchInterval: 15_000,
  });
}
