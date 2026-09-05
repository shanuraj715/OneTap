import { z } from "zod";

/**
 * Printable table cards.
 *
 * An outlet designs ONE card and prints it for every table: the design is
 * shared, and each printed copy carries that table's own signed QR plus any
 * text bound to that table's number. So nothing in here is per-table — the
 * table is data passed to the renderer, not part of the saved design.
 *
 * Two rules make the rest of this file make sense:
 *
 *  1. Every spatial value is a PERCENTAGE, never millimetres. Font sizes, QR
 *     size, icon size and gaps are a percent of the card's *short edge*;
 *     paddings are a percent of their own axis. That is what lets one template
 *     definition render correctly on a 74mm A7 and a 210mm A4 with no
 *     per-size tuning — and therefore what makes a library of 36 templates
 *     maintainable at all.
 *  2. Blocks are flat and tagged with `kind`, not a discriminated union.
 *     Heterogeneous subdocument arrays fight Mongoose (Mixed loses validation,
 *     discriminators need per-branch schemas), and `blockConfigSchema` in
 *     printing.js is flat for exactly the same reason. Styling is grouped into
 *     `text` / `qr` / `image` / `icon` / `divider` / `spacer` sub-objects so an
 *     editor can render one section at a time and ignore the rest.
 */

/* ------------------------------------------------------------------ scalars */

const HEX = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/** Hex, or the literal "transparent" — both are valid canvas fill styles. */
export const cardColorSchema = z
  .string()
  .trim()
  .refine((v) => v === "transparent" || HEX.test(v), {
    message: "Expected a hex colour like #1A1A1A",
  });

/**
 * Images travel inside the design as data URLs rather than as uploads.
 * Drawing a remote image onto a canvas taints it and makes `toBlob` throw, and
 * the S3/R2 storage provider only implements PUT and DELETE, so there is no
 * read path to proxy a card image back through. The admin downscales before
 * embedding; the total-spec size is capped in the service rather than per
 * field, so one big background and three small icons is fine.
 */
export const cardImageSchema = z.string().max(1_500_000).default("");

export const cardAlignSchema = z.enum(["left", "center", "right"]);

/* ---------------------------------------------------------------- gradients */

export const gradientStopSchema = z.object({
  color: cardColorSchema,
  /** position along the gradient, 0–100 */
  at: z.number().min(0).max(100),
});

export const gradientSchema = z.object({
  kind: z.enum(["linear", "radial"]).default("linear"),
  /** CSS-style angle in degrees; 180 runs top to bottom. Ignored when radial. */
  angle: z.number().min(0).max(360).default(180),
  stops: z.array(gradientStopSchema).min(2).max(6),
});

/* --------------------------------------------------------------- card sizes */

/**
 * Named starting points. `custom` lets an owner type any millimetre size —
 * these just save them the arithmetic for the paper they actually own.
 * Orientation is never stored: it is `widthMm >= heightMm`, so flipping a card
 * is a swap of two numbers and can never disagree with a stored flag.
 */
export const CARD_SIZES = [
  { id: "a7", label: "A7 card", widthMm: 74, heightMm: 105, hint: "Small tent card. Eight per A4 sheet." },
  { id: "a6", label: "A6 postcard", widthMm: 105, heightMm: 148, hint: "The usual table card. Four per A4 sheet." },
  { id: "a5", label: "A5 half-page", widthMm: 148, heightMm: 210, hint: "Big and readable from across the table. Two per A4." },
  { id: "a4", label: "A4 poster", widthMm: 210, heightMm: 297, hint: "Counter or wall poster rather than a table card." },
  { id: "square-95", label: "Square 95mm", widthMm: 95, heightMm: 95, hint: "Coaster-sized square." },
  { id: "square-120", label: "Square 120mm", widthMm: 120, heightMm: 120, hint: "Larger square, good for an acrylic stand." },
  { id: "talker", label: "Table talker", widthMm: 90, heightMm: 120, hint: "Slim upright card for a clip stand." },
  { id: "card-90", label: "Business card", widthMm: 90, heightMm: 55, hint: "Landscape. Fits a card holder or a bill folder." },
  { id: "strip", label: "Counter strip", widthMm: 150, heightMm: 60, hint: "Landscape strip to sit beside a till." },
  { id: "wide-160", label: "Wide 160×100", widthMm: 160, heightMm: 100, hint: "Landscape card with room for a logo beside the QR." },
];

