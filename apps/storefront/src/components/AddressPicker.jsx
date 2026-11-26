"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatINR } from "@rasoipulse/config-schema";

import { fx } from "@rasoipulse/ui";
import { api, apiDelete, getApiBase } from "@/lib/clientApi";
import { DeliveryMap } from "./DeliveryMap";

/* -------------------------------------------------------------------- icons */

const Pin = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);
const Navigation = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <polygon points="3 11 22 2 13 21 11 13 3 11" />
  </svg>
);
const Check = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const Alert = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);
const Spinner = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden style={{ animation: "rasoipulse-spin 0.8s linear infinite" }}>
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

/* ----------------------------------------------------------------- component */

/**
 * Where should the delivery go? A (free) map with the PIN FIXED in the middle: the customer moves the map under it (one finger drags, two
 * fingers pinch to zoom) until the pin is on their door — or presses "Use my current location". From that pin the server measures the distance
 * to the restaurant, says whether it delivers there and what it costs. They then type the address in words (flat, street, area) and an
 * optional landmark for the rider.
 *
 * Where the map STARTS: (1) the place the customer last had food delivered from THIS outlet (saved by the server when they order; the address
 * they typed comes with it), (2) their own location, if they have already allowed it for this site, (3) the restaurant. In (1) and (2) the pin
 * counts as chosen straight away; in (3) it only counts once they have moved the map (a pin left on the restaurant is not a delivery place).
 *
 * Nothing is handed up to checkout (`onChange(null, …)`) until there is a chosen pin inside the delivery area AND an address, so the order can't
 * be placed without a place on the map. The third argument says whether a pin has been chosen yet (so the button can say what is missing).
 */
