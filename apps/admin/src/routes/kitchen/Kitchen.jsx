import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "../../lib/nav";
import { KDS_STAGE_LABELS, PREP_STATION_LABELS } from "@onetap/config-schema";
import { ArrowLeft, Bell, BellOff, ChefHat, RotateCcw, Wifi, WifiOff } from "lucide-react";
import { useAuth } from "../../lib/useAuth";
import { useOutlet } from "../../lib/useOutlet";
import { useOrderStream } from "../../lib/useOrderStream";
import { useKitchenOrders, useKitchenStage } from "../../lib/useKitchen";
import { beep, unlockSound } from "../../lib/beep";
import { useMedia } from "../../lib/useMedia";

/**
 * The Kitchen Display System — /kitchen. A full-screen board for a tablet or TV in the kitchen: accepted orders arrive as
 * cards (New → Preparing → Ready), each dish shows where it is made, the cook taps Start and Ready, and a card turns
 * amber and then red the longer it waits. `?screen=kitchen` or `?screen=bar` shows just that station's dishes.
 */

const SCREENS = [
  { id: "all", label: "All" },
  { id: "kitchen", label: PREP_STATION_LABELS.kitchen },
  { id: "bar", label: "Bar" },
];
const LANES = [
  { stage: "new", title: "New" },
  { stage: "preparing", title: "Preparing" },
  { stage: "ready", title: "Ready" },
];
const SOUND_KEY = "onetap.kitchen.sound";
const CHANNEL = { "dine-in": "Dine-in", takeaway: "Takeaway", delivery: "Delivery" };

const minutesSince = (iso, now) => Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));

