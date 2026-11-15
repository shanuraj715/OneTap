import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "./api";
import { useOutlet } from "./useOutlet";

/** Marketing data: which ways of reaching customers are ready, the filter choices, the live audience, lists, campaigns. */
export const useMkChannels = () => {
  const { outlet } = useOutlet();
  return useQuery({ queryKey: ["mk-channels", outlet?._id], queryFn: () => api.mkChannels(outlet), enabled: Boolean(outlet), staleTime: 15_000 });
};

export const useMkOptions = (outletIds) => {
  const { outlet } = useOutlet();
  return useQuery({ queryKey: ["mk-options", outlet?._id, outletIds.join(",")], queryFn: () => api.mkOptions(outlet, outletIds), enabled: Boolean(outlet), staleTime: 60_000, placeholderData: (p) => p });
};

/** the value, but only once it has stopped changing for `ms` — so typing doesn't ask the server on every key */
export function useDebounced(value, ms = 400) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** "who would get this?" for an audience, live */
export const useMkPreview = (audience, enabled = true) => {
  const { outlet } = useOutlet();
  const settled = useDebounced(audience, 450);
  return useQuery({
    queryKey: ["mk-preview", outlet?._id, JSON.stringify(settled)],
    queryFn: () => api.mkPreview(outlet, settled),
    enabled: Boolean(outlet) && enabled,
    placeholderData: (p) => p,
    retry: false,
  });
};

export const useMkLists = () => {
  const { outlet } = useOutlet();
  return useQuery({ queryKey: ["mk-lists", outlet?._id], queryFn: () => api.mkLists(outlet), enabled: Boolean(outlet) });
};
export const useMkList = (id) => {
  const { outlet } = useOutlet();
  return useQuery({ queryKey: ["mk-list", outlet?._id, id], queryFn: () => api.mkList(outlet, id), enabled: Boolean(outlet && id) });
};
export const useMkCampaigns = () => {
  const { outlet } = useOutlet();
  return useQuery({ queryKey: ["mk-campaigns", outlet?._id], queryFn: () => api.mkCampaigns(outlet), enabled: Boolean(outlet), refetchInterval: 5000 });
};

/** a change (create a list, send a campaign…) — refreshes everything marketing shows */
export function useMkAction(fn) {
  const qc = useQueryClient();
  const { outlet } = useOutlet();
  return useMutation({
    mutationFn: (args) => fn(outlet, args),
    onSuccess: () => {
      for (const k of ["mk-lists", "mk-list", "mk-campaigns", "mk-channels", "mk-preview"]) void qc.invalidateQueries({ queryKey: [k] });
    },
  });
}
