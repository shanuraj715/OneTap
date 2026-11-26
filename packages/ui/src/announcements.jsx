"use client";

import { useEffect, useMemo, useState } from "react";
import { safeHref } from "@rasoipulse/config-schema";
import { AppLink } from "./link";
import { useSlides } from "./hooks";

/**
 * The message bar above the storefront header — its own component, so any header can sit under any bar.
 * Eight styles share one set of props:
 *
 *   messages     [{ id, text, linkLabel, linkHref }] — one or several; styles that can rotate do
 *   phone        the outlet's phone number, for styles that have room for it
 *   dismissible  show a close button; a changed message shows again
 *   rotateSeconds  how long each message stays (rotating and ticker styles)
 *
 * Colours come only from the store's theme tokens, so every style follows the store's palette.
 */

const STORAGE_KEY = "rasoipulse.announcement.dismissed";

const hashOf = (messages) => {
  const s = messages.map((m) => `${m.text}|${m.linkHref}`).join("§");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return String(h);
};

/** Remembers (on this device) that the visitor closed THIS message, so it stays shut until the owner changes it. */
function useDismissed(messages, dismissible) {
  const signature = useMemo(() => hashOf(messages), [messages]);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (!dismissible) {
      setHidden(false);
      return;
    }
    try {
      setHidden(window.localStorage.getItem(STORAGE_KEY) === signature);
    } catch {
      /* private window — it just shows every visit */
    }
  }, [signature, dismissible]);
  const dismiss = () => {
    setHidden(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, signature);
    } catch {
      /* not remembered */
    }
  };
  return { hidden, dismiss };
}

/* ------------------------------------------------------------------ pieces */

const closeBtn = {
  position: "absolute",
  right: 8,
  top: "50%",
  transform: "translateY(-50%)",
  width: 26,
  height: 26,
  display: "grid",
  placeItems: "center",
  border: 0,
  borderRadius: 6,
  background: "transparent",
  color: "inherit",
  opacity: 0.8,
  cursor: "pointer",
  padding: 0,
};

function CloseGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4.5 4.5l11 11M15.5 4.5l-11 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** The bar's outer box: the colours, the region label, and the close button. Renders nothing once dismissed. */
function Bar({ messages, dismissible, style, children, className }) {
  const { hidden, dismiss } = useDismissed(messages, dismissible);
  if (hidden || messages.length === 0) return null;
  return (
    <div role="region" aria-label="Announcement" className={className} style={{ position: "relative", fontSize: 13, lineHeight: 1.45, ...style }}>
      {children}
      {dismissible ? (
        <button type="button" onClick={dismiss} aria-label="Dismiss announcement" style={closeBtn}>
          <CloseGlyph />
        </button>
      ) : null}
    </div>
  );
}

/** Same side padding as the header, with room on the right for the close button. */
const rowPad = (dismissible) => ({ maxWidth: 1080, margin: "0 auto", paddingTop: 8, paddingBottom: 8, paddingRight: dismissible ? 42 : undefined });

const linkOn = (extra) => ({ color: "inherit", fontWeight: 700, textDecoration: "underline", textUnderlineOffset: 3, whiteSpace: "nowrap", ...extra });

/** One message: its text, and its link when it has one (a link with no label turns the text itself into the link). */
function Message({ m, link }) {
  const href = safeHref(m.linkHref);
  if (href && !m.linkLabel) {
    return (
      <AppLink href={href} style={{ ...linkOn(), fontWeight: 500, textDecoration: "none" }}>
        {m.text}
      </AppLink>
    );
  }
  return (
    <>
      <span>{m.text}</span>
      {href && m.linkLabel ? (
        <AppLink href={href} style={{ marginLeft: 8, ...linkOn(link) }}>
          {m.linkLabel}
        </AppLink>
      ) : null}
    </>
  );
}

/** Messages that take turns (a soft fade), with the visitor able to jump to one. Single messages just show. */
function useTurns(messages, rotateSeconds) {
  const slides = useSlides(messages.length, { autoplay: true, intervalMs: rotateSeconds * 1000 });
  const safe = messages.length ? Math.min(slides.index, messages.length - 1) : 0;
  return { ...slides, index: safe, current: messages[safe] };
}

/**
 * Every message laid on top of each other in one grid cell, only the current one visible. The bar is then always as
 * tall as its TALLEST message (one with a button, one that wraps onto two lines), so it never changes height as the
 * messages take turns and the page below never jumps. Hidden messages are out of the tab order and the reading order.
 */
function Turns({ messages, index, render, enter = "ot-anim-fade", style, itemStyle }) {
  if (!messages.length) return null;
  return (
    <span style={{ display: "inline-grid", gridTemplateColumns: "minmax(0, 1fr)", minWidth: 0, maxWidth: "100%", ...style }}>
      {messages.map((m, k) => (
        <span
          key={m.id ?? k}
          aria-hidden={k === index ? undefined : true}
          className={k === index ? enter : undefined}
          style={{ gridArea: "1 / 1", alignSelf: "center", minWidth: 0, visibility: k === index ? "visible" : "hidden", ...itemStyle }}
        >
          {render(m)}
        </span>
      ))}
    </span>
  );
}

