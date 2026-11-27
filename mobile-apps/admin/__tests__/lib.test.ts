import { bytes, changePct, count, initials, rupees, rupeesShort } from "@/lib/format";
import { MONTHS, dayKey, inRange, monthGrid, parseDay, prettyDay, shiftMonth, todayKey } from "@/ui/calendar";
import { areaPath, lineLength, nearest, niceMax, segments, smoothPath, toPoints } from "@/ui/chartMath";
import { contrast, darkColors, lightColors, responsive } from "@/ui/theme";

describe("money and numbers", () => {
  it("rupees from paise, with Indian grouping", () => {
    expect(rupees(12345600)).toBe("₹1,23,456");
    expect(rupees(0)).toBe("₹0");
    expect(rupees(null)).toBe("₹0");
  });
  it("short forms for a tile or an axis", () => {
    expect(rupeesShort(45000)).toBe("₹450");
    expect(rupeesShort(350000)).toBe("₹3.5 K");
    expect(rupeesShort(4454700)).toBe("₹45 K");
    expect(rupeesShort(45000000)).toBe("₹4.5 L");
    expect(rupeesShort(123400000000)).toBe("₹123 Cr");
    expect(rupeesShort(-250000)).toBe("-₹2.5 K");
  });
  it("percent change, with a proper minus and a dash when there is nothing to compare", () => {
    expect(changePct(6.1)).toBe("+6.1%");
    expect(changePct(-6.1)).toBe("−6.1%");
    expect(changePct(0)).toBe("0%");
    expect(changePct(null)).toBe("–");
  });
  it("sizes and names", () => {
    expect(bytes(512)).toBe("512 B");
    expect(bytes(2048)).toBe("2 KB");
    expect(bytes(5 * 1024 ** 2)).toBe("5.0 MB");
    expect(count(1234567)).toBe("12,34,567");
    expect(initials("Sam Sales")).toBe("SS");
    expect(initials("")).toBe("?");
  });
});

describe("the calendar", () => {
  it("a month is six Monday-first weeks of day keys", () => {
    const g = monthGrid(2026, 10); // November 2026 starts on a Sunday
    expect(g).toHaveLength(6);
    expect(g.every((w) => w.length === 7)).toBe(true);
    expect(g[0]![5]).toBeNull();
    expect(g[0]![6]).toBe("2026-11-01");
    expect(g.flat().filter(Boolean)).toHaveLength(30);
  });
  it("February in a leap year has 29 days", () => { expect(monthGrid(2028, 1).flat().filter(Boolean)).toHaveLength(29); });
  it("keys, parsing and the next month across a year end", () => {
    expect(dayKey(2026, 11, 5)).toBe("2026-12-05");
    expect(parseDay("2026-12-05")).toEqual({ y: 2026, m: 11, d: 5 });
    expect(parseDay("nonsense")).toBeNull();
    expect(prettyDay("2026-12-05")).toBe("5 Dec 2026");
    expect(shiftMonth(2026, 11, 1)).toEqual({ y: 2027, m: 0 });
    expect(shiftMonth(2026, 0, -1)).toEqual({ y: 2025, m: 11 });
    expect(MONTHS).toHaveLength(12);
    expect(todayKey(new Date(2026, 10, 27))).toBe("2026-11-27");
  });
  it("min and max", () => {
    expect(inRange("2026-11-10", "2026-11-01", "2026-11-30")).toBe(true);
    expect(inRange("2026-10-31", "2026-11-01")).toBe(false);
    expect(inRange("2026-12-01", undefined, "2026-11-30")).toBe(false);
  });
});

describe("chart arithmetic", () => {
  it("a nice top for the axis", () => {
    expect(niceMax(4.37)).toBe(5);
    expect(niceMax(87)).toBe(100);
    expect(niceMax(1230)).toBe(1500);
    expect(niceMax(0)).toBe(1);
  });
  it("values become points inside the box, highest at the top", () => {
    const pts = toPoints([0, 50, 100], 200, 100, { l: 0, r: 0, t: 0, b: 0 }, 100);
    expect(pts[0]).toEqual({ x: 0, y: 100 });
    expect(pts[1]).toEqual({ x: 100, y: 50 });
    expect(pts[2]).toEqual({ x: 200, y: 0 });
    expect(toPoints([5], 200, 100, { l: 0, r: 0, t: 0, b: 0 }, 10)[0]!.x).toBe(100); // one point: in the middle
  });
  it("a smooth line never dips below its lowest neighbours", () => {
    const pts = toPoints([10, 100, 10, 100], 300, 120);
    const d = smoothPath(pts);
    expect(d.startsWith("M")).toBe(true);
    const ys = [...d.matchAll(/C[\d.]+ ([\d.]+) [\d.]+ ([\d.]+) /g)].flatMap((m) => [Number(m[1]), Number(m[2])]);
    const lo = Math.min(...pts.map((p) => p.y)), hi = Math.max(...pts.map((p) => p.y));
    expect(ys.every((y) => y >= lo - 0.1 && y <= hi + 0.1)).toBe(true);
    expect(areaPath(pts, 120).endsWith("Z")).toBe(true);
    expect(lineLength(pts)).toBeGreaterThan(0);
    expect(smoothPath([])).toBe("");
  });
  it("a finger finds the nearest point", () => {
    const pts = toPoints([1, 2, 3], 100, 50, { l: 0, r: 0, t: 0, b: 0 }, 3);
    expect(nearest(pts, 3)).toBe(0);
    expect(nearest(pts, 52)).toBe(1);
    expect(nearest(pts, 99)).toBe(2);
  });
  it("donut slices add up to the whole, zero and negative are dropped", () => {
    const s = segments([50, 25, 25, 0, -5]);
    expect(s.map((x) => x.length)).toEqual([0.5, 0.25, 0.25, 0, 0]);
    expect(s[2]!.start).toBe(0.75);
    expect(segments([0, 0]).every((x) => x.length === 0)).toBe(true);
  });
});

describe("the look", () => {
  it("text reads at 4.5:1 or better on the colour behind it (both themes)", () => {
    const pairs: [string, string][] = [[darkColors.text, darkColors.bgBottom], [darkColors.muted, darkColors.bgBottom], [darkColors.primaryText, darkColors.bgBottom], [darkColors.onPrimary, darkColors.primary], [darkColors.text, darkColors.solid],
      [lightColors.text, lightColors.bgTop], [lightColors.muted, lightColors.bgTop], [lightColors.primaryText, lightColors.bgTop], [lightColors.onPrimary, lightColors.primary], [lightColors.text, lightColors.solid], [lightColors.muted, lightColors.solid]];
    for (const [fg, bg] of pairs) expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
  it("status colours read on the solid surface", () => {
    for (const k of ["ok", "warn", "danger", "info"] as const) { expect(contrast(darkColors[k], darkColors.solid)).toBeGreaterThanOrEqual(4.5); expect(contrast(lightColors[k], lightColors.solid)).toBeGreaterThanOrEqual(4.5); }
  });
  it("a phone gets one column, a tablet two or three; the content column stays readable", () => {
    expect(responsive(390, 844).tablet).toBe(false);
    expect(responsive(390, 844).columns(300)).toBe(1);
    expect(responsive(1280, 800).tablet).toBe(true);
    expect(responsive(1280, 800).columns(300)).toBeGreaterThanOrEqual(3);
    expect(responsive(2560, 1600).contentWidth).toBe(1180);
    expect(responsive(900, 1200).columns(340)).toBe(2);
  });
});
