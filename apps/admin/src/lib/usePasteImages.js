import { useEffect, useRef } from "react";

/**
 * Pasting pictures: a screenshot, "Copy image" in a browser, an image copied from another app, or a picture file
 * copied in Finder / Explorer. One place for the rules so every picture box in the dashboard behaves the same.
 */

/** The image files on a paste event's clipboard (empty when there are none). */
export function imagesFromClipboardData(data) {
  const files = [];
  for (const item of Array.from(data?.items ?? [])) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }
  if (!files.length) for (const file of Array.from(data?.files ?? [])) if (file.type.startsWith("image/")) files.push(file);
  return files;
}

const NOT_TEXT_INPUTS = new Set(["checkbox", "radio", "button", "submit", "reset", "file", "range", "color", "image"]);

/** A box where someone types words — a paste there means text, not a picture. */
function isTypingBox(el) {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable || el.tagName === "TEXTAREA") return true;
  return el.tagName === "INPUT" && !NOT_TEXT_INPUTS.has(el.type);
}

/**
 * While the calling component is on screen (and `enabled`), pressing Ctrl/⌘+V with a picture on the clipboard hands
 * the picture file(s) to `onImages`. Text pasted into a text box is left alone (a picture copied together with text,
 * e.g. from a spreadsheet, only counts when the cursor isn't in a text box).
 */
export function usePasteImages(onImages, { enabled = true } = {}) {
  const latest = useRef(onImages);
  latest.current = onImages;
  useEffect(() => {
    if (!enabled) return undefined;
    const onPaste = (event) => {
      const files = imagesFromClipboardData(event.clipboardData);
      if (!files.length) return;
      const hasText = (event.clipboardData?.getData("text/plain") ?? "").trim().length > 0;
      if (hasText && isTypingBox(event.target)) return;
      event.preventDefault();
      latest.current(files);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [enabled]);
}

/**
 * The "Paste" button: read the clipboard on demand (the browser may ask permission).
 * Resolves `{ files }`, or `{ reason }` — "empty" (no picture copied), "denied" (permission refused) or
 * "unsupported" (this browser can't read the clipboard from a button — use Ctrl/⌘+V instead).
 */
export async function readClipboardImages() {
  if (!navigator.clipboard?.read) return { reason: "unsupported" };
  try {
    const items = await navigator.clipboard.read();
    const files = [];
    for (const item of items) {
      const type = item.types.find((t) => t.startsWith("image/"));
      if (!type) continue;
      const blob = await item.getType(type);
      const ext = type.split("/")[1].replace("+xml", "") || "png";
      files.push(new File([blob], `pasted-${Date.now()}-${files.length + 1}.${ext}`, { type }));
    }
    return files.length ? { files } : { reason: "empty" };
  } catch (e) {
    return { reason: e?.name === "NotAllowedError" || e?.name === "SecurityError" ? "denied" : "unsupported" };
  }
}
