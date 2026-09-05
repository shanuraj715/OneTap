import { cardSizeById, qrCardSpecSchema } from "./qr-card.js";

/**
 * The card library — 36 starting points across 9 layout families.
 *
 * Two things keep this a few hundred lines instead of a few thousand:
 *
 *  1. A family is a *function* of a palette and an orientation, not 36
 *     hand-written layouts. Every spatial value in the spec is a percentage of
 *     the card's short edge, so one family body renders correctly on an A7
 *     tent card and a 160mm landscape counter card without per-size tuning.
 *  2. Templates are authored sparsely and completed by `qrCardSpecSchema` on
 *     demand. A template names only what makes it distinctive; every other
 *     field arrives as a default.
 *
 * They also carry no image data. A photo template ships a gradient stand-in and
 * prompts the owner for a picture, because bundling real photography here would
 * push megabytes into every page that imports config-schema.
 *
 * Building is deferred behind `build()`: the metadata below is cheap enough to
 * import anywhere, and the ~26,000 field validations of parsing all 36 only
 * happen when the gallery actually opens.
 */

/* --------------------------------------------------------------- palettes */

/**
 * `fg` and `bg` are swapped by the families that want a reversed card, which is
 * why every palette has to read well in both directions. `qr` is stated
 * separately rather than inferred: the modules must stay dark against a light
 * plate even on a palette whose text is white.
 */
const P = {
  ink: { label: "Ink", bg: "#0F1115", fg: "#FFFFFF", mute: "#8D95A3", accent: "#E8B84B", plate: "#FFFFFF", qr: "#0F1115" },
  paper: { label: "Paper", bg: "#FFFFFF", fg: "#141414", mute: "#767676", accent: "#141414", plate: "#FFFFFF", qr: "#141414" },
  char: { label: "Charcoal", bg: "#17181A", fg: "#F5F4F1", mute: "#8A8A85", accent: "#E8552F", plate: "#FFFFFF", qr: "#17181A" },
  cream: { label: "Cream", bg: "#F7F2E7", fg: "#231F19", mute: "#7E7362", accent: "#B4532A", plate: "#FFFFFF", qr: "#231F19" },
  sage: { label: "Sage", bg: "#E7EDE6", fg: "#1D2A22", mute: "#68796D", accent: "#2F6B4F", plate: "#FFFFFF", qr: "#1D2A22" },
  royal: { label: "Royal", bg: "#16255E", fg: "#FFFFFF", mute: "#A8B5DF", accent: "#F2C14E", plate: "#FFFFFF", qr: "#16255E" },
  chili: { label: "Chilli", bg: "#7A1420", fg: "#FFF3E6", mute: "#DFA6A4", accent: "#FFC857", plate: "#FFF3E6", qr: "#7A1420" },
  mango: { label: "Mango", bg: "#FFB703", fg: "#1D1503", mute: "#6E5610", accent: "#023047", plate: "#FFFFFF", qr: "#1D1503" },
  mint: { label: "Mint", bg: "#DDF3EB", fg: "#0D2B22", mute: "#5B8478", accent: "#0F766E", plate: "#FFFFFF", qr: "#0D2B22" },
  plum: { label: "Plum", bg: "#2A1533", fg: "#F8EFFA", mute: "#AB90B6", accent: "#F0A6CA", plate: "#FFFFFF", qr: "#2A1533" },
  slate: { label: "Slate", bg: "#EDF1F6", fg: "#101720", mute: "#65728A", accent: "#2563EB", plate: "#FFFFFF", qr: "#101720" },
  blush: { label: "Blush", bg: "#FDEBE6", fg: "#33201B", mute: "#9C7C74", accent: "#D4553F", plate: "#FFFFFF", qr: "#33201B" },
};

/**
 * Reversed card: the text colour becomes the ground. `qr` is deliberately not
 * flipped — the families that reverse a card put the code on its own light
 * plate, so the modules stay dark whichever way round the card is.
 */
const flip = (p) => ({ ...p, bg: p.fg, fg: p.bg, plate: "#FFFFFF" });

/* ------------------------------------------------------------ block sugar */

const t = (content, style = {}) => ({ kind: "text", text: { content, ...style } });
const q = (style = {}) => ({ kind: "qr", qr: style });
const ic = (names, style = {}) => ({ kind: "icon", icon: { names, ...style } });
const dv = (style = {}) => ({ kind: "divider", divider: style });
const sp = (heightPct) => ({ kind: "spacer", spacer: { heightPct } });

