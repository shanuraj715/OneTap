import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "./api";
import type { Outlet } from "./api";

export function useTables(outlet: Outlet | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["tables", outlet?._id],
    queryFn: () => api.listTables(outlet!),
    enabled: Boolean(outlet) && enabled,
  });
}

/** Polls, so staff see a party seat themselves without refreshing. */
export function useActiveSessions(outlet: Outlet | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["sessions", outlet?._id],
    queryFn: () => api.listActiveSessions(outlet!),
    enabled: Boolean(outlet) && enabled,
    refetchInterval: 10_000,
  });
}

function useTableMutation<T>(outlet: Outlet | undefined, fn: (o: Outlet, a: T) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: T) => fn(outlet!, a),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tables"] });
      qc.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}

export const useCreateTable = (o?: Outlet) =>
  useTableMutation<{ number: string; zone?: string; seats?: number }>(o, api.createTable);
export const useDeleteTable = (o?: Outlet) => useTableMutation<string>(o, api.deleteTable);
export const useMoveSession = (o?: Outlet) =>
  useTableMutation<{ sessionId: string; toTableId: string }>(o, (out, a) => api.moveSession(out, a.sessionId, a.toTableId));
export const useCloseSession = (o?: Outlet) => useTableMutation<string>(o, api.closeSession);
