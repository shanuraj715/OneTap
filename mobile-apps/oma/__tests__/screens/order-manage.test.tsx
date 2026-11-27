import { Linking } from "react-native";
import { fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { OrderDetail } from "@/screens/OrderDetail";
import { OrdersScreen } from "@/screens/OrdersScreen";
import { toasts } from "@/ui";
import { fakeServer, fx, renderApp } from "../../test/harness";

type O = { id: string; orderNumber: string; channel: string; status: string; tableId: string | null };
const mixed = fx("orders-mixed").orders as O[];
const byNo = (n: string) => mixed.find((o) => o.orderNumber === n)!;
const TAKE = byNo("0004"), READY = byNo("0005"), OUT = byNo("0006"), DINE = byNo("0001"), VOIDED = byNo("0003");
const messages = () => toasts.store.getState().toasts.map((t) => `${t.tone}:${t.message}`);
beforeEach(() => toasts.clear());

/** the waiter, with these permissions as the sign-in answer AND "who am I" */
const as = (...extra: string[]) => (only?: string[]) => {
  const a = fx("auth-app-login");
  a.user.permissions = only ?? [...a.user.permissions, ...extra];
  return { "POST /api/auth/app-login": { json: a }, "GET /api/auth/me": { json: { user: a.user } } };
};
const owner = as("order:delete");
/** can sign in (order:create + table:read) but may not change orders: no order:update, no printing */
const readOnly = () => { const a = fx("auth-app-login"); return as()(a.user.permissions.filter((p: string) => !["order:update", "print:job"].includes(p))); };
/** a button of the question pop-up: it is drawn last, and the screen's own button of the same name is behind it */
const inDialog = (name: string) => { const all = screen.getAllByRole("button", { name }); return all[all.length - 1]!; };
const server = (more: Record<string, any> = {}, who: Record<string, any> = {}) => fakeServer({
  "GET /api/orders": { json: fx("orders-mixed") },
  "PATCH /api/orders/:id/status": { json: fx("order-status-accepted") },
  "PATCH /api/orders/:id/status/manual": { json: fx("order-status-manual") },
  "PATCH /api/orders/:id/rider": { json: fx("order-rider-sendout") },
  "GET /api/riders": { json: fx("riders") },
  "GET /api/printing/printers": { json: fx("printers") },
  "POST /api/printing/orders/:id/print": { json: fx("print-order") },
  "DELETE /api/orders/:id": { json: fx("order-deleted") },
  ...who, ...more,
});

describe("the orders list: every type, found and narrowed", () => {
  it("shows dine-in, takeaway and delivery orders in progress — with who they are for, the rider, and the next step", async () => {
    await renderApp(<OrdersScreen />, { server: server() });
    expect(await screen.findByTestId("order-0004")).toBeOnTheScreen();
    expect(screen.queryByTestId("order-0003")).toBeNull();                       // cancelled: not in progress
    expect(within(screen.getByTestId("order-0004")).getByText("Takeaway")).toBeOnTheScreen();
    expect(within(screen.getByTestId("order-0004")).getByText("Priya N.")).toBeOnTheScreen();
    expect(within(screen.getByTestId("order-0005")).getByText("Rider Ramesh")).toBeOnTheScreen();
    expect(within(screen.getByTestId("order-0005")).getByText("Ready")).toBeOnTheScreen();
    // the big button on each card is the next step, in words of that kind of order
    expect(screen.getByTestId("advance-0004")).toHaveTextContent("Accept");
    expect(screen.getByTestId("advance-0005")).toHaveTextContent("Send out");
    expect(screen.getByTestId("advance-0006")).toHaveTextContent("Mark delivered");
    expect(screen.getByTestId("advance-0001")).toHaveTextContent("Start preparing");
  });

  it("a card stays short: no list of dishes in it, just an 'Items (N)' button (and a marker when there is a note)", async () => {
    await renderApp(<OrdersScreen />, { server: server() });
    await screen.findByTestId("order-0004");
    const take = within(screen.getByTestId("order-0004"));
    expect(take.queryByText(/Veg Steamed Momos/)).toBeNull();                   // the dishes are not written out in the card
    expect(take.queryByText(/Masala Chai/)).toBeNull();
    expect(take.getByTestId("items-0004")).toHaveTextContent("Items (3)");     // 2 + 1 portions
    expect(take.getByText("Has a note")).toBeOnTheScreen();                      // "No onions please" — the kitchen must not miss it
    expect(within(screen.getByTestId("order-0006")).getByTestId("items-0006")).toHaveTextContent("Items (3)");
    expect(within(screen.getByTestId("order-0006")).queryByText("Has a note")).toBeNull();
    expect(screen.queryByTestId("items-sheet")).toBeNull();
  });

  it("'Items' opens the list: every dish with its size, add-ons and notes, the order's note, the total — and closes again", async () => {
    await renderApp(<OrdersScreen />, { server: server() });
    await fireEvent.press(await screen.findByTestId("items-0004"));
    const sheet = within(await screen.findByTestId("items-sheet"));
    expect(sheet.getByText("Order #0004 — 3 items")).toBeOnTheScreen();
    expect(sheet.getByText("Veg Steamed Momos · Half (4 pcs)")).toBeOnTheScreen();
    expect(sheet.getByText("Masala Chai")).toBeOnTheScreen();
    expect(sheet.getByText("No onions please")).toBeOnTheScreen();
    expect(sheet.getByText("Total")).toBeOnTheScreen();
    expect(sheet.getByText("Takeaway")).toBeOnTheScreen();
    // a different order shows ITS items
    await fireEvent.press(sheet.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByTestId("items-sheet")).toBeNull());
    await fireEvent.press(screen.getByTestId("items-0006"));
    expect(await within(await screen.findByTestId("items-sheet")).findByText("Order #0006 — 3 items")).toBeOnTheScreen();
  });

  it("the type chips narrow it, and 'Every type' brings it back", async () => {
    await renderApp(<OrdersScreen />, { server: server() });
    await screen.findByTestId("order-0004");
    await fireEvent.press(screen.getByTestId("orders-channel-delivery"));
    expect(screen.getByTestId("order-0005")).toBeOnTheScreen();
    expect(screen.queryByTestId("order-0004")).toBeNull();
    expect(screen.queryByTestId("order-0001")).toBeNull();
    await fireEvent.press(screen.getByTestId("orders-channel-takeaway"));
    expect(screen.getByTestId("order-0004")).toBeOnTheScreen();
    expect(screen.queryByTestId("order-0005")).toBeNull();
    await fireEvent.press(screen.getByTestId("orders-channel-all"));
    expect(screen.getByTestId("order-0005")).toBeOnTheScreen();
  });

  it("the status chips count what they would show (following the type and the search) and pick one status", async () => {
    await renderApp(<OrdersScreen />, { server: server() });
    await screen.findByTestId("order-0004");
    expect(screen.getByRole("button", { name: "In progress, 5" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "All, 6" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Cancelled, 1" })).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("orders-channel-delivery"));
    expect(screen.getByRole("button", { name: "In progress, 2" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Cancelled, 0" })).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("orders-channel-all"));
    await fireEvent.press(screen.getByTestId("orders-status-cancelled"));
    expect(screen.getByTestId("order-0003")).toBeOnTheScreen();
    expect(screen.queryByTestId("order-0004")).toBeNull();
    await fireEvent.press(screen.getByTestId("orders-all"));
    expect(screen.getByTestId("order-0003")).toBeOnTheScreen();
    expect(screen.getByTestId("order-0004")).toBeOnTheScreen();
  });

  it("search finds an order by number, customer, phone (any way it is typed), rider and address; nothing found says so and can be cleared", async () => {
    await renderApp(<OrdersScreen />, { server: server() });
    await screen.findByTestId("order-0004");
    const search = screen.getByTestId("orders-search");
    await fireEvent.changeText(search, "#0006");
    expect(screen.getByTestId("order-0006")).toBeOnTheScreen();
    expect(screen.queryByTestId("order-0005")).toBeNull();
    await fireEvent.changeText(search, "+91 98765 54321");
    expect(screen.getByTestId("order-0006")).toBeOnTheScreen();
    await fireEvent.changeText(search, "ramesh");
    expect(screen.getByTestId("order-0005")).toBeOnTheScreen();
    await fireEvent.changeText(search, "tower c");
    expect(screen.getByTestId("order-0006")).toBeOnTheScreen();
    await fireEvent.changeText(search, "zzzz");
    expect(await screen.findByText("No order matches")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Clear the filters" }));
    expect(await screen.findByTestId("order-0004")).toBeOnTheScreen();
    expect(screen.getByTestId("orders-search").props.value).toBe("");
  });

  it("tapping an order opens it", async () => {
    const onOpen = jest.fn();
    await renderApp(<OrdersScreen onOpenOrder={onOpen} />, { server: server() });
    await fireEvent.press(await screen.findByTestId("order-0005"));
    expect(onOpen).toHaveBeenCalledWith(READY.id);
  });

  it("a person who may only look sees no step buttons", async () => {
    await renderApp(<OrdersScreen />, { server: server({}, readOnly()) });
    await screen.findByTestId("order-0004");
    expect(screen.queryByTestId("advance-0004")).toBeNull();
  });
});

describe("moving an order along from the list", () => {
  it("asks first, then changes it: PATCH …/status with the next status", async () => {
    const s = server();
    await renderApp(<OrdersScreen />, { server: s });
    await fireEvent.press(await screen.findByTestId("advance-0004"));
    expect(await screen.findByText("Mark order #0004 as Accepted?")).toBeOnTheScreen();
    expect(s.to("PATCH", /\/status$/)).toHaveLength(0);                          // nothing sent before the answer
    await fireEvent.press(inDialog("Accept"));
    await waitFor(() => expect(s.to("PATCH", `/api/orders/${TAKE.id}/status`)).toHaveLength(1));
    expect(s.to("PATCH", `/api/orders/${TAKE.id}/status`)[0]!.body).toEqual({ status: "accepted" });
    await waitFor(() => expect(messages()).toContain("ok:Order #0004 is now Accepted"));
    expect(screen.queryByText("Mark order #0004 as Accepted?")).toBeNull();
  });

  it("'Cancel' in the question changes nothing", async () => {
    const s = server();
    await renderApp(<OrdersScreen />, { server: s });
    await fireEvent.press(await screen.findByTestId("advance-0004"));
        await fireEvent.press(inDialog("Cancel"));
    expect(s.to("PATCH", /\/status$/)).toHaveLength(0);
  });

  it("the server's refusal is shown in its own words, and the question closes", async () => {
    const s = server({ "PATCH /api/orders/:id/status": { status: 409, json: fx("error-status-flow") } });
    await renderApp(<OrdersScreen />, { server: s });
    await fireEvent.press(await screen.findByTestId("advance-0004"));
        await fireEvent.press(inDialog("Accept"));
    await waitFor(() => expect(messages()).toContain("danger:An order that's placed can't move to completed"));
    expect(screen.queryByText("Mark order #0004 as Accepted?")).toBeNull();
  });

  it("'Send out' asks who is taking it (not 'are you sure?'): pick a rider → PATCH …/rider with sendOut", async () => {
    const s = server();
    await renderApp(<OrdersScreen />, { server: s });
    await fireEvent.press(await screen.findByTestId("advance-0005"));
    expect(await screen.findByText("Order #0005 — send out")).toBeOnTheScreen();
    expect(screen.queryByText(/Mark order #0005 as/)).toBeNull();
    const ramesh = fx("riders").riders.find((r: { name: string }) => r.name === "Ramesh");
    expect((await screen.findByTestId(`rider-${ramesh.id}`)).props.accessibilityState.checked).toBe(true);   // it already has Ramesh: he is chosen
    expect(screen.getByTestId("rider-submit")).toHaveTextContent("Send out for delivery");
  });
});

describe("one order, in full", () => {
  const open = (id: string, who: Record<string, any> = {}, more: Record<string, any> = {}) => {
    const props = { onEdit: jest.fn(), onOpenTable: jest.fn(), onGone: jest.fn() };
    const s = server(more, who);
    return renderApp(<OrderDetail orderId={id} {...props} />, { server: s }).then((r) => ({ ...r, s, ...props }));
  };

  it("a delivery order: what it is, who it is for, where it goes, how it is paid, what is in it, the totals, how it got here", async () => {
    await open(OUT.id);
    expect(await screen.findByText("Order #0006")).toBeOnTheScreen();
    expect(screen.getAllByText("Out for delivery").length).toBeGreaterThan(0);   // the badge, and its step in the history
    expect(screen.getAllByText("Paid").length).toBeGreaterThan(0);
    const details = within(screen.getByTestId("customer-card"));
    expect(details.getByText("Karan Malhotra")).toBeOnTheScreen();
    expect(details.getByText("9876554321")).toBeOnTheScreen();
    const addr = within(screen.getByTestId("address-card"));
    expect(addr.getByText(/Flat 4B, Tower C, Sector 62, Noida/)).toBeOnTheScreen();
    expect(addr.getByText(/3\.5 km from the outlet/)).toBeOnTheScreen();
    expect(screen.getByText("Walk-in rider · 9000011111")).toBeOnTheScreen();
    expect(within(screen.getByTestId("payment-card")).getByText("Online (test payment)")).toBeOnTheScreen();
    const items = within(screen.getByTestId("items-card"));
    expect(items.getByText("Items (3)")).toBeOnTheScreen();
    expect(items.getByText("Masala Chai")).toBeOnTheScreen();
    const totals = within(screen.getByTestId("totals"));
    expect(totals.getByText("Subtotal")).toBeOnTheScreen();
    expect(totals.getByText("CGST ₹2.15 + SGST ₹2.14")).toBeOnTheScreen();
    expect(totals.getByText("Total")).toBeOnTheScreen();
    const history = within(screen.getByTestId("history-card"));
    for (const w of ["Placed", "Accepted", "Preparing", "Ready", "Out for delivery"]) expect(history.getAllByText(w).length).toBeGreaterThan(0);
    expect(history.getByText("with Walk-in rider")).toBeOnTheScreen();
  });

  it("Call and WhatsApp open the phone's dialer and WhatsApp, with the right number", async () => {
    const spy = jest.spyOn(Linking, "openURL").mockResolvedValue(true as never);
    await open(OUT.id);
    await fireEvent.press(await screen.findByTestId("call-customer"));
    expect(spy).toHaveBeenLastCalledWith("tel:9876554321");
    await fireEvent.press(screen.getByTestId("whatsapp-customer"));
    expect(spy).toHaveBeenLastCalledWith("https://wa.me/919876554321");        // a 10-digit number gets 91
    await fireEvent.press(screen.getByTestId("open-maps"));
    expect(spy).toHaveBeenLastCalledWith(expect.stringMatching(/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=28\.5655,77\.381$/));
    spy.mockRestore();
  });

  it("the big button is the next step (with 'Cancel order' only while the food isn't ready); the person can also set a status by hand, change the rider, edit, print", async () => {
    await open(TAKE.id);
    expect(await screen.findByTestId("advance-accepted")).toHaveTextContent("Accept");
    expect(screen.getByTestId("cancel-order")).toBeOnTheScreen();
    expect(screen.getByTestId("set-status")).toBeOnTheScreen();
    expect(screen.getByTestId("edit-order")).toBeOnTheScreen();
    expect(screen.getByTestId("print-order")).toBeOnTheScreen();
    expect(screen.queryByTestId("change-rider")).toBeNull();                      // a takeaway has no rider
    expect(screen.queryByTestId("delete-order")).toBeNull();                      // only the owner may delete
    expect(screen.queryByTestId("open-table")).toBeNull();                        // no table
  });

  it("a ready delivery offers 'Send out' first and 'Mark delivered' second; no cancel any more", async () => {
    await open(READY.id);
    expect(await screen.findByTestId("advance-out_for_delivery")).toHaveTextContent("Send out");
    expect(screen.getByTestId("advance-completed")).toHaveTextContent("Mark delivered");
    expect(screen.queryByTestId("cancel-order")).toBeNull();
    expect(screen.getByTestId("change-rider")).toHaveTextContent("Change rider");
  });

  it("a dine-in order can open its table", async () => {
    const t = await open(DINE.id);
    await fireEvent.press(await screen.findByTestId("open-table"));
    expect(t.onOpenTable).toHaveBeenCalledWith(DINE.tableId);
  });

  it("cancelling asks, says it can't be undone, and sends 'cancelled'", async () => {
    const t = await open(TAKE.id);
    await fireEvent.press(await screen.findByTestId("cancel-order"));
    expect(await screen.findByText("Cancel order #0004?")).toBeOnTheScreen();
    expect(screen.getByText(/can't be undone/)).toBeOnTheScreen();
    await fireEvent.press(inDialog("Cancel order"));
    await waitFor(() => expect(t.s.to("PATCH", `/api/orders/${TAKE.id}/status`)[0]?.body).toEqual({ status: "cancelled" }));
  });

  it("a finished order has no step buttons, but can still be put right by hand", async () => {
    await open(VOIDED.id);
    expect(await screen.findByText("Order #0003")).toBeOnTheScreen();
    expect(screen.queryByTestId("order-actions")).toBeNull();
    expect(screen.getByTestId("set-status")).toBeOnTheScreen();
    expect(screen.queryByTestId("edit-order")).toBeNull();                        // a cancelled order can't be edited
  });

  it("setting a status by hand: pick it, give a reason, and it is sent to the correction route", async () => {
    const t = await open(READY.id);
    await fireEvent.press(await screen.findByTestId("set-status"));
    expect(await screen.findByText("Set order #0005 by hand")).toBeOnTheScreen();
    expect(screen.getByTestId("manual-confirm")).toBeDisabled();
    expect(screen.getByTestId("manual-ready")).toBeDisabled();                    // the status it has now can't be picked
    await fireEvent.press(screen.getByTestId("manual-preparing"));
    await fireEvent.changeText(screen.getByTestId("manual-reason"), "Marked ready too early");
    await fireEvent.press(screen.getByTestId("manual-confirm"));
    await waitFor(() => expect(t.s.to("PATCH", `/api/orders/${READY.id}/status/manual`)).toHaveLength(1));
    expect(t.s.to("PATCH", `/api/orders/${READY.id}/status/manual`)[0]!.body).toEqual({ status: "preparing", reason: "Marked ready too early" });
    await waitFor(() => expect(screen.queryByText("Set order #0005 by hand")).toBeNull());
  });

  it("when the order's table has another party: the server's words, a list of free tables, and the pick is sent with the second try", async () => {
    const taken = { status: 409, json: { error: "Table T1 has another party now. Pick a free table for this order's party.", details: { code: "table_taken", freeTables: [{ id: "TB2", number: "T2", zone: "Ground floor", seats: 2 }, { id: "TB3", number: "T3", zone: "Terrace", seats: 6 }] } } };
    const attempts: unknown[] = [];
    const t = await open(VOIDED.id, {}, { "PATCH /api/orders/:id/status/manual": (call: { body: { tableId?: string } }) => { attempts.push(call.body); return call.body.tableId ? { json: fx("order-status-manual") } : taken; } });
    await fireEvent.press(await screen.findByTestId("set-status"));
    await fireEvent.press(await screen.findByTestId("manual-preparing"));
    await fireEvent.press(screen.getByTestId("manual-confirm"));
    expect(await screen.findByText("Pick a table for this party")).toBeOnTheScreen();
    expect(screen.getByText("Table T1 has another party now. Pick a free table for this order's party.")).toBeOnTheScreen();
    expect(screen.getByTestId("seat-confirm")).toBeDisabled();
    await fireEvent.press(screen.getByTestId("seat-T3"));
    await fireEvent.press(screen.getByTestId("seat-confirm"));
    await waitFor(() => expect(attempts).toHaveLength(2));
    expect(attempts[0]).toEqual({ status: "preparing" });
    expect(attempts[1]).toEqual({ status: "preparing", tableId: "TB3" });
    await waitFor(() => expect(screen.queryByText("Pick a table for this party")).toBeNull());
    expect(t.s.to("PATCH", /status\/manual$/)).toHaveLength(2);
  });

  it("changing the rider: starts from the rider it has, a listed rider is sent by id; 'Someone else' sends a typed name and number", async () => {
    const t = await open(READY.id);
    await fireEvent.press(await screen.findByTestId("change-rider"));
    expect(await screen.findByText("Rider for order #0005")).toBeOnTheScreen();
    const ramesh = fx("riders").riders.find((r: { name: string }) => r.name === "Ramesh");
    const suresh = fx("riders").riders.find((r: { name: string }) => r.name === "Suresh");
    expect((await screen.findByTestId(`rider-${ramesh.id}`)).props.accessibilityState.checked).toBe(true);   // what it has now
    await fireEvent.press(screen.getByTestId(`rider-${suresh.id}`));
    await fireEvent.press(screen.getByTestId("rider-submit"));
    await waitFor(() => expect(t.s.to("PATCH", `/api/orders/${READY.id}/rider`)).toHaveLength(1));
    expect(t.s.to("PATCH", `/api/orders/${READY.id}/rider`)[0]!.body).toEqual({ riderId: suresh.id, sendOut: false });
    await waitFor(() => expect(screen.queryByText("Rider for order #0005")).toBeNull());
    // …and a rider typed in just this once
    await fireEvent.press(screen.getByTestId("change-rider"));
    await fireEvent.press(await screen.findByTestId("rider-other"));
    expect(screen.getByTestId("rider-submit")).toBeDisabled();                    // a name is needed
    await fireEvent.changeText(screen.getByTestId("rider-name"), "Bittu");
    await fireEvent.changeText(screen.getByTestId("rider-phone"), "90000 22222");
    await fireEvent.press(screen.getByTestId("rider-submit"));
    await waitFor(() => expect(t.s.to("PATCH", `/api/orders/${READY.id}/rider`)).toHaveLength(2));
    expect(t.s.to("PATCH", `/api/orders/${READY.id}/rider`)[1]!.body).toEqual({ name: "Bittu", phone: "90000 22222", sendOut: false });
  });

  it("sending out with no rider is allowed ('No rider — just mark it out'); changing the rider needs one", async () => {
    const t = await open(READY.id);
    await fireEvent.press(await screen.findByTestId("advance-out_for_delivery"));
    expect(await screen.findByText("Order #0005 — send out")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("rider-none"));
    await fireEvent.press(screen.getByTestId("rider-submit"));
    await waitFor(() => expect(t.s.to("PATCH", `/api/orders/${READY.id}/rider`)[0]?.body).toEqual({ riderId: null, sendOut: true }));
    await waitFor(() => expect(messages().some((m) => m.startsWith("ok:Order #0005 is out for delivery"))).toBe(true));
  });

  it("printing: pick a printer, and the order is sent to it", async () => {
    const t = await open(TAKE.id);
    await fireEvent.press(await screen.findByTestId("print-order"));
    expect(await screen.findByText("Print order #0004")).toBeOnTheScreen();
    expect(screen.getByTestId("print-confirm")).toBeDisabled();
    await fireEvent.press(await screen.findByTestId("printer-Kitchen printer"));
    await fireEvent.press(screen.getByTestId("print-confirm"));
    await waitFor(() => expect(t.s.to("POST", `/api/printing/orders/${TAKE.id}/print`)).toHaveLength(1));
    expect(t.s.to("POST", `/api/printing/orders/${TAKE.id}/print`)[0]!.body).toEqual({ printerId: fx("printers").printers[0].id });
    await waitFor(() => expect(messages()).toContain("ok:Order #0004 sent to Kitchen printer"));
  });

  it("no printer set up: says where to add one", async () => {
    await open(TAKE.id, {}, { "GET /api/printing/printers": { json: { printers: [] } } });
    await fireEvent.press(await screen.findByTestId("print-order"));
    expect(await screen.findByText(/No printer is set up/)).toBeOnTheScreen();
  });

  it("only the owner may delete: asks first, then deletes and goes back", async () => {
    const t = await open(TAKE.id, owner());
    await fireEvent.press(await screen.findByTestId("delete-order"));
    expect(await screen.findByText("Delete order #0004?")).toBeOnTheScreen();
    expect(t.s.to("DELETE", /\/api\/orders\//)).toHaveLength(0);
    await fireEvent.press(inDialog("Delete order"));
    await waitFor(() => expect(t.s.to("DELETE", `/api/orders/${TAKE.id}`)).toHaveLength(1));
    await waitFor(() => expect(t.onGone).toHaveBeenCalled());
    expect(messages()).toContain("ok:Order #0004 was deleted");
  });

  it("a person who may only look sees everything about the order and none of the buttons", async () => {
    await open(OUT.id, readOnly());
    expect(await screen.findByText("Order #0006")).toBeOnTheScreen();
    expect(screen.getByTestId("customer-card")).toBeOnTheScreen();
    for (const id of ["order-actions", "set-status", "change-rider", "edit-order", "print-order", "delete-order"]) expect(screen.queryByTestId(id)).toBeNull();
    expect(screen.getByTestId("call-customer")).toBeOnTheScreen();               // (a phone call is not a change)
  });

  it("an order that isn't there says so", async () => {
    await open("nope");
    expect(await screen.findByText("Order not found")).toBeOnTheScreen();
  });

  it("'Edit order' opens the edit screen for this order", async () => {
    const t = await open(TAKE.id);
    await fireEvent.press(await screen.findByTestId("edit-order"));
    expect(t.onEdit).toHaveBeenCalledWith(TAKE.id);
  });
});
