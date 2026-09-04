"use client";

import type { CSSProperties, ReactNode } from "react";
import type { ModalProps } from "./types";

/**
 * Dialog *panels*. They render in place — whichever overlay/portal the app uses
 * wraps them, so the gallery can show each one at rest.
 */
const shell: CSSProperties = {
  background: "var(--color-bg)",
  border: "1px solid var(--color-border)",
  color: "var(--color-text)",
  maxWidth: 400,
  width: "100%",
};
const title: CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontWeight: "var(--font-weight-heading)" as unknown as number,
  letterSpacing: "var(--letter-spacing-heading)",
  fontSize: "1.1rem",
  margin: 0,
  color: "var(--color-text)",
};
const bodyText: CSSProperties = { fontSize: "0.88rem", color: "var(--color-text-muted)", lineHeight: 1.55, margin: "8px 0 0" };
const actions: CSSProperties = { display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 };
const primary: CSSProperties = {
  font: "inherit",
  fontSize: "0.85rem",
  fontWeight: 600,
  padding: "9px 18px",
  borderRadius: "var(--radius-card)",
  background: "var(--color-primary)",
  color: "var(--color-on-primary)",
  border: "none",
  cursor: "pointer",
};
const secondary: CSSProperties = { ...primary, background: "transparent", color: "var(--color-text-muted)", border: "1px solid var(--color-border)" };

function Actions({ onClose }: { onClose?: () => void }) {
  return (
    <div style={actions}>
      <button type="button" className="ot-press" style={secondary} onClick={onClose}>Cancel</button>
      <button type="button" className="ot-press" style={primary}>Confirm</button>
    </div>
  );
}

function Close({ onClose }: { onClose?: () => void }) {
  return (
    <button type="button" onClick={onClose} aria-label="Close"
            style={{ position: "absolute", top: 12, right: 14, border: "none", background: "none", color: "var(--color-text-muted)", fontSize: "1.3rem", lineHeight: 1, cursor: "pointer" }}>
      ×
    </button>
  );
}

const Body = ({ children }: { children: ReactNode }) => <p style={bodyText}>{children}</p>;

/** 01 centred card */
export function ModalCentered({ title: t, children, onClose }: ModalProps) {
  return (
    <div className="ot-anim-pop" style={{ ...shell, borderRadius: 14, padding: 22, position: "relative" }} role="dialog" aria-label={t}>
      <Close onClose={onClose} />
      <h3 style={title}>{t}</h3>
      <Body>{children}</Body>
      <Actions onClose={onClose} />
    </div>
  );
}

/** 02 header bar in the brand colour */
export function ModalHeaderBar({ title: t, children, onClose }: ModalProps) {
  return (
    <div className="ot-anim-pop" style={{ ...shell, borderRadius: 12, overflow: "hidden" }} role="dialog" aria-label={t}>
      <div style={{ background: "var(--color-primary)", color: "var(--color-on-primary)", padding: "13px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ ...title, color: "var(--color-on-primary)", fontSize: "1rem" }}>{t}</h3>
        <button type="button" onClick={onClose} aria-label="Close" style={{ border: "none", background: "none", color: "inherit", fontSize: "1.2rem", cursor: "pointer", lineHeight: 1 }}>×</button>
      </div>
      <div style={{ padding: 18 }}>
        <Body>{children}</Body>
        <Actions onClose={onClose} />
      </div>
    </div>
  );
}

/** 03 sheet — flat top, rounded bottom, for mobile */
export function ModalSheet({ title: t, children, onClose }: ModalProps) {
  return (
    <div className="ot-anim-sheet" style={{ ...shell, borderRadius: "18px 18px 0 0", padding: "18px 20px 22px", maxWidth: 460 }} role="dialog" aria-label={t}>
      <div style={{ width: 38, height: 4, borderRadius: 999, background: "var(--color-border)", margin: "0 auto 14px" }} />
      <h3 style={title}>{t}</h3>
      <Body>{children}</Body>
      <Actions onClose={onClose} />
    </div>
  );
}

/** 04 side drawer */
export function ModalDrawer({ title: t, children, onClose }: ModalProps) {
  return (
    <div className="ot-anim-slide-in" style={{ ...shell, borderRadius: 0, padding: 22, height: 240, display: "flex", flexDirection: "column", position: "relative", maxWidth: 320 }} role="dialog" aria-label={t}>
      <Close onClose={onClose} />
      <h3 style={title}>{t}</h3>
      <Body>{children}</Body>
      <div style={{ marginTop: "auto" }}>
        <button type="button" style={{ ...primary, width: "100%" }}>Confirm</button>
      </div>
    </div>
  );
}

/** 05 compact confirm */
export function ModalConfirm({ title: t, children, onClose }: ModalProps) {
  return (
    <div className="ot-anim-pop" style={{ ...shell, borderRadius: 12, padding: 20, maxWidth: 320, textAlign: "center" }} role="dialog" aria-label={t}>
      <h3 style={{ ...title, fontSize: "1rem" }}>{t}</h3>
      <Body>{children}</Body>
      <div style={{ ...actions, justifyContent: "stretch", marginTop: 18 }}>
        <button type="button" style={{ ...secondary, flex: 1 }} onClick={onClose}>Cancel</button>
        <button type="button" style={{ ...primary, flex: 1 }}>Confirm</button>
      </div>
    </div>
  );
}

/** 06 top accent rule */
export function ModalAccent({ title: t, children, onClose }: ModalProps) {
  return (
    <div className="ot-anim-pop" style={{ ...shell, borderRadius: 12, padding: 22, borderTop: "4px solid var(--color-primary)", position: "relative" }} role="dialog" aria-label={t}>
      <Close onClose={onClose} />
      <h3 style={title}>{t}</h3>
      <Body>{children}</Body>
      <Actions onClose={onClose} />
    </div>
  );
}

/** 07 divided header / body / footer */
export function ModalDivided({ title: t, children, onClose }: ModalProps) {
  return (
    <div className="ot-anim-pop" style={{ ...shell, borderRadius: 12, overflow: "hidden" }} role="dialog" aria-label={t}>
      <div style={{ padding: "15px 20px", borderBottom: "1px solid var(--color-border)" }}>
        <h3 style={{ ...title, fontSize: "1rem" }}>{t}</h3>
      </div>
      <div style={{ padding: 20 }}>
        <Body>{children}</Body>
      </div>
      <div style={{ padding: "13px 20px", borderTop: "1px solid var(--color-border)", background: "var(--color-surface)", display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" style={secondary} onClick={onClose}>Cancel</button>
        <button type="button" style={primary}>Confirm</button>
      </div>
    </div>
  );
}

/** 08 borderless, heavily elevated */
export function ModalElevated({ title: t, children, onClose }: ModalProps) {
  return (
    <div className="ot-anim-pop" style={{ ...shell, border: "none", borderRadius: 16, padding: 24, boxShadow: "0 24px 60px rgba(0,0,0,0.28)", position: "relative" }} role="dialog" aria-label={t}>
      <Close onClose={onClose} />
      <h3 style={title}>{t}</h3>
      <Body>{children}</Body>
      <Actions onClose={onClose} />
    </div>
  );
}
