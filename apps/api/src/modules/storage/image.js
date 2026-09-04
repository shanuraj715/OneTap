import sharp from "sharp";
import { HttpError } from "../../middleware/error.js";
import { logger } from "../../logger.js";

/**
 * The upload image pipeline.
 *
 * Accepts anything libvips can decode — JPEG, PNG, WebP, AVIF, HEIC/HEIF, GIF,
 * TIFF, SVG — auto-rotates from EXIF, scales down to the configured longest
 * edge, and re-encodes to one web format. If the result is still over the
 * outlet's size target, quality is stepped down until it fits (or hits a
 * floor). The final pixel dimensions come straight from the encoder, so the
 * rest of the app never has to decode an image.
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
  let meta;
  try {
    meta = await sharp(input, { failOn: "none" }).metadata();
  } catch (err) {
    logger.warn({ err }, "image decode failed");
    throw new HttpError(415, "That file isn't an image we can read. Try JPEG, PNG, WebP, AVIF or HEIC.");
  }
  if (!meta.width || !meta.height) {
    throw new HttpError(415, "That image has no readable dimensions.");
  }

  const format = resolveFormat(opts.format, meta.format);
  const needsResize = meta.width > opts.maxDimension || meta.height > opts.maxDimension;
  const hasAlpha = Boolean(meta.hasAlpha);

  let quality = opts.quality;
  let out;
  let info;
  // Re-decode each pass: sharp instances are single-use, and an admin upload
  // running the decoder a few extra times is cheap.
  for (let pass = 0; pass < 6; pass++) {
    let p = sharp(input, { failOn: "none", animated: false }).rotate();
    if (needsResize) {
      p = p.resize(opts.maxDimension, opts.maxDimension, { fit: "inside", withoutEnlargement: true });
    }
    ({ data: out, info } = await encode(p, format, quality, hasAlpha).toBuffer({ resolveWithObject: true }));

    const targetBytes = (opts.targetMaxKB ?? 0) * 1024;
    if (!targetBytes || out.length <= targetBytes || quality <= QUALITY_FLOOR) break;
    quality = Math.max(QUALITY_FLOOR, quality - QUALITY_STEP);
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
