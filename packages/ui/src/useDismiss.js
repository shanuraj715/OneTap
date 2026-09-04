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
export function useDismiss                                        (
  open         ,
  onClose            ,
) {
  const ref = useRef   (null);
  // Kept in a ref so re-renders don't detach and reattach the listeners.
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e                           ) => {
      const el = ref.current;
      if (el && !el.contains(e.target        )) close.current();
    };
    const onKeyDown = (e               ) => {
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
