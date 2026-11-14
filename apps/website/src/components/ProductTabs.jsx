"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The product switcher. Every panel is rendered on the server and stays in
 * the page's HTML (Google reads all of them); this only decides which one is
 * showing. A link to "/#qr-ordering" opens on that tab. Arrow keys move
 * between tabs, as a tab list should.
 */
export function ProductTabs({ tabs, children }) {
  const panels = Array.isArray(children) ? children : [children];
  const [active, setActive] = useState(0);
  const btns = useRef([]);

  useEffect(() => {
    const fromHash = () => {
      const i = tabs.findIndex((t) => `#${t.anchor}` === window.location.hash);
      if (i >= 0) setActive(i);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [tabs]);

  const onKey = (e) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = (active + d + tabs.length) % tabs.length;
    setActive(next);
    btns.current[next]?.focus();
  };

  return (
    <div className="ptabs">
      <div className="ptabs-list" role="tablist" aria-label="Product" onKeyDown={onKey}>
        {tabs.map((t, i) => (
          <button
            key={t.anchor}
            ref={(el) => (btns.current[i] = el)}
            // the tab itself carries the anchor, so a link to /#qr-ordering scrolls here
            id={t.anchor}
            type="button"
            role="tab"
            aria-selected={i === active}
            aria-controls={`panel-${t.anchor}`}
            tabIndex={i === active ? 0 : -1}
            className="ptab"
            onClick={() => setActive(i)}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>
      {panels.map((panel, i) => (
        <div
          key={tabs[i]?.anchor ?? i}
          id={`panel-${tabs[i]?.anchor}`}
          role="tabpanel"
          aria-labelledby={tabs[i]?.anchor}
          hidden={i !== active}
          className="ptab-panel"
        >
          {panel}
        </div>
      ))}
    </div>
  );
}
