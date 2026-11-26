import { act, fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { AccountScreen } from "@/screens/AccountScreen";
import { OrdersScreen } from "@/screens/OrdersScreen";
import { toasts } from "@/ui";
import { fakeServer, fx, renderApp } from "../../test/harness";

const T1 = (fx("tables-seated").tables as Array<{ id: string; number: string }>).find((t) => t.number === "T1")!.id;
beforeEach(() => toasts.clear());

describe("the orders list", () => {
  it("shows the orders still in progress first, newest on top, with the table, status, payment and total", async () => {
    await renderApp(<OrdersScreen />);
    expect(await screen.findByTestId("order-0002")).toBeOnTheScreen();
    const one = within(screen.getByTestId("order-0001"));
    expect(one.getByText("Accepted")).toBeOnTheScreen();
    expect(one.getByText("Not paid yet")).toBeOnTheScreen();
    expect(one.getByText("₹340")).toBeOnTheScreen();
    expect(one.getByText("Table T1")).toBeOnTheScreen();
    expect(one.getByText("Taken by Asha (waiter)")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "In progress, 2" })).toBeOnTheScreen();
  });

  it("finished orders are under 'All', not in the default view", async () => {
    const orders = fx("orders-list");
    orders.orders.find((o: { orderNumber: string }) => o.orderNumber === "0002").status = "completed";
    await renderApp(<OrdersScreen />, { server: fakeServer({ "GET /api/orders": { json: orders } }) });
    await screen.findByTestId("order-0001");
    expect(screen.queryByTestId("order-0002")).toBeNull(); // finished: not in the default view
    expect(screen.queryByTestId("order-0003")).toBeNull(); // cancelled (a voided table): not in progress either
    await fireEvent.press(screen.getByTestId("orders-all"));
    expect(screen.getByTestId("order-0002")).toBeOnTheScreen();
    expect(within(screen.getByTestId("order-0002")).getByText("Served")).toBeOnTheScreen();
  });

  it("tapping an order opens its table", async () => {
    const onOpen = jest.fn();
    await renderApp(<OrdersScreen onOpenTable={onOpen} />);
    await fireEvent.press(await screen.findByTestId("order-0001"));
    expect(onOpen).toHaveBeenCalledWith(T1);
  });

  it("nothing in progress: says so, and offers the full list", async () => {
    const orders = fx("orders-list");
    orders.orders.forEach((o: { status: string }) => { o.status = "completed"; });
    await renderApp(<OrdersScreen />, { server: fakeServer({ "GET /api/orders": { json: orders } }) });
    expect(await screen.findByText("No orders in progress")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Show all 3" }));
    expect(screen.getByTestId("order-0001")).toBeOnTheScreen();
  });

  it("no orders at all", async () => {
    await renderApp(<OrdersScreen />, { server: fakeServer({ "GET /api/orders": { json: { orders: [] } } }) });
    expect(await screen.findByText("No orders in progress")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: /Show all/ })).toBeNull();
  });

  it("cannot be loaded: a message and a retry that works", async () => {
    const server = fakeServer({ "GET /api/orders": { throws: new TypeError("Network request failed") } });
    await renderApp(<OrdersScreen />, { server });
    expect(await screen.findByText("No connection")).toBeOnTheScreen();
    server.set("GET /api/orders", { json: fx("orders-list") });
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByTestId("order-0001")).toBeOnTheScreen();
  });

  it("a later refresh that fails keeps the list and says it may be old", async () => {
    const server = fakeServer();
    const { runtime } = await renderApp(<OrdersScreen />, { server });
    await screen.findByTestId("order-0001");
    server.set("GET /api/orders", { throws: new TypeError("Network request failed") });
    await act(async () => { await runtime.queryClient.refetchQueries({ queryKey: ["orders"] }); });
    expect(await screen.findByTestId("orders-stale")).toBeOnTheScreen();
    expect(screen.getByTestId("order-0001")).toBeOnTheScreen();
  });
});

