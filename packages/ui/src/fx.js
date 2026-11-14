/**
 * Hooks that let a storefront visual effect (glass, neumorph, …) restyle a
 * surface whose look is otherwise an inline style object — which a
 * stylesheet can't override without `!important`.
 *
 * `fx(role, base)` rewrites the surface properties of `base` to read
 * `--fx-<role>-*` custom properties, falling back to the exact original value.
 * Pair it with `className={fxClass(role)}` so the effect CSS can find the
 * element and set those properties on it. With no effect CSS on the page —
 * the admin panel, or an outlet on "none" — every fallback applies and the
 * surface renders exactly as it did before.
 *
 * The fallbacks are inline on purpose: if the defaults lived on :root they'd
 * be computed there, and a nested wrapper overriding --color-* (the admin's
 * live theme preview) would stop reaching the surfaces inside it.
 *
 * Variable names are per-role so a card inside a modal never inherits the
 * modal's values.
 *
 * Roles:
 *   card   content panels — item cards, checkout sections, sign-in card
 *   modal  floating layers — dialogs, drawers, dropdown/popover panels
 *   bar    sticky chrome — header, cart bar, checkout bottom bar
 *   btn    primary (brand-filled) buttons
 *   input  text inputs and textareas
 *   chip   secondary toggles — choice buttons, steppers, chips
 */
export const FX_ROLES = ["card", "modal", "bar", "btn", "input", "chip"];

const BORDER_KEYS = ["border", "borderTop", "borderBottom", "borderLeft", "borderRight"];

export function fx(role, base = {}) {
  const out = { ...base };
  const v = (name, fallback) => `var(--fx-${role}-${name}, ${fallback})`;

  out.background = v("bg", base.background ?? "transparent");
  out.boxShadow = v("shadow", base.boxShadow ?? "none");
  for (const k of BORDER_KEYS) if (base[k] !== undefined) out[k] = v("border", base[k]);
  // React appends "px" to a bare number, but not once it's inside a var()
  // string — `var(--x, 999)` is invalid and silently drops the radius to 0.
  if (base.borderRadius !== undefined) {
    const r = typeof base.borderRadius === "number" ? `${base.borderRadius}px` : base.borderRadius;
    out.borderRadius = v("radius", r);
  }
  if (base.color !== undefined) out.color = v("color", base.color);
  out.backdropFilter = v("blur", base.backdropFilter ?? "none");
  out.WebkitBackdropFilter = v("blur", base.WebkitBackdropFilter ?? base.backdropFilter ?? "none");
  return out;
}

/** The class the effect CSS targets (`ot-fx-<role>`); merge with any existing className. */
export const fxClass = (role, extra) => (extra ? `ot-fx-${role} ${extra}` : `ot-fx-${role}`);
