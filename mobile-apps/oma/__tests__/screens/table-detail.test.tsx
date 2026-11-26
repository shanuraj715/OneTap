import { act, fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { TableDetail } from "@/screens/TableDetail";
import { toasts } from "@/ui";
import { fakeServer, fx, renderApp } from "../../test/harness";

const board = fx("tables-seated").tables as Array<{ id: string; number: string }>;
const idOf = (number: string) => board.find((t) => t.number === number)!.id;
const T1 = idOf("T1"); // seated, Mehta family, unpaid, two orders
const T2 = idOf("T2"); // free
const SESSION = (fx("sessions-active").sessions as Array<{ id: string; tableId: string }>).find((s) => s.tableId === T1)!.id;
const messages = () => toasts.store.getState().toasts.map((t) => `${t.tone}:${t.message}`);
const waiter = () => fx("auth-app-login");
/** the same waiter, minus one permission — as the sign-in answer AND as "who am I" (the app trusts the latter) */
const without = (permission: string) => {
  const a = waiter();
  a.user.permissions = a.user.permissions.filter((p: string) => p !== permission);
  return { "POST /api/auth/app-login": { json: a }, "GET /api/auth/me": { json: { user: a.user } } };
};
const paidSessions = () => { const s = fx("sessions-active"); s.sessions[0].allPaid = true; s.sessions[0].unpaidTotal = 0; return s; };

beforeEach(() => toasts.clear());

describe("a seated table", () => {
  it("shows the party, the bill and every order on this table", async () => {
    await renderApp(<TableDetail tableId={T1} onTakeOrder={() => undefined} />);
    expect(await screen.findByText("Table T1")).toBeOnTheScreen();
    expect(screen.getByText("Seated")).toBeOnTheScreen();
    const card = within(screen.getByTestId("session-card"));
    expect(card.getByText("Mehta family")).toBeOnTheScreen();
    expect(card.getByText("9876543210")).toBeOnTheScreen();
    expect(card.getByTestId("tab-total")).toHaveTextContent("₹340");
    expect(card.getByTestId("unpaid-total")).toHaveTextContent("₹340");
    expect(await screen.findByTestId("order-0001")).toBeOnTheScreen();
    expect(screen.getByTestId("order-0002")).toBeOnTheScreen();
    expect(screen.getByText("Orders (2)")).toBeOnTheScreen();
    expect(within(screen.getByTestId("order-0001")).getByText("Chicken Kurkure Momos")).toBeOnTheScreen();
  });

  it("'Add more items' goes to taking an order for THIS table", async () => {
    const onTake = jest.fn();
    await renderApp(<TableDetail tableId={T1} onTakeOrder={onTake} />);
    await fireEvent.press(await screen.findByRole("button", { name: "Add more items" }));
    expect(onTake).toHaveBeenCalledWith(T1);
  });

  it("confirming payment asks first, then tells the server, then the table can be freed", async () => {
    const server = fakeServer();
    await renderApp(<TableDetail tableId={T1} onTakeOrder={() => undefined} />, { server });
    await screen.findByTestId("session-card");
    expect(screen.getByTestId("close-table")).toBeDisabled();
    expect(screen.getByText("To free the table, confirm the payment first.")).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId("confirm-payment"));
    expect(screen.getByText(/Mehta family paid ₹340 for table T1/)).toBeOnTheScreen();
    expect(server.to("POST", /confirm-payment/)).toHaveLength(0); // nothing sent until they say yes

    server.set("GET /api/tables/sessions/active", { json: paidSessions() });
    await fireEvent.press(screen.getByRole("button", { name: "Yes, paid" }));
    await waitFor(() => expect(server.to("POST", `/api/tables/sessions/${SESSION}/confirm-payment`)).toHaveLength(1));
    expect(messages()).toContain("ok:Payment confirmed for table T1");
    await waitFor(() => expect(screen.getByTestId("unpaid-total")).toHaveTextContent("Paid"));
    expect(screen.queryByTestId("confirm-payment")).toBeNull();
    expect(screen.getByTestId("close-table")).toBeEnabled();

    await fireEvent.press(screen.getByTestId("close-table"));
    await waitFor(() => expect(server.to("POST", `/api/tables/sessions/${SESSION}/close`)).toHaveLength(1));
    expect(messages()).toContain("ok:Table T1 is free again");
  });

  it("'Cancel' on the payment question sends nothing", async () => {
    const server = fakeServer();
    await renderApp(<TableDetail tableId={T1} onTakeOrder={() => undefined} />, { server });
    await fireEvent.press(await screen.findByTestId("confirm-payment"));
    await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
    expect(server.to("POST", /confirm-payment/)).toHaveLength(0);
  });

  it("moves the party to a free table, and offers only free ones", async () => {
    const server = fakeServer();
    await renderApp(<TableDetail tableId={T1} onTakeOrder={() => undefined} />, { server });
    await fireEvent.press(await screen.findByTestId("move-table"));
    expect(screen.getByTestId("move-to-T2")).toBeOnTheScreen(); // the party's own area (Ground floor) is open
    await fireEvent.press(screen.getByTestId("move-zone-toggle-Terrace")); // the other area is closed until opened
    expect(screen.getByTestId("move-to-T3")).toBeOnTheScreen();
    expect(screen.queryByTestId("move-to-T1")).toBeNull(); // not the table they are on
    expect(screen.getByTestId("move-confirm")).toBeDisabled(); // nothing picked yet
    await fireEvent.press(screen.getByTestId("move-to-T2"));
    await fireEvent.press(screen.getByRole("button", { name: "Move to Table T2" }));
    await waitFor(() => expect(server.to("POST", `/api/tables/sessions/${SESSION}/move`)).toHaveLength(1));
    expect(server.to("POST", /move/)[0]!.body).toEqual({ toTableId: T2 });
    expect(messages()).toContain("ok:Moved to table T2");
  });

  it("when another waiter took that table first, the server's own words are shown and the sheet stays open", async () => {
    const server = fakeServer({ "POST /api/tables/sessions/:id/move": { status: 409, json: { error: "Table T2 is already occupied" } } });
    await renderApp(<TableDetail tableId={T1} onTakeOrder={() => undefined} />, { server });
    await fireEvent.press(await screen.findByTestId("move-table"));
    await fireEvent.press(screen.getByTestId("move-to-T2"));
    await fireEvent.press(screen.getByTestId("move-confirm"));
    await waitFor(() => expect(messages()).toContain("danger:Table T2 is already occupied"));
    expect(screen.getByTestId("move-confirm")).toBeOnTheScreen();
  });

  it("cancelling a table warns about the open orders, sends the reason, and frees the table", async () => {
    const server = fakeServer();
    await renderApp(<TableDetail tableId={T1} onTakeOrder={() => undefined} />, { server });
    await fireEvent.press(await screen.findByTestId("void-table"));
    expect(screen.getByText(/1 open order will be cancelled and the kitchen told/)).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId("void-reason"), "  Customer left  ");
    await fireEvent.press(screen.getByTestId("void-confirm"));
    await waitFor(() => expect(server.to("POST", `/api/tables/sessions/${SESSION}/void`)).toHaveLength(1));
    expect(server.to("POST", /void/)[0]!.body).toEqual({ reason: "Customer left" });
    expect(messages()).toContain("ok:Table T1 was cancelled");
  });

  it("a person without the table-management permission can take orders but sees no payment, move, free or cancel buttons", async () => {
    const server = fakeServer(without("table:manage"));
    await renderApp(<TableDetail tableId={T1} onTakeOrder={() => undefined} />, { server });
    expect(await screen.findByRole("button", { name: "Add more items" })).toBeOnTheScreen();
    for (const id of ["confirm-payment", "move-table", "close-table", "void-table"]) expect(screen.queryByTestId(id)).toBeNull();
  });

  it("a server error on payment is shown, and nothing pretends it worked", async () => {
    const server = fakeServer({ "POST /api/tables/sessions/:id/confirm-payment": { status: 404, json: { error: "No open session here" } } });
    await renderApp(<TableDetail tableId={T1} onTakeOrder={() => undefined} />, { server });
    await fireEvent.press(await screen.findByTestId("confirm-payment"));
    await fireEvent.press(screen.getByRole("button", { name: "Yes, paid" }));
    await waitFor(() => expect(messages()).toContain("danger:No open session here"));
    expect(messages().some((m) => m.startsWith("ok:"))).toBe(false);
  });
});

