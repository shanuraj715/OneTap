"use client";

import { useEffect, useRef } from "react";
import { safeHref } from "@rasoipulse/config-schema";
import { AppLink } from "../link";
import { useReducedMotion, useSlides } from "../hooks";
import { Photo } from "../primitives";

/**
 * Carousels — thirteen ways to show a handful of pictures. They serve two jobs: the item photos in the "customise"
 * popup, and the promo carousel a store puts under its header (configured in the dashboard).
 *
 * Every style takes `items` — `[{ id?, title, subtitle?, imageUrl?, href?, ctaLabel? }]` — plus optional
 * behaviour that the plain popup simply doesn't pass:
 *
 *   autoplay, interval (ms)   advance by themselves; stops on hover, focus, a background tab, reduced motion
 *   showArrows, showDots      the controls (on by default)
 *   height                    "compact" | "regular" | "tall" — scales the picture area
 *
 * Swiping works on touch screens in every style that shows one slide at a time.
 */

const frame = {
  position: "relative",
  borderRadius: "var(--radius-card)",
  overflow: "hidden",
  border: "1px solid var(--color-border)",
};
const caption = { fontWeight: 600, fontSize: "0.95rem", color: "var(--color-text)" };
const sub = { fontSize: "0.8rem", color: "var(--color-text-muted)" };
const navBtn = {
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
  zIndex: 3,
  display: "grid",
  placeItems: "center",
  padding: 0,
  lineHeight: 1,
};
const ctaStyle = {
  display: "inline-block",
  marginTop: 10,
  padding: "8px 16px",
  borderRadius: "var(--radius-card)",
  background: "var(--color-primary)",
  color: "var(--color-on-primary)",
  fontWeight: 700,
  fontSize: 13,
  textDecoration: "none",
  whiteSpace: "nowrap",
};

const HEIGHT_FACTOR = { compact: 0.72, regular: 1, tall: 1.5 };
/** A variant's natural height, scaled by the store's "height" choice. */
const px = (base, height) => Math.round(base * (HEIGHT_FACTOR[height] ?? 1));
const keyOf = (item, k) => item.id ?? `${item.title}-${k}`;
const nameOf = (item) => item.title || "Slide";

/** The slide's button — only when it has both a label and a safe address. */
function Cta({ item, style }) {
  const href = safeHref(item.href);
  if (!href || !item.ctaLabel) return null;
  return (
    <AppLink href={href} style={{ ...ctaStyle, ...style }}>
      {item.ctaLabel}
    </AppLink>
  );
}

/** A box that is a link when the slide has an address, and a plain box when it doesn't. */
function Linked({ item, style, className, children, label }) {
  const href = safeHref(item.href);
  if (!href) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }
  return (
    <AppLink href={href} className={className} style={{ color: "inherit", textDecoration: "none", display: "block", ...style }} aria-label={label}>
      {children}
    </AppLink>
  );
}

function Arrows({ show, prev, next }) {
  if (!show) return null;
  return (
    <>
      <button type="button" className="ot-nav" style={{ ...navBtn, left: 10 }} onClick={prev} aria-label="Previous">
        ‹
      </button>
      <button type="button" className="ot-nav" style={{ ...navBtn, right: 10 }} onClick={next} aria-label="Next">
        ›
      </button>
    </>
  );
}

/** Dots under (or, `inside`, over) the picture. The current one is a longer bar. */
function Dots({ show, count, index, go, inside }) {
  if (!show || count < 2) return null;
  const wrap = inside
    ? { position: "absolute", left: 0, right: 0, bottom: 10, zIndex: 3, display: "flex", gap: 6, justifyContent: "center" }
    : { display: "flex", gap: 6, justifyContent: "center", marginTop: 10 };
  return (
    <div style={wrap}>
      {Array.from({ length: count }, (_, k) => (
        <button
          key={k}
          type="button"
          aria-label={`Slide ${k + 1} of ${count}`}
          aria-current={k === index}
          onClick={() => go(k)}
          style={{
            width: k === index ? 20 : 7,
            height: 7,
            padding: 0,
            borderRadius: 999,
            border: "none",
            cursor: "pointer",
            transition: "width 200ms",
            background: inside ? (k === index ? "#fff" : "rgba(255,255,255,0.55)") : k === index ? "var(--color-primary)" : "var(--color-border)",
          }}
        />
      ))}
    </div>
  );
}

/** Dark gradient behind overlaid text, so it reads on any photo. */
const scrim = (direction = "to top") => `linear-gradient(${direction}, rgba(0,0,0,0.78), rgba(0,0,0,0.05))`;

