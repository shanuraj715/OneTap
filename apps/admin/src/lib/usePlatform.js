import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "./api";

/** Data for the platform console (the super admin, and the team members whose role allows each page). */
export const useSecurityBlocks = () => useQuery({ queryKey: ["platform", "security"], queryFn: api.getSecurityBlocks, refetchInterval: 5000 });
/** Roles, team members and the activity log — the super admin only. */
export const useRoles = () => useQuery({ queryKey: ["platform", "roles"], queryFn: api.listRoles });
export const useTeam = () => useQuery({ queryKey: ["platform", "team"], queryFn: api.listTeam });
export const useTeamActivity = (limit = 50) => useQuery({ queryKey: ["platform", "team-activity", limit], queryFn: () => api.listTeamActivity(limit) });
export const usePlans = (enabled = true) => useQuery({ queryKey: ["platform", "plans"], queryFn: api.listPlans, enabled });
export const useStores = () => useQuery({ queryKey: ["platform", "stores"], queryFn: api.listStores });
export const useStore = (id) => useQuery({ queryKey: ["platform", "store", id], queryFn: () => api.getStore(id), enabled: Boolean(id) });
export const usePlatformSettings = (enabled = true) => useQuery({ queryKey: ["platform", "settings"], queryFn: api.getPlatformSettings, enabled });

/** Rasoi Pulse's own business numbers (what stores pay for their subscription). Any platform write refreshes them (the "platform" key). */
export const useBusiness = () => useQuery({ queryKey: ["platform", "business"], queryFn: api.getBusiness, staleTime: 30_000, placeholderData: keepPreviousData });
/** One store's subscription payments. */
export const useStorePayments = (id) => useQuery({ queryKey: ["platform", "store-payments", id], queryFn: () => api.getStorePayments(id), enabled: Boolean(id) });

/** The dashboard. While it reloads the previous numbers stay on screen (dimmed), so the page never jumps. */
export const useDashboard = () =>
  useQuery({ queryKey: ["platform", "dashboard"], queryFn: () => api.getDashboard(false), staleTime: 60_000, placeholderData: keepPreviousData });

/** Sign-in history, a page at a time. */
export const useLoginLogs = (filter) =>
  useInfiniteQuery({
    queryKey: ["platform", "login-logs", filter],
    queryFn: ({ pageParam }) => api.getLoginLogs({ filter, cursor: pageParam }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 15_000,
  });

/**
 * Live server figures. They poll on their own (and stop when the browser tab is hidden), so they live
 * under their own key rather than "platform" — a save elsewhere in the console shouldn't refetch them.
 */
export const useServer = (live = true) =>
  useQuery({ queryKey: ["server", "now"], queryFn: api.getServer, refetchInterval: live ? 4000 : false, placeholderData: keepPreviousData, retry: 1 });
export const useServerHistory = (live = true) =>
  useQuery({ queryKey: ["server", "history"], queryFn: () => api.getServerHistory(30), refetchInterval: live ? 10_000 : false, placeholderData: keepPreviousData });
export const useServerProcesses = (live = true) =>
  useQuery({ queryKey: ["server", "processes"], queryFn: api.getServerProcesses, refetchInterval: live ? 8000 : false, placeholderData: keepPreviousData });
export const useServerHealth = () =>
  useQuery({ queryKey: ["server", "health"], queryFn: api.getServerHealth, refetchInterval: 20_000, staleTime: 10_000, retry: 1 });
export const useFolderScan = () =>
  useQuery({ queryKey: ["server", "folders"], queryFn: api.getFolderScan, refetchInterval: (q) => (q.state.data?.state === "running" ? 1500 : false) });

export const useCacheOverview = () => useQuery({ queryKey: ["platform", "cache"], queryFn: api.getCacheOverview, refetchInterval: 15_000 });
/** Every cached item. Polls while `live`; lives under "platform" so expiring something refreshes it. */
export const useCacheEntries = (live = true) =>
  useQuery({ queryKey: ["platform", "cache-entries"], queryFn: api.getCacheEntries, refetchInterval: live ? 10_000 : false, placeholderData: keepPreviousData });
/** One cached item's data. Not polled: it is a snapshot you can refresh. A 404 means it is no longer cached. */
export const useCacheEntry = (key) =>
  useQuery({ queryKey: ["platform", "cache-entry", key], queryFn: () => api.getCacheEntry(key), enabled: Boolean(key), retry: false, gcTime: 0 });
export const useStoreCache = (id) => useQuery({ queryKey: ["platform", "store-cache", id], queryFn: () => api.getStoreCache(id), enabled: Boolean(id), refetchInterval: 15_000 });

/** Where every store's images are kept (the platform's one setting) — and which stores still have older settings of their own. */
export const usePlatformStorage = () => useQuery({ queryKey: ["platform", "storage"], queryFn: api.getPlatformStorage });
export const useStorageUsage = () => useQuery({ queryKey: ["platform", "storage-usage"], queryFn: api.getStorageUsage });
/** The latest "move the files" job — refreshed every second and a half while one is running. */
export const useStorageMove = () =>
  useQuery({ queryKey: ["platform", "storage-move"], queryFn: api.getStorageMove, refetchInterval: (q) => (q.state.data?.current?.status === "running" ? 1500 : false) });
/** The pictures bigger than the size limit found by the last scan, and the latest "optimize" job (refreshed while one runs). */
export const useOptimizeScan = () => useQuery({ queryKey: ["platform", "storage-optimize-scan"], queryFn: api.getOptimizeScan });
export const useStorageOptimize = () =>
  useQuery({ queryKey: ["platform", "storage-optimize"], queryFn: api.getStorageOptimize, refetchInterval: (q) => (q.state.data?.current?.status === "running" ? 1500 : false) });

/** The Gemini keys that make AI dish pictures (masked) and the model they use. */
export const usePlatformAi = () => useQuery({ queryKey: ["platform", "ai"], queryFn: api.getPlatformAi });

/** Client onboarding forms: the list, and one form. */
export const useOnboardingList = () => useQuery({ queryKey: ["platform", "onboarding", "list"], queryFn: () => api.listOnboarding() });
export const useOnboardingForm = (id) => useQuery({ queryKey: ["platform", "onboarding", "form", id], queryFn: () => api.getOnboarding(id), enabled: Boolean(id), staleTime: Infinity, refetchOnWindowFocus: false });

export const usePricing = () => useQuery({ queryKey: ["platform", "onboarding", "pricing"], queryFn: api.getOnboardingPricing });

/** The Rasoi Pulse website and its enquiries. */
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
      void qc.invalidateQueries({ queryKey: ["me"] }); // a platform switch can change what this very session sees
    },
  });
}

/** How often each app asks for new data (the console's Refresh interval card). */
export const useAppSettings = () => useQuery({ queryKey: ["platform", "app-settings"], queryFn: () => api.listAppSettings() });

/** The staff app's releases (APK versions, forced updates) — refreshed while the page is open so download counts move. */
export const useAppReleases = (app = "oma", enabled = true) => useQuery({ queryKey: ["platform", "app-releases", app], queryFn: () => api.listAppReleases(app), refetchInterval: 30_000, enabled });
