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
