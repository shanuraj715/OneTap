import * as SecureStore from "expo-secure-store";
import { SECURE_KEYS } from "@/lib/config";

/** The phone's encrypted storage (Android Keystore). A token goes in ONLY when the person ticks "Keep me signed in". */
export interface TokenStorage { load(): Promise<string | null>; save(token: string): Promise<void>; clear(): Promise<void> }

export const secureStorage: TokenStorage = {
  async load() {
    try { return await SecureStore.getItemAsync(SECURE_KEYS.token); } catch { return null; } // unreadable storage = start signed out
  },
  async save(token) { await SecureStore.setItemAsync(SECURE_KEYS.token, token); },
  async clear() { await SecureStore.deleteItemAsync(SECURE_KEYS.token).catch(() => undefined); },
};
