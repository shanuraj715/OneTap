import {
  cardFontById,
  cardFontWeights,
  clampCardFontWeight,
  fontIsItalicOnly,
  parseFontSpec,
} from "@onetap/config-schema";

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

/**
 * Google serves the CSS from one host and the font files from another, so a
 * cold font costs two DNS lookups and two TLS handshakes before a byte of
 * lettering arrives. Warming both once removes that from the first font an
 * owner picks — which is the one moment the delay is visible.
 */
let preconnected = false;
function preconnect() {
  if (preconnected) return;
  preconnected = true;
  for (const [href, crossOrigin] of [
    ["https://fonts.googleapis.com", false],
    ["https://fonts.gstatic.com", true],
  ]) {
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = href;
    if (crossOrigin) link.crossOrigin = "anonymous";
    document.head.appendChild(link);
  }
}

function linkFor(spec) {
  const existing = links.get(spec);
  if (existing) return existing;
  preconnect();

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

/**
 * The weights a face actually ships. Bebas Neue and Archivo Black have no
 * weight axis at all: ask for 700 and the browser synthesises a smeared faux
 * bold, which looks like a rendering bug rather than a design choice.
 */
export const weightsFor = cardFontWeights;
export const clampWeight = clampCardFontWeight;

/** The full stack, so canvas still has somewhere to land if a face is missing. */
export const canvasFamily = (fontId) => cardFontById(fontId).stack;

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
    const font = cardFontById(fontId);
    const parsed = parseFontSpec(font.google);
    if (parsed) specs.set(font.google, parsed);
  }
  if (specs.size === 0) return warnings;

  // The stylesheets have to be PARSED before `document.fonts.load` has any
  // @font-face rule to match against — injecting the links is not enough.
  //
  // Only the families this design actually uses reach here, which is what keeps
  // a catalogue of sixty-odd faces from costing anything: a card using two of
  // them fetches two stylesheets.
  await Promise.all([...specs.keys()].map(linkFor));

  const wanted = new Map();
  for (const { fontId, weight } of pairs) {
    const parsed = parseFontSpec(cardFontById(fontId).google);
    if (!parsed) continue;
    const w = clampWeight(fontId, weight);
    // Molle ships italic only. Probing for an upright face it does not have
    // reports a perfectly good font as missing.
    const italic = fontIsItalicOnly(fontId);
    wanted.set(`${parsed.family}|${w}|${italic}`, { family: parsed.family, weight: w, italic });
  }

  await Promise.all(
    [...wanted.values()].map(async ({ family, weight, italic }) => {
      const probe = () => document.fonts.load(`${italic ? "italic " : ""}${weight} 16px "${family}"`, "ABCabc123");
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
  // An italic-only face has to be asked for as italic; requesting upright makes
  // the browser slant a face it does not have, or fall back entirely.
  const italic = style.italic || fontIsItalicOnly(style.fontId);
  ctx.font = `${italic ? "italic " : ""}${weight} ${fontSizePx}px ${canvasFamily(style.fontId)}`;
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
