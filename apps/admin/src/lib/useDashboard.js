import { useQuery } from "@tanstack/react-query";
import * as api from "./api";
                                    

/** Polled — the dashboard is exactly the kind of screen someone leaves open. */
export function useDashboardStats(outlet                    , enabled         ) {
  return useQuery({
    queryKey: ["dashboard-stats", outlet?._id],
    queryFn: () => api.getDashboardStats(outlet ),
    enabled: Boolean(outlet) && enabled,
    refetchInterval: 60_000,
  });
}
