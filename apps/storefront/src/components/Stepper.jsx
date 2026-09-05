"use client";

/**
 * The +/− quantity control. Shared between the item customiser (still a
 * modal) and the order page (a full page now) — a stateful control like this
 * drifting into two slightly different implementations is exactly the kind of
 * bug that only shows up for one of the two later.
 */
export function Stepper({ value, onChange, small }) {
  const size = small ? 26 : 34;
  const btn = {
    width: size,
    height: size,
    border: "1px solid var(--color-border)",
    background: "var(--color-bg)",
    color: "var(--color-text)",
    borderRadius: 7,
    cursor: "pointer",
    font: "inherit",
    fontSize: small ? 14 : 16,
    lineHeight: 1,
  };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <button type="button" style={btn} onClick={() => onChange(value - 1)} aria-label="One fewer">
        −
      </button>
      <span style={{ minWidth: 18, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{value}</span>
      <button type="button" style={btn} onClick={() => onChange(value + 1)} aria-label="One more">
        +
      </button>
    </span>
  );
}
