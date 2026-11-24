"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { checkDelivery, formatINR, haversineKm, ORDER_TYPE_LABELS, ORDER_TYPE_STORAGE_KEY, offeredOrderTypes, startingOrderType } from "@rasoipulse/config-schema";
import { fx, StickyBar } from "@rasoipulse/ui";
import { Bike, Check, ChevronDown, LocateFixed, MapPin, ShoppingBag } from "lucide-react";
import { useUserLocation } from "@/lib/useUserLocation";

/**
 * The bar under the header on the menu page: HOW the visitor wants their order (Takeaway or Delivery) and FROM
 * WHICH outlet.
 *
 * The choice is remembered on this device and carried into checkout. For a store with several outlets the outlet
 * is a dropdown: every outlet with how far it is from the visitor and whether it delivers to them — worked out
 * from the outlet's own delivery rules with the same `checkDelivery` the checkout uses, so the two always agree.
 * The visitor's location is asked for only when they press "Use my location".
 *
 * The row of controls is pinned to the top of the screen under the header while the page scrolls; the notes that go with
 * it (why Delivery is off, whether delivery reaches the visitor) are a separate block under it and scroll away, so what
 * stays on screen is slim.
 *
 *   current   { id, slug } of the outlet being viewed
 *   outlets   every open outlet of the store: { id, slug, name, address, location, ordering, delivery }
 */

const TYPE_ICON = { takeaway: ShoppingBag, delivery: Bike };
/** the switch always shows BOTH, in this order — one an outlet doesn't offer is shown greyed out and can't be chosen */
const SWITCH_TYPES = ["takeaway", "delivery"];
const CHOICE_COOKIE = "rasoipulse_outlet_slug"; // the same cookie the "which location?" page remembers a choice in

const kmText = (km) => (km < 0.1 ? "under 0.1 km" : km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`);

/** What to say about one outlet's delivery for this visitor. `tone`: good | warn | muted */
function deliveryNote(outlet, point) {
  if (!outlet.ordering.delivery) return { tone: "muted", text: outlet.ordering.takeaway ? "Takeaway only" : "Not taking online orders" };
  if (!outlet.delivery || !outlet.location) return { tone: "muted", text: "Delivery isn't set up yet" };
  if (!point) return { tone: "muted", text: "Offers delivery — share your location to check" };
  const r = checkDelivery(outlet.location, point, outlet.delivery);
  if (r.serviceable) return { tone: "good", text: `Delivers to you · about ${r.etaMinutes} min · ${r.fee ? formatINR(r.fee) : "free delivery"}`, result: r };
  return { tone: "warn", text: `Doesn't deliver to you — ${kmText(r.distanceKm)} away, up to ${outlet.delivery.radiusKm} km`, result: r };
}

