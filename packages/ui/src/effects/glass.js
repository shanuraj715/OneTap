import { backdrop, modeVars, role } from "./shared.js";

/**
 * Glassmorphism: translucent surfaces with a bright hairline edge, floating
 * over a soft gradient built from the brand colour.
 *
 * Backdrop blur is reserved for the handful of chrome surfaces (header, cart
 * bar, dialogs). Item cards stay translucent WITHOUT blur — a menu can hold
 * dozens of them, and blurring each one makes scrolling stutter on mid-range
 * phones. Over a smooth gradient the difference is hard to see anyway.
 */
export const css = (s, page) => `
  ${s}{--fx-page-bg: transparent;}
  ${modeVars(s,
    { "--gl-edge": "rgba(255,255,255,.6)", "--gl-shade": "rgba(22,30,56,.10)", "--gl-tint": "62%" },
    { "--gl-edge": "rgba(255,255,255,.10)", "--gl-shade": "rgba(0,0,0,.45)", "--gl-tint": "58%" },
  )}

  ${backdrop(page, `
    background:
      radial-gradient(60% 45% at 12% 8%, color-mix(in srgb, var(--color-primary) 30%, transparent), transparent 70%),
      radial-gradient(50% 40% at 88% 22%, color-mix(in srgb, #5B8CFF 24%, transparent), transparent 70%),
      radial-gradient(55% 45% at 50% 100%, color-mix(in srgb, var(--color-primary) 18%, transparent), transparent 70%),
      var(--color-bg);
  `)}

  ${role(s, "card", `
    --fx-card-bg: color-mix(in srgb, var(--color-surface) var(--gl-tint), transparent);
    --fx-card-border: 1px solid var(--gl-edge);
    --fx-card-shadow: 0 8px 30px var(--gl-shade), inset 0 1px 0 var(--gl-edge);
  `)}
  ${role(s, "bar", `
    --fx-bar-bg: color-mix(in srgb, var(--color-surface) 55%, transparent);
    --fx-bar-border: 1px solid var(--gl-edge);
    --fx-bar-shadow: 0 4px 24px var(--gl-shade);
    --fx-bar-blur: saturate(160%) blur(16px);
  `)}
  ${role(s, "modal", `
    --fx-modal-bg: color-mix(in srgb, var(--color-surface) 86%, transparent);
    --fx-modal-border: 1px solid var(--gl-edge);
    --fx-modal-shadow: 0 24px 60px var(--gl-shade), inset 0 1px 0 var(--gl-edge);
    --fx-modal-blur: saturate(160%) blur(22px);
  `)}
  ${role(s, "btn", `
    --fx-btn-bg: linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 72%, #ffffff));
    --fx-btn-shadow: 0 6px 20px color-mix(in srgb, var(--color-primary) 35%, transparent), inset 0 1px 0 rgba(255,255,255,.35);
  `)}
  ${role(s, "input", `
    --fx-input-bg: color-mix(in srgb, var(--color-surface) 50%, transparent);
    --fx-input-border: 1px solid var(--gl-edge);
  `)}
  ${role(s, "chip", `
    --fx-chip-bg: color-mix(in srgb, var(--color-surface) 45%, transparent);
    --fx-chip-border: 1px solid var(--gl-edge);
  `)}
  ${role(s, "chip", `
    --fx-chip-bg: color-mix(in srgb, var(--color-primary) 16%, transparent);
    --fx-chip-color: var(--color-text);
    --fx-chip-border: 1px solid color-mix(in srgb, var(--color-primary) 55%, transparent);
  `, '[data-active="true"]')}

  /* Without backdrop-filter, translucent chrome over content is unreadable — go nearly opaque. */
  @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    ${role(s, "bar", "--fx-bar-bg: color-mix(in srgb, var(--color-surface) 94%, transparent);")}
    ${role(s, "modal", "--fx-modal-bg: var(--color-surface);")}
  }
`;