export function Kitchen() {
  const { outlet } = useOutlet();
  const { can } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const wide = useMedia("(min-width: 900px)");
  const screen = SCREENS.some((s) => s.id === params.get("screen")) ? params.get("screen") : "all";
  const allowed = can("order:read");

  const q = useKitchenOrders(outlet, screen, allowed);
  const stage = useKitchenStage(outlet);
  const stream = useOrderStream(outlet, allowed);
  const canTap = can("order:update");

  // a clock so the waiting times and colours move without any new data
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  // sound for new orders (remembered per device; a tap is needed once before a browser lets a page make sound)
  const [sound, setSound] = useState(() => {
    try {
      return localStorage.getItem(SOUND_KEY) !== "off";
    } catch {
      return true;
    }
  });
  useEffect(() => {
    const unlock = () => unlockSound();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);
  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    try {
      localStorage.setItem(SOUND_KEY, next ? "on" : "off");
    } catch {
      /* not remembered */
    }
    if (next) {
      unlockSound();
      beep("new");
    }
  };

  const orders = q.data?.orders ?? [];
  const settings = q.data?.settings ?? { warnAfterMinutes: 10, lateAfterMinutes: 20 };
  const seen = useRef(null);
  useEffect(() => {
    if (!q.data) return;
    const fresh = new Set(orders.filter((o) => o.stage === "new").map((o) => o.id));
    if (seen.current && sound && [...fresh].some((id) => !seen.current.has(id))) beep("new");
    seen.current = fresh;
  }, [q.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const byLane = useMemo(() => {
    const out = { new: [], preparing: [], ready: [] };
    for (const o of orders) out[o.stage]?.push(o);
    return out;
  }, [orders]);

  const [lane, setLane] = useState("new"); // narrow screens show one lane at a time
  const tap = (o, to) => stage.mutate({ id: o.id, screen, stage: to });

  const locked = q.error && /plan|include|feature/i.test(q.error.message ?? "");

  return (
    <div style={root} data-testid="kitchen-screen">
      <header style={bar}>
        <button type="button" onClick={() => navigate("/orders")} style={iconBtn} aria-label="Leave the kitchen display">
          <ArrowLeft size={18} />
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: 18, minWidth: 0 }}>
          <ChefHat size={19} color="var(--color-primary)" />
          <span style={{ whiteSpace: "nowrap" }}>Kitchen display</span>
          <span style={{ ...muted, fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{outlet?.config?.identity?.name || outlet?.name}</span>
        </div>
        <div role="tablist" aria-label="Which station" style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
          {SCREENS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={screen === s.id}
              data-testid={`screen-${s.id}`}
              onClick={() => setParams(s.id === "all" ? {} : { screen: s.id }, { replace: true })}
              style={{ ...chip, ...(screen === s.id ? chipOn : null) }}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={toggleSound} style={iconBtn} aria-label={sound ? "Turn the new-order sound off" : "Turn the new-order sound on"} data-testid="kitchen-sound" aria-pressed={sound}>
          {sound ? <Bell size={18} /> : <BellOff size={18} />}
        </button>
        <span style={{ ...muted, display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5 }} title={stream.status === "live" ? "Live" : stream.status === "polling" ? "Live updates are switched off by the platform — refreshing every 5 seconds" : "Reconnecting — refreshing every few seconds"}>
          {stream.status === "live" ? <Wifi size={15} color="var(--tone-success)" /> : <WifiOff size={15} color="var(--tone-warning)" />}
          {wide ? (stream.status === "live" ? "Live" : stream.status === "polling" ? "Every 5s" : "Reconnecting") : null}
        </span>
      </header>

      {!allowed ? (
        <Message title="Your role can't see the kitchen display." />
      ) : locked ? (
        <Message title="The kitchen display isn't part of this store's plan." body="Ask TablePe to switch it on." />
      ) : q.error ? (
        <Message title="Couldn't load the orders." body={q.error.message} />
      ) : q.isLoading ? (
        <Message title="Loading orders…" />
      ) : (
        <>
          {!wide ? (
            <div role="tablist" style={{ display: "flex", gap: 6, padding: "10px 12px 0" }}>
              {LANES.map((l) => (
                <button key={l.stage} type="button" role="tab" aria-selected={lane === l.stage} onClick={() => setLane(l.stage)} style={{ ...chip, flex: 1, ...(lane === l.stage ? chipOn : null) }}>
                  {l.title} · {byLane[l.stage].length}
                </button>
              ))}
            </div>
          ) : null}
          <div style={wide ? board : { ...board, display: "block" }}>
            {LANES.filter((l) => wide || l.stage === lane).map((l) => (
              <section key={l.stage} style={laneBox} data-testid={`lane-${l.stage}`} aria-label={l.title}>
                <h2 style={laneHead}>
                  {l.title} <span style={countPill}>{byLane[l.stage].length}</span>
                </h2>
                <div style={laneBody}>
                  {byLane[l.stage].map((o) => (
                    <Card key={o.id} o={o} screen={screen} now={now} settings={settings} canTap={canTap} busy={stage.isPending} onTap={tap} />
                  ))}
                  {byLane[l.stage].length === 0 ? <p style={{ ...muted, textAlign: "center", margin: "28px 0" }}>{l.stage === "new" ? "No new orders" : "Nothing here"}</p> : null}
                </div>
              </section>
            ))}
          </div>
          {stage.error ? <p style={errBar} role="alert">{stage.error.message}</p> : null}
        </>
      )}
    </div>
  );
}

function Card({ o, screen, now, settings, canTap, busy, onTap }) {
  const waited = minutesSince(o.acceptedAt, now);
  const late = o.stage !== "ready" && waited >= settings.lateAfterMinutes;
  const warn = o.stage !== "ready" && !late && waited >= settings.warnAfterMinutes;
  const tone = late ? "var(--tone-danger)" : warn ? "var(--tone-warning)" : "var(--color-border)";
  const where = o.tableNumber ? `Table ${o.tableNumber}` : CHANNEL[o.channel] ?? o.channel;
  const multi = screen === "all" && o.stations.length > 1;
  return (
    <article style={{ ...card, borderColor: tone, boxShadow: late || warn ? `0 0 0 2px ${tone}` : "none" }} data-testid="kitchen-card" data-order={o.orderNumber} data-tone={late ? "late" : warn ? "warn" : "ok"}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <strong style={{ fontSize: 20 }}>#{o.orderNumber}</strong>
        <span style={{ fontWeight: 700, fontSize: 15 }}>{where}</span>
        <span style={{ marginLeft: "auto", fontWeight: 800, fontVariantNumeric: "tabular-nums", color: late ? "var(--tone-danger)" : warn ? "var(--tone-warning)" : "var(--color-text-muted)" }} data-testid="kitchen-wait">
          {o.stage === "ready" ? "Ready" : `${waited} min`}
        </span>
      </div>
      {o.channel !== "dine-in" || o.customerName || o.scheduledFor ? (
        <div style={{ ...muted, fontSize: 12.5, marginTop: 2 }}>
          {o.tableNumber ? "" : CHANNEL[o.channel] ?? ""}
          {o.customerName ? `${o.tableNumber ? "" : " · "}${o.customerName}` : ""}
          {o.scheduledFor ? ` · pickup ${new Date(o.scheduledFor).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}
        </div>
      ) : null}
      <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 7 }}>
        {o.lines.map((l, i) => (
          <li key={i} style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
            <span style={qty}>{l.quantity}×</span>
            <span style={{ minWidth: 0 }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>{l.name}</span>
              {l.variantLabel ? <span style={muted}> · {l.variantLabel}</span> : null}
              {screen === "all" && o.stations.length > 1 ? <span style={{ ...stationTag, ...(l.station === "bar" ? stationBar : null) }}>{l.station === "bar" ? "Bar" : "Kitchen"}</span> : null}
              {l.modifiers.length ? <div style={{ fontSize: 13.5, color: "var(--color-text)" }}>+ {l.modifiers.join(", ")}</div> : null}
              {l.note ? <div style={noteStyle}>“{l.note}”</div> : null}
            </span>
          </li>
        ))}
      </ul>
      {o.note ? <div style={{ ...noteStyle, marginTop: 8 }}>Order note: “{o.note}”</div> : null}
      {multi ? (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
          {o.stations.map((s) => (
            <span key={s.station} style={{ ...progress, ...(s.stage === "ready" ? progressDone : null) }}>
              {s.station === "bar" ? "Bar" : "Kitchen"}: {KDS_STAGE_LABELS[s.stage].toLowerCase()}
            </span>
          ))}
        </div>
      ) : null}
      {canTap ? (
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          {o.stage === "new" ? (
            <button type="button" style={{ ...actBtn, ...startBtn }} disabled={busy} onClick={() => onTap(o, "preparing")} data-testid="kitchen-start">
              Start
            </button>
          ) : null}
          {o.stage === "preparing" || o.stage === "new" ? (
            <button type="button" style={{ ...actBtn, ...readyBtn, ...(o.stage === "new" ? { flex: "0 0 38%" } : null) }} disabled={busy} onClick={() => onTap(o, "ready")} data-testid="kitchen-ready">
              Ready ✓
            </button>
          ) : null}
          {o.stage === "ready" ? (
            <button type="button" style={{ ...actBtn, ...recallBtn }} disabled={busy} onClick={() => onTap(o, "preparing")} data-testid="kitchen-recall">
              <RotateCcw size={15} /> Recall
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function Message({ title, body }) {
  return (
    <div style={{ flex: 1, display: "grid", placeItems: "center", textAlign: "center", padding: 24 }}>
      <div>
        <strong style={{ fontSize: 18 }}>{title}</strong>
        {body ? <p style={{ ...muted, margin: "6px 0 0" }}>{body}</p> : null}
      </div>
    </div>
  );
}

const muted = { color: "var(--color-text-muted)" };
const root = { position: "fixed", inset: 0, zIndex: 60, display: "flex", flexDirection: "column", background: "var(--color-bg)", color: "var(--color-text)" };
const bar = { display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", paddingTop: "calc(10px + env(safe-area-inset-top))", borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)", flexWrap: "wrap" };
const iconBtn = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: 12, border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)", cursor: "pointer", flexShrink: 0 };
const chip = { minHeight: 40, padding: "0 16px", borderRadius: 999, border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)", font: "inherit", fontWeight: 700, fontSize: 14, cursor: "pointer" };
const chipOn = { background: "var(--color-text)", color: "var(--color-bg)", borderColor: "var(--color-text)" };
const board = { flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, padding: 12, overflow: "hidden" };
const laneBox = { display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0, background: "color-mix(in srgb, var(--color-surface) 70%, var(--color-bg))", border: "1px solid var(--color-border)", borderRadius: 16, overflow: "hidden" };
const laneHead = { margin: 0, padding: "12px 14px", fontSize: 15, fontWeight: 800, letterSpacing: 0.3, textTransform: "uppercase", borderBottom: "1px solid var(--color-border)", display: "flex", alignItems: "center", gap: 8 };
const countPill = { display: "inline-grid", placeItems: "center", minWidth: 24, height: 24, padding: "0 7px", borderRadius: 99, background: "var(--color-text)", color: "var(--color-bg)", fontSize: 13 };
const laneBody = { flex: 1, minHeight: 0, overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 10 };
const card = { background: "var(--color-bg)", border: "2px solid var(--color-border)", borderRadius: 14, padding: 14 };
const qty = { fontWeight: 800, fontSize: 18, minWidth: 34, fontVariantNumeric: "tabular-nums" };
const noteStyle = { marginTop: 3, padding: "3px 8px", borderRadius: 8, background: "color-mix(in srgb, var(--tone-warning) 16%, var(--color-bg))", fontSize: 13.5, fontWeight: 600, display: "inline-block" };
const stationTag = { marginLeft: 8, padding: "1px 7px", borderRadius: 99, fontSize: 11, fontWeight: 800, background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)", verticalAlign: "middle" };
const stationBar = { background: "color-mix(in srgb, var(--color-primary) 12%, var(--color-bg))" };
const progress = { padding: "3px 9px", borderRadius: 99, fontSize: 12, fontWeight: 700, border: "1px solid var(--color-border)", color: "var(--color-text-muted)" };
const progressDone = { color: "var(--tone-success)", borderColor: "var(--tone-success)" };
const actBtn = { flex: 1, minHeight: 52, borderRadius: 12, border: "none", font: "inherit", fontWeight: 800, fontSize: 17, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7 };
const startBtn = { background: "var(--color-text)", color: "var(--color-bg)" };
const readyBtn = { background: "var(--tone-success)", color: "#fff" };
const recallBtn = { background: "var(--color-surface)", color: "var(--color-text)", border: "1px solid var(--color-border)", minHeight: 44, fontSize: 14 };
const errBar = { margin: 0, padding: "8px 14px", background: "var(--tone-danger)", color: "#fff", fontWeight: 700, textAlign: "center" };
