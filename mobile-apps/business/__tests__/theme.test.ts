import fs from "node:fs";
import path from "node:path";
import type { ConfigContext } from "expo/config";
import { darkColors, lightColors, navigationTheme, type Colors } from "@/ui/theme";

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const contrast = (a: string, b: string) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi! + 0.05) / (lo! + 0.05); };
/** "rgba(r,g,b,a)" laid over a solid "#rrggbb" ground, as "#rrggbb" */
const over = (rgba: string, ground: string) => {
  const m = /rgba\((\d+),(\d+),(\d+),([\d.]+)\)/.exec(rgba)!;
  const a = Number(m[4]);
  const g = [1, 3, 5].map((i) => parseInt(ground.slice(i, i + 2), 16));
  return "#" + [1, 2, 3].map((k, i) => Math.round(Number(m[k]) * a + g[i]! * (1 - a)).toString(16).padStart(2, "0")).join("");
};
const MODES: [string, Colors][] = [["dark", darkColors], ["light", lightColors]];
const hex = (c: string) => c.toUpperCase();

describe("the icon and the app share one colour (like OMA indigo, KDA teal, RDA violet, Admin amber — the Business app is rose)", () => {
  const cfg = () => {
    let out: Record<string, any> = {};
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      out = (require("../app.config").default as (c: ConfigContext) => Record<string, any>)({ config: {} } as ConfigContext);
    });
    return out;
  };
  it("the Android icon's background is exactly the app's primary colour (#C2185B), in light AND dark", () => {
    const tile = hex(cfg().android.adaptiveIcon.backgroundColor);
    expect(tile).toBe("#C2185B");
    expect(tile).toBe(hex(lightColors.primary));
    expect(tile).toBe(hex(darkColors.primary));
  });
  it("the brand build draws the Business icon's tile in that same colour", () => {
    const src = fs.readFileSync(path.join(__dirname, "..", "..", "..", "brand", "rasoi-pulse", "build.mjs"), "utf8");
    expect(src).toMatch(/business: \{ code: "BIZ", label: "Rasoi Pulse Business", tile: "#c2185b" \}/i);
  });
  it("the icon file itself is that colour (its top-left pixel is the tile)", () => {
    // the generated PNG's background layer is a flat fill of the tile colour; the SVG next to it says which
    const svg = fs.readFileSync(path.join(__dirname, "..", "..", "..", "brand", "rasoi-pulse", "business-app-icon", "android-adaptive", "LAYER-background-no-icon.svg"), "utf8");
    expect(svg.toLowerCase()).toContain('fill="#c2185b"');
  });
});

describe.each(MODES)("the %s colours are readable", (_name, c) => {
  const grounds = (): string[] => [c.bgTop, c.bgBottom].map((g) => g.toUpperCase());
  it("the text on the button (onPrimary on primary) is at least 4.5:1", () => expect(contrast(c.onPrimary, c.primary)).toBeGreaterThanOrEqual(4.5));
  it("body text, muted text and the accent text read on both ends of the background", () => {
    for (const g of grounds()) for (const t of [c.text, c.muted, c.primaryText]) expect(contrast(t, g)).toBeGreaterThanOrEqual(4.5);
  });
  it("the state colours (ok, warning, danger, info) read as text on the background", () => {
    for (const g of grounds()) for (const t of [c.ok, c.warn, c.danger, c.info]) expect(contrast(t, g)).toBeGreaterThanOrEqual(4.5);
  });
});

describe.each(MODES)("the %s input boxes stand out from the panel they sit on", (_name, c) => {
  it("the border is at least 3:1 against the panel (a box must not melt into the card)", () => {
    expect(contrast(over(c.fieldBorder, c.solid), c.solid)).toBeGreaterThanOrEqual(3);
  });
  it("the fill is not the panel's own colour, and the typed text and placeholder read on it", () => {
    const fill = over(c.field, c.solid);
    expect(fill).not.toBe(c.solid.toLowerCase());
    expect(contrast(c.text, fill)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.muted, fill)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("the app follows the phone's light / dark setting, live", () => {
  it("the config asks for automatic (Expo's default is light: the app would ignore dark mode)", () => {
    let cfg: Record<string, any> = {};
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      cfg = (require("../app.config").default as (c: ConfigContext) => Record<string, any>)({ config: {} } as ConfigContext);
    });
    expect(cfg.userInterfaceStyle).toBe("automatic");
    expect(cfg.ios?.userInterfaceStyle ?? "automatic").toBe("automatic");
    expect(cfg.android?.userInterfaceStyle ?? "automatic").toBe("automatic");
  });
  it("expo-system-ui is installed (on Android the setting does nothing without it)", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8")) as { dependencies: Record<string, string> };
    expect(pkg.dependencies["expo-system-ui"]).toBeDefined();
  });
});

describe("in dark, a panel can be told apart from the night behind it", () => {
  it("the panel's fill differs from the background, and its edge is clearly drawn", () => {
    const c = darkColors, ground = c.bgBottom;
    expect(contrast(over(c.glass, ground), ground)).toBeGreaterThanOrEqual(1.1);
    expect(contrast(over(c.border, over(c.glass, ground)), over(c.glass, ground))).toBeGreaterThanOrEqual(1.35);
  });
});

describe("the navigator paints nothing over the app's own background (the grey that hid dark mode on iOS)", () => {
  // React Navigation's own light theme: a grey screen background that, on iOS, covers the gradient behind the app
  const base = { dark: false, colors: { primary: "#007AFF", background: "rgb(242, 242, 242)", card: "rgb(255, 255, 255)", text: "rgb(28, 28, 30)", border: "rgb(216, 216, 216)", notification: "rgb(255, 59, 48)" }, fonts: { regular: { fontFamily: "System", fontWeight: "400" } } };
  it.each(MODES)("in %s every colour that can fill the screen is fully transparent, and the text follows the app's theme", (_name, c) => {
    const t = navigationTheme(base, c, c === darkColors);
    for (const k of ["background", "card", "border"] as const) expect(t.colors[k]).toBe("rgba(0,0,0,0)");
    expect(t.colors.text).toBe(c.text);
    expect(t.colors.primary).toBe(c.primary);
    expect(t.dark).toBe(c === darkColors);
    expect(t.fonts).toBe(base.fonts); // everything else of the base theme is kept
  });
  it("the root layout wraps the stack in that theme", () => {
    const src = fs.readFileSync(path.join(__dirname, "..", "src", "app", "_layout.tsx"), "utf8");
    expect(src).toMatch(/<ThemeProvider value=\{navTheme\}>[\s\S]*<Stack /);
    expect(src).toContain("navigationTheme(dark ? DarkTheme : DefaultTheme");
  });
});
