"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Where the visitor is — only when THEY choose to share it (never asked on page load). It powers "how far is each
 * outlet" and "does it deliver to me".
 *
 * The point is kept on this device for a few hours so it isn't asked again on every page. If the browser has
 * already been told "allow" for this site, it is refreshed quietly in the background.
 *
 *   status  "idle" (not asked) · "asking" · "ready" · "denied" · "unavailable" (this browser can't) · "error"
 *   point   { lat, lng } or null
 *   request()  ask the browser now (shows its permission prompt the first time)
 */
const KEY = "rasoipulse.userLocation";
const FRESH_MS = 6 * 60 * 60 * 1000;

function readSaved() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) ?? "null");
    if (saved && Number.isFinite(saved.lat) && Number.isFinite(saved.lng) && Date.now() - saved.at < FRESH_MS) return { lat: saved.lat, lng: saved.lng };
  } catch {
    /* nothing usable saved */
  }
  return null;
}

export function useUserLocation() {
  const [state, setState] = useState({ point: null, status: "idle" });

  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState((s) => ({ ...s, status: "unavailable" }));
      return;
    }
    setState((s) => ({ ...s, status: "asking" }));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        try {
          window.localStorage.setItem(KEY, JSON.stringify({ ...point, at: Date.now() }));
        } catch {
          /* private window: fine for this visit */
        }
        setState({ point, status: "ready" });
      },
      (err) => setState((s) => ({ ...s, status: err.code === err.PERMISSION_DENIED ? "denied" : "error" })),
      // a rough fix is plenty for "how many km", and answers faster than a precise one
      { enableHighAccuracy: false, timeout: 9000, maximumAge: 5 * 60 * 1000 },
    );
  }, []);

  useEffect(() => {
    const saved = readSaved();
    if (saved) setState({ point: saved, status: "ready" });
    // already allowed for this site → refresh quietly (no prompt); already blocked → say so
    let alive = true;
    navigator.permissions
      ?.query({ name: "geolocation" })
      .then((permission) => {
        if (!alive) return;
        if (permission.state === "granted") request();
        else if (permission.state === "denied") setState((s) => (s.point ? s : { ...s, status: "denied" }));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [request]);

  return { ...state, request };
}
