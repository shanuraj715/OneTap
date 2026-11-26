import fs from "node:fs";
import path from "node:path";
import type { Api } from "@/api/endpoints";
import * as S from "@/api/schemas";
import { createSessionStore } from "@/auth/session";
import type { TokenStorage } from "@/auth/storage";
import { groupByStore, outletCount } from "@/lib/stores";
import { createRuntime } from "@/runtime";
import { fakeServer, fx, memoryStorage } from "../test/harness";

const raw = (n: string) => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "test", "fixtures", `${n}.json`), "utf8"));
const admin = S.appLoginSchema.parse(raw("auth-app-login-super"));
const cook = S.appLoginSchema.parse(raw("auth-app-login"));
const all = S.outletsSchema.parse(raw("outlets-super"));
const mine = S.outletsSchema.parse(raw("outlets"));

function setup(who: S.AppLogin, outlets: typeof all, kept: { token: string | null; outletId: string | null } = { token: null, outletId: null }) {
  const api = {
    signIn: jest.fn(async () => who),
    signOut: jest.fn(async () => undefined),
    me: jest.fn(async () => ({ user: who.user })),
    outlets: jest.fn(async () => outlets),
  } as unknown as Api;
  const storage: TokenStorage = { load: jest.fn(async () => kept), save: jest.fn(async () => undefined), saveOutlet: jest.fn(async () => undefined), clear: jest.fn(async () => undefined) };
  return { store: createSessionStore({ api: () => api, storage }), api, storage };
}

describe("the recorded platform-admin answers", () => {
  it("are what the real server sent: a platform admin who may use the app, and outlets of two stores with their names", () => {
    expect(admin.user.isSuperAdmin).toBe(true);
    expect(all.outlets.map((o) => `${o.brandName}/${o.name}`)).toEqual(["Gazab Momos/Noida", "Gazab Momos/Ludhiana", "Spice Route/Delhi"]);
  });
});

describe("a platform admin signing in", () => {
  it("is signed in but has NO outlet yet: the app must ask which store and outlet", async () => {
    const { store } = setup(admin, all);
    await store.getState().signIn("super@sandbox.test", "Super123!", false);
    expect(store.getState()).toMatchObject({ status: "signed-in", outletId: null });
    expect(store.getState().outlets).toHaveLength(3);
  });

  it("is asked even when there is exactly one store with one outlet", async () => {
    const one = { outlets: [all.outlets[0]!] };
    const { store } = setup(admin, one);
    await store.getState().signIn("super@sandbox.test", "Super123!", false);
    expect(store.getState()).toMatchObject({ status: "signed-in", outletId: null });
    expect(store.getState().outlets).toHaveLength(1);
  });

  it("a kept sign-in opens on the question too, whatever outlet was used last", async () => {
    const { store } = setup(admin, all, { token: "kept-token-0123456789", outletId: all.outlets[2]!.id });
    await store.getState().start();
    expect(store.getState()).toMatchObject({ status: "signed-in", outletId: null });
  });

  it("choosing an outlet starts the work there; nothing is remembered (the question is asked again next time)", async () => {
    const { store, storage } = setup(admin, all, { token: "kept-token-0123456789", outletId: null });
    await store.getState().start();
    await store.getState().selectOutlet(all.outlets[2]!.id);
    expect(store.getState().outletId).toBe(all.outlets[2]!.id);
    expect(storage.saveOutlet).not.toHaveBeenCalled();
  });

  it("an outlet that isn't in the list can't be chosen", async () => {
    const { store } = setup(admin, all);
    await store.getState().signIn("super@sandbox.test", "Super123!", false);
    await store.getState().selectOutlet("not-an-outlet");
    expect(store.getState().outletId).toBeNull();
  });

  it("'keep me signed in' keeps the token but no outlet", async () => {
    const { store, storage } = setup(admin, all);
    await store.getState().signIn("super@sandbox.test", "Super123!", true);
    expect(storage.save).toHaveBeenCalledWith(admin.token, null);
  });

  it("can go back to the question; a waiter can't (their outlet is fixed by their account)", async () => {
    const a = setup(admin, all);
    await a.store.getState().signIn("super@sandbox.test", "Super123!", false);
    await a.store.getState().selectOutlet(all.outlets[0]!.id);
    a.store.getState().changeOutlet();
    expect(a.store.getState().outletId).toBeNull();
    expect(a.store.getState().status).toBe("signed-in");

    const w = setup(cook, mine);
    await w.store.getState().signIn("chef@sandbox.test", "Staff123!", false);
    const before = w.store.getState().outletId;
    expect(before).toBeTruthy();
    w.store.getState().changeOutlet();
    expect(w.store.getState().outletId).toBe(before);
  });

  it("a waiter is NOT asked: they go straight to their outlet, as before", async () => {
    const { store } = setup(cook, mine);
    await store.getState().signIn("chef@sandbox.test", "Staff123!", false);
    expect(store.getState().outletId).toBe(mine.outlets[0]!.id);
  });
});

