import { ApiError, createClient } from "@/api/client";
import { createRuntime } from "@/runtime";
import { fakeServer, memoryStorage, OWNER, SALES } from "../test/harness";

const noAccess = { ...SALES, platform: { access: false, features: [], role: null } };

describe("the API client", () => {
  const make = (server: ReturnType<typeof fakeServer>, token: string | null = "t1", onUnauthorized = jest.fn()) =>
    ({ onUnauthorized, client: createClient({ baseUrl: "https://api.test", getToken: () => token, onUnauthorized, fetchImpl: server.fetch, headers: { "x-app-id": "admin" } }) });
  it("sends the sign-in as a Bearer token and says which app it is", async () => {
    const s = fakeServer({ "GET /api/x": { json: { ok: 1 } } });
    await make(s).client.request("/api/x");
    expect(s.calls[0]!.headers.authorization).toBe("Bearer t1");
    expect(s.calls[0]!.headers["x-app-id"]).toBe("admin");
  });
  it("sends nothing secret when no sign-in is asked for", async () => {
    const s = fakeServer({ "POST /api/y": { json: {} } });
    await make(s).client.request("/api/y", { method: "POST", body: { a: 1 }, auth: false });
    expect(s.calls[0]!.headers.authorization).toBeUndefined();
    expect(s.calls[0]!.body).toEqual({ a: 1 });
  });
  it("a 403 is 'forbidden' (and does not sign anyone out); a 401 ends the sign-in", async () => {
    const s = fakeServer({ "GET /api/a": { status: 403, json: { error: "Your role can't do this." } }, "GET /api/b": { status: 401, json: { error: "Sign in to continue" } } });
    const { client, onUnauthorized } = make(s);
    await expect(client.request("/api/a")).rejects.toMatchObject({ status: 403, message: "Your role can't do this.", isForbidden: true });
    expect(onUnauthorized).not.toHaveBeenCalled();
    await expect(client.request("/api/b")).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
  it("no answer at all is a network error in plain words", async () => {
    const s = fakeServer({ "GET /api/z": { throws: new Error("offline") } });
    await expect(make(s).client.request("/api/z")).rejects.toMatchObject({ status: 0, isNetwork: true, message: expect.stringMatching(/Can't reach the server/) });
  });
  it("a proxy's error page (not JSON) still gives a sentence", async () => {
    const s = fakeServer({ "GET /api/p": { status: 502 } });
    await expect(make(s).client.request("/api/p")).rejects.toMatchObject({ status: 502, message: expect.stringMatching(/server had a problem/) });
  });
  it("an explicit token is used instead of the current one (signing out sends the one just let go of)", async () => {
    const s = fakeServer({ "POST /api/out": { status: 204 } });
    await make(s, null).client.request("/api/out", { method: "POST", token: "old" });
    expect(s.calls[0]!.headers.authorization).toBe("Bearer old");
  });
});

describe("the session", () => {
  const rt = (server: ReturnType<typeof fakeServer>, storage = memoryStorage()) => ({ runtime: createRuntime({ baseUrl: "https://api.test", fetchImpl: server.fetch, storage, retry: false }), storage });
  it("starts signed out when nothing was kept", async () => {
    const { runtime } = rt(fakeServer());
    await runtime.session.getState().start();
    expect(runtime.session.getState().status).toBe("signed-out");
  });
  it("a kept token is checked with the server and brings the person back", async () => {
    const s = fakeServer({ "GET /api/auth/me": { json: { user: OWNER } } });
    const { runtime } = rt(s, memoryStorage("kept"));
    await runtime.session.getState().start();
    expect(runtime.session.getState().status).toBe("signed-in");
    expect(s.calls[0]!.headers.authorization).toBe("Bearer kept");
  });
  it("a kept token the server refuses is forgotten", async () => {
    const s = fakeServer({ "GET /api/auth/me": { status: 401, json: { error: "Sign in to continue" } } });
    const { runtime, storage } = rt(s, memoryStorage("stale"));
    await runtime.session.getState().start();
    expect(runtime.session.getState().status).toBe("signed-out");
    expect(storage.value()).toBeNull();
  });
  it("no internet at start: signed out for now, but the token is kept for the next try", async () => {
    const s = fakeServer({ "GET /api/auth/me": { throws: new Error("offline") } });
    const { runtime, storage } = rt(s, memoryStorage("kept"));
    await runtime.session.getState().start();
    expect(runtime.session.getState().status).toBe("signed-out");
    expect(runtime.session.getState().notice).toMatch(/Can't reach the server/);
    expect(storage.value()).toBe("kept");
  });
  it("a kept token of someone with no platform role is refused (a restaurant's owner can't use this app)", async () => {
    const s = fakeServer({ "GET /api/auth/me": { json: { user: noAccess } } });
    const { runtime, storage } = rt(s, memoryStorage("kept"));
    await runtime.session.getState().start();
    expect(runtime.session.getState().status).toBe("signed-out");
    expect(storage.value()).toBeNull();
  });
  it("signing in keeps the token on the phone ONLY when asked", async () => {
    const s = fakeServer({ "POST /api/auth/app-login": { json: { token: "tok", expiresAt: "x", user: OWNER } } });
    const a = rt(s);
    await a.runtime.session.getState().signIn(" owner@rasoipulse.test ", "pw", false);
    expect(a.storage.save).not.toHaveBeenCalled();
    expect(s.calls[0]!.body).toEqual({ email: "owner@rasoipulse.test", password: "pw" });
    const b = rt(s);
    await b.runtime.session.getState().signIn("owner@rasoipulse.test", "pw", true);
    expect(b.storage.value()).toBe("tok");
    expect(b.runtime.session.getState().user?.name).toBe("Platform Owner");
  });
  it("a wrong password is an error and nobody is signed in", async () => {
    const s = fakeServer({ "POST /api/auth/app-login": { status: 401, json: { error: "Incorrect email or password" } } });
    const { runtime } = rt(s);
    await expect(runtime.session.getState().signIn("a@b.test", "nope", false)).rejects.toMatchObject({ status: 401 });
    expect(runtime.session.getState().status).toBe("starting");
  });
  it("signing out forgets everything and tells the server which sign-in to end", async () => {
    const s = fakeServer({ "POST /api/auth/app-login": { json: { token: "tok", expiresAt: "x", user: OWNER } } });
    const { runtime, storage } = rt(s);
    await runtime.session.getState().signIn("o@x.test", "pw", true);
    await runtime.session.getState().signOut();
    expect(runtime.session.getState().status).toBe("signed-out");
    expect(runtime.session.getState().token).toBeNull();
    expect(storage.value()).toBeNull();
    expect(s.to("POST", "/api/auth/logout")[0]!.headers.authorization).toBe("Bearer tok");
  });
  it("when the server ends the sign-in the person lands on the sign-in with a note, and what was remembered is cleared", async () => {
    const s = fakeServer({ "POST /api/auth/app-login": { json: { token: "tok", expiresAt: "x", user: OWNER } }, "GET /api/platform/stores": { status: 401, json: { error: "Sign in to continue" } } });
    const { runtime } = rt(s);
    await runtime.session.getState().signIn("o@x.test", "pw", false);
    runtime.queryClient.setQueryData(["secret"], 1);
    await runtime.api.stores().catch(() => undefined);
    expect(runtime.session.getState().status).toBe("signed-out");
    expect(runtime.session.getState().notice).toMatch(/signed out/i);
    expect(runtime.queryClient.getQueryData(["secret"])).toBeUndefined();
  });
});
