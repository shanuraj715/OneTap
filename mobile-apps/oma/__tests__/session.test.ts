import { ApiError } from "@/api/client";
import type { Api } from "@/api/endpoints";
import * as S from "@/api/schemas";
import { canUseApp, createSessionStore, notForThisApp } from "@/auth/session";
import type { TokenStorage } from "@/auth/storage";
import fs from "node:fs";
import path from "node:path";

const fx = (n: string) => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "test", "fixtures", `${n}.json`), "utf8"));
const waiter = S.appLoginSchema.parse(fx("auth-app-login"));
const kitchen = S.appLoginSchema.parse(fx("auth-app-login-kitchen"));
const outlets = S.outletsSchema.parse(fx("outlets"));
const second = { ...outlets.outlets[0]!, id: "OUT-2", name: "Delhi", slug: "delhi" };

function setup(over: Partial<Record<keyof Api, unknown>> = {}, kept: { token: string | null; outletId: string | null } = { token: null, outletId: null }) {
  const api = {
    signIn: jest.fn(async () => waiter),
    signOut: jest.fn(async () => undefined),
    me: jest.fn(async () => ({ user: waiter.user })),
    outlets: jest.fn(async () => outlets),
    ...over,
  } as unknown as Api;
  const saved: Array<[string, string | null]> = [];
  const storage: TokenStorage = {
    load: jest.fn(async () => kept),
    save: jest.fn(async (t: string, o: string | null) => void saved.push([t, o])),
    saveOutlet: jest.fn(async () => undefined),
    clear: jest.fn(async () => undefined),
  };
  const store = createSessionStore({ api: () => api, storage });
  return { store, api, storage, saved };
}

