"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

/**
 * The delivery map: a free Leaflet map on OpenStreetMap (no account, no key, no per-use bill). The customer taps it to drop the pin on
 * their door and can drag the pin to adjust. The shop is drawn with its delivery radius so they can see whether they are inside it.
 *
 * Tiles: the address in NEXT_PUBLIC_MAP_TILE_URL, or OpenStreetMap's public server. The public server is meant for light use — for a busy
 * production site point the variable at your own tiles (see docs/free-maps.md). The "© OpenStreetMap contributors" credit is required.
 */
const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';
const INDIA = [22.5, 79];
const round = (n) => Math.round(n * 1e6) / 1e6;
const css = (name) => (typeof window === "undefined" ? "" : getComputedStyle(document.documentElement).getPropertyValue(name).trim());

const pinSvg = (color) =>
  `<svg width="34" height="44" viewBox="0 0 34 44" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M17 43C17 43 3 28 3 16a14 14 0 0 1 28 0c0 12-14 27-14 27Z" fill="${color}" stroke="#fff" stroke-width="2.5"/><circle cx="17" cy="16" r="5.5" fill="#fff"/></svg>`;
const shopSvg = (color) =>
  `<svg width="22" height="22" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="11" cy="11" r="9" fill="#fff" stroke="${color}" stroke-width="3"/><circle cx="11" cy="11" r="3.5" fill="${color}"/></svg>`;

/**
 * @param {{ origin: { point: { lat: number, lng: number }, radiusKm: number } | null,
 *           value: { lat: number, lng: number, center?: boolean } | null,
 *           onPick: (p: { lat: number, lng: number }) => void, height?: number }} props
 */
export function DeliveryMap({ origin, value, onPick, height = 260 }) {
  const box = useRef(null);
  const lib = useRef({ L: null, map: null, pin: null, shop: [] });
  const pickRef = useRef(onPick);
  pickRef.current = onPick; // the map's handlers are made once: they always call the LATEST onPick
  const [ready, setReady] = useState(false);
  const [tilesFailed, setTilesFailed] = useState(false);
  const [touch, setTouch] = useState(false);

  /* ---- the map itself, made once in the browser ---- */
  useEffect(() => {
    let dead = false;
    setTouch(typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches);
    (async () => {
      try {
        const mod = await import("leaflet");
        const L = mod.default ?? mod;
        if (dead || !box.current) return;
        // on a phone one finger scrolls the PAGE (a map that grabs it would trap the customer); two fingers move the map
        const map = L.map(box.current, { scrollWheelZoom: false, dragging: !L.Browser.mobile, worldCopyJump: false, zoomSnap: 0.5 }).setView(INDIA, 5);
        let loaded = 0;
        let errors = 0;
        L.tileLayer(TILE_URL, { maxZoom: 19, attribution: ATTRIBUTION })
          .on("tileload", () => { loaded += 1; })
          .on("tileerror", () => { errors += 1; if (!loaded && errors >= 4) setTilesFailed(true); })
          .addTo(map);
        map.on("click", (e) => pickRef.current({ lat: round(e.latlng.lat), lng: round(e.latlng.lng) }));
        lib.current = { L, map, pin: null, shop: [] };
        setReady(true);
      } catch {
        setTilesFailed(true);
      }
    })();
    return () => {
      dead = true;
      lib.current.map?.remove();
      lib.current = { L: null, map: null, pin: null, shop: [] };
      setReady(false);
    };
  }, []);

  /* ---- the shop and how far it delivers ---- */
  useEffect(() => {
    const { L, map } = lib.current;
    if (!ready || !map || !origin?.point || typeof origin.point.lat !== "number") return;
    lib.current.shop.forEach((l) => l.remove());
    const color = css("--color-primary") || "#c0392b";
    const at = [origin.point.lat, origin.point.lng];
    const shop = [L.marker(at, { icon: L.divIcon({ className: "rp-map-icon", html: shopSvg(color), iconSize: [22, 22], iconAnchor: [11, 11] }), keyboard: false, interactive: false }).addTo(map)];
    if (origin.radiusKm > 0) {
      const ring = L.circle(at, { radius: origin.radiusKm * 1000, color, weight: 2, opacity: 0.8, fillColor: color, fillOpacity: 0.07, interactive: false }).addTo(map);
      shop.push(ring);
      if (!lib.current.pin) map.fitBounds(ring.getBounds(), { padding: [8, 8] });
    } else if (!lib.current.pin) map.setView(at, 14);
    lib.current.shop = shop;
  }, [ready, origin?.point?.lat, origin?.point?.lng, origin?.radiusKm]);

  /* ---- the pin follows the chosen place ---- */
  useEffect(() => {
    const { L, map } = lib.current;
    if (!ready || !map) return;
    if (!value) {
      lib.current.pin?.remove();
      lib.current.pin = null;
      return;
    }
    const at = [value.lat, value.lng];
    if (!lib.current.pin) {
      const color = css("--color-primary") || "#c0392b";
      const pin = L.marker(at, { draggable: true, keyboard: true, title: "Your delivery location. Drag to adjust.", icon: L.divIcon({ className: "rp-map-icon", html: pinSvg(color), iconSize: [34, 44], iconAnchor: [17, 43] }) }).addTo(map);
      pin.on("dragend", () => { const p = pin.getLatLng(); pickRef.current({ lat: round(p.lat), lng: round(p.lng) }); });
      lib.current.pin = pin;
    } else {
      lib.current.pin.setLatLng(at);
    }
    // a place that came from the phone's own location (or one off-screen) is brought into view; a tap on the map stays where it is
    if (value.center) map.setView(at, Math.max(map.getZoom(), 17));
    else if (!map.getBounds().contains(at)) map.panTo(at);
  }, [ready, value?.lat, value?.lng, value?.center]);

  return (
    <div style={{ marginTop: 8 }}>
      <style>{`.rp-map-icon{background:transparent;border:0}.rp-delivery-map .leaflet-container{font:inherit;border-radius:12px}`}</style>
      {/* position + z-index keep the map's own layers (they go up to 1000) from covering the sticky bars and pop-ups of the page */}
      <div className="rp-delivery-map" style={{ position: "relative", zIndex: 0, isolation: "isolate" }}>
        <div ref={box} data-testid="delivery-map" data-pin={value ? `${value.lat},${value.lng}` : ""} role="application" aria-label="Delivery location map. Tap to place the pin." style={{ height, width: "100%", borderRadius: 12, border: "1px solid var(--color-border)", background: "var(--color-surface-alt, #eee)" }} />
        {tilesFailed ? (
          <div role="status" style={{ position: "absolute", left: 8, right: 8, bottom: 30, padding: "8px 10px", borderRadius: 8, background: "var(--tone-warning-wash)", color: "var(--color-text)", fontSize: 12, zIndex: 500 }}>
            The map pictures couldn&apos;t load. Check your connection, or tap &ldquo;Use my current location&rdquo;.
          </div>
        ) : null}
      </div>
      <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "6px 0 0", lineHeight: 1.5 }}>
        Tap the map to drop the pin on your door, then drag the pin to adjust.{touch ? " Use two fingers to move the map." : ""}
      </p>
    </div>
  );
}
