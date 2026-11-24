import { useEffect, useRef } from "react";
import { waTextOn } from "@rasoipulse/config-schema";
import { Button, Modal } from "../../ui";

/**
 * A yes/no box for anything that removes or moves things. Enter does the main action, Esc (and the backdrop)
 * cancels. `actions` are [{ label, onClick, tone?: "danger" }] — the first is what Enter does.
 */
export function WaConfirm({ title, children, actions, onCancel, busy = false, cancelLabel = "Cancel", width = 440 }) {
  const first = useRef(null);
  const main = actions[0];
  // the latest action and state, for the one key listener below
  const latest = useRef({ main, busy });
  latest.current = { main, busy };
  useEffect(() => {
    first.current?.focus();
    const onKey = (e) => {
      if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
      // a focused button, link, box or dropdown handles Enter itself (Enter on "Cancel" cancels)
      const t = e.target;
      if (t instanceof HTMLElement && t.closest("button, a, input, select, textarea")) return;
      e.preventDefault();
      const { main: m, busy: b } = latest.current;
      if (!b && m && !m.disabled) m.onClick();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Modal onClose={onCancel} width={width} ariaLabel={title}>
      <div style={{ padding: 22 }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 19 }}>{title}</h2>
        <div style={{ fontSize: 14, lineHeight: 1.6 }}>{children}</div>
        <div style={{ display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: 8, marginTop: 18 }}>
          <Button variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          {actions
            .slice()
            .reverse()
            .map((a) => (
              <Button
                key={a.label}
                ref={a === main ? first : undefined}
                variant={a === main ? undefined : "outline"}
                onClick={a.onClick}
                disabled={busy || a.disabled}
                style={a.tone === "danger" && a === main ? { background: "var(--tone-danger)", borderColor: "var(--tone-danger)" } : undefined}
              >
                {a.label}
              </Button>
            ))}
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 11.5, color: "var(--color-text-muted)", textAlign: "right" }}>
          Enter: {main?.label} · Esc: cancel
        </p>
      </div>
    </Modal>
  );
}

/** A linked number's chip, filled with its colour. */
export function NumberChip({ label, color, online = true, size = "sm", title, children, style }) {
  const bg = color || "#455A64";
  return (
    <span
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        maxWidth: "100%",
        padding: size === "sm" ? "2px 8px" : "6px 11px",
        borderRadius: 999,
        fontSize: size === "sm" ? 11 : 12.5,
        fontWeight: 650,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        background: bg,
        color: waTextOn(bg),
        opacity: online ? 1 : 0.62,
        ...style,
      }}
    >
      {children ?? label}
      {online ? null : <span style={{ fontWeight: 500 }}>· offline</span>}
    </span>
  );
}