export const cardSizeById = (id) => CARD_SIZES.find((s) => s.id === id) ?? CARD_SIZES[1];

/** Landscape at exactly square: a square card is laid out on the wider axis. */
export const cardOrientation = (size) => (size.widthMm >= size.heightMm ? "landscape" : "portrait");

/** Percent units resolve against the short edge, so a card scales as one piece. */
export const cardShortEdgeMm = (size) => Math.min(size.widthMm, size.heightMm);

export const cardSizeSchema = z.object({
  /** id from CARD_SIZES, or "custom" — provenance only, the mm below are authoritative */
  preset: z.string().max(40).default("a6"),
  widthMm: z.number().min(40).max(420).default(105),
  heightMm: z.number().min(40).max(420).default(148),
  /** rounded card corners, percent of the short edge — only visible with a cut line or a coloured ground */
  cornerRadiusPct: z.number().min(0).max(20).default(0),
});

/* -------------------------------------------------------------- background */

export const cardBackgroundSchema = z.object({
  /**
   * "image" with an empty `image` falls back to `gradient`, then to `color`.
   * That fallback is what lets a photo template ship in the library at all:
   * bundling real photography would push megabytes into every admin page load,
   * so a photo template ships a gradient stand-in and prompts for a picture.
   */
  kind: z.enum(["color", "gradient", "image"]).default("color"),
  color: cardColorSchema.default("#FFFFFF"),
  gradient: gradientSchema.nullable().default(null),
  image: cardImageSchema,
  /** how the photo fills the card */
  imageFit: z.enum(["cover", "contain", "tile"]).default("cover"),
  imageOpacity: z.number().min(0).max(100).default(100),
  /**
   * A wash over the photo. Text over an unmodified photo is unreadable at some
   * point in every photo, so a scrim is the difference between a template that
   * works with the owner's picture and one that only works with mine.
   */
  scrimColor: cardColorSchema.default("#000000"),
  scrimOpacity: z.number().min(0).max(100).default(0),
});

/* ------------------------------------------------------------------ border */

export const cardBorderSchema = z.object({
  enabled: z.boolean().default(false),
  color: cardColorSchema.default("#1A1A1A"),
  /** stroke weight, percent of the short edge */
  widthPct: z.number().min(0.1).max(6).default(0.6),
  /** distance in from the card edge, percent of the short edge */
  insetPct: z.number().min(0).max(20).default(4),
  radiusPct: z.number().min(0).max(20).default(0),
  style: z.enum(["solid", "dashed", "dotted", "double"]).default("solid"),
});

/* ------------------------------------------------------------ block styling */

export const textStyleSchema = z.object({
  /**
   * Supports tokens — see CARD_TOKENS. "Table {table}" beats a custom-or-bound
   * enum because one field covers both fixed copy and mixed copy
   * ("Ask for {outlet} on WhatsApp") without a second concept.
   */
  content: z.string().max(400).default(""),
  /** id from FONT_FAMILIES in typography.js */
  fontId: z.string().max(40).default("inter"),
  /** font size, percent of the short edge */
  sizePct: z.number().min(1).max(30).default(5),
  weight: z.number().int().min(100).max(900).default(400),
  color: cardColorSchema.default("#111111"),
  /** em, applied via ctx.letterSpacing where supported */
  letterSpacing: z.number().min(-0.1).max(1).default(0),
  lineHeight: z.number().min(0.8).max(3).default(1.25),
  italic: z.boolean().default(false),
  transform: z.enum(["none", "upper", "lower"]).default("none"),
  opacity: z.number().min(0).max(100).default(100),
  /** wrap width, percent of the content column */
  widthPct: z.number().min(10).max(100).default(100),
  /** lines beyond this are dropped with an ellipsis rather than overflowing the card */
  maxLines: z.number().int().min(1).max(8).default(3),
  /** legibility over a photo, as presets — a full shadow object is more knobs than anyone tunes */
  shadow: z.enum(["none", "soft", "hard"]).default("none"),
  /** a filled pill behind the text: what turns a text block into a badge */
  chip: z.boolean().default(false),
  chipColor: cardColorSchema.default("#111111"),
  chipRadiusPct: z.number().min(0).max(50).default(50),
  chipPadXPct: z.number().min(0).max(20).default(4),
  chipPadYPct: z.number().min(0).max(20).default(1.6),
});

