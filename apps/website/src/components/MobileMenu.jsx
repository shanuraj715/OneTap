"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

/**
 * The phone menu: a native <details>, so it opens and works with no JavaScript. This small wrapper adds what a native one doesn't do by itself:
 * it closes when a link inside it is pressed (the page changes underneath it — the header stays — so left alone it would stay open on top of the
 * new page), when the page changes by any other way, when something outside it is pressed and on Escape.
 */
export function MobileMenu({ children }) {
  const ref = useRef(null);
  const path = usePathname();

  const close = () => {
    if (ref.current?.open) ref.current.open = false;
  };

  // the page changed (a link, the back button): the menu goes
  useEffect(() => {
    close();
  }, [path]);

  useEffect(() => {
    const outside = (e) => {
      if (ref.current?.open && !ref.current.contains(e.target)) close();
    };
    const key = (e) => {
      if (e.key === "Escape" && ref.current?.open) {
        close();
        ref.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", key);
    };
  }, []);

  return (
    <details className="menu" ref={ref}>
      <summary aria-label="Menu">
        <Menu size={18} aria-hidden="true" /> Menu
      </summary>
      {/* pressing any link (or the button that looks like one) closes the menu at once, even when it points at the page already open */}
      <div className="menu-panel" onClick={(e) => (e.target instanceof Element && e.target.closest("a") ? close() : undefined)}>
        {children}
      </div>
    </details>
  );
}
