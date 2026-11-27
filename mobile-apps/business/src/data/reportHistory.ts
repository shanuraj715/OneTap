import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

/** The reports this phone has made lately (the last 15), so one can be shared again without asking the server. */
export interface MadeReport { id: string; name: string; uri: string; mime: string; format: string; period: string; at: string; size: number }
/** A report just made: given its id and time. */
export const madeReport = (r: Omit<MadeReport, "id" | "at">): MadeReport => ({ ...r, id: `${Date.now()}`, at: new Date().toISOString() });

interface HistoryState {
  items: MadeReport[]; hydrated: boolean;
  /** adds one and returns the ones pushed out (the caller deletes their files) */
  add(r: MadeReport): MadeReport[]; remove(id: string): MadeReport | undefined; hydrate(): Promise<void>; reset(): void;
}
const KEY = "business.reports";
const MAX = 15;
const save = (items: MadeReport[]) => { void AsyncStorage.setItem(KEY, JSON.stringify(items)).catch(() => undefined); };

export const useReportHistory = create<HistoryState>((set, get) => ({
  items: [], hydrated: false,
  add(r) {
    const all = [r, ...get().items];
    const items = all.slice(0, MAX);
    set({ items }); save(items);
    return all.slice(MAX);
  },
  remove(id) {
    const gone = get().items.find((x) => x.id === id);
    const items = get().items.filter((x) => x.id !== id);
    set({ items }); save(items);
    return gone;
  },
  async hydrate() {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      const items = raw ? (JSON.parse(raw) as MadeReport[]).filter((x) => x && typeof x.uri === "string" && typeof x.name === "string") : [];
      set({ items: items.slice(0, MAX), hydrated: true });
    } catch { set({ hydrated: true }); }
  },
  reset() { set({ items: [], hydrated: false }); void AsyncStorage.removeItem(KEY).catch(() => undefined); },
}));
