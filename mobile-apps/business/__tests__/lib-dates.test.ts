import { execFileSync } from "node:child_process";
import path from "node:path";
import { addDays, bucketLabel, daysBetween, lastYearRange, presetRange, previousRange, PRESETS, rangeLabel, today, weekdayOf } from "@/lib/dates";
import { computeProfitLoss, computeProfitLossRecorded, monthsInRange } from "@/lib/pnl";

const NOW = new Date("2026-11-28T10:00:00+05:30"); // a Saturday, India time

describe("days and periods (India's time)", () => {
  it("a moment late at night in India is still that Indian day, not the next one in UTC", () => {
    expect(today(new Date("2026-11-28T23:50:00+05:30"))).toBe("2026-11-28");
    expect(today(new Date("2026-11-28T00:10:00+05:30"))).toBe("2026-11-28");
    expect(today(new Date("2026-11-27T18:40:00Z"))).toBe("2026-11-28"); // 00:10 India
  });
  it("adds days across month and year ends, and counts the days of a range", () => {
    expect(addDays("2026-11-28", 3)).toBe("2026-12-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(daysBetween("2026-11-01", "2026-11-30")).toBe(30);
    expect(daysBetween("2026-11-28", "2026-11-28")).toBe(1);
    expect(weekdayOf("2026-11-28")).toBe(6);
  });
  it("every preset gives the right dates (weeks run Monday to Sunday)", () => {
    expect(presetRange("today", NOW)).toEqual({ from: "2026-11-28", to: "2026-11-28" });
    expect(presetRange("yesterday", NOW)).toEqual({ from: "2026-11-27", to: "2026-11-27" });
    expect(presetRange("last7", NOW)).toEqual({ from: "2026-11-22", to: "2026-11-28" });
    expect(presetRange("last30", NOW)).toEqual({ from: "2026-10-30", to: "2026-11-28" });
    expect(presetRange("thisWeek", NOW)).toEqual({ from: "2026-11-23", to: "2026-11-29" });
    expect(presetRange("lastWeek", NOW)).toEqual({ from: "2026-11-16", to: "2026-11-22" });
    expect(presetRange("thisMonth", NOW)).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    expect(presetRange("lastMonth", NOW)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(presetRange("thisYear", NOW)).toEqual({ from: "2026-01-01", to: "2026-12-31" });
    expect(presetRange("lastYear", NOW)).toEqual({ from: "2025-01-01", to: "2025-12-31" });
    expect(presetRange("lastMonth", new Date("2026-01-10T12:00:00+05:30"))).toEqual({ from: "2025-12-01", to: "2025-12-31" });
  });
  it("the period before is the same number of days straight before; the same dates last year handle 29 February", () => {
    expect(previousRange({ from: "2026-11-01", to: "2026-11-30" })).toEqual({ from: "2026-10-02", to: "2026-10-31" });
    expect(previousRange({ from: "2026-11-28", to: "2026-11-28" })).toEqual({ from: "2026-11-27", to: "2026-11-27" });
    expect(lastYearRange({ from: "2026-11-01", to: "2026-11-30" })).toEqual({ from: "2025-11-01", to: "2025-11-30" });
    expect(lastYearRange({ from: "2028-02-29", to: "2028-03-05" })).toEqual({ from: "2027-02-28", to: "2027-03-05" });
  });
  it("writes a range the way a person would", () => {
    expect(rangeLabel({ from: "2026-11-28", to: "2026-11-28" })).toBe("28 Nov 2026");
    expect(rangeLabel({ from: "2026-11-01", to: "2026-11-30" })).toBe("1 – 30 Nov 2026");
    expect(rangeLabel({ from: "2026-10-28", to: "2026-11-26" })).toBe("28 Oct – 26 Nov 2026");
    expect(rangeLabel({ from: "2025-12-28", to: "2026-01-03" })).toBe("28 Dec 2025 – 3 Jan 2026");
  });
  it("labels a chart's points: a day, a week by its Monday, a month", () => {
    expect(bucketLabel("2026-11-28", "day")).toBe("28 Nov");
    expect(bucketLabel("2026-W47", "week")).toBe("16 Nov");
    expect(bucketLabel("2026-W01", "week")).toBe("29 Dec");
    expect(bucketLabel("2026-11", "month")).toBe("Nov");
    expect(bucketLabel("2026-01", "month")).toBe("Jan ’26");
  });
  it("has the same presets the server has", () => {
    expect(PRESETS.map((p) => p.id)).toEqual(["today", "yesterday", "last7", "last30", "thisWeek", "lastWeek", "thisMonth", "lastMonth", "thisYear", "lastYear"]);
  });
});

/** The web dashboard's own functions (packages/config-schema), run in a plain Node: the app must give the same answers. */
const schema = (js: string): unknown => JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", `import * as S from ${JSON.stringify(path.resolve(__dirname, "../../../packages/config-schema/src/analytics.js"))}; ${js}`], { encoding: "utf8" }));

describe("the same dates and the same profit as the web dashboard", () => {
  it("presets, the period before and months-in-range agree with config-schema on the same dates", () => {
    const ids = PRESETS.map((p) => p.id);
    const theirs = schema(`const out = {}; for (const id of ${JSON.stringify(ids)}) out[id] = S.presetRange(id, new Date(${JSON.stringify(NOW.toISOString())})); console.log(JSON.stringify(out));`) as Record<string, { from: string; to: string }>;
    for (const id of ids) expect(presetRange(id, NOW)).toEqual(theirs[id]);
    const prev = schema(`console.log(JSON.stringify(S.previousRange({ from: "2026-11-01", to: "2026-11-30" })));`);
    expect(previousRange({ from: "2026-11-01", to: "2026-11-30" })).toEqual(prev);
    const months = schema(`console.log(JSON.stringify(S.monthsInRange({ from: "2026-10-15", to: "2026-12-03" })));`) as number;
    expect(monthsInRange({ from: "2026-10-15", to: "2026-12-03" })).toBeCloseTo(months, 10);
  });
  it("profit and loss from monthly estimates and from recorded bills agree with config-schema", () => {
    const range = { from: "2026-11-01", to: "2026-11-30" };
    const monthly = { netSalesPaise: 1_234_567_00, foodCostPct: 32.5, expenses: [{ label: "Rent", monthly: 30000 }, { label: "Salaries", monthly: 85000.5 }, { label: "Zero", monthly: 0 }], range };
    const recorded = { netSalesPaise: 1_234_567_00, foodCostPct: 32.5, recorded: [{ label: "Vegetables", amount: 41250.75 }, { label: "Rent", amount: 30000 }], range };
    const theirsMonthly = schema(`console.log(JSON.stringify(S.computeProfitLoss(${JSON.stringify(monthly)})));`);
    const theirsRecorded = schema(`console.log(JSON.stringify(S.computeProfitLossRecorded(${JSON.stringify(recorded)})));`);
    expect(JSON.parse(JSON.stringify(computeProfitLoss(monthly)))).toEqual(theirsMonthly);
    expect(JSON.parse(JSON.stringify(computeProfitLossRecorded(recorded)))).toEqual(theirsRecorded);
  });
  it("a month of a monthly bill costs exactly the bill; a recorded range with nothing sold has no margin", () => {
    const r = computeProfitLoss({ netSalesPaise: 100_000_00, foodCostPct: 30, expenses: [{ label: "Rent", monthly: 20000 }], range: { from: "2026-11-01", to: "2026-11-30" } });
    expect(r.totalExpenses).toBeCloseTo(20000, 6);
    expect(r.net).toBeCloseTo(100000 * 0.7 - 20000, 6);
    expect(computeProfitLossRecorded({ netSalesPaise: 0, foodCostPct: 30, recorded: [{ label: "x", amount: 100 }], range: { from: "2026-11-01", to: "2026-11-30" } }).marginPct).toBeNull();
  });
});
