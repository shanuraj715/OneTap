import { formatDelta, formatMoney } from "@/lib/money";
import { clock, countdown, elapsed } from "@/lib/time";
import { BREAKPOINTS, layoutFor } from "@/lib/layout";
import { API_URL, APP_NAME, APP_VERSION } from "@/lib/config";

describe("money (paise → ₹)", () => {
  it.each([
    [0, "₹0"], [9000, "₹90"], [34050, "₹340.50"], [5, "₹0.05"], [99, "₹0.99"], [100, "₹1"],
    [99900, "₹999"], [100000, "₹1,000"], [123456700, "₹12,34,567"], [1000000, "₹10,000"], [12345678, "₹1,23,456.78"],
    [-5000, "−₹50"],
  ])("%p → %p", (paise, text) => expect(formatMoney(paise)).toBe(text));
  it("never shows NaN", () => { expect(formatMoney(NaN)).toBe("₹–"); expect(formatMoney(Infinity)).toBe("₹–"); });
  it("price changes of add-ons", () => { expect(formatDelta(1000)).toBe("+₹10"); expect(formatDelta(-500)).toBe("−₹5"); expect(formatDelta(0)).toBe(""); });
});

describe("time", () => {
  const now = new Date("2026-11-26T12:00:00Z").getTime();
  const ago = (min: number) => new Date(now - min * 60_000).toISOString();
  it("says how long ago", () => {
    expect(elapsed(ago(0), now)).toBe("just now");
    expect(elapsed(ago(12), now)).toBe("12 min");
    expect(elapsed(ago(65), now)).toBe("1 h 05 min");
    expect(elapsed(ago(60 * 30), now)).toBe("1 d");
    expect(elapsed(null, now)).toBe("");
    expect(elapsed("not a date", now)).toBe("");
    expect(elapsed(new Date(now + 5 * 60_000).toISOString(), now)).toBe("just now"); // a clock a little ahead is not "-5 min"
  });
  it("shows a clock time", () => {
    expect(clock(new Date(2026, 10, 26, 19, 42).toISOString())).toBe("7:42 pm");
    expect(clock(new Date(2026, 10, 26, 0, 5).toISOString())).toBe("12:05 am");
    expect(clock(new Date(2026, 10, 26, 12, 0).toISOString())).toBe("12:00 pm");
    expect(clock("")).toBe("");
  });
  it("counts down", () => { expect(countdown(45)).toBe("45 s"); expect(countdown(65)).toBe("1 min 05 s"); expect(countdown(3700)).toBe("1 h 01 min"); expect(countdown(-3)).toBe("0 s"); });
});

describe("layout: phones and tablets, portrait and landscape", () => {
  it("names the three sizes at the documented breakpoints", () => {
    expect(layoutFor(BREAKPOINTS.tablet - 1, 800).kind).toBe("phone");
    expect(layoutFor(BREAKPOINTS.tablet, 800).kind).toBe("tablet");
    expect(layoutFor(BREAKPOINTS.wide - 1, 1200).kind).toBe("tablet");
    expect(layoutFor(BREAKPOINTS.wide, 800).kind).toBe("wide");
  });
  it("a phone in portrait: one panel, one dish column, a form as wide as the screen", () => {
    const l = layoutFor(393, 851);
    expect(l).toMatchObject({ kind: "phone", split: false, landscape: false, menuColumns: 1, contentMaxWidth: 393, sidePanelWidth: 0 });
    expect(l.tableColumns).toBeGreaterThanOrEqual(2);
  });
  it("a phone in landscape is still a phone (not split) but knows it is landscape", () => {
    expect(layoutFor(800 - 160, 393)).toMatchObject({ kind: "tablet" }); // 640dp wide = a big phone / small tablet
    expect(layoutFor(592, 360)).toMatchObject({ kind: "phone", landscape: true, split: false });
  });
  it("a tablet held upright: roomier grids, still one panel, a form that does not stretch", () => {
    const l = layoutFor(800, 1280);
    expect(l).toMatchObject({ kind: "tablet", split: false, landscape: false, contentMaxWidth: 560 });
    expect(l.tableColumns).toBeGreaterThan(layoutFor(393, 851).tableColumns);
    expect(l.menuColumns).toBeGreaterThanOrEqual(2);
  });
  it("a tablet on its side: list and detail side by side, with a side panel of a sensible width", () => {
    const l = layoutFor(1280, 800);
    expect(l).toMatchObject({ kind: "wide", split: true, landscape: true });
    expect(l.sidePanelWidth).toBeGreaterThanOrEqual(340);
    expect(l.sidePanelWidth).toBeLessThanOrEqual(440);
    expect(l.tableColumns).toBeLessThanOrEqual(8);
    expect(l.menuColumns).toBeLessThanOrEqual(4);
  });
  it("the number of columns never leaves 2..8 whatever the size", () => {
    for (const w of [280, 360, 600, 840, 1024, 1920, 3000]) {
      const l = layoutFor(w, 900);
      expect(l.tableColumns).toBeGreaterThanOrEqual(2);
      expect(l.tableColumns).toBeLessThanOrEqual(8);
    }
  });
});

describe("config", () => {
  it("is named Rasoi Pulse OMA and carries the version", () => {
    expect(APP_NAME).toBe("Rasoi Pulse OMA");
    expect(APP_VERSION).toBe("v-261126-001");
    expect(API_URL).toBe("https://api.example.test");
  });
});

import { columnsForWidth } from "@/lib/layout";

describe("how many table cards fit in a row (from the room the list really has)", () => {
  it.each([
    [120, 2], [320, 2], [390, 2], [482, 3], [740, 5], [840, 6], [1100, 8], [3000, 8],
  ])("%i dp wide → %i a row", (width, expected) => expect(columnsForWidth(width)).toBe(expected));
  it("never fewer than two, never more than eight", () => {
    for (let w = 0; w <= 4000; w += 37) { const n = columnsForWidth(w); expect(n).toBeGreaterThanOrEqual(2); expect(n).toBeLessThanOrEqual(8); }
  });
  it("a card is never narrower than its minimum once there is room for more than two", () => {
    for (let w = 300; w <= 2000; w += 11) { const n = columnsForWidth(w); if (n > 2) expect((w - 24) / n).toBeGreaterThanOrEqual(132); }
  });
});