/** Stable, readable ids — the editor keys rows by these and reordering must not renumber them. */
function seq(blocks) {
  const used = new Map();
  return blocks.filter(Boolean).map((b) => {
    const n = (used.get(b.kind) ?? 0) + 1;
    used.set(b.kind, n);
    return { id: `${b.kind}${n}`, ...b };
  });
}

/**
 * Resolve a preset to millimetres, rotating it when the family wants landscape.
 * `preset` stays as provenance — the millimetres are what the renderer reads,
 * so a rotated card can never disagree with a stored orientation flag.
 */
function sizeOf(presetId, land) {
  const s = cardSizeById(presetId);
  const w = land ? Math.max(s.widthMm, s.heightMm) : Math.min(s.widthMm, s.heightMm);
  const h = land ? Math.min(s.widthMm, s.heightMm) : Math.max(s.widthMm, s.heightMm);
  return { preset: s.id, widthMm: w, heightMm: h };
}

const solid = (color) => ({ kind: "color", color });

/** Blend two hex colours; `t` is how much of `b` to take. */
function mix(a, b, t) {
  const hex = (c) => [1, 3, 5].map((i) => Number.parseInt(c.slice(i, i + 2), 16));
  const [r1, g1, b1] = hex(a);
  const [r2, g2, b2] = hex(b);
  const ch = (x, y) => Math.round(x + (y - x) * t).toString(16).padStart(2, "0");
  return `#${ch(r1, r2)}${ch(g1, g2)}${ch(b1, b2)}`.toUpperCase();
}

/**
 * Type has an absolute legibility floor that percentages do not respect: 2.6%
 * of the short edge is a comfortable 3.8mm caption on an A5 card and an
 * unreadable 1.9mm on an A7 one. So the library raises any line that would
 * print below this, once, here.
 *
 * Deliberately not done in the renderer. A template shipping illegible fine
 * print is a defect in the library; an owner who shrinks their own text has
 * made a choice, and gets a warning rather than an override.
 */
const MIN_TYPE_MM = 2.35;

function applyTypeFloor(spec) {
  const short = Math.min(spec.size.widthMm, spec.size.heightMm);
  const floorPct = (MIN_TYPE_MM / short) * 100;
  return {
    ...spec,
    blocks: spec.blocks.map((b) =>
      b.kind === "text" && b.text.sizePct < floorPct
        ? { ...b, text: { ...b.text, sizePct: Math.round(floorPct * 10) / 10 } }
        : b,
    ),
  };
}

/**
 * The same idea for the code itself, and for the same reason: a percentage that
 * gives a comfortable QR on an A6 card gives an unprintable one on A7.
 *
 * The number that decides whether a printed code scans is the size of a single
 * module, not the size of the code — a long URL at high error correction packs
 * more modules into the same square. Below about 0.5mm an office printer bleeds
 * neighbouring modules together. So the library sizes its QR to clear that,
 * whatever card it lands on.
 *
 * A URL of ~80 characters at level H is 57 modules including the quiet zone,
 * which is what this assumes; the renderer measures the real matrix and warns
 * if a longer URL pushes it under anyway.
 */
const MIN_MODULE_MM = 0.52;
const ASSUMED_MODULES = 57;

function applyQrFloor(spec) {
  const short = Math.min(spec.size.widthMm, spec.size.heightMm);
  return {
    ...spec,
    blocks: spec.blocks.map((b) => {
      if (b.kind !== "qr") return b;
      const usable = 1 - (b.qr.paddingPct / 100) * 2;
      const neededMm = (MIN_MODULE_MM * ASSUMED_MODULES) / usable;
      const neededPct = Math.ceil((neededMm / short) * 100);
      return b.qr.sizePct >= neededPct ? b : { ...b, qr: { ...b.qr, sizePct: Math.min(90, neededPct) } };
    }),
  };
}

const linear = (angle, ...stops) => ({
  kind: "gradient",
  gradient: {
    kind: "linear",
    angle,
    stops: stops.map((color, i) => ({ color, at: Math.round((i / (stops.length - 1)) * 100) })),
  },
});

/* ------------------------------------------------------------- the families */

/**
 * Every family is `(p, land) => partial spec`. The `land` branches are where
 * the real design work is: a landscape card has far less vertical room, so it
 * drops supporting lines and shrinks the QR rather than scaling everything
 * down uniformly and ending up with an unscannable code.
 */

