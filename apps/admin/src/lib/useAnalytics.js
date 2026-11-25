import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "./nav";
import { DEFAULT_FOOD_COST_PCT, DEFAULT_STOCK_SAFETY_PCT, EXPENSE_LINES, presetRange } from "@rasoipulse/config-schema";
import * as api from "./api";
import { useOutlet } from "./useOutlet";

/** Who may look at what, and which outlets there are (restricted people only see theirs). */
export function useAnOptions() {
  const { outlet } = useOutlet();
  return useQuery({ queryKey: ["an-options", outlet?._id], queryFn: () => api.an(outlet, "options"), enabled: Boolean(outlet), staleTime: 60_000 });
}

/**
 * The range and outlet choice shared by every Analytics tab, kept in the address (?range=last30&outlets=…) so a tab
 * switch, a reload or a shared link keeps the same view.
 */
export function useAnFilters() {
  const [sp, setSp] = useSearchParams();
  const preset = sp.get("range") ?? "last30";
  const range = useMemo(() => (preset === "custom" && sp.get("from") && sp.get("to") ? { from: sp.get("from"), to: sp.get("to") } : presetRange(preset === "custom" ? "last30" : preset)), [preset, sp]);
  const outlets = (sp.get("outlets") ?? "all") === "all" ? [] : sp.get("outlets").split(",").filter(Boolean);
  const set = useCallback((patch) => {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) (v === null || v === undefined || v === "" ? next.delete(k) : next.set(k, v));
    setSp(next, { replace: true });
  }, [sp, setSp]);
  return { preset, range, outlets, outletsParam: outlets.length ? outlets.join(",") : "all", search: sp.toString() ? `?${sp.toString()}` : "", set };
}

/** One analytics question for the chosen range and outlets. */
export function useAn(kind, filters, extra = {}, enabled = true) {
  const { outlet } = useOutlet();
  const params = { from: filters.range.from, to: filters.range.to, outlets: filters.outletsParam, ...extra };
  return useQuery({
    queryKey: ["an", kind, outlet?._id, JSON.stringify(params)],
    queryFn: () => api.an(outlet, kind, params),
    enabled: Boolean(outlet) && enabled,
    staleTime: 30_000,
    placeholderData: (p) => p,
    retry: false,
  });
}

/* --------------------------------------------------------------------- expenses */

/**
 * The profit calculator's expenses and settings. They live in this browser (localStorage) so a repeated bill like rent
 * or salaries is typed once; "Save to my store" also keeps a copy on the server so another device — or the accountant —
 * sees the same numbers. Amounts are monthly rupees; `scopes` has one list for the shared store bills and one per outlet.
 */
const keyFor = (brandId) => `rasoipulse.analytics.finance.${brandId}`;
const blank = () => ({ foodCostPct: DEFAULT_FOOD_COST_PCT, safetyPct: DEFAULT_STOCK_SAFETY_PCT, scopes: {}, savedAt: null });
export const defaultLines = (scope) => EXPENSE_LINES.filter((l) => scope === "all" || l.scope === scope || (scope !== "store" && l.scope === "outlet")).map((l) => ({ key: l.key, label: l.label, monthly: 0 }));

function readLocal(brandId) {
  try {
    const raw = localStorage.getItem(keyFor(brandId));
    return raw ? { ...blank(), ...JSON.parse(raw) } : null;
  } catch {
    return null;
  }
}
function writeLocal(brandId, value) {
  try {
    localStorage.setItem(keyFor(brandId), JSON.stringify(value));
  } catch {
    /* private mode / full: the numbers just won't be remembered */
  }
}

export function useFinanceProfile(enabled = true) {
  const { outlet } = useOutlet();
  const brandId = outlet?.brandId;
  const [state, setState] = useState(blank);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const [serverCopy, setServerCopy] = useState(null);

  // 1) this browser's copy; 2) if there is none, the one saved to the store
  useEffect(() => {
    if (!brandId || !enabled) return;
    const local = readLocal(brandId);
    if (local) setState(local);
    setLoaded(true);
    let off = false;
    api.an(outlet, "profile").then((r) => {
      if (off || !r.profile) return;
      setServerCopy(r.profile);
      if (!local) {
        setState({ ...blank(), ...r.profile.data, savedAt: r.profile.savedAt });
        setNote("Loaded the numbers saved to your store.");
      }
    }).catch(() => {});
    return () => { off = true; };
  }, [brandId, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = useCallback((patch) => {
    setState((s) => {
      const next = { ...s, ...patch };
      if (brandId) writeLocal(brandId, next);
      return next;
    });
    setNote("");
  }, [brandId]);

  const saveToStore = useCallback(async () => {
    setSaving(true);
    setNote("");
    try {
      const { foodCostPct, safetyPct, scopes } = state;
      const r = await api.anSaveProfile(outlet, { foodCostPct, safetyPct, scopes });
      setServerCopy(r.profile);
      update({ savedAt: r.profile.savedAt });
      setNote("Saved to your store — any device you sign in on will have these numbers.");
    } catch (e) {
      setNote(e.message);
    } finally {
      setSaving(false);
    }
  }, [state, outlet, update]);

  const loadFromStore = useCallback(() => {
    if (!serverCopy) return;
    setState({ ...blank(), ...serverCopy.data, savedAt: serverCopy.savedAt });
    if (brandId) writeLocal(brandId, { ...blank(), ...serverCopy.data, savedAt: serverCopy.savedAt });
    setNote("Loaded the numbers saved to your store.");
  }, [serverCopy, brandId]);

  return { state, update, loaded, saving, note, saveToStore, loadFromStore, serverCopy };
}
