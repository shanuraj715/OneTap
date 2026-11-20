import { z } from "zod";

/**
 * Where uploaded images (menu photos, and later logos) are stored.
 *
 * Two providers, the same adapter pattern as payment gateways and notification
 * channels: `local` writes to a folder the API serves, `s3` pushes to any
 * S3-compatible object store (AWS S3, Cloudflare R2, DigitalOcean Spaces,
 * Backblaze B2, MinIO…). Credentials live in their own encrypted-at-rest
 * collection, never in `outlet.config` — the storefront only ever sees the
 * finished public image URLs, which are saved onto the menu item itself.
 */
export const STORAGE_PROVIDERS = ["local", "s3"];
export const storageProviderSchema = z.enum(STORAGE_PROVIDERS);
/** @typedef {(typeof STORAGE_PROVIDERS)[number]} StorageProvider */

export const STORAGE_PROVIDER_LABELS = {
  local: "This server (local disk)",
  s3: "S3-compatible cloud storage",
};

export const STORAGE_PROVIDER_DESCRIPTIONS = {
  local:
    "Images are saved on the machine running the API and served from it. Nothing to configure — good for a single server. Make sure the uploads folder is on a disk that gets backed up.",
  s3:
    "Images are pushed to an object store — AWS S3, Cloudflare R2, DigitalOcean Spaces, Backblaze B2 or a self-hosted MinIO. Survives redeploys, serves from a CDN, and scales. You supply the bucket and keys.",
};

/**
 * The fields each provider needs, in the order the admin form shows them.
 * `secret: true` fields are encrypted at rest and never returned to the browser.
 * Shape matches `GATEWAY_FIELDS` / `NOTIFY_FIELDS` so the admin reuses the same form.
 */
export const STORAGE_FIELDS = {
  local: [
    {
      key: "publicBaseUrl",
      label: "Public base URL",
      secret: false,
      hint: "Optional — leave blank to serve straight from the API",
      info: "If a CDN or web server (nginx, Caddy) sits in front of the uploads folder, put its base URL here, e.g. https://cdn.yourshop.com. Images are then linked from there instead of from the API port.",
      placeholder: "https://cdn.yourshop.com",
    },
  ],
  s3: [
    {
      key: "bucket",
      label: "Bucket name",
      secret: false,
      info: "The bucket that will hold the images. It must allow public read on the objects (a bucket policy or 'public bucket' toggle), or set a Public base URL below that points at a CDN in front of it.",
      placeholder: "my-restaurant-media",
    },
    {
      key: "region",
      label: "Region",
      secret: false,
      hint: "us-east-1 for AWS · auto for Cloudflare R2",
      info: "The region the bucket lives in. Cloudflare R2 uses 'auto'. DigitalOcean Spaces uses the datacenter, e.g. 'blr1'.",
      placeholder: "ap-south-1",
    },
    {
      key: "endpoint",
      label: "Endpoint",
      secret: false,
      hint: "Blank for AWS S3 itself",
      info: "Only for S3-compatible services that aren't AWS. Cloudflare R2: https://<account-id>.r2.cloudflarestorage.com · DigitalOcean: https://blr1.digitaloceanspaces.com · MinIO: your MinIO URL.",
      placeholder: "https://<account>.r2.cloudflarestorage.com",
    },
    {
      key: "accessKeyId",
      label: "Access key ID",
      secret: false,
      info: "The public half of the key pair, from your provider's API-tokens / access-keys screen. Give the key permission to put and delete objects in this one bucket.",
      placeholder: "AKIA…",
    },
    {
      key: "secretAccessKey",
      label: "Secret access key",
      secret: true,
      info: "The private half of the pair, shown only once when the key is created. Stored encrypted and never shown again. If it has ever been pasted into a chat or an email, rotate it.",
    },
    {
      key: "publicBaseUrl",
      label: "Public base URL",
      secret: false,
      hint: "Optional — a CDN or custom domain in front of the bucket",
      info: "Where finished images are linked from. An R2 public bucket URL (https://pub-xxxx.r2.dev), a CloudFront domain, a Spaces CDN endpoint, or your own domain. Leave blank to link directly to the bucket (only works if the bucket serves public objects over HTTPS).",
      placeholder: "https://pub-abc123.r2.dev",
    },
  ],
};

