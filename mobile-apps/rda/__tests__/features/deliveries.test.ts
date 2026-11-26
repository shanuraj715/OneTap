import fs from "node:fs";
import path from "node:path";
import * as S from "@/api/schemas";
import { actionFor, arrivals, bagText, distanceText, isCodeShape, itemCount, minutesSince, minutesText, paymentText, sortDeliveries, stepOf } from "@/features/deliveries";

const { deliveries } = S.deliveriesSchema.parse(JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "test", "fixtures", "deliveries.json"), "utf8")));
const one = (status: S.DeliveryStatus) => deliveries.find((d) => d.status === status)!;
const NOW = Date.parse("2026-11-27T12:00:00Z");
const ago = (m: number) => new Date(NOW - m * 60_000).toISOString();

describe("what a delivery is waiting for, and what the rider does next", () => {
  it("being made: wait; ready: pick up; out: deliver; completed: done", () => {
    expect(stepOf({ status: "accepted" })).toBe("wait");
    expect(stepOf({ status: "preparing" })).toBe("wait");
    expect(stepOf({ status: "ready" })).toBe("pickup");
    expect(stepOf({ status: "out_for_delivery" })).toBe("deliver");
    expect(stepOf({ status: "completed" })).toBe("done");
  });
  it("the one big button: Picked up, then Delivered; none while the kitchen is still cooking", () => {
    expect(actionFor({ status: "ready" })).toMatchObject({ label: "Picked up" });
    expect(actionFor({ status: "out_for_delivery" })).toMatchObject({ label: "Delivered" });
    expect(actionFor({ status: "preparing" })).toBeNull();
    expect(actionFor({ status: "completed" })).toBeNull();
  });
});

describe("the order of the list", () => {
  it("on the way first, then ready, then still being made; each group oldest first", () => {
    const d = (id: string, status: S.DeliveryStatus, min: number): S.Delivery => ({ ...deliveries[0]!, id, status, assignedAt: ago(min), placedAt: ago(min) });
    const sorted = sortDeliveries([d("c", "preparing", 30), d("b", "ready", 5), d("a2", "out_for_delivery", 3), d("a1", "out_for_delivery", 12), d("e", "ready", 20)]);
    expect(sorted.map((x) => x.id)).toEqual(["a1", "a2", "e", "b", "c"]);
  });
  it("the recorded list: both on-the-way orders, then the ready one, then the one being made", () => {
    expect(sortDeliveries(deliveries).map((d) => d.status)).toEqual(["out_for_delivery", "out_for_delivery", "ready", "preparing"]);
  });
  it("does not change the list it was given", () => {
    const before = deliveries.map((d) => d.id).join();
    sortDeliveries(deliveries);
    expect(deliveries.map((d) => d.id).join()).toBe(before);
  });
});

describe("telling the rider a delivery has been handed to them", () => {
  it("the first look finds nothing new: deliveries already there when the app opened are not announced", () => expect(arrivals(null, deliveries)).toEqual([]));
  it("afterwards, a delivery not seen before is an arrival", () => {
    const seen = new Set(deliveries.slice(1).map((d) => d.id));
    expect(arrivals(seen, deliveries).map((d) => d.id)).toEqual([deliveries[0]!.id]);
  });
});

describe("the words on a card", () => {
  it("minutes, the way a rider reads them", () => {
    expect(minutesSince(ago(12.9), NOW)).toBe(12);
    expect(minutesSince(ago(-4), NOW)).toBe(0);
    expect(minutesSince(null, NOW)).toBe(0);
    expect(minutesText(0)).toBe("just now");
    expect(minutesText(9)).toBe("9 min");
    expect(minutesText(75)).toBe("1 h 15 min");
  });
  it("what is in the bag", () => {
    expect(bagText(one("out_for_delivery"))).toMatch(/\d × /);
    expect(bagText({ items: [{ name: "Momos", variantLabel: "Full (8 pcs)", quantity: 2, modifiers: [], note: "" }, { name: "Chai", variantLabel: "", quantity: 1, modifiers: [], note: "" }] })).toBe("2 × Momos (Full (8 pcs)) · 1 × Chai");
    expect(itemCount({ items: [{ name: "a", variantLabel: "", quantity: 2, modifiers: [], note: "" }, { name: "b", variantLabel: "", quantity: 3, modifiers: [], note: "" }] })).toBe(5);
  });
  it("the distance from the restaurant", () => {
    expect(distanceText(2.44)).toBe("2.4 km");
    expect(distanceText(0.8)).toBe("800 m");
    expect(distanceText(null)).toBe("");
  });
  it("whether the money was taken online (a rider never collects cash)", () => {
    expect(paymentText({ payment: { gateway: "razorpay", status: "paid" } })).toMatchObject({ label: "Paid online", tone: "ok" });
    expect(paymentText({ payment: { gateway: "razorpay", status: "pending" } })).toMatchObject({ label: "Not paid yet", tone: "warn" });
  });
});

describe("the customer's code", () => {
  it("exactly 4 digits, checked before anything is sent (a typo must not use up one of the few tries)", () => {
    expect(isCodeShape("4821")).toBe(true);
    expect(isCodeShape(" 4821 ")).toBe(true);
    for (const bad of ["", "482", "48210", "48a1", "4 821"]) expect(isCodeShape(bad)).toBe(false);
  });
});
