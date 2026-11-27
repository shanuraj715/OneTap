import { act, fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { router } from "expo-router";
import { StoreDetail } from "@/screens/StoreDetail";
import { Stores } from "@/screens/Stores";
import { fakeServer, SALES, SUPPORT, renderApp } from "../../test/harness";

const row = (o: Record<string, unknown>) => ({ id: "s1", name: "Acme Momos", slug: "acme", ownerEmail: "o@acme.test", createdAt: "2026-01-05T00:00:00Z", plan: { id: "p1", name: "Pro" }, usage: { users: 4, outlets: 2, tables: 11 }, max: { users: 5, outlets: null, tables: 10 }, status: "ok", disabled: null, blocked: { outlets: 0, people: 0 }, ...o });
const LIST = { stores: [row({}), row({ id: "s2", name: "Beta Bites", slug: "beta", ownerEmail: "o@beta.test", plan: { id: "p2", name: "Starter" }, status: "grace" }), row({ id: "s3", name: "Gamma Grill", slug: "gamma", ownerEmail: "o@gamma.test", disabled: { at: "2026-11-01T00:00:00Z", message: "late payment" } })] };
const DETAIL = { store: { ...row({}), outlets: [{ id: "o1", name: "Acme Main", slug: "main", blocked: null }, { id: "o2", name: "Acme Second", slug: "second", blocked: "2026-11-20T00:00:00Z" }], people: [{ id: "u1", name: "Owner", email: "o@acme.test", role: "owner", isActive: true, blockedAt: null, lastLoginAt: "2026-11-26T10:00:00Z" }, { id: "u2", name: "Waiter", email: "w@acme.test", role: "staff", isActive: true, blockedAt: "2026-11-20T00:00:00Z", lastLoginAt: null }], domains: { hostnames: ["acme.rasoipulse.in"], primary: "acme.rasoipulse.in" }, subdomain: { host: "acme.rasoipulse.in", label: "acme" }, limits: { maxUsers: 5, maxOutlets: null, maxTables: 10 }, entitlements: { features: ["takeaway", "dineInQr"] } } };
const PLANS = { plans: [{ id: "p1", name: "Pro", description: "", custom: false, limits: { maxUsers: 5, maxOutlets: null, maxTables: 10 }, entitlements: { allFeatures: false, features: [] }, archived: false, storeCount: 2 }, { id: "p2", name: "Starter", description: "", custom: false, limits: { maxUsers: 3, maxOutlets: 1, maxTables: 5 }, entitlements: { allFeatures: false, features: [] }, archived: false, storeCount: 1 }] };

describe("the stores list", () => {
  const open = () => renderApp(<Stores />, { server: fakeServer({ "GET /api/platform/stores": { json: LIST } }) });
  it("lists every store with its plan, its standing and how much of each limit it uses", async () => {
    await open();
    expect(await screen.findByTestId("store-acme")).toBeOnTheScreen();
    const acme = within(screen.getByTestId("store-acme"));
    expect(acme.getByText("Active")).toBeOnTheScreen();
    expect(acme.getByText("Pro")).toBeOnTheScreen();
    expect(acme.getByText("2 · no limit")).toBeOnTheScreen();
    expect(acme.getByText("11 of 10")).toBeOnTheScreen(); // over its table limit shows as a full (red) bar
    expect(within(screen.getByTestId("store-beta")).getByText("Grace period")).toBeOnTheScreen();
    expect(within(screen.getByTestId("store-gamma")).getByText("Switched off")).toBeOnTheScreen();
  });
  it("search narrows by name, address or owner", async () => {
    await open();
    await screen.findByTestId("store-acme");
    await fireEvent.changeText(screen.getByTestId("stores-search"), "beta");
    expect(screen.queryByTestId("store-acme")).toBeNull();
    expect(screen.getByTestId("store-beta")).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId("stores-search"), "o@gamma");
    expect(screen.getByTestId("store-gamma")).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId("stores-search"), "zzz");
    expect(screen.getByText("No store matches")).toBeOnTheScreen();
  });
  it("'Needs a look' shows the ones in grace or over a limit; 'Switched off' the ones off", async () => {
    await open();
    await screen.findByTestId("store-acme");
    await fireEvent.press(screen.getByTestId("stores-filter-attention"));
    expect(screen.getByTestId("store-beta")).toBeOnTheScreen();
    expect(screen.queryByTestId("store-acme")).toBeNull();
    await fireEvent.press(screen.getByTestId("stores-filter-off"));
    expect(screen.getByTestId("store-gamma")).toBeOnTheScreen();
    expect(screen.queryByTestId("store-beta")).toBeNull();
  });
  it("the plan dropdown filters by plan", async () => {
    await open();
    await screen.findByTestId("store-acme");
    await fireEvent.press(screen.getByTestId("stores-plan"));
    await fireEvent.press(await screen.findByTestId("stores-plan-option-Starter"));
    expect(screen.getByTestId("store-beta")).toBeOnTheScreen();
    expect(screen.queryByTestId("store-acme")).toBeNull();
  });
  it("touching a store opens its page", async () => {
    await open();
    await fireEvent.press(await screen.findByTestId("store-acme"));
    expect(router.push).toHaveBeenCalledWith("/stores/s1");
  });
});

