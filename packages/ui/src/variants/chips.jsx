"use client";

                                           
                                         

const base                = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  font: "inherit",
  fontSize: "0.82rem",
  fontWeight: 500,
  lineHeight: 1.3,
  padding: "7px 14px",
  cursor: "pointer",
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-text)",
};

function Remove({ show, onRemove }                                           ) {
  if (!show && !onRemove) return null;
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label="Remove"
      onClick={onRemove}
      style={{ opacity: 0.6, fontSize: "1rem", lineHeight: 1, cursor: "pointer" }}
    >
      ×
    </span>
  );
}

/** 01 solid when selected */
export function ChipSolid({ children, selected, removable, onRemove }           ) {
  return (
    <span className="ot-press" style={{ ...base, borderRadius: 999, ...(selected ? { background: "var(--color-primary)", color: "var(--color-on-primary)", borderColor: "var(--color-primary)" } : {}) }}>
      {children}
      <Remove show={removable} onRemove={onRemove} />
    </span>
  );
}

/** 02 soft tint when selected */
export function ChipSoft({ children, selected, removable, onRemove }           ) {
  return (
    <span className="ot-press" style={{ ...base, borderRadius: 999, ...(selected ? { background: "color-mix(in srgb, var(--color-primary) 15%, transparent)", color: "var(--color-primary)", borderColor: "transparent" } : {}) }}>
      {children}
      <Remove show={removable} onRemove={onRemove} />
    </span>
  );
}

/** 03 square corners */
export function ChipSquare({ children, selected, removable, onRemove }           ) {
  return (
    <span className="ot-press" style={{ ...base, borderRadius: 4, ...(selected ? { borderColor: "var(--color-primary)", color: "var(--color-primary)" } : {}) }}>
      {children}
      <Remove show={removable} onRemove={onRemove} />
    </span>
  );
}

/** 04 selection shows a tick */
export function ChipTick({ children, selected, removable, onRemove }           ) {
  return (
    <span className="ot-press" style={{ ...base, borderRadius: 999, ...(selected ? { borderColor: "var(--color-primary)", color: "var(--color-primary)" } : {}) }}>
      {selected ? <span aria-hidden>✓</span> : null}
      {children}
      <Remove show={removable} onRemove={onRemove} />
    </span>
  );
}

/** 05 filled surface, no border */
export function ChipFilled({ children, selected, removable, onRemove }           ) {
  return (
    <span className="ot-press" style={{ ...base, border: "none", borderRadius: 8, background: selected ? "var(--color-primary)" : "var(--color-surface)", color: selected ? "var(--color-on-primary)" : "var(--color-text)" }}>
      {children}
      <Remove show={removable} onRemove={onRemove} />
    </span>
  );
}

/** 06 underline instead of a container */
export function ChipUnderline({ children, selected, removable, onRemove }           ) {
  return (
    <span className="ot-press" style={{ ...base, border: "none", borderBottom: `2px solid ${selected ? "var(--color-primary)" : "transparent"}`, borderRadius: 0, padding: "6px 4px", color: selected ? "var(--color-text)" : "var(--color-text-muted)", background: "transparent" }}>
      {children}
      <Remove show={removable} onRemove={onRemove} />
    </span>
  );
}

/** 07 compact, dense filter style */
export function ChipCompact({ children, selected, removable, onRemove }           ) {
  return (
    <span className="ot-press" style={{ ...base, fontSize: "0.74rem", padding: "4px 10px", borderRadius: 6, background: selected ? "var(--color-text)" : "transparent", color: selected ? "var(--color-bg)" : "var(--color-text-muted)", borderColor: selected ? "var(--color-text)" : "var(--color-border)" }}>
      {children}
      <Remove show={removable} onRemove={onRemove} />
    </span>
  );
}

/** 08 leading dot */
export function ChipDot({ children, selected, removable, onRemove }           ) {
  return (
    <span className="ot-press" style={{ ...base, borderRadius: 999 }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: selected ? "var(--color-primary)" : "var(--color-border)" }} />
      {children}
      <Remove show={removable} onRemove={onRemove} />
    </span>
  );
}
