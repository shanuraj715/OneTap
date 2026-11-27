import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Api } from "@/api/endpoints";
import { scopeQuery, useScope } from "@/data/scope";
import { useApi, useMe } from "@/runtime";

/**
 * The outlets the person may see, and the one the app sends in its request header. The server needs ONE outlet to know whose store a report is
 * about, so the first outlet the person may see is picked as soon as the list is known (the person never has to think about it).
 */
export function useOutlets() {
  const api = useApi();
  const me = useMe();
  const home = useScope((s) => s.home);
  const setHome = useScope((s) => s.setHome);
  const q = useQuery({ queryKey: ["outlets"], queryFn: () => api.outlets(), enabled: Boolean(me), staleTime: 10 * 60_000 });
  const list = useMemo(() => q.data?.outlets ?? [], [q.data]);
  useEffect(() => { if (!home && list[0]) setHome(list[0].id); }, [home, list, setHome]);
  return { ...q, ready: Boolean(home) };
}

/** What the person may do and what the store's plan includes (coupons, bookings, ratings …), plus the outlets with their names. */
export function useOptions() {
  const api = useApi();
  const home = useScope((s) => s.home);
  return useQuery({ queryKey: ["options", home], queryFn: () => api.options(), enabled: Boolean(home), staleTime: 5 * 60_000 });
}

/**
 * A report for the chosen period and outlets. The key holds the period and outlets, so choosing others fetches again and going back is instant.
 * `extra` is anything else the address needs (a granularity, a category).
 */
export function useReport<T>(key: string, load: (api: Api, scope: string) => Promise<T>, extra: Record<string, string | number | undefined> = {}, enabled = true) {
  const api = useApi();
  const s = useScope();
  const scope = scopeQuery(s, extra);
  return useQuery({ queryKey: ["report", key, scope, s.home], queryFn: () => load(api, scope), enabled: enabled && Boolean(s.home) });
}

/** The same, for a report that fixes its own dates (this week against last week …): `from`/`to` are given instead of the chosen period. */
export function useRangeReport<T>(key: string, from: string, to: string, load: (api: Api, scope: string) => Promise<T>, extra: Record<string, string | number | undefined> = {}, enabled = true) {
  const api = useApi();
  const outlets = useScope((s) => s.outlets);
  const home = useScope((s) => s.home);
  const q = new URLSearchParams({ from, to, ...(outlets.length ? { outlets: outlets.join(",") } : {}), ...Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)])) }).toString();
  return useQuery({ queryKey: ["report", key, q, home], queryFn: () => load(api, q), enabled: enabled && Boolean(home) });
}

/** The outlet ids as the address wants them: "a,b" ("" = every outlet). */
export const useOutletsParam = () => useScope((s) => s.outlets).join(",");

/**
 * For the screens that belong to ONE outlet (ratings, upcoming bookings, a coupon list, counted stock): the outlet the person is looking at.
 * It starts as the one outlet chosen in the filter (or the first the person may see) and can be changed on the screen.
 */
export function useOutletPick(outlets: { id: string }[]): [string, (id: string) => void] {
  const chosen = useScope((s) => s.outlets);
  const home = useScope((s) => s.home);
  const [picked, setPicked] = useState<string | null>(null);
  const ids = outlets.map((o) => o.id);
  const fallback = chosen.length === 1 ? chosen[0]! : home ?? ids[0] ?? "";
  const id = picked && ids.includes(picked) ? picked : ids.includes(fallback) ? fallback : ids[0] ?? "";
  return [id, setPicked];
}