export function AddressPicker({ outletId, subtotal, onChange }) {
  const [origin, setOrigin] = useState(null); // the restaurant's place and how far it delivers
  const [loc, setLoc] = useState("idle"); // idle | locating | denied | unsupported
  const [view, setView] = useState(null); // where the map was sent from outside: { lat, lng, zoom, key }
  const [point, setPoint] = useState(null); // the chosen place: { lat, lng, source: "saved" | "phone" | "map", accuracy? }
  const [address, setAddress] = useState("");
  const [landmark, setLandmark] = useState("");
  const [saved, setSaved] = useState(null); // the place saved for this outlet, when it was used
  const [quote, setQuote] = useState(null);
  const [checking, setChecking] = useState(false);
  const latest = useRef(0); // only the newest answer counts when the map is moved quickly
  const text = useRef({ address: "", landmark: "" }); // what is typed now (the map's handlers must not see an old copy)
  text.current = { address, landmark };

  useEffect(() => {
    if (typeof navigator !== "undefined" && !navigator.geolocation) setLoc("unsupported");
    // a fresh picker has no pin: whatever address checkout still held from an earlier visit is cleared, so an order can never go out
    // with a place the customer can no longer see on the map
    onChange(null, null, { pinned: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- ask the server: how far is this pin, do we deliver there, what does it cost? ---- */
  const check = useCallback(
    async (p) => {
      const mine = ++latest.current;
      setChecking(true);
      try {
        const res = await fetch(`${getApiBase()}/api/delivery/check`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ outletId, lat: p.lat, lng: p.lng, subtotal }),
        });
        const q = await res.json();
        if (mine === latest.current) setQuote(res.ok ? q : null);
        return res.ok ? q : null;
      } catch {
        if (mine === latest.current) setQuote(null);
        return null;
      } finally {
        if (mine === latest.current) setChecking(false);
      }
    },
    [outletId, subtotal],
  );

  /* ---- hand the completed address up to checkout ---- */
  const publish = useCallback(
    (p, addr, land, q) => {
      const ready = p && q?.serviceable && addr.trim().length >= 4;
      onChange(ready ? { text: addr.trim(), landmark: land.trim() || undefined, lat: p.lat, lng: p.lng } : null, q, { pinned: Boolean(p) });
    },
    [onChange],
  );

  /** Choose this place (from the map, a saved place or the phone) and measure it. */
  const choose = useCallback(
    async (p, typed = text.current) => {
      setPoint(p);
      const q = await check(p);
      publish(p, typed.address, typed.landmark, q);
    },
    [check, publish],
  );

  /* ---- where the map starts ---- */
  useEffect(() => {
    let dead = false;
    const start = async () => {
      const [o, s] = await Promise.all([
        fetch(`${getApiBase()}/api/delivery/origin?outletId=${encodeURIComponent(outletId)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetchSaved(outletId),
      ]);
      if (dead) return;
      if (o?.point) setOrigin({ point: o.point, radiusKm: o.radiusKm ?? 0 });
      // (1) the place they last had food delivered from this outlet, with the address they typed then
      if (s) {
        setSaved(s);
        setAddress(s.text);
        setLandmark(s.landmark);
        setView({ lat: s.lat, lng: s.lng, zoom: 17, key: 1 });
        await choose({ lat: s.lat, lng: s.lng, source: "saved" }, { address: s.text, landmark: s.landmark });
        return;
      }
      // (2) their own location — only when they have ALREADY allowed it for this site (we never pop the question up on our own)
      try {
        const perm = await navigator.permissions?.query({ name: "geolocation" });
        if (perm?.state === "granted" && !dead) locate(true);
      } catch { /* no Permissions API: stay on the restaurant until they press the button */ }
    };
    void start();
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outletId]);

  /* ---- the phone's own location: put the pin there, and the map with it ---- */
  const locate = (quiet = false) => {
    if (!navigator.geolocation) {
      setLoc("unsupported");
      return;
    }
    setLoc("locating");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setLoc("idle");
        const p = { lat: Math.round(pos.coords.latitude * 1e6) / 1e6, lng: Math.round(pos.coords.longitude * 1e6) / 1e6, source: "phone", accuracy: pos.coords.accuracy };
        setView((v) => ({ lat: p.lat, lng: p.lng, zoom: 17, key: (v?.key ?? 0) + 1 }));
        await choose(p);
      },
      (err) => setLoc(quiet ? "idle" : err.code === err.PERMISSION_DENIED ? "denied" : "idle"),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  };

  /* ---- the customer moved the map: the place under the pin is the new one ---- */
  const moved = (p) => { void choose({ ...p, source: "map" }); };

  const forgetSaved = async () => {
    setSaved(null);
    try { await apiDelete(`/api/customer/address?outletId=${encodeURIComponent(outletId)}`); } catch { /* it is only a convenience: the pin and the address stay as they are */ }
  };

  /* ---- the cart total changed (free delivery above a limit): ask again for the same pin ---- */
  const firstSubtotal = useRef(subtotal);
  useEffect(() => {
    if (!point || subtotal === firstSubtotal.current) return;
    firstSubtotal.current = subtotal;
    check(point).then((q) => publish(point, address, landmark, q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal]);

  /* -------------------------------------------------------------------- view */

  return (
    <div style={{ marginTop: 10 }} data-testid="address-picker">
      <style>{`@keyframes rasoipulse-spin { to { transform: rotate(360deg); } }`}</style>

      <label style={{ ...label, marginTop: 0, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ display: "inline-flex", color: "var(--color-text-muted)" }}>
          <Pin size={13} />
        </span>
        Choose your location on the map
        <span style={requiredTag}>Required</span>
      </label>

      <DeliveryMap origin={origin} view={view} onMove={moved} />

      <button type="button" className="ot-fx-chip" style={{ ...fx("chip", shareBtn), marginTop: 10 }} onClick={() => locate(false)} disabled={loc === "locating" || loc === "unsupported"} data-testid="delivery-use-location">
        <span style={{ display: "inline-flex" }}>{loc === "locating" ? <Spinner /> : <Navigation />}</span>
        {loc === "locating" ? "Getting your location…" : "Use my current location"}
      </button>

      {loc === "denied" ? (
        <div style={noteBox}>
          <span style={{ display: "inline-flex", flexShrink: 0, color: "var(--tone-warning)" }}>
            <Alert size={14} />
          </span>
          <span>Location access is blocked for this site. You can still move the map to put the pin on your door.</span>
        </div>
      ) : null}
      {loc === "unsupported" ? (
        <div style={noteBox}>
          <span style={{ display: "inline-flex", flexShrink: 0, color: "var(--tone-warning)" }}>
            <Alert size={14} />
          </span>
          <span>This browser can&apos;t share a location. Move the map to put the pin on your door.</span>
        </div>
      ) : null}

      {!point ? (
        <div style={noteBox} data-testid="delivery-pin-missing">
          <span style={{ display: "inline-flex", flexShrink: 0, color: "var(--tone-warning)" }}>
            <Alert size={14} />
          </span>
          <span>
            <strong>Move the map so the pin is on your door.</strong> We use it to measure the distance, check that we deliver to you and work out the delivery charge.
          </span>
        </div>
      ) : (
        <div style={capturedChip} data-testid="delivery-pin-set">
          <span style={{ display: "inline-flex", flexShrink: 0 }}>
            <Check size={14} />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ display: "block" }}>
              {point.source === "saved" && saved ? "Your saved place for this outlet" : point.source === "phone" ? "Your current location" : "Location chosen on the map"}
            </strong>
            <span style={{ fontSize: 11.5, opacity: 0.8 }}>
              Not quite right? Move the map to put the pin exactly on your door{point.accuracy ? ` · phone location accurate to ~${Math.round(point.accuracy)} m` : ""}.
            </span>
          </span>
          {saved ? (
            <button type="button" onClick={forgetSaved} style={reshareBtn} data-testid="delivery-forget-saved">
              Forget it
            </button>
          ) : null}
        </div>
      )}

      {/* --- serviceability result: the distance from the chosen pin --- */}
      {checking ? (
        <p style={hint}>
          <span style={{ display: "inline-flex", verticalAlign: "-2px", marginRight: 5 }}>
            <Spinner size={12} />
          </span>
          Measuring the distance from your pin…
        </p>
      ) : null}

      {quote && point && !checking ? (
        quote.serviceable ? (
          <div style={okBox} data-testid="delivery-quote">
            <span style={{ display: "inline-flex", flexShrink: 0, marginTop: 1 }}>
              <Check size={14} />
            </span>
            <span>
              <strong style={{ display: "block" }}>We deliver here</strong>
              <span data-testid="delivery-distance">{quote.distanceKm} km</span> from the restaurant · {quote.fee === 0 ? "Free delivery" : `${formatINR(quote.fee)} delivery`} · about {quote.etaMinutes} min
              <span style={{ display: "block", fontSize: 11.5, opacity: 0.8 }}>Distance is measured in a straight line from your pin.</span>
            </span>
          </div>
        ) : (
          <div style={badBox} data-testid="delivery-quote">
            <span style={{ display: "inline-flex", flexShrink: 0, marginTop: 1 }}>
              <Alert size={14} />
            </span>
            <span>
              <strong style={{ display: "block" }}>Delivery not available at this pin</strong>
              {quote.reason ?? `Outside the ${quote.radiusKm} km delivery area.`} Move the map so the pin is closer, or choose takeaway.
            </span>
          </div>
        )
      ) : null}

      {/* --- typed address --- */}
      <label style={label}>Delivery address</label>
      <textarea
        className="ot-fx-input"
        style={{ ...fx("input", input), minHeight: 60, resize: "vertical" }}
        value={address}
        onChange={(e) => {
          setAddress(e.target.value);
          publish(point, e.target.value, landmark, quote);
        }}
        placeholder="Flat / house no, building, street, area"
        data-testid="delivery-address"
      />

      <label style={label}>Landmark (optional)</label>
      <input
        className="ot-fx-input"
        style={fx("input", input)}
        value={landmark}
        onChange={(e) => {
          setLandmark(e.target.value);
          publish(point, address, e.target.value, quote);
        }}
        placeholder="e.g. opposite the metro gate 3"
        data-testid="delivery-landmark"
      />
    </div>
  );
}

/** The place this customer last had food delivered from this outlet, or null (never ordered, not signed in, or the request failed). */
async function fetchSaved(outletId) {
  try {
    const r = await api(`/api/customer/address?outletId=${encodeURIComponent(outletId)}`);
    const a = r?.address;
    return a && typeof a.lat === "number" && typeof a.lng === "number" ? { lat: a.lat, lng: a.lng, text: a.text ?? "", landmark: a.landmark ?? "" } : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------- styles */

const input = {
  width: "100%",
  font: "inherit",
  fontSize: 14,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-text)",
};
const label = { display: "block", fontSize: 12.5, fontWeight: 600, marginTop: 14, marginBottom: 5 };
const requiredTag = { marginLeft: "auto", fontSize: 10.5, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase", color: "var(--tone-danger)" };
const hint = { fontSize: 12.5, color: "var(--color-text-muted)", margin: "8px 0 0", lineHeight: 1.5 };
const shareBtn = {
  width: "100%",
  font: "inherit",
  fontSize: 13.5,
  fontWeight: 600,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "11px 16px",
  borderRadius: 10,
  border: "1.5px solid var(--color-primary)",
  background: "color-mix(in srgb, var(--color-primary) 8%, var(--color-bg))",
  color: "var(--color-primary-text, var(--color-primary))",
  cursor: "pointer",
};
const capturedChip = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 13px",
  borderRadius: 10,
  background: "var(--tone-success-wash)",
  color: "var(--tone-success)",
  fontSize: 12.5,
};
const reshareBtn = {
  font: "inherit",
  fontSize: 12,
  fontWeight: 600,
  padding: "5px 11px",
  borderRadius: 999,
  border: "1px solid currentColor",
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
  flexShrink: 0,
};
const noteBox = {
  display: "flex",
  gap: 8,
  marginTop: 10,
  padding: "10px 12px",
  borderRadius: 10,
  background: "var(--tone-warning-wash)",
  color: "var(--color-text)",
  fontSize: 12,
  lineHeight: 1.5,
};
const okBox = {
  display: "flex",
  gap: 8,
  marginTop: 12,
  padding: "10px 13px",
  borderRadius: 10,
  background: "var(--tone-success-wash)",
  color: "var(--tone-success)",
  fontSize: 12.5,
  lineHeight: 1.5,
};
const badBox = {
  display: "flex",
  gap: 8,
  marginTop: 12,
  padding: "10px 13px",
  borderRadius: 10,
  background: "var(--tone-danger-wash)",
  color: "var(--tone-danger)",
  fontSize: 12.5,
  lineHeight: 1.5,
};
