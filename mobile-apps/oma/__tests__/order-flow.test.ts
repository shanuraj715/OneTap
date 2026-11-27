import fs from "node:fs";
import path from "node:path";
import { ORDER_STATUSES, NEXT_STATUSES, actionLabel, addressLine, canCancelStatus, filterOrders, forwardStatusesFor, historyNote, isOpenStatus, manualStatusesFor, nextStatusesFor, paymentMethodLabel, statusLabelFor, statusSince } from "@/features/orders";
import { cleanPhone, draftFromOrder, editChanges, toCartInput } from "@/cart/cart";
import { fx } from "../test/harness";

const SERVER = fs.readFileSync(path.resolve(__dirname, "../../../packages/config-schema/src/order.js"), "utf8");

describe("the order flow is the server's own", () => {
  const listAfter = (name: string) => {
    const m = new RegExp(`export const ${name}\\s*(?::[^=]*)?=\\s*\\[([^\\]]*)\\]`).exec(SERVER);
    return m ? [...m[1]!.matchAll(/"([a-z_]+)"/g)].map((x) => x[1]!) : [];
  };
  it("the list of statuses is the one in packages/config-schema (same names, same order)", () => {
    expect([...ORDER_STATUSES]).toEqual(listAfter("ORDER_STATUSES"));
    expect(listAfter("ORDER_STATUSES").length).toBe(7);
  });
  it("every status can move to exactly the statuses the server allows", () => {
    const block = /export const NEXT_STATUSES[\s\S]*?\{([\s\S]*?)\};/.exec(SERVER)![1]!;
    const server: Record<string, string[]> = {};
    for (const m of block.matchAll(/(\w+):\s*\[([^\]]*)\]/g)) server[m[1]!] = [...m[2]!.matchAll(/"([a-z_]+)"/g)].map((x) => x[1]!);
    expect(Object.keys(server).sort()).toEqual(Object.keys(NEXT_STATUSES).sort());
    for (const s of Object.keys(server)) expect([...NEXT_STATUSES[s]!]).toEqual(server[s]);
  });
  it("what counts as 'still open' is the server's list", () => {
    expect(ORDER_STATUSES.filter(isOpenStatus)).toEqual(listAfter("OPEN_ORDER_STATUSES"));
  });
});

describe("the way forward", () => {
  it("a dine-in or takeaway order never goes 'out for delivery'; a delivery order does", () => {
    expect(nextStatusesFor("ready", "dine-in")).toEqual(["completed"]);
    expect(nextStatusesFor("ready", "takeaway")).toEqual(["completed"]);
    expect(nextStatusesFor("ready", "delivery")).toEqual(["out_for_delivery", "completed"]);
    expect(nextStatusesFor("out_for_delivery", "delivery")).toEqual(["completed"]);
  });
  it("the big button is the first step forward; cancel is separate and only while the food is not ready", () => {
    expect(forwardStatusesFor("placed", "takeaway")).toEqual(["accepted"]);
    expect(forwardStatusesFor("preparing", "dine-in")).toEqual(["ready"]);
    expect(forwardStatusesFor("completed", "delivery")).toEqual([]);
    expect(forwardStatusesFor("cancelled", "delivery")).toEqual([]);
    for (const s of ["placed", "accepted", "preparing"]) expect(canCancelStatus(s)).toBe(true);
    for (const s of ["ready", "out_for_delivery", "completed", "cancelled"]) expect(canCancelStatus(s)).toBe(false);
  });
  it("setting a status by hand offers every status — 'out for delivery' only for a delivery", () => {
    expect(manualStatusesFor("delivery")).toEqual([...ORDER_STATUSES]);
    expect(manualStatusesFor("takeaway")).not.toContain("out_for_delivery");
    expect(manualStatusesFor("dine-in")).toHaveLength(6);
  });
});

