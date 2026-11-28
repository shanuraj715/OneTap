import { act, fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { Ratings } from "@/screens/Ratings";
import { Stock } from "@/screens/Stock";
import { ACCOUNTANT, renderApp } from "../../test/harness";
import { freshScope, inventoryReport, queryOf, ratingsPage, rating, reportsServer, stockPlan } from "../../test/data";

beforeEach(() => freshScope());
const outletHeader = (c: { headers: Record<string, string> }) => c.headers["x-rasoipulse-outlet"];

describe("Stock", () => {
  it("counts the dishes, what is out, running low and switched off", async () => {
    await renderApp(<Stock />, { server: reportsServer() });
    expect(within(await screen.findByTestId("stock-counted")).getByText("12")).toBeOnTheScreen();
    expect(within(screen.getByTestId("stock-out")).getByText("1")).toBeOnTheScreen();
    expect(within(screen.getByTestId("stock-low")).getByText("1")).toBeOnTheScreen();
    expect(within(screen.getByTestId("stock-off")).getByText("1")).toBeOnTheScreen();
  });
  it("lists what needs attention, the empty ones first, with how long the rest will last", async () => {
    await renderApp(<Stock />, { server: reportsServer() });
    await screen.findByTestId("stock-d1");
    expect(screen.getAllByTestId(/^stock-d\d$/).map((n) => n.props.testID)).toEqual(["stock-d1", "stock-d2"]); // out, then low; the one in stock waits
    expect(screen.getByTestId("stock-d1")).toHaveTextContent(/Out of stock/);
    expect(screen.getByTestId("stock-d2")).toHaveTextContent(/3 left · less than a day at this pace/);
    await fireEvent.press(screen.getByTestId("stock-show-all"));
    expect(screen.getByTestId("stock-d3")).toHaveTextContent(/80 left · about 9 days at this pace/);
  });
  it("lists the dishes switched off, with the reason", async () => {
    await renderApp(<Stock />, { server: reportsServer() });
    expect(await screen.findByTestId("off-d9")).toHaveTextContent(/Winter Soup/); expect(screen.getByTestId("off-d9")).toHaveTextContent(/Seasonal/);
  });
  it("suggests what to prepare tomorrow", async () => {
    await renderApp(<Stock />, { server: reportsServer() });
    const list = await screen.findByTestId("prep-list");
    expect(list).toHaveTextContent(/Veg Momos/); expect(list).toHaveTextContent(/make 62/); expect(list).toHaveTextContent(/usually 54, up to 70/); expect(list).toHaveTextContent(/make 30/);
    expect(screen.getByText(/Sunday: from the last 4 weeks, plus 15% extra/)).toBeOnTheScreen();
  });
  it("says so when there is nothing to suggest", async () => {
    await renderApp(<Stock />, { server: reportsServer({ "GET /api/analytics/stock": { json: stockPlan({ tomorrow: { day: "2026-11-29", weekday: "Sunday", items: [] } }) } }) });
    expect(await screen.findByText("Nothing to suggest yet")).toBeOnTheScreen();
  });
  it("all fine says so", async () => {
    await renderApp(<Stock />, { server: reportsServer({ "GET /api/analytics/inventory": { json: inventoryReport({ items: [], switchedOff: [] }) } }) });
    expect(await screen.findByText("Nothing is out or running low")).toBeOnTheScreen();
  });

  describe("changing a count", () => {
    const patch = () => reportsServer({ "PATCH /api/menu/items/:id": { json: { item: { id: "d1" } } } });
    it("opens with the dish's numbers and sends the new ones for that dish's own outlet", async () => {
      const server = patch();
      await renderApp(<Stock />, { server });
      await fireEvent.press(await screen.findByTestId("stock-d1"));
      expect(screen.getByTestId("stock-left").props.value).toBe("0"); expect(screen.getByTestId("stock-daily").props.value).toBe("50"); expect(screen.getByTestId("stock-lowat").props.value).toBe("5");
      await fireEvent.changeText(screen.getByTestId("stock-left"), "40");
      await act(async () => { await fireEvent.press(screen.getByTestId("stock-save")); });
      await waitFor(() => expect(server.to("PATCH", "/api/menu/items/d1")).toHaveLength(1));
      const call = server.to("PATCH", "/api/menu/items/d1")[0]!;
      expect(call.body).toEqual({ stock: { tracked: true, left: 40, daily: 50, lowAt: 5 } });
      expect(outletHeader(call)).toBe("o1");
      expect(await screen.findByText("Stock saved.")).toBeOnTheScreen();
    });
    it("an empty 'each day' means no daily refill", async () => {
      const server = patch();
      await renderApp(<Stock />, { server });
      await fireEvent.press(await screen.findByTestId("stock-d1"));
      await fireEvent.changeText(screen.getByTestId("stock-daily"), "");
      await act(async () => { await fireEvent.press(screen.getByTestId("stock-save")); });
      await waitFor(() => expect(server.to("PATCH", "/api/menu/items/d1")).toHaveLength(1));
      expect(server.to("PATCH", "/api/menu/items/d1")[0]!.body.stock.daily).toBeNull();
    });
    it("won't save a count that isn't a whole number of 0 or more", async () => {
      await renderApp(<Stock />, { server: patch() });
      await fireEvent.press(await screen.findByTestId("stock-d1"));
      for (const bad of ["-3", "2.5", "abc", ""]) {
        await fireEvent.changeText(screen.getByTestId("stock-left"), bad);
        expect(screen.getByTestId("stock-save")).toBeDisabled();
      }
      await fireEvent.changeText(screen.getByTestId("stock-left"), "7");
      expect(screen.getByTestId("stock-save")).toBeEnabled();
    });
    it("a dish can be switched back on from the switched-off list", async () => {
      const server = patch();
      await renderApp(<Stock />, { server });
      await act(async () => { await fireEvent(await screen.findByTestId("off-switch-d9"), "valueChange", true); });
      await waitFor(() => expect(server.to("PATCH", "/api/menu/items/d9")).toHaveLength(1));
      expect(server.to("PATCH", "/api/menu/items/d9")[0]!.body).toEqual({ isAvailable: true });
      expect(await screen.findByText("Dish switched on.")).toBeOnTheScreen();
    });
    it("someone who can't change the menu can look but not edit", async () => {
      await renderApp(<Stock />, { server: patch(), signedInAs: { ...ACCOUNTANT, permissions: ["analytics:read", "menu:read", "outlet:read"] } });
      await fireEvent.press(await screen.findByTestId("stock-d1"));
      expect(screen.queryByTestId("stock-sheet")).toBeNull();
      expect(screen.queryByTestId("off-switch-d9")).toBeNull();
    });
  });
});

describe("Ratings", () => {
  it("shows the average, the count and how many gave each star", async () => {
    await renderApp(<Ratings />, { server: reportsServer() });
    expect(await screen.findByTestId("ratings-average")).toHaveTextContent("4.3");
    const s = screen.getByTestId("ratings-summary");
    expect(s).toHaveTextContent(/20 ratings/); expect(s).toHaveTextContent(/5 stars/); expect(s).toHaveTextContent(/10/);
  });
  it("lists ratings with stars, comment, customer, order, date and the dishes rated; a nameless customer is still shown", async () => {
    await renderApp(<Ratings />, { server: reportsServer() });
    const r1 = await screen.findByTestId("rating-r1");
    expect(r1).toHaveTextContent(/Priya/); expect(r1).toHaveTextContent(/Loved the momos!/); expect(r1).toHaveTextContent(/Order A-102 · ₹450 · 27 Nov 2026/); expect(r1).toHaveTextContent(/Tasty/);
    expect(within(r1).getByLabelText("5 out of 5 stars")).toBeOnTheScreen();
    expect(r1).toHaveTextContent(/Veg Momos 5★ “Crispy”/); expect(r1).toHaveTextContent(/Masala Chai 3★/);
    const r2 = screen.getByTestId("rating-r2");
    expect(r2).toHaveTextContent(/Customer/); expect(r2).not.toHaveTextContent(/“/);
    expect(within(r2).getByLabelText("2 out of 5 stars")).toBeOnTheScreen();
  });
  it("the days, a star and 'with a comment' narrow what the server is asked for", async () => {
    const server = reportsServer();
    await renderApp(<Ratings />, { server });
    await screen.findByTestId("rating-r1");
    const last = () => queryOf(server.to("GET", "/api/feedback").at(-1)!);
    expect(last()).toMatchObject({ days: "30" });
    await fireEvent.press(screen.getByTestId("ratings-days-7"));
    await waitFor(() => expect(last().days).toBe("7"));
    await fireEvent.press(await screen.findByTestId("ratings-filter-2")); // (the list is reloading for a moment after the days change)
    await waitFor(() => expect(last().stars).toBe("2"));
    await fireEvent.press(await screen.findByTestId("ratings-filter-comments"));
    await waitFor(() => expect(last().withComment).toBe("1"));
    expect(last().stars).toBeUndefined();
  });
  it("older ratings are fetched with the cursor the server gave", async () => {
    const server = reportsServer();
    server.set("GET /api/feedback", (call) => ({ json: queryOf(call).before ? ratingsPage({ ratings: [rating({ id: "r3", comment: "Old one", customerName: "Old" })], nextBefore: null }) : ratingsPage({ nextBefore: "2026-11-26T19:00:00.000Z" }) }));
    await renderApp(<Ratings />, { server });
    await fireEvent.press(await screen.findByTestId("ratings-more"));
    expect(await screen.findByTestId("rating-r3")).toBeOnTheScreen();
    expect(queryOf(server.to("GET", "/api/feedback").at(-1)!).before).toBe("2026-11-26T19:00:00.000Z");
    expect(screen.getByTestId("rating-r1")).toBeOnTheScreen(); // the first page is still there
    expect(screen.queryByTestId("ratings-more")).toBeNull();
  });
  it("asks for the outlet shown and switches when another is picked", async () => {
    const server = reportsServer();
    await renderApp(<Ratings />, { server });
    await screen.findByTestId("rating-r1");
    expect(outletHeader(server.to("GET", "/api/feedback")[0]!)).toBe("o1");
    await fireEvent.press(screen.getByTestId("outlet-pick-o2"));
    await waitFor(() => expect(server.to("GET", "/api/feedback").some((c) => outletHeader(c) === "o2")).toBe(true));
  });
  it("no ratings says so; a plan without ratings is told so", async () => {
    await renderApp(<Ratings />, { server: reportsServer({ "GET /api/feedback": { json: ratingsPage({ summary: { days: 30, count: 0, average: 0, byStars: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, withComments: 0 }, ratings: [] }) } }) });
    expect(await screen.findByText("No ratings in this time")).toBeOnTheScreen();
  });
  it("a plan without ratings is told so in the server's words", async () => {
    await renderApp(<Ratings />, { server: reportsServer({ "GET /api/feedback": { status: 403, json: { error: "Ratings & feedback isn't included in your plan." } } }) });
    expect(await screen.findByText("Not in your plan")).toBeOnTheScreen();
  });
});
