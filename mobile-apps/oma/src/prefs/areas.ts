import { createStore } from "zustand/vanilla";
import type { PrefsStorage } from "./storage";

/**
 * Which table AREAS ("Ground floor", "Terrace") a person keeps open on the board. Areas start CLOSED; opening or closing one is
 * remembered — per person and per outlet — and applied the next time the app opens, so someone who works one area never has to open it
 * again. Only the open ones are stored (closed is the default); the board's own search and filters open what they find without touching
 * what is remembered.
 */
const KEY_PREFIX = "oma.areas.v1:";

export interface AreaPrefsState {
  /** whose and which outlet's choices are loaded (`userId:outletId`), null before any */
  key: string | null;
  ready: boolean;
  open: readonly string[];
  /** read the saved choices for this person at this outlet (once; asking again for the same key does nothing) */
  load(key: string): Promise<void>;
  /** open or close one area. `known` = the areas that exist now: remembered choices for areas that are gone are dropped. */
  set(label: string, open: boolean, known?: readonly string[]): void;
}

/** What was stored, made safe: anything that isn't a list of names gives "nothing open". */
export function parseOpenAreas(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as { open?: unknown };
    return Array.isArray(v?.open) ? [...new Set(v.open.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length < 120))].slice(0, 200) : [];
  } catch {
    return [];
  }
}

export function createAreaPrefs(storage: PrefsStorage) {
  return createStore<AreaPrefsState>()((set, get) => ({
    key: null,
    ready: false,
    open: [],
    async load(key) {
      if (get().key === key) return;
      set({ key, ready: false, open: [] });
      const saved = parseOpenAreas(await storage.get(KEY_PREFIX + key));
      if (get().key !== key) return; // someone else signed in while this was being read
      set({ open: saved, ready: true });
    },
    set(label, open, known) {
      const { key, open: now } = get();
      if (!key) return;
      let next = open ? [...new Set([...now, label])] : now.filter((l) => l !== label);
      if (known) next = next.filter((l) => known.includes(l));
      set({ open: next });
      void storage.set(KEY_PREFIX + key, JSON.stringify({ v: 1, open: next }));
    },
  }));
}
export type AreaPrefs = ReturnType<typeof createAreaPrefs>;
