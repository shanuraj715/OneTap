import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { confirmIdentity, lockAvailable } from "@/lib/biometrics";

/**
 * The app lock: when it is on, the app asks for the phone's fingerprint / face / screen lock each time it opens and when it comes back after
 * half a minute away. The switch is kept on the phone. Turning it on or off also asks (so nobody holding the phone can switch it off).
 */
interface LockState {
  enabled: boolean; locked: boolean;
  hydrate(): Promise<void>;
  /** false = it did not change (the person did not confirm, or this phone has no screen lock) */
  setEnabled(on: boolean): Promise<boolean>;
  /** lock now (does nothing when the lock is off) */
  lock(): void;
  /** ask; true = unlocked */
  unlock(): Promise<boolean>;
  reset(): void;
}
const KEY = "business.lock";
/** How long the app may be away before it asks again. */
export const LOCK_AFTER_MS = 30_000;

export const useAppLock = create<LockState>((set, get) => ({
  enabled: false, locked: false,
  async hydrate() {
    try { const on = (await AsyncStorage.getItem(KEY)) === "1"; set({ enabled: on, locked: on }); } catch { /* nothing saved: no lock */ }
  },
  async setEnabled(on) {
    if (on && !(await lockAvailable())) return false;
    if (!(await confirmIdentity(on ? "Turn on the app lock" : "Turn off the app lock"))) return false;
    set({ enabled: on, locked: false });
    void (on ? AsyncStorage.setItem(KEY, "1") : AsyncStorage.removeItem(KEY)).catch(() => undefined);
    return true;
  },
  lock() { if (get().enabled) set({ locked: true }); },
  async unlock() {
    if (!(await confirmIdentity("Unlock Rasoi Pulse Business"))) return false;
    set({ locked: false });
    return true;
  },
  reset() { set({ enabled: false, locked: false }); void AsyncStorage.removeItem(KEY).catch(() => undefined); },
}));

/**
 * Tells the app when to lock: feed it each change of the phone's app state ("background", "active" …). It answers true when the app comes back
 * after being away for more than {@link LOCK_AFTER_MS}.
 */
export function createAwayTracker(now: () => number = Date.now) {
  let leftAt = 0;
  return (next: string): boolean => {
    if (next === "background") { leftAt = now(); return false; }
    if (next !== "active") return false;
    const away = leftAt > 0 && now() - leftAt > LOCK_AFTER_MS;
    leftAt = 0;
    return away;
  };
}
