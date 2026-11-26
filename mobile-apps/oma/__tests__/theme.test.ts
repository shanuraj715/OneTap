import { contrast, darkColors, lightColors, themeFor, type Colors } from "@/ui/theme";

const READABLE = 4.5;
const pairs = (c: Colors): Array<[string, string, string]> => [
  ["text on the page", c.text, c.bg], ["text on a card", c.text, c.surface], ["text on a raised card", c.text, c.surfaceAlt],
  ["muted text on the page", c.muted, c.bg], ["muted text on a card", c.muted, c.surface], ["muted text on a raised card", c.muted, c.surfaceAlt],
  ["brand text on the page", c.primaryText, c.bg], ["brand text on a card", c.primaryText, c.surface], ["brand text on a raised card", c.primaryText, c.surfaceAlt],
  ["button label on the brand colour", c.onPrimary, c.primary],
  ["info", c.info, c.infoWash], ["success", c.success, c.successWash], ["warning", c.warning, c.warningWash], ["danger", c.danger, c.dangerWash],
];

describe.each([["light", lightColors], ["dark", darkColors]] as const)("the %s colours", (name, colors) => {
  it.each(pairs(colors))(`${name}: %s reads at ${READABLE}:1 or better`, (_label, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(READABLE);
  });
  it("status colours also read on the plain card (not only on their own wash)", () => {
    for (const fg of [colors.info, colors.success, colors.warning, colors.danger]) expect(contrast(fg, colors.surface)).toBeGreaterThanOrEqual(READABLE);
  });
});

describe("the helpers", () => {
  it("contrast is 21 for black on white and 1 for the same colour", () => { expect(contrast("#000000", "#FFFFFF")).toBeCloseTo(21, 0); expect(contrast("#777777", "#777777")).toBeCloseTo(1, 5); });
  it("picks the palette by the phone's setting", () => { expect(themeFor(true).c).toBe(darkColors); expect(themeFor(false).c).toBe(lightColors); });
});

/** The hue (0–360°) of a #RRGGBB colour. */
const hue = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};

describe("OMA is indigo (one colour for the app, its icon and its page on the website)", () => {
  it("the brand colour is exactly #404DB6, in the light and the dark theme", () => {
    expect(lightColors.primary.toUpperCase()).toBe("#404DB6");
    expect(darkColors.primary.toUpperCase()).toBe("#404DB6");
  });
  it("it is indigo: its hue sits between 215° and 250° (not the old red)", () => {
    for (const c of [lightColors.primary, lightColors.primaryText, darkColors.primary, darkColors.primaryText]) {
      expect(hue(c)).toBeGreaterThanOrEqual(215);
      expect(hue(c)).toBeLessThanOrEqual(250);
    }
  });
  it("the page, the cards and the lines are tinted toward it, so the whole app is one colour", () => {
    for (const palette of [lightColors, darkColors]) for (const c of [palette.bg, palette.surfaceAlt, palette.border]) {
      expect(hue(c)).toBeGreaterThanOrEqual(190);
      expect(hue(c)).toBeLessThanOrEqual(275);
    }
  });
  it("status colours are NOT tinted: 'danger' is still a red and 'success' still a green, in every app", () => {
    expect(hue(lightColors.danger)).toBeLessThan(20);
    expect(hue(lightColors.success)).toBeGreaterThan(110);
    expect(hue(lightColors.success)).toBeLessThan(160);
  });
});
