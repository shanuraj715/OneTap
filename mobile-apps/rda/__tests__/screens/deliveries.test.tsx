import { act, fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { Linking, Vibration } from "react-native";
import { DeliveriesScreen } from "@/screens/DeliveriesScreen";
import { toasts } from "@/ui";
import { fakeServer, fx, renderApp, type Handler } from "../../test/harness";

const messages = () => toasts.store.getState().toasts.map((t) => t.message);
/** the recorded list; its orders are 0001 and 0002 (on the way), 0003 (ready to pick up), 0004 (being made) */
const list = (extra: unknown[] = [], keep?: (d: { orderNumber: string }) => boolean) => {
  const l = fx("deliveries");
  if (keep) l.deliveries = l.deliveries.filter(keep);
  l.deliveries = [...l.deliveries, ...extra];
  return l;
};
const server = (l = list(), more: Record<string, Handler> = {}) => fakeServer({ "GET /api/rider/deliveries": { json: l }, ...more });
const idOf = (n: string) => fx("deliveries").deliveries.find((d: { orderNumber: string }) => d.orderNumber === n).id as string;

let vibrate: jest.SpyInstance;
let open: jest.SpyInstance;
beforeEach(() => {
  toasts.clear();
  vibrate = jest.spyOn(Vibration, "vibrate").mockImplementation(() => undefined);
  open = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
});
afterEach(() => { vibrate.mockRestore(); open.mockRestore(); });

describe("the list", () => {
  it("shows each delivery with its address, landmark, distance, customer, what is in the bag and how it was paid", async () => {
    await renderApp(<DeliveriesScreen />, { server: server() });
    const card = within(await screen.findByTestId("delivery-0003"));
    expect(card.getByText("#0003")).toBeOnTheScreen();
    expect(card.getByText("Ready to pick up")).toBeOnTheScreen();
    expect(card.getByText(/Flat 4B, Tower C, Sector 62, Noida/)).toBeOnTheScreen();
    expect(card.getByText(/\d(\.\d)? km from the restaurant/)).toBeOnTheScreen();
    expect(card.getByText("3 × Masala Chai")).toBeOnTheScreen();
    expect(card.getByText("3 items in the bag")).toBeOnTheScreen();
    expect(card.getByText("Paid online")).toBeOnTheScreen();
    const withLandmark = within(screen.getByTestId("delivery-0001"));
    expect(withLandmark.getByText("Near Opposite the metro station")).toBeOnTheScreen();
    expect(withLandmark.getByText(/Neha Gupta/)).toBeOnTheScreen();
  });

  it("on the way first, then ready, then still being made", async () => {
    await renderApp(<DeliveriesScreen />, { server: server() });
    await screen.findByTestId("delivery-0001");
    const cards = screen.getAllByTestId(/^delivery-\d+$/).map((n) => n.props.testID);
    expect(cards).toEqual(["delivery-0001", "delivery-0002", "delivery-0003", "delivery-0004"]);
    expect(screen.getByText("4 to do")).toBeOnTheScreen();
  });

  it("an order the kitchen is still making has no button, only a line saying so", async () => {
    await renderApp(<DeliveriesScreen />, { server: server() });
    const card = within(await screen.findByTestId("delivery-0004"));
    expect(card.getByText("Being prepared")).toBeOnTheScreen();
    expect(screen.getByTestId("waiting-0004")).toBeOnTheScreen();
    expect(screen.queryByTestId("action-0004")).toBeNull();
  });

  it("nothing handed over yet says so", async () => {
    await renderApp(<DeliveriesScreen />, { server: server(list([], () => false)) });
    expect(await screen.findByText("No deliveries right now")).toBeOnTheScreen();
  });

  it("can't load: says so, with Try again", async () => {
    const s = fakeServer({ "GET /api/rider/deliveries": { status: 500, json: { error: "The server had a problem." } } });
    await renderApp(<DeliveriesScreen />, { server: s });
    expect(await screen.findByText("Can't load your deliveries")).toBeOnTheScreen();
    s.set("GET /api/rider/deliveries", { json: list() });
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByTestId("delivery-0003")).toBeOnTheScreen();
  });
});