/**
 * QR styling. The renderer overrides two of these for scannability rather than
 * trusting the saved values: `ecc` is forced to "H" whenever a logo is set, and
 * a quiet zone of 4 modules is always added on top of `paddingPct`. Both are
 * enforced there, not here, because a design saved before a logo was added must
 * still round-trip unchanged.
 */
export const qrStyleSchema = z.object({
  /** QR box including its padding, percent of the short edge */
  sizePct: z.number().min(15).max(90).default(45),
  /** padding inside the plate, percent of the QR box — additive with the mandatory quiet zone */
  paddingPct: z.number().min(0).max(25).default(6),
  color: cardColorSchema.default("#111111"),
  background: cardColorSchema.default("#FFFFFF"),
  /** module gradient; every stop is contrast-checked, since a light stop fails on its own */
  gradient: gradientSchema.nullable().default(null),
  /**
   * A light rectangle behind the QR. Defaults on because it is what makes a QR
   * survive being dropped onto a dark or photographic card at all.
   */
  plate: z.boolean().default(true),
  plateColor: cardColorSchema.default("#FFFFFF"),
  plateRadiusPct: z.number().min(0).max(50).default(6),
  moduleStyle: z.enum(["square", "dot", "rounded", "classy", "diamond", "bar-h", "bar-v"]).default("square"),
  eyeFrame: z.enum(["square", "rounded", "circle", "leaf"]).default("square"),
  eyeBall: z.enum(["square", "rounded", "circle", "diamond"]).default("square"),
  /** null inherits the module colour */
  eyeColor: cardColorSchema.nullable().default(null),
  eyeBallColor: cardColorSchema.nullable().default(null),
  logo: cardImageSchema,
  /**
   * Capped at 28%, not because 28% of area is recoverable, but because it is
   * not: error correction recovers *errors* at half the rate of *erasures*, and
   * the decoder cannot know which codewords the logo destroyed — so every
   * covered codeword costs two from the budget. "H" is 30% of codewords, which
   * buys roughly 15% of coverable area with margin left for print and glare.
   */
  logoSizePct: z.number().min(5).max(28).default(20),
  /** knockout ring around the logo, percent of the logo size */
  logoPadPct: z.number().min(0).max(50).default(16),
  logoShape: z.enum(["square", "rounded", "circle"]).default("rounded"),
  ecc: z.enum(["L", "M", "Q", "H"]).default("H"),
});

export const imageStyleSchema = z.object({
  src: cardImageSchema,
  /** percent of the content column */
  widthPct: z.number().min(5).max(100).default(40),
  /** width ÷ height; null keeps the file's own proportions */
  aspect: z.number().min(0.1).max(10).nullable().default(null),
  fit: z.enum(["cover", "contain"]).default("contain"),
  radiusPct: z.number().min(0).max(50).default(0),
  opacity: z.number().min(0).max(100).default(100),
});

export const iconStyleSchema = z.object({
  /** names from CARD_ICONS — a row, so "wifi · instagram · phone" is one block */
  names: z.array(z.string().max(30)).max(6).default([]),
  /** percent of the short edge */
  sizePct: z.number().min(1).max(20).default(5),
  color: cardColorSchema.default("#111111"),
  /** space between icons, percent of the short edge */
  gapPct: z.number().min(0).max(20).default(3),
  style: z.enum(["plain", "circle", "square"]).default("plain"),
  badgeColor: cardColorSchema.default("#111111"),
  /** stroke weight for the drawn glyphs, percent of the icon size */
  strokePct: z.number().min(2).max(20).default(8),
});

export const dividerStyleSchema = z.object({
  style: z.enum(["solid", "dashed", "dotted", "double"]).default("solid"),
  /** percent of the short edge */
  thicknessPct: z.number().min(0.05).max(4).default(0.35),
  /** percent of the content column */
  widthPct: z.number().min(5).max(100).default(100),
  color: cardColorSchema.default("#DDDDDD"),
});

