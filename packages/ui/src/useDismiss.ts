"use client";

import { useEffect, useRef } from "react";

/**
 * Close an open overlay the way people expect: click anywhere outside it, or
 * press Escape.
 *
 * Attach the returned ref to the element that wraps *both* the trigger and the
 * panel — a click on the trigger must not count as "outside", or the button
 * would close and immediately reopen.
 *
 * Listens on `pointerdown` rather than `click` so the overlay is gone before a
 * control underneath it receives the press, and captures on the document so a
 * child that stops propagation can't trap the dismissal.
 */
export function useDismiss<T extends HTMLElement = HTMLDivElement>(
  open: boolean,
  onClose: () => void,
) {
  const ref = useRef<T>(null);
  // Kept in a ref so re-renders don't detach and reattach the listeners.
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent | MouseEvent) => {
      const el = ref.current;
      if (el && !el.contains(e.target as Node)) close.current();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close.current();
      }
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return ref;
}
