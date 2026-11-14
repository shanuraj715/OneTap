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

/** What an HTTP error means for a store address behind Cloudflare, in words an owner can act on. */
export function describeHttpError(code) {
  if (code === 521) return "Cloudflare can't connect to your server (521) — nginx is down or blocking Cloudflare.";
  if (code === 522 || code === 523 || code === 524) return `Cloudflare can't reach your server in time (${code}) — check the IP in DNS and the firewall.`;
  if (code === 525) return "Cloudflare reached your server but the HTTPS handshake failed (525) — nginx has no certificate for this name, or isn't listening on 443.";
  if (code === 526) return "The certificate on your server isn't valid for Cloudflare (526) — install a Cloudflare Origin certificate or a Let's Encrypt one.";
  if (code === 502 || code === 503 || code === 504) return `The server answered with an error (${code}) — the storefront may be down.`;
  return `The server answered with an error${code ? ` (${code})` : ""}.`;
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