describe("a free table", () => {
  it("offers 'Take order' and nothing for a party that is not there", async () => {
    const onTake = jest.fn();
    await renderApp(<TableDetail tableId={T2} onTakeOrder={onTake} />);
    expect(await screen.findByText("Table T2")).toBeOnTheScreen();
    expect(screen.getByText(/Nobody is sitting here/)).toBeOnTheScreen();
    expect(screen.queryByTestId("session-card")).toBeNull();
    for (const id of ["confirm-payment", "move-table", "close-table", "void-table"]) expect(screen.queryByTestId(id)).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Take order" }));
    expect(onTake).toHaveBeenCalledWith(T2);
  });
});

describe("a table that is not there", () => {
  it("says so (it may have been removed while the waiter was looking)", async () => {
    await renderApp(<TableDetail tableId="nope" onTakeOrder={() => undefined} />);
    expect(await screen.findByText("Table not found")).toBeOnTheScreen();
  });
  it("shows a loader, then an error with a retry when the board cannot load", async () => {
    const server = fakeServer({ "GET /api/tables": { throws: new TypeError("Network request failed") } });
    await renderApp(<TableDetail tableId={T1} onTakeOrder={() => undefined} />, { server });
    expect(await screen.findByText("No connection")).toBeOnTheScreen();
    await act(async () => undefined);
  });
});
