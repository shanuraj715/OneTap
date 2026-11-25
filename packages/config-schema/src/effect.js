import { z } from "zod";

/**
 * A storefront-wide surface treatment, independent of the colour palette —
 * the same red brand can be flat, glassy or neon. Only metadata lives here;
 * each effect's actual CSS is in `@rasoipulse/ui/effects`, loaded one at a time
 * so neither the admin bundle nor any visitor ever downloads the other five.
 */
export const EFFECT_IDS = ["none", "glass", "neumorph", "clay", "aurora", "cyberpunk", "dark-premium"];

export const effectSchema = z.object({
  style: z.enum(EFFECT_IDS).default("none"),
});

/**
 * Suggested palettes deliberately leave out `colorPrimary`/`colorOnPrimary`:
 * the brand colour is the store's identity, so an effect adapts to it (glows
 * and gradients are derived from it) rather than replacing it.
 *
 * `forcesDark` effects only make sense on a dark page, so the storefront
 * renders them dark whatever the theme's light/dark setting says, and their
 * palette goes into the dark token set.
 */
export const EFFECT_PRESETS = {
  none: {
    label: "None",
    description: "Flat, clean surfaces — the classic look.",
    forcesDark: false,
    palette: null,
  },
  glass: {
    label: "Glassmorphism",
    description: "Frosted, translucent surfaces floating over a soft gradient.",
    forcesDark: false,
    palette: {
      light: { colorBg: "#EEF1F7", colorSurface: "#FFFFFF", colorText: "#14161C", colorTextMuted: "#5B6170", colorBorder: "#DDE2EC" },
      dark: { colorBg: "#0E1118", colorSurface: "#1A1F2B", colorText: "#EDEFF5", colorTextMuted: "#9AA1B2", colorBorder: "#2A3142" },
    },
  },
  neumorph: {
    label: "Neumorphism",
    description: "Soft, monochrome UI with raised and pressed-in surfaces.",
    forcesDark: false,
    palette: {
      light: { colorBg: "#E6E9EF", colorSurface: "#E6E9EF", colorText: "#2B2F38", colorTextMuted: "#5A606C", colorBorder: "#D5D9E0" },
      dark: { colorBg: "#262A31", colorSurface: "#262A31", colorText: "#E4E7EC", colorTextMuted: "#9CA3AF", colorBorder: "#33383F" },
    },
  },
  clay: {
    label: "Claymorphism",
    description: "Puffy, rounded 3D cards in friendly pastel tones.",
    forcesDark: false,
    palette: {
      light: { colorBg: "#F6F0FF", colorSurface: "#FFFFFF", colorText: "#2E2A3B", colorTextMuted: "#6E6880", colorBorder: "#EAE2F7" },
      dark: { colorBg: "#221D2E", colorSurface: "#2D2740", colorText: "#F1ECFA", colorTextMuted: "#A79FBD", colorBorder: "#3A3350" },
    },
  },
  aurora: {
    label: "Aurora",
    description: "Slowly drifting purple, blue, pink and cyan light behind the page.",
    forcesDark: false,
    palette: {
      light: { colorBg: "#F5F3FF", colorSurface: "#FFFFFF", colorText: "#1B1530", colorTextMuted: "#625C7A", colorBorder: "#E4DEF7" },
      dark: { colorBg: "#0B0A1A", colorSurface: "#15132B", colorText: "#EEEAFE", colorTextMuted: "#A39DC4", colorBorder: "#2A2650" },
    },
  },
  cyberpunk: {
    label: "Cyberpunk",
    description: "Dark, neon-glow borders and buttons over a faint grid. Always dark.",
    forcesDark: true,
    palette: {
      dark: { colorBg: "#07060D", colorSurface: "#0F0E1A", colorText: "#E8F7FF", colorTextMuted: "#8A93B8", colorBorder: "#232046" },
    },
  },
  "dark-premium": {
    label: "Dark Premium",
    description: "Deep black, refined borders and soft accent highlights. Always dark.",
    forcesDark: true,
    palette: {
      dark: { colorBg: "#0B0B0C", colorSurface: "#151517", colorText: "#F2EFE9", colorTextMuted: "#9C978E", colorBorder: "#26252A" },
    },
  },
};

export const effectPreset = (style) => EFFECT_PRESETS[style] ?? EFFECT_PRESETS.none;
