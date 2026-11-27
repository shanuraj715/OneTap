import { createStore } from "zustand/vanilla";
import type { LiveStatus } from "./connection";

/** Where the live connection stands, for the screens: the loader while reconnecting, and whether the lists must ask on a timer instead. */
export interface LiveState {
  status: LiveStatus;
  set(status: LiveStatus): void;
}

export function createLiveStore() {
  return createStore<LiveState>()((set) => ({ status: "idle", set: (status) => set({ status }) }));
}
export type LiveStore = ReturnType<typeof createLiveStore>;

/**
 * How long a list waits before asking the server again: `false` (never — the server will say when something changed) while the live
 * connection is up OR coming back, `ms` otherwise (no connection yet, or the server refused live updates: the old timer).
 */
export const pollEvery = (status: LiveStatus, ms: number): number | false => (status === "live" || status === "connecting" || status === "reconnecting" ? false : ms);
