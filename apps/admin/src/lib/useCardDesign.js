import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "./api";

/**
 * Keyed on the outlet, like every other design surface here. Each outlet
 * designs its own table card — two branches of the same brand print different
 * addresses and often different branding.
 */
export function useCardDesign(outlet, enabled = true) {
  return useQuery({
    queryKey: ["qr-card-design", outlet?._id],
    queryFn: () => api.getCardDesign(outlet),
    enabled: Boolean(outlet) && enabled,
  });
}

/** Table numbers and their signed URLs — one request for the whole outlet. */
export function useTableQrUrls(outlet, enabled = true) {
  return useQuery({
    queryKey: ["table-qr-urls", outlet?._id],
    queryFn: () => api.listTableQrUrls(outlet),
    enabled: Boolean(outlet) && enabled,
  });
}

export function useSaveCardDesign(outlet) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.saveCardDesign(outlet, body),
    onSuccess: (data) => {
      // Seed the cache with what the server returned rather than refetching.
      // The response carries the new `updatedAt`, which the next save needs as
      // its concurrency token — a refetch would work too, but this way an
      // immediate second save can never race the reload.
      qc.setQueryData(["qr-card-design", outlet?._id], data);
    },
  });
}

export function useResetCardDesign(outlet) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.resetCardDesign(outlet),
    onSuccess: (data) => qc.setQueryData(["qr-card-design", outlet?._id], data),
  });
}