export const spacerStyleSchema = z.object({
  /** percent of the short edge */
  heightPct: z.number().min(0).max(50).default(5),
});

/* ------------------------------------------------------------------ blocks */

export const CARD_BLOCK_KINDS = ["text", "qr", "image", "icon", "divider", "spacer"];
export const cardBlockKindSchema = z.enum(CARD_BLOCK_KINDS);

export const CARD_BLOCK_LABELS = {
  text: "Text",
  qr: "QR code",
  image: "Image or logo",
  icon: "Icons",
  divider: "Divider line",
  spacer: "Blank space",
};

export const CARD_BLOCK_HINTS = {
  text: "A line of your own words. Use {table} and the other tokens to fill in details per table.",
  qr: "The scannable code. Every printed card gets its own table's code automatically.",
  image: "Your logo, or any picture. Travels with the design, so it prints even offline.",
  icon: "A row of small symbols — wifi, phone, Instagram — drawn to match your colours.",
  divider: "A rule across the card to separate one part from another.",
  spacer: "Empty space. The simplest way to push things apart.",
};

export const cardBlockSchema = z.object({
  id: z.string().min(1).max(60),
  kind: cardBlockKindSchema,
  enabled: z.boolean().default(true),
  /** null inherits the card's alignment */
  align: cardAlignSchema.nullable().default(null),
  /** space above this block, percent of the short edge — null uses the card's gap */
  gapPct: z.number().min(0).max(40).nullable().default(null),
  text: textStyleSchema.default({}),
  qr: qrStyleSchema.default({}),
  image: imageStyleSchema.default({}),
  icon: iconStyleSchema.default({}),
  divider: dividerStyleSchema.default({}),
  spacer: spacerStyleSchema.default({}),
});

/* ------------------------------------------------------------- tent & print */

/**
 * A table tent is one sheet folded so it reads from both sides. Without this
 * the owner's very first question after downloading is "how do I make it stand
 * up?" — and the answer would otherwise be "design a second card upside down".
 * The renderer paints the same laid-out card twice under a transform, so this
 * costs no layout code.
 */
export const cardTentSchema = z.object({
  enabled: z.boolean().default(false),
  mode: z.enum(["duplicate", "rotate180", "blank"]).default("rotate180"),
  /** flat area at the fold so the crease does not cut through the design */
  foldGapMm: z.number().min(0).max(20).default(6),
});

export const cardPrintSchema = z.object({
  /**
   * 300 is print quality and keeps A4 at 8.7M pixels. 600 would be 35M, past
   * the ~16.7M canvas-area ceiling iOS Safari enforces by silently handing back
   * a blank canvas, so it is not offered.
   */
  dpi: z.union([z.literal(150), z.literal(300)]).default(300),
  /** a hairline rectangle showing where to cut */
  cutLine: z.boolean().default(false),
  /** corner marks and bleed, for a commercial print shop rather than an office printer */
  cropMarks: z.boolean().default(false),
  bleedMm: z.number().min(0).max(6).default(0),
});

/* -------------------------------------------------------------------- spec */

export const qrCardSpecSchema = z.object({
  /** bumped only for a migration; the parser fills every field, so old docs load */
  version: z.literal(1).default(1),
  /** which template this started from — provenance for the editor, never a lookup */
  templateId: z.string().max(60).default("minimal-ink"),
  size: cardSizeSchema.default({}),
  background: cardBackgroundSchema.default({}),
  border: cardBorderSchema.default({}),
  /** inner margins, each a percent of its own axis */
  padTopPct: z.number().min(0).max(45).default(9),
  padRightPct: z.number().min(0).max(45).default(8),
  padBottomPct: z.number().min(0).max(45).default(9),
  padLeftPct: z.number().min(0).max(45).default(8),
  /** default space between blocks, percent of the short edge */
  gapPct: z.number().min(0).max(30).default(3),
  align: cardAlignSchema.default("center"),
  /** where the stack sits when it is shorter than the card */
  justify: z.enum(["start", "center", "end", "between"]).default("center"),
  blocks: z.array(cardBlockSchema).max(24).default([]),
  tent: cardTentSchema.default({}),
  print: cardPrintSchema.default({}),
});