/** The one field name that is a secret, per provider — handy for the API. */
export const STORAGE_SECRET_FIELDS = Object.fromEntries(
  Object.entries(STORAGE_FIELDS).map(([provider, fields]) => [
    provider,
    fields.filter((f) => f.secret).map((f) => f.key),
  ]),
);

/** Which fields must be filled for a provider to be usable. */
export const STORAGE_REQUIRED_FIELDS = {
  local: [],
  s3: ["bucket", "region", "accessKeyId", "secretAccessKey"],
};

/* ------------------------------------------------------------------- images */

/**
 * One stored image on a menu item. `url` is what the storefront renders; `key`
 * is the provider-relative path, kept so the file can be deleted later. The
 * dimensions are the *processed* ones the API's image pipeline reports back.
 */
export const menuImageSchema = z.object({
  url: z.string().min(1),
  key: z.string().default(""),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  /** which shape this picture is for — see ITEM_IMAGE_RATIOS. A picture saved before shapes existed is a square one. */
  ratio: z.enum(["1:1", "4:3", "16:9", "3:4"]).default("1:1"),
});
/** @typedef {z.infer<typeof menuImageSchema>} MenuImage */

/* -------------------------------------------------------- the shapes of a dish's pictures */

/**
 * A dish can have a picture for each shape a menu card shows it in, so a card that is wide or tall isn't a square photo
 * cropped to fit. The SQUARE set is the default (and the one every dish already has): small thumbnails, round cards, the
 * dish pop-up's gallery, and the fallback for a shape the dish has no picture for. `max` is how many of that shape a dish
 * can hold — squares form a gallery, the other shapes are one picture each (a card shows one).
 */
export const ITEM_IMAGE_RATIOS = [
  { id: "1:1", label: "Square", aspect: 1, max: 6, hint: "The default. Small thumbnails, round cards, and used wherever another shape is missing." },
  { id: "4:3", label: "Landscape", aspect: 4 / 3, max: 1, hint: "Cards with the photo on top." },
  { id: "16:9", label: "Wide", aspect: 16 / 9, max: 1, hint: "Wide cards and the dish pop-up." },
  { id: "3:4", label: "Portrait", aspect: 3 / 4, max: 1, hint: "Tall portrait cards." },
];
export const ITEM_IMAGE_RATIO_IDS = ITEM_IMAGE_RATIOS.map((r) => r.id);
export const DEFAULT_IMAGE_RATIO = "1:1";
/** Most pictures one dish can hold, all shapes together (6 square + one of each other shape). */
export const MAX_IMAGES_PER_ITEM = ITEM_IMAGE_RATIOS.reduce((n, r) => n + r.max, 0);

export const imageRatioMeta = (ratio) => ITEM_IMAGE_RATIOS.find((r) => r.id === ratio) ?? ITEM_IMAGE_RATIOS[0];
/** The shape of one stored picture (a picture without one — saved before shapes — is square). */
export const imageRatioOf = (image) => (ITEM_IMAGE_RATIO_IDS.includes(image?.ratio) ? image.ratio : DEFAULT_IMAGE_RATIO);
/** The dish's pictures of one shape, in order. */
export const imagesOfRatio = (item, ratio) => (item?.images ?? []).filter((im) => imageRatioOf(im) === ratio);

/**
 * The picture a card of this shape shows: the dish's own picture of that shape, else its first SQUARE picture (the
 * default), else — a dish that somehow has only other shapes — its first picture of any shape. `null` = no picture.
 */
export function itemImage(item, ratio = DEFAULT_IMAGE_RATIO) {
  const own = imagesOfRatio(item, ratio)[0];
  if (own) return own;
  return imagesOfRatio(item, DEFAULT_IMAGE_RATIO)[0] ?? (item?.images ?? [])[0] ?? null;
}
/** Same, as the address the page needs (undefined when there is no picture, which is what <Photo> expects). */
export const itemImageUrl = (item, ratio = DEFAULT_IMAGE_RATIO) => itemImage(item, ratio)?.url || undefined;

