import { createContext, useContext, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useStore } from "zustand";
import { ApiError, createClient } from "@/api/client";
import { createApi, type Api } from "@/api/endpoints";
import { secureStorage, type TokenStorage } from "@/auth/storage";
import { createSessionStore, type SessionState, type SessionStore } from "@/auth/session";
import { API_URL, APP_BUILD, APP_ID, APP_VERSION } from "@/lib/config";
import type { Me } from "@/lib/access";

/** Everything the screens share: the server calls, who is signed in, and the remembered answers. */
export interface Runtime { api: Api; session: SessionStore; queryClient: QueryClient }

export interface RuntimeOptions { baseUrl?: string; fetchImpl?: typeof fetch; storage?: TokenStorage; retry?: boolean }

/** A failed call is tried again (twice) only when trying again could help: no answer, or a server problem — not "forbidden" or "not found". */
export const shouldRetry = (count: number, error: unknown): boolean => count < 2 && !(error instanceof ApiError && error.status >= 400 && error.status < 500);

export function createRuntime(options: RuntimeOptions = {}): Runtime {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: options.retry === false ? false : shouldRetry, staleTime: 15_000, gcTime: 5 * 60_000, refetchOnReconnect: true }, mutations: { retry: false } },
  });
  let session: SessionStore;
  const client = createClient({
    baseUrl: options.baseUrl ?? API_URL,
    fetchImpl: options.fetchImpl,
    getToken: () => session.getState().token,
    onUnauthorized: () => session.getState().expire(),
    headers: { "x-app-id": APP_ID, "x-app-version-code": String(APP_BUILD), "x-app-version": APP_VERSION },
  });
  const api = createApi(client);
  session = createSessionStore({ api: () => api, storage: options.storage ?? secureStorage });
  // leaving (sign out, or the sign-in ended): nothing of this person stays in memory for the next one
  session.subscribe((state, before) => { if (before.status === "signed-in" && state.status !== "signed-in") queryClient.clear(); });
  return { api, session, queryClient };
}

let shared: Runtime | undefined;
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
export function useSession<T>(selector: (state: SessionState) => T): T { return useStore(useRuntime().session, selector); }
export const useMe = (): Me | null => useSession((s) => s.user);
