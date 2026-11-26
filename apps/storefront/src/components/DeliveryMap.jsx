"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

/**
 * The delivery map: a free Leaflet map on OpenStreetMap (no account, no key, no per-use bill).
 *
 * The PIN IS FIXED in the middle of the map and the customer moves the MAP under it — one finger drags the map, two fingers pinch it bigger or
 * smaller (the +/− buttons and a double tap work too; on a computer, drag with the mouse, Ctrl + scroll or pinch the trackpad). Wherever the map
 * rests, the point under the pin's tip is the delivery place. The restaurant and its delivery ring are drawn so they can see if they are inside it.
 *
 * Moving the map by hand calls `onMove({ lat, lng })` once the map stops. Moving it from outside (a saved place, the phone's location) goes
 * through the `view` prop and does NOT call `onMove`.
 *
 * Tiles: the address in NEXT_PUBLIC_MAP_TILE_URL, or OpenStreetMap's public server. The public server is meant for light use — for a busy
 * production site point the variable at your own tiles (see docs/free-maps.md). The "© OpenStreetMap contributors" credit is required; it is shown
 * small so it doesn't take over a phone screen.
 */
const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';
const INDIA = [22.5, 79];
const MOVED_AT_LEAST_M = 3; // a smaller shift of the middle (a zoom button, a tiny wobble) is not a new place
const round = (n) => Math.round(n * 1e6) / 1e6;
const css = (name) => (typeof window === "undefined" ? "" : getComputedStyle(document.documentElement).getPropertyValue(name).trim());

const shopSvg = (color) =>
  `<svg width="22" height="22" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="11" cy="11" r="9" fill="#fff" stroke="${color}" stroke-width="3"/><circle cx="11" cy="11" r="3.5" fill="${color}"/></svg>`;

/**
 * @param {{ origin: { point: { lat: number, lng: number }, radiusKm: number } | null,
 *           view: { lat: number, lng: number, zoom?: number, key: number } | null,
 *           onMove: (p: { lat: number, lng: number }) => void, height?: number }} props
 */