const minimal = (p, land) => ({
  background: solid(p.bg),
  gapPct: land ? 2.2 : 3,
  padTopPct: land ? 11 : 9,
  padBottomPct: land ? 11 : 9,
  blocks: seq([
    t("SCAN TO ORDER", { sizePct: land ? 2.6 : 3, weight: 600, letterSpacing: 0.26, transform: "upper", color: p.mute }),
    t("{outlet}", { sizePct: land ? 6.6 : 8.4, weight: 700, letterSpacing: -0.02, color: p.fg, maxLines: 2 }),
    land ? null : sp(1.5),
    q({ sizePct: land ? 36 : 46, color: p.qr, plate: p.plate !== p.bg, plateColor: p.plate, plateRadiusPct: 4, paddingPct: 6 }),
    t("TABLE {table}", { sizePct: land ? 4.2 : 5, weight: 700, letterSpacing: 0.08, transform: "upper", color: p.fg }),
    land ? null : dv({ color: p.mute, thicknessPct: 0.22, widthPct: 26 }),
    land ? null : t("Menu, order and pay from your phone", { sizePct: 2.9, color: p.mute, maxLines: 2 }),
  ]),
});

const headline = (p, land) => {
  const c = flip(p);
  return {
    background: solid(c.bg),
    gapPct: land ? 1.8 : 2.4,
    align: "center",
    blocks: seq([
      t("{outlet}", { fontId: "bebas", sizePct: land ? 10 : 13, weight: 400, letterSpacing: 0.03, transform: "upper", color: c.fg, maxLines: 2, lineHeight: 1 }),
      dv({ color: p.accent, thicknessPct: land ? 0.9 : 1.2, widthPct: 100 }),
      t("SCAN · ORDER · PAY", { sizePct: land ? 2.6 : 3, weight: 700, letterSpacing: 0.2, transform: "upper", color: p.accent }),
      q({ sizePct: land ? 37 : 44, color: "#111111", plate: true, plateColor: "#FFFFFF", plateRadiusPct: 3, paddingPct: 7 }),
      t("TABLE {table}", { fontId: "bebas", sizePct: land ? 7 : 8.5, weight: 400, transform: "upper", letterSpacing: 0.06, color: c.fg, lineHeight: 1 }),
    ]),
  };
};

const frame = (p, land) => ({
  background: solid(p.bg),
  border: { enabled: true, color: p.accent, widthPct: 0.45, insetPct: land ? 5 : 4.5, radiusPct: 1.2, style: "solid" },
  padTopPct: land ? 15 : 13,
  padBottomPct: land ? 15 : 13,
  padLeftPct: 13,
  padRightPct: 13,
  gapPct: land ? 2 : 2.6,
  blocks: seq([
    ic(["utensils"], { sizePct: land ? 4 : 4.6, color: p.accent, strokePct: 8 }),
    t("{outlet}", { fontId: "playfair", sizePct: land ? 6.4 : 8, weight: 700, color: p.fg, maxLines: 2, lineHeight: 1.1 }),
    t("{tagline}", { fontId: "playfair", sizePct: land ? 2.8 : 3.2, italic: true, color: p.mute, maxLines: 1 }),
    dv({ color: p.accent, thicknessPct: 0.2, widthPct: 18 }),
    q({ sizePct: land ? 34 : 42, color: p.qr, plate: p.plate !== p.bg, plateColor: p.plate, plateRadiusPct: 4, paddingPct: 6 }),
    t("Table {table}", { sizePct: land ? 3.8 : 4.4, weight: 600, letterSpacing: 0.05, color: p.fg }),
    land ? null : t("Scan for the menu", { sizePct: 2.8, color: p.mute }),
  ]),
});

