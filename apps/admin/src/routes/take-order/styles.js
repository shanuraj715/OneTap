/**
 * Shared bits of the Take order screen. Everything is built for a thumb on a
 * phone first — 44px+ touch targets, one column — and widens to a two-pane
 * layout on a tablet or desktop (see TakeOrder.jsx's media query).
 */
export { useMedia } from "../../lib/useMedia";

/** 98•••43210 — enough for staff to confirm the number, not enough to copy it off a screen. */
export const maskPhone = (p) => (p && p.length >= 10 ? `${p.slice(0, 2)}•••${p.slice(-5)}` : p ?? "");

/** "98765 43210" while typing. */
export const prettyPhone = (digits) => (digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits);

export const FOOD_COLOR = { veg: "#1f8a3b", "non-veg": "#b3261e", egg: "#c98a00" };

export const iconBtn = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 40,
  height: 40,
  borderRadius: 12,
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-text)",
  cursor: "pointer",
  flexShrink: 0,
};

export const primaryBtn = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  minHeight: 50,
  padding: "0 20px",
  borderRadius: 14,
  border: "none",
  background: "var(--color-primary)",
  color: "var(--color-on-primary)",
  font: "inherit",
  fontWeight: 700,
  fontSize: 15.5,
  cursor: "pointer",
};

export const ghostBtn = {
  ...primaryBtn,
  background: "transparent",
  color: "var(--color-text)",
  border: "1px solid var(--color-border)",
  fontWeight: 600,
};

export const chip = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  minHeight: 36,
  padding: "0 14px",
  borderRadius: 999,
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-text)",
  font: "inherit",
  fontSize: 13.5,
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

export const chipActive = {
  background: "var(--color-text)",
  borderColor: "var(--color-text)",
  color: "var(--color-bg)",
};

export const input = {
  width: "100%",
  boxSizing: "border-box",
  minHeight: 48,
  padding: "0 14px",
  borderRadius: 12,
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-text)",
  font: "inherit",
  fontSize: 16, // 16px stops iOS zooming into the field
};

export const label = {
  display: "block",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--color-text-muted)",
  marginBottom: 6,
};

export const muted = { color: "var(--color-text-muted)" };

export const disabledLook = { opacity: 0.45, cursor: "not-allowed" };