describe("who may use this app", () => {
  it("a person who takes orders and sees tables", () => expect(canUseApp(waiter.user)).toBe(true));
  it("not the kitchen (no order:create), and not nobody", () => { expect(canUseApp(kitchen.user)).toBe(false); expect(canUseApp(null)).toBe(false); });
  it("the refusal names the account and the role", () => expect(notForThisApp(kitchen.user)).toMatch(/chef@sandbox.test.*Kitchen.*can't take orders/));
});

describe("starting the app", () => {
  it("asking to start AGAIN while someone is signed in changes nothing (Android rebuilds the screen on a display-size change)", async () => {
    const { store, storage } = setup();
    await store.getState().start();
    await store.getState().signIn("waiter@sandbox.test", "Staff123!", false);
    expect(store.getState().status).toBe("signed-in");
    const loads = (storage.load as jest.Mock).mock.calls.length;
    await store.getState().start();
    await store.getState().start();
    expect(store.getState().status).toBe("signed-in");
    expect(store.getState().user?.email).toBe("waiter@sandbox.test");
    expect((storage.load as jest.Mock).mock.calls.length).toBe(loads); // it did not even look at the phone's storage
  });

  it("with nothing kept it lands on the sign-in screen (the app asks for a sign-in on every start)", async () => {
    const { store, api } = setup();
    expect(store.getState().status).toBe("starting");
    await store.getState().start();
    expect(store.getState()).toMatchObject({ status: "signed-out", token: null, user: null });
    expect(api.me).not.toHaveBeenCalled();
  });
  it("a kept sign-in is confirmed with the server, and the last outlet comes back", async () => {
    const { store, api } = setup({ outlets: jest.fn(async () => ({ outlets: [outlets.outlets[0], second] })) }, { token: "KEPT-TOKEN", outletId: "OUT-2" });
    await store.getState().start();
    expect(api.me).toHaveBeenCalled();
    expect(store.getState()).toMatchObject({ status: "signed-in", token: "KEPT-TOKEN", outletId: "OUT-2" });
  });
  it("a kept token the server no longer accepts is dropped, and the person signs in again", async () => {
    const { store, storage } = setup({ me: jest.fn(async () => { throw new ApiError(401, "Sign in to continue"); }) }, { token: "OLD", outletId: null });
    await store.getState().start();
    expect(store.getState()).toMatchObject({ status: "signed-out", token: null });
    expect(storage.clear).toHaveBeenCalled();
  });
  it("a kept token of an account that may not use the app is dropped, with the reason", async () => {
    const { store, storage } = setup({ me: jest.fn(async () => ({ user: kitchen.user })) }, { token: "K", outletId: null });
    await store.getState().start();
    expect(store.getState().status).toBe("signed-out");
    expect(store.getState().notice).toMatch(/can't take orders/);
    expect(storage.clear).toHaveBeenCalled();
  });
  it("offline at start: signed out, with a plain sentence", async () => {
    const { store } = setup({ me: jest.fn(async () => { throw new ApiError(0, "Can't reach the server."); }) }, { token: "K", outletId: null });
    await store.getState().start();
    expect(store.getState()).toMatchObject({ status: "signed-out" });
    expect(store.getState().notice).toMatch(/Can't reach the server/);
  });
});

describe("signing in", () => {
  it("the right password signs in; the token stays in memory only (nothing is written to the phone)", async () => {
    const { store, storage, saved } = setup();
    await store.getState().signIn("  waiter@sandbox.test ", "pw", false);
    expect(store.getState()).toMatchObject({ status: "signed-in", token: waiter.token, outletId: outlets.outlets[0]!.id });
    expect(store.getState().user?.email).toBe("waiter@sandbox.test");
    expect(saved).toEqual([]);
    expect(storage.clear).toHaveBeenCalled(); // and anything left from an earlier "keep me signed in" is wiped
  });
  it("the email is trimmed before it is sent", async () => {
    const { store, api } = setup();
    await store.getState().signIn("  waiter@sandbox.test ", "pw", false);
    expect(api.signIn).toHaveBeenCalledWith("waiter@sandbox.test", "pw");
  });
  it("'Keep me signed in' stores the token and the outlet in the encrypted storage", async () => {
    const { store, saved } = setup();
    await store.getState().signIn("waiter@sandbox.test", "pw", true);
    expect(saved).toEqual([[waiter.token, outlets.outlets[0]!.id]]);
  });
  it("a wrong password: the error comes back, nothing is kept, and the app stays signed out", async () => {
    const { store, saved } = setup({ signIn: jest.fn(async () => { throw new ApiError(401, "Incorrect email or password", { details: { attemptsLeft: 4 } }); }) });
    await store.getState().start(); // the app always starts first, then shows the sign-in screen
    await expect(store.getState().signIn("w@x.test", "bad", true)).rejects.toMatchObject({ status: 401, details: { attemptsLeft: 4 } });
    expect(store.getState()).toMatchObject({ status: "signed-out", token: null, user: null });
    expect(saved).toEqual([]);
  });
  it("too many attempts: the 429 comes back untouched (the screen shows the countdown)", async () => {
    const { store } = setup({ signIn: jest.fn(async () => { throw new ApiError(429, "Too many sign-in requests.", { retryAfterSec: 60 }); }) });
    await expect(store.getState().signIn("w@x.test", "x", false)).rejects.toMatchObject({ status: 429, retryAfterSec: 60 });
  });
  it("a kitchen account is turned away, and the session the server just opened is closed again", async () => {
    const { store, api, saved } = setup({ signIn: jest.fn(async () => kitchen) });
    await expect(store.getState().signIn("chef@sandbox.test", "pw", true)).rejects.toMatchObject({ status: 403, message: expect.stringMatching(/can't take orders/) });
    expect(api.signOut).toHaveBeenCalled();
    expect(store.getState()).toMatchObject({ status: "signed-out", token: null });
    expect(saved).toEqual([]);
  });
  it("if the outlets cannot be loaded after the token was given, the half-open session is closed and signed out", async () => {
    const { store, api } = setup({ outlets: jest.fn(async () => { throw new ApiError(0, "Can't reach the server."); }) });
    await expect(store.getState().signIn("w@x.test", "pw", false)).rejects.toMatchObject({ status: 0 });
    expect(store.getState().status).toBe("signed-out");
    expect(api.signOut).toHaveBeenCalled();
  });
  it("an account with no outlet cannot use the app", async () => {
    const { store } = setup({ outlets: jest.fn(async () => ({ outlets: [] })) });
    await expect(store.getState().signIn("w@x.test", "pw", false)).rejects.toMatchObject({ status: 403, message: expect.stringMatching(/no restaurant outlet/) });
    expect(store.getState().status).toBe("signed-out");
  });
  it("a blocked outlet is not offered", async () => {
    const blocked = { ...second, blocked: true };
    const { store } = setup({ outlets: jest.fn(async () => ({ outlets: [blocked, outlets.outlets[0]] })) });
    await store.getState().signIn("w@x.test", "pw", false);
    expect(store.getState().outlets.map((o) => o.id)).toEqual([outlets.outlets[0]!.id]);
  });
});

describe("signing out and the server ending the session", () => {
  it("signing out clears the phone and tells the server to forget the token", async () => {
    const { store, api, storage } = setup();
    await store.getState().signIn("w@x.test", "pw", true);
    await store.getState().signOut();
    expect(store.getState()).toMatchObject({ status: "signed-out", token: null, user: null, outletId: null });
    expect(storage.clear).toHaveBeenCalled();
    expect(api.signOut).toHaveBeenCalledTimes(1);
  });
  it("signing out works with no internet (the phone forgets at once; the server forgets the token when it expires)", async () => {
    const { store } = setup({ signOut: jest.fn(async () => { throw new ApiError(0, "offline"); }) });
    await store.getState().signIn("w@x.test", "pw", false);
    await expect(store.getState().signOut()).resolves.toBeUndefined();
    expect(store.getState().status).toBe("signed-out");
  });
  it("when the server says the sign-in ended, the app goes back to sign-in with a sentence saying why", async () => {
    const { store, storage } = setup();
    await store.getState().signIn("w@x.test", "pw", true);
    store.getState().expire();
    expect(store.getState()).toMatchObject({ status: "signed-out", token: null, notice: "Your sign-in ended. Please sign in again." });
    expect(storage.clear).toHaveBeenCalled();
    store.getState().clearNotice();
    expect(store.getState().notice).toBeNull();
  });
  it("expire() while already signed out does nothing (no notice appears on the sign-in screen by itself)", async () => {
    const { store } = setup();
    await store.getState().start();
    store.getState().expire();
    expect(store.getState().notice).toBeNull();
  });
});

describe("outlets", () => {
  it("switches to an outlet the person has, and ignores one they don't", async () => {
    const { store, storage } = setup({ outlets: jest.fn(async () => ({ outlets: [outlets.outlets[0], second] })) }, { token: "K", outletId: null });
    await store.getState().start();
    await store.getState().selectOutlet("OUT-2");
    expect(store.getState().outletId).toBe("OUT-2");
    expect(storage.saveOutlet).toHaveBeenCalledWith("OUT-2"); // kept sign-in: remembered
    await store.getState().selectOutlet("someone-elses");
    expect(store.getState().outletId).toBe("OUT-2");
  });
});
