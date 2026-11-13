/**
 * Storefront visual effects. One small module per effect, loaded on demand —
 * never re-exported from `@onetap/ui`'s main index, so a client bundle only
 * ever contains the effect it asked for (the storefront asks on the server,
 * and the browser receives just the resulting string; the admin's live
 * preview dynamic-imports one effect chunk at a time).
 *
 * Every effect is a function of two selectors:
 *   scope — where the surface rules apply (`:root` on the storefront, the
 *           preview container in admin)
 *   page  — the element that owns the page background (`body`, or the
 *           preview container itself)
 *
 * Effects only ever set `--fx-<role>-*` custom properties on the
 * `.ot-fx-<role>` elements (see ../fx.js) plus a page background layer —
 * nothing outside that, so an effect can't break layout.
 */
export async function loadEffectCss(style, { scope = ":root", page = "body" } = {}) {
  let mod;
  switch (style) {
    case "glass":
      mod = await import("./glass.js");
      break;
    case "neumorph":
      mod = await import("./neumorph.js");
      break;
    case "clay":
      mod = await import("./clay.js");
      break;
    case "aurora":
      mod = await import("./aurora.js");
      break;
    case "cyberpunk":
      mod = await import("./cyberpunk.js");
      break;
    case "dark-premium":
      mod = await import("./dark-premium.js");
      break;
    default:
      return "";
  }
  return minify(mod.css(scope, page));
}

function minify(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([{}:;,>])\s*/g, "$1")
    .replace(/;}/g, "}")
    .trim();
}
