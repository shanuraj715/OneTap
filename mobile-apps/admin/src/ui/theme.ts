import { useColorScheme, useWindowDimensions } from "react-native";

/**
 * The look of Rasoi Pulse Admin: GLASS. A deep night-blue (or a soft pastel day) with slowly drifting colour behind frosted, translucent panels.
 * Admin is amber-brown, like OMA is indigo, KDA teal and RDA violet: ONE `primary` (#B45F00) in light AND dark, and exactly the colour of the app's
 * icon tile (brand/rasoi-pulse, app.config.ts) — a test keeps the three equal. `primaryText` is the lighter amber used for accent TEXT on the dark night.
 * Text colours are chosen to read at 4.5:1 or better on the background they sit on (checked by __tests__/theme.test.ts). Follows the phone's light / dark setting.
 */
export interface Colors {
  bgTop: string; bgBottom: string; blobA: string; blobB: string; blobC: string;
  /** frosted panels: the fill, a stronger fill (selected / pressed), the hairline border */
  glass: string; glassStrong: string; border: string;
  /** an input box: a tinted fill and a border that stands out from the panel it sits on (3:1), so a field never melts into the card */
  field: string; fieldBorder: string;
  /** a solid colour for places that must be readable whatever is behind (sheets, the tab bar's fallback) */
  solid: string;
  text: string; muted: string;
  primary: string; onPrimary: string; primaryText: string;
  ok: string; okWash: string; warn: string; warnWash: string; danger: string; dangerWash: string; info: string; infoWash: string;
  overlay: string; shadow: string;
  /** the colour of the 1st, 2nd … series in a chart */
  chart: string[];
}

export const darkColors: Colors = {
  bgTop: "#0A0F24", bgBottom: "#161C3C", blobA: "#FF9008", blobB: "#5B6CFF", blobC: "#FF4D8D",
  glass: "rgba(255,255,255,0.10)", glassStrong: "rgba(255,255,255,0.18)", border: "rgba(255,255,255,0.24)",
  field: "rgba(0,0,0,0.30)", fieldBorder: "rgba(255,255,255,0.42)",
  solid: "#161C3C",
  text: "#F4F6FF", muted: "#AAB2D8",
  primary: "#B45F00", onPrimary: "#FFFFFF", primaryText: "#FFB547",
  ok: "#4ADE9B", okWash: "rgba(74,222,155,0.16)", warn: "#FFC145", warnWash: "rgba(255,193,69,0.16)", danger: "#FF6B7A", dangerWash: "rgba(255,107,122,0.16)", info: "#7CB7FF", infoWash: "rgba(124,183,255,0.16)",
  overlay: "rgba(4,6,18,0.62)", shadow: "#000000",
  chart: ["#FF9A1F", "#7C8CFF", "#4ADE9B", "#FF6FA5", "#5CD6FF", "#C79BFF"],
};
export const lightColors: Colors = {
  bgTop: "#EDF0FF", bgBottom: "#FFF2E2", blobA: "#FFC27A", blobB: "#A9B4FF", blobC: "#FFB3CF",
  glass: "rgba(255,255,255,0.62)", glassStrong: "rgba(255,255,255,0.85)", border: "rgba(255,255,255,0.95)",
  field: "rgba(22,26,51,0.06)", fieldBorder: "rgba(22,26,51,0.50)",
  solid: "#FFFFFF",
  text: "#161A33", muted: "#555D7C",
  primary: "#B45F00", onPrimary: "#FFFFFF", primaryText: "#9A5000",
  ok: "#17703F", okWash: "rgba(23,112,63,0.12)", warn: "#7A5410", warnWash: "rgba(122,84,16,0.12)", danger: "#B1303C", dangerWash: "rgba(177,48,60,0.12)", info: "#1F5C9A", infoWash: "rgba(31,92,154,0.12)",
  overlay: "rgba(20,22,40,0.45)", shadow: "#3A3F70",
  chart: ["#C96A00", "#4A5BE0", "#17935A", "#D0457F", "#1F8FB8", "#8A52D6"],
};

export interface Theme { dark: boolean; c: Colors }
export const themeFor = (dark: boolean): Theme => ({ dark, c: dark ? darkColors : lightColors });
export function useTheme(): Theme {
  return themeFor(useColorScheme() !== "light"); // dark unless the phone says light: glass looks its best at night
}

export const radius = { sm: 10, md: 16, lg: 22, xl: 30, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/**
 * Phone or tablet — and how many columns a grid of cards gets. The same screens serve both: on a tablet the navigation is a side rail and the
 * content is centred in a column of readable width; cards flow into 2–3 columns.
 */
export function useResponsive() {
  const { width, height } = useWindowDimensions();
  return responsive(width, height);
}
export function responsive(width: number, height: number) {
  const tablet = width >= 700;
  const content = Math.min(width - (tablet ? 96 : 0), 1180);
  return {
    width, height, tablet, landscape: width > height,
    /** the width the content column takes */
    contentWidth: content,
    /** columns for cards that want ~`min` pixels each */
    columns: (min = 300) => Math.max(1, Math.min(4, Math.floor((content - 32) / min))),
  };
}

/** WCAG contrast of two #RRGGBB colours (used by the theme test). */
export function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/**
 * The theme the NAVIGATOR paints with. By default it paints rgb(242,242,242) behind every screen — on iOS that grey covers the app's own background
 * (the gradient and blobs) in light AND dark, so dark's pale text lands on light grey and vanishes. Every colour that can fill the screen is fully
 * transparent here, so what the person sees is the app's own Background; text and accent follow the app's theme. `base` is React Navigation's
 * DefaultTheme or DarkTheme (passed in so this stays plain and testable).
 */
export const CLEAR = "rgba(0,0,0,0)";
export function navigationTheme<T extends { dark: boolean; colors: object }>(base: T, c: Colors, dark: boolean): T {
  return { ...base, dark, colors: { ...base.colors, background: CLEAR, card: CLEAR, border: CLEAR, text: c.text, primary: c.primary, notification: c.primary } } as T;
}