export function OrderBar({ current, outlets }) {
  const router = useRouter();
  const here = outlets.find((o) => o.id === current.id) ?? outlets[0];
  const offered = useMemo(() => offeredOrderTypes(here?.ordering), [here]);
  const location = useUserLocation();
  const [type, setType] = useState(() => startingOrderType(offered, null));
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
  const pillRef = useRef(null);

  // the visitor's remembered choice, once we're in the browser
  useEffect(() => {
    try {
      setType(startingOrderType(offered, window.localStorage.getItem(ORDER_TYPE_STORAGE_KEY)));
    } catch {
      /* private window — the first offered type */
    }
  }, [offered]);

  const choose = (next) => {
    setType(next);
    try {
      window.localStorage.setItem(ORDER_TYPE_STORAGE_KEY, next);
    } catch {
      /* not remembered */
    }
  };

  // close the dropdown on Escape or a click anywhere else
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        pillRef.current?.focus();
      }
    };
    const onDown = (e) => {
      if (!panelRef.current?.contains(e.target) && !pillRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [open]);

  const point = location.point;
  /** every outlet with its distance and delivery note, nearest first once we know where the visitor is */
  const rows = useMemo(() => {
    const list = outlets.map((o) => ({ outlet: o, km: point && o.location ? haversineKm(point, o.location) : null, note: deliveryNote(o, point) }));
    return point ? [...list].sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity)) : list;
  }, [outlets, point]);

  const goTo = (outlet) => {
    setOpen(false);
    if (outlet.id === here.id) return;
    document.cookie = `${CHOICE_COOKIE}=${encodeURIComponent(outlet.slug)}; path=/; max-age=${60 * 60 * 24 * 180}`;
    router.push(`/${outlet.slug}`);
  };

  if (!here) return null;
  const several = outlets.length > 1;
  if (!several && offered.length < 1) return null; // nothing to order online here at all

  const mine = rows.find((r) => r.outlet.id === here.id);
  const myNote = mine?.note;
  const nearestDelivering = type === "delivery" && myNote?.tone === "warn" ? rows.find((r) => r.outlet.id !== here.id && r.note.result?.serviceable) : null;

  const missing = SWITCH_TYPES.filter((t) => !offered.includes(t));

  return (
    <>
      {/* PINNED under the header while the page scrolls: only the controls — kept slim, the notes below scroll away */}
      <StickyBar name="bar" below="header" z={31} maxShare={0.14} maxPx={100}>
        <section aria-label="How would you like your order?" className="ot-fx-bar" style={fx("bar", bar)}>
          <div className="ot-page-px ot-ob-inner" style={inner}>
            <div className="ot-ob-controls" style={controls}>
              {offered.length > 0 ? (
                <div className="ot-ob-switch" style={switchWrap}>
                  <div role="group" aria-label="Order type" className="ot-ob-seg" style={segmented}>
                    {SWITCH_TYPES.map((t) => {
                      const Icon = TYPE_ICON[t];
                      const available = offered.includes(t);
                      const active = available && type === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          disabled={!available}
                          aria-pressed={active}
                          title={available ? undefined : `${ORDER_TYPE_LABELS[t]} isn't available from this outlet`}
                          onClick={() => available && choose(t)}
                          className="ot-fx-chip ot-ob-seg-btn"
                          data-unavailable={available ? undefined : "true"}
                          style={fx("chip", { ...segBtn, ...(active ? segActive : null), ...(available ? null : segOff) })}
                        >
                          <Icon size={16} aria-hidden="true" /> {ORDER_TYPE_LABELS[t]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {several ? (
                <div className="ot-ob-pill-wrap" style={{ position: "relative", flex: "1 1 240px", minWidth: 0 }}>
                  <button ref={pillRef} type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={open} className="ot-fx-chip ot-ob-pill" style={fx("chip", pill)}>
                    <MapPin size={16} aria-hidden="true" style={{ flexShrink: 0, color: "var(--color-primary)" }} />
                    <span style={pillText}>
                      <span style={pillName}>{here.name}</span>
                      {mine?.km != null ? <span style={pillKm}>{kmText(mine.km)} away</span> : null}
                    </span>
                    <ChevronDown size={16} aria-hidden="true" style={{ flexShrink: 0, transition: "transform 160ms", transform: open ? "rotate(180deg)" : "none" }} />
                  </button>

                  {open ? (
                    <div ref={panelRef} role="dialog" aria-label="Choose an outlet" className="ot-anim-drop ot-fx-modal" style={fx("modal", panel)}>
                      <div style={panelHead}>
                        <strong style={{ fontSize: 14 }}>Choose an outlet</strong>
                        {location.status === "ready" ? (
                          <button type="button" onClick={location.request} style={textBtn}>
                            <LocateFixed size={13} aria-hidden="true" /> Update my location
                          </button>
                        ) : null}
                      </div>

                      {location.status !== "ready" ? (
                        <div style={locateBox}>
                          <button type="button" onClick={location.request} disabled={location.status === "asking"} className="ot-fx-btn" style={fx("btn", locateBtn)}>
                            <LocateFixed size={15} aria-hidden="true" /> {location.status === "asking" ? "Finding you…" : "Use my location"}
                          </button>
                          <span style={hintText}>
                            {location.status === "denied"
                              ? "Location is blocked in your browser. Allow it for this site to see distances, or just pick an outlet."
                              : location.status === "unavailable"
                                ? "This browser can't share a location. Pick an outlet below."
                                : location.status === "error"
                                  ? "We couldn't get your location. Try again, or pick an outlet below."
                                  : "See how far each outlet is, and whether it delivers to you."}
                          </span>
                        </div>
                      ) : null}

                      <ul style={list}>
                        {rows.map(({ outlet, km, note }) => {
                          const isHere = outlet.id === here.id;
                          return (
                            <li key={outlet.id}>
                              <button type="button" onClick={() => goTo(outlet)} aria-current={isHere ? "true" : undefined} style={{ ...option, ...(isHere ? optionHere : null) }}>
                                <span style={{ ...radio, ...(isHere ? radioOn : null) }} aria-hidden="true">
                                  {isHere ? <Check size={11} strokeWidth={3.5} /> : null}
                                </span>
                                <span style={{ flex: 1, minWidth: 0 }}>
                                  <span style={optionTop}>
                                    <span style={optionName}>{outlet.name}</span>
                                    {km != null ? <span style={optionKm}>{kmText(km)}</span> : null}
                                  </span>
                                  {outlet.address ? <span style={optionAddress}>{outlet.address}</span> : null}
                                  <span style={{ ...chip, ...CHIP_TONE[note.tone] }}>{note.text}</span>
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </StickyBar>

      {/* the notes that go with the controls — not pinned */}
      {(offered.length > 0 && missing.length > 0) || type === "delivery" ? (
        <div className="ot-page-px" style={notes}>
          {offered.length > 0 && missing.length > 0 ? (
            <p style={offHint} data-testid="order-type-hint">
              {missing.map((t) => ORDER_TYPE_LABELS[t]).join(" and ")} isn&apos;t available from this outlet.
            </p>
          ) : null}

          {type === "delivery" ? (
            <p role="status" style={{ ...status, ...STATUS_TONE[myNote?.tone ?? "muted"] }}>
              <span>
                {myNote?.tone === "muted" && !point && here.delivery ? (
                  <>
                    {here.name} offers delivery.{" "}
                    <button type="button" onClick={location.request} disabled={location.status === "asking"} style={inlineBtn}>
                      {location.status === "asking" ? "Finding you…" : "Use my location"}
                    </button>{" "}
                    to check it reaches you{location.status === "denied" ? " (your browser is blocking location — you can still enter your address at checkout)" : ""}.
                  </>
                ) : (
                  `${myNote?.tone === "good" ? "✓ " : ""}${here.name}: ${myNote?.text ?? ""}`
                )}
              </span>
              {nearestDelivering ? (
                <button type="button" onClick={() => goTo(nearestDelivering.outlet)} style={inlineBtn}>
                  {nearestDelivering.outlet.name} delivers to you — switch
                </button>
              ) : null}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------- styles */

const bar = { background: "var(--color-bg)", borderBottom: "1px solid var(--color-border)" };
const inner = { maxWidth: 1080, margin: "0 auto", padding: "12px 18px", display: "flex", flexDirection: "column", gap: 10 };
// the notes under the pinned controls: same width and edge as the bar above them
const notes = { maxWidth: 1080, margin: "0 auto", padding: "10px 18px 0", display: "flex", flexDirection: "column", gap: 8, boxSizing: "border-box" };
const controls = { display: "flex", flexWrap: "wrap", alignItems: "stretch", gap: 10 };
// fills the row on a phone (it wraps onto its own line there); stays a compact switch on a wide screen
const switchWrap = { flex: "1 1 260px", maxWidth: 360, display: "flex", flexDirection: "column", gap: 6 };
const segmented = { display: "flex", gap: 6, padding: 4, borderRadius: 14, background: "var(--color-surface)", border: "1px solid var(--color-border)" };
// an order type this outlet doesn't offer: visible, but plainly off
const segOff = { opacity: 0.45, cursor: "not-allowed", background: "transparent", color: "var(--color-text-muted)", boxShadow: "none" };
const offHint = { margin: 0, fontSize: 12.5, lineHeight: 1.4, color: "var(--color-text-muted)" };
const segBtn = {
  font: "inherit",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  flex: "1 1 0",
  minHeight: 40,
  padding: "0 18px",
  borderRadius: 10,
  border: "none",
  background: "transparent",
  color: "var(--color-text)",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
};
const segActive = { background: "var(--color-primary)", color: "var(--color-on-primary)", boxShadow: "0 2px 8px color-mix(in srgb, var(--color-primary) 35%, transparent)" };
const pill = {
  font: "inherit",
  width: "100%",
  minHeight: 48,
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "0 14px",
  borderRadius: 14,
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  color: "var(--color-text)",
  textAlign: "left",
  cursor: "pointer",
};
const pillText = { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", lineHeight: 1.25 };
const pillName = { fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const pillKm = { fontSize: 12, color: "var(--color-text-muted)" };
const panel = {
  position: "absolute",
  zIndex: 45,
  top: "calc(100% + 8px)",
  right: 0,
  width: "min(430px, calc(100vw - 28px))",
  maxHeight: "min(70vh, 560px)",
  display: "flex",
  flexDirection: "column",
  borderRadius: 16,
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  boxShadow: "0 18px 50px rgba(0,0,0,0.22)",
  overflow: "hidden",
};
const panelHead = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "14px 16px 10px" };
const textBtn = { font: "inherit", display: "inline-flex", alignItems: "center", gap: 5, border: 0, background: "transparent", color: "var(--color-primary)", fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: 0 };
const locateBox = { margin: "0 16px 10px", padding: 12, borderRadius: 12, background: "var(--color-surface)", display: "flex", flexDirection: "column", gap: 8 };
const locateBtn = { font: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 40, padding: "0 16px", borderRadius: 10, border: "none", background: "var(--color-primary)", color: "var(--color-on-primary)", fontSize: 13.5, fontWeight: 700, cursor: "pointer" };
const hintText = { fontSize: 12.5, lineHeight: 1.45, color: "var(--color-text-muted)" };
const list = { listStyle: "none", margin: 0, padding: "2px 8px 10px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 };
const option = { font: "inherit", width: "100%", display: "flex", alignItems: "flex-start", gap: 12, textAlign: "left", padding: "11px 10px", borderRadius: 12, border: "1px solid transparent", background: "transparent", color: "var(--color-text)", cursor: "pointer" };
const optionHere = { background: "color-mix(in srgb, var(--color-primary) 8%, var(--color-bg))", border: "1px solid color-mix(in srgb, var(--color-primary) 30%, var(--color-border))" };
const radio = { flexShrink: 0, width: 18, height: 18, marginTop: 2, borderRadius: 999, border: "1.5px solid var(--color-border)", display: "grid", placeItems: "center", color: "var(--color-on-primary)" };
const radioOn = { background: "var(--color-primary)", border: "1.5px solid var(--color-primary)" };
const optionTop = { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 };
const optionName = { fontSize: 14.5, fontWeight: 700, overflowWrap: "anywhere" };
const optionKm = { fontSize: 12.5, fontWeight: 700, color: "var(--color-text)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" };
const optionAddress = { display: "block", marginTop: 2, fontSize: 12.5, lineHeight: 1.4, color: "var(--color-text-muted)" };
const chip = { display: "inline-block", marginTop: 7, padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600, lineHeight: 1.4 };
const CHIP_TONE = {
  good: { background: "var(--tone-success-wash)", color: "var(--tone-success)" },
  warn: { background: "var(--tone-warning-wash)", color: "var(--tone-warning)" },
  muted: { background: "var(--color-surface)", color: "var(--color-text-muted)", border: "1px solid var(--color-border)" },
};
const status = { margin: 0, padding: "9px 12px", borderRadius: 10, fontSize: 13, lineHeight: 1.5, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "4px 14px" };
const STATUS_TONE = {
  good: { background: "var(--tone-success-wash)", color: "var(--tone-success)" },
  warn: { background: "var(--tone-warning-wash)", color: "var(--tone-warning)" },
  muted: { background: "var(--color-surface)", color: "var(--color-text-muted)" },
};
const inlineBtn = { font: "inherit", border: 0, background: "transparent", color: "inherit", fontWeight: 700, textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer", padding: 0 };
