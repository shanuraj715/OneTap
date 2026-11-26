import { createContext, useContext, useMemo, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useStore } from "zustand";
import { ApiError, createClient } from "@/api/client";
import { createApi, type Api } from "@/api/endpoints";
import { secureStorage, type TokenStorage } from "@/auth/storage";
import { createSessionStore, type SessionState, type SessionStore } from "@/auth/session";
import { createDraftStore, type DraftState, type DraftStore } from "@/cart/cart";
import { createAreaPrefs, type AreaPrefs } from "@/prefs/areas";
import { createUpdateStore, type UpdateStore } from "@/updates/store";
import { createRefreshStore, type RefreshStore } from "@/data/refresh";
import { prefsStorage, type PrefsStorage } from "@/prefs/storage";
import { API_URL, APP_BUILD, APP_VERSION, refreshPlan } from "@/lib/config";
import { keys } from "@/data/keys";

/** Everything the screens share: the server calls, who is signed in, the orders being put together, and the remembered answers. */
export interface Runtime { api: Api; session: SessionStore; drafts: DraftStore; areas: AreaPrefs; updates: UpdateStore; refresh: RefreshStore; queryClient: QueryClient }

export interface RuntimeOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  storage?: TokenStorage;
  /** where small preferences are kept (tests pass an in-memory one) */
  prefs?: PrefsStorage;
  /** tests turn retries off so a failure shows at once */
  retry?: boolean;
  /** which build / version this app says it is (tests pass their own; the app uses its real ones) */
  build?: number;
  version?: string;
}

/** A failed call is tried again (twice) only when trying again could help: no answer, or a server problem — not "wrong password" or "table taken". */
export const shouldRetry = (count: number, error: unknown): boolean => count < 2 && !(error instanceof ApiError && error.status >= 400 && error.status < 500);

export function createRuntime(options: RuntimeOptions = {}): Runtime {
  const drafts = createDraftStore();
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: options.retry === false ? false : shouldRetry, staleTime: 4_000, gcTime: 5 * 60_000, refetchOnReconnect: true },
      mutations: { retry: false },
    },
  });
  // `session` is needed by the client (for the token) and the client by the session (for sign-in): tie the knot lazily
  let session: SessionStore;
  let updates: UpdateStore;
  // how often to ask for new data: whatever the server last said for this app (the platform admin sets it in the console), else the default
  const refresh = createRefreshStore();
  const client = createClient({
    baseUrl: options.baseUrl ?? API_URL,
    fetchImpl: options.fetchImpl,
    getToken: () => session.getState().token,
    onUnauthorized: () => session.getState().expire(),
    // every call says which build this is; the server refuses the sign-in of a build that is too old while an update is required
    headers: { "x-app-id": "oma", "x-app-version-code": String(options.build ?? APP_BUILD), "x-oma-version-code": String(options.build ?? APP_BUILD), "x-oma-version": options.version ?? APP_VERSION },
    onUpdateRequired: (details) => updates.getState().markRequired(details),
    onRefreshSeconds: (raw) => refresh.getState().set(raw),
  });
  const api = createApi(client);
  updates = createUpdateStore({ api: () => api, build: options.build });
  session = createSessionStore({ api: () => api, storage: options.storage ?? secureStorage });
  session.subscribe((state, before) => {
    // leaving (sign out, or the sign-in ended): nothing from this person stays in memory for the next one
    if (before.status === "signed-in" && state.status !== "signed-in") {
      queryClient.clear();
      drafts.getState().clearAll();
    }
    // a platform admin going back to "which store?": nothing of the outlet they leave stays in memory
    if (state.status === "signed-in" && before.outletId && !state.outletId) {
      queryClient.clear();
      drafts.getState().clearAll();
    }
    // arriving (or switching outlet): load the menu ONCE, now, so it is ready when the first order is started
    if (state.status === "signed-in" && state.outletId && (before.status !== "signed-in" || before.outletId !== state.outletId)) {
      const outletId = state.outletId;
      void queryClient.prefetchQuery({ queryKey: keys.menu(outletId), queryFn: () => api.menu(outletId), staleTime: Infinity });
    }
  });
  // (preferences are NOT cleared when someone signs out: they belong to that person and come back when they sign in again)
  const areas = createAreaPrefs(options.prefs ?? prefsStorage);
  return { api, session, drafts, areas, updates, refresh, queryClient };
}

let shared: Runtime | undefined;
/** The app's own runtime (made once, on first use). */
export const sharedRuntime = (): Runtime => (shared ??= createRuntime());

const RuntimeContext = createContext<Runtime | null>(null);

export function RuntimeProvider({ runtime, children }: { runtime: Runtime; children: ReactNode }) {
  return (
    <RuntimeContext.Provider value={runtime}>
      <QueryClientProvider client={runtime.queryClient}>{children}</QueryClientProvider>
    </RuntimeContext.Provider>
  );
}

export function useRuntime(): Runtime {
  const runtime = useContext(RuntimeContext);
  if (!runtime) throw new Error("RuntimeProvider is missing above this screen");
  return runtime;
}
export const useApi = (): Api => useRuntime().api;
/** How long each thing the app refreshes by itself waits between asks: the server's number for this app (see lib/config.ts → refreshPlan). */
export function useRefreshPlan() {
  const seconds = useStore(useRuntime().refresh, (s) => s.seconds);
  return useMemo(() => refreshPlan(seconds), [seconds]);
}
export function useSession<T>(selector: (state: SessionState) => T): T {
  return useStore(useRuntime().session, selector);
}
export function useDrafts<T>(selector: (state: DraftState) => T): T {
  return useStore(useRuntime().drafts, selector);
}
/**
 * The signed-in person's outlet ("" for the split second between signing out and the screen going away: calls wait, nothing crashes —
 * every query below is switched off while there is no outlet).
 */
export function useOutletId(): string {
  return useSession((s) => s.outletId) ?? "";
}
