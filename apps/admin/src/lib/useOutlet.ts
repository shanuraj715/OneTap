import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listOutlets, patchOutletConfig, seedDemo, type Outlet } from "./api";

/** The current outlet. For now: the first one (single-tenant dev). */
export function useOutlet() {
  const query = useQuery({ queryKey: ["outlets"], queryFn: listOutlets });
  return {
    outlet: query.data?.outlets?.[0] as Outlet | undefined,
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}

export function usePatchConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { outlet: Outlet; patch: Record<string, unknown> }) =>
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
