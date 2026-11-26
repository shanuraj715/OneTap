import { backdrop, role } from "./shared.js";

/**
 * Dark Premium: deep black page with a faint brand-tinted light from above,
 * surfaces with a subtle top-lit gradient and a fine hairline edge, and a
 * soft accent glow reserved for buttons and active choices. Always rendered
 * dark (EFFECT_PRESETS["dark-premium"].forcesDark).
 */
export const css = (s, page) => `
  ${s}{--fx-page-bg: transparent;}
  ${s}{--dp-edge: rgba(255,255,255,.08); --dp-lift: color-mix(in srgb, var(--color-surface) 92%, #ffffff);}

  ${backdrop(page, `
    background:
      radial-gradient(80% 45% at 50% -10%, color-mix(in srgb, var(--color-primary) 14%, transparent), transparent 70%),
      var(--color-bg);
  `)}

  ${role(s, "card", `
    --fx-card-bg: linear-gradient(180deg, var(--dp-lift), var(--color-surface));
    --fx-card-border: 1px solid var(--dp-edge);
    --fx-card-shadow: inset 0 1px 0 rgba(255,255,255,.05), 0 14px 34px rgba(0,0,0,.45);
  `)}
  ${role(s, "bar", `
    --fx-bar-bg: color-mix(in srgb, var(--color-bg) 84%, transparent);
    --fx-bar-border: 1px solid var(--dp-edge);
    --fx-bar-blur: saturate(140%) blur(12px);
  `)}
  ${role(s, "bar", `
    /* the category / filter strip is drawn as a floating panel of its own here: give its contents room from the panel's edge */
    --fx-toolbar-edge: 1px solid var(--dp-edge);
    --fx-toolbar-radius: 14px;
    --fx-toolbar-pad-x: 14px;
  `, "[data-fx-toolbar]")}
  ${role(s, "modal", `
    --fx-modal-bg: linear-gradient(180deg, var(--dp-lift), var(--color-surface));
    --fx-modal-border: 1px solid rgba(255,255,255,.09);
    --fx-modal-shadow: 0 30px 80px rgba(0,0,0,.6), 0 0 0 1px color-mix(in srgb, var(--color-primary) 12%, transparent);
  `)}
  ${role(s, "btn", `
    --fx-btn-bg: linear-gradient(180deg, color-mix(in srgb, var(--color-primary) 86%, #ffffff), var(--color-primary));
    --fx-btn-shadow: 0 8px 24px color-mix(in srgb, var(--color-primary) 30%, transparent), inset 0 1px 0 rgba(255,255,255,.25);
  `)}
  ${role(s, "input", `
    --fx-input-bg: rgba(255,255,255,.03);
    --fx-input-border: 1px solid rgba(255,255,255,.10);
  `)}
  ${role(s, "input", `
    --fx-input-border: 1px solid color-mix(in srgb, var(--color-primary) 70%, transparent);
  `, ":focus")}
  ${role(s, "chip", `
    --fx-chip-bg: rgba(255,255,255,.03);
    --fx-chip-border: 1px solid var(--dp-edge);
  `)}
  ${role(s, "chip", `
    --fx-chip-bg: color-mix(in srgb, var(--color-primary) 12%, transparent);
    --fx-chip-color: var(--color-text);
    --fx-chip-border: 1px solid color-mix(in srgb, var(--color-primary) 60%, transparent);
    --fx-chip-shadow: 0 0 16px color-mix(in srgb, var(--color-primary) 20%, transparent);
  `, '[data-active="true"]')}
`;