describe("words", () => {
  it("a status is said the way people of that order say it", () => {
    expect(statusLabelFor("completed", "delivery")).toBe("Delivered");
    expect(statusLabelFor("ready", "takeaway")).toBe("Ready for pickup");
    expect(statusLabelFor("ready", "delivery")).toBe("Ready");
    expect(statusLabelFor("completed", "takeaway")).toBe("Picked up");
    expect(statusLabelFor("ready", "dine-in")).toBe("Ready to serve");
    expect(statusLabelFor("completed", "dine-in")).toBe("Served");
    expect(statusLabelFor("out_for_delivery", "delivery")).toBe("Out for delivery");
  });
  it("a button says what it does", () => {
    expect(actionLabel("accepted", "dine-in")).toBe("Approve");
    expect(actionLabel("accepted", "takeaway")).toBe("Accept");
    expect(actionLabel("preparing", "delivery")).toBe("Start preparing");
    expect(actionLabel("ready", "takeaway")).toBe("Mark ready");
    expect(actionLabel("out_for_delivery", "delivery")).toBe("Send out");
    expect(actionLabel("completed", "delivery")).toBe("Mark delivered");
    expect(actionLabel("completed", "takeaway")).toBe("Handed over");
    expect(actionLabel("completed", "dine-in")).toBe("Mark served");
    expect(actionLabel("cancelled", "dine-in")).toBe("Cancel order");
  });
  it("how it is paid", () => {
    expect(paymentMethodLabel("cod")).toMatch(/Cash/);
    expect(paymentMethodLabel(undefined)).toMatch(/Cash/);
    expect(paymentMethodLabel("razorpay")).toBe("Online");
    expect(paymentMethodLabel("mock")).toMatch(/test/);
  });
  it("an address on one line, with its landmark", () => {
    expect(addressLine({ text: "B-14, Sector 18", landmark: "Opposite the metro" })).toBe("B-14, Sector 18 (Opposite the metro)");
    expect(addressLine({ text: "Flat 4B", landmark: null })).toBe("Flat 4B");
    expect(addressLine(null)).toBe("");
  });
  it("the history says what happened, without the money", () => {
    expect(historyNote({ edited: true, manual: false, from: "placed", reason: "items edited · 120.00 → 150.00" })).toBe("Items edited");
    expect(historyNote({ edited: true, manual: false, from: "placed", reason: "details edited" })).toBe("Details edited");
    expect(historyNote({ manual: true, from: "accepted", reason: "Tapped by mistake" })).toBe("Set by hand — Tapped by mistake");
    expect(historyNote({ manual: true, from: "accepted", reason: null })).toBe("Set by hand");
    expect(historyNote({ from: null, reason: "with Ramesh" })).toBe("with Ramesh");
  });
});

describe("how long it has been in its status", () => {
  it("counts from the last time it BECAME this status (an edit in between does not restart the clock)", () => {
    const o = { createdAt: "2026-11-27T10:00:00Z", status: "preparing", statusHistory: [
      { status: "placed", at: "2026-11-27T10:00:00Z" }, { status: "accepted", at: "2026-11-27T10:02:00Z" }, { status: "preparing", at: "2026-11-27T10:05:00Z" }, { status: "preparing", at: "2026-11-27T10:09:00Z", edited: true },
    ] };
    expect(statusSince(o)).toBe("2026-11-27T10:05:00Z");
  });
  it("an order with no history yet counts from when it was placed", () => expect(statusSince({ createdAt: "2026-11-27T10:00:00Z", status: "placed", statusHistory: [] })).toBe("2026-11-27T10:00:00Z"));
});

