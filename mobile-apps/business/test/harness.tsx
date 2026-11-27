import type { ReactElement } from "react";
import { render, type RenderResult } from "@testing-library/react-native";
import type { TokenStorage } from "@/auth/storage";
import type { Me } from "@/lib/access";
import { createRuntime, RuntimeProvider, type Runtime } from "@/runtime";
import { ToastHost } from "@/ui";

export interface Call { method: string; path: string; query: string; headers: Record<string, string>; body: any }
export interface Answer { status?: number; json?: unknown; throws?: Error; delayMs?: number }
export type Handler = Answer | ((call: Call, params: Record<string, string>) => Answer);


const ALL = ["analytics:read", "analytics:finance", "analytics:export", "user:read", "user:manage", "coupon:read", "coupon:manage", "reservation:read", "reservation:manage", "menu:read", "menu:update", "outlet:read", "order:read"];
/** The people the tests sign in as (what the server's sign-in answer says about them). */
export const OWNER: Me = { id: "u0", email: "owner@acme.test", name: "Olivia Owner", isSuperAdmin: false, role: "owner", brandId: "b1", permissions: ALL };
export const MANAGER: Me = { id: "u1", email: "boss@acme.test", name: "Manu Manager", isSuperAdmin: false, role: "manager", brandId: "b1", permissions: ["analytics:read", "menu:read", "menu:update", "outlet:read", "order:read", "coupon:read", "reservation:read", "reservation:manage"] };
export const ACCOUNTANT: Me = { id: "u2", email: "books@acme.test", name: "Anu Accountant", isSuperAdmin: false, role: "accountant", brandId: "b1", permissions: ["analytics:read", "analytics:finance", "analytics:export", "outlet:read", "menu:read", "order:read", "coupon:read"] };
const toRegex = (pattern: string) => new RegExp(`^${pattern.replace(/:[a-zA-Z]+/g, "([^/]+)")}$`);

/** A pretend server: answers from what a test says (an unknown route is a 404) and remembers every call. */
export function fakeServer(routes: Record<string, Handler> = {}) {
  const table: Record<string, Handler> = { "GET /api/auth/guard": { json: { blocked: false } }, "POST /api/auth/logout": { status: 204 }, ...routes };
  const calls: Call[] = [];
  const impl = jest.fn(async (url: string, init: RequestInit = {}) => {
    const u = new URL(url);
    const method = (init.method ?? "GET").toUpperCase();
    const call: Call = { method, path: u.pathname, query: u.search, headers: (init.headers ?? {}) as Record<string, string>, body: init.body ? JSON.parse(String(init.body)) : undefined };
    calls.push(call);
    let answer: Answer = { status: 404, json: { error: `No fake route for ${method} ${u.pathname}` } };
    for (const [key, handler] of Object.entries(table)) {
      const [m, p] = key.split(" ") as [string, string];
      const match = m === method ? toRegex(p!).exec(u.pathname) : null;
      if (!match) continue;
      const names = [...p!.matchAll(/:([a-zA-Z]+)/g)].map((x) => x[1]!);
      answer = typeof handler === "function" ? handler(call, Object.fromEntries(names.map((n, i) => [n, match[i + 1]!]))) : handler;
      break;
    }
    if (answer.delayMs) await new Promise((r) => setTimeout(r, answer.delayMs));
    if (answer.throws) throw answer.throws;
    const status = answer.status ?? 200;
    const text = answer.json === undefined ? "" : JSON.stringify(answer.json);
    return { ok: status >= 200 && status < 300, status, text: async () => text, headers: { get: () => null } } as unknown as Response;
  });
  return {
    fetch: impl as unknown as typeof fetch,
    calls,
    to: (method: string, p: string | RegExp) => calls.filter((c) => c.method === method && (typeof p === "string" ? c.path === p : p.test(c.path))),
    set: (key: string, handler: Handler) => { table[key] = handler; },
  };
}
export type FakeServer = ReturnType<typeof fakeServer>;

export function memoryStorage(initial: string | null = null) {
  let token = initial;
  const storage: TokenStorage & { value: () => string | null } = {
    load: jest.fn(async () => token),
    save: jest.fn(async (t: string) => { token = t; }),
    clear: jest.fn(async () => { token = null; }),
    value: () => token,
  };
  return storage;
}

const liveRuntimes: Runtime[] = [];
afterEach(() => { liveRuntimes.splice(0).forEach((r) => r.queryClient.clear()); });

export interface AppOptions { server?: FakeServer; storage?: ReturnType<typeof memoryStorage>; signedInAs?: Me | null }
/** A screen, inside the app's own providers, talking to a fake server — signed in as `signedInAs` (the owner unless said otherwise; null = nobody). */
export async function renderApp(ui: ReactElement, options: AppOptions = {}): Promise<RenderResult & { runtime: Runtime; server: FakeServer; storage: ReturnType<typeof memoryStorage> }> {
  const who = options.signedInAs === undefined ? OWNER : options.signedInAs;
  const server = options.server ?? fakeServer();
  if (who) server.set("POST /api/auth/app-login", { json: { token: "tok-1", expiresAt: "2099-01-01", user: who } });
  const storage = options.storage ?? memoryStorage();
  const runtime = createRuntime({ baseUrl: "https://api.test", fetchImpl: server.fetch, storage, retry: false });
  liveRuntimes.push(runtime);
  if (who) await runtime.session.getState().signIn(who.email, "Password12345", false);
  const result = await render(<RuntimeProvider runtime={runtime}>{ui}<ToastHost /></RuntimeProvider>);
  return Object.assign(result, { runtime, server, storage });
}
