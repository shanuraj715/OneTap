import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

/**
 * What the owner has told the app about the profit calculation, kept on the phone: the food cost percentage, which way to count the bills
 * (the ones written in the expenses list, or monthly estimates) and the monthly estimates themselves.
 */
export interface PnlLineInput { id: string; label: string; monthly: number }
export type PnlMode = "recorded" | "monthly";
interface PnlPlanState {
  foodCostPct: number | null; mode: PnlMode; lines: PnlLineInput[];
  setFoodCostPct(v: number | null): void; setMode(m: PnlMode): void; addLine(label: string, monthly: number): void; removeLine(id: string): void;
  hydrate(): Promise<void>; reset(): void;
}
const KEY = "business.pnl";
const save = (s: Pick<PnlPlanState, "foodCostPct" | "mode" | "lines">) => { void AsyncStorage.setItem(KEY, JSON.stringify({ foodCostPct: s.foodCostPct, mode: s.mode, lines: s.lines })).catch(() => undefined); };
const fresh = () => ({ foodCostPct: null as number | null, mode: "recorded" as PnlMode, lines: [] as PnlLineInput[] });

export const usePnlPlan = create<PnlPlanState>((set, get) => ({
  ...fresh(),
  setFoodCostPct(foodCostPct) { set({ foodCostPct }); save(get()); },
  setMode(mode) { set({ mode }); save(get()); },
  addLine(label, monthly) { set({ lines: [...get().lines, { id: `l${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, label: label.trim(), monthly }] }); save(get()); },
  removeLine(id) { set({ lines: get().lines.filter((l) => l.id !== id) }); save(get()); },
  async hydrate() {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      const s = raw ? (JSON.parse(raw) as Partial<ReturnType<typeof fresh>>) : null;
      if (!s) return;
      set({
        foodCostPct: typeof s.foodCostPct === "number" ? s.foodCostPct : null, mode: s.mode === "monthly" ? "monthly" : "recorded",
        lines: Array.isArray(s.lines) ? s.lines.filter((l) => l && typeof l.label === "string" && Number(l.monthly) > 0).map((l) => ({ id: String(l.id), label: l.label, monthly: Number(l.monthly) })) : [],
      });
    } catch { /* nothing saved yet */ }
  },
  reset() { set(fresh()); void AsyncStorage.removeItem(KEY).catch(() => undefined); },
}));