describe("Navigate, Call and WhatsApp use the phone's own apps", () => {
  it("Navigate opens the maps app at the customer's pin", async () => {
    await renderApp(<DeliveriesScreen />, { server: server() });
    await fireEvent.press(await screen.findByTestId("navigate-0003"));
    const d = fx("deliveries").deliveries.find((x: { orderNumber: string }) => x.orderNumber === "0003");
    await waitFor(() => expect(open).toHaveBeenCalledWith(expect.stringContaining(`destination=${d.address.lat},${d.address.lng}`)));
    expect(open.mock.calls[0]![0]).toMatch(/^https:\/\/www\.google\.com\/maps\/dir/);
  });
  it("Navigate says so when no maps app can open", async () => {
    open.mockRejectedValue(new Error("none"));
    await renderApp(<DeliveriesScreen />, { server: server() });
    await fireEvent.press(await screen.findByTestId("navigate-0003"));
    await waitFor(() => expect(messages().join(" ")).toMatch(/Couldn't open a maps app/));
  });
  it("Call dials the customer's number", async () => {
    await renderApp(<DeliveriesScreen />, { server: server() });
    await fireEvent.press(await screen.findByTestId("call-0003"));
    const d = fx("deliveries").deliveries.find((x: { orderNumber: string }) => x.orderNumber === "0003");
    await waitFor(() => expect(open).toHaveBeenCalledWith(`tel:${d.customer.phone}`));
  });
  it("WhatsApp opens a chat with the customer, with an 'I'm outside' message ready", async () => {
    await renderApp(<DeliveriesScreen />, { server: server() });
    await fireEvent.press(await screen.findByTestId("whatsapp-0003"));
    await waitFor(() => expect(open).toHaveBeenCalled());
    const url = decodeURIComponent(open.mock.calls[0]![0]);
    expect(url).toMatch(/^https:\/\/wa\.me\/91\d{10}\?text=Hello Karan.*order #0003/);
  });
  it("a customer with no number has no Call or WhatsApp", async () => {
    const l = list();
    l.deliveries[2].customer.phone = "";
    await renderApp(<DeliveriesScreen />, { server: server(l) });
    expect(await screen.findByTestId("call-0003")).toBeDisabled();
    expect(screen.getByTestId("whatsapp-0003")).toBeDisabled();
  });
});

describe("Picked up", () => {
  it("tells the server (this delivery, picked up) and asks for the list again", async () => {
    const s = server();
    await renderApp(<DeliveriesScreen />, { server: s });
    await fireEvent.press(await screen.findByTestId("action-0003"));
    await waitFor(() => expect(s.to("POST", /\/pickup$/)).toHaveLength(1));
    expect(s.to("POST", /\/pickup$/)[0]!.path).toBe(`/api/rider/deliveries/${idOf("0003")}/pickup`);
    await waitFor(() => expect(s.to("GET", "/api/rider/deliveries").length).toBeGreaterThan(1));
    await waitFor(() => expect(messages()).toContain("#0003 is on its way to the customer"));
  });
  it("the token travels with the call (the rider's own, nothing else)", async () => {
    const s = server();
    await renderApp(<DeliveriesScreen />, { server: s });
    await fireEvent.press(await screen.findByTestId("action-0003"));
    await waitFor(() => expect(s.to("POST", /\/pickup$/)).toHaveLength(1));
    expect(s.to("POST", /\/pickup$/)[0]!.headers.authorization).toMatch(/^Bearer TEST-TOKEN-RIDER/);
    expect(s.to("POST", /\/pickup$/)[0]!.headers["x-app-id"]).toBe("rda");
  });
  it("when the server refuses, the rider is told why and the card stays", async () => {
    const s = server(list(), { "POST /api/rider/deliveries/:id/pickup": { status: 409, json: fx("error-not-ready") } });
    await renderApp(<DeliveriesScreen />, { server: s });
    await fireEvent.press(await screen.findByTestId("action-0003"));
    await waitFor(() => expect(messages()).toContain("This order isn't ready yet. The kitchen is still making it."));
    expect(screen.getByTestId("delivery-0003")).toBeOnTheScreen();
  });
});

describe("Delivered, with the customer's code", () => {
  const ask = async (s = server()) => {
    await renderApp(<DeliveriesScreen />, { server: s });
    await fireEvent.press(await screen.findByTestId("action-0002"));
    return s;
  };
  it("an order with a code opens a sheet asking for the 4 digits, and sends nothing yet", async () => {
    const s = await ask();
    const sheet = within(await screen.findByTestId("code-sheet"));
    expect(sheet.getByText("Deliver #0002")).toBeOnTheScreen();
    expect(sheet.getByText(/Ask the customer for the 4-digit delivery code/)).toBeOnTheScreen();
    expect(s.to("POST", /\/delivered$/)).toHaveLength(0);
  });
  it("only digits, at most four", async () => {
    await ask();
    await fireEvent.changeText(await screen.findByTestId("code-input"), "48a2 19");
    expect(screen.getByTestId("code-input").props.value).toBe("4821");
  });
  it("a code that isn't 4 digits is not sent (it would only use up one of the few tries)", async () => {
    const s = await ask();
    await fireEvent.changeText(await screen.findByTestId("code-input"), "48");
    await fireEvent.press(screen.getByTestId("code-confirm"));
    expect(await screen.findByText("The code is 4 digits.")).toBeOnTheScreen();
    expect(s.to("POST", /\/delivered$/)).toHaveLength(0);
  });
  it("the right code is sent with the delivery, and the sheet closes", async () => {
    const s = await ask();
    await fireEvent.changeText(await screen.findByTestId("code-input"), "4821");
    await fireEvent.press(screen.getByTestId("code-confirm"));
    await waitFor(() => expect(s.to("POST", /\/delivered$/)).toHaveLength(1));
    expect(s.to("POST", /\/delivered$/)[0]).toMatchObject({ path: `/api/rider/deliveries/${idOf("0002")}/delivered`, body: { code: "4821" } });
    await waitFor(() => expect(screen.queryByTestId("code-sheet")).toBeNull());
    await waitFor(() => expect(messages()).toContain("#0002 delivered"));
  });
  it("a wrong code shows the server's sentence (with the tries left) inside the sheet, which stays open", async () => {
    const s = server(list(), { "POST /api/rider/deliveries/:id/delivered": { status: 409, json: fx("error-code-wrong") } });
    await ask(s);
    await fireEvent.changeText(await screen.findByTestId("code-input"), "0000");
    await fireEvent.press(screen.getByTestId("code-confirm"));
    expect(await screen.findByText("That code isn't right. 4 tries left.")).toBeOnTheScreen();
    expect(screen.getByTestId("code-sheet")).toBeOnTheScreen();
  });
  it("when the code is locked it says to call the store", async () => {
    const s = server(list(), { "POST /api/rider/deliveries/:id/delivered": { status: 429, json: fx("error-code-locked") } });
    await ask(s);
    await fireEvent.changeText(await screen.findByTestId("code-input"), "9999");
    await fireEvent.press(screen.getByTestId("code-confirm"));
    expect(await screen.findByText(/Call the store: they can mark this order delivered/)).toBeOnTheScreen();
  });
  it("an order WITHOUT a code is delivered with one tap, no sheet", async () => {
    const l = list();
    l.deliveries.find((d: { orderNumber: string }) => d.orderNumber === "0001").needsCode = false;
    const s = server(l);
    await renderApp(<DeliveriesScreen />, { server: s });
    await fireEvent.press(await screen.findByTestId("action-0001"));
    await waitFor(() => expect(s.to("POST", /\/delivered$/)).toHaveLength(1));
    expect(s.to("POST", /\/delivered$/)[0]!.body).toEqual({});
    expect(screen.queryByTestId("code-sheet")).toBeNull();
  });
  it("the card of an order on the way reminds the rider to ask for the code", async () => {
    await renderApp(<DeliveriesScreen />, { server: server() });
    expect(within(await screen.findByTestId("delivery-0002")).getByText("Ask for the customer's 4-digit code")).toBeOnTheScreen();
  });
});

describe("a new delivery is handed to the rider", () => {
  const arrival = () => {
    const base = fx("deliveries").deliveries[2];
    return { ...base, id: "NEW-DELIVERY-1", orderNumber: "0099", status: "ready", assignedAt: new Date().toISOString() };
  };
  it("the deliveries already there when the app opened are not announced", async () => {
    await renderApp(<DeliveriesScreen />, { server: server() });
    await screen.findByTestId("delivery-0003");
    expect(vibrate).not.toHaveBeenCalled();
    expect(screen.queryByText("NEW")).toBeNull();
  });
  it("a later one vibrates, says which, and is marked NEW until the rider acts on it", async () => {
    const s = server();
    const { runtime } = await renderApp(<DeliveriesScreen />, { server: s });
    await screen.findByTestId("delivery-0003");
    s.set("GET /api/rider/deliveries", { json: list([arrival()]) });
    await act(async () => { await runtime.queryClient.invalidateQueries({ queryKey: ["deliveries"] }); });
    expect(await screen.findByTestId("delivery-0099")).toBeOnTheScreen();
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(messages()).toContain("New delivery #0099");
    expect(within(screen.getByTestId("delivery-0099")).getByText("NEW")).toBeOnTheScreen();
    await act(async () => { await runtime.queryClient.invalidateQueries({ queryKey: ["deliveries"] }); });
    expect(vibrate).toHaveBeenCalledTimes(1); // not again for the same one
  });
  it("with the alert switched off it still appears, quietly", async () => {
    const s = server();
    const { runtime } = await renderApp(<DeliveriesScreen />, { server: s });
    await screen.findByTestId("delivery-0003");
    await act(async () => { await runtime.settings.set({ alerts: false }); });
    s.set("GET /api/rider/deliveries", { json: list([arrival()]) });
    await act(async () => { await runtime.queryClient.invalidateQueries({ queryKey: ["deliveries"] }); });
    expect(await screen.findByTestId("delivery-0099")).toBeOnTheScreen();
    expect(vibrate).not.toHaveBeenCalled();
  });
  it("the bell in the heading switches the alert", async () => {
    const { runtime } = await renderApp(<DeliveriesScreen />, { server: server() });
    await screen.findByTestId("delivery-0003"); // (the list has loaded: the heading is not about to be swapped while it is pressed)
    await fireEvent.press(screen.getByTestId("alert-toggle"));
    await waitFor(() => expect(runtime.settings.store.getState().alerts).toBe(false));
  });
});

describe("how often it asks for new deliveries (the platform admin's setting for the delivery app)", () => {
  const asks = (srv: ReturnType<typeof fakeServer>) => srv.to("GET", "/api/rider/deliveries").length;
  const wait = async (ms: number) => { await act(async () => { await jest.advanceTimersByTimeAsync(ms); }); };
  const run = async (headers: Record<string, string> | undefined, body: (srv: ReturnType<typeof fakeServer>) => Promise<void>) => {
    jest.useFakeTimers();
    try {
      const srv = fakeServer({ "GET /api/rider/deliveries": { json: list(), headers } });
      await renderApp(<DeliveriesScreen />, { server: srv });
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

  it("every 15 seconds when the admin set 15: not 8, not 10", async () => {
    await run({ "x-refresh-seconds": "15" }, async (srv) => {
      const first = asks(srv);
      await wait(14_000);
      expect(asks(srv)).toBe(first);
      await wait(1_500);
      expect(asks(srv)).toBe(first + 1);
      await wait(15_000);
      expect(asks(srv)).toBe(first + 2);
    });
  });

  it("follows a change made while the app is open: told 30 later, it slows down", async () => {
    await run({ "x-refresh-seconds": "15" }, async (srv) => {
      srv.set("GET /api/rider/deliveries", { json: list(), headers: { "x-refresh-seconds": "30" } });
      await wait(15_500); // the next ask (still on the old 15 s timer) brings the new number
      const afterNew = asks(srv);
      await wait(20_000);
      expect(asks(srv)).toBe(afterNew);
      await wait(11_000);
      expect(asks(srv)).toBe(afterNew + 1);
    });
  });
});
