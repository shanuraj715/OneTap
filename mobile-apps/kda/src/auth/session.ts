import { createStore } from "zustand/vanilla";
import { ApiError } from "@/api/client";
import type { Api } from "@/api/endpoints";
import type { Outlet, User } from "@/api/schemas";
import type { TokenStorage } from "./storage";

/**
 * Who is signed in. The app asks for a sign-in every time it starts (the token lives only in memory) unless the person ticks
 * "Keep me signed in", which keeps the token in the phone's encrypted storage so the next start picks up where they left off —
 * after the server confirms the token still counts.
 */
export type SessionStatus = "starting" | "signed-out" | "signed-in";

export interface SessionState {
  status: SessionStatus;
  token: string | null;
  user: User | null;
  outlets: Outlet[];
  outletId: string | null;
  /** a sentence for the sign-in screen: why the person is back there ("Your session ended…") */
  notice: string | null;
  signIn(email: string, password: string, keep: boolean): Promise<void>;
  signOut(): Promise<void>;
  /** the app just opened: pick up a kept sign-in, or land on the sign-in screen */
  start(): Promise<void>;
  /** the server said this sign-in no longer counts */
  expire(): void;
  selectOutlet(id: string): Promise<void>;
  /** a platform admin goes back to "which store, which outlet?" (nobody else can: their outlets are fixed by their account) */
  changeOutlet(): void;
  clearNotice(): void;
}

/** This app is for the kitchen team (kitchen staff, kitchen managers, owners): the server's `kitchen:app` permission, and the board's order permissions. */
export const REQUIRED_PERMISSIONS = ["kitchen:app", "order:read", "order:update"] as const;
export const canUseApp = (user: User | null): boolean => !!user && REQUIRED_PERMISSIONS.every((p) => user.permissions.includes(p));

const ROLE_NAMES: Record<string, string> = { kitchen: "Kitchen staff", editor: "Editor", accountant: "Accountant", manager: "Manager", staff: "Cashier / Waiter", owner: "Owner", super_admin: "Platform admin" };
export const notForThisApp = (user: User) => `This app is for the kitchen team (kitchen staff, kitchen managers and owners). The account ${user.email} (${ROLE_NAMES[user.role ?? ""] ?? user.role ?? "no role"}) can't use it.`;

export interface SessionDeps { api: () => Api; storage: TokenStorage }

export function createSessionStore({ api, storage }: SessionDeps) {
  const signedOut = (notice: string | null = null) => ({ status: "signed-out" as const, token: null, user: null, outlets: [], outletId: null, notice });
  /** the outlets this person may take orders at, and the one to start on (the one they used last, if it is still theirs) */
  const pickOutlet = (outlets: Outlet[], preferred: string | null) => outlets.find((o) => o.id === preferred)?.id ?? outlets[0]?.id ?? null;

  const store = createStore<SessionState>()((set, get) => {
    /** with a token already in `state.token`: who is it, may they use the app, which outlets */
    async function load(preferredOutlet: string | null) {
      const { user } = await api().me();
      if (!canUseApp(user)) throw new ApiError(403, notForThisApp(user));
      const outlets = (await api().outlets()).outlets.filter((o) => !o.blocked); // a blocked outlet can't take orders
      if (!outlets.length) throw new ApiError(403, "This account has no restaurant outlet to take orders for.");
      // a platform admin can work in any store, so nothing is chosen for them: the app asks which store and which outlet, every time
      const outletId = user.isSuperAdmin ? null : pickOutlet(outlets, preferredOutlet);
      set({ user, outlets, outletId, status: "signed-in", notice: null });
    }

    return {
      status: "starting",
      token: null,
      user: null,
      outlets: [],
      outletId: null,
      notice: null,

      async start() {
        // once only: Android can rebuild the screen while the app is in use (display size, font size, a dev reload) and the root layout
        // then asks again — that must never sign a working waiter out and throw away their unsent orders
        if (get().status !== "starting") return;
        const kept = await storage.load();
        if (!kept.token) return set(signedOut());
        set({ token: kept.token });
        try {
          await load(kept.outletId);
        } catch (e) {
          await storage.clear();
          set(signedOut(e instanceof ApiError && e.status === 403 ? e.message : e instanceof ApiError && e.isNetwork ? "Can't reach the server. Sign in again when you are back online." : null));
        }
      },

      async signIn(email, password, keep) {
        // the server also checks everything: wrong passwords, too many attempts, a blocked address
        const answer = await api().signIn(email.trim(), password);
        set({ token: answer.token });
        try {
          const { user } = answer;
          if (!canUseApp(user)) {
            await api().signOut().catch(() => undefined); // end the session we just opened
            set(signedOut());
            throw new ApiError(403, notForThisApp(user));
          }
          await load(null);
          if (keep) await storage.save(answer.token, get().outletId);
          else await storage.clear();
        } catch (e) {
          if (get().status !== "signed-in") {
            if (get().token) await api().signOut().catch(() => undefined);
            set(signedOut());
          }
          throw e;
        }
      },

      async signOut() {
        const had = get().token;
        set(signedOut());
        await storage.clear();
        if (had) await api().signOut().catch(() => undefined); // the server forgets this token; no matter if the phone is offline
      },

      expire() {
        if (get().status !== "signed-in") return;
        void storage.clear();
        set(signedOut("Your sign-in ended. Please sign in again."));
      },

      async selectOutlet(id) {
        if (!get().outlets.some((o) => o.id === id)) return;
        set({ outletId: id });
        // (a platform admin is asked again next time, so there is nothing to remember for them)
        if (!get().user?.isSuperAdmin && (await storage.load().then((s) => !!s.token))) await storage.saveOutlet(id).catch(() => undefined);
      },

      changeOutlet() {
        if (get().status === "signed-in" && get().user?.isSuperAdmin) set({ outletId: null });
      },

      clearNotice() { set({ notice: null }); },
    };
  });
  return store;
}
export type SessionStore = ReturnType<typeof createSessionStore>;
