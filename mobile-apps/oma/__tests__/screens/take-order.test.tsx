import { act, fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { layoutFor } from "@/lib/layout";
import { TakeOrderScreen } from "@/screens/TakeOrderScreen";
import { toasts } from "@/ui";
import { fakeServer, fx, renderApp } from "../../test/harness";

let mockSize = { width: 390, height: 800 };
jest.mock("@/lib/layout", () => ({ ...jest.requireActual("@/lib/layout"), useLayout: () => jest.requireActual("@/lib/layout").layoutFor(mockSize.width, mockSize.height) }));

const board = fx("tables-seated").tables as Array<{ id: string; number: string }>;
const idOf = (number: string) => board.find((t) => t.number === number)!.id;
const T1 = idOf("T1"); // seated (Mehta family)
const T2 = idOf("T2"); // free
const SESSION_T1 = (fx("sessions-active").sessions as Array<{ id: string; tableId: string }>).find((s) => s.tableId === T1)!.id;
const toastTexts = () => toasts.store.getState().toasts.map((t) => `${t.tone}:${t.message}`);
const open = (tableId = T2, server = fakeServer(), onDone = jest.fn()) => renderApp(<TakeOrderScreen tableId={tableId} onDone={onDone} />, { server }).then((r) => ({ ...r, onDone }));
const press = (testIDOrName: string) => fireEvent.press(screen.getByTestId(testIDOrName));
/** the categories start CLOSED (a menu of hundreds of dishes stays short): open any that are closed, then find the dish */
const expandAll = async () => {
  for (const name of ["Momos", "Drinks"]) {
    const header = await screen.findByTestId(`section-${name}`);
    if (header.props.accessibilityState?.expanded !== true) await fireEvent.press(header);
  }
};
const dish = async (name: string) => { await expandAll(); return screen.findByTestId(`dish-${name}`); };
const placed = (server: ReturnType<typeof fakeServer>) => server.to("POST", "/api/orders/staff");
const addChai = async (times = 1) => { for (let i = 0; i < times; i += 1) await fireEvent.press(await dish("Masala Chai")); };

beforeEach(() => toasts.clear());
afterEach(() => jest.restoreAllMocks());

describe("the menu", () => {
  it("lists every category and dish with its price, veg marks and sold-out state", async () => {
    await open();
    expect(await dish("Masala Chai")).toBeOnTheScreen();
    expect(screen.getByTestId("section-Momos")).toBeOnTheScreen();
    expect(screen.getByTestId("section-Drinks")).toBeOnTheScreen();
    expect(within(screen.getByTestId("dish-Masala Chai")).getByText("₹30")).toBeOnTheScreen();
    expect(within(screen.getByTestId("dish-Veg Steamed Momos")).getByText("from ₹60")).toBeOnTheScreen(); // price depends on the size
    expect(within(screen.getByTestId("dish-Cold Coffee")).getByText("Sold out")).toBeOnTheScreen();
  });

  it("a sold-out dish cannot be added", async () => {
    await open();
    const row = await dish("Cold Coffee");
    await fireEvent.press(row);
    expect(screen.queryByTestId("review-order")).toBeNull();
    expect(screen.queryByTestId("dish-sheet")).toBeNull();
  });

  it("searches, filters by food type and by category, and can clear it all", async () => {
    await open();
    await dish("Masala Chai");
    await fireEvent.changeText(screen.getByTestId("dish-search"), "chai");
    await waitFor(() => expect(screen.queryByTestId("dish-Paneer Tandoori Momos")).toBeNull()); // (the list follows when typing pauses)
    expect(screen.getByTestId("dish-Masala Chai")).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId("dish-search"), "zzz");
    expect(await screen.findByText("No dish matches")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Clear filters" }));
    expect(await screen.findByTestId("dish-Masala Chai")).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("radio", { name: "Non-veg" }));
    expect(screen.getByTestId("dish-Chicken Kurkure Momos")).toBeOnTheScreen();
    expect(screen.queryByTestId("dish-Masala Chai")).toBeNull();
    await fireEvent.press(screen.getByRole("radio", { name: "All" }));

    await fireEvent.press(screen.getByTestId("category-dropdown"));
    await fireEvent.press(screen.getByRole("menuitem", { name: "Drinks" }));
    await waitFor(() => expect(screen.queryByTestId("dish-Chicken Kurkure Momos")).toBeNull());
    expect(screen.getByTestId("dish-Masala Chai")).toBeOnTheScreen();
  });
});