/* ----------------------------------------------------------------- 01–07 */

/** 01 single slide with arrows and dots */
export function CarouselSlider({ items, autoplay, interval, showArrows = true, showDots = true, height }) {
  const s = useSlides(items.length, { autoplay, intervalMs: interval });
  const item = items[s.index];
  if (!item) return null;
  return (
    <div {...s.bind}>
      <div style={{ ...frame, height: px(190, height) }}>
        {/* Both remount on slide change so the fade replays — but sibling keys must be unique, so they are namespaced. */}
        <Photo key={`photo-${s.index}`} name={nameOf(item)} src={item.imageUrl} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} radius={0} />
        <Arrows show={showArrows} prev={s.prev} next={s.next} />
        <div key={`caption-${s.index}`} className="ot-swap" style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: showArrows ? "14px 54px 16px" : "14px 14px 16px", background: scrim(), color: "#fff" }}>
          <div style={{ ...caption, color: "#fff" }}>{item.title}</div>
          {item.subtitle ? <div style={{ ...sub, color: "rgba(255,255,255,0.85)" }}>{item.subtitle}</div> : null}
          <Cta item={item} />
        </div>
      </div>
      <Dots show={showDots} count={items.length} index={s.index} go={s.setIndex} />
    </div>
  );
}

/** 02 horizontal scroll strip */
export function CarouselStrip({ items, height }) {
  return (
    <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
      {items.map((it, k) => (
        <Linked key={keyOf(it, k)} item={it} label={nameOf(it)} style={{ ...frame, minWidth: 190, flexShrink: 0 }}>
          <Photo name={nameOf(it)} src={it.imageUrl} style={{ height: px(110, height), width: "100%" }} radius={0} />
          <div style={{ padding: 11 }}>
            <div style={caption}>{it.title}</div>
            {it.subtitle ? <div style={sub}>{it.subtitle}</div> : null}
          </div>
        </Linked>
      ))}
    </div>
  );
}

/** 03 peek — the next slide is partly visible */
export function CarouselPeek({ items, autoplay, interval, showArrows = true, height }) {
  const s = useSlides(items.length, { autoplay, intervalMs: interval });
  const order = [...items.slice(s.index), ...items.slice(0, s.index)];
  return (
    <div style={{ position: "relative" }} {...s.bind}>
      <div style={{ display: "flex", gap: 12, overflow: "hidden" }}>
        {order.slice(0, 3).map((it, k) => (
          <Linked key={keyOf(it, k)} item={it} label={nameOf(it)} style={{ ...frame, flex: k === 0 ? "0 0 62%" : "0 0 32%", opacity: k === 0 ? 1 : 0.6 }}>
            <Photo name={nameOf(it)} src={it.imageUrl} style={{ height: px(130, height), width: "100%" }} radius={0} />
            <div style={{ padding: 10 }}>
              <div style={caption}>{it.title}</div>
            </div>
          </Linked>
        ))}
      </div>
      <Arrows show={showArrows} prev={s.prev} next={s.next} />
    </div>
  );
}

/** 04 thumbnails under the main image */
export function CarouselThumbs({ items, autoplay, interval, height }) {
  const s = useSlides(items.length, { autoplay, intervalMs: interval });
  const item = items[s.index];
  if (!item) return null;
  return (
    <div {...s.bind}>
      <div style={{ ...frame, height: px(170, height) }}>
        <Photo key={s.index} name={nameOf(item)} src={item.imageUrl} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} radius={0} />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8, overflowX: "auto" }}>
        {items.map((it, k) => (
          <button
            key={keyOf(it, k)}
            type="button"
            onClick={() => s.setIndex(k)}
            aria-label={nameOf(it)}
            style={{ border: k === s.index ? "2px solid var(--color-primary)" : "2px solid transparent", borderRadius: 8, padding: 0, cursor: "pointer", background: "none", lineHeight: 0, flexShrink: 0 }}
          >
            <Photo name={nameOf(it)} src={it.imageUrl} style={{ width: 54, height: 40 }} radius={6} />
          </button>
        ))}
      </div>
      <div style={{ ...caption, marginTop: 8 }}>{item.title}</div>
      <Cta item={item} style={{ marginTop: 6 }} />
    </div>
  );
}

