"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * A thin brand-coloured bar across the top while the next page loads. It
 * starts the moment a link to another page of this site is clicked (or
 * back/forward is pressed) and finishes when the new page is on screen.
 * Pages here are pre-built, so usually it's a quick flash; on a slow
 * connection it's the reassurance that something is happening.
 */
export function NavProgress() {
  const pathname = usePathname();
  const [state, setState] = useState("idle"); // idle | loading | done
  const timer = useRef(null);
  const first = useRef(true);

  useEffect(() => {
    const start = () => {
      clearTimeout(timer.current);
      setState("loading");
    };
    const onClick = (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest?.("a[href]");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // same page (maybe a #section) — nothing to load
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      start();
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", start);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", start);
    };
  }, []);

  // the new page is showing — finish the bar, then hide it
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setState("done");
    timer.current = setTimeout(() => setState("idle"), 350);
    return () => clearTimeout(timer.current);
  }, [pathname]);

  return <div className={`navbar-progress ${state}`} role="progressbar" aria-hidden={state === "idle"} aria-label="Loading page" />;
}