describe("building the order", () => {
  it("a plain dish is added with one tap and then stepped up and down on its row", async () => {
    await open();
    await addChai();
    expect(screen.getByRole("button", { name: /Review order · 1 item · ₹30/ })).toBeOnTheScreen();
    const row = within(screen.getByTestId("dish-Masala Chai"));
    await fireEvent.press(row.getByRole("button", { name: "More Masala Chai" }));
    expect(screen.getByRole("button", { name: /Review order · 2 items · ₹60/ })).toBeOnTheScreen();
    await fireEvent.press(row.getByRole("button", { name: "Fewer Masala Chai" }));
    await fireEvent.press(row.getByRole("button", { name: "Fewer Masala Chai" }));
    expect(screen.queryByTestId("review-order")).toBeNull(); // nothing left in the order
  });

  it("a dish with sizes cannot be added until a size is chosen; an optional add-on does not block it", async () => {
    await open();
    await fireEvent.press(await dish("Veg Steamed Momos"));
    expect(screen.getByTestId("dish-sheet")).toBeOnTheScreen();
    expect(screen.getByTestId("dish-add")).toBeDisabled();
    expect(within(screen.getByTestId("dish-add")).getByText("Add")).toBeOnTheScreen(); // no "₹0" on a button that cannot be pressed yet
    expect(screen.getByTestId("dish-problem")).toHaveTextContent("Choose a size");
    await fireEvent.press(screen.getByRole("radio", { name: "Full (8 pcs), ₹90" }));
    expect(screen.queryByTestId("dish-problem")).toBeNull(); // "Extra dip" is optional
    expect(within(screen.getByTestId("dish-add")).getByText("Add · ₹90")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("checkbox", { name: "Schezwan dip, +₹15" }));
    expect(within(screen.getByTestId("dish-add")).getByText("Add · ₹105")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("dish-add"));
    expect(screen.queryByTestId("dish-sheet")).toBeNull();
    expect(screen.getByRole("button", { name: /Review order · 1 item · ₹105/ })).toBeOnTheScreen();
    expect(within(screen.getByTestId("dish-Veg Steamed Momos")).getByText("1 in the order")).toBeOnTheScreen();
  });

  it("a required add-on (Spice level) blocks adding until one is chosen", async () => {
    await open();
    await fireEvent.press(await dish("Chicken Kurkure Momos"));
    expect(screen.getByTestId("dish-add")).toBeDisabled();
    expect(screen.getByTestId("dish-problem")).toHaveTextContent("Choose one for Spice level");
    await fireEvent.press(screen.getByRole("radio", { name: "Hot" }));
    expect(screen.queryByTestId("dish-problem")).toBeNull();
    expect(screen.getByTestId("dish-add")).toBeEnabled();
  });

  it("add-ons change the price; the quantity multiplies it; picking another option of a pick-one group replaces the first", async () => {
    await open();
    await fireEvent.press(await dish("Chicken Kurkure Momos"));
    await fireEvent.press(screen.getByRole("radio", { name: "Hot" }));
    await fireEvent.press(screen.getByRole("radio", { name: "Mild" })); // replaces Hot
    expect(screen.getByRole("radio", { name: "Mild" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Hot" })).not.toBeChecked();
    await fireEvent.press(screen.getByRole("checkbox", { name: "Mayo dip, +₹10" }));
    expect(within(screen.getByTestId("dish-add")).getByText("Add · ₹150")).toBeOnTheScreen(); // 140 + 10
    await fireEvent.press(screen.getByRole("button", { name: "More Chicken Kurkure Momos" }));
    expect(within(screen.getByTestId("dish-add")).getByText("Add · ₹300")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("dish-add"));
    expect(screen.getByRole("button", { name: /Review order · 2 items · ₹300/ })).toBeOnTheScreen();
  });

  it("the same choice added twice becomes one line with a higher count; a different choice is a new line", async () => {
    const { runtime } = await open();
    for (const spice of ["Hot", "Hot", "Mild"]) {
      await fireEvent.press(await dish("Chicken Kurkure Momos"));
      await fireEvent.press(screen.getByRole("radio", { name: spice }));
      await fireEvent.press(screen.getByTestId("dish-add"));
    }
    const lines = runtime.drafts.getState().draftFor(T2).lines;
    expect(lines.map((l) => [l.modifierLabels.join(), l.quantity])).toEqual([["Hot", 2], ["Mild", 1]]);
  });

  it("each table keeps its own order: the one for T2 is not on T1", async () => {
    const r = await open(T2);
    await addChai();
    expect(r.runtime.drafts.getState().draftFor(T2).lines).toHaveLength(1);
    expect(r.runtime.drafts.getState().draftFor(T1).lines).toHaveLength(0);
  });
});

describe("sending the order", () => {
  it("at a seated table: goes on the party's bill, asks for no phone, and sends exactly what was chosen", async () => {
    const server = fakeServer();
    const { onDone, runtime } = await open(T1, server);
    await addChai();
    await fireEvent.press(within(screen.getByTestId("dish-Masala Chai")).getByRole("button", { name: "More Masala Chai" }));
    await press("review-order");
    const sheet = within(await screen.findByTestId("review-sheet"));
    expect(sheet.getByText(/Adding to the bill of/)).toBeOnTheScreen();
    expect(sheet.getByText("Mehta family")).toBeOnTheScreen();
    expect(screen.queryByTestId("order-phone")).toBeNull();
    await waitFor(() => expect(screen.getByTestId("order-total")).toHaveTextContent(/₹/)); // the server's price, not the estimate
    await press("send-order");
    await waitFor(() => expect(placed(server)).toHaveLength(1));
    const body = placed(server)[0]!.body;
    expect(body).toMatchObject({ tableId: T1, expectedSessionId: SESSION_T1 });
    expect(body.cart.lines).toHaveLength(1);
    expect(body.cart.lines[0]).toMatchObject({ quantity: 2, modifierOptionIds: [] });
    expect(body.phone).toBeUndefined();
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(toastTexts().some((t) => t.startsWith("ok:Order ") && t.endsWith("sent to the kitchen"))).toBe(true);
    expect(runtime.drafts.getState().draftFor(T1).lines).toHaveLength(0); // the order is not kept after it is sent
  });

  it("the server's own price is shown (tax, service charge, total), asked for THIS cart and table", async () => {
    const server = fakeServer();
    await open(T1, server);
    await addChai();
    await press("review-order");
    await waitFor(() => expect(server.to("POST", "/api/orders/staff/quote")).toHaveLength(1));
    const q = server.to("POST", "/api/orders/staff/quote")[0]!.body;
    expect(q).toMatchObject({ tableId: T1 });
    expect(q.cart.lines[0]).toMatchObject({ quantity: 1 });
    const total = fx("quote").totals.grandTotal;
    await waitFor(() => expect(screen.getByTestId("order-total")).toHaveTextContent(`₹${total / 100}`));
  });

  it("at a free table: the customer's number is required, checked, and sent; the name is optional", async () => {
    const server = fakeServer();
    await open(T2, server);
    await addChai();
    await press("review-order");
    await press("send-order");
    expect(await screen.findByText("Enter the customer's mobile number.")).toBeOnTheScreen();
    expect(placed(server)).toHaveLength(0);
    await fireEvent.changeText(screen.getByTestId("order-phone"), "123");
    await press("send-order");
    expect(screen.getByText("That mobile number doesn't look right.")).toBeOnTheScreen();
    expect(placed(server)).toHaveLength(0);
    await fireEvent.changeText(screen.getByTestId("order-phone"), "98765 43210");
    await fireEvent.changeText(screen.getByTestId("order-name"), "  Ravi ");
    await fireEvent.changeText(screen.getByTestId("order-note"), "Birthday table");
    await press("send-order");
    await waitFor(() => expect(placed(server)).toHaveLength(1));
    expect(placed(server)[0]!.body).toMatchObject({ tableId: T2, phone: "9876543210", name: "Ravi", note: "Birthday table", expectedSessionId: null });
  });

  it("the order can be changed in the review: a dish removed there is not sent", async () => {
    const server = fakeServer();
    await open(T1, server);
    await addChai();
    await fireEvent.press(await dish("Paneer Tandoori Momos"));
    await press("review-order");
    await fireEvent.press(within(await screen.findByTestId(/^line-/ as unknown as string).catch(() => screen.getAllByTestId(/^line-/)[0]!)).getByRole("button", { name: /Fewer/ }));
    await press("send-order");
    await waitFor(() => expect(placed(server)).toHaveLength(1));
    expect(placed(server)[0]!.body.cart.lines).toHaveLength(1);
  });

  it("someone else was seated at the table meanwhile: nothing is sent to them, the order is kept, and the waiter is told", async () => {
    const server = fakeServer({ "POST /api/orders/staff": { status: 409, json: fx("error-table-conflict") } });
    const { onDone, runtime } = await open(T2, server);
    await addChai();
    await press("review-order");
    await fireEvent.changeText(screen.getByTestId("order-phone"), "9876543210");
    await press("send-order");
    expect(await screen.findByTestId("order-conflict")).toBeOnTheScreen();
    expect(screen.getByText(/Table T1 was just taken/)).toBeOnTheScreen();
    expect(screen.getByText(/Nothing was added to their bill/)).toBeOnTheScreen();
    expect(screen.queryByTestId("send-order")).toBeNull(); // no way to push it through
    expect(placed(server)).toHaveLength(1);
    expect(runtime.drafts.getState().draftFor(T2).lines).toHaveLength(1); // kept
    await press("conflict-back");
    expect(onDone).toHaveBeenCalled();
    expect(runtime.drafts.getState().draftFor(T2).lines).toHaveLength(1);
  });

  it("…or the waiter can throw that order away", async () => {
    const server = fakeServer({ "POST /api/orders/staff": { status: 409, json: fx("error-table-conflict") } });
    const { onDone, runtime } = await open(T2, server);
    await addChai();
    await press("review-order");
    await fireEvent.changeText(screen.getByTestId("order-phone"), "9876543210");
    await press("send-order");
    await press("conflict-discard");
    expect(runtime.drafts.getState().draftFor(T2).lines).toHaveLength(0);
    expect(onDone).toHaveBeenCalled();
  });

  it("the table changes while the order is being taken: the waiter is warned, and the order carries what they SAW (so the server refuses it)", async () => {
    const server = fakeServer({
      "POST /api/orders/staff": (call) => (call.body.expectedSessionId === null ? { status: 409, json: fx("error-table-conflict") } : { json: fx("order-placed") }),
    });
    const { runtime } = await open(T2, server);
    await addChai();
    expect(screen.queryByTestId("table-changed")).toBeNull();
    // meanwhile a party sits at T2
    const tables = fx("tables-seated");
    tables.tables.find((t: { id: string }) => t.id === T2).activeSessionId = "someone-elses-session";
    tables.tables.find((t: { id: string }) => t.id === T2).status = "seated";
    server.set("GET /api/tables", { json: tables });
    await act(async () => { await runtime.queryClient.refetchQueries({ queryKey: ["tables"] }); });
    expect(await screen.findByTestId("table-changed")).toBeOnTheScreen();
    await press("review-order");
    await fireEvent.changeText(screen.getByTestId("order-phone"), "9876543210");
    await press("send-order");
    expect(await screen.findByTestId("order-conflict")).toBeOnTheScreen();
    expect(placed(server)[0]!.body.expectedSessionId).toBeNull(); // not "someone-elses-session"
  });

  it("a dish that sold out meanwhile is reported before sending, and sending is blocked", async () => {
    const server = fakeServer({ "POST /api/orders/staff/quote": { status: 409, json: fx("error-quote-sold-out") } });
    await open(T1, server);
    await addChai();
    await press("review-order");
    expect(await screen.findByTestId("quote-error")).toHaveTextContent("Cold Coffee is sold out. Take it out of the order to continue.");
    expect(screen.getByTestId("send-order")).toBeDisabled();
    expect(placed(server)).toHaveLength(0);
  });

  it("a server problem while sending keeps the order and lets the waiter try again", async () => {
    const server = fakeServer({ "POST /api/orders/staff": { status: 500, json: { error: "The server had a problem. Try again in a moment." } } });
    const { onDone, runtime } = await open(T1, server);
    await addChai();
    await press("review-order");
    await press("send-order");
    expect(await screen.findByTestId("send-error")).toHaveTextContent(/The server had a problem/);
    expect(onDone).not.toHaveBeenCalled();
    expect(runtime.drafts.getState().draftFor(T1).lines).toHaveLength(1);
    server.set("POST /api/orders/staff", { json: fx("order-placed") });
    await press("send-order");
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
  });

  it("no internet while sending: says so and keeps the order", async () => {
    const server = fakeServer({ "POST /api/orders/staff": { throws: new TypeError("Network request failed") } });
    const { runtime } = await open(T1, server);
    await addChai();
    await press("review-order");
    await press("send-order");
    expect(await screen.findByTestId("send-error")).toHaveTextContent(/Can't reach the server/);
    expect(runtime.drafts.getState().draftFor(T1).lines).toHaveLength(1);
  });

  it("a double tap on Send sends one order (never two kitchen tickets)", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const server = fakeServer({ "POST /api/orders/staff": { json: fx("order-placed"), gate } });
    await open(T1, server);
    await addChai();
    await press("review-order");
    const first = press("send-order");
    await waitFor(() => expect(screen.getByTestId("send-order")).toBeBusy());
    await press("send-order");
    await act(async () => { release(); });
    await first;
    await waitFor(() => expect(placed(server)).toHaveLength(1));
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); }); // the board refreshes after a send; let it finish
  });
});

