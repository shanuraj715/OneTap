import { ApiError, createClient } from "@/api/client";
import { z } from "zod";
import { createApi } from "@/api/endpoints";
import * as S from "@/api/schemas";
import fs from "node:fs";
import path from "node:path";

const fixture = (name: string) => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "test", "fixtures", `${name}.json`), "utf8"));

/** a fake fetch that answers from a list and remembers what it was asked */
function fakeFetch(...answers: Array<{ status?: number; json?: unknown; text?: string; headers?: Record<string, string>; throws?: Error; never?: boolean }>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const impl = jest.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const a = answers[Math.min(calls.length - 1, answers.length - 1)]!;
    if (a.throws) throw a.throws;
    if (a.never) return new Promise<Response>((_, reject) => init.signal?.addEventListener("abort", () => reject(new Error("aborted"))));
    const status = a.status ?? 200;
    const text = a.text ?? (a.json === undefined ? "" : JSON.stringify(a.json));
    return { ok: status >= 200 && status < 300, status, text: async () => text, headers: { get: (k: string) => a.headers?.[k.toLowerCase()] ?? null } } as unknown as Response;
  });
  return { impl: impl as unknown as typeof fetch, calls };
}
const make = (f: ReturnType<typeof fakeFetch>, token: string | null = "TOKEN-123456789012345678901") => {
  const onUnauthorized = jest.fn();
  return { client: createClient({ baseUrl: "https://api.test", getToken: () => token, onUnauthorized, fetchImpl: f.impl, timeoutMs: 1000 }), onUnauthorized };
};
const headersOf = (c: { init: RequestInit }) => c.init.headers as Record<string, string>;

describe("what the client sends", () => {
  it("adds the Bearer token and the outlet, and sends JSON bodies", async () => {
    const f = fakeFetch({ json: { ok: true } });
    const { client } = make(f);
    await client.request("/api/x", { method: "POST", body: { a: 1 }, outletId: "OUT1" });
    const c = f.calls[0]!;
    expect(c.url).toBe("https://api.test/api/x");
    expect(headersOf(c)).toMatchObject({ authorization: "Bearer TOKEN-123456789012345678901", "x-rasoipulse-outlet": "OUT1", "content-type": "application/json" });
    expect(c.init.body).toBe('{"a":1}');
  });
  it("sends no token for the sign-in calls, and no outlet when none is given", async () => {
    const f = fakeFetch({ json: {} });
    const { client } = make(f);
    await client.request("/api/auth/guard", { auth: false });
    expect(headersOf(f.calls[0]!).authorization).toBeUndefined();
    expect(headersOf(f.calls[0]!)["x-rasoipulse-outlet"]).toBeUndefined();
  });
  it("handles an empty 204 answer", async () => {
    const f = fakeFetch({ status: 204 });
    expect(await make(f).client.request("/api/auth/logout", { method: "POST" })).toBeUndefined();
  });
});

