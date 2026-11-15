import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Ban, LogOut, RefreshCw } from "lucide-react";
import { useLogout } from "../lib/useAuth";
import { Button } from "../ui";

const since = (at) => (at ? new Date(at).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" }) : "");

/**
 * What a store's team sees while TablePe has switched their store off (a late or missing payment, say) —
 * instead of a dashboard full of errors. It says plainly what is and isn't affected, shows the message TablePe
 * left for them, and lets them check again once things are sorted out.
 */
export function StoreDisabled({ user }) {
  const logout = useLogout();
  const qc = useQueryClient();
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);
  const { storeName, message, at } = user.storeDisabled;

  const check = async () => {
    setChecking(true);
    setChecked(false);
    // if TablePe has switched the store back on, the app notices and opens the dashboard by itself
    await qc.invalidateQueries({ queryKey: ["me"] });
    setChecking(false);
    setChecked(true);
  };

  return (
    <main style={page}>
      <div style={card}>
        <div style={iconWrap} aria-hidden="true">
          <Ban size={26} />
        </div>
        <h1 style={title}>{storeName ? `${storeName} is disabled` : "Your store is disabled"}</h1>
        <p style={lead}>
          TablePe has switched this store off{at ? ` (since ${since(at)})` : ""}. Customers can&apos;t place orders and your team can&apos;t use the dashboard until it&apos;s turned back on.
        </p>

        {message ? (
          <div style={messageBox} role="note">
            <div style={messageLabel}>Message from TablePe</div>
            <div style={messageText}>{message}</div>
          </div>
        ) : (
          <p style={{ ...lead, color: "var(--color-text)", fontWeight: 600 }}>Please contact TablePe to turn your store back on.</p>
        )}

        <p style={reassure}>Nothing has been deleted — your menu, orders, customers and settings are exactly as you left them, and will be waiting the moment the store is back on.</p>

        <div style={actions}>
          {/* full-size buttons: this is the screen a store owner is most likely to meet on their phone */}
          <Button size="md" onClick={check} disabled={checking} style={btn}>
            <RefreshCw size={15} className={checking ? "ot-spin" : undefined} /> {checking ? "Checking…" : "Check again"}
          </Button>
          <Button size="md" variant="outline" onClick={() => logout.mutate()} style={btn}>
            <LogOut size={15} /> Sign out
          </Button>
        </div>
        {checked ? (
          <p role="status" style={status}>
            Checked just now — the store is still disabled.
          </p>
        ) : null}
      </div>
    </main>
  );
}

const page = { minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "var(--color-surface)" };
const card = {
  width: "100%",
  maxWidth: 460,
  textAlign: "center",
  background: "var(--color-bg)",
  border: "1px solid var(--color-border)",
  borderRadius: 14,
  padding: "30px 28px 26px",
};
const iconWrap = {
  display: "grid",
  placeItems: "center",
  width: 52,
  height: 52,
  margin: "0 auto 14px",
  borderRadius: 999,
  background: "var(--tone-danger-wash)",
  color: "var(--tone-danger)",
};
const title = { fontSize: 21, margin: "0 0 8px", textWrap: "balance" };
const lead = { color: "var(--color-text-muted)", fontSize: 14, lineHeight: 1.55, margin: "0 0 16px" };
const messageBox = {
  textAlign: "left",
  margin: "0 0 16px",
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
};
const messageLabel = { fontSize: 11.5, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: 5 };
const messageText = { fontSize: 14, lineHeight: 1.55, color: "var(--color-text)", whiteSpace: "pre-wrap", overflowWrap: "anywhere" };
const reassure = { color: "var(--color-text-muted)", fontSize: 12.5, lineHeight: 1.55, margin: "0 0 20px" };
const actions = { display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" };
const btn = { display: "inline-flex", gap: 6, alignItems: "center" };
const status = { margin: "14px 0 0", fontSize: 12.5, color: "var(--color-text-muted)" };
