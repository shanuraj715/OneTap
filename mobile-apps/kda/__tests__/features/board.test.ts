import fs from "node:fs";
import path from "node:path";
import * as S from "@/api/schemas";
import { actionFor, arrivals, channelText, itemCount, lanes, minutesWaiting, prepList, stationsText, urgencyOf, waitText } from "@/features/board";

const board = S.kitchenBoardSchema.parse(JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "test", "fixtures", "kitchen-board-all.json"), "utf8")));
const order = (over: Partial<S.KitchenOrder> = {}): S.KitchenOrder => ({ ...board.orders[0]!, ...over });
const NOW = Date.parse("2026-11-26T12:00:00Z");
const ago = (min: number) => new Date(NOW - min * 60_000).toISOString();

describe("how long an order has waited", () => {
  it("counts whole minutes since it was accepted", () => {
    expect(minutesWaiting({ acceptedAt: ago(0) }, NOW)).toBe(0);
    expect(minutesWaiting({ acceptedAt: ago(12.9) }, NOW)).toBe(12);
    expect(minutesWaiting({ acceptedAt: ago(75) }, NOW)).toBe(75);
  });
  it("is never negative: a phone clock a little behind the server's is not '−1 min'", () => expect(minutesWaiting({ acceptedAt: ago(-3) }, NOW)).toBe(0));
  it("a date it can't read is 0, not NaN", () => expect(minutesWaiting({ acceptedAt: "garbage" }, NOW)).toBe(0));
  it("is said the way a cook reads it", () => {
    expect(waitText(0)).toBe("just now");
    expect(waitText(9)).toBe("9 min");
    expect(waitText(60)).toBe("1 h 00 min");
    expect(waitText(125)).toBe("2 h 05 min");
  });
});

describe("how worried to be (the store's own limits)", () => {
  const limits = { warnAfterMinutes: 10, lateAfterMinutes: 20 };
  it("fine, then amber at the warn limit, then red at the late limit", () => {
    expect([0, 9].map((m) => urgencyOf(m, limits))).toEqual(["ok", "ok"]);
    expect([10, 19].map((m) => urgencyOf(m, limits))).toEqual(["warn", "warn"]);
    expect([20, 90].map((m) => urgencyOf(m, limits))).toEqual(["late", "late"]);
  });
  it("follows a store that sets its own limits", () => expect(urgencyOf(6, { warnAfterMinutes: 5, lateAfterMinutes: 8 })).toBe("warn"));
});

describe("what the one button does", () => {
  it("Start a new order, Mark ready one that is being made, Recall one that is ready", () => {
    expect(actionFor("new")).toMatchObject({ label: "Start", to: "preparing", confirm: false });
    expect(actionFor("preparing")).toMatchObject({ label: "Mark ready", to: "ready", confirm: false });
    expect(actionFor("ready")).toMatchObject({ label: "Recall", to: "preparing", confirm: true });
  });
  it("only a recall asks first (a mis-tap would put a finished order back on the stove)", () => {
    expect((["new", "preparing", "ready"] as const).filter((s) => actionFor(s).confirm)).toEqual(["ready"]);
  });
});

describe("the three lanes", () => {
  it("each order is in the lane of its stage (the recorded board has one of each)", () => {
    const l = lanes(board.orders);
    expect(l.new.map((o) => o.orderNumber)).toEqual(["0003"]);
    expect(l.preparing.map((o) => o.orderNumber)).toEqual(["0002"]);
    expect(l.ready.map((o) => o.orderNumber)).toEqual(["0001"]);
  });
  it("waiting lanes: the one waiting longest is on top; ready: the newest is on top", () => {
    const o = (id: string, stage: S.Stage, min: number) => order({ id, stage, acceptedAt: ago(min) });
    const l = lanes([o("a", "new", 2), o("b", "new", 9), o("c", "new", 5), o("r1", "ready", 30), o("r2", "ready", 3)]);
    expect(l.new.map((x) => x.id)).toEqual(["b", "c", "a"]);
    expect(l.ready.map((x) => x.id)).toEqual(["r2", "r1"]);
  });
  it("an empty board is three empty lanes", () => expect(lanes([])).toEqual({ new: [], preparing: [], ready: [] }));
});

