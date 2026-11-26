import { backdrop, role } from "./shared.js";

/**
 * Cyberpunk: dark page, faint neon grid, surfaces with sharp corners and a
 * brand-coloured neon edge, outlined glowing buttons. Always rendered dark
 * (EFFECT_PRESETS.cyberpunk.forcesDark), so there's no light variant here.
 *
 * The neon is the BRAND colour — a red brand gets red neon — and the glow is
 * static box-shadow; the grid is one fixed background layer.
 */
export const css = (s, page) => `
  ${s}{--fx-page-bg: transparent;}
  ${s}{--cp-neon: var(--color-primary); --cp-text: color-mix(in srgb, var(--color-primary) 35%, #ffffff);}

  ${backdrop(page, `
    background:
      radial-gradient(70% 40% at 50% -5%, color-mix(in srgb, var(--cp-neon) 22%, transparent), transparent 70%),
      linear-gradient(color-mix(in srgb, var(--cp-neon) 9%, transparent) 1px, transparent 1px) 0 0 / 44px 44px,
      linear-gradient(90deg, color-mix(in srgb, var(--cp-neon) 9%, transparent) 1px, transparent 1px) 0 0 / 44px 44px,
      var(--color-bg);
  `)}

  ${role(s, "card", `
    --fx-card-radius: 6px;
    --fx-card-bg: color-mix(in srgb, var(--color-surface) 88%, transparent);
    --fx-card-border: 1px solid color-mix(in srgb, var(--cp-neon) 45%, transparent);
    --fx-card-shadow: 0 0 18px color-mix(in srgb, var(--cp-neon) 16%, transparent), inset 0 0 14px color-mix(in srgb, var(--cp-neon) 6%, transparent);
  `)}
  ${role(s, "bar", `
    --fx-bar-bg: color-mix(in srgb, var(--color-bg) 82%, transparent);
    --fx-bar-border: 1px solid color-mix(in srgb, var(--cp-neon) 55%, transparent);
    --fx-bar-shadow: 0 0 24px color-mix(in srgb, var(--cp-neon) 22%, transparent);
    --fx-bar-blur: blur(10px);
  `)}
  ${role(s, "bar", `
    /* the category / filter strip is drawn as a floating panel of its own here: give its contents room from the panel's edge */
    --fx-toolbar-edge: 1px solid color-mix(in srgb, var(--cp-neon) 55%, transparent);
    --fx-toolbar-radius: 6px;
    --fx-toolbar-pad-x: 14px;
  `, "[data-fx-toolbar]")}
  ${role(s, "modal", `
    --fx-modal-radius: 8px;
    --fx-modal-border: 1px solid var(--cp-neon);
    --fx-modal-shadow: 0 0 40px color-mix(in srgb, var(--cp-neon) 30%, transparent), inset 0 0 24px color-mix(in srgb, var(--cp-neon) 8%, transparent);
  `)}
  ${role(s, "btn", `
    --fx-btn-radius: 4px;
    /* Opaque tint, not transparency: the cart bar is fixed over the menu, and text must not show through it. */
    --fx-btn-bg: color-mix(in srgb, var(--cp-neon) 18%, var(--color-bg));
    --fx-btn-color: var(--cp-text);
    --fx-btn-border: 1px solid var(--cp-neon);
    --fx-btn-shadow: 0 0 14px color-mix(in srgb, var(--cp-neon) 55%, transparent), inset 0 0 10px color-mix(in srgb, var(--cp-neon) 30%, transparent);
    text-shadow: 0 0 8px color-mix(in srgb, var(--cp-neon) 70%, transparent);
  `)}
  ${role(s, "btn", `
    --fx-btn-shadow: 0 0 22px color-mix(in srgb, var(--cp-neon) 75%, transparent), inset 0 0 14px color-mix(in srgb, var(--cp-neon) 40%, transparent);
  `, ":hover")}
  ${role(s, "input", `
    --fx-input-radius: 4px;
    --fx-input-bg: color-mix(in srgb, var(--color-bg) 70%, transparent);
    --fx-input-border: 1px solid color-mix(in srgb, var(--cp-neon) 40%, transparent);
  `)}
  ${role(s, "input", `
    --fx-input-shadow: 0 0 0 1px var(--cp-neon), 0 0 14px color-mix(in srgb, var(--cp-neon) 40%, transparent);
  `, ":focus")}
  ${role(s, "chip", `
    --fx-chip-radius: 4px;
    --fx-chip-bg: transparent;
    --fx-chip-border: 1px solid color-mix(in srgb, var(--cp-neon) 35%, transparent);
  `)}
  ${role(s, "chip", `
    --fx-chip-bg: color-mix(in srgb, var(--cp-neon) 16%, transparent);
    --fx-chip-color: var(--cp-text);
    --fx-chip-border: 1px solid var(--cp-neon);
    --fx-chip-shadow: 0 0 14px color-mix(in srgb, var(--cp-neon) 45%, transparent);
  `, '[data-active="true"]')}
`;
