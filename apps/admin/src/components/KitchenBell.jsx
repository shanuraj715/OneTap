import { useEffect, useState } from "react";
import { useLocation } from "../lib/nav";
import { PREP_STATION_LABELS } from "@rasoipulse/config-schema";
import { Bell, X } from "lucide-react";
import { useAuth } from "../lib/useAuth";
import { useOutlet } from "../lib/useOutlet";
import { useOrderStream } from "../lib/useOrderStream";
import { useStorePlan } from "../lib/useStorePlan";
import { beep, unlockSound } from "../lib/beep";

/**
 * The waiter's bell. When the store has switched "tell the waiter" on (Settings → Kitchen & delivery → Kitchen display), a
 * short sound and a card appear on whatever page the waiter is on as soon as the kitchen marks a dish or an order ready:
 * "Table 4 — Order #123: Kitchen ready". Off unless the owner turns it on; the server only sends the event then too.
 */
const SHOW_MS = 20_000;
const CHANNEL = { "dine-in": "Dine-in", takeaway: "Takeaway", delivery: "Delivery" };

export function KitchenBell() {
  const { outlet } = useOutlet();
  const { can } = useAuth();
  const { hasFeature } = useStorePlan();
  const { pathname } = useLocation();
  const on = Boolean(outlet?.config?.kitchenDisplay?.notifyWaiter) && hasFeature("kitchenDisplay") && can("order:create");
  const onKitchenScreen = pathname.startsWith("/kitchen");
  const stream = useOrderStream(outlet, on && !onKitchenScreen);
  const [cards, setCards] = useState([]);

  // browsers allow sound only after one touch of the page
  useEffect(() => {
    if (!on) return undefined;
    const unlock = () => unlockSound();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, [on]);

  const ev = stream.lastReady;
  useEffect(() => {
    if (!ev || !on || onKitchenScreen) return undefined;
    setCards((list) => [...list.filter((c) => c.seq !== ev.seq), { ...ev }].slice(-4));
    beep("ready");
    const t = setTimeout(() => setCards((list) => list.filter((c) => c.seq !== ev.seq)), SHOW_MS);
    return () => clearTimeout(t);
  }, [ev?.seq]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!on || cards.length === 0) return null;
  return (
    <div style={stack} aria-live="polite" data-testid="kitchen-bell">
      {cards.map((c) => {
        const where = c.tableNumber ? `Table ${c.tableNumber}` : CHANNEL[c.channel] ?? c.channel;
        const what = c.orderReady ? "Ready" : `${(c.stations ?? []).map((s) => PREP_STATION_LABELS[s]?.split(" ")[0] ?? s).join(" + ")} ready`;
        return (
          <div key={c.seq} style={card} role="status" data-testid="kitchen-bell-card">
            <Bell size={18} color="var(--color-primary)" style={{ flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <strong style={{ display: "block" }}>
                {where} — Order #{c.orderNumber}
              </strong>
              <span style={{ fontSize: 13.5 }}>{c.orderReady ? "Everything is ready — take it out." : `${what} — the rest is still being made.`}</span>
            </div>
            <button type="button" onClick={() => setCards((list) => list.filter((x) => x.seq !== c.seq))} style={close} aria-label="Dismiss">
              <X size={15} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

const stack = { position: "fixed", right: 14, bottom: 14, zIndex: 120, display: "flex", flexDirection: "column", gap: 8, width: "min(360px, calc(100vw - 28px))" };
const card = { display: "flex", alignItems: "center", gap: 10, padding: "12px 12px 12px 14px", borderRadius: 14, background: "var(--color-bg)", color: "var(--color-text)", border: "1px solid var(--color-primary)", boxShadow: "0 10px 30px rgba(0,0,0,0.22)" };
const close = { marginLeft: "auto", width: 30, height: 30, display: "inline-grid", placeItems: "center", borderRadius: 8, border: "none", background: "transparent", color: "var(--color-text-muted)", cursor: "pointer", flexShrink: 0 };