describe("what goes wrong, and what the person is told", () => {
  it("a 401 on a signed-in request ends the session once, and says so", async () => {
    const f = fakeFetch({ status: 401, json: fixture("error-401") });
    const { client, onUnauthorized } = make(f);
    await expect(client.request("/api/tables")).rejects.toMatchObject({ status: 401, message: "Sign in to continue", isUnauthorized: true });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
  it("a 401 on the SIGN-IN call is a wrong password, not an ended session (and says how many tries are left)", async () => {
    const f = fakeFetch({ status: 401, json: fixture("error-wrong-password") });
    const { client, onUnauthorized } = make(f, null);
    await expect(client.request("/api/auth/app-login", { method: "POST", body: {}, auth: false })).rejects.toMatchObject({ status: 401, message: "Incorrect email or password", details: { attemptsLeft: 4 } });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
  it("sold out / table taken: the server's own sentence, plus its code and details", async () => {
    const f = fakeFetch({ status: 409, json: fixture("error-sold-out") }, { status: 409, json: fixture("error-table-conflict") });
    const { client } = make(f);
    await expect(client.request("/x")).rejects.toMatchObject({ status: 409, message: "Cold Coffee is sold out" });
    const e = (await client.request("/x").catch((x) => x)) as ApiError;
    expect(e.code).toBe("table_taken");
    expect(e.message).toMatch(/just taken/);
    expect(e.details).toMatchObject({ tableNumber: "T1" });
  });
  it("too many attempts: carries how long to wait (from the details, or the Retry-After header)", async () => {
    const a = fakeFetch({ status: 429, json: { error: "Too many sign-in requests. Try again in 1 min.", details: { code: "rate_limited", retryAfterSec: 60, policy: "login-flood" } } });
    expect(await make(a).client.request("/x").catch((e) => e)).toMatchObject({ status: 429, retryAfterSec: 60, code: "rate_limited", isTooManyRequests: true });
    const b = fakeFetch({ status: 429, json: { error: "slow down" }, headers: { "retry-after": "30" } });
    expect(await make(b).client.request("/x").catch((e) => e)).toMatchObject({ status: 429, retryAfterSec: 30 });
  });
  it("a proxy's error page (not JSON) still gives a sentence", async () => {
    const f = fakeFetch({ status: 502, text: "<html>Bad gateway</html>" }, { status: 418, text: "" });
    const { client } = make(f);
    await expect(client.request("/x")).rejects.toMatchObject({ status: 502, message: "The server had a problem. Try again in a moment." });
    await expect(client.request("/x")).rejects.toMatchObject({ status: 418, message: "The server answered 418." });
  });
  it("no network: status 0 with a plain sentence", async () => {
    const { client } = make(fakeFetch({ throws: new TypeError("Network request failed") }));
    const e = (await client.request("/x").catch((x) => x)) as ApiError;
    expect(e).toBeInstanceOf(ApiError);
    expect(e).toMatchObject({ status: 0, isNetwork: true });
    expect(e.message).toMatch(/Can't reach the server/);
  });
  it("a request that never answers is cut off after the timeout", async () => {
    jest.useFakeTimers();
    const { client } = make(fakeFetch({ never: true }));
    const p = client.request("/x").catch((x) => x);
    await jest.advanceTimersByTimeAsync(1100);
    expect(await p).toMatchObject({ status: 0, message: expect.stringMatching(/took too long/) });
    jest.useRealTimers();
  });
  it("an answer in a shape the app does not know is reported as a version mismatch (502), not a broken screen", async () => {
    const f = fakeFetch({ json: { tables: [{ id: 1 }] } });
    const e = (await make(f).client.request("/api/tables", { schema: S.tablesSchema }).catch((x) => x)) as ApiError;
    expect(e).toMatchObject({ status: 502 });
    expect(e.message).toMatch(/does not understand/);
    expect(JSON.stringify(e.details)).toMatch(/tables/);
  });
  it("a screen that is closed (aborted) is not reported as an error to show", async () => {
    const ctl = new AbortController();
    const { client } = make(fakeFetch({ never: true }));
    const p = client.request("/x", { signal: ctl.signal }).catch((x) => x);
    ctl.abort();
    const e = await p;
    expect(e).not.toBeInstanceOf(ApiError);
  });
});

describe("contract: the real server answers (recorded from the API) fit the app's schemas", () => {
  const cases: Array<[string, z.ZodType]> = [
    ["auth-app-login", S.appLoginSchema], ["auth-app-login-kitchen", S.appLoginSchema], ["auth-me", S.meSchema], ["auth-guard", S.guardSchema],
    ["outlets", S.outletsSchema], ["menu", S.menuSchema], ["tables-free", S.tablesSchema], ["tables-seated", S.tablesSchema],
    ["sessions-active", S.sessionsSchema], ["quote", S.quoteSchema], ["order-placed", S.placedOrderSchema], ["order-placed-second-round", S.placedOrderSchema],
    ["orders-list", S.ordersSchema], ["session-move", S.moveSchema], ["session-confirm-payment", S.paymentSchema], ["session-close", S.closedSchema],
  ];
  it.each(cases)("%s", (name, schema) => {
    const r = schema.safeParse(fixture(name));
    expect(r.success ? "ok" : JSON.stringify(r.error.issues.slice(0, 3))).toBe("ok");
  });
  it("the sign-in answer exposes what the app needs to decide who may use it", () => {
    const waiter = S.appLoginSchema.parse(fixture("auth-app-login"));
    expect(waiter.user.role).toBe("staff");
    expect(waiter.user.permissions).toEqual(expect.arrayContaining(["order:create", "table:read", "table:manage"]));
    const kitchen = S.appLoginSchema.parse(fixture("auth-app-login-kitchen"));
    expect(kitchen.user.role).toBe("kitchen");
    expect(kitchen.user.permissions).not.toContain("order:create");
  });
});

describe("the endpoint functions put the right call on the wire", () => {
  const run = async (answer: unknown, fn: (api: ReturnType<typeof createApi>) => Promise<unknown>) => {
    const f = fakeFetch({ json: answer });
    await fn(createApi(make(f).client));
    return f.calls[0]!;
  };
  it("sign in: POST app-login, no token", async () => {
    const c = await run(fixture("auth-app-login"), (a) => a.signIn("waiter@x.test", "pw"));
    expect(c.url).toBe("https://api.test/api/auth/app-login");
    expect(c.init.method).toBe("POST");
    expect(JSON.parse(String(c.init.body))).toEqual({ email: "waiter@x.test", password: "pw" });
    expect(headersOf(c).authorization).toBeUndefined();
  });
  it("tables, sessions and the menu name the outlet", async () => {
    expect(headersOf(await run(fixture("tables-free"), (a) => a.tables("O1")))["x-rasoipulse-outlet"]).toBe("O1");
    expect((await run(fixture("sessions-active"), (a) => a.sessions("O1"))).url).toMatch(/\/api\/tables\/sessions\/active$/);
    expect((await run(fixture("menu"), (a) => a.menu("O1"))).url).toMatch(/\/api\/menu\?outletId=O1$/);
  });
  it("place order sends the table, the cart, the customer and the party the screen saw", async () => {
    const c = await run(fixture("order-placed"), (a) => a.placeOrder("O1", { tableId: "T1", cart: { lines: [{ itemId: "I1", modifierOptionIds: [], quantity: 2 }] }, phone: "9876543210", name: "Mehta", expectedSessionId: null }));
    expect(c.url).toBe("https://api.test/api/orders/staff");
    expect(JSON.parse(String(c.init.body))).toEqual({ tableId: "T1", cart: { lines: [{ itemId: "I1", modifierOptionIds: [], quantity: 2 }] }, phone: "9876543210", name: "Mehta", expectedSessionId: null });
  });
  it("quote only sends the table and phone when it has them", async () => {
    const bare = await run(fixture("quote"), (a) => a.quote("O1", { lines: [{ itemId: "I1", modifierOptionIds: [], quantity: 1 }] }));
    expect(JSON.parse(String(bare.init.body))).toEqual({ cart: { lines: [{ itemId: "I1", modifierOptionIds: [], quantity: 1 }] } });
  });
  it("table actions: move, confirm payment, close, void", async () => {
    expect(JSON.parse(String((await run(fixture("session-move"), (a) => a.moveSession("O1", "S1", "T2"))).init.body))).toEqual({ toTableId: "T2" });
    expect((await run(fixture("session-confirm-payment"), (a) => a.confirmPayment("O1", "S1"))).url).toMatch(/sessions\/S1\/confirm-payment$/);
    expect((await run(fixture("session-close"), (a) => a.closeSession("O1", "S1"))).url).toMatch(/sessions\/S1\/close$/);
    expect(JSON.parse(String((await run(fixture("session-close"), (a) => a.voidSession("O1", "S1", "walked out"))).init.body))).toEqual({ reason: "walked out" });
  });
});

describe("the refresh interval the server announces", () => {
  const withCallback = (f: ReturnType<typeof fakeFetch>) => {
    const onRefreshSeconds = jest.fn();
    const client = createClient({ baseUrl: "https://api.test", getToken: () => null, onUnauthorized: () => undefined, fetchImpl: f.impl, onRefreshSeconds });
    return { client, onRefreshSeconds };
  };

  it("hands the x-refresh-seconds header of an answer to the app", async () => {
    const { client, onRefreshSeconds } = withCallback(fakeFetch({ json: { ok: true }, headers: { "x-refresh-seconds": "15" } }));
    await client.request("/api/anything");
    expect(onRefreshSeconds).toHaveBeenCalledWith("15");
  });

  it("does so for a refusal too (a wrong password still tells the app how often to ask)", async () => {
    const { client, onRefreshSeconds } = withCallback(fakeFetch({ status: 401, json: { error: "no" }, headers: { "x-refresh-seconds": "20" } }));
    await expect(client.request("/api/anything", { auth: false })).rejects.toBeInstanceOf(ApiError);
    expect(onRefreshSeconds).toHaveBeenCalledWith("20");
  });

  it("does nothing when the answer has no such header (an older server, a proxy's error page)", async () => {
    const { client, onRefreshSeconds } = withCallback(fakeFetch({ json: { ok: true } }));
    await client.request("/api/anything");
    expect(onRefreshSeconds).not.toHaveBeenCalled();
  });
});
