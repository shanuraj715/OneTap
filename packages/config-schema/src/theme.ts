import { z } from "zod";

/**
 * Semantic design tokens. Every UI component reads ONLY these — never a hard-coded
 * colour, radius or font. The admin theme editor writes these values; the storefront
 * emits them as CSS custom properties (`--color-primary`, ...).
 */
export const themeTokensSchema = z.object({
  colorPrimary: z.string().default("#C6362F"),
  colorOnPrimary: z.string().default("#FFFFFF"),
  colorBg: z.string().default("#FFFFFF"),
  colorSurface: z.string().default("#F6F6F4"),
  colorText: z.string().default("#1A1A1A"),
  colorTextMuted: z.string().default("#6B6B6B"),
  colorBorder: z.string().default("#E4E4E0"),
  radiusCard: z.string().default("12px"),
  fontHeading: z.string().default("'Inter', system-ui, sans-serif"),
  fontBody: z.string().default("'Inter', system-ui, sans-serif"),
});
export type ThemeTokens = z.infer<typeof themeTokensSchema>;

export const themeSchema = z.object({
  /** how the storefront decides light vs dark */
  mode: z.enum(["light", "dark", "system", "visitor-toggle"]).default("system"),
  /** fallback when mode is "visitor-toggle" and the visitor hasn't chosen */
  defaultMode: z.enum(["light", "dark"]).default("light"),
  light: themeTokensSchema.default({}),
  /** only the tokens that differ in dark mode */
  dark: themeTokensSchema.partial().default({}),
});
export type Theme = z.infer<typeof themeSchema>;

/** Turn resolved tokens into a CSS custom-property block. */
export function tokensToCssVars(tokens: ThemeTokens): Record<string, string> {
  return {
    "--color-primary": tokens.colorPrimary,
    "--color-on-primary": tokens.colorOnPrimary,
    "--color-bg": tokens.colorBg,
    "--color-surface": tokens.colorSurface,
    "--color-text": tokens.colorText,
    "--color-text-muted": tokens.colorTextMuted,
    "--color-border": tokens.colorBorder,
    "--radius-card": tokens.radiusCard,
    "--font-heading": tokens.fontHeading,
    "--font-body": tokens.fontBody,
  };
}

/**
 * Semantic status colours. Independent of the brand accent on purpose — "this
 * failed" must not change meaning because someone picked a red brand colour.
 */
/** Semantic status colours. Exported so an admin preview can scope them too. */
export const TONES_LIGHT: Record<string, string> = {
  "--tone-info": "#1F5C7A",
  "--tone-info-wash": "#DCEAF1",
  "--tone-success": "#2E7D46",
  "--tone-success-wash": "#DEEDE0",
  "--tone-warning": "#8F6410",
  "--tone-warning-wash": "#F3E7CF",
  "--tone-danger": "#A5382F",
  "--tone-danger-wash": "#F1DDD9",
};
export const TONES_DARK: Record<string, string> = {
  "--tone-info": "#6FA9C4",
  "--tone-info-wash": "#17262D",
  "--tone-success": "#74C08D",
  "--tone-success-wash": "#17281C",
  "--tone-warning": "#D6A24C",
  "--tone-warning-wash": "#2B2314",
  "--tone-danger": "#E3877A",
  "--tone-danger-wash": "#2E1C19",
};

/** Sensible dark surfaces when an outlet hasn't designed its own dark palette. */
const DARK_FALLBACK: Partial<ThemeTokens> = {
  colorBg: "#14130F",
  colorSurface: "#1E1C17",
  colorText: "#ECE6D8",
  colorTextMuted: "#9A9384",
  colorBorder: "#34302A",
};

/**
 * Resolve the dark token set. An outlet that hasn't set `theme.dark` must NOT
 * simply inherit the light palette — that leaves dark text on dark surfaces once
 * the status washes flip. Brand colour, radius and fonts do carry over.
 */
export function resolveDarkTokens(theme: Theme): ThemeTokens {
  const light = themeTokensSchema.parse(theme.light ?? {});
  return themeTokensSchema.parse({ ...light, ...DARK_FALLBACK, ...(theme.dark ?? {}) });
}

/**
 * Full CSS for an outlet's theme: light tokens on :root, dark tokens on the
 * explicit toggle and on prefers-color-scheme. Emitted into the document head
 * by the storefront — this is how "apply a theme in admin" reaches every component.
 */
export function themeCss(theme: Theme): string {
  const light = themeTokensSchema.parse(theme.light ?? {});
  const dark = resolveDarkTokens(theme);

  const block = (vars: Record<string, string>, indent = "  ") =>
    Object.entries(vars)
      .map(([k, v]) => `${indent}${k}: ${v};`)
      .join("\n");

  const lightVars = { ...tokensToCssVars(light), ...TONES_LIGHT };
  const darkVars = { ...tokensToCssVars(dark), ...TONES_DARK };

  return [
    `:root {\n${block(lightVars)}\n}`,
    `:root[data-theme="dark"] {\n${block(darkVars)}\n}`,
    `@media (prefers-color-scheme: dark) {\n  :root:not([data-theme="light"]) {\n${block(darkVars, "    ")}\n  }\n}`,
  ].join("\n");
}
