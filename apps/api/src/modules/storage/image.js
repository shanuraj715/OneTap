import sharp from "sharp";
import { HttpError } from "../../middleware/error.js";
import { logger } from "../../logger.js";

/**
 * The upload image pipeline.
 *
 * Accepts anything libvips can decode — JPEG, PNG, WebP, AVIF, HEIC/HEIF, GIF,
 * TIFF, SVG — auto-rotates from EXIF, scales down to the configured longest
 * edge, and re-encodes to one web format. If the result is still over the
 * outlet's size target, quality is stepped down until it fits; at the quality
 * floor the picture itself is made smaller (never below MIN_EDGE) until it
 * fits — very detailed images (grass, fabric, a busy plate) can't reach a
 * size target by quality alone. The final pixel dimensions come straight from
 * the encoder, so the rest of the app never has to decode an image.
 */

const MIME = {
  webp: "image/webp",
  avif: "image/avif",
  jpeg: "image/jpeg",
  png: "image/png",
};
const EXT = { webp: "webp", avif: "avif", jpeg: "jpg", png: "png" };
const QUALITY_FLOOR = 40;
const QUALITY_STEP = 12;
/** while chasing the size target the longest edge is never made smaller than this (or the configured maximum, if lower) */
const MIN_EDGE = 640;
/** quality passes (80 → 68 → 56 → 44 → 40) plus a few size passes; each pass is bounded, a hard image must still finish quickly */
const MAX_PASSES = 9;

/**
 * At most this many pictures are decoded at the same moment; the rest wait their turn. A big photo takes a few
 * hundred MB while it is processed, and the server is a small machine — several people uploading together must
 * slow down, not run it out of memory.
 */
const MAX_PARALLEL = 3;
let running = 0;
const waiting = [];
const takeSlot = () => (running < MAX_PARALLEL ? (running++, Promise.resolve()) : new Promise((resolve) => waiting.push(resolve)));
const freeSlot = () => {
  const next = waiting.shift();
  if (next) next(); // the slot passes straight to the next in line
  else running--;
};

/** "original" resolves to a concrete web format based on what came in. */
function resolveFormat(requested, inputFormat) {
  if (requested !== "original") return requested;
  if (inputFormat === "jpeg") return "jpeg";
  if (inputFormat === "png") return "png";
  if (inputFormat === "webp") return "webp";
  if (inputFormat === "heif") return "avif"; // AVIF + HEIC both report as "heif"
  return "webp"; // gif, tiff, svg, raw, …
}

function encode(pipeline, format, quality, hasAlpha) {
  switch (format) {
    case "avif":
      return pipeline.avif({ quality, effort: 4 });
    case "jpeg":
      return pipeline.flatten({ background: "#ffffff" }).jpeg({ quality, mozjpeg: true });
    case "png":
      return pipeline.png({ compressionLevel: 9, palette: true, quality });
    case "webp":
    default:
      return pipeline.webp({ quality, alphaQuality: hasAlpha ? Math.max(quality, 80) : 100 });
  }
}

/**
 * @param {Buffer} input
 * @param {import("@onetap/config-schema").ImageProcessing} opts
 * @returns {Promise<{ buffer: Buffer, contentType: string, ext: string, width: number, height: number, format: string, quality: number, originalBytes: number, bytes: number }>}
 */
export async function processImage(input, opts) {
  await takeSlot();
  try {
    return await processOne(input, opts);
  } finally {
    freeSlot();
  }
}

async function processOne(input, opts) {
  let meta;
  try {
    meta = await sharp(input, { failOn: "none" }).metadata();
  } catch (err) {
    // sharp refuses anything over its pixel ceiling (268 megapixels) before decoding it — a pixel bomb, or a stitched panorama
    if (/pixel limit/i.test(String(err?.message))) {
      throw new HttpError(413, "That picture has too many pixels (over 268 megapixels). Make it smaller and try again.");
    }
    logger.warn({ err }, "image decode failed");
    throw new HttpError(415, "That file isn't an image we can read. Try JPEG, PNG, WebP, AVIF or HEIC.");
  }
  if (!meta.width || !meta.height) {
    throw new HttpError(415, "That image has no readable dimensions.");
  }

  const format = resolveFormat(opts.format, meta.format);
  const longest = Math.max(meta.width, meta.height);
  const hasAlpha = Boolean(meta.hasAlpha);
  const targetBytes = (opts.targetMaxKB ?? 0) * 1024;
  const minEdge = Math.min(MIN_EDGE, opts.maxDimension);

  let quality = opts.quality;
  let edge = opts.maxDimension; // the longest side this pass may have
  let out;
  let info;
  // Re-decode each pass: sharp instances are single-use, and an admin upload
  // running the decoder a few extra times is cheap.
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let p = sharp(input, { failOn: "none", animated: false }).rotate();
    if (longest > edge) {
      p = p.resize(edge, edge, { fit: "inside", withoutEnlargement: true });
    }
    ({ data: out, info } = await encode(p, format, quality, hasAlpha).toBuffer({ resolveWithObject: true }));

    if (!targetBytes || out.length <= targetBytes) break;
    if (quality > QUALITY_FLOOR) {
      quality = Math.max(QUALITY_FLOOR, quality - QUALITY_STEP);
      continue;
    }
    // quality can't go lower: file size follows the pixel count, so scale the edge by the square root of the
    // missing ratio (a little extra, so the next pass lands under the target rather than just over it)
    const next = Math.max(minEdge, Math.round(Math.min(edge, longest) * Math.sqrt(targetBytes / out.length) * 0.95));
    if (next >= Math.min(edge, longest)) break; // already as small as we are willing to go
    edge = next;
  }

  return {
    buffer: out,
    contentType: MIME[format] ?? "image/webp",
    ext: EXT[format] ?? "webp",
    width: info.width,
    height: info.height,
    format,
    quality,
    originalBytes: input.length,
    bytes: out.length,
  };
}
