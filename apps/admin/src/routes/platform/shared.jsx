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

/**
 * Results of the server's own check of an address that mean "it couldn't get
 * through" — which is not always the address's fault. The server checks from
 * inside its hosting network, and a firewall there can block or re-sign
 * connections to a brand-new domain (FortiGuard rates unknown domains
 * "Unrated" and blocks them) while every visitor on the internet is fine.
 */
export const SERVER_CHECK_FAILED = ["bad-cert", "no-https", "no-dns"];

/**
 * Can THIS browser open the address? A no-cors request can't read the page,
 * but it only succeeds when DNS, the certificate and the connection all work
 * — which is exactly what a visitor needs. Used to double-check a failed
 * server-side check from where it matters.
 */
export async function browserCanOpen(url, ms = 8000) {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), ms);
  try {
    await fetch(url, { mode: "no-cors", cache: "no-store", signal: abort.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
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
