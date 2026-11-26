import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Where small, harmless preferences live (which table areas a waiter keeps open). Not the secure store: that is for the sign-in token.
 * Reading or writing can fail (storage full, the native part missing in an old build): that must never break the app — a preference that
 * can't be remembered is simply forgotten, and the app carries on with its defaults.
 */
export interface PrefsStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export const prefsStorage: PrefsStorage = {
  async get(key) {
    try { return await AsyncStorage.getItem(key); } catch { return null; }
  },
  async set(key, value) {
    try { await AsyncStorage.setItem(key, value); } catch { /* not remembered */ }
  },
};
