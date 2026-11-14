import { backdrop, modeVars, role } from "./shared.js";

/**
 * Claymorphism: puffy, rounded surfaces — a soft outer drop shadow plus an
 * inner highlight on top and an inner shade at the bottom, so each card reads
 * as a soft inflated object. Large radii are set per role (never on the
 * global --radius-card), so nothing outside the storefront's surfaces moves.
 */
export const css = (s, page) => `
  ${s}{--fx-page-bg: transparent;}
  ${modeVars(s,
    { "--cl-hi": "rgba(255,255,255,.85)", "--cl-lo": "rgba(40,24,80,.10)", "--cl-drop": "color-mix(in srgb, var(--color-primary) 16%, rgba(40,24,80,.12))" },
    { "--cl-hi": "rgba(255,255,255,.08)", "--cl-lo": "rgba(0,0,0,.35)", "--cl-drop": "rgba(0,0,0,.5)" },
  )}

  ${backdrop(page, `
    background:
      radial-gradient(40% 35% at 90% 5%, color-mix(in srgb, var(--color-primary) 14%, transparent), transparent 70%),
      radial-gradient(45% 40% at 5% 95%, color-mix(in srgb, #7DD3FC 18%, transparent), transparent 70%),
      var(--color-bg);
  `)}

  ${role(s, "card", `
    --fx-card-radius: 26px;
    --fx-card-border: 1px solid transparent;
    --fx-card-shadow: 0 14px 30px var(--cl-drop), inset 0 3px 2px var(--cl-hi), inset 0 -6px 12px var(--cl-lo);
  `)}
  ${role(s, "bar", `
    --fx-bar-border: 1px solid transparent;
    --fx-bar-shadow: 0 10px 28px var(--cl-drop), inset 0 -3px 6px var(--cl-lo);
  `)}
  ${role(s, "bar", `
    --fx-toolbar-bg: color-mix(in srgb, var(--color-surface) 70%, var(--color-bg));
    --fx-toolbar-edge: 1px solid color-mix(in srgb, var(--color-border) 80%, transparent);
    --fx-toolbar-shadow: none;
    --fx-toolbar-radius: 20px;
    --fx-toolbar-pad-x: 14px;
    --fx-toolbar-gap: 12px;
  `, "[data-fx-toolbar]")}
  ${role(s, "modal", `
    --fx-modal-radius: 30px;
    --fx-modal-border: 1px solid transparent;
    --fx-modal-shadow: 0 30px 60px var(--cl-drop), inset 0 4px 3px var(--cl-hi), inset 0 -8px 16px var(--cl-lo);
  `)}
  ${role(s, "btn", `
    --fx-btn-radius: 18px;
    --fx-btn-shadow: 0 8px 18px color-mix(in srgb, var(--color-primary) 38%, transparent),
      inset 0 3px 1px color-mix(in srgb, var(--color-primary) 55%, #ffffff),
      inset 0 -4px 0 color-mix(in srgb, var(--color-primary) 72%, #000000);
  `)}
  ${role(s, "input", `
    --fx-input-radius: 16px;
    --fx-input-border: 1px solid transparent;
    --fx-input-shadow: inset 0 3px 6px var(--cl-lo), inset 0 -2px 2px var(--cl-hi);
  `)}
  ${role(s, "chip", `
    --fx-chip-radius: 16px;
    --fx-chip-border: 1px solid transparent;
    --fx-chip-shadow: 0 6px 14px var(--cl-drop), inset 0 2px 1px var(--cl-hi), inset 0 -3px 6px var(--cl-lo);
  `)}
  ${role(s, "chip", `
    --fx-chip-bg: color-mix(in srgb, var(--color-primary) 14%, var(--color-surface));
    --fx-chip-color: var(--color-text);
    --fx-chip-border: 1px solid color-mix(in srgb, var(--color-primary) 45%, transparent);
  `, '[data-active="true"]')}
`;