const dot = (active) => ({
  width: 6,
  height: 6,
  padding: 0,
  borderRadius: 999,
  border: 0,
  cursor: "pointer",
  background: "currentColor",
  // a <button> doesn't inherit its text colour by itself, and currentColor must be the bar's text colour
  color: "inherit",
  opacity: active ? 0.95 : 0.35,
});

function Dots({ count, index, onPick }) {
  if (count < 2) return null;
  return (
    <span style={{ display: "inline-flex", gap: 5, alignItems: "center", marginLeft: 12 }}>
      {Array.from({ length: count }, (_, k) => (
        <button key={k} type="button" aria-label={`Message ${k + 1} of ${count}`} aria-current={k === index} onClick={() => onPick(k)} style={dot(k === index)} />
      ))}
    </span>
  );
}

/* ---------------------------------------------------------------- variants */

/** 01 — brand colour, centred. Several messages take turns. */
export function AnnouncementSolid({ messages = [], dismissible = true, rotateSeconds = 5 }) {
  const t = useTurns(messages, rotateSeconds);
  return (
    <Bar messages={messages} dismissible={dismissible} style={{ background: "var(--color-primary)", color: "var(--color-on-primary)" }}>
      <div className="ot-header-px" style={{ ...rowPad(dismissible), display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", flexWrap: "wrap", gap: "2px 0" }} {...t.bind}>
        <Turns messages={messages} index={t.index} render={(m) => <Message m={m} />} />
        <Dots count={messages.length} index={t.index} onPick={t.setIndex} />
      </div>
    </Bar>
  );
}

/** 02 — a light tint of the brand colour, centred. */
export function AnnouncementSoft({ messages = [], dismissible = true, rotateSeconds = 5 }) {
  const t = useTurns(messages, rotateSeconds);
  return (
    <Bar
      messages={messages}
      dismissible={dismissible}
      style={{ background: "color-mix(in srgb, var(--color-primary) 11%, var(--color-bg))", color: "var(--color-text)", borderBottom: "1px solid color-mix(in srgb, var(--color-primary) 22%, var(--color-border))" }}
    >
      <div className="ot-header-px" style={{ ...rowPad(dismissible), display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", flexWrap: "wrap" }} {...t.bind}>
        <Turns messages={messages} index={t.index} render={(m) => <Message m={m} link={{ color: "var(--color-primary-text, var(--color-primary))" }} />} />
        <Dots count={messages.length} index={t.index} onPick={t.setIndex} />
      </div>
    </Bar>
  );
}

/** 03 — message on the left, phone number on the right (the look the old "top bar" header had). */
export function AnnouncementSplit({ messages = [], phone, dismissible = true, rotateSeconds = 5 }) {
  const t = useTurns(messages, rotateSeconds);
  return (
    <Bar messages={messages} dismissible={dismissible} style={{ background: "var(--color-primary)", color: "var(--color-on-primary)", fontSize: 12.5 }}>
      <div className="ot-header-px" style={{ ...rowPad(dismissible), paddingTop: 7, paddingBottom: 7, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }} {...t.bind}>
        {/* the message gives way first — the phone number must never wrap or break */}
        <Turns
          messages={messages}
          index={t.index}
          style={{ flex: "0 1 auto" }}
          itemStyle={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          render={(m) => <Message m={m} />}
        />
        {phone ? (
          <a href={`tel:${String(phone).replace(/[^+\d]/g, "")}`} style={{ whiteSpace: "nowrap", flexShrink: 0, color: "inherit", textDecoration: "none", fontWeight: 600 }}>
            {phone}
          </a>
        ) : null}
      </div>
    </Bar>
  );
}

/** 04 — a ticker: every message scrolls past, side by side. Still on reduced motion. */
export function AnnouncementMarquee({ messages = [], dismissible = true, rotateSeconds = 5 }) {
  const chars = messages.reduce((n, m) => n + m.text.length + (m.linkLabel?.length ?? 0), 0);
  // slower for longer text, and for a larger "seconds per message" setting
  const seconds = Math.max(14, Math.round(chars * 0.2 * (rotateSeconds / 5)));
  const strip = (
    <>
      {messages.map((m) => (
        <span key={m.id} style={{ display: "inline-flex", alignItems: "center", paddingRight: 34 }}>
          <Message m={m} />
          <span aria-hidden="true" style={{ marginLeft: 34, opacity: 0.55 }}>
            ✦
          </span>
        </span>
      ))}
    </>
  );
  return (
    <Bar messages={messages} dismissible={dismissible} style={{ background: "var(--color-text)", color: "var(--color-bg)", overflow: "hidden" }}>
      <div className="ot-marquee" style={{ paddingTop: 8, paddingBottom: 8, paddingRight: dismissible ? 40 : 0, overflow: "hidden" }}>
        <div className="ot-marquee-track" style={{ "--ot-marquee-seconds": `${seconds}s` }}>
          {/* twice, so the loop has no gap */}
          <span style={{ display: "inline-flex" }}>{strip}</span>
          <span style={{ display: "inline-flex" }} aria-hidden="true">
            {strip}
          </span>
        </div>
      </div>
    </Bar>
  );
}

/** 05 — one message at a time on a light strip, with previous / next arrows and a count. */
export function AnnouncementRotator({ messages = [], dismissible = true, rotateSeconds = 5 }) {
  const t = useTurns(messages, rotateSeconds);
  const arrow = { width: 26, height: 26, display: "grid", placeItems: "center", border: "1px solid var(--color-border)", borderRadius: 999, background: "var(--color-bg)", color: "var(--color-text)", cursor: "pointer", padding: 0, fontSize: 15, lineHeight: 1 };
  return (
    <Bar messages={messages} dismissible={dismissible} style={{ background: "var(--color-surface)", color: "var(--color-text)", borderBottom: "1px solid var(--color-border)" }}>
      <div className="ot-header-px" style={{ ...rowPad(dismissible), display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }} {...t.bind}>
        {messages.length > 1 ? (
          <button type="button" onClick={t.prev} aria-label="Previous message" style={arrow}>
            ‹
          </button>
        ) : null}
        <Turns messages={messages} index={t.index} enter="ot-anim-rise" itemStyle={{ textAlign: "center" }} render={(m) => <Message m={m} link={{ color: "var(--color-primary-text, var(--color-primary))" }} />} />
        {messages.length > 1 ? (
          <>
            <button type="button" onClick={t.next} aria-label="Next message" style={arrow}>
              ›
            </button>
            <span style={{ fontSize: 11.5, color: "var(--color-text-muted)", fontVariantNumeric: "tabular-nums" }}>
              {t.index + 1}/{messages.length}
            </span>
          </>
        ) : null}
      </div>
    </Bar>
  );
}

/** 06 — a rounded pill floating in the middle of a plain strip. */
export function AnnouncementPill({ messages = [], dismissible = true, rotateSeconds = 5 }) {
  const t = useTurns(messages, rotateSeconds);
  return (
    <Bar messages={messages} dismissible={dismissible} style={{ background: "var(--color-bg)", color: "var(--color-text)" }}>
      <div className="ot-header-px" style={{ ...rowPad(dismissible), display: "flex", justifyContent: "center" }} {...t.bind}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            maxWidth: "100%",
            padding: "6px 16px",
            borderRadius: 999,
            background: "var(--color-primary)",
            color: "var(--color-on-primary)",
            boxShadow: "0 3px 12px color-mix(in srgb, var(--color-primary) 35%, transparent)",
          }}
        >
          <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: "currentColor", flexShrink: 0 }} />
          <Turns messages={messages} index={t.index} itemStyle={{ textAlign: "center" }} render={(m) => <Message m={m} />} />
          <Dots count={messages.length} index={t.index} onPick={t.setIndex} />
        </span>
      </div>
    </Bar>
  );
}

/** 07 — near-black strip with the link in the brand colour. */
export function AnnouncementDark({ messages = [], dismissible = true, rotateSeconds = 5 }) {
  const t = useTurns(messages, rotateSeconds);
  return (
    <Bar messages={messages} dismissible={dismissible} style={{ background: "var(--color-text)", color: "var(--color-bg)" }}>
      <div className="ot-header-px" style={{ ...rowPad(dismissible), display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", flexWrap: "wrap" }} {...t.bind}>
        <Turns messages={messages} index={t.index} render={(m) => <Message m={m} link={{ color: "color-mix(in srgb, var(--color-primary) 55%, var(--color-bg))" }} />} />
        <Dots count={messages.length} index={t.index} onPick={t.setIndex} />
      </div>
    </Bar>
  );
}

/** 08 — the message with its link as a real button beside it. */
export function AnnouncementButton({ messages = [], dismissible = true, rotateSeconds = 5 }) {
  const t = useTurns(messages, rotateSeconds);
  return (
    <Bar messages={messages} dismissible={dismissible} style={{ background: "var(--color-primary)", color: "var(--color-on-primary)" }}>
      <div className="ot-header-px" style={{ ...rowPad(dismissible), paddingTop: 7, paddingBottom: 7, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px 14px", flexWrap: "wrap", textAlign: "center" }} {...t.bind}>
        <Turns messages={messages} index={t.index} render={(m) => <ButtonMessage m={m} />} />
        <Dots count={messages.length} index={t.index} onPick={t.setIndex} />
      </div>
    </Bar>
  );
}

/** One message of the "with button" style: its text, and its link as a button when it has one. */
function ButtonMessage({ m }) {
  const href = safeHref(m.linkHref);
  return (
    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px 14px", flexWrap: "wrap" }}>
      <span style={{ fontWeight: 600 }}>{m.text}</span>
      {href ? (
        <AppLink
          href={href}
          style={{
            fontSize: 12,
            fontWeight: 700,
            padding: "4px 14px",
            borderRadius: 999,
            border: "1.5px solid currentColor",
            color: "inherit",
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          {m.linkLabel || "Learn more"}
        </AppLink>
      ) : null}
    </span>
  );
}
