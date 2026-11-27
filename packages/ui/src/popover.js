"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Open / close and placement for a panel that pops out of a trigger (the time picker, the searchable dropdown).
 *
 * The panel is drawn on top of the page (the caller puts it in a portal in <body> and gives it `panelStyle`), positioned on the
 * screen, so opening it never makes the page taller or scrolls. It goes below the trigger when there is room, otherwise above it;
 * flush with the trigger's left edge, or its right edge when the left would run off the screen. It follows the trigger while the
 * page scrolls or resizes, closes on a press outside it and on Escape (and gives focus back to the trigger).
 */
export function useAnchoredPopover({ minWidth = 0, matchWidth = true } = {}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const anchorRef = useRef(null); // the trigger's box
  const popRef = useRef(null); // the panel

  const place = useCallback(() => {
    const pop = popRef.current;
    const anchor = anchorRef.current;
    if (!pop || !anchor) return;
    const gap = 6;
    const edge = 8;
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const b = anchor.getBoundingClientRect();
    const w = pop.offsetWidth;
    const h = pop.offsetHeight;
    let left = b.left;
    if (left + w > vw - edge) left = b.right - w;
    left = Math.max(edge, Math.min(left, vw - w - edge));
    const below = vh - b.bottom - gap - edge;
    const above = b.top - gap - edge;
    let top;
    if (h <= below) top = b.bottom + gap;
    else if (h <= above) top = b.top - gap - h;
    else top = below >= above ? Math.max(edge, Math.min(b.bottom + gap, vh - h - edge)) : Math.max(edge, b.top - gap - h);
    setPos((old) => (old && old.top === top && old.left === left && old.width === b.width ? old : { top, left, width: b.width }));
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return undefined;
    }
    place();
    const again = () => place();
    window.addEventListener("resize", again);
    window.addEventListener("scroll", again, true);
    const watch = typeof ResizeObserver !== "undefined" && popRef.current ? new ResizeObserver(again) : null;
    if (watch) watch.observe(popRef.current);
    return () => {
      window.removeEventListener("resize", again);
      window.removeEventListener("scroll", again, true);
      if (watch) watch.disconnect();
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return undefined;
    const outside = (e) => {
      if (anchorRef.current?.contains(e.target) || popRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const key = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        anchorRef.current?.querySelector("button, [tabindex]")?.focus?.();
      }
    };
    document.addEventListener("mousedown", outside);
    document.addEventListener("touchstart", outside, { passive: true });
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("touchstart", outside);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  const panelStyle = {
    position: "fixed",
    top: pos ? pos.top : 0,
    left: pos ? pos.left : 0,
    visibility: pos ? "visible" : "hidden",
    zIndex: 1000,
    minWidth: Math.max(minWidth, matchWidth && pos ? pos.width : 0),
    maxWidth: "calc(100vw - 16px)",
    boxSizing: "border-box",
  };

  /** the panel has been measured and put in place (until then it is invisible, and an invisible field can't take focus) */
  const placed = Boolean(pos);

  return { open, setOpen, anchorRef, popRef, panelStyle, placed };
}

/** The trigger look shared by the pickers: the same box as a text field, with a leading icon. Callers add `triggerStyle` / a class for the store's style effects. */
export const triggerBase = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: "100%",
  padding: "10px 12px",
  minHeight: 44,
  borderRadius: 10,
  border: "1px solid var(--color-border, #cbd5e1)",
  background: "var(--color-bg, #ffffff)",
  color: "var(--color-text, #0f172a)",
  fontFamily: "inherit",
  fontSize: 14.5,
  textAlign: "left",
  cursor: "pointer",
  boxSizing: "border-box",
};
