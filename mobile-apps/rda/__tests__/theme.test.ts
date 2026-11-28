import fs from "node:fs";
import path from "node:path";
import type { ConfigContext } from "expo/config";
import { contrast, darkColors, lightColors, navigationTheme, themeFor, type Colors } from "@/ui/theme";

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

describe("RDA is violet (one colour for the app, its icon and its page on the website)", () => {
  it("the brand colour is exactly #764ED1, in the light and the dark theme", () => {
    expect(lightColors.primary.toUpperCase()).toBe("#764ED1");
    expect(darkColors.primary.toUpperCase()).toBe("#764ED1");
  });
  it("it is violet: its hue sits between 250° and 280° (not the old red)", () => {
    for (const c of [lightColors.primary, lightColors.primaryText, darkColors.primary, darkColors.primaryText]) {
      expect(hue(c)).toBeGreaterThanOrEqual(250);
      expect(hue(c)).toBeLessThanOrEqual(280);
    }
  });
  it("the page, the cards and the lines are tinted toward it, so the whole app is one colour", () => {
    for (const palette of [lightColors, darkColors]) for (const c of [palette.bg, palette.surfaceAlt, palette.border]) {
      expect(hue(c)).toBeGreaterThanOrEqual(225);
      expect(hue(c)).toBeLessThanOrEqual(305);
    }
  });
  it("status colours are NOT tinted: 'danger' is still a red and 'success' still a green, in every app", () => {
    expect(hue(lightColors.danger)).toBeLessThan(20);
    expect(hue(lightColors.success)).toBeGreaterThan(110);
    expect(hue(lightColors.success)).toBeLessThan(160);
  });
});

describe("the app follows the phone's light / dark setting, live", () => {
  it("the config asks for automatic (Expo's default is light: the app would ignore the phone's dark mode)", () => {
    let cfg: Record<string, any> = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      cfg = (require("../app.config").default as (c: ConfigContext) => Record<string, any>)({ config: {} } as ConfigContext); // eslint-disable-line @typescript-eslint/no-explicit-any
    });
    expect(cfg.userInterfaceStyle).toBe("automatic");
    expect(cfg.ios?.userInterfaceStyle ?? "automatic").toBe("automatic");
    expect(cfg.android?.userInterfaceStyle ?? "automatic").toBe("automatic");
  });
  it("expo-system-ui is installed (on Android the setting does nothing without it)", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8")) as { dependencies: Record<string, string> };
    expect(pkg.dependencies["expo-system-ui"]).toBeDefined();
  });
  it("the root layout hands the navigator the app's own colours and sets the bottom layer's colour", () => {
    const src = fs.readFileSync(path.join(__dirname, "..", "src", "app", "_layout.tsx"), "utf8");
    expect(src).toMatch(/ThemeProvider value=\{navTheme\}/);
    expect(src).toMatch(/SystemUI\.setBackgroundColorAsync\(c\.bg\)/);
  });
});

describe("the navigator paints the app's own colours (not React Navigation's grey)", () => {
  const base = { dark: false, colors: { primary: "#007AFF", background: "rgb(242, 242, 242)", card: "rgb(255, 255, 255)", text: "rgb(28, 28, 30)", border: "rgb(216, 216, 216)", notification: "rgb(255, 59, 48)" }, fonts: { regular: { fontFamily: "System", fontWeight: "400" } } };
  it.each([["light", lightColors, false], ["dark", darkColors, true]] as const)("in %s the screen, card and border are the app's, and text and accent follow it", (_n, c, dark) => {
    const t = navigationTheme(base, c, dark);
    expect(t.dark).toBe(dark);
    expect(t.colors.background).toBe(c.bg);
    expect(t.colors.card).toBe(c.bg);
    expect(t.colors.border).toBe(c.border);
    expect(t.colors.text).toBe(c.text);
    expect(t.colors.primary).toBe(c.primary);
    expect((t as unknown as { fonts: unknown }).fonts).toEqual(base.fonts); // everything else is kept
  });
});
