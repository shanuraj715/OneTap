import { DONE_LIMIT, daySummary } from "@/features/summary";

const trip = (pickedUpAt: string | null, deliveredAt: string | null, distanceKm: number | null = null) => ({ pickedUpAt, deliveredAt, address: { text: "x", landmark: "", lat: null, lng: null, distanceKm } });

describe("daySummary — the rider's day in four numbers", () => {
  it("an empty day is all zeros and dashes", () => {
    expect(daySummary([])).toEqual({ delivered: 0, capped: false, km: 0, avgMinutes: null, fastestMinutes: null, firstAt: null, lastAt: null });
  });
  it("counts the orders, adds the distances and averages the time on the road", () => {
    const s = daySummary([
      trip("2026-11-28T10:00:00Z", "2026-11-28T10:12:00Z", 2.5),
      trip("2026-11-28T11:00:00Z", "2026-11-28T11:30:00Z", 4.26),
      trip("2026-11-28T12:00:00Z", "2026-11-28T12:06:00Z", 0.4),
    ]);
    expect(s.delivered).toBe(3);
    expect(s.km).toBe(7.2); // 2.5 + 4.26 + 0.4 = 7.16
    expect(s.avgMinutes).toBe(16); // (12 + 30 + 6) / 3
    expect(s.fastestMinutes).toBe(6);
  });
  it("the first and last times are the earliest and latest delivery, whatever order the list is in", () => {
    const s = daySummary([trip("a", "2026-11-28T15:00:00Z"), trip("a", "2026-11-28T09:30:00Z"), trip("a", "2026-11-28T12:00:00Z")]);
    expect(s.firstAt).toBe("2026-11-28T09:30:00Z");
    expect(s.lastAt).toBe("2026-11-28T15:00:00Z");
  });
  it("an order with no distance adds nothing; one with no pickup time is left out of the average", () => {
    const s = daySummary([trip(null, "2026-11-28T10:00:00Z", null), trip("2026-11-28T09:40:00Z", "2026-11-28T10:00:00Z", 3)]);
    expect(s.delivered).toBe(2);
    expect(s.km).toBe(3);
    expect(s.avgMinutes).toBe(20);
  });
  it("a trip that 'ended before it began' or lasted all day is a mistake, not a trip: it is left out", () => {
    const s = daySummary([trip("2026-11-28T10:30:00Z", "2026-11-28T10:00:00Z"), trip("2026-11-28T01:00:00Z", "2026-11-28T20:00:00Z"), trip("2026-11-28T10:00:00Z", "2026-11-28T10:10:00Z")]);
    expect(s.avgMinutes).toBe(10);
    expect(s.fastestMinutes).toBe(10);
    expect(s.delivered).toBe(3); // they still count as delivered
  });
  it("with no usable times the average and fastest are null, not zero", () => {
    const s = daySummary([trip(null, null)]);
    expect(s.avgMinutes).toBeNull(); expect(s.fastestMinutes).toBeNull(); expect(s.firstAt).toBeNull();
  });
  it("a full list means the server held some back: the count is 'at least'", () => {
    const many = Array.from({ length: DONE_LIMIT }, () => trip("2026-11-28T10:00:00Z", "2026-11-28T10:10:00Z", 1));
    expect(daySummary(many).capped).toBe(true);
    expect(daySummary(many.slice(1)).capped).toBe(false);
  });
});