/**
 * The pictures a gallery of this shape cycles through: the dish's pictures of that shape if it has any, else its square
 * ones, else whatever it has. A dish with only square pictures therefore shows exactly the gallery it always did.
 */
export function itemGallery(item, ratio = DEFAULT_IMAGE_RATIO) {
  const own = imagesOfRatio(item, ratio);
  if (own.length) return own;
  const squares = imagesOfRatio(item, DEFAULT_IMAGE_RATIO);
  return squares.length ? squares : (item?.images ?? []);
}

/** Keep each shape within what it can hold (extra pictures of a shape are dropped, order kept). Unknown shapes become square. */
export function limitImages(images) {
  const used = new Map();
  const out = [];
  for (const im of images ?? []) {
    const ratio = imageRatioOf(im);
    const n = used.get(ratio) ?? 0;
    if (n >= imageRatioMeta(ratio).max) continue;
    used.set(ratio, n + 1);
    out.push({ ...im, ratio });
  }
  return out;
}

/** How many more pictures of this shape the dish can take. */
export const imageRoom = (images, ratio) => Math.max(0, imageRatioMeta(ratio).max - (images ?? []).filter((im) => imageRatioOf(im) === ratio).length);

/** The shape a card variant shows its photo in — what each card asks the dish for. A card with no photo isn't listed. */
export const CARD_IMAGE_RATIO = {
  "card.row-thumb-left": "1:1", // C02
  "card.row-thumb-right": "1:1", // C03
  "card.image-top": "4:3", // C04
  "card.image-top-badge": "4:3", // C05 (a 3:2 box — the 4:3 picture is trimmed a little)
  "card.text-above-image": "16:9", // C06
  "card.image-overlay": "4:3", // C07
  "card.portrait": "3:4", // C08
  "card.circle": "1:1", // C09
  "card.featured-wide": "16:9", // C11
};

/**
 * Upload limits. The server accepts anything its image library (sharp/libvips)
 * can decode — JPEG, PNG, WebP, AVIF, HEIC/HEIF, GIF, TIFF, SVG — and always
 * re-encodes to a web format, so the accept list here is only a hint for the
 * file picker.
 */
export const IMAGE_RULES = {
  maxPerItem: 6,
  /** raw upload cap — a phone HEIC/RAW can be big; the pipeline shrinks it after */
  maxUploadBytes: 30 * 1024 * 1024,
  acceptAttr: "image/*,.jpg,.jpeg,.png,.webp,.avif,.gif,.heic,.heif,.tif,.tiff,.bmp,.svg",
};

/* ----------------------------------------------------- image processing config */

export const IMAGE_OUTPUT_FORMATS = ["webp", "avif", "jpeg", "original"];
export const imageOutputFormatSchema = z.enum(IMAGE_OUTPUT_FORMATS);
/** @typedef {(typeof IMAGE_OUTPUT_FORMATS)[number]} ImageOutputFormat */

export const IMAGE_FORMAT_LABELS = {
  webp: "WebP — best size/quality, universal support (recommended)",
  avif: "AVIF — smallest files, slightly slower to make",
  jpeg: "JPEG — maximum compatibility, larger files",
  original: "Keep original format (AVIF/HEIC become AVIF)",
};

/**
 * How the API compresses every uploaded image. Per-outlet, editable in
 * Admin → Storage. The defaults are a good middle ground for a menu card.
 */
export const imageProcessingSchema = z.object({
  /** longest edge, in pixels — larger images are scaled down to this */
  maxDimension: z.number().int().min(320).max(4096).default(1600),
  /** encoder quality, 30–100 */
  quality: z.number().int().min(30).max(100).default(80),
  format: imageOutputFormatSchema.default("webp"),
  /** if the encoded image still exceeds this many KB, quality is stepped down to fit (0 = off) */
  targetMaxKB: z.number().int().min(0).max(20000).default(400),
});
/** @typedef {z.infer<typeof imageProcessingSchema>} ImageProcessing */

export const DEFAULT_IMAGE_PROCESSING = imageProcessingSchema.parse({});