const banner = (p, land) => ({
  background: solid(p.bg),
  padTopPct: land ? 8 : 6,
  padBottomPct: land ? 8 : 6,
  gapPct: land ? 2 : 2.6,
  blocks: seq([
    dv({ color: p.accent, thicknessPct: land ? 2.4 : 3, widthPct: 100 }),
    t("{outlet}", { fontId: "archivo-black", sizePct: land ? 6 : 7.4, weight: 400, transform: "upper", letterSpacing: -0.01, color: p.fg, maxLines: 2, lineHeight: 1.08 }),
    t("SCAN THE CODE TO SEE THE MENU", { sizePct: land ? 2.4 : 2.7, weight: 600, letterSpacing: 0.16, transform: "upper", color: p.mute, maxLines: 2 }),
    q({ sizePct: land ? 35 : 43, color: p.qr, plate: true, plateColor: p.plate, plateRadiusPct: 4, paddingPct: 6 }),
    t("TABLE {table}", {
      sizePct: land ? 3.6 : 4.2,
      weight: 700,
      letterSpacing: 0.12,
      transform: "upper",
      color: p.bg,
      chip: true,
      chipColor: p.accent,
      chipRadiusPct: 50,
      chipPadXPct: 5,
      chipPadYPct: 1.8,
    }),
    dv({ color: p.accent, thicknessPct: land ? 2.4 : 3, widthPct: 100 }),
  ]),
});

const photo = (p, land) => ({
  // An empty image falls back to this gradient, so the template looks finished
  // in the gallery and improves the moment the owner drops a photo in.
  background: {
    kind: "image",
    image: "",
    imageFit: "cover",
    // Runs from the palette's own dark ground into its accent, so the 42%
    // black scrim deepens the image rather than muddying a light one — and so
    // white type holds up across the whole ramp.
    gradient: { kind: "linear", angle: 155, stops: [{ color: p.bg, at: 0 }, { color: p.accent, at: 100 }] },
    color: p.bg,
    scrimColor: "#000000",
    scrimOpacity: 42,
  },
  gapPct: land ? 2 : 2.8,
  padTopPct: land ? 12 : 10,
  padBottomPct: land ? 12 : 10,
  blocks: seq([
    t("{outlet}", { fontId: "jakarta", sizePct: land ? 6.8 : 8.6, weight: 800, letterSpacing: -0.02, color: "#FFFFFF", shadow: "soft", maxLines: 2, lineHeight: 1.1 }),
    t("{tagline}", { fontId: "jakarta", sizePct: land ? 2.8 : 3.1, weight: 500, color: "#FFFFFFDD", shadow: "soft", maxLines: 2 }),
    land ? null : sp(2),
    q({ sizePct: land ? 36 : 44, color: "#111111", plate: true, plateColor: "#FFFFFF", plateRadiusPct: 8, paddingPct: 8 }),
    t("TABLE {table}", { fontId: "jakarta", sizePct: land ? 3.6 : 4.2, weight: 700, letterSpacing: 0.14, transform: "upper", color: "#FFFFFF", shadow: "soft" }),
  ]),
});

const gradientFamily = (p, land) => ({
  // Only part-way to the accent. A full bg→accent ramp crosses too much of the
  // value range for one text colour to stay readable at both ends: whichever
  // end you tune for, the type disappears at the other.
  background: linear(155, p.bg, mix(p.bg, p.accent, 0.5)),
  gapPct: land ? 2 : 2.8,
  blocks: seq([
    t("SCAN TO ORDER", { fontId: "outfit", sizePct: land ? 2.6 : 2.9, weight: 600, letterSpacing: 0.28, transform: "upper", color: p.fg, opacity: 78 }),
    t("{outlet}", { fontId: "outfit", sizePct: land ? 6.8 : 8.6, weight: 700, letterSpacing: -0.02, color: p.fg, maxLines: 2, lineHeight: 1.1 }),
    land ? null : sp(1.5),
    q({ sizePct: land ? 37 : 45, color: "#111111", plate: true, plateColor: "#FFFFFF", plateRadiusPct: 10, paddingPct: 8 }),
    t("TABLE {table}", { fontId: "outfit", sizePct: land ? 3.8 : 4.4, weight: 700, letterSpacing: 0.1, transform: "upper", color: p.fg }),
    land ? null : t("No app needed — just your camera", { fontId: "outfit", sizePct: 2.8, weight: 500, color: p.fg, opacity: 72, maxLines: 2 }),
  ]),
});