export function DeliveryMap({ origin, view, onMove, height = 300 }) {
  const box = useRef(null);
  const st = useRef({ L: null, map: null, shop: [], quiet: 0, last: null, viewed: false });
  const moveRef = useRef(onMove);
  moveRef.current = onMove; // the map's handlers are made once: they always call the LATEST onMove
  const [ready, setReady] = useState(false);
  const [tilesFailed, setTilesFailed] = useState(false);
  const [lifting, setLifting] = useState(false);
  const [state, setState] = useState({ center: "", zoom: "" });
  const [touch, setTouch] = useState(false);

  /* ---- the map itself, made once in the browser ---- */
  useEffect(() => {
    let dead = false;
    let removeWheel = () => undefined;
    setTouch(typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches);
    (async () => {
      try {
        const mod = await import("leaflet");
        const L = mod.default ?? mod;
        if (dead || !box.current) return;
        // one finger moves the map, two fingers pinch it (Leaflet's own touch handling); the page's scroll wheel is left alone
        const map = L.map(box.current, { attributionControl: false, scrollWheelZoom: false, dragging: true, touchZoom: true, doubleClickZoom: true, zoomSnap: 0.5, worldCopyJump: false }).setView(INDIA, 5);
        L.control.attribution({ prefix: false, position: "bottomright" }).addTo(map);
        let loaded = 0;
        let errors = 0;
        L.tileLayer(TILE_URL, { maxZoom: 19, attribution: ATTRIBUTION })
          .on("tileload", () => { loaded += 1; })
          .on("tileerror", () => { errors += 1; if (!loaded && errors >= 4) setTilesFailed(true); })
          .addTo(map);

        map.on("movestart", () => setLifting(true));
        map.on("moveend", () => {
          setLifting(false);
          const c = map.getCenter();
          const here = { lat: round(c.lat), lng: round(c.lng) };
          setState({ center: `${here.lat},${here.lng}`, zoom: String(map.getZoom()) });
          const prev = st.current.last;
          st.current.last = c;
          if (st.current.quiet > 0) return; // moved from outside (a saved place, the phone's location): not the customer's own move
          if (prev && map.distance(prev, c) < MOVED_AT_LEAST_M) return; // only a zoom: the place under the pin is the same
          moveRef.current(here);
        });

        // Ctrl (or ⌘) + scroll, and a trackpad pinch (which arrives as Ctrl + scroll), zoom the map; plain scrolling still scrolls the page
        let lastWheel = 0;
        const onWheel = (e) => {
          if (!e.ctrlKey && !e.metaKey) return;
          e.preventDefault();
          const now = Date.now();
          if (now - lastWheel < 90) return;
          lastWheel = now;
          map.setZoom(map.getZoom() + (e.deltaY < 0 ? 0.5 : -0.5));
        };
        box.current.addEventListener("wheel", onWheel, { passive: false });
        const el = box.current;
        removeWheel = () => el.removeEventListener("wheel", onWheel);

        st.current = { L, map, shop: [], quiet: 0, last: map.getCenter(), viewed: false };
        setReady(true);
      } catch {
        setTilesFailed(true);
      }
    })();
    return () => {
      dead = true;
      removeWheel();
      st.current.map?.remove();
      st.current = { L: null, map: null, shop: [], quiet: 0, last: null, viewed: false };
      setReady(false);
    };
  }, []);

  /** Move the map without it counting as the customer's own move. */
  const jump = (fn) => {
    st.current.quiet += 1;
    try { fn(); } finally { st.current.quiet -= 1; }
  };

  /* ---- the shop and how far it delivers ---- */
  useEffect(() => {
    const { L, map } = st.current;
    if (!ready || !map || !origin?.point || typeof origin.point.lat !== "number") return;
    st.current.shop.forEach((l) => l.remove());
    const color = css("--color-primary") || "#c0392b";
    const at = [origin.point.lat, origin.point.lng];
    const shop = [L.marker(at, { icon: L.divIcon({ className: "rp-map-icon", html: shopSvg(color), iconSize: [22, 22], iconAnchor: [11, 11] }), keyboard: false, interactive: false }).addTo(map)];
    if (origin.radiusKm > 0) {
      const ring = L.circle(at, { radius: origin.radiusKm * 1000, color, weight: 2, opacity: 0.8, fillColor: color, fillOpacity: 0.07, interactive: false }).addTo(map);
      shop.push(ring);
      if (!st.current.viewed) jump(() => map.fitBounds(ring.getBounds(), { padding: [8, 8], animate: false }));
    } else if (!st.current.viewed) jump(() => map.setView(at, 14, { animate: false }));
    st.current.shop = shop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, origin?.point?.lat, origin?.point?.lng, origin?.radiusKm]);

  /* ---- a place chosen from outside: the saved one, the phone's location ---- */
  useEffect(() => {
    const { map } = st.current;
    if (!ready || !map || !view) return;
    st.current.viewed = true;
    jump(() => map.setView([view.lat, view.lng], view.zoom ?? Math.max(map.getZoom(), 17), { animate: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, view?.key]);

  return (
    <div style={{ marginTop: 8 }}>
      <style>{`
        .rp-map-icon{background:transparent;border:0}
        .rp-delivery-map .leaflet-container{font:inherit;border-radius:12px;touch-action:none}
        .rp-delivery-map .leaflet-control-attribution{font-size:9px;line-height:1.35;padding:0 5px;background:rgb(255 255 255 / .8);color:#333;border-radius:6px 0 0 0}
        .rp-delivery-map .leaflet-control-attribution a{color:#0b5cad}
        @media (min-width:640px){.rp-delivery-map .leaflet-control-attribution{font-size:10.5px}}
        .rp-pin{position:absolute;left:50%;top:50%;width:34px;height:44px;margin:-44px 0 0 -17px;pointer-events:none;z-index:600;transition:transform .16s ease-out;filter:drop-shadow(0 3px 3px rgb(0 0 0 / .25))}
        .rp-pin[data-lifting="true"]{transform:translateY(-9px)}
        .rp-pin-shadow{position:absolute;left:50%;top:50%;width:14px;height:5px;margin:-2px 0 0 -7px;border-radius:50%;background:rgb(0 0 0 / .32);pointer-events:none;z-index:599;transition:transform .16s ease-out,opacity .16s}
        .rp-pin-shadow[data-lifting="true"]{transform:scale(.6);opacity:.6}
        @media (prefers-reduced-motion:reduce){.rp-pin,.rp-pin-shadow{transition:none}}
      `}</style>
      {/* position + z-index keep the map's own layers (they go up to 1000) from covering the sticky bars and pop-ups of the page */}
      <div className="rp-delivery-map" style={{ position: "relative", zIndex: 0, isolation: "isolate" }}>
        <div
          ref={box}
          data-testid="delivery-map"
          data-center={state.center}
          data-zoom={state.zoom}
          role="application"
          aria-label="Delivery location map. The pin stays in the middle: move the map to put it on your door."
          style={{ height, width: "100%", borderRadius: 12, border: "1px solid var(--color-border)", background: "var(--color-surface-alt, #eee)" }}
        />
        {/* the fixed pin: its tip is the middle of the map */}
        <span className="rp-pin-shadow" data-lifting={lifting} aria-hidden="true" />
        <svg className="rp-pin" data-testid="delivery-pin" data-lifting={lifting} viewBox="0 0 34 44" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Delivery pin">
          <path d="M17 43C17 43 3 28 3 16a14 14 0 0 1 28 0c0 12-14 27-14 27Z" fill="var(--color-primary, #c0392b)" stroke="#fff" strokeWidth="2.5" />
          <circle cx="17" cy="16" r="5.5" fill="#fff" />
        </svg>
        {tilesFailed ? (
          <div role="status" style={{ position: "absolute", left: 8, right: 8, bottom: 30, padding: "8px 10px", borderRadius: 8, background: "var(--tone-warning-wash)", color: "var(--color-text)", fontSize: 12, zIndex: 650 }}>
            The map pictures couldn&apos;t load. Check your connection, or tap &ldquo;Use my current location&rdquo;.
          </div>
        ) : null}
      </div>
      <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "6px 0 0", lineHeight: 1.5 }}>
        {touch ? "Drag the map with one finger to put the pin on your door. Pinch to zoom." : "Drag the map to put the pin on your door. Zoom with + / −, a double click, or Ctrl + scroll."}
      </p>
    </div>
  );
}