describe("finding orders", () => {
  const mixed = fx("orders-mixed").orders.map((o: any) => ({ ...o, rider: o.rider ?? null, deliveryAddress: o.deliveryAddress ?? null, tableId: o.tableId ?? null }));
  const tn = (id: string) => (id === mixed.find((o: any) => o.tableId)?.tableId ? "T1" : undefined);
  const all = { status: "all", channel: "all", search: "" };
  const nums = (f: Partial<typeof all>) => filterOrders(mixed, tn, { ...all, ...f }).map((o: any) => o.orderNumber).sort();
  it("by status: 'open' is what is still being made; 'all' is everything; one status is one status", () => {
    expect(nums({ status: "all" })).toHaveLength(mixed.length);
    expect(nums({ status: "open" })).toEqual(mixed.filter((o: any) => isOpenStatus(o.status)).map((o: any) => o.orderNumber).sort());
    expect(nums({ status: "cancelled" })).toEqual(mixed.filter((o: any) => o.status === "cancelled").map((o: any) => o.orderNumber).sort());
  });
  it("by type", () => {
    expect(nums({ channel: "delivery" })).toEqual(["0005", "0006"]);
    expect(nums({ channel: "takeaway" })).toEqual(["0004"]);
    expect(nums({ channel: "dine-in" })).toEqual(["0001", "0002", "0003"]);
  });
  it("by the number, with or without the # and the leading zeros' company", () => {
    expect(nums({ search: "0005" })).toEqual(["0005"]);
    expect(nums({ search: "#0006" })).toEqual(["0006"]);
  });
  it("by a customer's name (any case), a rider, an address, a table", () => {
    expect(nums({ search: "priya" })).toEqual(["0004"]);
    expect(nums({ search: "RAMESH" })).toEqual(["0005"]);
    expect(nums({ search: "sector 62" })).toEqual(["0006"]);
    expect(nums({ search: "table t1" })).not.toHaveLength(0);
  });
  it("by a phone number typed with spaces, a +91 or only the last digits — but not on one or two digits", () => {
    expect(nums({ search: "98111 22233" })).toEqual(["0004"]);              // typed with a space
    expect(nums({ search: "+91 98111 22233" })).toEqual(["0004"]);          // with the country code
    expect(nums({ search: "9876554321" })).toEqual(["0006"]);
    expect(nums({ search: "+91 98765 54321" })).toEqual(["0006"]);
    expect(nums({ search: "554321" })).toEqual(["0006"]);                   // the last digits only
    expect(nums({ search: "54321" })).toEqual(["0001", "0002", "0005", "0006"]); // (also inside the dine-in party's and Ramesh's numbers, 98765 43210)
    expect(nums({ search: "90000 11111" })).toEqual(["0006"]);              // the rider's number
    expect(nums({ search: "98" })).toHaveLength(0);                          // two digits: too short to mean a phone number
  });
  it("the three filters work together", () => {
    expect(nums({ status: "ready", channel: "delivery", search: "neha" })).toEqual(["0005"]);
    expect(nums({ status: "ready", channel: "takeaway" })).toEqual([]);
  });
});

describe("editing an order: the draft and what changed", () => {
  const order = fx("orders-mixed").orders.find((o: any) => o.channel === "takeaway");
  const base = () => draftFromOrder(order);
  it("an order becomes a draft with its lines, the prices the server charged, and who it is for", () => {
    const d = base();
    expect(d.lines.map((l) => [l.name, l.quantity])).toEqual(order.lines.map((l: any) => [l.name, l.quantity]));
    expect(d.lines[0]!.unitPrice).toBe(order.lines[0].unitPrice);
    expect(d.name).toBe(order.customer.name);
    expect(d.phone).toBe(order.customer.phone);
    expect(d.note).toBe(order.note ?? "");
  });
  it("nothing touched = nothing to save", () => expect(editChanges(base(), base())).toEqual({}));
  it("changing one quantity sends the whole cart (the server prices the whole order again) and nothing else", () => {
    const d = base(); d.lines[0] = { ...d.lines[0]!, quantity: d.lines[0]!.quantity + 1 };
    const c = editChanges(base(), d);
    expect(Object.keys(c)).toEqual(["cart"]);
    expect(c.cart!.lines).toHaveLength(order.lines.length);
    expect(c.cart!.lines[0]!.quantity).toBe(order.lines[0].quantity + 1);
    expect(c.cart).toEqual(toCartInput(d));
  });
  it("removing a line, the note, the name and the number are each sent only when they changed", () => {
    const d = base(); d.lines = d.lines.slice(1); d.note = "  Extra napkins "; d.name = "Priya Nair"; d.phone = "+91 98111 22244";
    expect(editChanges(base(), d)).toEqual({ cart: toCartInput(d), note: "Extra napkins", customerName: "Priya Nair", customerPhone: cleanPhone("+91 98111 22244") });
    const noteOnly = base(); noteOnly.note = "Less spicy";
    expect(editChanges(base(), noteOnly)).toEqual({ note: "Less spicy" });
  });
  it("typing a number the way it already is (spaces, dashes) is not a change", () => {
    const d = base(); d.phone = ` ${order.customer.phone.slice(0, 5)}-${order.customer.phone.slice(5)} `;
    expect(editChanges(base(), d)).toEqual({});
  });
});
