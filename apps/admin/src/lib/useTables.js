import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "./api";
                                    

export function useTables(outlet                    , enabled         ) {
  return useQuery({
    queryKey: ["tables", outlet?._id],
    queryFn: () => api.listTables(outlet ),
    enabled: Boolean(outlet) && enabled,
  });
}

/** Polls, so staff see a party seat themselves without refreshing. */
export function useActiveSessions(outlet                    , enabled         ) {
  return useQuery({
    queryKey: ["sessions", outlet?._id],
    queryFn: () => api.listActiveSessions(outlet ),
    enabled: Boolean(outlet) && enabled,
    refetchInterval: 10_000,
  });
}

function useTableMutation   (outlet                    , fn                                       ) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a   ) => fn(outlet , a),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tables"] });
      qc.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}

export const useCreateTable = (o         ) =>
  useTableMutation                                                   (o, api.createTable);
export const useDeleteTable = (o         ) => useTableMutation        (o, api.deleteTable);
export const useMoveSession = (o         ) =>
  useTableMutation                                          (o, (out, a) => api.moveSession(out, a.sessionId, a.toTableId));
export const useCloseSession = (o         ) => useTableMutation        (o, api.closeSession);
