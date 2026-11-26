import fs from "node:fs";
import path from "node:path";
import type { ReactElement } from "react";
import { render, type RenderResult } from "@testing-library/react-native";
import type { TokenStorage } from "@/auth/storage";
import type { PrefsStorage } from "@/prefs/storage";
import { createRuntime, RuntimeProvider, type Runtime } from "@/runtime";

/** Recorded real answers of the Rasoi Pulse API (see tests/e2e/suites/_record-rider-app-fixtures.mjs in the repository root). */
export const fx = <T = any>(name: string): T => JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", `${name}.json`), "utf8"));

export interface Call { method: string; path: string; query: string; headers: Record<string, string>; body: any }
export interface Answer { status?: number; json?: unknown; headers?: Record<string, string>; throws?: Error; never?: boolean; /** answer after this many milliseconds (to test what the screen does while it waits) */ delayMs?: number; /** hold the answer until this promise resolves (the test decides exactly when it arrives) */ gate?: Promise<void> }
export type Handler = Answer | ((call: Call, params: Record<string, string>) => Answer);

const defaults = (): Record<string, Handler> => ({
  "GET /api/auth/guard": { json: fx("auth-guard") },
  "POST /api/rider/login": { json: fx("rider-login") },
  "POST /api/rider/logout": { status: 204 },
  "GET /api/rider/me": { json: { rider: fx("rider-login").rider } },
  "GET /api/app-updates/check": { json: fx("update-check-none") },
  "GET /api/rider/deliveries": { json: fx("deliveries") },
  "POST /api/rider/deliveries/:id/pickup": { json: fx("delivery-picked-up") },
  "POST /api/rider/deliveries/:id/delivered": { json: fx("delivery-delivered") },
});

const toRegex = (pattern: string) => new RegExp(`^${pattern.replace(/:[a-zA-Z]+/g, "([^/]+)")}$`);

/** A pretend server: answers from the recorded fixtures (or from what a test says instead) and remembers every call. */
export function fakeServer(overrides: Record<string, Handler> = {}) {
  const routes = { ...defaults(), ...overrides };
  const calls: Call[] = [];
  const impl = jest.fn(async (url: string, init: RequestInit = {}) => {
    const u = new URL(url);
    const method = (init.method ?? "GET").toUpperCase();
    const call: Call = { method, path: u.pathname, query: u.search, headers: (init.headers ?? {}) as Record<string, string>, body: init.body ? JSON.parse(String(init.body)) : undefined };
    calls.push(call);
    let answer: Answer = { status: 404, json: { error: `No fake route for ${method} ${u.pathname}` } };
    for (const [key, handler] of Object.entries(routes)) {
      const [m, p] = key.split(" ") as [string, string];
      const match = m === method ? toRegex(p!).exec(u.pathname) : null;
      if (!match) continue;
      const names = [...p!.matchAll(/:([a-zA-Z]+)/g)].map((x) => x[1]!);
      const params = Object.fromEntries(names.map((n, i) => [n, match[i + 1]!]));
      answer = typeof handler === "function" ? handler(call, params) : handler;
      break;
    }
    if (answer.gate) await answer.gate;
    if (answer.delayMs) await new Promise((r) => setTimeout(r, answer.delayMs));
    if (answer.throws) throw answer.throws;
    if (answer.never) return new Promise<Response>((_, reject) => (init.signal as AbortSignal | undefined)?.addEventListener("abort", () => reject(new Error("aborted"))));
    const status = answer.status ?? 200;
    const text = answer.json === undefined ? "" : JSON.stringify(answer.json);
    return { ok: status >= 200 && status < 300, status, text: async () => text, headers: { get: (k: string) => answer.headers?.[k.toLowerCase()] ?? null } } as unknown as Response;
  });
  return {
    fetch: impl as unknown as typeof fetch,
    calls,
    to: (method: string, p: string | RegExp) => calls.filter((c) => c.method === method && (typeof p === "string" ? c.path === p : p.test(c.path))),
    /** change what a route answers from now on */
    set: (key: string, handler: Handler) => { routes[key] = handler; },
  };
}
export type FakeServer = ReturnType<typeof fakeServer>;

export function memoryStorage(initial: { token: string | null } = { token: null }) {
  let state = { ...initial };
  const storage: TokenStorage & { state: () => typeof state } = {
    load: jest.fn(async () => state),
    save: jest.fn(async (token: string) => { state = { token }; }),
    clear: jest.fn(async () => { state = { token: null }; }),
    state: () => state,
  };
  return storage;
}

// remembered answers carry timers (they are kept for minutes): clear them after each test so nothing outlives it
const liveRuntimes: Runtime[] = [];
afterEach(() => { liveRuntimes.splice(0).forEach((r) => r.queryClient.clear()); });

/** Preferences kept in memory; `initial` = what was saved on the phone before the app was opened. */
export function memoryPrefs(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const prefs: PrefsStorage & { data: Map<string, string> } = {
    data,
    get: jest.fn(async (key: string) => data.get(key) ?? null),
    set: jest.fn(async (key: string, value: string) => { data.set(key, value); }),
  };
  return prefs;
}

export interface AppOptions { server?: FakeServer; storage?: ReturnType<typeof memoryStorage>; prefs?: ReturnType<typeof memoryPrefs>; signedIn?: boolean; /** which build number this app says it is (default: the test config's, 0) */ build?: number }

/** A screen, inside the app's own providers, talking to a fake server — signed in as the sandbox rider unless said otherwise. */
export async function renderApp(ui: ReactElement, options: AppOptions = {}): Promise<RenderResult & { runtime: Runtime; server: FakeServer; storage: ReturnType<typeof memoryStorage>; prefs: ReturnType<typeof memoryPrefs> }> {
  const server = options.server ?? fakeServer();
  const storage = options.storage ?? memoryStorage();
  const prefs = options.prefs ?? memoryPrefs();
  const runtime = createRuntime({ baseUrl: "https://api.test", fetchImpl: server.fetch, storage, prefs, retry: false, build: options.build });
  liveRuntimes.push(runtime);
  if (options.signedIn !== false) await runtime.session.getState().signIn("9876543210", "4821", false);
  const result = await render(<RuntimeProvider runtime={runtime}>{ui}</RuntimeProvider>);
  return Object.assign(result, { runtime, server, storage, prefs });
}
