import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { presetRange, today, type PresetId, type Range } from "@/lib/dates";

/**
 * What every report is looking at: a PERIOD (a preset such as "Last 30 days", or two chosen days) and some OUTLETS (none chosen = every outlet
 * the person may see). One choice shared by every screen, kept on the phone. `home` is the outlet the app sends in the request header: any outlet
 * the person may see (the server needs one to know whose store this is).
 */
export type PeriodId = PresetId | "custom";
export interface ScopeState {
  period: PeriodId; custom: Range; outlets: string[]; home: string | null; ready: boolean;
  setPeriod(p: PresetId): void; setCustom(r: Range): void; setOutlets(ids: string[]): void; setHome(id: string | null): void;
  hydrate(): Promise<void>; reset(): void;
}

const KEY = "business.scope";
const persist = (s: Pick<ScopeState, "period" | "custom" | "outlets">) => { void AsyncStorage.setItem(KEY, JSON.stringify({ period: s.period, custom: s.custom, outlets: s.outlets })).catch(() => undefined); };
const fresh = () => ({ period: "last30" as PeriodId, custom: { from: today(), to: today() }, outlets: [] as string[] });

export const useScope = create<ScopeState>((set, get) => ({
  ...fresh(), home: null, ready: false,
  setPeriod(period) { set({ period }); persist(get()); },
  setCustom(custom) { set({ period: "custom", custom }); persist(get()); },
  setOutlets(outlets) { set({ outlets }); persist(get()); },
  setHome(home) { set({ home }); },
  async hydrate() {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      const saved = raw ? (JSON.parse(raw) as Partial<ReturnType<typeof fresh>>) : null;
      set({ ...(saved?.period ? { period: saved.period } : {}), ...(saved?.custom?.from ? { custom: saved.custom } : {}), ...(Array.isArray(saved?.outlets) ? { outlets: saved!.outlets } : {}), ready: true });
    } catch { set({ ready: true }); }
  },
  reset() { set({ ...fresh(), home: null }); void AsyncStorage.removeItem(KEY).catch(() => undefined); },
}));

/** The period as two days. */
export const rangeOfScope = (s: Pick<ScopeState, "period" | "custom">, now: Date = new Date()): Range => (s.period === "custom" ? s.custom : presetRange(s.period, now));

/** The part of a request address that says WHICH period and outlets: `from=…&to=…&outlets=a,b`. */
export function scopeQuery(s: Pick<ScopeState, "period" | "custom" | "outlets">, extra: Record<string, string | number | undefined> = {}, now: Date = new Date()): string {
  const r = rangeOfScope(s, now);
  const q: Record<string, string> = { from: r.from, to: r.to };
  if (s.outlets.length) q.outlets = s.outlets.join(",");
  for (const [k, v] of Object.entries(extra)) if (v !== undefined && v !== "") q[k] = String(v);
  return new URLSearchParams(q).toString();
}
