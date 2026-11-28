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
 * How long a list waits before asking the server again: `false` (never — the server will say when something changed) ONLY while the live connection is up.
 * In every other state — no connection yet, being made, lost and being made again, or refused by the server (the platform or this app is set to polling) —
 * the list asks on its timer. The timer is the backup that is always there: if the live line can't be had (a network that blocks it, a restarting server), the
 * screens still never go stale by more than one interval.
 */
export const pollEvery = (status: LiveStatus, ms: number): number | false => (status === "live" ? false : ms);