describe("a store's page", () => {
  const server = () => fakeServer({ "GET /api/platform/stores/s1": { json: DETAIL }, "GET /api/platform/plans": { json: PLANS } });
  it("shows its standing, limits, outlets (one blocked) and people (one blocked)", async () => {
    await renderApp(<StoreDetail id="s1" />, { server: server() });
    expect(await screen.findByText("Acme Momos")).toBeOnTheScreen();
    expect(screen.getByText("Acme Second")).toBeOnTheScreen();
    expect(within(screen.getByTestId("outlet-second")).getByText("Blocked")).toBeOnTheScreen();
    expect(within(screen.getByTestId("person-w@acme.test")).getByText("Blocked")).toBeOnTheScreen();
    expect(screen.getByText("acme.rasoipulse.in")).toBeOnTheScreen();
    expect(screen.getByText("dineInQr")).toBeOnTheScreen();
  });
  it("renames the store", async () => {
    const s = server();
    s.set("PATCH /api/platform/stores/s1", { json: { store: {} } });
    await renderApp(<StoreDetail id="s1" />, { server: s });
    await fireEvent.press(await screen.findByTestId("act-rename"));
    await fireEvent.changeText(await screen.findByTestId("rename-input"), "Acme Momos Delhi");
    await fireEvent.press(screen.getByTestId("rename-save"));
    await waitFor(() => expect(s.to("PATCH", "/api/platform/stores/s1")).toHaveLength(1));
    expect(s.to("PATCH", "/api/platform/stores/s1")[0]!.body).toEqual({ name: "Acme Momos Delhi" });
    expect(await screen.findByText("Renamed.")).toBeOnTheScreen();
  });
  it("changes the plan from a dropdown", async () => {
    const s = server();
    s.set("PATCH /api/platform/stores/s1/plan", { json: {} });
    await renderApp(<StoreDetail id="s1" />, { server: s });
    await fireEvent.press(await screen.findByTestId("act-plan"));
    await fireEvent.press(await screen.findByTestId("plan-select"));
    await fireEvent.press(await screen.findByTestId("plan-select-option-p2"));
    await fireEvent.press(screen.getByTestId("plan-save"));
    await waitFor(() => expect(s.to("PATCH", "/api/platform/stores/s1/plan")[0]?.body).toEqual({ planId: "p2" }));
  });
  it("switches the store off with a message the team will see", async () => {
    const s = server();
    s.set("POST /api/platform/stores/s1/disable", { json: {} });
    await renderApp(<StoreDetail id="s1" />, { server: s });
    await fireEvent.press(await screen.findByTestId("act-off"));
    await fireEvent.changeText(await screen.findByTestId("off-message"), "Payment due");
    await fireEvent.press(screen.getByTestId("off-confirm"));
    await waitFor(() => expect(s.to("POST", "/api/platform/stores/s1/disable")[0]?.body).toEqual({ message: "Payment due" }));
  });
  it("blocks an outlet and unblocks a person", async () => {
    const s = server();
    s.set("POST /api/platform/stores/s1/outlets/o1/block", { json: {} });
    s.set("POST /api/platform/stores/s1/people/u2/unblock", { json: {} });
    await renderApp(<StoreDetail id="s1" />, { server: s });
    await fireEvent.press(await screen.findByTestId("block-outlet-main"));
    await waitFor(() => expect(s.to("POST", "/api/platform/stores/s1/outlets/o1/block")).toHaveLength(1));
    await fireEvent.press(screen.getByTestId("block-person-w@acme.test"));
    await waitFor(() => expect(s.to("POST", "/api/platform/stores/s1/people/u2/unblock")).toHaveLength(1));
  });
  it("deleting asks for the store's exact name first, and only then sends it", async () => {
    const s = server();
    s.set("DELETE /api/platform/stores/s1", { status: 204 });
    await renderApp(<StoreDetail id="s1" />, { server: s });
    await fireEvent.press(await screen.findByTestId("act-delete"));
    await fireEvent.changeText(await screen.findByTestId("delete-name"), "acme");
    await fireEvent.press(screen.getByTestId("confirm-yes"));
    expect(s.to("DELETE", "/api/platform/stores/s1")).toHaveLength(0);
    await fireEvent.changeText(screen.getByTestId("delete-name"), "Acme Momos");
    await fireEvent.press(screen.getByTestId("confirm-yes"));
    await waitFor(() => expect(s.to("DELETE", "/api/platform/stores/s1")[0]?.body).toEqual({ confirmName: "Acme Momos" }));
  });
  it("a role that may only LOOK sees the store with no buttons to change it", async () => {
    await renderApp(<StoreDetail id="s1" />, { server: server(), signedInAs: SUPPORT });
    expect(await screen.findByTestId("store-readonly")).toBeOnTheScreen();
    for (const id of ["act-rename", "act-plan", "act-off", "act-delete", "block-outlet-main"]) expect(screen.queryByTestId(id)).toBeNull();
  });
  it("a role that may change stores but not delete them has no Delete button", async () => {
    await renderApp(<StoreDetail id="s1" />, { server: server(), signedInAs: { ...SALES, platform: { access: true, features: ["stores:read", "stores:manage"], role: null } } });
    expect(await screen.findByTestId("act-rename")).toBeOnTheScreen();
    expect(screen.queryByTestId("act-delete")).toBeNull();
  });
  it("when the server refuses a change, the person is told it's their role (not a fault)", async () => {
    const s = server();
    s.set("PATCH /api/platform/stores/s1", { status: 403, json: { error: "Your role can't do this." } });
    await renderApp(<StoreDetail id="s1" />, { server: s });
    await fireEvent.press(await screen.findByTestId("act-rename"));
    await fireEvent.changeText(await screen.findByTestId("rename-input"), "Other name");
    await act(async () => { await fireEvent.press(screen.getByTestId("rename-save")); });
    expect(await screen.findByText("Your role can't do this.")).toBeOnTheScreen();
  });
});
