import { Eraser } from "lucide-react";
import { Button, Modal } from "../../ui";
import { bytes, count } from "./viz/format";
import { muted } from "./shared";

/** What a list of remembered items is made of, biggest group first: [{ label: "Menu", n: 2 }, …]. */
export function summarize(entries) {
  const by = new Map();
  for (const e of entries) {
    const label = e.label ?? e.kind;
    by.set(label, (by.get(label) ?? 0) + 1);
  }
  return [...by].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n || a.label.localeCompare(b.label));
}

/**
 * Each way of expiring the cache, in plain words: what it DROPS and what STAYS. The confirmation window shows these next to the real list of
 * items, which comes from the same rule the server uses to expire (cache.service.js → entriesFor), so the window and the result agree.
 */
export const EXPIRE_WORDS = {
  admin: {
    title: "Expire the admin panel's cache",
    drops: "What the console and the marketing website remember on their own: the dashboard's numbers, the website's pages and prices, and “no store has this address” answers.",
    stays: "Every store's items. No store, outlet or menu is touched.",
  },
  outlet: {
    title: "Expire this outlet's cache",
    drops: "Only this outlet's own items: its menu, settings, pages, offers, kitchen-load count and access check.",
    stays: "The store's look, plan and web addresses, the store's other outlets, and every other store.",
  },
  store: {
    title: "Expire this store's cache",
    drops: "Everything remembered for this store: its look and outlets, its plan, its addresses, and every outlet's menu, settings, pages and offers.",
    stays: "Every other store, and the admin panel's own items.",
  },
  all: {
    title: "Expire everything",
    drops: "Everything remembered: every store's items and the admin panel's own. The marketing website is told to refresh too.",
    stays: "Nothing in the database. People stay signed in (their sign-in is just looked up again).",
  },
};

/**
 * "Expire …?": says what will be dropped (the real list, grouped), what stays, and what happens next — and only then asks.
 * `ask` = { scope: "admin" | "store" | "outlet" | "all", name?, entries: [{ label, kind, bytes }] }
 */
export function ExpireDialog({ ask, kinds = [], busy, error, onConfirm, onClose }) {
  const words = EXPIRE_WORDS[ask.scope];
  const parts = summarize(ask.entries);
  const total = ask.entries.length;
  const size = ask.entries.reduce((n, e) => n + (e.bytes ?? 0), 0);
  const what = Object.fromEntries(kinds.map((k) => [k.label, k.what]));
  return (
    <Modal onClose={busy ? () => {} : onClose} width={520} ariaLabel={words.title} panelStyle={{ padding: 24 }}>
      <div data-testid="expire-dialog">
        <h2 style={{ margin: "0 0 4px", fontSize: 19, display: "flex", gap: 8, alignItems: "center" }}>
          <Eraser size={18} aria-hidden /> {words.title}
        </h2>
        {ask.name ? <div style={{ ...muted, marginBottom: 12 }}>{ask.name}</div> : <div style={{ marginBottom: 12 }} />}

        <div style={{ fontWeight: 650, marginBottom: 6 }}>What will expire</div>
        <p style={{ ...muted, margin: "0 0 8px" }}>{words.drops}</p>
        {total === 0 ? (
          <p data-testid="expire-dialog-empty" style={{ margin: "0 0 12px", fontWeight: 600 }}>Nothing is remembered here right now, so there is nothing to expire.</p>
        ) : (
          <>
            <p data-testid="expire-dialog-count" style={{ margin: "0 0 6px", fontWeight: 600 }}>
              {count(total)} {total === 1 ? "item" : "items"} · {bytes(size)}
            </p>
            <ul data-testid="expire-dialog-list" style={{ listStyle: "none", padding: 0, margin: "0 0 12px", display: "flex", flexDirection: "column", gap: 4 }}>
              {parts.map((p) => (
                <li key={p.label} style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                  <b style={{ minWidth: 28, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{p.n}×</b>
                  <span>
                    {p.label}
                    {what[p.label] ? <span style={{ ...muted, fontSize: 12.5 }}> — {what[p.label]}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        <div style={{ fontWeight: 650, marginBottom: 4 }}>What stays</div>
        <p style={{ ...muted, margin: "0 0 12px" }}>{words.stays}</p>
        <div style={{ fontWeight: 650, marginBottom: 4 }}>What happens next</div>
        <p style={{ ...muted, margin: "0 0 16px" }}>The next visit loads fresh data from the database (a little slower, once). Nothing in the database changes.</p>

        {error ? <p style={{ color: "var(--color-danger, #b42318)", margin: "0 0 12px" }}>{error}</p> : null}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={busy || total === 0} data-testid="expire-dialog-confirm">
            {busy ? "Expiring…" : total === 0 ? "Nothing to expire" : `Expire ${count(total)} ${total === 1 ? "item" : "items"}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
