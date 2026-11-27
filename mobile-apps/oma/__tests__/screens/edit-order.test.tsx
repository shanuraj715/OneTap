import { fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { EditOrderScreen } from "@/screens/EditOrderScreen";
import { toasts } from "@/ui";
import { fakeServer, fx, renderApp } from "../../test/harness";

const mixed = fx("orders-mixed").orders as Array<{ id: string; orderNumber: string; lines: Array<{ name: string; quantity: number }> }>;
const TAKE = mixed.find((o) => o.orderNumber === "0004")!;       // a takeaway order: Veg Steamed Momos (Half) × 2 + Masala Chai × 1
const messages = () => toasts.store.getState().toasts.map((t) => `${t.tone}:${t.message}`);
const server = (more: Record<string, any> = {}) => fakeServer({ "GET /api/orders": { json: fx("orders-mixed") }, "PATCH /api/orders/:id": { json: fx("order-edited-details") }, ...more });
const open = (more: Record<string, any> = {}) => {
  const onDone = jest.fn();
  const s = server(more);
  return renderApp(<EditOrderScreen orderId={TAKE.id} onDone={onDone} />, { server: s }).then((r) => ({ ...r, s, onDone }));
};
const expandAll = async () => {
  for (const name of ["Momos", "Drinks"]) {
    const header = await screen.findByTestId(`section-${name}`);
    if (header.props.accessibilityState?.expanded !== true) await fireEvent.press(header);
  }
};
const review = async () => { await fireEvent.press(await screen.findByTestId("review-edit")); await screen.findByTestId("edit-sheet"); };
const edits = (s: ReturnType<typeof fakeServer>) => s.to("PATCH", `/api/orders/${TAKE.id}`);
beforeEach(() => toasts.clear());

describe("editing a placed order", () => {
  it("starts from the order as it is: its items and their number, and nothing to save yet", async () => {
    await open();
    expect(await screen.findByText("Order #0004")).toBeOnTheScreen();
    expect(screen.getByText("· Takeaway")).toBeOnTheScreen();
    await waitFor(() => expect(screen.getByTestId("review-edit")).toHaveTextContent(/Review changes · 3 items/));   // (the order's lines are put in just after it opens)
    await review();
    expect(screen.getByTestId("edit-line-Veg Steamed Momos")).toBeOnTheScreen();
    expect(within(screen.getByTestId("edit-line-Veg Steamed Momos")).getByText("Veg Steamed Momos · Half (4 pcs)")).toBeOnTheScreen();
    expect(screen.getByTestId("edit-name").props.value).toBe("Priya N.");
    expect(screen.getByTestId("edit-phone").props.value).toBe("9811122233");
    expect(screen.getByTestId("edit-note").props.value).toBe("No onions please");
    expect(screen.getByTestId("edit-save")).toBeDisabled();
    expect(screen.getByTestId("edit-save")).toHaveTextContent("No changes yet");
  });

  it("one more of a dish: the WHOLE cart is sent (the server prices the whole order again) — and nothing else", async () => {
    const { s, onDone } = await open();
    await review();
    await fireEvent.press(screen.getByRole("button", { name: "More Veg Steamed Momos" }));
    expect(screen.getByTestId("edit-save")).toHaveTextContent("Save changes");
    await fireEvent.press(screen.getByTestId("edit-save"));
    await waitFor(() => expect(edits(s)).toHaveLength(1));
    const body = edits(s)[0]!.body;
    expect(Object.keys(body)).toEqual(["cart"]);
    expect(body.cart.lines).toHaveLength(2);
    const veg = body.cart.lines.find((l: { quantity: number; variantId?: string }) => l.variantId);
    expect(veg.quantity).toBe(3);
    expect(body.cart.lines.find((l: { variantId?: string }) => !l.variantId).quantity).toBe(1);
    await waitFor(() => expect(messages()).toContain("ok:Order #0004 was changed"));
    expect(onDone).toHaveBeenCalled();
  });

  it("only the note, the name, or the number: just those are sent", async () => {
    const { s } = await open();
    await review();
    await fireEvent.changeText(screen.getByTestId("edit-note"), "Extra napkins");
    await fireEvent.changeText(screen.getByTestId("edit-name"), "Priya Nair");
    await fireEvent.press(screen.getByTestId("edit-save"));
    await waitFor(() => expect(edits(s)).toHaveLength(1));
    expect(edits(s)[0]!.body).toEqual({ note: "Extra napkins", customerName: "Priya Nair" });
  });

  it("a phone number that doesn't look right blocks Save and says so", async () => {
    await open();
    await review();
    await fireEvent.changeText(screen.getByTestId("edit-phone"), "12345");
    expect(screen.getByText("That mobile number doesn't look right.")).toBeOnTheScreen();
    expect(screen.getByTestId("edit-save")).toBeDisabled();
  });

  it("taking every item away: says an order needs one, and Save stays off", async () => {
    await open();
    await review();
    for (const name of ["Veg Steamed Momos", "Masala Chai"]) {
      const row = within(screen.getByTestId(`edit-line-${name}`));
      for (let i = 0; i < 3; i += 1) { const less = row.queryByRole("button", { name: `Fewer ${name}` }); if (less) await fireEvent.press(less); }
    }
    expect(await screen.findByTestId("edit-empty")).toBeOnTheScreen();
    expect(screen.getByTestId("edit-save")).toBeDisabled();
  });

  it("adding a dish from the menu puts it in the order", async () => {
    const { s } = await open();
    await expandAll();
    await fireEvent.press(await screen.findByTestId("dish-Paneer Tandoori Momos"));
    await waitFor(() => expect(screen.getByTestId("review-edit")).toHaveTextContent(/Review changes · 4 items/));
    await review();
    expect(screen.getByTestId("edit-line-Paneer Tandoori Momos")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("edit-save"));
    await waitFor(() => expect(edits(s)).toHaveLength(1));
    expect(edits(s)[0]!.body.cart.lines).toHaveLength(3);
  });

  it("a sold-out dish can't be added", async () => {
    await open();
    await expandAll();
    await waitFor(() => expect(screen.getByTestId("review-edit")).toHaveTextContent(/Review changes · 3 items/));
    await fireEvent.press(await screen.findByTestId("dish-Cold Coffee"));
    expect(screen.getByTestId("review-edit")).toHaveTextContent(/Review changes · 3 items/);
  });

  it("the server's refusal (too far along, editing switched off) is shown as it is, and the edit stays open", async () => {
    const { onDone } = await open({ "PATCH /api/orders/:id": { status: 409, json: fx("error-edit-locked") } });
    await review();
    await fireEvent.changeText(screen.getByTestId("edit-note"), "too late");
    await fireEvent.press(screen.getByTestId("edit-save"));
    await waitFor(() => expect(messages()).toContain("danger:This order is already ready and can no longer be edited"));
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByTestId("edit-sheet")).toBeOnTheScreen();
  });

  it("an order that isn't there says so", async () => {
    const onDone = jest.fn();
    await renderApp(<EditOrderScreen orderId="nope" onDone={onDone} />, { server: server() });
    expect(await screen.findByText("Order not found")).toBeOnTheScreen();
  });

  it("leaving the screen leaves no half-made edit behind", async () => {
    const { runtime, unmount } = await open();
    await screen.findByTestId("review-edit");
    expect(Object.keys(runtime.drafts.getState().drafts)).toEqual([`edit:${TAKE.id}`]);
    await unmount();
    expect(Object.keys(runtime.drafts.getState().drafts)).toEqual([]);
  });
});
