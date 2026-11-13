import { modeVars, role } from "./shared.js";

/**
 * Neumorphism: every surface is the page colour itself, shaped only by a
 * light shadow on one side and a dark one on the other. Pressed and active
 * states flip to an inset shadow. Shadows only — no filters, so it costs
 * nothing extra to scroll.
 *
 * Both shadow tones are derived from the page background, so it works on any
 * palette (it looks best on the suggested soft monochrome one).
 */
export const css = (s) => `
  ${s}{--fx-page-bg: var(--color-bg);}
  ${modeVars(s,
    { "--nm-hi": "color-mix(in srgb, var(--color-bg) 30%, #ffffff)", "--nm-lo": "color-mix(in srgb, var(--color-bg) 80%, #000000)" },
    { "--nm-hi": "color-mix(in srgb, var(--color-bg) 90%, #ffffff)", "--nm-lo": "color-mix(in srgb, var(--color-bg) 62%, #000000)" },
  )}

  ${role(s, "card", `
    --fx-card-bg: var(--color-bg);
    --fx-card-border: 1px solid transparent;
    --fx-card-shadow: 8px 8px 18px var(--nm-lo), -8px -8px 18px var(--nm-hi);
  `)}
  ${role(s, "bar", `
    --fx-bar-bg: var(--color-bg);
    --fx-bar-border: 1px solid transparent;
    --fx-bar-shadow: 0 6px 16px -6px var(--nm-lo), 0 -6px 16px -6px var(--nm-hi);
  `)}
  ${role(s, "modal", `
    --fx-modal-bg: var(--color-bg);
    --fx-modal-border: 1px solid transparent;
    --fx-modal-shadow: 14px 14px 32px var(--nm-lo), -10px -10px 28px var(--nm-hi);
  `)}
  ${role(s, "btn", `
    --fx-btn-shadow: 5px 5px 12px var(--nm-lo), -5px -5px 12px var(--nm-hi);
  `)}
  ${role(s, "btn", `
    --fx-btn-shadow: inset 4px 4px 10px color-mix(in srgb, var(--color-primary) 55%, #000000), inset -4px -4px 10px color-mix(in srgb, var(--color-primary) 70%, #ffffff);
  `, ":active")}
  ${role(s, "input", `
    --fx-input-bg: var(--color-bg);
    --fx-input-border: 1px solid transparent;
    --fx-input-shadow: inset 4px 4px 9px var(--nm-lo), inset -4px -4px 9px var(--nm-hi);
  `)}
  ${role(s, "chip", `
    --fx-chip-bg: var(--color-bg);
    --fx-chip-border: 1px solid transparent;
    --fx-chip-shadow: 4px 4px 10px var(--nm-lo), -4px -4px 10px var(--nm-hi);
  `)}
  ${role(s, "chip", `
    --fx-chip-color: var(--color-primary);
    --fx-chip-shadow: inset 3px 3px 8px var(--nm-lo), inset -3px -3px 8px var(--nm-hi);
  `, '[data-active="true"]')}
  ${role(s, "chip", `
    --fx-chip-shadow: inset 3px 3px 8px var(--nm-lo), inset -3px -3px 8px var(--nm-hi);
  `, ":active")}
`;
