import type { Session, Table } from "@/api/schemas";
import { STATUS_TONE, summarizeTable } from "@/features/tables";

const table = (over: Partial<Table> = {}): Table => ({ id: "t1", number: "T1", zone: "Terrace", seats: 4, status: "seated", isActive: true, activeSessionId: "s1", ...over });
const session = (over: Partial<Session> = {}): Session => ({ id: "s1", tableId: "t1", tableNumber: "T1", customerName: "Mehta family", customerPhone: "9876543210", openedAt: "2026-11-26T10:00:00.000Z", orderCount: 1, openOrders: 1, tab: 34000, unpaidTotal: 34000, allPaid: false, ...over });
const at = (min: number) => new Date("2026-11-26T10:00:00.000Z").getTime() + min * 60_000;

describe("summarizeTable", () => {
  it("a free table says nothing about people", () => {
    const s = summarizeTable(table({ status: "free", activeSessionId: null }), undefined, at(5));
    expect(s).toMatchObject({ who: null, since: "", money: null });
    expect(s.spoken).toBe("Table T1, Terrace, 4 seats, Free");
  });
  it("a seated table with a bill to pay", () => {
    const s = summarizeTable(table(), session(), at(130));
    expect(s).toMatchObject({ who: "Mehta family", since: "2 h 10 min", money: "₹340 to pay", moneyTone: "warn" });
    expect(s.spoken).toBe("Table T1, Terrace, 4 seats, Seated, Mehta family, 2 h 10 min, ₹340 to pay");
  });
  it("everything paid says so, in the 'ok' tone", () => {
    expect(summarizeTable(table(), session({ allPaid: true, unpaidTotal: 0 }), at(30))).toMatchObject({ money: "Paid", moneyTone: "ok" });
  });
  it("seated but nothing ordered yet shows no money line", () => {
    expect(summarizeTable(table(), session({ orderCount: 0, openOrders: 0, tab: 0, unpaidTotal: 0 }), at(1)).money).toBeNull();
  });
  it("falls back to the phone number, then to 'Guest', when there is no name", () => {
    expect(summarizeTable(table(), session({ customerName: null }), at(1)).who).toBe("9876543210");
    expect(summarizeTable(table(), session({ customerName: null, customerPhone: null }), at(1)).who).toBe("Guest");
  });
  it("one seat is not 'seats'", () => {
    expect(summarizeTable(table({ seats: 1 }), undefined, at(0)).spoken).toContain("1 seat,");
  });
  it("each state has a tone, and 'free' is the good one", () => {
    expect(STATUS_TONE).toEqual({ free: "ok", seated: "info", "bill-requested": "warn", reserved: "neutral" });
  });
});
