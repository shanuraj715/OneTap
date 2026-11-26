import { createStore } from "zustand/vanilla";
import { REFRESH_DEFAULT_SECONDS, REFRESH_MAX_SECONDS, REFRESH_MIN_SECONDS } from "@/lib/config";

/**
 * How often to ask the server for new data, in seconds. The platform admin sets it for each app in the console; the server puts it in the
 * `x-refresh-seconds` header of every answer, and `set` takes whatever arrives: a number outside the allowed range (or no number at all) is
 * ignored, so a broken proxy or an old server can never make the app hammer the server or stop refreshing. Until the first answer: the default.
 */
export interface RefreshState {
  seconds: number;
  set(raw: unknown): void;
}

/** "15" → 15; anything that isn't a whole number of seconds inside the allowed range → null. */
export function parseRefreshSeconds(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= REFRESH_MIN_SECONDS && n <= REFRESH_MAX_SECONDS ? n : null;
}

export function createRefreshStore() {
  return createStore<RefreshState>()((set, get) => ({
    seconds: REFRESH_DEFAULT_SECONDS,
    set(raw) {
      const n = parseRefreshSeconds(raw);
      if (n !== null && n !== get().seconds) set({ seconds: n });
    },
  }));
}
export type RefreshStore = ReturnType<typeof createRefreshStore>;
