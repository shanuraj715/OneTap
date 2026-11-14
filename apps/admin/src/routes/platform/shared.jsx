import { Pill } from "../../ui";

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" }) : "—";

/** "3 / 5", or "3 / ∞" when unlimited. */
export const usageText = (used, max) => `${used} / ${max ?? "∞"}`;

/** A store's state at a glance: fine, in its grace period, or over limit with grace ended. */
export function StatusPill({ store }) {
  if (store.status === "grace") return <Pill tone="warn">In grace until {fmtDate(store.grace.until)}</Pill>;
  if (store.status === "over-limit") return <Pill tone="error">Over limit</Pill>;
  return <Pill tone="ok">Within plan</Pill>;
}

export const planLabel = (plan) => plan?.name ?? "No plan — unlimited";

export const row = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  padding: "11px 13px",
  border: "1px solid var(--color-border)",
  borderRadius: 9,
  background: "var(--color-bg)",
};

export const muted = { fontSize: 12.5, color: "var(--color-text-muted)" };
