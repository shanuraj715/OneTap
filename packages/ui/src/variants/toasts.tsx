import type { CSSProperties } from "react";
import { toneVars, type ToastProps } from "./types";

const ICONS = { info: "i", success: "✓", warning: "!", danger: "×" } as const;

const base: CSSProperties = {
  display: "flex",
  gap: 11,
  alignItems: "flex-start",
  padding: "12px 14px",
  fontSize: "0.85rem",
  lineHeight: 1.45,
  maxWidth: 380,
};
const close: CSSProperties = { marginLeft: "auto", opacity: 0.5, fontSize: "1.05rem", lineHeight: 1, cursor: "pointer" };

/** 01 solid tone, elevated */
export function ToastSolid({ title, message, tone = "info" }: ToastProps) {
  const t = toneVars(tone);
  return (
    <div className="ot-anim-slide-in" style={{ ...base, background: t.fg, color: "var(--color-bg)", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.22)" }}>
      <strong>{title}</strong>
      {message ? <span style={{ opacity: 0.9 }}>{message}</span> : null}
      <span style={close} aria-hidden>×</span>
    </div>
  );
}

/** 02 surface card with a coloured icon */
export function ToastCard({ title, message, tone = "info" }: ToastProps) {
  const t = toneVars(tone);
  return (
    <div className="ot-anim-slide-in" style={{ ...base, background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.14)" }}>
      <span style={{ width: 22, height: 22, borderRadius: "50%", background: t.fg, color: "var(--color-bg)", display: "grid", placeItems: "center", fontWeight: 700, fontSize: "0.72rem", flexShrink: 0 }}>{ICONS[tone]}</span>
      <span>
        <strong style={{ display: "block" }}>{title}</strong>
        {message ? <span style={{ color: "var(--color-text-muted)" }}>{message}</span> : null}
      </span>
      <span style={close} aria-hidden>×</span>
    </div>
  );
}

/** 03 left accent stripe */
export function ToastStripe({ title, message, tone = "info" }: ToastProps) {
  const t = toneVars(tone);
  return (
    <div className="ot-anim-slide-in" style={{ ...base, background: "var(--color-bg)", borderLeft: `4px solid ${t.fg}`, border: "1px solid var(--color-border)", borderLeftWidth: 4, borderLeftColor: t.fg, borderRadius: "0 10px 10px 0", boxShadow: "0 6px 18px rgba(0,0,0,0.12)" }}>
      <span>
        <strong style={{ display: "block", color: t.fg }}>{title}</strong>
        {message ? <span style={{ color: "var(--color-text-muted)" }}>{message}</span> : null}
      </span>
      <span style={close} aria-hidden>×</span>
    </div>
  );
}

/** 04 soft wash */
export function ToastSoft({ title, message, tone = "info" }: ToastProps) {
  const t = toneVars(tone);
  return (
    <div className="ot-anim-slide-in" style={{ ...base, background: t.wash, color: t.fg, borderRadius: 12 }}>
      <span>
        <strong style={{ display: "block" }}>{title}</strong>
        {message ? <span style={{ color: "var(--color-text)" }}>{message}</span> : null}
      </span>
      <span style={close} aria-hidden>×</span>
    </div>
  );
}

/** 05 pill, single line */
export function ToastPill({ title, message, tone = "info" }: ToastProps) {
  const t = toneVars(tone);
  return (
    <div className="ot-anim-slide-in" style={{ ...base, alignItems: "center", background: "var(--color-text)", color: "var(--color-bg)", borderRadius: 999, padding: "10px 18px" }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: t.fg, flexShrink: 0 }} />
      <strong>{title}</strong>
      {message ? <span style={{ opacity: 0.75 }}>{message}</span> : null}
    </div>
  );
}

/** 06 with a progress bar showing the auto-dismiss timer */
export function ToastTimer({ title, message, tone = "info" }: ToastProps) {
  const t = toneVars(tone);
  return (
    <div className="ot-anim-slide-in" style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 10, overflow: "hidden", maxWidth: 380, boxShadow: "0 6px 18px rgba(0,0,0,0.12)" }}>
      <div style={{ ...base, maxWidth: "none" }}>
        <span>
          <strong style={{ display: "block" }}>{title}</strong>
          {message ? <span style={{ color: "var(--color-text-muted)" }}>{message}</span> : null}
        </span>
        <span style={close} aria-hidden>×</span>
      </div>
      <div style={{ height: 3, background: "var(--color-border)" }}>
        <div className="ot-bar" style={{ height: "100%", width: "62%", background: t.fg }} />
      </div>
    </div>
  );
}

/** 07 minimal — text and a rule, no chrome */
export function ToastMinimal({ title, message, tone = "info" }: ToastProps) {
  const t = toneVars(tone);
  return (
    <div className="ot-anim-slide-in" style={{ ...base, background: "var(--color-bg)", borderBottom: `2px solid ${t.fg}`, borderRadius: 0, paddingLeft: 0 }}>
      <span>
        <strong style={{ color: t.fg }}>{title}</strong>
        {message ? <span style={{ color: "var(--color-text-muted)" }}> — {message}</span> : null}
      </span>
      <span style={close} aria-hidden>×</span>
    </div>
  );
}
