import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createOutlet, deleteOutlet, listOutlets, patchOutletConfig, updateOutlet } from "./api";

const SELECTED_KEY = "onetap.selectedOutletId";
const OPEN_STORE_KEY = "onetap.openStoreId";

const load = (key) => {
  try {
    return localStorage.getItem(key) || null;
  } catch {
    return null;
  }
};
const save = (key, value) => {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* private browsing, storage disabled — selection just won't persist */
  }
};

// Every page calls useOutlet()/useOutlets() independently, so "which outlet
// is selected" has to live in one shared place, not a useState local to each
// call site — otherwise switching outlets in the sidebar would update the
// switcher itself but leave every already-mounted page showing the old one.
const OutletSelectionContext = createContext(null);

/** Wrap the signed-in app shell in this once, above every route. */
export function OutletSelectionProvider({ children }) {
  const [selectedId, setSelectedId] = useState(() => load(SELECTED_KEY));
  // The platform super admin's "open store dashboard": which store they're
  // looking at, or null while they're in the platform console.
  const [openStoreId, setOpenStoreId] = useState(() => load(OPEN_STORE_KEY));

  useEffect(() => {
    if (selectedId) save(SELECTED_KEY, selectedId);
  }, [selectedId]);
  useEffect(() => save(OPEN_STORE_KEY, openStoreId), [openStoreId]);

  const value = useMemo(
    () => ({ selectedId, setSelectedId, openStoreId, setOpenStoreId }),
    [selectedId, openStoreId],
  );
  return <OutletSelectionContext.Provider value={value}>{children}</OutletSelectionContext.Provider>;
}

/** The platform's store-viewing state — `openStore(id)` enters a store's dashboard, `closeStore()` leaves it. */
export function useOpenStore() {
  const ctx = useContext(OutletSelectionContext);
  if (!ctx) throw new Error("useOpenStore() must be called within <OutletSelectionProvider>");
  return {
    openStoreId: ctx.openStoreId,
    openStore: (id) => {
      ctx.setSelectedId(null);
      ctx.setOpenStoreId(id);
    },
    closeStore: () => ctx.setOpenStoreId(null),
  };
}

/**
 * Every outlet the signed-in user can reach, plus which one is "current" in
 * the admin right now. Falls back to the first outlet in the list when
 * nothing is stored, or the stored id no longer exists — so a single-outlet
 * brand (still the common case) behaves exactly as before, with no picker
 * and no extra click.
 */
export function useOutlets() {
  const ctx = useContext(OutletSelectionContext);
  if (!ctx) throw new Error("useOutlets() must be called within <OutletSelectionProvider>");
  const { selectedId, setSelectedId, openStoreId } = ctx;

  // A super admin viewing one store sees just that store's outlets; owners
  // and staff get their own store's outlets either way.
  const query = useQuery({ queryKey: ["outlets", openStoreId ?? "own"], queryFn: () => listOutlets(openStoreId ?? undefined) });
  const outlets = query.data?.outlets ?? [];
  const scope = query.data?.scope; // "all" (every brand) / "store" (one opened store) for a superadmin

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["outlets"] });
      qc.invalidateQueries({ queryKey: ["store-plan"] });
    },
  });
}

export function useUpdateOutlet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args) => updateOutlet(args.id, args.body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["outlets"] }),
  });
}

/** Clears the selection too, so a deleted outlet never lingers as "current". */
export function useDeleteOutlet() {
  const qc = useQueryClient();
  const ctx = useContext(OutletSelectionContext);
  const setSelectedId = ctx?.setSelectedId;
  return useMutation({
    mutationFn: (id) => deleteOutlet(id),
    onSuccess: () => {
      setSelectedId?.(null);
      qc.invalidateQueries({ queryKey: ["outlets"] });
      qc.invalidateQueries({ queryKey: ["store-plan"] });
    },
  });
}
