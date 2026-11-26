import { ApiError } from "@/api/client";
import type { Api } from "@/api/endpoints";
import * as S from "@/api/schemas";
import { createSessionStore } from "@/auth/session";
import type { TokenStorage } from "@/auth/storage";
import fs from "node:fs";
import path from "node:path";

const fx = (n: string) => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "test", "fixtures", `${n}.json`), "utf8"));
const login = S.riderLoginSchema.parse(fx("rider-login"));

function setup(over: Partial<Record<keyof Api, unknown>> = {}, kept: { token: string | null } = { token: null }) {
  const api = {
    signIn: jest.fn(async () => login),
    signOut: jest.fn(async () => undefined),
    me: jest.fn(async () => ({ rider: login.rider })),
    ...over,
  } as unknown as Api;
  const saved: string[] = [];
  const storage: TokenStorage = {
    load: jest.fn(async () => kept),
    save: jest.fn(async (t: string) => void saved.push(t)),
    clear: jest.fn(async () => undefined),
  };
  return { store: createSessionStore({ api: () => api, storage }), api, storage, saved };
}

describe("starting the app", () => {
  it("with nothing kept it lands on the sign-in screen (the app asks for a sign-in on every start)", async () => {
    const { store, api } = setup();
    expect(store.getState().status).toBe("starting");
    await store.getState().start();
    expect(store.getState()).toMatchObject({ status: "signed-out", token: null, rider: null });
    expect(api.me).not.toHaveBeenCalled();
  });
  it("a kept sign-in is confirmed with the server, and the rider comes back", async () => {
    const { store, api } = setup({}, { token: "KEPT-TOKEN" });
    await store.getState().start();
    expect(api.me).toHaveBeenCalled();
    expect(store.getState()).toMatchObject({ status: "signed-in", token: "KEPT-TOKEN" });
    expect(store.getState().rider?.name).toBe("Ramesh");
  });
  it("a kept token the server no longer accepts (the PIN was reset) is dropped, and the rider signs in again", async () => {
    const { store, storage } = setup({ me: jest.fn(async () => { throw new ApiError(401, "Sign in to continue"); }) }, { token: "OLD" });
    await store.getState().start();
    expect(store.getState()).toMatchObject({ status: "signed-out", token: null });
    expect(storage.clear).toHaveBeenCalled();
  });
  it("a kept token of a rider who was switched off is dropped, with the reason", async () => {
    const { store } = setup({ me: jest.fn(async () => { throw new ApiError(403, "Your login is switched off. Ask your manager."); }) }, { token: "K" });
    await store.getState().start();
    expect(store.getState().status).toBe("signed-out");
    expect(store.getState().notice).toBe("Your login is switched off. Ask your manager.");
  });
  it("offline at start: signed out, with a plain sentence", async () => {
    const { store } = setup({ me: jest.fn(async () => { throw new ApiError(0, "Can't reach the server."); }) }, { token: "K" });
    await store.getState().start();
    expect(store.getState().status).toBe("signed-out");
    expect(store.getState().notice).toMatch(/Can't reach the server/);
  });
  it("asking to start AGAIN while a rider is signed in changes nothing (Android rebuilds the screen on a display-size change)", async () => {
    const { store, storage } = setup();
    await store.getState().start();
    await store.getState().signIn("9876543210", "4821", false);
    const loads = (storage.load as jest.Mock).mock.calls.length;
    await store.getState().start();
    await store.getState().start();
    expect(store.getState().status).toBe("signed-in");
    expect((storage.load as jest.Mock).mock.calls.length).toBe(loads);
  });
});

describe("signing in", () => {
  it("the right PIN signs in; the token stays in memory only (nothing is written to the phone)", async () => {
    const { store, storage, saved } = setup();
    await store.getState().signIn("  98765 43210 ", "4821", false);
    expect(store.getState()).toMatchObject({ status: "signed-in", token: login.token });
    expect(store.getState().rider?.storeName).toBe("Gazab Momos");
    expect(saved).toEqual([]);
    expect(storage.clear).toHaveBeenCalled(); // and anything left from an earlier "keep me signed in" is wiped
  });
  it("the number is trimmed before it is sent", async () => {
    const { store, api } = setup();
    await store.getState().signIn("  98765 43210 ", "4821", false);
    expect(api.signIn).toHaveBeenCalledWith("98765 43210", "4821");
  });
  it("'Keep me signed in' stores the token in the encrypted storage", async () => {
    const { store, saved } = setup();
    await store.getState().signIn("9876543210", "4821", true);
    expect(saved).toEqual([login.token]);
  });
  it("a wrong PIN: the error comes back untouched, nothing is kept, and the app stays signed out", async () => {
    const { store, saved } = setup({ signIn: jest.fn(async () => { throw new ApiError(401, "Incorrect phone number or PIN", { details: { attemptsLeft: 4 } }); }) });
    await store.getState().start();
    await expect(store.getState().signIn("9876543210", "0000", true)).rejects.toMatchObject({ status: 401, details: { attemptsLeft: 4 } });
    expect(store.getState()).toMatchObject({ status: "signed-out", token: null, rider: null });
    expect(saved).toEqual([]);
  });
  it("too many tries: the 429 comes back untouched (the screen shows the countdown)", async () => {
    const { store } = setup({ signIn: jest.fn(async () => { throw new ApiError(429, "Too many failed attempts.", { retryAfterSec: 60 }); }) });
    await expect(store.getState().signIn("9876543210", "0000", false)).rejects.toMatchObject({ status: 429, retryAfterSec: 60 });
  });
});

describe("signing out and the server ending the session", () => {
  it("signing out clears the phone and tells the server", async () => {
    const { store, api, storage } = setup();
    await store.getState().signIn("9876543210", "4821", true);
    await store.getState().signOut();
    expect(store.getState()).toMatchObject({ status: "signed-out", token: null, rider: null });
    expect(storage.clear).toHaveBeenCalled();
    expect(api.signOut).toHaveBeenCalledTimes(1);
  });
  it("signing out works with no internet (the phone forgets at once)", async () => {
    const { store } = setup({ signOut: jest.fn(async () => { throw new ApiError(0, "offline"); }) });
    await store.getState().signIn("9876543210", "4821", false);
    await expect(store.getState().signOut()).resolves.toBeUndefined();
    expect(store.getState().status).toBe("signed-out");
  });
  it("when the server says the sign-in ended, the app goes back to sign-in with a sentence saying why", async () => {
    const { store, storage } = setup();
    await store.getState().signIn("9876543210", "4821", true);
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
