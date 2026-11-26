import { createStore } from "zustand/vanilla";
import type { PrefsStorage } from "./storage";
import type { Screen } from "@/api/schemas";

/**
 * What a kitchen person keeps the way they like it, remembered per person and outlet on the phone: the new-order alert, whether the screen
 * stays on, and which station (All / Kitchen / Bar) they were looking at. Harmless things: if they can't be saved they are simply forgotten.
 */
export interface SettingsState {
  alerts: boolean;
  keepAwake: boolean;
  screen: Screen;
  loaded: boolean;
}
export const DEFAULT_SETTINGS: SettingsState = { alerts: true, keepAwake: true, screen: "all", loaded: false };
const KEY = (userId: string, outletId: string) => `kda.settings.v1:${userId}:${outletId}`;

export function createSettings(storage: PrefsStorage) {
  let key: string | null = null;
  const store = createStore<SettingsState>()(() => ({ ...DEFAULT_SETTINGS }));
  return {
    store,
    /** this person at this outlet: read what they kept (the defaults until it arrives, and when there is nothing) */
    async load(userId: string, outletId: string) {
      key = KEY(userId, outletId);
      store.setState({ ...DEFAULT_SETTINGS });
      const raw = await storage.get(key);
      if (key !== KEY(userId, outletId)) return; // someone else signed in meanwhile
      let saved: Partial<SettingsState> = {};
      try { saved = raw ? (JSON.parse(raw) as Partial<SettingsState>) : {}; } catch { /* unreadable: the defaults */ }
      store.setState({
        alerts: typeof saved.alerts === "boolean" ? saved.alerts : DEFAULT_SETTINGS.alerts,
        keepAwake: typeof saved.keepAwake === "boolean" ? saved.keepAwake : DEFAULT_SETTINGS.keepAwake,
        screen: saved.screen === "kitchen" || saved.screen === "bar" ? saved.screen : "all",
        loaded: true,
      });
    },
    async set(patch: Partial<Pick<SettingsState, "alerts" | "keepAwake" | "screen">>) {
      store.setState(patch);
      if (!key) return;
      const { alerts, keepAwake, screen } = store.getState();
      await storage.set(key, JSON.stringify({ alerts, keepAwake, screen }));
    },
  };
}
export type Settings = ReturnType<typeof createSettings>;
