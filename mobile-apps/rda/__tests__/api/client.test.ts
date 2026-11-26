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
    await expect(client.request("/api/rider/deliveries")).rejects.toMatchObject({ status: 401, message: "Sign in to continue", isUnauthorized: true });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
  it("a 401 on the SIGN-IN call is a wrong password, not an ended session (and says how many tries are left)", async () => {
    const f = fakeFetch({ status: 401, json: fixture("error-wrong-pin") });
    const { client, onUnauthorized } = make(f, null);
    await expect(client.request("/api/rider/login", { method: "POST", body: {}, auth: false })).rejects.toMatchObject({ status: 401, message: "Incorrect phone number or PIN", details: { attemptsLeft: 4 } });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
  it("a switched-off rider: 403 with the server's sentence", async () => {
    const f = fakeFetch({ status: 403, json: fixture("error-switched-off") });
    await expect(make(f, null).client.request("/api/rider/login", { method: "POST", body: {}, auth: false })).rejects.toMatchObject({ status: 403, message: "Your login is switched off. Ask your manager." });
  });
  it("a wrong delivery code: 409, with how many tries are left (in the sentence and in the details)", async () => {
    const f = fakeFetch({ status: 409, json: fixture("error-code-wrong") });
    const e = (await make(f).client.request("/x").catch((x) => x)) as ApiError;
    expect(e).toMatchObject({ status: 409, code: "delivery_code_wrong" });
    expect(e.message).toMatch(/4 tries left/);
    expect(e.details).toMatchObject({ triesLeft: 4 });
  });
  it("too many wrong codes: 429 with its own code (the screen sends the rider to the store)", async () => {
    const f = fakeFetch({ status: 429, json: fixture("error-code-locked") });
    expect(await make(f).client.request("/x").catch((e) => e)).toMatchObject({ status: 429, code: "delivery_code_locked", message: expect.stringMatching(/Call the store/) });
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
    const f = fakeFetch({ json: { deliveries: [{ id: 1 }] } });
    const e = (await make(f).client.request("/api/rider/deliveries", { schema: S.deliveriesSchema }).catch((x) => x)) as ApiError;
    expect(e).toMatchObject({ status: 502 });
    expect(e.message).toMatch(/does not understand/);
    expect(JSON.stringify(e.details)).toMatch(/deliveries/);
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
    ["rider-login", S.riderLoginSchema], ["rider-me", S.meSchema], ["auth-guard", S.guardSchema], ["deliveries", S.deliveriesSchema],
    ["delivery-picked-up", S.deliveryResultSchema], ["delivery-delivered", S.deliveryResultSchema],
    ["update-check-none", S.updateCheckSchema], ["update-check-optional", S.updateCheckSchema], ["update-check-current", S.updateCheckSchema], ["update-check-required", S.updateCheckSchema],
  ];
  it.each(cases)("%s", (name, schema) => {
    const r = schema.safeParse(fixture(name));
    expect(r.success ? "ok" : JSON.stringify(r.error.issues.slice(0, 3))).toBe("ok");
  });
  it("the sign-in answer says who the rider is and where they work", () => {
    const { rider } = S.riderLoginSchema.parse(fixture("rider-login"));
    expect(rider).toMatchObject({ name: "Ramesh", phone: "98765 43210", storeName: "Gazab Momos", outletName: "Gazab Momos Noida" });
  });
  it("the list has what a rider needs on the road, and never the delivery code", () => {
    const raw = fixture("deliveries");
    expect(JSON.stringify(raw)).not.toMatch(/deliveryCode/);
    const { deliveries, deliveredToday } = S.deliveriesSchema.parse(raw);
    expect(deliveries.map((d) => d.status).sort()).toEqual(["out_for_delivery", "out_for_delivery", "preparing", "ready"]);
    const d = deliveries.find((x) => x.status === "ready")!;
    expect(d.address.lat).toBeGreaterThan(20);
    expect(d.address.lng).toBeGreaterThan(70);
    expect(d.address.distanceKm).toBeGreaterThan(0);
    expect(d.customer.phone).toMatch(/^\d{10}$/);
    expect(d.items.length).toBeGreaterThan(0);
    expect(d.needsCode).toBe(true);
    expect(deliveredToday.map((x) => x.status)).toEqual(["completed"]);
  });
  it("the recorded delivery has no other rider's orders and nothing of the store's money", () => {
    expect(JSON.stringify(fixture("deliveries"))).not.toMatch(/totals|brandId|grandTotal/);
  });
});

describe("the endpoint functions put the right call on the wire", () => {
  const run = async (answer: unknown, fn: (api: ReturnType<typeof createApi>) => Promise<unknown>) => {
    const f = fakeFetch({ json: answer });
    await fn(createApi(make(f).client));
    return f.calls[0]!;
  };
  it("sign in: POST /api/rider/login with the number and PIN, no token", async () => {
    const c = await run(fixture("rider-login"), (a) => a.signIn("98765 43210", "4821"));
    expect(c.url).toBe("https://api.test/api/rider/login");
    expect(c.init.method).toBe("POST");
    expect(JSON.parse(String(c.init.body))).toEqual({ phone: "98765 43210", pin: "4821" });
    expect(headersOf(c).authorization).toBeUndefined();
  });
  it("the list, who am I, sign out", async () => {
    expect((await run(fixture("deliveries"), (a) => a.deliveries())).url).toBe("https://api.test/api/rider/deliveries");
    expect((await run(fixture("rider-me"), (a) => a.me())).url).toBe("https://api.test/api/rider/me");
    const out = await run({}, (a) => a.signOut());
    expect(out.url).toBe("https://api.test/api/rider/logout");
    expect(headersOf(out).authorization).toMatch(/^Bearer /);
  });
  it("picked up: POST the delivery's pickup route", async () => {
    const c = await run(fixture("delivery-picked-up"), (a) => a.pickUp("D1"));
    expect(c.url).toBe("https://api.test/api/rider/deliveries/D1/pickup");
    expect(c.init.method).toBe("POST");
  });
  it("delivered: the code is sent only when there is one", async () => {
    const withCode = await run(fixture("delivery-delivered"), (a) => a.deliver("D1", "4821"));
    expect(withCode.url).toBe("https://api.test/api/rider/deliveries/D1/delivered");
    expect(JSON.parse(String(withCode.init.body))).toEqual({ code: "4821" });
    const without = await run(fixture("delivery-delivered"), (a) => a.deliver("D1"));
    expect(JSON.parse(String(without.init.body))).toEqual({});
  });
  it("the update check says which app and which build, and needs no sign-in", async () => {
    const c = await run(fixture("update-check-none"), (a) => a.checkForUpdate(7));
    expect(c.url).toBe("https://api.test/api/app-updates/check?app=rda&platform=android&versionCode=7");
    expect(headersOf(c).authorization).toBeUndefined();
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
