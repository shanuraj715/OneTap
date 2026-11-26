import { backdrop, modeVars, role } from "./shared.js";

/**
 * Aurora: purple, blue, pink and cyan light (plus the brand colour) drifting
 * slowly behind the page, with faintly glowing surfaces on top.
 *
 * The light is plain radial gradients on ONE fixed layer that only animates
 * `transform` — the compositor moves it without repainting, and there's no
 * `filter: blur` (the gradients are already soft). Visitors who ask for
 * reduced motion get the same light, standing still.
 */
export const css = (s, page) => `
  ${s}{--fx-page-bg: transparent;}
  ${modeVars(s,
    { "--au-glow": "rgba(124,58,237,.12)", "--au-edge": "rgba(124,58,237,.16)", "--au-op": ".55", "--au-tint": "72%" },
    { "--au-glow": "rgba(139,92,246,.22)", "--au-edge": "rgba(167,139,250,.20)", "--au-op": ".85", "--au-tint": "66%" },
  )}

  ${page}{background:var(--color-bg)}
  ${backdrop(page, `
    inset: -25%;
    opacity: var(--au-op);
    background:
      radial-gradient(30% 25% at 20% 25%, rgba(139,92,246,.55), transparent 70%),
      radial-gradient(28% 24% at 75% 20%, rgba(34,211,238,.45), transparent 70%),
      radial-gradient(30% 26% at 70% 70%, rgba(236,72,153,.40), transparent 70%),
      radial-gradient(32% 28% at 25% 75%, rgba(59,130,246,.45), transparent 70%),
      radial-gradient(22% 20% at 50% 50%, color-mix(in srgb, var(--color-primary) 35%, transparent), transparent 70%);
    will-change: transform;
    animation: ot-aurora 28s ease-in-out infinite alternate;
  `)}
  @keyframes ot-aurora{
    0%{transform:translate3d(0,0,0) rotate(0deg) scale(1)}
    50%{transform:translate3d(-4%,3%,0) rotate(10deg) scale(1.08)}
    100%{transform:translate3d(3%,-2%,0) rotate(-6deg) scale(1.04)}
  }
  @media (prefers-reduced-motion: reduce){${page}::before{animation:none}}

  ${role(s, "card", `
    --fx-card-bg: color-mix(in srgb, var(--color-surface) var(--au-tint), transparent);
    --fx-card-border: 1px solid var(--au-edge);
    --fx-card-shadow: 0 10px 30px var(--au-glow);
  `)}
  ${role(s, "bar", `
    --fx-bar-bg: color-mix(in srgb, var(--color-surface) 62%, transparent);
    --fx-bar-border: 1px solid var(--au-edge);
    --fx-bar-blur: saturate(150%) blur(14px);
  `)}
  ${role(s, "bar", `
    /* the category / filter strip is drawn as a floating panel of its own here: give its contents room from the panel's edge */
    --fx-toolbar-edge: 1px solid var(--au-edge);
    --fx-toolbar-radius: 18px;
    --fx-toolbar-pad-x: 14px;
  `, "[data-fx-toolbar]")}
  ${role(s, "modal", `
    --fx-modal-bg: color-mix(in srgb, var(--color-surface) 94%, transparent); /* see glass.js: keep the page behind from greying the text */
    --fx-modal-border: 1px solid var(--au-edge);
    --fx-modal-shadow: 0 24px 70px var(--au-glow);
    --fx-modal-blur: saturate(150%) blur(20px);
  `)}
  ${role(s, "btn", `
    --fx-btn-bg: linear-gradient(120deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 45%, #7C3AED));
    --fx-btn-shadow: 0 8px 24px color-mix(in srgb, #7C3AED 35%, transparent);
  `)}
  ${role(s, "input", `
    --fx-input-bg: color-mix(in srgb, var(--color-surface) 60%, transparent);
    --fx-input-border: 1px solid var(--au-edge);
  `)}
  ${role(s, "chip", `
    --fx-chip-bg: color-mix(in srgb, var(--color-surface) 55%, transparent);
    --fx-chip-border: 1px solid var(--au-edge);
  `)}
  ${role(s, "chip", `
    --fx-chip-bg: color-mix(in srgb, #8B5CF6 16%, transparent);
    --fx-chip-color: var(--color-text);
    --fx-chip-border: 1px solid color-mix(in srgb, #8B5CF6 55%, transparent);
    --fx-chip-shadow: 0 0 18px var(--au-glow);
  `, '[data-active="true"]')}

  @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    ${role(s, "bar", "--fx-bar-bg: color-mix(in srgb, var(--color-surface) 94%, transparent);")}
    ${role(s, "modal", "--fx-modal-bg: var(--color-surface);")}
  }
`;
