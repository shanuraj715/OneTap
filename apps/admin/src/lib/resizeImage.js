/**
 * Downscale + re-encode an image in the browser before upload.
 *
 * A photo straight off a phone is 3–6 MB and 4000 px wide; a menu card never
 * needs more than ~1600 px. Resizing here keeps the upload small, means the API
 * needs no image library, and lets us hand the final pixel dimensions to the
 * server so it can store them without decoding anything.
 *
 * @param {File | Blob} file
 * @param {{ maxDimension?: number, quality?: number }} [opts]
 * @returns {Promise<{ blob: Blob, width: number, height: number }>}
 */
export async function resizeImage(file, opts = {}) {
  const maxDimension = opts.maxDimension ?? 1600;
  const quality = opts.quality ?? 0.82;

  const bitmap = await loadBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser blocked image processing.");
  // White under the image so a transparent PNG doesn't turn black as a JPEG/WebP.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  // WebP is ~30% smaller than JPEG at the same quality and is supported
  // everywhere this admin runs; fall back to JPEG if the canvas won't encode it.
  let blob = await toBlob(canvas, "image/webp", quality);
  if (!blob || blob.type !== "image/webp") {
    blob = await toBlob(canvas, "image/jpeg", quality);
  }
  if (!blob) throw new Error("Could not process that image.");

  return { blob, width, height };
}

function toBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));
}

async function loadBitmap(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fall through to the <img> path (e.g. Safari + some formats) */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("That file isn't a readable image."));
      el.src = url;
    });
    return Object.assign(img, { width: img.naturalWidth, height: img.naturalHeight, close: () => {} });
  } finally {
    URL.revokeObjectURL(url);
  }
}