describe("screen sizes", () => {
  const size = (width: number, height: number) => { mockSize = { width, height }; };
  afterEach(() => { mockSize = { width: 390, height: 800 }; });
  it("the layout rules for these sizes", () => {
    expect([layoutFor(390, 800).kind, layoutFor(700, 1000).kind, layoutFor(1100, 700).kind]).toEqual(["phone", "tablet", "wide"]);
    expect([layoutFor(390, 800).menuColumns, layoutFor(700, 1000).menuColumns]).toEqual([1, 2]);
  });

  it("a phone: the order is behind the 'Review order' bar", async () => {
    size(390, 800);
    await open(T1);
    await addChai();
    expect(screen.getByTestId("review-order")).toBeOnTheScreen();
    expect(screen.queryByText("Order")).toBeNull();
    expect(screen.getByTestId("dish-Masala Chai")).toBeOnTheScreen();
  });

  it("a wide tablet: the order stays open on the right, no bar, and it can be sent from there", async () => {
    size(1100, 700);
    const server = fakeServer();
    await open(T1, server);
    await dish("Masala Chai");
    expect(screen.getByText("Order")).toBeOnTheScreen();
    expect(screen.getByText("Nothing in the order yet")).toBeOnTheScreen();
    await addChai();
    expect(screen.queryByTestId("review-order")).toBeNull();
    expect(await screen.findByTestId("send-order")).toBeOnTheScreen();
    await waitFor(() => expect(server.to("POST", "/api/orders/staff/quote")).toHaveLength(1));
    await press("send-order");
    await waitFor(() => expect(placed(server)).toHaveLength(1));
  });
});

describe("when the menu cannot be loaded", () => {
  it("shows the problem and a retry that works", async () => {
    const server = fakeServer({ "GET /api/menu": { throws: new TypeError("Network request failed") } });
    await open(T1, server);
    expect(await screen.findByText("No connection")).toBeOnTheScreen();
    server.set("GET /api/menu", { json: fx("menu") });
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(await dish("Masala Chai")).toBeOnTheScreen();
  });
  it("a table that does not exist", async () => {
    const { onDone } = await open("nope");
    expect(await screen.findByText("Table not found")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Back" }));
    expect(onDone).toHaveBeenCalled();
  });
});
