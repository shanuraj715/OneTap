import * as SecureStore from "expo-secure-store";
import { SECURE_KEYS } from "@/lib/config";

/** The phone's encrypted storage (Android Keystore). A token goes in ONLY when the person ticks "Keep me signed in". */
export interface TokenStorage {
  load(): Promise<{ token: string | null; outletId: string | null }>;
  save(token: string, outletId: string | null): Promise<void>;
  saveOutlet(outletId: string): Promise<void>;
  clear(): Promise<void>;
}

export const secureStorage: TokenStorage = {
  async load() {
    try {
      const [token, outletId] = await Promise.all([SecureStore.getItemAsync(SECURE_KEYS.token), SecureStore.getItemAsync(SECURE_KEYS.outlet)]);
      return { token, outletId };
    } catch {
      return { token: null, outletId: null }; // unreadable storage = start signed out
    }
  },
  async save(token, outletId) {
    await SecureStore.setItemAsync(SECURE_KEYS.token, token);
    if (outletId) await SecureStore.setItemAsync(SECURE_KEYS.outlet, outletId);
  },
  async saveOutlet(outletId) {
    await SecureStore.setItemAsync(SECURE_KEYS.outlet, outletId);
  },
  async clear() {
    await Promise.all([SecureStore.deleteItemAsync(SECURE_KEYS.token), SecureStore.deleteItemAsync(SECURE_KEYS.outlet)]).catch(() => undefined);
  },
};