/** What the API stores and returns for one outlet. */
export const qrCardDesignSchema = z.object({
  name: z.string().min(1).max(60).default("Table card"),
  spec: qrCardSpecSchema.default({}),
  updatedAt: z.string().nullable().default(null),
});

/* ------------------------------------------------------------------ tokens */

/**
 * Placeholders resolved per printed card. Kept here rather than in the renderer
 * so the editor's token palette and the renderer can never drift apart.
 */
export const CARD_TOKENS = [
  { token: "{table}", label: "Table number", hint: "The number printed on that table — 5, A3, Rooftop 2." },
  { token: "{zone}", label: "Zone", hint: "Which area the table is in, if you use zones." },
  { token: "{seats}", label: "Seats", hint: "How many people the table sits." },
  { token: "{outlet}", label: "Outlet name", hint: "This outlet's name, from Settings." },
  { token: "{tagline}", label: "Tagline", hint: "Your one-line tagline, from Settings." },
  { token: "{address}", label: "Address", hint: "This outlet's street address." },
  { token: "{phone}", label: "Phone", hint: "The phone number customers see." },
  { token: "{url}", label: "Menu link", hint: "The web address this card's QR opens." },
];

const TOKEN_PATTERN = /\{(table|zone|seats|outlet|tagline|address|phone|url)\}/g;

/**
 * Fill tokens from the card's data. A missing value collapses to an empty
 * string, and only then is the surrounding punctuation tidied — so a card
 * designed as "{outlet} · {zone}" does not print a dangling separator on a
 * table with no zone set, while a line the owner deliberately opened with a
 * dash keeps it.
 */
export function interpolateCardText(content, data = {}) {
  if (!content) return "";
  let collapsed = false;
  const filled = content.replace(TOKEN_PATTERN, (_, key) => {
    const value = data[key];
    if (value == null || value === "") {
      collapsed = true;
      return "";
    }
    return String(value);
  });
  if (!collapsed) return filled;
  return filled
    .replace(/[ \t]*[·•|–—-][ \t]*(?=$|\n)/g, "")
    .replace(/(^|\n)[ \t]*[·•|–—-][ \t]*/g, "$1")
    .replace(/[ \t]*([·•|])[ \t]*\1[ \t]*/g, " $1 ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

/* ------------------------------------------------------------------- icons */

/**
 * Icons are drawn by the renderer as canvas paths, not loaded as an icon font
 * or SVG sprites — a canvas cannot use an icon font reliably (the glyph falls
 * back silently to a box), and remote SVGs would taint the canvas the same way
 * a remote photo does. That keeps the set small and deliberate.
 */
export const CARD_ICONS = [
  { name: "wifi", label: "Wi-Fi" },
  { name: "phone", label: "Phone" },
  { name: "whatsapp", label: "WhatsApp" },
  { name: "instagram", label: "Instagram" },
  { name: "facebook", label: "Facebook" },
  { name: "location", label: "Location pin" },
  { name: "clock", label: "Clock" },
  { name: "star", label: "Star" },
  { name: "heart", label: "Heart" },
  { name: "leaf", label: "Leaf / veg" },
  { name: "chilli", label: "Chilli" },
  { name: "cup", label: "Cup" },
  { name: "utensils", label: "Cutlery" },
  { name: "scan", label: "Scan frame" },
  { name: "arrow-down", label: "Arrow down" },
  { name: "sparkle", label: "Sparkle" },
];

export const cardIconNames = () => CARD_ICONS.map((i) => i.name);

/* ------------------------------------------------------------------ limits */

/**
 * Scannability floors the renderer warns against. They live here so the editor
 * can warn while the owner is still dragging the slider, rather than only at
 * export.
 */
export const QR_MIN_MM = 22;
export const QR_COMFORTABLE_MM = 28;
export const QR_QUIET_MODULES = 4;
export const QR_LOGO_WARN_PCT = 24;
export const QR_MIN_CONTRAST = 4;

/** Guard on the whole serialised design, mirrored in the API. */
export const CARD_SPEC_MAX_BYTES = 3_500_000;