describe("the account page", () => {
  it("shows who is signed in, their role, the outlet and the app's version", async () => {
    await renderApp(<AccountScreen />);
    expect(screen.getByTestId("account-name")).toHaveTextContent("Asha (waiter)");
    expect(screen.getByText("waiter@sandbox.test")).toBeOnTheScreen();
    expect(screen.getByText("Cashier / Staff")).toBeOnTheScreen();
    expect(screen.getByText("Rasoi Pulse OMA")).toBeOnTheScreen();
    expect(screen.getByText("Order Management App")).toBeOnTheScreen();
    expect(screen.getByText("v-26.11.26-001")).toBeOnTheScreen();
    expect(screen.getByText("Noida · Rasoi Pulse Sandbox".replace("Rasoi Pulse Sandbox", fx("outlets").outlets[0].brandName))).toBeOnTheScreen();
    expect(screen.queryByTestId("outlet-dropdown")).toBeNull(); // one outlet: nothing to choose
  });

  it("with more than one outlet, the waiter picks which one the app works for, and it is remembered", async () => {
    const outlets = fx("outlets");
    outlets.outlets.push({ ...outlets.outlets[0], _id: "OUT-2", name: "Delhi", slug: "delhi" });
    const { runtime } = await renderApp(<AccountScreen />, { server: fakeServer({ "GET /api/outlets": { json: outlets } }) });
    await fireEvent.press(screen.getByTestId("outlet-dropdown"));
    await fireEvent.press(screen.getByRole("menuitem", { name: /Delhi/ }));
    await waitFor(() => expect(runtime.session.getState().outletId).toBe("OUT-2"));
    await waitFor(() => expect(toasts.store.getState().toasts.map((t) => t.message)).toContain("Now working at Delhi"));
  });

  it("signing out asks first; yes ends the session on the server and forgets everything on the phone", async () => {
    const server = fakeServer();
    const { runtime, storage } = await renderApp(<AccountScreen />, { server });
    await act(async () => { runtime.drafts.getState().setCustomer("t9", { phone: "9" }); }); // not an order: no lines
    await fireEvent.press(screen.getByTestId("sign-out"));
    expect(screen.getByText("You will need your email and password to sign in again.")).toBeOnTheScreen();
    expect(server.to("POST", "/api/auth/logout")).toHaveLength(0);
    await fireEvent.press(screen.getByRole("button", { name: "Yes, sign out" }));
    await waitFor(() => expect(runtime.session.getState().status).toBe("signed-out"));
    await act(async () => undefined);
    expect(server.to("POST", "/api/auth/logout")).toHaveLength(1);
    expect(storage.clear).toHaveBeenCalled();
    expect(runtime.drafts.getState().drafts).toEqual({}); // the next person does not see this person's orders
  });

  it("Cancel keeps the person signed in", async () => {
    const { runtime } = await renderApp(<AccountScreen />);
    await fireEvent.press(screen.getByTestId("sign-out"));
    await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
    expect(runtime.session.getState().status).toBe("signed-in");
  });

  it("warns when orders were not sent yet", async () => {
    const { runtime } = await renderApp(<AccountScreen />);
    const line = { key: "k", itemId: "i", name: "Chai", foodType: "veg" as const, modifierOptionIds: [], modifierLabels: [], unitPrice: 3000, quantity: 1 };
    await act(async () => { runtime.drafts.getState().add("t1", line); runtime.drafts.getState().add("t2", line); });
    await fireEvent.press(screen.getByTestId("sign-out"));
    expect(await screen.findByText("You have 2 orders that were not sent yet. They will be lost.")).toBeOnTheScreen();
  });

  it("the data of one person is gone when the next signs in (nothing cached is shown to them)", async () => {
    const server = fakeServer();
    const { runtime } = await renderApp(<OrdersScreen />, { server });
    await screen.findByTestId("order-0001");
    expect(runtime.queryClient.getQueryCache().getAll().length).toBeGreaterThan(0);
    await act(async () => { await runtime.session.getState().signOut(); });
    // nothing from the first person remains (a screen still on display may leave an empty, switched-off placeholder)
    expect(runtime.queryClient.getQueryCache().getAll().filter((q) => q.state.data !== undefined)).toHaveLength(0);
    expect(server.to("GET", "/api/orders")).toHaveLength(1); // and no new call is made while nobody is signed in
  });
});
