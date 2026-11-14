import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "./api";

/** Data for the platform console (super admin only). */
export const usePlatformOverview = () => useQuery({ queryKey: ["platform", "overview"], queryFn: api.platformOverview });
export const usePlans = () => useQuery({ queryKey: ["platform", "plans"], queryFn: api.listPlans });
export const useStores = () => useQuery({ queryKey: ["platform", "stores"], queryFn: api.listStores });
export const useStore = (id) => useQuery({ queryKey: ["platform", "store", id], queryFn: () => api.getStore(id), enabled: Boolean(id) });
export const usePlatformSettings = () => useQuery({ queryKey: ["platform", "settings"], queryFn: api.getPlatformSettings });

/** The TablePe website and its enquiries. */
export const useSitePages = () => useQuery({ queryKey: ["platform", "site", "pages"], queryFn: api.listSitePages });
export const useSitePage = (id) => useQuery({ queryKey: ["platform", "site", "page", id], queryFn: () => api.getSitePage(id), enabled: Boolean(id) });
export const useSiteSettings = () => useQuery({ queryKey: ["platform", "site", "settings"], queryFn: api.getSiteSettings });
export const useLeads = (status, enabled = true) =>
  useQuery({ queryKey: ["platform", "leads", status ?? "all"], queryFn: () => api.listLeads(status), refetchInterval: 60_000, enabled });

/** Any platform write can change what a store shows anywhere — refresh all platform data and store plans. */
export function usePlatformMutation(fn) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["platform"] });
      void qc.invalidateQueries({ queryKey: ["store-plan"] });
      void qc.invalidateQueries({ queryKey: ["outlets"] });
    },
  });
}
