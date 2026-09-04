"use client";

import { useState } from "react";
                                           
import { Photo } from "../primitives";
                                             

const frame                = { position: "relative", borderRadius: "var(--radius-card)", overflow: "hidden", border: "1px solid var(--color-border)", transition: "transform var(--motion-base) var(--ease-out), opacity var(--motion-base) var(--ease-out)" };
const caption                = { fontWeight: 600, fontSize: "0.95rem", color: "var(--color-text)" };
const sub                = { fontSize: "0.8rem", color: "var(--color-text-muted)" };
const navBtn                = {
  position: "absolute",
  top: "50%",
  transform: "translateY(-50%)",
  width: 32,
  height: 32,
  borderRadius: "50%",
  border: "none",
  background: "var(--color-bg)",
  color: "var(--color-text)",
  cursor: "pointer",
  font: "inherit",
  boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
  zIndex: 2,
};

function useCarousel(n        ) {
  const [i, setI] = useState(0);
  return { i, next: () => setI((x) => (x + 1) % n), prev: () => setI((x) => (x - 1 + n) % n), go: setI };
}

/** 01 single slide with arrows and dots */
export function CarouselSlider({ items }               ) {
  const { i, next, prev, go } = useCarousel(items.length);
  const item = items[i] ;
  return (
    <div>
      <div style={{ ...frame, height: 190 }}>
        {/* Both remount on slide change so the fade replays — but sibling keys
            must be unique, so they are namespaced rather than both being `i`. */}
        <Photo key={`photo-${i}`} name={item.title} style={{ position: "absolute", inset: 0 }} radius={0} />
        <button type="button" className="ot-nav" style={{ ...navBtn, left: 10 }} onClick={prev} aria-label="Previous">‹</button>
        <button type="button" className="ot-nav" style={{ ...navBtn, right: 10 }} onClick={next} aria-label="Next">›</button>
        <div key={`caption-${i}`} className="ot-swap" style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 14, background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)", color: "#fff" }}>
          <div style={{ ...caption, color: "#fff" }}>{item.title}</div>
          {item.subtitle ? <div style={{ ...sub, color: "rgba(255,255,255,0.85)" }}>{item.subtitle}</div> : null}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 10 }}>
        {items.map((_, k) => (
          <button key={k} type="button" aria-label={`Slide ${k + 1}`} onClick={() => go(k)}
                  style={{ width: k === i ? 20 : 7, height: 7, borderRadius: 999, border: "none", cursor: "pointer", background: k === i ? "var(--color-primary)" : "var(--color-border)" }} />
        ))}
      </div>
    </div>
  );
}