/** 05 text-only quote rotator */
export function CarouselQuotes({ items, autoplay, interval, showDots = true }) {
  const s = useSlides(items.length, { autoplay, intervalMs: interval });
  const item = items[s.index];
  if (!item) return null;
  return (
    <div {...s.bind} style={{ textAlign: "center", padding: "22px 16px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-card)", background: "var(--color-surface)" }}>
      <p key={s.index} className="ot-swap" style={{ fontFamily: "var(--font-heading)", fontSize: "1.1rem", margin: "0 0 10px", color: "var(--color-text)" }}>
        “{item.title}”
      </p>
      {item.subtitle ? <div style={sub}>— {item.subtitle}</div> : null}
      <Dots show={showDots} count={items.length} index={s.index} go={s.setIndex} />
    </div>
  );
}

/** 06 full-bleed hero with a counter */
export function CarouselHero({ items, autoplay, interval, showArrows = true, height }) {
  const s = useSlides(items.length, { autoplay, intervalMs: interval });
  const item = items[s.index];
  if (!item) return null;
  return (
    <div style={{ ...frame, height: px(220, height) }} {...s.bind}>
      <Photo name={nameOf(item)} src={item.imageUrl} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} radius={0} />
      <div key={s.index} className="ot-swap" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "rgba(0,0,0,0.38)", color: "#fff", textAlign: "center", padding: showArrows ? "20px 56px" : 20 }}>
        <div>
          <div style={{ fontFamily: "var(--font-heading)", fontSize: "1.5rem", fontWeight: 700 }}>{item.title}</div>
          {item.subtitle ? <div style={{ opacity: 0.88, marginTop: 4 }}>{item.subtitle}</div> : null}
          <Cta item={item} />
        </div>
      </div>
      <Arrows show={showArrows} prev={s.prev} next={s.next} />
      <span style={{ position: "absolute", right: 12, bottom: 10, background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: "0.72rem", padding: "3px 8px", borderRadius: 999, zIndex: 3 }}>
        {s.index + 1} / {items.length}
      </span>
    </div>
  );
}

/** 07 stacked cards, newest on top */
export function CarouselStack({ items, autoplay, interval, height }) {
  const s = useSlides(items.length, { autoplay, intervalMs: interval });
  const order = [...items.slice(s.index), ...items.slice(0, s.index)].slice(0, 3);
  return (
    <div
      {...s.bind}
      style={{ position: "relative", height: px(180, height), cursor: "pointer" }}
      onClick={s.next}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && s.next()}
      aria-label="Next slide"
    >
      {order.map((it, k) => (
        <div key={keyOf(it, k)} style={{ ...frame, position: "absolute", inset: 0, transform: `translate(${k * 10}px, ${k * 10}px) scale(${1 - k * 0.04})`, zIndex: 3 - k, opacity: 1 - k * 0.25 }}>
          <Photo name={nameOf(it)} src={it.imageUrl} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} radius={0} />
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 12, background: scrim(), color: "#fff", fontWeight: 600 }}>{it.title}</div>
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- 08–13 */

/** The shared "text over a picture" block the promo styles use. */
function SlideText({ item, align = "left", maxWidth = 520 }) {
  return (
    <div style={{ maxWidth, textAlign: align, color: "#fff" }}>
      {item.title ? <div style={{ fontFamily: "var(--font-heading)", fontSize: "clamp(1.25rem, 3.6vw, 1.9rem)", fontWeight: 700, lineHeight: 1.15, textWrap: "balance" }}>{item.title}</div> : null}
      {item.subtitle ? <div style={{ marginTop: 6, fontSize: "clamp(0.85rem, 2.2vw, 1rem)", opacity: 0.92, lineHeight: 1.4 }}>{item.subtitle}</div> : null}
      <Cta item={item} />
    </div>
  );
}

/** 08 wide banner: the slides slide sideways; text sits on the left over a dark-to-clear wash */
export function CarouselBanner({ items, autoplay, interval, showArrows = true, showDots = true, height }) {
  const s = useSlides(items.length, { autoplay, intervalMs: interval });
  if (!items.length) return null;
  return (
    <div style={{ ...frame, height: px(250, height) }} {...s.bind}>
      <div style={{ display: "flex", height: "100%", transform: `translateX(-${s.index * 100}%)`, transition: "transform 550ms cubic-bezier(0.22, 0.8, 0.24, 1)" }}>
        {items.map((it, k) => (
          <div key={keyOf(it, k)} aria-hidden={k !== s.index} style={{ position: "relative", flex: "0 0 100%", height: "100%" }}>
            <Photo name={nameOf(it)} src={it.imageUrl} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} radius={0} />
            <div style={{ position: "absolute", inset: 0, background: scrim("to right"), display: "flex", alignItems: "center", padding: showArrows ? "0 56px" : "0 clamp(18px, 6vw, 56px)" }}>
              <SlideText item={it} />
            </div>
          </div>
        ))}
      </div>
      <Arrows show={showArrows} prev={s.prev} next={s.next} />
      <Dots show={showDots} count={items.length} index={s.index} go={s.setIndex} inside />
    </div>
  );
}

