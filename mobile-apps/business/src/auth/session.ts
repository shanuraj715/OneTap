import { createStore } from "zustand/vanilla";
import type { Api } from "@/api/endpoints";
import { canUseApp, type Me } from "@/lib/access";
import type { TokenStorage } from "./storage";

export type SessionStatus = "starting" | "signed-out" | "signed-in";
export interface SessionState {
  status: SessionStatus;
  token: string | null;
  user: Me | null;
  /** a line shown on the sign-in screen (the session ended, the account was switched off …) */
  notice: string | null;
  start(): Promise<void>;
  signIn(email: string, password: string, keep: boolean): Promise<void>;
  signOut(): Promise<void>;
  /** the server said this sign-in no longer counts */
  expire(): void;
  /** the person's rights changed (a role edit): look again */
  refresh(): Promise<void>;
  clearNotice(): void;
}
export type SessionStore = ReturnType<typeof createSessionStore>;

export function createSessionStore(deps: { api: () => Api; storage: TokenStorage }) {
  const signedOut = (notice: string | null = null) => ({ status: "signed-out" as const, token: null, user: null, notice });
  return createStore<SessionState>()((set, get) => ({
    status: "starting",
    token: null,
    user: null,
    notice: null,
    async start() {
      const token = await deps.storage.load();
      if (!token) return set(signedOut());
      set({ token });
      try {
        const { user } = await deps.api().me();
        if (!canUseApp(user)) { await deps.storage.clear(); return set(signedOut("This account can't use Rasoi Pulse Business. It is for store owners and the people they share reports with.")); }
        set({ user, status: "signed-in" });
      } catch (e) {
        // a refused token is gone for good; "no internet" keeps it for the next try (and starts signed out for now)
        if ((e as { status?: number }).status === 401) await deps.storage.clear();
        set(signedOut((e as { status?: number }).status === 0 ? "Can't reach the server. Check the internet connection." : null));
      }
    },
    async signIn(email, password, keep) {
      const res = await deps.api().signIn(email.trim(), password);
      // `keep`: only then does the token leave memory for the phone's secure storage
      if (keep) await deps.storage.save(res.token); else await deps.storage.clear();
      set({ token: res.token, user: res.user, status: "signed-in", notice: null });
    },
    async signOut() {
      const had = get().token;
      set(signedOut());
      await deps.storage.clear();
      if (had) await deps.api().signOut(had).catch(() => undefined);
    },
    expire() {
      if (get().status !== "signed-in") return;
      void deps.storage.clear();
      set(signedOut("You were signed out. Sign in again."));
    },
    async refresh() {
      try { const { user } = await deps.api().me(); if (!canUseApp(user)) get().expire(); else set({ user }); } catch { /* keep what we have */ }
    },
    clearNotice() { set({ notice: null }); },
  }));
}
