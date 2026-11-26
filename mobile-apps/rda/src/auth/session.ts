import { createStore } from "zustand/vanilla";
import { ApiError } from "@/api/client";
import type { Api } from "@/api/endpoints";
import type { Rider } from "@/api/schemas";
import type { TokenStorage } from "./storage";

/**
 * Who is signed in. The app asks for a sign-in every time it starts (the token lives only in memory) unless the rider ticks
 * "Keep me signed in", which keeps the token in the phone's encrypted storage so the next start picks up where they left off —
 * after the server confirms the token still counts (it stops counting when the manager resets the PIN or switches the login off).
 */
export type SessionStatus = "starting" | "signed-out" | "signed-in";

export interface SessionState {
  status: SessionStatus;
  token: string | null;
  rider: Rider | null;
  /** a sentence for the sign-in screen: why the rider is back there ("Your sign-in ended…") */
  notice: string | null;
  signIn(phone: string, pin: string, keep: boolean): Promise<void>;
  signOut(): Promise<void>;
  /** the app just opened: pick up a kept sign-in, or land on the sign-in screen */
  start(): Promise<void>;
  /** the server said this sign-in no longer counts */
  expire(): void;
  clearNotice(): void;
}

export interface SessionDeps { api: () => Api; storage: TokenStorage }

export function createSessionStore({ api, storage }: SessionDeps) {
  const signedOut = (notice: string | null = null) => ({ status: "signed-out" as const, token: null, rider: null, notice });

  return createStore<SessionState>()((set, get) => ({
    status: "starting",
    token: null,
    rider: null,
    notice: null,

    async start() {
      // once only: Android can rebuild the screen while the app is in use (display size, a dev reload) and the root layout then asks
      // again — that must never sign a working rider out
      if (get().status !== "starting") return;
      const kept = await storage.load();
      if (!kept.token) return set(signedOut());
      set({ token: kept.token });
      try {
        const { rider } = await api().me();
        set({ rider, status: "signed-in", notice: null });
      } catch (e) {
        await storage.clear();
        set(signedOut(e instanceof ApiError && e.status === 403 ? e.message : e instanceof ApiError && e.isNetwork ? "Can't reach the server. Sign in again when you are back online." : null));
      }
    },

    async signIn(phone, pin, keep) {
      // the server checks everything: a wrong PIN, too many attempts, a blocked address, a switched-off login or store
      const answer = await api().signIn(phone.trim(), pin);
      set({ token: answer.token, rider: answer.rider, status: "signed-in", notice: null });
      if (keep) await storage.save(answer.token).catch(() => undefined);
      else await storage.clear();
    },

    async signOut() {
      const had = get().token;
      set(signedOut());
      await storage.clear();
      if (had) await api().signOut().catch(() => undefined);
    },

    expire() {
      if (get().status !== "signed-in") return;
      void storage.clear();
      set(signedOut("Your sign-in ended. Please sign in again."));
    },

    clearNotice() { set({ notice: null }); },
  }));
}
export type SessionStore = ReturnType<typeof createSessionStore>;
