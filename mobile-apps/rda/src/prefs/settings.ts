import { createStore } from "zustand/vanilla";
import type { PrefsStorage } from "./storage";

/** What a rider keeps the way they like it, remembered per rider on the phone: the new-delivery alert. Harmless: if it can't be saved it is forgotten. */
export interface SettingsState { alerts: boolean; loaded: boolean }
export const DEFAULT_SETTINGS: SettingsState = { alerts: true, loaded: false };
const KEY = (riderId: string) => `rda.settings.v1:${riderId}`;

export function createSettings(storage: PrefsStorage) {
  let key: string | null = null;
  const store = createStore<SettingsState>()(() => ({ ...DEFAULT_SETTINGS }));
  return {
    store,
    async load(riderId: string) {
      key = KEY(riderId);
      store.setState({ ...DEFAULT_SETTINGS });
      const raw = await storage.get(key);
      if (key !== KEY(riderId)) return; // someone else signed in meanwhile
      let saved: Partial<SettingsState> = {};
      try { saved = raw ? (JSON.parse(raw) as Partial<SettingsState>) : {}; } catch { /* unreadable: the defaults */ }
      store.setState({ alerts: typeof saved.alerts === "boolean" ? saved.alerts : DEFAULT_SETTINGS.alerts, loaded: true });
    },
    async set(patch: Partial<Pick<SettingsState, "alerts">>) {
      store.setState(patch);
      if (!key) return;
      await storage.set(key, JSON.stringify({ alerts: store.getState().alerts }));
    },
  };
}
export type Settings = ReturnType<typeof createSettings>;
