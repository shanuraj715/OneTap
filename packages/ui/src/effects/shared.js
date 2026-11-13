/**
 * Declare the same custom properties with a light and a dark value, following
 * exactly the rules `themeCss()` uses for the palette itself: dark on an
 * explicit `data-theme="dark"`, or on a dark OS preference unless the page
 * opted into light. Keeps an effect's highlights and shadows in step with
 * whichever palette is actually showing.
 */
export function modeVars(scope, light, dark) {
  const decl = (vars) => Object.entries(vars).map(([k, v]) => `${k}:${v};`).join("");
  return `
    ${scope}{${decl(light)}}
    ${scope}[data-theme="dark"]{${decl(dark)}}
    @media (prefers-color-scheme: dark){${scope}:not([data-theme="light"]){${decl(dark)}}}
  `;
}

/** A fixed, non-interactive layer behind all content — where page-level light, gradients and grids live. */
export const backdrop = (page, rules) => `
  ${page}::before{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;${rules}}
`;

/** Rule targeting one fx role inside the scope (see ../fx.js). */
export const role = (scope, name, rules, state = "") => `${scope} .ot-fx-${name}${state}{${rules}}`;