/** 02 horizontal scroll strip */
export function CarouselStrip({ items }               ) {
  return (
    <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
      {items.map((it) => (
        <div key={it.title} style={{ ...frame, minWidth: 190, flexShrink: 0 }}>
          <Photo name={it.title} style={{ height: 110, width: "100%" }} radius={0} />
          <div style={{ padding: 11 }}>
            <div style={caption}>{it.title}</div>
            {it.subtitle ? <div style={sub}>{it.subtitle}</div> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

/** 03 peek — the next slide is partly visible */
export function CarouselPeek({ items }               ) {
  const { i, next, prev } = useCarousel(items.length);
  const order = [...items.slice(i), ...items.slice(0, i)];
  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: 12, overflow: "hidden" }}>
        {order.slice(0, 3).map((it, k) => (
          <div key={it.title} style={{ ...frame, flex: k === 0 ? "0 0 62%" : "0 0 32%", opacity: k === 0 ? 1 : 0.6 }}>
            <Photo name={it.title} style={{ height: 130, width: "100%" }} radius={0} />
            <div style={{ padding: 10 }}>
              <div style={caption}>{it.title}</div>
            </div>
          </div>
        ))}
      </div>
      <button type="button" className="ot-nav" style={{ ...navBtn, left: 8 }} onClick={prev} aria-label="Previous">‹</button>
      <button type="button" className="ot-nav" style={{ ...navBtn, right: 8 }} onClick={next} aria-label="Next">›</button>
    </div>
  );
}

/** 04 thumbnails under the main image */
export function CarouselThumbs({ items }               ) {
  const { i, go } = useCarousel(items.length);
  const item = items[i] ;
  return (
    <div>
      <div style={{ ...frame, height: 170 }}>
        <Photo key={i} name={item.title} style={{ position: "absolute", inset: 0 }} radius={0} />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        {items.map((it, k) => (
          <button key={it.title} type="button" onClick={() => go(k)} aria-label={it.title}
                  style={{ border: k === i ? "2px solid var(--color-primary)" : "2px solid transparent", borderRadius: 8, padding: 0, cursor: "pointer", background: "none", lineHeight: 0 }}>
            <Photo name={it.title} style={{ width: 54, height: 40 }} radius={6} />
          </button>
        ))}
      </div>
      <div style={{ ...caption, marginTop: 8 }}>{item.title}</div>
    </div>
  );
}

/** 05 text-only quote rotator */
export function CarouselQuotes({ items }               ) {
  const { i, next, go } = useCarousel(items.length);
  const item = items[i] ;
  return (
    <div style={{ textAlign: "center", padding: "22px 16px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-card)", background: "var(--color-surface)" }}>
      <p key={i} className="ot-swap" style={{ fontFamily: "var(--font-heading)", fontSize: "1.1rem", margin: "0 0 10px", color: "var(--color-text)" }}>“{item.title}”</p>
      {item.subtitle ? <div style={sub}>— {item.subtitle}</div> : null}
      <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 14 }}>
        {items.map((_, k) => (
          <button key={k} type="button" aria-label={`Quote ${k + 1}`} onClick={() => go(k)}
                  style={{ width: 7, height: 7, borderRadius: 999, border: "none", cursor: "pointer", background: k === i ? "var(--color-primary)" : "var(--color-border)" }} />
        ))}
      </div>
      <button type="button" onClick={next} style={{ display: "none" }} aria-hidden />
    </div>
  );
}

/** 06 full-bleed hero with a counter */
export function CarouselHero({ items }               ) {
  const { i, next, prev } = useCarousel(items.length);
  const item = items[i] ;
  return (
    <div style={{ ...frame, height: 220 }}>
      <Photo name={item.title} style={{ position: "absolute", inset: 0 }} radius={0} />
      <div key={i} className="ot-swap" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "rgba(0,0,0,0.35)", color: "#fff", textAlign: "center", padding: 20 }}>
        <div>
          <div style={{ fontFamily: "var(--font-heading)", fontSize: "1.5rem", fontWeight: 700 }}>{item.title}</div>
          {item.subtitle ? <div style={{ opacity: 0.85, marginTop: 4 }}>{item.subtitle}</div> : null}
        </div>
      </div>
      <button type="button" className="ot-nav" style={{ ...navBtn, left: 10 }} onClick={prev} aria-label="Previous">‹</button>
      <button type="button" className="ot-nav" style={{ ...navBtn, right: 10 }} onClick={next} aria-label="Next">›</button>
      <span style={{ position: "absolute", right: 12, bottom: 10, background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: "0.72rem", padding: "3px 8px", borderRadius: 999 }}>
        {i + 1} / {items.length}
      </span>
    </div>
  );
}

/** 07 stacked cards, newest on top */
export function CarouselStack({ items }               ) {
  const { i, next } = useCarousel(items.length);
  const order = [...items.slice(i), ...items.slice(0, i)].slice(0, 3);
  return (
    <div style={{ position: "relative", height: 180, cursor: "pointer" }} onClick={next} role="button" tabIndex={0}
         onKeyDown={(e) => e.key === "Enter" && next()} aria-label="Next slide">
      {order.map((it, k) => (
        <div key={it.title} style={{ ...frame, position: "absolute", inset: 0, transform: `translate(${k * 10}px, ${k * 10}px) scale(${1 - k * 0.04})`, zIndex: 3 - k, opacity: 1 - k * 0.25 }}>
          <Photo name={it.title} style={{ position: "absolute", inset: 0 }} radius={0} />
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 12, background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)", color: "#fff", fontWeight: 600 }}>
            {it.title}
          </div>
        </div>
      ))}
    </div>
  );
}
