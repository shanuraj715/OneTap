const IMAGE_EXT = /\.(jpe?g|png|webp|avif|gif|heic|heif|tiff?|bmp|svg)$/i;

/**
 * Get a file ready to upload. The API does the real compression (any format,
 * server-side), so this only:
 *   - rejects things that clearly aren't images
 *   - trims a genuinely huge photo (40 MP phone shots) so the upload isn't
 *     tens of MB — but keeps quality near-lossless so the server's single
 *     compression pass is the only lossy step
 *   - leaves anything the browser can't decode (HEIC on Chrome, exotic TIFFs)
 *     completely untouched for the server to handle
 *
 * @param {File} file
 * @param {{ softCapPx?: number, softCapBytes?: number }} [opts]
 * @returns {Promise<{ blob: Blob, name: string, trimmed: boolean }>}
 */
export async function prepareImage(file, opts = {}) {
  const softCapPx = opts.softCapPx ?? 3200;
  const softCapBytes = opts.softCapBytes ?? 6 * 1024 * 1024;

  const looksLikeImage = file.type.startsWith("image/") || IMAGE_EXT.test(file.name);
  if (!looksLikeImage) {
    throw new Error(`${file.name || "That file"} doesn't look like an image.`);
  }

  if (file.size <= softCapBytes) {
    return { blob: file, name: file.name, trimmed: false };
  }

  // Big file — try to shrink it in the browser. If we can't decode it, send as-is.
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { blob: file, name: file.name, trimmed: false };
  }

  const scale = Math.min(1, softCapPx / Math.max(bitmap.width, bitmap.height));
  if (scale === 1) {
    bitmap.close?.();
    return { blob: file, name: file.name, trimmed: false };
  }

  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close?.();
    return { blob: file, name: file.name, trimmed: false };
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.95));
  if (!blob) return { blob: file, name: file.name, trimmed: false };
  return { blob, name: `${file.name.replace(/\.[^.]+$/, "")}.webp`, trimmed: true };
}
