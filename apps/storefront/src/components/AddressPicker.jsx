"use client";

import { useCallback, useEffect, useState } from "react";
                                           
import { formatINR } from "@onetap/config-schema";

import { getApiBase } from "@/lib/clientApi";

                                  
               
                    
              
              
 

                                
                       
                     
              
                     
                   
                  
 

/* -------------------------------------------------------------------- icons */

const Pin = ({ size = 16 }                   ) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);
const Navigation = ({ size = 15 }                   ) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <polygon points="3 11 22 2 13 21 11 13 3 11" />
  </svg>
);
const Check = ({ size = 15 }                   ) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const Alert = ({ size = 15 }                   ) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);
const Spinner = ({ size = 15 }                   ) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden style={{ animation: "onetap-spin 0.8s linear infinite" }}>
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

/* ----------------------------------------------------------------- component */

                                                                            

/**
 * Ask the customer to share their location for delivery.
 *
 * No map — the browser's own geolocation gives us the coordinates directly.
 * The customer then types the human-readable address (flat, street, area) and
 * an optional landmark. The captured pin is shown as a chip, never as an
 * editable latitude/longitude field.
 */
export function AddressPicker({
  outletId,
  subtotal,
  onChange,
}   
                   
                                                                                 
                   
                                                                                   
 ) {
  const [loc, setLoc] = useState          ("idle");
  const [point, setPoint] = useState                                                        (null);
  const [address, setAddress] = useState("");
  const [landmark, setLandmark] = useState("");
  const [quote, setQuote] = useState                      (null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (typeof navigator !== "undefined" && !navigator.geolocation) setLoc("unsupported");
  }, []);

  /* ---- check the shared point against the delivery area ---- */
  const check = useCallback(
    async (p                              ) => {
      setChecking(true);
      try {
        const res = await fetch(`${getApiBase()}/api/delivery/check`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ outletId, lat: p.lat, lng: p.lng, subtotal }),
        });
        const q = (await res.json())                 ;
        setQuote(q);
        return q;
      } catch {
        setQuote(null);
        return null;
      } finally {
        setChecking(false);
      }
    },
    [outletId, subtotal],
  );

  /* ---- hand the completed address up to checkout ---- */
  const publish = useCallback(
    (p                                     , addr        , land        , q                      ) => {
      const ready = p && q?.serviceable && addr.trim().length >= 4;
      onChange(
        ready ? { text: addr.trim(), landmark: land.trim() || undefined, lat: p .lat, lng: p .lng } : null,
        q,
      );
    },
    [onChange],
  );

  /* ---- browser geolocation ---- */
  const share = () => {
    if (!navigator.geolocation) {
      setLoc("unsupported");
      return;
    }
    setLoc("locating");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        setPoint(p);
        setLoc("captured");
        const q = await check(p);
        publish(p, address, landmark, q);
      },
      (err) => {
        setLoc(err.code === err.PERMISSION_DENIED ? "denied" : "idle");
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  };

  /* -------------------------------------------------------------------- view */

  return (
    <div style={{ marginTop: 10 }}>
      <style>{`@keyframes onetap-spin { to { transform: rotate(360deg); } }`}</style>

      {/* --- share-location control / captured state --- */}
      {loc === "captured" && point ? (
        <div style={capturedChip}>
          <span style={{ display: "inline-flex", flexShrink: 0 }}>
            <Check size={14} />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ display: "block" }}>Location shared</strong>
            <span style={{ fontSize: 11.5, opacity: 0.8 }}>
              We&apos;ll use this to check the delivery distance
              {point.accuracy ? ` · accurate to ~${Math.round(point.accuracy)} m` : ""}
            </span>
          </span>
          <button type="button" onClick={share} style={reshareBtn}>
            Update
          </button>
        </div>
      ) : (
        <button type="button" style={shareBtn} onClick={share} disabled={loc === "locating" || loc === "unsupported"}>
          <span style={{ display: "inline-flex" }}>{loc === "locating" ? <Spinner /> : <Navigation />}</span>
          {loc === "locating" ? "Getting your location…" : "Share my location"}
        </button>
      )}

      {loc === "denied" ? (
        <div style={noteBox}>
          <span style={{ display: "inline-flex", flexShrink: 0, color: "var(--tone-warning)" }}>
            <Alert size={14} />
          </span>
          <span>
            Location access is blocked. Allow it for this site in your browser settings and tap
            &ldquo;Share my location&rdquo; again — we need it to confirm you&apos;re in the delivery area.
          </span>
        </div>
      ) : null}
      {loc === "unsupported" ? (
        <div style={noteBox}>
          <span style={{ display: "inline-flex", flexShrink: 0, color: "var(--tone-warning)" }}>
            <Alert size={14} />
          </span>
          <span>This browser can&apos;t share a location. Please choose takeaway, or order from a phone.</span>
        </div>
      ) : null}

      {/* --- typed address --- */}
      <label style={label}>
        <span style={{ display: "inline-flex", verticalAlign: "-2px", marginRight: 5, color: "var(--color-text-muted)" }}>
          <Pin size={13} />
        </span>
        Delivery address
      </label>
      <textarea
        style={{ ...input, minHeight: 60, resize: "vertical" }}
        value={address}
        onChange={(e) => {
          setAddress(e.target.value);
          publish(point, e.target.value, landmark, quote);
        }}
        placeholder="Flat / house no, building, street, area"
      />

      <label style={label}>Landmark (optional)</label>
      <input
        style={input}
        value={landmark}
        onChange={(e) => {
          setLandmark(e.target.value);
          publish(point, address, e.target.value, quote);
        }}
        placeholder="e.g. opposite the metro gate 3"
      />

      {/* --- serviceability result --- */}
      {checking ? (
        <p style={hint}>
          <span style={{ display: "inline-flex", verticalAlign: "-2px", marginRight: 5 }}>
            <Spinner size={12} />
          </span>
          Checking if we deliver there…
        </p>
      ) : null}

      {quote && !checking ? (
        quote.serviceable ? (
          <div style={okBox}>
            <span style={{ display: "inline-flex", flexShrink: 0, marginTop: 1 }}>
              <Check size={14} />
            </span>
            <span>
              <strong style={{ display: "block" }}>We deliver here</strong>
              {quote.distanceKm} km away · {quote.fee === 0 ? "Free delivery" : `${formatINR(quote.fee)} delivery`} · about{" "}
              {quote.etaMinutes} min
            </span>
          </div>
        ) : (
          <div style={badBox}>
            <span style={{ display: "inline-flex", flexShrink: 0, marginTop: 1 }}>
              <Alert size={14} />
            </span>
            <span>
              <strong style={{ display: "block" }}>Delivery not available at this address</strong>
              {quote.reason ?? `Outside the ${quote.radiusKm} km delivery area.`}
            </span>
          </div>
        )
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------- styles */

const input                = {
  width: "100%",
  font: "inherit",
  fontSize: 14,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-text)",
};
const label                = { display: "block", fontSize: 12.5, fontWeight: 600, marginTop: 14, marginBottom: 5 };
const hint                = { fontSize: 12.5, color: "var(--color-text-muted)", margin: "8px 0 0", lineHeight: 1.5 };
const shareBtn                = {
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
  color: "var(--color-primary)",
  cursor: "pointer",
};
const capturedChip                = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 13px",
  borderRadius: 10,
  background: "var(--tone-success-wash)",
  color: "var(--tone-success)",
  fontSize: 12.5,
};
const reshareBtn                = {
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
const noteBox                = {
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
const okBox                = {
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
const badBox                = {
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
