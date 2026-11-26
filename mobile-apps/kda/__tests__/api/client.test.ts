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
    await expect(client.request("/api/kitchen/orders")).rejects.toMatchObject({ status: 401, message: "Sign in to continue", isUnauthorized: true });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
  it("a 401 on the SIGN-IN call is a wrong password, not an ended session (and says how many tries are left)", async () => {
    const f = fakeFetch({ status: 401, json: fixture("error-wrong-password") });
    const { client, onUnauthorized } = make(f, null);
    await expect(client.request("/api/auth/app-login", { method: "POST", body: {}, auth: false })).rejects.toMatchObject({ status: 401, message: "Incorrect email or password", details: { attemptsLeft: 4 } });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
  it("an account that may not use this app: the server's own sentence, with its code (so the sign-in screen can say who the app is for)", async () => {
    const f = fakeFetch({ status: 403, json: fixture("error-app-not-allowed") });
    const e = (await make(f, null).client.request("/api/auth/app-login", { method: "POST", body: {}, auth: false }).catch((x) => x)) as ApiError;
    expect(e).toMatchObject({ status: 403, code: "app_not_allowed" });
    expect(e.message).toMatch(/kitchen team/);
  });
  it("a cook trying to set a stock number: 403 with the server's sentence", async () => {
    const f = fakeFetch({ status: 403, json: fixture("error-no-right") });
    await expect(make(f).client.request("/api/kitchen/items/x/availability", { method: "POST", body: {} })).rejects.toMatchObject({ status: 403 });
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
    const f = fakeFetch({ json: { orders: [{ id: 1 }] } });
    const e = (await make(f).client.request("/api/kitchen/orders", { schema: S.kitchenBoardSchema }).catch((x) => x)) as ApiError;
    expect(e).toMatchObject({ status: 502 });
    expect(e.message).toMatch(/does not understand/);
    expect(JSON.stringify(e.details)).toMatch(/orders/);
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
    ["auth-app-login", S.appLoginSchema], ["auth-app-login-manager", S.appLoginSchema], ["auth-app-login-super", S.appLoginSchema], ["auth-me", S.meSchema], ["auth-guard", S.guardSchema],
    ["outlets", S.outletsSchema], ["outlets-super", S.outletsSchema],
    ["kitchen-board-all", S.kitchenBoardSchema], ["kitchen-board-bar", S.kitchenBoardSchema], ["kitchen-stage-set", S.stagedSchema],
    ["kitchen-items", S.kitchenItemsSchema], ["kitchen-item-set", S.itemSetSchema], ["kitchen-item-still-sold-out", S.itemSetSchema], ["kitchen-item-restocked", S.itemSetSchema],
    ["kitchen-summary", S.summarySchema],
    ["update-check-none", S.updateCheckSchema], ["update-check-optional", S.updateCheckSchema], ["update-check-current", S.updateCheckSchema], ["update-check-required", S.updateCheckSchema],
  ];
  it.each(cases)("%s", (name, schema) => {
    const r = schema.safeParse(fixture(name));
    expect(r.success ? "ok" : JSON.stringify(r.error.issues.slice(0, 3))).toBe("ok");
  });
  it("the sign-in answer exposes what the app needs to decide who may use it, and what each role may do", () => {
    const cook = S.appLoginSchema.parse(fixture("auth-app-login"));
    expect(cook.user.role).toBe("kitchen");
    expect(cook.user.permissions).toEqual(expect.arrayContaining(["kitchen:app", "order:read", "order:update", "menu:availability"]));
    expect(cook.user.permissions).not.toContain("menu:update"); // the stock numbers are the manager's
    const boss = S.appLoginSchema.parse(fixture("auth-app-login-manager"));
    expect(boss.user.role).toBe("manager");
    expect(boss.user.permissions).toEqual(expect.arrayContaining(["kitchen:app", "menu:availability", "menu:update"]));
  });
  it("the board holds what the screens need: all three stages, both stations, a table, add-ons and a note", () => {
    const board = S.kitchenBoardSchema.parse(fixture("kitchen-board-all"));
    expect(board.orders.map((o) => o.stage).sort()).toEqual(["new", "preparing", "ready"]);
    const mixed = board.orders.find((o) => o.stations.length === 2)!;
    expect(mixed.stations.map((s) => s.station).sort()).toEqual(["bar", "kitchen"]);
    expect(mixed.tableNumber).toBe("T1");
    expect(mixed.note).toMatch(/birthday/);
    expect(mixed.lines.some((l) => l.note === "less salt" && l.modifiers.length > 0)).toBe(true);
  });
  it("the dishes come in all three states, one of them counted and running low", () => {
    const { items } = S.kitchenItemsSchema.parse(fixture("kitchen-items"));
    expect(new Set(items.map((i) => i.state))).toEqual(new Set(["available", "sold-out", "unavailable"]));
    expect(items.find((i) => i.low)?.stock).toMatchObject({ left: 2, lowAt: 3 });
  });
});

describe("the endpoint functions put the right call on the wire", () => {
  const run = async (answer: unknown, fn: (api: ReturnType<typeof createApi>) => Promise<unknown>) => {
    const f = fakeFetch({ json: answer });
    await fn(createApi(make(f).client));
    return f.calls[0]!;
  };
  it("sign in: POST app-login, no token", async () => {
    const c = await run(fixture("auth-app-login"), (a) => a.signIn("chef@x.test", "pw"));
    expect(c.url).toBe("https://api.test/api/auth/app-login");
    expect(c.init.method).toBe("POST");
    expect(JSON.parse(String(c.init.body))).toEqual({ email: "chef@x.test", password: "pw" });
    expect(headersOf(c).authorization).toBeUndefined();
  });
  it("the board names the outlet and the station", async () => {
    const c = await run(fixture("kitchen-board-all"), (a) => a.board("O1", "bar"));
    expect(c.url).toBe("https://api.test/api/kitchen/orders?screen=bar");
    expect(headersOf(c)["x-rasoipulse-outlet"]).toBe("O1");
  });
  it("Start / Ready / Recall send the order, the station and the stage", async () => {
    const c = await run(fixture("kitchen-stage-set"), (a) => a.setStage("O1", "ORDER1", "all", "preparing"));
    expect(c.url).toBe("https://api.test/api/kitchen/orders/ORDER1/stage");
    expect(c.init.method).toBe("POST");
    expect(JSON.parse(String(c.init.body))).toEqual({ screen: "all", stage: "preparing" });
  });
  it("the dishes and the day's numbers name the outlet", async () => {
    expect(headersOf(await run(fixture("kitchen-items"), (a) => a.items("O1")))["x-rasoipulse-outlet"]).toBe("O1");
    const sum = await run(fixture("kitchen-summary"), (a) => a.summary("O1"));
    expect(sum.url).toBe("https://api.test/api/kitchen/summary");
  });
  it("switching a dish sends the state, and a number only when there is one", async () => {
    const plain = await run(fixture("kitchen-item-set"), (a) => a.setItemState("O1", "I1", "sold-out"));
    expect(plain.url).toBe("https://api.test/api/kitchen/items/I1/availability");
    expect(JSON.parse(String(plain.init.body))).toEqual({ state: "sold-out" });
    const counted = await run(fixture("kitchen-item-restocked"), (a) => a.setItemState("O1", "I1", "available", 9));
    expect(JSON.parse(String(counted.init.body))).toEqual({ state: "available", left: 9 });
    const zero = await run(fixture("kitchen-item-restocked"), (a) => a.setItemState("O1", "I1", "sold-out", 0));
    expect(JSON.parse(String(zero.init.body))).toEqual({ state: "sold-out", left: 0 }); // 0 is a number, not "no number"
  });
  it("a state the server doesn't know is never sent", async () => {
    const f = fakeFetch({ json: fixture("kitchen-item-set") });
    expect(() => createApi(make(f).client).setItemState("O1", "I1", "maybe" as never)).toThrow();
    expect(f.calls).toHaveLength(0);
  });
  it("the update check says which app and which build, and needs no sign-in", async () => {
    const c = await run(fixture("update-check-none"), (a) => a.checkForUpdate(7));
    expect(c.url).toBe("https://api.test/api/app-updates/check?app=kda&platform=android&versionCode=7");
  });
});
