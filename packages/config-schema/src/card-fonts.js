import { FONT_FAMILIES } from "./typography.js";

/**
 * The card designer's own font catalogue.
 *
 * Separate from FONT_FAMILIES on purpose. That list is the *storefront's*
 * typography — nineteen faces chosen to stay readable through a whole menu at
 * body size. A printed table card is the opposite problem: it is six words seen
 * from two metres away, and it wants character. Offering Great Vibes as a
 * storefront body font would be a mistake; offering only Inter on a table card
 * is a different one.
 *
 * The storefront's faces are included here — the templates use them, and a
 * clean sans is still the right answer for most cards — but grouped by what an
 * owner is actually looking for rather than by classification.
 *
 * Nothing here is loaded until it is used. See `ensureFonts` in the admin: one
 * stylesheet link per family, created the first time a design actually asks for
 * that face. Sixty-two faces in one request would be several megabytes on every
 * page load, for a page that renders one or two of them.
 */

export const CARD_FONT_GROUPS = [
  { id: "clean", label: "Clean & modern", hint: "Plain and legible. The safe choice, and what most cards should use." },
  { id: "classic", label: "Classic & serif", hint: "Traditional and a little formal — fine dining, not a takeaway counter." },
  { id: "statement", label: "Big & bold", hint: "Heavy display faces for a name set large. Unreadable at small sizes." },
  { id: "handwriting", label: "Handwriting", hint: "Casual pen and marker lettering. Friendly rather than formal." },
  { id: "script", label: "Elegant script", hint: "Flowing calligraphy. Beautiful large, illegible small — keep these for the name." },
  { id: "cute", label: "Cute & rounded", hint: "Soft, round and cheerful. Good for cafés, bakeries and dessert menus." },
  { id: "playful", label: "Playful & chunky", hint: "Thick, fun display faces with a lot of personality." },
  { id: "retro", label: "Retro & quirky", hint: "Diner signs, surf shops and other deliberately dated looks." },
  { id: "mono", label: "Typewriter", hint: "Fixed-width, receipt-like. Pairs well with the Ticket templates." },
];

/** Which group each storefront face belongs to over here. */
const EXISTING_GROUPS = {
  system: "clean",
  inter: "clean",
  "dm-sans": "clean",
  poppins: "clean",
  manrope: "clean",
  outfit: "clean",
  "work-sans": "clean",
  jakarta: "clean",
  figtree: "clean",
  "plex-sans": "clean",
  "space-grotesk": "clean",
  playfair: "classic",
  lora: "classic",
  "source-serif": "classic",
  fraunces: "classic",
  bitter: "classic",
  bebas: "statement",
  "archivo-black": "statement",
  "plex-mono": "mono",
};

/**
 * `google` is the exact query-string fragment Google Fonts uses, so weights and
 * italics are read from one source rather than being hand-listed and drifting.
 * The parser below understands single weights, semicolon lists, `100..900`
 * variable ranges and the `ital,wght` tuple form.
 */
const f = (id, name, group, google, fallback = "cursive") => ({
  id,
  name,
  group,
  google,
  stack: `'${name}', ${fallback}`,
});

const CURSIVE = "cursive";
const CHUNKY = "system-ui, sans-serif";

const EXTRA_FONTS = [
  /* ------------------------------------------------------- elegant script */
  f("alex-brush", "Alex Brush", "script", "Alex+Brush", CURSIVE),
  f("allura", "Allura", "script", "Allura", CURSIVE),
  f("birthstone", "Birthstone", "script", "Birthstone", CURSIVE),
  f("corinthia", "Corinthia", "script", "Corinthia:wght@400;700", CURSIVE),
  f("ephesis", "Ephesis", "script", "Ephesis", CURSIVE),
  f("euphoria-script", "Euphoria Script", "script", "Euphoria+Script", CURSIVE),
  f("festive", "Festive", "script", "Festive", CURSIVE),
  f("fleur-de-leah", "Fleur De Leah", "script", "Fleur+De+Leah", CURSIVE),
  f("great-vibes", "Great Vibes", "script", "Great+Vibes", CURSIVE),
  f("imperial-script", "Imperial Script", "script", "Imperial+Script", CURSIVE),
  f("lavishly-yours", "Lavishly Yours", "script", "Lavishly+Yours", CURSIVE),
  f("princess-sofia", "Princess Sofia", "script", "Princess+Sofia", CURSIVE),
  f("qwitcher-grypen", "Qwitcher Grypen", "script", "Qwitcher+Grypen:wght@400;700", CURSIVE),
  f("style-script", "Style Script", "script", "Style+Script", CURSIVE),
  f("tangerine", "Tangerine", "script", "Tangerine:wght@400;700", CURSIVE),
  f("yesteryear", "Yesteryear", "script", "Yesteryear", CURSIVE),

  /* ---------------------------------------------------------- handwriting */
  f("caveat-brush", "Caveat Brush", "handwriting", "Caveat+Brush", CURSIVE),
  f("courgette", "Courgette", "handwriting", "Courgette", CURSIVE),
  f("damion", "Damion", "handwriting", "Damion", CURSIVE),
  f("indie-flower", "Indie Flower", "handwriting", "Indie+Flower", CURSIVE),
  f("kaushan-script", "Kaushan Script", "handwriting", "Kaushan+Script", CURSIVE),
  // Google ships Molle in italic only — see `fontIsItalicOnly`.
  f("molle", "Molle", "handwriting", "Molle:ital@1", CURSIVE),
  f("ole", "Ole", "handwriting", "Ole", CURSIVE),
  f("oregano", "Oregano", "handwriting", "Oregano:ital@0;1", CURSIVE),
  f("story-script", "Story Script", "handwriting", "Story+Script", CURSIVE),

  /* -------------------------------------------------------- cute & rounded */
  f("bubblegum-sans", "Bubblegum Sans", "cute", "Bubblegum+Sans", CHUNKY),
  f("chewy", "Chewy", "cute", "Chewy", CHUNKY),
  f("coiny", "Coiny", "cute", "Coiny", CHUNKY),
  f("dynapuff", "DynaPuff", "cute", "DynaPuff:wght@400..700", CHUNKY),
  f("gluten", "Gluten", "cute", "Gluten:wght@100..900", CHUNKY),
  f("merienda", "Merienda", "cute", "Merienda:wght@300..900", CHUNKY),
  f("sniglet", "Sniglet", "cute", "Sniglet:wght@400;800", CHUNKY),
  f("sour-gummy", "Sour Gummy", "cute", "Sour+Gummy:ital,wght@0,100..900;1,100..900", CHUNKY),

  /* ------------------------------------------------------ playful & chunky */
  f("agbalumo", "Agbalumo", "playful", "Agbalumo", CHUNKY),
  f("chicle", "Chicle", "playful", "Chicle", CHUNKY),
  f("freckle-face", "Freckle Face", "playful", "Freckle+Face", CHUNKY),
  f("irish-grover", "Irish Grover", "playful", "Irish+Grover", CHUNKY),
  f("kavoon", "Kavoon", "playful", "Kavoon", CHUNKY),
  f("sofadi-one", "Sofadi One", "playful", "Sofadi+One", CHUNKY),

  /* --------------------------------------------------------- retro & quirky */
  f("fontdiner-swanky", "Fontdiner Swanky", "retro", "Fontdiner+Swanky", CHUNKY),
  f("mystery-quest", "Mystery Quest", "retro", "Mystery+Quest", CHUNKY),
  f("original-surfer", "Original Surfer", "retro", "Original+Surfer", CHUNKY),
  f("paprika", "Paprika", "retro", "Paprika", CHUNKY),
];