/** 09 crossfade: slides melt into each other; text bottom-left */
export function CarouselFade({ items, autoplay, interval, showArrows = true, showDots = true, height }) {
  const s = useSlides(items.length, { autoplay, intervalMs: interval });
  if (!items.length) return null;
  return (
    <div style={{ ...frame, height: px(240, height) }} {...s.bind}>
      {items.map((it, k) => (
        <div key={keyOf(it, k)} aria-hidden={k !== s.index} style={{ position: "absolute", inset: 0, opacity: k === s.index ? 1 : 0, transition: "opacity 700ms ease", pointerEvents: k === s.index ? "auto" : "none" }}>
          <Photo name={nameOf(it)} src={it.imageUrl} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} radius={0} />
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: showArrows ? "40px 56px 34px" : "40px clamp(16px, 4vw, 32px) 34px", background: scrim() }}>
            <SlideText item={it} maxWidth={620} />
          </div>
        </div>
      ))}
      <Arrows show={showArrows} prev={s.prev} next={s.next} />
      <Dots show={showDots} count={items.length} index={s.index} go={s.setIndex} inside />
    </div>
  );
}

/** 10 cards: several at a time on a wide screen, snapping as you swipe or press the arrows */
export function CarouselCards({ items, autoplay, interval, showArrows = true, showDots = true, height }) {
  const s = useSlides(items.length, { autoplay, intervalMs: interval });
  const track = useRef(null);
  const reduce = useReducedMotion();

  // follow the slide counter (autoplay and the arrows) by scrolling the track to that card
  useEffect(() => {
    const el = track.current;
    const card = el?.children?.[s.index];
    if (el && card) el.scrollTo({ left: card.offsetLeft - el.offsetLeft, behavior: reduce ? "auto" : "smooth" });
  }, [s.index, reduce]);

  if (!items.length) return null;
  return (
    <div style={{ position: "relative" }} {...s.bind}>
      <div ref={track} style={{ display: "flex", gap: 14, overflowX: "auto", scrollSnapType: "x mandatory", scrollbarWidth: "none", padding: "2px 2px 6px" }}>
        {items.map((it, k) => (
          <div key={keyOf(it, k)} style={{ ...frame, flex: "0 0 min(300px, 82%)", scrollSnapAlign: "start", background: "var(--color-surface)" }}>
            <Photo name={nameOf(it)} src={it.imageUrl} style={{ height: px(150, height), width: "100%" }} radius={0} />
            <div style={{ padding: "12px 14px 14px" }}>
              <div style={{ ...caption, fontSize: "1rem" }}>{it.title}</div>
              {it.subtitle ? <div style={{ ...sub, marginTop: 3, lineHeight: 1.4 }}>{it.subtitle}</div> : null}
              <Cta item={it} style={{ marginTop: 10, padding: "6px 14px", fontSize: 12.5 }} />
            </div>
          </div>
        ))}
      </div>
      <Arrows show={showArrows && items.length > 1} prev={s.prev} next={s.next} />
      <Dots show={showDots} count={items.length} index={s.index} go={s.setIndex} />
    </div>
  );
}

