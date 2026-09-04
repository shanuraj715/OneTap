import { z } from "zod";

export interface FontFamily {
  id: string;
  name: string;
  /** CSS font-family stack, always ending in a real fallback */
  stack: string;
  /** Google Fonts family spec, or null for system fonts */
  google: string | null;
  category: "sans" | "serif" | "display" | "mono";
}

/**
 * Curated font catalogue. Owners pick from this list rather than uploading files —
 * web-font licensing is the tenant's legal risk, so arbitrary uploads stay off.
 * Adding a face is one entry here.
 */
export const FONT_FAMILIES: FontFamily[] = [
  { id: "system", name: "System UI", stack: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", google: null, category: "sans" },
  { id: "inter", name: "Inter", stack: "'Inter', system-ui, sans-serif", google: "Inter:wght@400;500;600;700", category: "sans" },
  { id: "dm-sans", name: "DM Sans", stack: "'DM Sans', system-ui, sans-serif", google: "DM+Sans:wght@400;500;700", category: "sans" },
  { id: "poppins", name: "Poppins", stack: "'Poppins', system-ui, sans-serif", google: "Poppins:wght@400;500;600;700", category: "sans" },
  { id: "manrope", name: "Manrope", stack: "'Manrope', system-ui, sans-serif", google: "Manrope:wght@400;500;700;800", category: "sans" },
  { id: "outfit", name: "Outfit", stack: "'Outfit', system-ui, sans-serif", google: "Outfit:wght@400;500;600;700", category: "sans" },
  { id: "work-sans", name: "Work Sans", stack: "'Work Sans', system-ui, sans-serif", google: "Work+Sans:wght@400;500;600;700", category: "sans" },
  { id: "jakarta", name: "Plus Jakarta Sans", stack: "'Plus Jakarta Sans', system-ui, sans-serif", google: "Plus+Jakarta+Sans:wght@400;500;700;800", category: "sans" },
  { id: "figtree", name: "Figtree", stack: "'Figtree', system-ui, sans-serif", google: "Figtree:wght@400;500;600;800", category: "sans" },
  { id: "plex-sans", name: "IBM Plex Sans", stack: "'IBM Plex Sans', system-ui, sans-serif", google: "IBM+Plex+Sans:wght@400;500;600;700", category: "sans" },
  { id: "space-grotesk", name: "Space Grotesk", stack: "'Space Grotesk', system-ui, sans-serif", google: "Space+Grotesk:wght@400;500;700", category: "sans" },
  { id: "playfair", name: "Playfair Display", stack: "'Playfair Display', Georgia, serif", google: "Playfair+Display:wght@400;600;700;800", category: "serif" },
  { id: "lora", name: "Lora", stack: "'Lora', Georgia, serif", google: "Lora:wght@400;500;600;700", category: "serif" },
  { id: "source-serif", name: "Source Serif 4", stack: "'Source Serif 4', Georgia, serif", google: "Source+Serif+4:wght@400;600;700", category: "serif" },
  { id: "fraunces", name: "Fraunces", stack: "'Fraunces', Georgia, serif", google: "Fraunces:wght@400;600;700;900", category: "serif" },
  { id: "bitter", name: "Bitter", stack: "'Bitter', Georgia, serif", google: "Bitter:wght@400;500;700", category: "serif" },
  { id: "bebas", name: "Bebas Neue", stack: "'Bebas Neue', Impact, sans-serif", google: "Bebas+Neue", category: "display" },
  { id: "archivo-black", name: "Archivo Black", stack: "'Archivo Black', Impact, sans-serif", google: "Archivo+Black", category: "display" },
  { id: "plex-mono", name: "IBM Plex Mono", stack: "'IBM Plex Mono', ui-monospace, monospace", google: "IBM+Plex+Mono:wght@400;500;600", category: "mono" },
];

export const fontById = (id: string): FontFamily =>
  FONT_FAMILIES.find((f) => f.id === id) ?? FONT_FAMILIES[0]!;

export const TYPE_SCALES = {
  compact: { ratio: 1.15, lineHeight: 1.45, label: "Compact" },
  default: { ratio: 1.25, lineHeight: 1.6, label: "Default" },
  spacious: { ratio: 1.33, lineHeight: 1.75, label: "Spacious" },
} as const;

const LETTER_SPACING = { tight: "-0.02em", normal: "0", wide: "0.04em" } as const;

export const typographySchema = z.object({
  headingFont: z.string().default("inter"),
  bodyFont: z.string().default("inter"),
  /** root font size in px */
  baseSize: z.number().min(12).max(22).default(16),
  scale: z.enum(["compact", "default", "spacious"]).default("default"),
  headingWeight: z.number().min(300).max(900).default(700),
  headingLetterSpacing: z.enum(["tight", "normal", "wide"]).default("tight"),
  uppercaseHeadings: z.boolean().default(false),
});
export type Typography = z.infer<typeof typographySchema>;

/** The stylesheet URL for whichever Google fonts this outlet uses, if any. */
export function googleFontsUrl(t: Typography): string | null {
  const specs = [fontById(t.headingFont), fontById(t.bodyFont)]
    .map((f) => f.google)
    .filter((g): g is string => Boolean(g));
  const unique = [...new Set(specs)];
  if (unique.length === 0) return null;
  return `https://fonts.googleapis.com/css2?${unique.map((g) => `family=${g}`).join("&")}&display=swap`;
}

/** Typography tokens, emitted alongside the colour tokens. */
export function typographyCss(t: Typography): string {
  const scale = TYPE_SCALES[t.scale];
  const step = (n: number) => `${Math.round(scale.ratio ** n * 1000) / 1000}rem`;
  return [
    ":root {",
    `  --font-heading: ${fontById(t.headingFont).stack};`,
    `  --font-body: ${fontById(t.bodyFont).stack};`,
    `  --font-size-base: ${t.baseSize}px;`,
    `  --line-height-body: ${scale.lineHeight};`,
    `  --font-weight-heading: ${t.headingWeight};`,
    `  --letter-spacing-heading: ${LETTER_SPACING[t.headingLetterSpacing]};`,
    `  --text-transform-heading: ${t.uppercaseHeadings ? "uppercase" : "none"};`,
    `  --text-sm: ${step(-1)};`,
    `  --text-md: ${step(0)};`,
    `  --text-lg: ${step(1)};`,
    `  --text-xl: ${step(2)};`,
    `  --text-2xl: ${step(3)};`,
    `  --text-3xl: ${step(4)};`,
    "}",
  ].join("\n");
}