describe("going back to 'which store?' clears what belongs to the outlet being left", () => {
  const adminServer = () => fakeServer({ "POST /api/auth/app-login": { json: raw("auth-app-login-super") }, "GET /api/auth/me": { json: { user: admin.user } }, "GET /api/outlets": { json: raw("outlets-super") } });

  it("remembered answers (the board, the dishes) are dropped, so the next outlet never shows the last one's", async () => {
    const runtime = createRuntime({ baseUrl: "https://api.test", fetchImpl: adminServer().fetch, storage: memoryStorage(), retry: false });
    await runtime.session.getState().signIn("super@sandbox.test", "Super123!", false);
    await runtime.session.getState().selectOutlet(all.outlets[0]!.id);
    runtime.queryClient.setQueryData(["board", all.outlets[0]!.id, "all"], { orders: ["an order of the outlet being left"] });
    runtime.session.getState().changeOutlet();
    expect(runtime.queryClient.getQueryData(["board", all.outlets[0]!.id, "all"])).toBeUndefined();
    runtime.queryClient.clear();
  });

  it("nothing of the kitchen is loaded before an outlet is chosen", async () => {
    const server = adminServer();
    const runtime = createRuntime({ baseUrl: "https://api.test", fetchImpl: server.fetch, storage: memoryStorage(), retry: false });
    await runtime.session.getState().signIn("super@sandbox.test", "Super123!", false);
    expect(server.to("GET", "/api/kitchen/orders")).toHaveLength(0);
    expect(server.to("GET", "/api/kitchen/items")).toHaveLength(0);
    runtime.queryClient.clear();
    void fx;
  });
});

describe("grouping outlets by store", () => {
  const o = (id: string, name: string, brandId: string, brandName: string) => ({ id, name, slug: name.toLowerCase(), brandId, brandName, blocked: false });
  it("stores A→Z, each store's outlets A→Z", () => {
    const groups = groupByStore([o("1", "Zirakpur", "B", "Zeta Foods"), o("2", "Noida", "A", "alpha momos"), o("3", "Delhi", "A", "alpha momos")]);
    expect(groups.map((g) => g.name)).toEqual(["alpha momos", "Zeta Foods"]);
    expect(groups[0]!.outlets.map((x) => x.name)).toEqual(["Delhi", "Noida"]);
  });
  it("outlets of one store stay together even when the list is mixed up", () => {
    const groups = groupByStore([o("1", "A1", "X", "X Store"), o("2", "B1", "Y", "Y Store"), o("3", "A2", "X", "X Store")]);
    expect(groups.find((g) => g.id === "X")!.outlets).toHaveLength(2);
  });
  it("a store with no name on record can still be chosen", () => {
    expect(groupByStore([o("1", "Main", "Z", "")])[0]!.name).toBe("Unnamed store");
  });
  it("counts outlets in words", () => {
    expect(outletCount(1)).toBe("1 outlet");
    expect(outletCount(3)).toBe("3 outlets");
  });
});
