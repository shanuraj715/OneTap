import { act, fireEvent, screen, within } from "@testing-library/react-native";
import { TablesScreen } from "@/screens/TablesScreen";
import { fakeServer, fx, prefsWithOpenAreas, renderApp } from "../../test/harness";

/** the waiter has the areas open (they start closed; a waiter who keeps them open has them remembered) */
const openAreas = () => prefsWithOpenAreas("Ground floor", "Terrace", "First floor");

const tables = (n: number) => ({ tables: Array.from({ length: n }, (_, i) => ({ id: `id${i}`, number: `T${i + 1}`, zone: i % 2 ? "Terrace" : "Ground floor", seats: 4, status: "free", isActive: true, activeSessionId: null })) });

describe("the tables board", () => {
  it("shows every table with who is sitting at it and what they owe", async () => {
    await renderApp(<TablesScreen onOpenTable={() => undefined} />, { prefs: openAreas() });
    expect(await screen.findByTestId("table-T1")).toBeOnTheScreen();
    const t1 = within(screen.getByTestId("table-T1"));
    expect(t1.getByText("Seated")).toBeOnTheScreen();
    expect(t1.getByText("Mehta family")).toBeOnTheScreen();
    expect(t1.getByText("₹340 to pay")).toBeOnTheScreen();
    expect(within(screen.getByTestId("table-T2")).getByText("Free")).toBeOnTheScreen();
    expect(screen.getByText(/Noida · 2 free of 3/)).toBeOnTheScreen();
  });

  it("tells a screen reader the whole card in one sentence", async () => {
    await renderApp(<TablesScreen onOpenTable={() => undefined} />, { prefs: openAreas() });
    expect(await screen.findByLabelText(/^Table T1, Ground floor, 4 seats, Seated, Mehta family, .*₹340 to pay$/)).toBeOnTheScreen();
  });

  it("opens the table that was tapped", async () => {
    const onOpen = jest.fn();
    await renderApp(<TablesScreen onOpenTable={onOpen} />, { prefs: openAreas() });
    await fireEvent.press(await screen.findByTestId("table-T3"));
    expect(onOpen).toHaveBeenCalledWith(fx("tables-seated").tables.find((t: { number: string }) => t.number === "T3").id);
  });

  it("filters by state, with a count on each chip, and a second tap clears the filter", async () => {
    await renderApp(<TablesScreen onOpenTable={() => undefined} />, { prefs: openAreas() });
    await screen.findByTestId("table-T1");
    expect(screen.getByRole("button", { name: "Free, 2" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Seated, 1" })).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("filter-free"));
    expect(screen.queryByTestId("table-T1")).toBeNull();
    expect(screen.getByTestId("table-T2")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("filter-free"));
    expect(screen.getByTestId("table-T1")).toBeOnTheScreen();
  });

  it("filters by area when there is more than one", async () => {
    await renderApp(<TablesScreen onOpenTable={() => undefined} />, { prefs: openAreas() });
    await screen.findByTestId("table-T1");
    await fireEvent.press(screen.getByTestId("zone-Terrace"));
    expect(screen.queryByTestId("table-T1")).toBeNull();
    expect(screen.queryByTestId("table-T2")).toBeNull();
    expect(screen.getByTestId("table-T3")).toBeOnTheScreen();
  });

  it("says so when no table matches the filters, and clears them", async () => {
    await renderApp(<TablesScreen onOpenTable={() => undefined} />, { prefs: openAreas() });
    await screen.findByTestId("table-T1");
    await fireEvent.press(screen.getByTestId("filter-bill-requested"));
    expect(screen.getByText("No table matches")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByTestId("table-T1")).toBeOnTheScreen();
  });

  it("an outlet with no tables says so", async () => {
    await renderApp(<TablesScreen onOpenTable={() => undefined} />, { prefs: openAreas(), server: fakeServer({ "GET /api/tables": { json: { tables: [] } } }) });
    expect(await screen.findByText("No tables yet")).toBeOnTheScreen();
  });

  it("a big floor gets a search box that finds a table by number (and opens the area it is in)", async () => {
    await renderApp(<TablesScreen onOpenTable={() => undefined} />, { prefs: openAreas(), server: fakeServer({ "GET /api/tables": { json: tables(14) } }) });
    await screen.findByTestId("zone-header-Ground floor");
    await fireEvent.changeText(screen.getByTestId("table-search"), "t12");
    expect(screen.getByTestId("table-T12")).toBeOnTheScreen();
    expect(screen.queryByTestId("table-T3")).toBeNull();
  });

  it("a small floor has no search box", async () => {
    await renderApp(<TablesScreen onOpenTable={() => undefined} />, { prefs: openAreas() });
    await screen.findByTestId("table-T1");
    expect(screen.queryByTestId("table-search")).toBeNull();
  });

  it("when the server cannot be reached the first time: a clear message and a way to try again", async () => {
    const server = fakeServer({ "GET /api/tables": { throws: new TypeError("Network request failed") } });
    await renderApp(<TablesScreen onOpenTable={() => undefined} />, { prefs: openAreas(), server });
    expect(await screen.findByText("No connection")).toBeOnTheScreen();
    server.set("GET /api/tables", { json: fx("tables-seated") });
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByTestId("table-T1")).toBeOnTheScreen();
  });

  it("when a later refresh fails the waiter keeps the board and is told it may be old", async () => {
    const server = fakeServer();
    const { runtime } = await renderApp(<TablesScreen onOpenTable={() => undefined} />, { prefs: openAreas(), server });
    await screen.findByTestId("table-T1");
    server.set("GET /api/tables", { throws: new TypeError("Network request failed") });
    await act(async () => { await runtime.queryClient.refetchQueries({ queryKey: ["tables"] }); });
    expect(await screen.findByTestId("board-stale")).toBeOnTheScreen();
    expect(screen.getByTestId("table-T1")).toBeOnTheScreen();
  });

  it("refreshes by itself while open", async () => {
    jest.useFakeTimers();
    try {
      const server = fakeServer();
      await renderApp(<TablesScreen onOpenTable={() => undefined} />, { prefs: openAreas(), server });
      await act(async () => { await jest.advanceTimersByTimeAsync(100); });
      const first = server.to("GET", "/api/tables").length;
      expect(first).toBeGreaterThanOrEqual(1);
      await act(async () => { await jest.advanceTimersByTimeAsync(8_500); });
      expect(server.to("GET", "/api/tables").length).toBeGreaterThan(first);
    } finally { jest.useRealTimers(); }
  });

  it("asks the server for THIS outlet's tables only", async () => {
    const server = fakeServer();
    await renderApp(<TablesScreen onOpenTable={() => undefined} />, { prefs: openAreas(), server });
    await screen.findByTestId("table-T1");
    expect(server.to("GET", "/api/tables")[0]!.headers["x-rasoipulse-outlet"]).toBe(fx("outlets").outlets[0]._id);
    expect(server.to("GET", "/api/tables")[0]!.headers.authorization).toMatch(/^Bearer /);
  });

  it("marks the table shown in the side panel", async () => {
    await renderApp(<TablesScreen onOpenTable={() => undefined} selectedId={fx("tables-seated").tables.find((t: { number: string }) => t.number === "T1").id} />, { prefs: openAreas() });
    expect(await screen.findByTestId("table-T1")).toBeSelected();
    expect(screen.getByTestId("table-T2")).not.toBeSelected();
  });
});

describe("how often the board asks for new data (the platform admin's setting for the order app)", () => {
  const asks = (srv: ReturnType<typeof fakeServer>) => srv.to("GET", "/api/tables").length;
  const wait = async (ms: number) => { await act(async () => { await jest.advanceTimersByTimeAsync(ms); }); };
  const run = async (headers: Record<string, string> | undefined, body: (srv: ReturnType<typeof fakeServer>) => Promise<void>) => {
    jest.useFakeTimers();
    try {
      const srv = fakeServer({ "GET /api/tables": { json: fx("tables-seated"), headers } });
      await renderApp(<TablesScreen onOpenTable={() => undefined} />, { prefs: openAreas(), server: srv });
      await wait(100);
      await body(srv);
    } finally { jest.useRealTimers(); }
  };

  it("every 8 seconds until the server says otherwise", async () => {
    await run(undefined, async (srv) => {
      const first = asks(srv);
      expect(first).toBeGreaterThanOrEqual(1);
      await wait(7_000);
      expect(asks(srv)).toBe(first);
      await wait(1_500);
      expect(asks(srv)).toBe(first + 1);
    });
  });

  it("every 20 seconds when the admin set 20", async () => {
    await run({ "x-refresh-seconds": "20" }, async (srv) => {
      const first = asks(srv);
      await wait(19_000);
      expect(asks(srv)).toBe(first);
      await wait(1_500);
      expect(asks(srv)).toBe(first + 1);
    });
  });
});
