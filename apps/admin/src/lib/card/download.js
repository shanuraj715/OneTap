/**
 * Saving a generated file, with the three browser quirks that break it.
 */

/**
 * Firefox ignores a click on an anchor that is not in the document, and Safari
 * cancels an in-flight download the moment its object URL is revoked — so the
 * anchor is attached before clicking and the URL is released on a timer rather
 * than on the next line.
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/**
 * Table numbers are free text — "A3", "Rooftop 2", "Table #7/B" are all
 * legitimate — and a slash in a filename silently truncates the download on
 * some platforms and fails outright on others.
 */
export function safeFilename(part, fallback = "card") {
  const cleaned = String(part ?? "")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-{2,}/g, "-")
    .slice(0, 60);
  return cleaned || fallback;
}

/** `canvas.toBlob` is callback-based and hands back null when it fails. */
export function canvasToBlob(canvas, type = "image/png", quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        // The usual cause is a tainted canvas — which is exactly why only
        // `data:` image sources are accepted anywhere in the renderer.
        else reject(new Error("This browser could not produce the image file."));
      },
      type,
      quality,
    );
  });
}
