                                           
import { toneVars,                 } from "./types";

const ICONS = { info: "i", success: "✓", warning: "!", danger: "×" }         ;

const base                = { padding: "14px 16px", fontSize: "0.88rem", lineHeight: 1.5 };
const titleStyle                = { fontWeight: 700, marginBottom: 3 };

/** 01 left accent bar over a wash */
export function AlertLeftAccent({ title, children, tone = "info" }            ) {
  const t = toneVars(tone);
  return (
    <div className="ot-anim-fade" style={{ ...base, background: t.wash, borderLeft: `4px solid ${t.fg}`, borderRadius: "0 8px 8px 0" }}>
      <div style={{ ...titleStyle, color: t.fg }}>{title}</div>
      <div style={{ color: "var(--color-text)" }}>{children}</div>
    </div>
  );
}

/** 02 soft wash, no border */
export function AlertSoft({ title, children, tone = "info" }            ) {
  const t = toneVars(tone);
  return (
    <div className="ot-anim-fade" style={{ ...base, background: t.wash, borderRadius: 10, color: t.fg }}>
      <div style={titleStyle}>{title}</div>
      <div style={{ color: "var(--color-text)" }}>{children}</div>
    </div>
  );
}

/** 03 outline only */
export function AlertOutline({ title, children, tone = "info" }            ) {
  const t = toneVars(tone);
  return (
    <div className="ot-anim-fade" style={{ ...base, border: `1px solid ${t.fg}`, borderRadius: 10, background: "transparent" }}>
      <div style={{ ...titleStyle, color: t.fg }}>{title}</div>
      <div style={{ color: "var(--color-text)" }}>{children}</div>
    </div>
  );
}

/** 04 round icon badge on the left */
export function AlertIcon({ title, children, tone = "info" }            ) {
  const t = toneVars(tone);
  return (
    <div className="ot-anim-fade" style={{ ...base, background: t.wash, borderRadius: 10, display: "flex", gap: 12 }}>
      <span style={{ width: 24, height: 24, borderRadius: "50%", background: t.fg, color: "var(--color-bg)", display: "grid", placeItems: "center", fontWeight: 700, fontSize: "0.8rem", flexShrink: 0 }}>
        {ICONS[tone]}
      </span>
      <span>
        <span style={{ ...titleStyle, display: "block", color: t.fg }}>{title}</span>
        <span style={{ color: "var(--color-text)" }}>{children}</span>
      </span>
    </div>
  );
}

/** 05 solid banner */
export function AlertBanner({ title, children, tone = "info" }            ) {
  const t = toneVars(tone);
  return (
    <div className="ot-anim-fade" style={{ ...base, background: t.fg, color: "var(--color-bg)", borderRadius: 8 }}>
      <div style={titleStyle}>{title}</div>
      <div style={{ opacity: 0.9 }}>{children}</div>
    </div>
  );
}

/** 06 top accent rule */
export function AlertTopRule({ title, children, tone = "info" }            ) {
  const t = toneVars(tone);
  return (
    <div className="ot-anim-fade" style={{ ...base, background: "var(--color-surface)", borderTop: `3px solid ${t.fg}`, border: "1px solid var(--color-border)", borderTopWidth: 3, borderTopColor: t.fg, borderRadius: 8 }}>
      <div style={{ ...titleStyle, color: t.fg }}>{title}</div>
      <div style={{ color: "var(--color-text)" }}>{children}</div>
    </div>
  );
}

/** 07 single compact line */
export function AlertInline({ title, children, tone = "info" }            ) {
  const t = toneVars(tone);
  return (
    <div className="ot-anim-fade" style={{ ...base, padding: "9px 12px", background: t.wash, borderRadius: 7, display: "flex", gap: 8, alignItems: "baseline" }}>
      <strong style={{ color: t.fg, whiteSpace: "nowrap" }}>{title}</strong>
      <span style={{ color: "var(--color-text)" }}>{children}</span>
    </div>
  );
}
