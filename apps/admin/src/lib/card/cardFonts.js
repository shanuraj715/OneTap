import { fontById } from "@onetap/config-schema";

/**
 * Canvas text falls back silently. Ask for a face the browser has not loaded
 * and `fillText` renders in Times with no error, no warning, and a preview that
 * looks fine to whoever built it — the owner finds out when the print arrives.
 * Everything here exists to make that failure loud.
 */

/**
 * One `<link>` per family, added once and never rewritten.
 *
 * The obvious design — a single link whose href lists every family in use —
 * cannot be made reliable. Changing the href makes the browser drop the old
 * sheet and re-parse, and during that window the faces it previously provided
 * do not exist. The editor rewrites the design on every keystroke, so that
 * window is hit constantly: faces report as missing while rendering perfectly,
 * and the owner is warned about a problem that is not there.
 *
 * A link per family never invalidates anything already loaded.
 */
const links = new Map();

function linkFor(spec) {
  const existing = links.get(spec);
  if (existing) return existing;

  const promise = new Promise((resolve) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.dataset.cardFont = spec;
    const done = () => {
      link.removeEventListener("load", done);
      link.removeEventListener("error", done);
      resolve();
    };
    link.addEventListener("load", done);
    link.addEventListener("error", done);
    // Never block a render on a slow font host; a warning is the worst case.
    setTimeout(done, 6000);
    link.href = `https://fonts.googleapis.com/css2?family=${spec}&display=swap`;
    document.head.appendChild(link);
  });

  links.set(spec, promise);
  return promise;
}

/** "Plus+Jakarta+Sans:wght@400;500;700;800" → { family, weights } */
function parseGoogleSpec(spec) {
  if (!spec) return null;
  const [name, axis] = spec.split(":");
  const family = name.replace(/\+/g, " ");
  const weights = axis?.startsWith("wght@")
    ? axis
        .slice(5)
        .split(";")
        .map((w) => Number.parseInt(w, 10))
        .filter((w) => Number.isFinite(w))
    : [400];
  return { family, weights: weights.length ? weights : [400] };
}

/**
 * The weights a face actually ships. Bebas Neue and Archivo Black have no
 * weight axis at all: ask for 700 and the browser synthesises a smeared faux
 * bold, which looks like a rendering bug rather than a design choice.
 */
export function weightsFor(fontId) {
  const parsed = parseGoogleSpec(fontById(fontId).google);
  return parsed ? parsed.weights : [300, 400, 500, 600, 700, 800, 900];
}

export function clampWeight(fontId, weight) {
  const available = weightsFor(fontId);
  if (available.includes(weight)) return weight;
  return available.reduce((best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best), available[0]);
}

/** The full stack, so canvas still has somewhere to land if a face is missing. */
export const canvasFamily = (fontId) => fontById(fontId).stack;

/**
 * Load every face a design needs, and say which ones did not arrive.
 *
 * Order matters: the `<link>` has to be injected first, because
 * `document.fonts.load` only resolves faces that already have an `@font-face`
 * rule to match. `document.fonts.ready` alone is not enough either — it settles
 * when nothing is *pending*, and a face nobody has requested is never pending.
 */
export async function ensureFonts(pairs) {
  const warnings = [];
  const specs = new Map();

  for (const { fontId } of pairs) {
    const parsed = parseGoogleSpec(fontById(fontId).google);
    if (parsed) specs.set(fontById(fontId).google, parsed);
  }
  if (specs.size === 0) return warnings;

  // The stylesheets have to be PARSED before `document.fonts.load` has any
  // @font-face rule to match against — injecting the links is not enough.
  await Promise.all([...specs.keys()].map(linkFor));

  const wanted = new Map();
  for (const { fontId, weight } of pairs) {
    const parsed = parseGoogleSpec(fontById(fontId).google);
    if (!parsed) continue;
    wanted.set(`${parsed.family}|${clampWeight(fontId, weight)}`, { family: parsed.family, weight: clampWeight(fontId, weight) });
  }

  await Promise.all(
    [...wanted.values()].map(async ({ family, weight }) => {
      const probe = () => document.fonts.load(`${weight} 16px "${family}"`, "ABCabc123");
      try {
        // `.load()` resolves with the array of faces it matched — and resolves
        // with an EMPTY array rather than rejecting when the family is missing.
        // Checking length is the only way to tell success from silent fallback.
        let faces = await probe();
        if (!faces.length) {
          // A stylesheet's `load` event can beat the face registry being
          // populated from it, which shows up as the first family requested
          // reporting missing while every later one is fine. Settle and re-ask
          // once before accusing the font of not existing.
          await document.fonts.ready;
          faces = await probe();
        }
        if (!faces.length) warnings.push(`${family} ${weight} did not load — that text will print in a fallback font.`);
      } catch {
        warnings.push(`${family} could not be loaded. Check the connection, or pick another font.`);
      }
    }),
  );

  return warnings;
}

/**
 * The canvas `font` shorthand.
 *
 * Letter-spacing is deliberately NOT emulated by advancing glyphs one at a
 * time. That trick breaks any script with joining or reordering — and this is
 * an Indian restaurant product, so a Devanagari tagline is an ordinary case,
 * not an edge one. `ctx.letterSpacing` is used where the browser has it and
 * ignored where it does not.
 */
export function applyTextStyle(ctx, style, fontSizePx) {
  const weight = clampWeight(style.fontId, style.weight);
  ctx.font = `${style.italic ? "italic " : ""}${weight} ${fontSizePx}px ${canvasFamily(style.fontId)}`;
  if ("letterSpacing" in ctx) {
    ctx.letterSpacing = `${(style.letterSpacing ?? 0) * fontSizePx}px`;
  }
}

/** Locale-aware, because `toUpperCase` mangles Turkish dotted i and others. */
export function transformText(text, transform) {
  if (transform === "upper") return text.toLocaleUpperCase();
  if (transform === "lower") return text.toLocaleLowerCase();
  return text;
}