const ticket = (p, land) => ({
  background: solid(p.bg),
  gapPct: land ? 2 : 2.6,
  padTopPct: land ? 10 : 8,
  padBottomPct: land ? 10 : 8,
  blocks: seq([
    t("{outlet}", { fontId: "plex-mono", sizePct: land ? 5.2 : 6.4, weight: 600, letterSpacing: 0.02, transform: "upper", color: p.fg, maxLines: 2, lineHeight: 1.15 }),
    dv({ style: "dashed", color: p.mute, thicknessPct: 0.28, widthPct: 100 }),
    t("TABLE {table}   ·   {zone}", { fontId: "plex-mono", sizePct: land ? 3 : 3.4, weight: 500, letterSpacing: 0.04, transform: "upper", color: p.mute }),
    q({ sizePct: land ? 36 : 44, color: p.qr, plate: p.plate !== p.bg, plateColor: p.plate, plateRadiusPct: 2, paddingPct: 6, moduleStyle: "square" }),
    dv({ style: "dashed", color: p.mute, thicknessPct: 0.28, widthPct: 100 }),
    t("SCAN · ORDER · PAY", { fontId: "plex-mono", sizePct: land ? 2.6 : 3, weight: 600, letterSpacing: 0.16, transform: "upper", color: p.fg }),
  ]),
});

const emblem = (p, land) => ({
  background: solid(p.bg),
  gapPct: land ? 2 : 2.6,
  blocks: seq([
    t("EST. HERE", { fontId: "work-sans", sizePct: land ? 2.3 : 2.6, weight: 600, letterSpacing: 0.3, transform: "upper", color: p.mute }),
    t("{outlet}", { fontId: "fraunces", sizePct: land ? 6.6 : 8, weight: 700, color: p.fg, maxLines: 2, lineHeight: 1.08 }),
    q({
      // Larger than the other families, because a round plate spends 16% of
      // the box on padding to contain the square code. Keep these in step: drop
      // the size back and the modules fall under the printable limit.
      sizePct: land ? 46 : 54,
      color: p.qr,
      plate: true,
      plateColor: p.plate,
      plateRadiusPct: 50,
      // A round plate only contains the square code inside its inscribed
      // square, which is 70.7% of the diameter — so a circle needs at least
      // ~15% padding or the corners of the QR hang outside the plate.
      paddingPct: 16,
      moduleStyle: "dot",
      eyeFrame: "circle",
      eyeBall: "circle",
      // The finder patterns stay the module colour rather than taking the
      // accent. A scanner locates the code by these three squares before
      // reading anything, and half these palettes have a light accent that
      // would leave them invisible on a light plate. The round shape is what
      // gives this family its character; the colour is not worth the risk.
    }),
    t("TABLE {table}", {
      fontId: "work-sans",
      sizePct: land ? 3.4 : 3.8,
      weight: 700,
      letterSpacing: 0.14,
      transform: "upper",
      color: p.bg,
      chip: true,
      chipColor: p.fg,
      chipRadiusPct: 50,
      chipPadXPct: 5,
      chipPadYPct: 1.8,
    }),
    ic(["instagram", "wifi", "phone"], { sizePct: land ? 3.4 : 3.8, gapPct: 4, color: p.mute, strokePct: 8 }),
  ]),
});

const editorial = (p, land) => ({
  background: solid(p.bg),
  align: "left",
  justify: "between",
  padTopPct: land ? 12 : 10,
  padBottomPct: land ? 12 : 10,
  padLeftPct: 11,
  padRightPct: 11,
  gapPct: land ? 2 : 2.6,
  blocks: seq([
    t("{outlet}", { fontId: "space-grotesk", sizePct: land ? 6.4 : 7.8, weight: 700, letterSpacing: -0.03, color: p.fg, maxLines: 2, lineHeight: 1.08 }),
    t("{address}", { fontId: "space-grotesk", sizePct: land ? 2.6 : 2.9, weight: 400, color: p.mute, maxLines: 2, widthPct: 78 }),
    dv({ color: p.accent, thicknessPct: 0.5, widthPct: 22 }),
    q({ sizePct: land ? 36 : 44, color: p.qr, plate: p.plate !== p.bg, plateColor: p.plate, plateRadiusPct: 4, paddingPct: 6 }),
    t("TABLE {table}", { fontId: "space-grotesk", sizePct: land ? 4.6 : 5.6, weight: 700, letterSpacing: 0.04, transform: "upper", color: p.fg }),
    t("Point your camera at the code to open the menu.", { fontId: "space-grotesk", sizePct: land ? 2.5 : 2.8, color: p.mute, maxLines: 2, widthPct: 86 }),
  ]),
});