export const CARD_FONTS = [
  ...FONT_FAMILIES.map((font) => ({
    id: font.id,
    name: font.name,
    group: EXISTING_GROUPS[font.id] ?? "clean",
    google: font.google,
    stack: font.stack,
  })),
  ...EXTRA_FONTS,
];

/** Forgiving, like `fontById` — a design naming a removed face still opens. */
export const cardFontById = (id) => CARD_FONTS.find((font) => font.id === id) ?? CARD_FONTS[0];

export const cardFontsInGroup = (group) => CARD_FONTS.filter((font) => font.group === group);

export const cardFontGroupOf = (id) => cardFontById(id).group;

/* ----------------------------------------------------------------- parsing */

/**
 * Read a Google Fonts query fragment.
 *
 * Four shapes appear in the catalogue above and all four have to work, because
 * getting this wrong is silent: ask for a weight a face does not ship and the
 * browser synthesises a smeared faux-bold instead of refusing.
 *
 *   Chewy                              one face, 400
 *   Tangerine:wght@400;700             an explicit list
 *   Gluten:wght@100..900               a variable range
 *   Sour+Gummy:ital,wght@0,100..900;1,100..900   axis tuples, with italics
 */
export function parseFontSpec(google) {
  if (!google) return null;

  const [namePart, axisPart] = google.split(":");
  const family = namePart.replace(/\+/g, " ");
  if (!axisPart) return { family, weights: [400], hasUpright: true, hasItalic: false };

  const [axisNames, valuePart] = axisPart.split("@");
  const axes = axisNames.split(",");
  const wghtAt = axes.indexOf("wght");
  const italAt = axes.indexOf("ital");

  const weights = new Set();
  let hasItalic = false;
  let hasUpright = italAt < 0;

  for (const tuple of (valuePart ?? "").split(";")) {
    const parts = tuple.split(",");
    if (italAt >= 0) {
      if (parts[italAt] === "1") hasItalic = true;
      else hasUpright = true;
    }

    const raw = wghtAt >= 0 ? parts[wghtAt] : null;
    if (!raw) {
      weights.add(400);
      continue;
    }
    if (raw.includes("..")) {
      // A variable range. Offered in hundreds — a slider from 100 to 900 is
      // more precision than anyone sets on a six-word card.
      const [lo, hi] = raw.split("..").map(Number);
      for (let w = Math.ceil(lo / 100) * 100; w <= hi; w += 100) weights.add(w);
      weights.add(lo);
      weights.add(hi);
    } else {
      weights.add(Number(raw));
    }
  }

  const list = [...weights].filter((w) => Number.isFinite(w)).sort((a, b) => a - b);
  return { family, weights: list.length ? list : [400], hasUpright, hasItalic };
}

/**
 * Faces Google ships only as italic — Molle is the one here.
 *
 * It matters twice over: the renderer has to request the italic face or the
 * browser slants an upright it does not have, and the loader has to *probe* for
 * the italic face or `document.fonts.load` reports a perfectly good font as
 * missing. That false warning is exactly the failure this codebase already
 * fixed once.
 */
export function fontIsItalicOnly(id) {
  const parsed = parseFontSpec(cardFontById(id).google);
  return Boolean(parsed && parsed.hasItalic && !parsed.hasUpright);
}

/** The weights a face actually ships; anything else gets a synthetic bold. */
export function cardFontWeights(id) {
  const parsed = parseFontSpec(cardFontById(id).google);
  // A face with no Google spec is a system stack, which has the full range.
  return parsed ? parsed.weights : [300, 400, 500, 600, 700, 800, 900];
}

export function clampCardFontWeight(id, weight) {
  const available = cardFontWeights(id);
  if (available.includes(weight)) return weight;
  return available.reduce((best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best), available[0]);
}