describe("telling the cook a new order has come", () => {
  it("the first look finds nothing new: orders that were already there when the app opened are not 'arrivals'", () => expect(arrivals(null, board.orders)).toEqual([]));
  it("afterwards, a NEW-stage order not seen before is an arrival", () => {
    const seen = new Set(["a"]);
    const orders = [order({ id: "a", stage: "new" }), order({ id: "b", stage: "new" })];
    expect(arrivals(seen, orders).map((o) => o.id)).toEqual(["b"]);
  });
  it("an order that moved to Preparing or Ready (by another screen) is not an arrival", () => {
    expect(arrivals(new Set(), [order({ id: "x", stage: "preparing" }), order({ id: "y", stage: "ready" })])).toEqual([]);
  });
});

describe("the words on a ticket", () => {
  it("where the food goes", () => {
    expect(channelText({ channel: "dine-in", tableNumber: "T2" })).toBe("Table T2");
    expect(channelText({ channel: "dine-in", tableNumber: null })).toBe("Dine-in");
    expect(channelText({ channel: "takeaway", tableNumber: null })).toBe("Takeaway");
    expect(channelText({ channel: "delivery", tableNumber: null })).toBe("Delivery");
  });
  it("how many things to make", () => expect(itemCount(board.orders.find((o) => o.orderNumber === "0003")!)).toBe(5));
  it("both stations are named when both have work; one station says nothing", () => {
    const mixed = board.orders.find((o) => o.orderNumber === "0003")!;
    expect(stationsText(mixed)).toBe("Kitchen: new · Bar: new");
    expect(stationsText(board.orders.find((o) => o.orderNumber === "0001")!)).toBe("");
  });
});

describe("the prep list", () => {
  it("adds up the same dish with the same size and add-ons, over every order that is not ready", () => {
    const line = (name: string, quantity: number, variantLabel = "", modifiers: string[] = []) => ({ name, quantity, variantLabel, modifiers, note: "", station: "kitchen" as const });
    const rows = prepList([
      order({ id: "1", stage: "new", lines: [line("Veg Momos", 2, "Full (8 pcs)"), line("Chai", 1)] }),
      order({ id: "2", stage: "preparing", lines: [line("Veg Momos", 4, "Full (8 pcs)"), line("Veg Momos", 1, "Half (4 pcs)")] }),
      order({ id: "3", stage: "ready", lines: [line("Veg Momos", 9, "Full (8 pcs)")] }),
    ]);
    expect(rows.map((r) => [r.name, r.detail, r.quantity, r.orders])).toEqual([
      ["Veg Momos", "Full (8 pcs)", 6, 2], // 2 + 4: the ready order's 9 are not counted
      ["Chai", "", 1, 1], // then equal amounts, A to Z
      ["Veg Momos", "Half (4 pcs)", 1, 1],
    ]);
  });
  it("a different add-on is a different row (it is cooked differently)", () => {
    const l = (modifiers: string[]) => ({ name: "Kurkure", quantity: 1, variantLabel: "", modifiers, note: "", station: "kitchen" as const });
    expect(prepList([order({ stage: "new", lines: [l(["Mild"]), l(["Hot"]), l(["Hot"])] })]).map((r) => [r.detail, r.quantity])).toEqual([["Hot", 2], ["Mild", 1]]);
  });
  it("the recorded board: only the orders still to make are on it", () => {
    const names = prepList(board.orders).map((r) => r.name);
    expect(names).toEqual(expect.arrayContaining(["Veg Steamed Momos", "Chicken Kurkure Momos", "Masala Chai", "Paneer Tandoori Momos"]));
  });
  it("nothing to make is an empty list", () => expect(prepList([])).toEqual([]));
});
