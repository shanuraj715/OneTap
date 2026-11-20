"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Pins what is inside to the top of the screen while the page scrolls — the header, and the order bar under it.
 *
 * Its height is published as `--ot-<name>-h` on <html>, so whatever is pinned further down (the category bar sits under
 * both) can start exactly where this one ends, and scroll targets can stop below it. `below` names the bar this one sits
 * under (its own height is that bar's variable). Before the page has loaded the variables are simply missing and every
 * `var(--ot-…-h, 0px)` falls back to 0, which is the old, unpinned layout.
 *
 * A bar that is too TALL for the screen is not pinned — a header style with a big banner, or any header on a phone held
 * sideways, would otherwise cover half of what the visitor came to read. It scrolls away like any other block (its
 * published height is then 0, so the bars under it still pin to the very top). "Too tall" is more than `maxShare` of
 * the window's height or more than `maxPx`, whichever is smaller.
 *
 * Several of these are siblings in the page's own column (not nested), because a pinned box only stays pinned while the
 * box that holds it is still on screen.
 */
export function StickyBar({ name, below, z = 30, maxShare = 0.2, maxPx = 150, children }) {
  const ref = useRef(null);
  const [pinned, setPinned] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const root = document.documentElement;
    const measure = () => {
      const h = el.getBoundingClientRect().height;
      const fits = h <= Math.min(maxPx, window.innerHeight * maxShare);
      setPinned(fits);
      root.style.setProperty(`--ot-${name}-h`, fits ? `${h}px` : "0px");
    };
    measure();
    const watcher = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    watcher?.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      watcher?.disconnect();
      window.removeEventListener("resize", measure);
      root.style.removeProperty(`--ot-${name}-h`);
    };
  }, [name, maxShare, maxPx]);

  return (
    <div
      ref={ref}
      data-sticky={name}
      data-pinned={pinned ? "true" : "false"}
      style={pinned ? { position: "sticky", top: below ? `var(--ot-${below}-h, 0px)` : 0, zIndex: z } : { position: "relative", zIndex: z }}
    >
      {children}
    </div>
  );
}