const FAMILIES = {
  minimal: { label: "Minimal", build: minimal, hint: "Quiet and typographic. Reads well on any paper." },
  headline: { label: "Headline", build: headline, hint: "A reversed card with the name set huge." },
  frame: { label: "Frame", build: frame, hint: "A ruled border and a serif name — the fine-dining shape." },
  banner: { label: "Banner", build: banner, hint: "Heavy bars top and bottom with a badged table number." },
  photo: { label: "Photo", build: photo, hint: "Built for your own picture behind the type. Add one to finish it." },
  gradient: { label: "Gradient", build: gradientFamily, hint: "A colour wash with a bright rounded code plate." },
  ticket: { label: "Ticket", build: ticket, hint: "Monospaced and dashed, like a printed stub." },
  emblem: { label: "Emblem", build: emblem, hint: "A round code plate with dotted modules and a crest feel." },
  editorial: { label: "Editorial", build: editorial, hint: "Left-aligned and asymmetric, spread to the card edges." },
};

/* ------------------------------------------------------------ the library */

/**
 * [family, palette key, size preset, landscape]
 *
 * Nothing here sits on `strip` or `card-90`. A stacked design needs a QR of at
 * least 22mm plus type above the ~2.4mm legibility floor, and a 55–60mm short
 * edge cannot hold both — the QR ends up unscannable or the caption unreadable.
 * Those two sizes stay selectable on any template; they are just not where a
 * six-block layout starts.
 */
const VARIANTS = [
  ["minimal", "ink", "a6", false],
  ["minimal", "paper", "a7", false],
  ["minimal", "sage", "wide-160", true],
  ["minimal", "slate", "talker", true],

  ["headline", "char", "a6", false],
  ["headline", "mango", "a5", false],
  ["headline", "ink", "wide-160", true],
  ["headline", "chili", "a6", true],

  ["frame", "cream", "a6", false],
  ["frame", "plum", "a7", false],
  ["frame", "blush", "wide-160", true],
  ["frame", "royal", "a5", false],

  ["banner", "royal", "a6", false],
  ["banner", "chili", "a6", false],
  ["banner", "mango", "a5", true],
  ["banner", "slate", "a6", true],

  ["photo", "ink", "a6", false],
  ["photo", "char", "a5", false],
  ["photo", "plum", "wide-160", true],
  ["photo", "royal", "a6", true],

  ["gradient", "plum", "a6", false],
  ["gradient", "mint", "a7", false],
  ["gradient", "royal", "wide-160", true],
  ["gradient", "blush", "square-120", true],

  ["ticket", "paper", "a6", false],
  ["ticket", "cream", "a7", false],
  ["ticket", "slate", "talker", true],
  ["ticket", "char", "square-95", true],

  ["emblem", "mint", "square-120", true],
  ["emblem", "blush", "a6", false],
  ["emblem", "sage", "a7", false],
  ["emblem", "chili", "square-95", true],

  ["editorial", "slate", "a6", false],
  ["editorial", "ink", "a5", false],
  ["editorial", "cream", "wide-160", true],
  ["editorial", "mango", "a6", true],
];

export const CARD_TEMPLATES = VARIANTS.map(([familyKey, paletteKey, presetId, land]) => {
  const family = FAMILIES[familyKey];
  const palette = P[paletteKey];
  const size = sizeOf(presetId, land);
  return {
    id: `${familyKey}-${paletteKey}`,
    name: `${palette.label} ${family.label}`,
    family: familyKey,
    familyLabel: family.label,
    palette: paletteKey,
    hint: family.hint,
    orientation: size.widthMm >= size.heightMm ? "landscape" : "portrait",
    widthMm: size.widthMm,
    heightMm: size.heightMm,
    /** Parsed on demand — see the note at the top of this file. */
    build: () =>
      applyQrFloor(
        applyTypeFloor(
          qrCardSpecSchema.parse({ ...family.build(palette, land), templateId: `${familyKey}-${paletteKey}`, size }),
        ),
      ),
  };
});

export const CARD_TEMPLATE_FAMILIES = Object.entries(FAMILIES).map(([id, f]) => ({
  id,
  label: f.label,
  hint: f.hint,
}));

/**
 * Never throws and never returns undefined — the same forgiving contract as
 * `fontById` and the variant registry's `pick`. A design referencing a template
 * that was renamed or removed still opens; it just reports the wrong ancestry.
 */
export const cardTemplateById = (id) => CARD_TEMPLATES.find((tpl) => tpl.id === id) ?? CARD_TEMPLATES[0];

/** What a brand-new outlet's design starts as. */
export const defaultQrCardSpec = () => cardTemplateById("minimal-ink").build();
