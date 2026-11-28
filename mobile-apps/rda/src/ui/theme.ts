import { useColorScheme } from "react-native";

/**
 * The look of the app, in light and dark (it follows the phone's setting). Every colour that carries text is chosen so the text reads at
 * 4.5:1 or better against what it sits on (checked by __tests__/theme.test.ts). Status colours follow the platform's own set, so
 * "ready" or "sold out" means the same thing here as on the dashboard.
 */
export interface Colors {
  bg: string; surface: string; surfaceAlt: string; border: string;
  text: string; muted: string;
  primary: string; onPrimary: string;
  /** the brand colour as TEXT or a small icon on bg / surface (lighter on dark so it stays readable) */
  primaryText: string;
  overlay: string;
  info: string; infoWash: string; success: string; successWash: string; warning: string; warningWash: string; danger: string; dangerWash: string;
}

/**
 * RDA (Rider Delivery App) is violet: the app's own colour, shared with its icon (the icon's tile is exactly `primary`) and its page on the website. Light, dark and
 * the neutrals are tinted toward it so the whole app reads as one colour. The status colours below are NOT tinted: "ready", "sold out" or "late"
 * mean the same thing in every app and on the dashboard.
 */
export const lightColors: Colors = {
  bg: "#F8F6FC", surface: "#FFFFFF", surfaceAlt: "#EEE9F8", border: "#DDD5EE",
  text: "#1E1A2B", muted: "#5E5775",
  primary: "#764ED1", onPrimary: "#FFFFFF", primaryText: "#6B43C4",
  overlay: "rgba(20,19,15,0.5)",
  info: "#1F5C7A", infoWash: "#DCEAF1", success: "#256B3B", successWash: "#DEEDE0", warning: "#7A5410", warningWash: "#F3E7CF", danger: "#A5382F", dangerWash: "#F1DDD9",
};

export const darkColors: Colors = {
  bg: "#14111C", surface: "#1D1928", surfaceAlt: "#282336", border: "#3B3450",
  text: "#EEE9F7", muted: "#B7B0C9",
  primary: "#764ED1", onPrimary: "#FFFFFF", primaryText: "#C4A8FF",
  overlay: "rgba(0,0,0,0.65)",
  info: "#6FA9C4", infoWash: "#17262D", success: "#74C08D", successWash: "#17281C", warning: "#D6A24C", warningWash: "#2B2314", danger: "#E3877A", dangerWash: "#2E1C19",
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export interface Theme { dark: boolean; c: Colors }
export const themeFor = (dark: boolean): Theme => ({ dark, c: dark ? darkColors : lightColors });
export function useTheme(): Theme {
  return themeFor(useColorScheme() === "dark");
}

/**
 * The theme the NAVIGATOR paints with. React Navigation's own light theme paints a pale grey behind every screen (and its dark theme a near-black):
 * on iOS that grey shows through and hides the other mode. Here the screen, card and border colours are the app's own, so light and dark both look
 * as designed. `base` is React Navigation's DefaultTheme or DarkTheme (passed in so this stays plain and testable).
 */
export function navigationTheme<T extends { dark: boolean; colors: object }>(base: T, c: Colors, dark: boolean): T {
  return { ...base, dark, colors: { ...base.colors, background: c.bg, card: c.bg, border: c.border, text: c.text, primary: c.primary, notification: c.primary } } as T;
}

/** WCAG contrast ratio between two #RRGGBB colours (used by the tests and by anything that must pick a readable colour). */
export function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}
