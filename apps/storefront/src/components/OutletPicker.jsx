"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { haversineKm } from "@onetap/config-schema";

const Pin = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);
const Spinner = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden style={{ animation: "ot-picker-spin 0.8s linear infinite" }}>
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

/**
 * Shown only when a brand has more than one outlet and no outlet is in the
 * URL yet (a single-outlet brand skips this entirely — see app/page.jsx).
 * Picking one — by hand, or automatically via "use my location" — remembers
 * the choice for next time and lands on that outlet's own URL, which from
 * then on is what's shared, bookmarked and printed on table QR codes.
 */
export function OutletPicker({ brand, outlets, cookieName }) {
  const router = useRouter();
  const [locating, setLocating] = useState(false);
  const [locateStatus, setLocateStatus] = useState("idle"); // idle | denied | error

  const choose = (slug) => {
    document.cookie = `${cookieName}=${encodeURIComponent(slug)}; path=/; max-age=${60 * 60 * 24 * 180}`;
    router.push(`/${slug}`);
  };

  // Only outlets the owner has actually dropped a map pin for can be measured
  // against — an outlet with no location set is still pickable by hand below,
  // it just can't be found automatically.
  const locatable = outlets.filter((o) => o.location);

  const useMyLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation || locatable.length === 0) return;
    setLocating(true);
    setLocateStatus("idle");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const me = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const nearest = locatable
          .map((o) => ({ ...o, distanceKm: haversineKm(me, o.location) }))
          .sort((a, b) => a.distanceKm - b.distanceKm)[0];
        choose(nearest.slug); // navigates away — no need to clear `locating`
      },
      (err) => {
        setLocating(false);
        setLocateStatus(err.code === err.PERMISSION_DENIED ? "denied" : "error");
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  return (
    <main style={page}>
      <style>{`@keyframes ot-picker-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={card}>
        <h1 style={heading}>{brand.name}</h1>
        <p style={subheading}>Which location?</p>

        {locatable.length > 0 ? (
          <>
            <button type="button" onClick={useMyLocation} disabled={locating} style={locateBtn} className="ot-press">
              {locating ? <Spinner /> : <Pin />}
              {locating ? "Finding your nearest outlet…" : "Use my current location"}
            </button>
            {locateStatus === "denied" ? (
              <p style={locateNote}>Location access was denied — pick your outlet below.</p>
            ) : locateStatus === "error" ? (
              <p style={locateNote}>Couldn't get your location — pick your outlet below.</p>
            ) : null}
            <div style={divider}>
              <span style={dividerLine} />
              <span style={dividerText}>or choose manually</span>
              <span style={dividerLine} />
            </div>
          </>
        ) : null}

        <div style={list}>
          {outlets.map((o) => (
            <button key={o.id} type="button" onClick={() => choose(o.slug)} style={row} className="ot-press">
              <span style={name}>{o.name}</span>
              {o.address ? <span style={address}>{o.address}</span> : null}
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}

const page = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: 24,
  background: "var(--color-bg)",
};
const card = { width: "100%", maxWidth: 440 };
const heading = {
  fontFamily: "var(--font-heading)",
  fontSize: 26,
  fontWeight: 700,
  margin: "0 0 4px",
  textAlign: "center",
  color: "var(--color-text)",
};
const subheading = {
  margin: "0 0 20px",
  textAlign: "center",
  fontSize: 14,
  color: "var(--color-text-muted)",
};
const locateBtn = {
  width: "100%",
  font: "inherit",
  fontSize: 14.5,
  fontWeight: 600,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "13px 16px",
  borderRadius: "var(--radius-card)",
  border: "none",
  background: "var(--color-primary)",
  color: "var(--color-on-primary)",
  cursor: "pointer",
};
const locateNote = {
  margin: "8px 0 0",
  textAlign: "center",
  fontSize: 12.5,
  color: "var(--tone-warning)",
};
const divider = { display: "flex", alignItems: "center", gap: 10, margin: "18px 0" };
const dividerLine = { flex: 1, height: 1, background: "var(--color-border)" };
const dividerText = { fontSize: 11.5, color: "var(--color-text-muted)", whiteSpace: "nowrap" };
const list = { display: "flex", flexDirection: "column", gap: 10 };
const row = {
  font: "inherit",
  textAlign: "left",
  display: "flex",
  flexDirection: "column",
  gap: 3,
  padding: "14px 16px",
  borderRadius: "var(--radius-card)",
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  color: "var(--color-text)",
  cursor: "pointer",
};
const name = { fontWeight: 600, fontSize: 15 };
const address = { fontSize: 13, color: "var(--color-text-muted)" };