/** 11 split: the picture on one side, the words on the other (stacked on a phone) */
export function CarouselSplit({ items, autoplay, interval, showArrows = true, showDots = true, height }) {
  const s = useSlides(items.length, { autoplay, intervalMs: interval });
  const item = items[s.index];
  if (!item) return null;
  const minH = px(220, height);
  const round = { width: 34, height: 34, borderRadius: 999, border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 0, display: "grid", placeItems: "center" };
  return (
    <div style={{ ...frame, display: "flex", flexWrap: "wrap", background: "var(--color-surface)" }} {...s.bind}>
      <div style={{ position: "relative", flex: "1 1 280px", minHeight: minH }}>
        <Photo key={`p-${s.index}`} name={nameOf(item)} src={item.imageUrl} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} radius={0} />
      </div>
      <div key={`t-${s.index}`} className="ot-swap" style={{ flex: "1 1 280px", minHeight: px(160, height), padding: "22px clamp(16px, 4vw, 30px)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ fontFamily: "var(--font-heading)", fontSize: "clamp(1.2rem, 3.4vw, 1.7rem)", fontWeight: 700, lineHeight: 1.15, color: "var(--color-text)", textWrap: "balance" }}>{item.title}</div>
        {item.subtitle ? <div style={{ ...sub, fontSize: "0.95rem", marginTop: 8, lineHeight: 1.5 }}>{item.subtitle}</div> : null}
        <div>
          <Cta item={item} style={{ marginTop: 14 }} />
        </div>
        {(showArrows && items.length > 1) || (showDots && items.length > 1) ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 18 }}>
            {showArrows && items.length > 1 ? (
              <>
                <button type="button" onClick={s.prev} aria-label="Previous" style={round}>
                  ‹
                </button>
                <button type="button" onClick={s.next} aria-label="Next" style={round}>
                  ›
                </button>
              </>
            ) : null}
            {showDots ? (
              <span style={{ fontSize: 12, color: "var(--color-text-muted)", fontVariantNumeric: "tabular-nums" }}>
                {s.index + 1} / {items.length}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** 12 story bars: segments at the top fill as the slide plays; tap the left or right half to move */
export function CarouselStory({ items, autoplay = true, interval = 5000, showDots = true, height }) {
  const s = useSlides(items.length, { autoplay, intervalMs: interval });
  const reduce = useReducedMotion();
  const item = items[s.index];
  if (!item) return null;
  const barBase = { flex: 1, height: 3, borderRadius: 3, background: "rgba(255,255,255,0.35)", overflow: "hidden" };
  return (
    <div style={{ ...frame, height: px(260, height), background: "#000" }} {...s.bind}>
      <Photo key={`p-${s.index}`} name={nameOf(item)} src={item.imageUrl} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} radius={0} />
      <div style={{ position: "absolute", inset: 0, background: scrim(), zIndex: 1 }} />
      {showDots && items.length > 1 ? (
        <div style={{ position: "absolute", top: 10, left: 12, right: 12, display: "flex", gap: 4, zIndex: 4 }} aria-hidden="true">
          {items.map((it, k) => (
            <span key={keyOf(it, k)} style={barBase}>
              <span
                key={k === s.index ? `run-${s.index}` : `fixed-${k}`}
                style={{
                  display: "block",
                  height: "100%",
                  background: "#fff",
                  transformOrigin: "left",
                  transform: k < s.index || (reduce && k === s.index) ? "scaleX(1)" : "scaleX(0)",
                  animation: k === s.index && !reduce && autoplay ? `ot-story-fill ${Math.max(1.5, interval / 1000)}s linear forwards` : "none",
                  animationPlayState: s.running ? "running" : "paused",
                }}
              />
            </span>
          ))}
        </div>
      ) : null}
      {/* invisible tap zones: left third goes back, the rest goes forward */}
      <button type="button" onClick={s.prev} aria-label="Previous" style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: "33%", zIndex: 2, background: "transparent", border: 0, cursor: "pointer" }} />
      <button type="button" onClick={s.next} aria-label="Next" style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: "67%", zIndex: 2, background: "transparent", border: 0, cursor: "pointer" }} />
      <div key={`t-${s.index}`} className="ot-swap" style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "0 clamp(16px, 4vw, 30px) 22px", zIndex: 3, pointerEvents: "none" }}>
        <div style={{ pointerEvents: "auto", display: "inline-block" }}>
          <SlideText item={item} maxWidth={560} />
        </div>
      </div>
    </div>
  );
}

/** 13 slow zoom: slides melt into each other while the picture drifts closer */
export function CarouselKenBurns({ items, autoplay, interval = 5000, showArrows = true, showDots = true, height }) {
  const s = useSlides(items.length, { autoplay, intervalMs: interval });
  const reduce = useReducedMotion();
  if (!items.length) return null;
  return (
    <div style={{ ...frame, height: px(250, height), background: "#000" }} {...s.bind}>
      {items.map((it, k) => {
        const active = k === s.index;
        return (
          <div
            key={keyOf(it, k)}
            aria-hidden={!active}
            style={{ position: "absolute", inset: 0, opacity: active ? 1 : 0, transition: "opacity 900ms ease", pointerEvents: active ? "auto" : "none" }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                transform: active && !reduce ? "scale(1.1)" : "scale(1)",
                transition: active && !reduce ? `transform ${Math.max(3000, interval + 1500)}ms linear` : "none",
              }}
            >
              <Photo name={nameOf(it)} src={it.imageUrl} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} radius={0} />
            </div>
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: showArrows ? "46px 56px 30px" : "46px clamp(16px, 4vw, 34px) 30px", background: scrim() }}>
              <SlideText item={it} maxWidth={620} />
            </div>
          </div>
        );
      })}
      <Arrows show={showArrows} prev={s.prev} next={s.next} />
      <Dots show={showDots} count={items.length} index={s.index} go={s.setIndex} inside />
    </div>
  );
}
