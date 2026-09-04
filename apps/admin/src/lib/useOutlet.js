import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listOutlets, patchOutletConfig, seedDemo,             } from "./api";

/** The current outlet. For now: the first one (single-tenant dev). */
export function useOutlet() {
  const query = useQuery({ queryKey: ["outlets"], queryFn: listOutlets });
  return {
    outlet: query.data?.outlets?.[0]                      ,
    isLoading: query.isLoading,
    error: query.error                ,
  };
}

export function usePatchConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args                                                    ) =>
      patchOutletConfig(args.outlet, args.patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["outlets"] }),
  });
}

export function useSeedDemo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: seedDemo,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["outlets"] }),
  });
}
