/**
 * Turning a chosen file into something a card can carry.
 *
 * Card images are embedded as data URLs rather than uploaded: a canvas that has
 * drawn a remotely-hosted image is tainted and cannot be exported at all, and
 * the S3/R2 provider has no read path to proxy one back through. That makes
 * size the whole problem — so every image is resized and re-encoded here, hard,
 * before it ever reaches the design.
 */

/** Per-role caps. Print needs more pixels than a screen, but not a phone's 40MP. */
export const IMAGE_ROLES = {
  background: { maxPx: 2000, maxBytes: 700_000, label: "background" },
  logo: { maxPx: 512, maxBytes: 200_000, label: "logo" },
  block: { maxPx: 1200, maxBytes: 350_000, label: "image" },
};

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/bmp,image/avif,image/svg+xml,.png,.jpg,.jpeg,.webp,.gif,.bmp,.avif,.svg";
export const IMAGE_ACCEPT = ACCEPT;

const dataUrlBytes = (url) => Math.ceil(((url.length - (url.indexOf(",") + 1)) * 3) / 4);

/**
 * Decode, scale to fit the role's pixel cap, then step the WebP quality down
 * until it fits the byte cap. Quality is what gives first, not dimensions: a
 * print at 300dpi wants the pixels, and WebP at 0.6 still looks fine behind
 * text at that size.
 */
export async function fileToCardImage(file, role = "block") {
  const { maxPx, maxBytes, label } = IMAGE_ROLES[role] ?? IMAGE_ROLES.block;

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(`That file couldn't be read as an image. Try a PNG or JPEG.`);
  }

  const scale = Math.min(1, maxPx / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser could not prepare the image.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  for (const quality of [0.9, 0.8, 0.7, 0.6, 0.5, 0.4]) {
    const url = canvas.toDataURL("image/webp", quality);
    if (dataUrlBytes(url) <= maxBytes) return { dataUrl: url, width: w, height: h };
  }

  // Still too big at the lowest quality — halve the dimensions and say so, in
  // preference to silently rejecting a photo the owner has already chosen.
  const half = document.createElement("canvas");
  half.width = Math.max(1, Math.round(w / 2));
  half.height = Math.max(1, Math.round(h / 2));
  half.getContext("2d")?.drawImage(canvas, 0, 0, half.width, half.height);
  const url = half.toDataURL("image/webp", 0.6);
  if (dataUrlBytes(url) <= maxBytes) return { dataUrl: url, width: half.width, height: half.height, reduced: true };

  throw new Error(`That ${label} is too detailed to fit on a card. Try a simpler or smaller image.`);
}
