import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "./api";

/** The outlet's own storefront pages — the list (no bodies), and one page with its blocks. */
export const useStorePages = (outlet) =>
  useQuery({ queryKey: ["store-pages", outlet?._id], queryFn: () => api.listStorePages(outlet), enabled: Boolean(outlet) });

export const useStorePage = (outlet, id) =>
  useQuery({ queryKey: ["store-page", outlet?._id, id], queryFn: () => api.getStorePage(outlet, id), enabled: Boolean(outlet && id), refetchOnMount: "always" });

/** A page action that refreshes the list (and the open page) afterwards. */
export function usePageAction(outlet, fn) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["store-pages", outlet?._id] });
      void qc.invalidateQueries({ queryKey: ["store-page", outlet?._id] });
    },
  });
}
