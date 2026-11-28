import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { AccountScreen } from "@/screens/AccountScreen";
import { DoneScreen } from "@/screens/DoneScreen";
import { toasts } from "@/ui";
import { fakeServer, fx, renderApp } from "../../test/harness";

describe("Delivered today", () => {
  it("lists what this rider delivered today, with the address and what was in the bag", async () => {
    await renderApp(<DoneScreen />);
    const row = await screen.findByTestId("done-0006");
    expect(row).toBeOnTheScreen();
    expect(screen.getByText("1 done")).toBeOnTheScreen();
    expect(screen.getByText(/A-1, Sector 19, Noida/)).toBeOnTheScreen();
  });
  it("shows the day in numbers: how many, how far, the average trip, the fastest and the first and last times", async () => {
    const base = fx<{ deliveredToday: Record<string, unknown>[] }>("deliveries");
    const one = base.deliveredToday[0]!;
    const at = (h: number, m: number) => new Date(2026, 10, 28, h, m).toISOString();
    const mk = (n: string, pick: string, done: string, km: number) => ({ ...one, id: `d${n}`, orderNumber: n, pickedUpAt: pick, deliveredAt: done, address: { ...(one.address as object), distanceKm: km } });
    const deliveredToday = [mk("0101", at(13, 0), at(13, 20), 3), mk("0102", at(11, 0), at(11, 10), 1.5)];
    await renderApp(<DoneScreen />, { server: fakeServer({ "GET /api/rider/deliveries": { json: { ...base, deliveredToday } } }) });
    expect(await screen.findByTestId("sum-delivered")).toHaveTextContent(/^2Delivered$/);
    expect(screen.getByTestId("sum-km")).toHaveTextContent(/^4\.5 kmDistance$/);
    expect(screen.getByTestId("sum-avg")).toHaveTextContent(/^15 minAverage trip$/);
    expect(screen.getByTestId("sum-line")).toHaveTextContent("Fastest 10 min · first 11:10 am · last 1:20 pm");
  });
  it("a day with nothing done has no summary card", async () => {
    await renderApp(<DoneScreen />, { server: fakeServer({ "GET /api/rider/deliveries": { json: { ...fx<Record<string, unknown>>("deliveries"), deliveredToday: [] } } }) });
    await screen.findByText("Nothing delivered yet today");
    expect(screen.queryByTestId("day-summary")).toBeNull();
  });
  it("nothing delivered yet says so", async () => {
    await renderApp(<DoneScreen />, { server: fakeServer({ "GET /api/rider/deliveries": { json: { ...fx<Record<string, unknown>>("deliveries"), deliveredToday: [] } } }) });
    expect(await screen.findByText("Nothing delivered yet today")).toBeOnTheScreen();
  });
  it("can't load: says so", async () => {
    await renderApp(<DoneScreen />, { server: fakeServer({ "GET /api/rider/deliveries": { status: 500, json: { error: "The server had a problem." } } }) });
    expect(await screen.findByText("Can't load your deliveries")).toBeOnTheScreen();
  });
});

describe("Account", () => {
  beforeEach(() => toasts.clear());
  it("tells the rider who they are and where they work", async () => {
    await renderApp(<AccountScreen />);
    expect(await screen.findByTestId("account-name")).toHaveTextContent("Ramesh");
    expect(screen.getByText("98765 43210")).toBeOnTheScreen();
    expect(screen.getByText("Gazab Momos")).toBeOnTheScreen();
    expect(screen.getByText("Gazab Momos Noida")).toBeOnTheScreen();
  });
  it("shows the app's name, version, build and server", async () => {
    await renderApp(<AccountScreen />);
    await screen.findByTestId("account-name");
    expect(screen.getByText("Rasoi Pulse RDA")).toBeOnTheScreen();
    expect(screen.getByText("Rider Delivery App")).toBeOnTheScreen();
    expect(screen.getByText("api.example.test")).toBeOnTheScreen();
  });
  it("the alert switch is remembered for this rider", async () => {
    const { runtime, prefs } = await renderApp(<AccountScreen />);
    await act(async () => { await runtime.settings.load(runtime.session.getState().rider!.id); });
    await fireEvent(await screen.findByTestId("switch-alerts"), "valueChange", false);
    await waitFor(() => expect(runtime.settings.store.getState().alerts).toBe(false));
    const saved = [...prefs.data.entries()];
    expect(saved).toHaveLength(1);
    expect(saved[0]![0]).toMatch(/^rda\.settings\.v1:/);
    expect(JSON.parse(saved[0]![1])).toEqual({ alerts: false });
  });
  it("says the app is up to date, or can't check", async () => {
    await renderApp(<AccountScreen />);
    await fireEvent.press(await screen.findByTestId("check-updates"));
    await waitFor(() => expect(toasts.store.getState().toasts.map((t) => t.message)).toContain("You have the latest version."));
  });
  it("Sign out asks first, then signs out and tells the server", async () => {
    const { runtime, server } = await renderApp(<AccountScreen />);
    await fireEvent.press(await screen.findByTestId("sign-out"));
    expect(await screen.findByText("Sign out?")).toBeOnTheScreen();
    expect(runtime.session.getState().status).toBe("signed-in");
    await fireEvent.press(screen.getByRole("button", { name: "Yes, sign out" }));
    await waitFor(() => expect(runtime.session.getState().status).toBe("signed-out"));
    expect(server.to("POST", "/api/rider/logout")).toHaveLength(1);
  });
});
