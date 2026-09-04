import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createOutlet, listOutlets, patchOutletConfig } from "./api";

const SELECTED_KEY = "onetap.selectedOutletId";

// Every page calls useOutlet()/useOutlets() independently, so "which outlet
// is selected" has to live in one shared place, not a useState local to each
// call site — otherwise switching outlets in the sidebar would update the
// switcher itself but leave every already-mounted page showing the old one.
const OutletSelectionContext = createContext(null);

/** Wrap the signed-in app shell in this once, above every route. */
export function OutletSelectionProvider({ children }) {
  const [selectedId, setSelectedId] = useState(() => {
    try {
      return localStorage.getItem(SELECTED_KEY) || null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (!selectedId) return;
    try {
      localStorage.setItem(SELECTED_KEY, selectedId);
    } catch {
      /* private browsing, storage disabled — selection just won't persist */
    }
  }, [selectedId]);

  return <OutletSelectionContext.Provider value={[selectedId, setSelectedId]}>{children}</OutletSelectionContext.Provider>;
}

/**
 * Every outlet the signed-in user can reach, plus which one is "current" in
 * the admin right now. Falls back to the first outlet in the list when
 * nothing is stored, or the stored id no longer exists — so a single-outlet
 * brand (still the common case) behaves exactly as before, with no picker
 * and no extra click.
 */
export function useOutlets() {
  const query = useQuery({ queryKey: ["outlets"], queryFn: listOutlets });
  const outlets = query.data?.outlets ?? [];
  const scope = query.data?.scope; // "all" for a superadmin, across every brand

  const ctx = useContext(OutletSelectionContext);
  if (!ctx) throw new Error("useOutlets() must be called within <OutletSelectionProvider>");
  const [selectedId, setSelectedId] = ctx;

  const outlet = useMemo(
    () => outlets.find((o) => o._id === selectedId) ?? outlets[0],
    [outlets, selectedId],
  );

  return {
    outlet,
    outlets,
    scope,
    selectOutlet: setSelectedId,
    isLoading: query.isLoading,
    error: query.error,
  };
}

/** Shorthand for the many pages that only ever need "the current outlet". */
export function useOutlet() {
  const { outlet, isLoading, error } = useOutlets();
  return { outlet, isLoading, error };
}

export function usePatchConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args                                                    ) =>
      patchOutletConfig(args.outlet, args.patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["outlets"] }),
  });
}

export function useCreateOutlet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args) => createOutlet(args.brandId, args.body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["outlets"] }),
  });
}
