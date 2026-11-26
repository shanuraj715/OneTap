import { act, fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { Dimensions, Vibration } from "react-native";
import { BoardScreen } from "@/screens/BoardScreen";
import { toasts } from "@/ui";
import { fakeServer, fx, renderApp, type Handler } from "../../test/harness";

const size = (width: number, height = 900) => Dimensions.set({ window: { width, height, scale: 2, fontScale: 1 }, screen: { width, height, scale: 2, fontScale: 1 } });
const TABLET = () => size(1000, 700);
const PHONE = () => size(400, 800);
const messages = () => toasts.store.getState().toasts.map((t) => t.message);

/** the recorded board, with every order accepted `ago` minutes ago (the recording is old, and "how long it waited" depends on the clock) */
const boardAt = (minutes: Record<string, number> = {}, extra: unknown[] = []) => {
  const b = fx("kitchen-board-all");
  b.orders = [...b.orders.map((o: { orderNumber: string }) => ({ ...o, acceptedAt: new Date(Date.now() - (minutes[o.orderNumber] ?? 1) * 60_000).toISOString() })), ...extra];
  return b;
};
const server = (board = boardAt(), more: Record<string, Handler> = {}) => fakeServer({ "GET /api/kitchen/orders": (call) => ({ json: new URLSearchParams(call.query).get("screen") === "bar" ? fx("kitchen-board-bar") : board }), ...more });

let vibrate: jest.SpyInstance;
beforeEach(() => { toasts.clear(); vibrate = jest.spyOn(Vibration, "vibrate").mockImplementation(() => undefined); TABLET(); });
afterEach(() => vibrate.mockRestore());

describe("the board on a tablet: three lanes side by side", () => {
  it("shows New · Preparing · Ready, each with how many orders are in it", async () => {
    await renderApp(<BoardScreen />, { server: server() });
    expect(await screen.findByTestId("ticket-0003")).toBeOnTheScreen();
    expect(within(screen.getByTestId("lane-new")).getByTestId("ticket-0003")).toBeOnTheScreen();
    expect(within(screen.getByTestId("lane-preparing")).getByTestId("ticket-0002")).toBeOnTheScreen();
    expect(within(screen.getByTestId("lane-ready")).getByTestId("ticket-0001")).toBeOnTheScreen();
    expect(screen.getByTestId("count-new")).toHaveTextContent("1");
    expect(screen.getByTestId("count-preparing")).toHaveTextContent("1");
    expect(screen.getByTestId("count-ready")).toHaveTextContent("1");
  });

  it("a ticket has everything a cook needs: where it goes, every dish with size, add-ons and note, the customer's note, both stations", async () => {
    await renderApp(<BoardScreen />, { server: server() });
    const t = within(await screen.findByTestId("ticket-0003"));
    expect(t.getByText("#0003")).toBeOnTheScreen();
    expect(t.getByText("Table T1")).toBeOnTheScreen();
    expect(t.getByText(/Mehta family/)).toBeOnTheScreen();
    expect(t.getByText("Veg Steamed Momos · Full (8 pcs)")).toBeOnTheScreen();
    expect(t.getByText("Mayo dip")).toBeOnTheScreen();
    expect(t.getByText("less salt")).toBeOnTheScreen();
    expect(t.getByText(/birthday table, please bring everything together/)).toBeOnTheScreen();
    expect(t.getByText("Kitchen: new · Bar: new")).toBeOnTheScreen();
    expect(t.getAllByText("2×")).toHaveLength(2); // the momos and the two teas
    expect(t.getByText("1×")).toBeOnTheScreen(); // the kurkure
  });

  it("how long each has waited: the minutes, from when it was accepted", async () => {
    await renderApp(<BoardScreen />, { server: server(boardAt({ "0003": 7, "0002": 14 })) });
    expect(within(await screen.findByTestId("ticket-0003")).getByText("7 min")).toBeOnTheScreen();
    expect(within(screen.getByTestId("ticket-0002")).getByText("14 min")).toBeOnTheScreen();
    expect(within(screen.getByTestId("ticket-0001")).getByText("Ready")).toBeOnTheScreen(); // a ready order shows no clock
  });

  it("each ticket's button is the next step: Start, Mark ready, Recall", async () => {
    await renderApp(<BoardScreen />, { server: server() });
    await screen.findByTestId("ticket-0003");
    expect(within(screen.getByTestId("ticket-0003")).getByRole("button", { name: "Start" })).toBeOnTheScreen();
    expect(within(screen.getByTestId("ticket-0002")).getByRole("button", { name: "Mark ready" })).toBeOnTheScreen();
    expect(within(screen.getByTestId("ticket-0001")).getByRole("button", { name: "Recall" })).toBeOnTheScreen();
  });

  it("an empty board says so in each lane", async () => {
    const empty = { ...fx("kitchen-board-all"), orders: [] };
    await renderApp(<BoardScreen />, { server: server(empty) });
    expect(await screen.findByText("No new orders")).toBeOnTheScreen();
    expect(screen.getByText("Nothing being made")).toBeOnTheScreen();
    expect(screen.getByText("Nothing waiting for pick-up")).toBeOnTheScreen();
  });
});

describe("the board on a phone: one lane at a time", () => {
  beforeEach(PHONE);
  it("starts on New, with the counts on the lane buttons; the other lanes are a tap away", async () => {
    await renderApp(<BoardScreen />, { server: server() });
    expect(await screen.findByTestId("ticket-0003")).toBeOnTheScreen();
    expect(screen.queryByTestId("ticket-0002")).toBeNull();
    expect(screen.getByRole("radio", { name: "Preparing 1" })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("radio", { name: "Preparing 1" }));
    expect(screen.getByTestId("ticket-0002")).toBeOnTheScreen();
    expect(screen.queryByTestId("ticket-0003")).toBeNull();
    await fireEvent.press(screen.getByRole("radio", { name: "Ready 1" }));
    expect(screen.getByTestId("ticket-0001")).toBeOnTheScreen();
  });
});

describe("moving an order along", () => {
  it("Start tells the server (this order, this outlet, preparing) and asks for the board again", async () => {
    const s = server();
    const { runtime } = await renderApp(<BoardScreen />, { server: s });
    await fireEvent.press(within(await screen.findByTestId("ticket-0003")).getByRole("button", { name: "Start" }));
    await waitFor(() => expect(s.to("POST", /\/stage$/)).toHaveLength(1));
    const call = s.to("POST", /\/stage$/)[0]!;
    expect(call.path).toBe(`/api/kitchen/orders/${fx("kitchen-board-all").orders.find((o: { orderNumber: string }) => o.orderNumber === "0003").id}/stage`);
    expect(call.body).toEqual({ screen: "all", stage: "preparing" });
    expect(call.headers["x-rasoipulse-outlet"]).toBe(runtime.session.getState().outletId);
    await waitFor(() => expect(s.to("GET", "/api/kitchen/orders").length).toBeGreaterThan(1)); // the board was asked again: what the cook sees is the server's truth
  });

  it("Mark ready sends 'ready'", async () => {
    const s = server();
    await renderApp(<BoardScreen />, { server: s });
    await fireEvent.press(within(await screen.findByTestId("ticket-0002")).getByRole("button", { name: "Mark ready" }));
    await waitFor(() => expect(s.to("POST", /\/stage$/)[0]?.body).toEqual({ screen: "all", stage: "ready" }));
  });

  it("Recall asks first, and says what it does; Cancel changes nothing", async () => {
    const s = server();
    await renderApp(<BoardScreen />, { server: s });
    await fireEvent.press(within(await screen.findByTestId("ticket-0001")).getByRole("button", { name: "Recall" }));
    expect(await screen.findByText("Recall this order?")).toBeOnTheScreen();
    expect(screen.getByText(/Order #0001 goes back to Preparing/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Recall this order?")).toBeNull();
    expect(s.to("POST", /\/stage$/)).toHaveLength(0);
  });

  it("…and 'Yes, recall' sends it back to preparing", async () => {
    const s = server();
    await renderApp(<BoardScreen />, { server: s });
    await fireEvent.press(within(await screen.findByTestId("ticket-0001")).getByRole("button", { name: "Recall" }));
    await fireEvent.press(await screen.findByRole("button", { name: "Yes, recall" }));
    await waitFor(() => expect(s.to("POST", /\/stage$/)[0]?.body).toEqual({ screen: "all", stage: "preparing" }));
  });

  it("when the server refuses, the cook is told, and the order is still on the board", async () => {
    const s = server(boardAt(), { "POST /api/kitchen/orders/:id/stage": { status: 409, json: { error: "That order was already marked ready." } } });
    await renderApp(<BoardScreen />, { server: s });
    await fireEvent.press(within(await screen.findByTestId("ticket-0003")).getByRole("button", { name: "Start" }));
    await waitFor(() => expect(messages()).toContain("That order was already marked ready."));
    expect(screen.getByTestId("ticket-0003")).toBeOnTheScreen();
  });
});

describe("kitchen and bar", () => {
  it("Bar asks the server for the bar's board (and Start then moves the bar's part)", async () => {
    const s = server();
    await renderApp(<BoardScreen />, { server: s });
    await screen.findByTestId("ticket-0003");
    await fireEvent.press(screen.getByRole("radio", { name: "Bar" }));
    await waitFor(() => expect(s.calls.some((c) => c.method === "GET" && c.query.includes("screen=bar"))).toBe(true));
    const bar = fx("kitchen-board-bar").orders[0];
    const ticket = await screen.findByTestId(`ticket-${bar.orderNumber}`);
    expect(within(ticket).getByText("Masala Chai")).toBeOnTheScreen();
    expect(within(ticket).queryByText("Veg Steamed Momos · Full (8 pcs)")).toBeNull(); // only the bar's own dish
    await fireEvent.press(within(ticket).getByRole("button", { name: "Start" }));
    await waitFor(() => expect(s.to("POST", /\/stage$/)[0]?.body).toEqual({ screen: "bar", stage: "preparing" }));
  });
});

describe("a new order arrives", () => {
  const arrival = () => {
    const base = fx("kitchen-board-all").orders[2];
    return { ...base, id: "NEW-ORDER-1", orderNumber: "0099", tableNumber: "T7", stage: "new", stations: [{ station: "kitchen", stage: "new" }], lines: [{ name: "Paneer Tandoori Momos", variantLabel: "", modifiers: [], quantity: 2, note: "", station: "kitchen" }], acceptedAt: new Date().toISOString() };
  };

  it("the orders already there when the app opened are not announced", async () => {
    await renderApp(<BoardScreen />, { server: server() });
    await screen.findByTestId("ticket-0003");
    expect(vibrate).not.toHaveBeenCalled();
    expect(messages().filter((m) => /New order/.test(m))).toEqual([]);
    expect(screen.queryByText("NEW")).toBeNull();
  });

  it("a later one vibrates, says which, and is marked NEW until the cook acts on it", async () => {
    const s = server();
    const { runtime } = await renderApp(<BoardScreen />, { server: s });
    await screen.findByTestId("ticket-0003");
    s.set("GET /api/kitchen/orders", { json: boardAt({}, [arrival()]) });
    await act(async () => { await runtime.queryClient.invalidateQueries({ queryKey: ["board"] }); });
    expect(await screen.findByTestId("ticket-0099")).toBeOnTheScreen();
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(messages()).toContain("New order #0099 · Table T7 · 2 items");
    expect(within(screen.getByTestId("ticket-0099")).getByText("NEW")).toBeOnTheScreen();
    // the same order on the next refresh is not announced again
    await act(async () => { await runtime.queryClient.invalidateQueries({ queryKey: ["board"] }); });
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it("with the alert switched off it still appears, quietly", async () => {
    const s = server();
    const { runtime } = await renderApp(<BoardScreen />, { server: s });
    await screen.findByTestId("ticket-0003");
    await act(async () => { await runtime.settings.set({ alerts: false }); });
    s.set("GET /api/kitchen/orders", { json: boardAt({}, [arrival()]) });
    await act(async () => { await runtime.queryClient.invalidateQueries({ queryKey: ["board"] }); });
    expect(await screen.findByTestId("ticket-0099")).toBeOnTheScreen();
    expect(vibrate).not.toHaveBeenCalled();
    expect(messages().filter((m) => /New order/.test(m))).toEqual([]);
  });

  it("the bell in the heading switches the alert and remembers it", async () => {
    const { runtime } = await renderApp(<BoardScreen />, { server: server() });
    await fireEvent.press(await screen.findByTestId("alert-toggle"));
    expect(runtime.settings.store.getState().alerts).toBe(false);
    await fireEvent.press(screen.getByTestId("alert-toggle"));
    expect(runtime.settings.store.getState().alerts).toBe(true);
  });
});

describe("when the board can't be loaded", () => {
  it("says so in words, with a way to try again", async () => {
    const s = server(boardAt(), { "GET /api/kitchen/orders": { status: 500, json: { error: "The server had a problem." } } });
    await renderApp(<BoardScreen />, { server: s });
    expect(await screen.findByText("Can't load the board")).toBeOnTheScreen();
    s.set("GET /api/kitchen/orders", { json: boardAt() });
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByTestId("ticket-0003")).toBeOnTheScreen();
  });
  it("no connection: 'No connection', not a broken screen", async () => {
    const s = server(boardAt(), { "GET /api/kitchen/orders": { throws: new TypeError("Network request failed") } });
    await renderApp(<BoardScreen />, { server: s });
    expect(await screen.findByText("No connection")).toBeOnTheScreen();
  });
});

describe("how often the kitchen board asks for new orders (the platform admin's setting for the kitchen app)", () => {
  const asks = (srv: ReturnType<typeof fakeServer>) => srv.to("GET", "/api/kitchen/orders").length;
  const wait = async (ms: number) => { await act(async () => { await jest.advanceTimersByTimeAsync(ms); }); };
  const run = async (headers: Record<string, string> | undefined, body: (srv: ReturnType<typeof fakeServer>) => Promise<void>) => {
    jest.useFakeTimers();
    try {
      const srv = fakeServer({ "GET /api/kitchen/orders": { json: boardAt(), headers } });
      await renderApp(<BoardScreen />, { server: srv });
      await wait(100);
      await body(srv);
    } finally { jest.useRealTimers(); }
  };

  it("every 8 seconds until the server says otherwise (it used to be 5)", async () => {
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
