import { createApi } from "@/api/endpoints";
import { createClient } from "@/api/client";
import * as S from "@/api/schemas";
import { fx } from "../../test/harness";

function make(answer: unknown = {}, status = 200) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl = jest.fn(async (url: string, init: RequestInit) => { calls.push({ url, init }); return { ok: status < 300, status, text: async () => JSON.stringify(answer), headers: { get: () => null } } as unknown as Response; });
  const api = createApi(createClient({ baseUrl: "https://api.test", getToken: () => "TOKEN-123456789012345678901", onUnauthorized: () => undefined, fetchImpl: fetchImpl as unknown as typeof fetch }));
  const last = () => { const c = calls[calls.length - 1]!; return { url: c.url, method: c.init.method, body: c.init.body ? JSON.parse(String(c.init.body)) : undefined, headers: c.init.headers as Record<string, string> }; };
  return { api, last };
}

describe("the real answers of the server fit what the app expects", () => {
  it.each([["orders-list", S.ordersSchema], ["orders-mixed", S.ordersSchema], ["order-status-accepted", S.orderChangedSchema], ["order-status-manual", S.orderChangedSchema], ["order-edited-details", S.orderChangedSchema], ["order-edited-items", S.orderChangedSchema], ["order-rider-assigned", S.orderChangedSchema], ["order-rider-sendout", S.orderChangedSchema], ["riders", S.ridersSchema], ["printers", S.printersSchema], ["order-deleted", S.orderDeletedSchema]] as const)("%s", (name, schema) => {
    expect(() => schema.parse(fx(name))).not.toThrow();
  });
  it("a printing job answer (the status says 201 inside the recorded file)", () => expect(S.printJobSchema.parse(fx("print-order")).job.status).toBe("queued"));
  it("a delivery order keeps its address, rider, quoted time, history and the totals' extras", () => {
    const d = S.ordersSchema.parse(fx("orders-mixed")).orders.find((o) => o.channel === "delivery" && o.rider?.name === "Walk-in rider")!;
    expect(d.deliveryAddress?.text).toMatch(/Sector 62/);
    expect(d.deliveryAddress?.distanceKm).toBeGreaterThan(0);
    expect(d.rider).toMatchObject({ name: "Walk-in rider", phone: "9000011111", riderId: null });
    expect(d.etaMinutes).toBeGreaterThan(0);
    expect(d.statusHistory.map((h) => h.status)).toEqual(["placed", "accepted", "preparing", "ready", "out_for_delivery"]);
    expect(d.statusHistory[4]!.reason).toBe("with Walk-in rider");
    expect(d.totals.cgst).toBeDefined();
    expect(d.customer?.phone).toBe("9876554321");
  });
  it("a takeaway order edited by hand shows it in its history", () => {
    const o = S.orderChangedSchema.parse(fx("order-edited-items")).order;
    expect(o.statusHistory.filter((h) => h.edited)).toHaveLength(2);
    expect(o.statusHistory.some((h) => h.manual)).toBe(true);
  });
  it("a table's order has no address, no rider, no coupon and no pre-order time", () => {
    const o = S.ordersSchema.parse(fx("orders-list")).orders[0]!;
    expect(o).toMatchObject({ channel: "dine-in", deliveryAddress: null, rider: null, couponCode: null, scheduledFor: null });
  });
  it("an order with nothing optional at all (what an older server sent) still reads", () => {
    const o = S.orderSchema.parse({ id: "1", orderNumber: "0001", status: "placed", lines: [], totals: { subtotal: 0, discount: 0, taxAmount: 0, serviceCharge: 0, roundOff: 0, grandTotal: 0 }, payment: { status: "pending" }, createdAt: "2026-11-27T10:00:00Z" });
    expect(o).toMatchObject({ channel: "dine-in", statusHistory: [], rider: null, deliveryAddress: null, couponCode: null, pricesIncludeTax: true });
  });
});

describe("what the app sends to manage an order", () => {
  it("next step: PATCH /api/orders/:id/status with the status, for this outlet", async () => {
    const { api, last } = make(fx("order-status-accepted"));
    await api.setOrderStatus("OUTLET1", "ORD1", "accepted");
    expect(last()).toMatchObject({ url: "https://api.test/api/orders/ORD1/status", method: "PATCH", body: { status: "accepted" } });
    expect(last().headers["x-rasoipulse-outlet"]).toBe("OUTLET1");
    expect(last().headers.authorization).toMatch(/^Bearer /);
  });
  it("by hand: /status/manual with the reason and the table only when there are some", async () => {
    const { api, last } = make(fx("order-status-manual"));
    await api.setOrderStatusManual("O", "ORD1", "placed", "Tapped by mistake");
    expect(last()).toMatchObject({ url: "https://api.test/api/orders/ORD1/status/manual", method: "PATCH", body: { status: "placed", reason: "Tapped by mistake" } });
    await api.setOrderStatusManual("O", "ORD1", "preparing", undefined, "TBL9");
    expect(last().body).toEqual({ status: "preparing", tableId: "TBL9" });
    await api.setOrderStatusManual("O", "ORD1", "ready");
    expect(last().body).toEqual({ status: "ready" });
  });
  it("rider: a listed rider, a typed one, and send out", async () => {
    const { api, last } = make(fx("order-rider-assigned"));
    await api.assignRider("O", "ORD1", { riderId: "R1" });
    expect(last()).toMatchObject({ url: "https://api.test/api/orders/ORD1/rider", method: "PATCH", body: { riderId: "R1" } });
    await api.assignRider("O", "ORD1", { name: "Walk-in", phone: "900", sendOut: true });
    expect(last().body).toEqual({ name: "Walk-in", phone: "900", sendOut: true });
  });
  it("edit: PATCH /api/orders/:id with only what is given", async () => {
    const { api, last } = make(fx("order-edited-details"));
    await api.editOrder("O", "ORD1", { note: "No onions" });
    expect(last()).toMatchObject({ url: "https://api.test/api/orders/ORD1", method: "PATCH", body: { note: "No onions" } });
  });
  it("delete, the riders, the printers, and print", async () => {
    const del = make(fx("order-deleted")); await del.api.deleteOrder("O", "ORD1");
    expect(del.last()).toMatchObject({ url: "https://api.test/api/orders/ORD1", method: "DELETE" });
    const r = make(fx("riders")); await r.api.riders("O"); expect(r.last().url).toBe("https://api.test/api/riders");
    const p = make(fx("printers")); await p.api.printers("O"); expect(p.last().url).toBe("https://api.test/api/printing/printers");
    const pr = make(fx("print-order")); await pr.api.printOrder("O", "ORD1", "PR1");
    expect(pr.last()).toMatchObject({ url: "https://api.test/api/printing/orders/ORD1/print", method: "POST", body: { printerId: "PR1" } });
  });
});
