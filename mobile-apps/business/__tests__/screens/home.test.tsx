import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { Home } from "@/screens/Home";
import { MANAGER, ACCOUNTANT, renderApp } from "../../test/harness";
import { freshScope, goal, queryOf, reportsServer } from "../../test/data";

beforeEach(() => freshScope());

describe("Home", () => {
  it("greets the person and shows today, this week, this month and this year, each with its sales", async () => {
    const server = reportsServer();
    await renderApp(<Home />, { server });
    expect(await screen.findByText(/Good (morning|afternoon|evening), Olivia/)).toBeOnTheScreen();
    for (const id of ["today", "thisWeek", "thisMonth", "thisYear"]) expect(await screen.findByTestId(`card-${id}`)).toBeOnTheScreen();
    await waitFor(() => expect(screen.getAllByText("₹50,000").length).toBe(4)); // the made-up server answers every period with the same overview
    expect(screen.getAllByText(/120 orders · avg ₹417/).length).toBe(4);
  });

  it("asks the server for each period's own dates, a running period only up to today, and the year by month", async () => {
    const server = reportsServer();
    await renderApp(<Home />, { server });
    await screen.findByTestId("card-thisYear");
    const calls = server.to("GET", "/api/analytics/overview").map(queryOf);
    const today = calls.find((q) => q.from === q.to && q.granularity === "day");
    expect(today).toBeTruthy();
    const year = calls.find((q) => q.granularity === "month");
    expect(year?.from).toMatch(/^\d{4}-01-01$/);
    const month = calls.find((q) => /-01$/.test(q.from ?? "") && q.granularity === "day" && q.from !== q.to && q.from!.slice(5, 7) === q.to!.slice(5, 7));
    expect(month?.to && month.to <= new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10)).toBe(true); // never a date in the future
  });

  it("shows how each period compares with the days just before it", async () => {
    await renderApp(<Home />, { server: reportsServer() });
    await screen.findByTestId("card-today");
    expect((await screen.findAllByText(/\+25%/)).length).toBeGreaterThanOrEqual(4); // 50,000 against 40,000
  });

  it("lists the highlights in plain words, with a mark for good news and warnings", async () => {
    await renderApp(<Home />, { server: reportsServer() });
    expect(await screen.findByText("Sales are up")).toBeOnTheScreen();
    expect(screen.getByText("2 dishes are out of stock or running low")).toBeOnTheScreen();
    expect(screen.getByText("Veg Momos is your best seller")).toBeOnTheScreen();
  });

  it("shows where the sales come from and the busy times", async () => {
    await renderApp(<Home />, { server: reportsServer() });
    expect(await screen.findByTestId("chart-channels")).toBeOnTheScreen();
    expect(screen.getByTestId("chart-payments")).toBeOnTheScreen();
    expect(screen.getByTestId("chart-heatmap")).toBeOnTheScreen();
    expect(await screen.findByText(/Busiest hour: 8 pm/)).toBeOnTheScreen();
  });

  describe("the monthly target", () => {
    it("shows how far the month has got, whether it is on pace and what each remaining day needs", async () => {
      await renderApp(<Home />, { server: reportsServer({ "GET /api/analytics/goals": { json: goal({ goal: { monthlySales: 100_000 } }) } }) });
      expect(await screen.findByText("Monthly target ₹1,00,000")).toBeOnTheScreen();
      expect(screen.getByText(/₹82,000 so far · 2 days left/)).toBeOnTheScreen();
      expect(screen.getByText("On pace for ₹87,857")).toBeOnTheScreen();
      expect(screen.getByText(/Needs ₹9,000 a day to get there/)).toBeOnTheScreen();
      expect(screen.getByTestId("goal-gauge")).toBeOnTheScreen();
    });

    it("with no target it offers to set one, and saves what the owner types", async () => {
      const server = reportsServer({ "GET /api/analytics/goals": { json: goal({ goal: { monthlySales: null }, pct: null, onTrack: null, neededPerDay: null }) }, "PUT /api/analytics/goals": { json: goal() } });
      await renderApp(<Home />, { server });
      await fireEvent.press(await screen.findByTestId("goal-set"));
      await fireEvent.changeText(await screen.findByTestId("goal-input"), "1,50,000");
      await act(async () => { await fireEvent.press(screen.getByTestId("goal-save")); });
      await waitFor(() => expect(server.to("PUT", "/api/analytics/goals")[0]?.body).toEqual({ monthlySales: 150000 }));
      expect(await screen.findByText("Target saved.")).toBeOnTheScreen();
      await waitFor(() => expect(screen.queryByTestId("goal-input")).toBeNull()); // the sheet has closed (its closing movement is over before the test ends)
    });

    it("won't save a target that isn't a number above 0", async () => {
      await renderApp(<Home />, { server: reportsServer({ "GET /api/analytics/goals": { json: goal({ goal: { monthlySales: null } }) } }) });
      await fireEvent.press(await screen.findByTestId("goal-set"));
      await fireEvent.changeText(await screen.findByTestId("goal-input"), "abc");
      expect(screen.getByTestId("goal-save")).toBeDisabled();
      await fireEvent.changeText(screen.getByTestId("goal-input"), "0");
      expect(screen.getByTestId("goal-save")).toBeDisabled();
    });

    it("a manager (no money figures) sees the target but gets no button to change it", async () => {
      await renderApp(<Home />, { server: reportsServer({ "GET /api/analytics/goals": { json: goal({ goal: { monthlySales: 100_000 } }) } }), signedInAs: MANAGER });
      await screen.findByText("Monthly target ₹1,00,000");
      expect(screen.queryByTestId("goal-edit")).toBeNull();
    });
    it("an accountant can change it", async () => {
      await renderApp(<Home />, { server: reportsServer({ "GET /api/analytics/goals": { json: goal({ goal: { monthlySales: 100_000 } }) } }), signedInAs: ACCOUNTANT });
      expect(await screen.findByTestId("goal-edit")).toBeOnTheScreen();
    });
  });

  it("the period and outlets can be changed, and every report follows", async () => {
    const server = reportsServer();
    await renderApp(<Home />, { server });
    await screen.findByText("Sales are up");
    await fireEvent.press(await screen.findByTestId("scope-period"));
    await fireEvent.press(await screen.findByTestId("period-lastMonth"));
    await waitFor(() => expect(server.to("GET", "/api/analytics/insights").map(queryOf).some((q) => q.from === "2026-10-01" || /-01$/.test(q.from ?? ""))).toBe(true));
    await fireEvent.press(screen.getByTestId("scope-outlets"));
    await fireEvent.press(await screen.findByTestId("outlet-o2"));
    await fireEvent.press(screen.getByTestId("outlets-apply"));
    await waitFor(() => expect(server.to("GET", "/api/analytics/insights").map(queryOf).some((q) => q.outlets === "o2")).toBe(true));
  });

  it("when a report can't be loaded it says so and offers to try again", async () => {
    const server = reportsServer({ "GET /api/analytics/insights": { status: 500, json: { error: "boom" } } });
    await renderApp(<Home />, { server });
    expect(await screen.findByText("Couldn't load this")).toBeOnTheScreen();
    server.set("GET /api/analytics/insights", { json: { insights: [] } });
    await fireEvent.press(screen.getByText("Try again"));
    expect(await screen.findByText("Nothing to point out yet")).toBeOnTheScreen();
  });

  it("a store whose plan has no analytics is told so, in the server's words", async () => {
    const server = reportsServer({ "GET /api/analytics/insights": { status: 403, json: { error: "Analytics isn't included in your plan." } } });
    await renderApp(<Home />, { server });
    expect(await screen.findByText("Not in your plan")).toBeOnTheScreen();
    expect(screen.getByText("Analytics isn't included in your plan.")).toBeOnTheScreen();
  });
});
