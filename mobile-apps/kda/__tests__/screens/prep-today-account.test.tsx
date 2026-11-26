import { act, fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { AccountScreen } from "@/screens/AccountScreen";
import { PrepScreen } from "@/screens/PrepScreen";
import { TodayScreen } from "@/screens/TodayScreen";
import { asManager, fakeServer, fx, renderApp } from "../../test/harness";

describe("the prep list", () => {
  it("adds up what is still to be made over all the orders that are not ready", async () => {
    await renderApp(<PrepScreen />);
    // the recorded board: order 0003 (new) has 2 full veg momos, 1 kurkure, 2 chai; 0002 (preparing) has 2 paneer; 0001 is ready (not counted)
    expect(await screen.findByTestId("prep-Veg Steamed Momos")).toBeOnTheScreen();
    const veg = within(screen.getByTestId("prep-Veg Steamed Momos"));
    expect(veg.getByText("2×")).toBeOnTheScreen();
    expect(veg.getByText(/Full \(8 pcs\)/)).toBeOnTheScreen();
    expect(veg.getByText("1 order")).toBeOnTheScreen();
    expect(within(screen.getByTestId("prep-Paneer Tandoori Momos")).getByText("2×")).toBeOnTheScreen();
    expect(screen.getByText("7 to make")).toBeOnTheScreen();
  });
  it("always looks at ALL stations, whatever the board was set to", async () => {
    const s = fakeServer();
    const { runtime } = await renderApp(<PrepScreen />, { server: s });
    await runtime.settings.set({ screen: "bar" });
    await screen.findByTestId("prep-list");
    expect(s.calls.filter((c) => c.path === "/api/kitchen/orders").every((c) => c.query === "?screen=all")).toBe(true);
  });
  it("nothing to make says so", async () => {
    await renderApp(<PrepScreen />, { server: fakeServer({ "GET /api/kitchen/orders": { json: { ...fx<Record<string, unknown>>("kitchen-board-all"), orders: [] } } }) });
    expect(await screen.findByText("Nothing to prepare")).toBeOnTheScreen();
  });
});

describe("Today (the kitchen manager's numbers)", () => {
  it("what is on the board right now and how today went", async () => {
    await renderApp(<TodayScreen />, { server: fakeServer(asManager()) });
    expect(await screen.findByText("Right now")).toBeOnTheScreen();
    expect(screen.getByText("Orders made")).toBeOnTheScreen();
    expect(screen.getByText("Average time")).toBeOnTheScreen();
    expect(screen.getByText("Late after 20 min")).toBeOnTheScreen();
    const top = within(screen.getByTestId("top-dishes"));
    expect(top.getByText("Paneer Tandoori Momos")).toBeOnTheScreen();
    expect(top.getByText("2×")).toBeOnTheScreen();
  });
  it("a quiet day: no average, no slowest, and a sentence instead of a list", async () => {
    const quiet = { now: { new: 0, preparing: 0, ready: 0 }, today: { ready: 0, averageMinutes: null, lateCount: 0, slowest: null, topDishes: [] }, settings: { warnAfterMinutes: 10, lateAfterMinutes: 20 } };
    await renderApp(<TodayScreen />, { server: fakeServer({ ...asManager(), "GET /api/kitchen/summary": { json: quiet } }) });
    expect(await screen.findByText("Nothing made yet today")).toBeOnTheScreen();
    expect(screen.queryByText("Slowest")).toBeNull();
  });
  it("can't load: says so", async () => {
    await renderApp(<TodayScreen />, { server: fakeServer({ ...asManager(), "GET /api/kitchen/summary": { status: 403, json: { error: "You don't have permission to do that." } } }) });
    expect(await screen.findByText("Can't load today's numbers")).toBeOnTheScreen();
  });
});

describe("Account", () => {
  it("tells a cook who they are and what they may do", async () => {
    await renderApp(<AccountScreen />);
    expect(await screen.findByTestId("account-name")).toHaveTextContent("Ravi (kitchen)");
    expect(screen.getByText("Kitchen staff")).toBeOnTheScreen();
    expect(screen.getByText("No — kitchen manager only")).toBeOnTheScreen();
  });
  it("…and a manager", async () => {
    await renderApp(<AccountScreen />, { server: fakeServer(asManager()) });
    expect(await screen.findByText("Kitchen manager")).toBeOnTheScreen();
    expect(screen.getByText("Yes — kitchen manager")).toBeOnTheScreen();
  });
  it("shows the app's name, version, build and server", async () => {
    await renderApp(<AccountScreen />);
    await screen.findByTestId("account-name");
    expect(screen.getByText("Rasoi Pulse KDA")).toBeOnTheScreen();
    expect(screen.getByText("Kitchen Display App")).toBeOnTheScreen();
    expect(screen.getByText("api.example.test")).toBeOnTheScreen();
  });
  it("the alert and keep-the-screen-on switches are remembered for this person at this outlet", async () => {
    const { runtime, prefs } = await renderApp(<AccountScreen />);
    const { user, outletId } = runtime.session.getState();
    await act(async () => { await runtime.settings.load(user!.id, outletId!); }); // (the app's shell does this when someone is signed in: see app-shell.test.tsx)
    await fireEvent(await screen.findByTestId("switch-alerts"), "valueChange", false);
    await fireEvent(screen.getByTestId("switch-keep-awake"), "valueChange", false);
    await waitFor(() => expect(runtime.settings.store.getState()).toMatchObject({ alerts: false, keepAwake: false }));
    const saved = [...prefs.data.entries()];
    expect(saved).toHaveLength(1);
    expect(saved[0]![0]).toMatch(/^kda\.settings\.v1:/);
    expect(JSON.parse(saved[0]![1])).toMatchObject({ alerts: false, keepAwake: false, screen: "all" });
  });
  it("Sign out asks first, then signs out", async () => {
    const { runtime, server } = await renderApp(<AccountScreen />);
    await fireEvent.press(await screen.findByTestId("sign-out"));
    expect(await screen.findByText("Sign out?")).toBeOnTheScreen();
    expect(runtime.session.getState().status).toBe("signed-in");
    await fireEvent.press(screen.getByRole("button", { name: "Yes, sign out" }));
    await waitFor(() => expect(runtime.session.getState().status).toBe("signed-out"));
    expect(server.to("POST", "/api/auth/logout")).toHaveLength(1);
  });
});
