import { createContext, useContext, useMemo, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useStore } from "zustand";
import { ApiError, createClient } from "@/api/client";
import { createApi, type Api } from "@/api/endpoints";
import { secureStorage, type TokenStorage } from "@/auth/storage";
import { createSessionStore, type SessionState, type SessionStore } from "@/auth/session";
import { createSettings, type Settings } from "@/prefs/settings";
import { createUpdateStore, type UpdateStore } from "@/updates/store";
import { createRefreshStore, type RefreshStore } from "@/data/refresh";
import { createLiveStore, pollEvery, type LiveStore } from "@/live/store";
import { prefsStorage, type PrefsStorage } from "@/prefs/storage";
import { API_URL, APP_BUILD, APP_ID, APP_VERSION, refreshPlan } from "@/lib/config";

/** Everything the screens share: the server calls, who is signed in, and the remembered answers. */
export interface Runtime { api: Api; session: SessionStore; settings: Settings; updates: UpdateStore; refresh: RefreshStore; live: LiveStore; queryClient: QueryClient }

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

/** A failed call is tried again (twice) only when trying again could help: no answer, or a server problem — not "wrong PIN" or "wrong code". */
export const shouldRetry = (count: number, error: unknown): boolean => count < 2 && !(error instanceof ApiError && error.status >= 400 && error.status < 500);

export function createRuntime(options: RuntimeOptions = {}): Runtime {
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
  // where the live connection stands (the loader while reconnecting; whether the list must ask on a timer)
  const live = createLiveStore();
  const client = createClient({
    baseUrl: options.baseUrl ?? API_URL,
    fetchImpl: options.fetchImpl,
    getToken: () => session.getState().token,
    onUnauthorized: () => session.getState().expire(),
    // every call says which build this is; the server refuses the sign-in of a build that is too old while an update is required
    headers: { "x-app-id": APP_ID, "x-app-version-code": String(options.build ?? APP_BUILD), "x-app-version": options.version ?? APP_VERSION },
    onUpdateRequired: (details) => updates.getState().markRequired(details),
    onRefreshSeconds: (raw) => refresh.getState().set(raw),
  });
  const api = createApi(client);
  updates = createUpdateStore({ api: () => api, build: options.build });
  session = createSessionStore({ api: () => api, storage: options.storage ?? secureStorage });
  session.subscribe((state, before) => {
    // leaving (sign out, or the sign-in ended): nothing from this rider stays in memory for the next one
    if (before.status === "signed-in" && state.status !== "signed-in") queryClient.clear();
  });
  // (preferences are NOT cleared when someone signs out: they belong to that person and come back when they sign in again)
  const settings = createSettings(options.prefs ?? prefsStorage);
  return { api, session, settings, updates, refresh, live, queryClient };
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
/**
 * How long each thing the app refreshes by itself waits between asks: the server's number for this app (see lib/config.ts → refreshPlan) —
 * but `false` (never) while the live connection is up or coming back: the server says when something changed, so nobody asks on a timer.
 * If the server refuses live updates the numbers apply again.
 */
export function useRefreshPlan() {
  const runtime = useRuntime();
  const seconds = useStore(runtime.refresh, (s) => s.seconds);
  const status = useStore(runtime.live, (s) => s.status);
  return useMemo(() => {
    const plan = refreshPlan(seconds);
    return Object.fromEntries(Object.entries(plan).map(([name, ms]) => [name, pollEvery(status, ms)])) as { [K in keyof typeof plan]: number | false };
  }, [seconds, status]);
}
export function useSession<T>(selector: (state: SessionState) => T): T {
  return useStore(useRuntime().session, selector);
}
