import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "./api";
import { useOutlet } from "./useOutlet";
import { useStorePlan } from "./useStorePlan";

/**
 * WhatsApp chat data. Everything is polled (the worker that holds the connections may be another process): the
 * chat list every 5 s, the open conversation every 3 s, a QR being scanned every 2 s.
 */
export function useWaMe() {
  const { outlet } = useOutlet();
  // a store whose plan doesn't include WhatsApp chat never asks (every answer would be a refusal) — and we only
  // start once the plan is known, so nothing is requested "just in case" while it loads
  const { plan } = useStorePlan();
  const entitled = Boolean(plan?.entitlements.features.includes("whatsappChat"));
  return useQuery({
    queryKey: ["wa-me", outlet?._id],
    queryFn: () => api.waMe(outlet),
    enabled: Boolean(outlet) && entitled,
    retry: false,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}

/** "manage" | "send" | "read" | "none" — "none" also while loading, when the plan lacks it, or for no access. */
export function useWaLevel() {
  const me = useWaMe();
  return me.data?.level ?? "none";
}

export const useWaAccounts = (opts = {}) => {
  const { outlet } = useOutlet();
  return useQuery({ queryKey: ["wa-accounts", outlet?._id], queryFn: () => api.waAccounts(outlet), enabled: Boolean(outlet), refetchInterval: opts.fast ? 2000 : 10_000 });
};

export const useWaChats = (filter) => {
  const { outlet } = useOutlet();
  return useQuery({
    queryKey: ["wa-chats", outlet?._id, filter.q, filter.view, filter.account],
    queryFn: () => api.waChats(outlet, filter),
    enabled: Boolean(outlet),
    refetchInterval: 5000,
    placeholderData: (prev) => prev,
  });
};

export const useWaMessages = (chatId) => {
  const { outlet } = useOutlet();
  return useQuery({ queryKey: ["wa-messages", outlet?._id, chatId], queryFn: () => api.waMessages(outlet, chatId), enabled: Boolean(outlet && chatId), refetchInterval: 3000 });
};

export const useWaBroadcasts = () => {
  const { outlet } = useOutlet();
  return useQuery({ queryKey: ["wa-broadcasts", outlet?._id], queryFn: () => api.waBroadcasts(outlet), enabled: Boolean(outlet), refetchInterval: 10_000 });
};

/** A WhatsApp action that refreshes everything WhatsApp afterwards. */
export function useWaAction(fn) {
  const qc = useQueryClient();
  const { outlet } = useOutlet();
  return useMutation({
    mutationFn: (args) => fn(outlet, args),
    onSuccess: () => {
      for (const k of ["wa-me", "wa-accounts", "wa-chats", "wa-messages", "wa-broadcasts", "wa-access", "wa-stats", "wa-cleanup", "wa-share-preview"]) void qc.invalidateQueries({ queryKey: [k] });
    },
  });
}
