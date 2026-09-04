import { useCallback, useEffect, useRef, useState } from "react";
                                           
                                                          
import { Crosshair, MapPin } from "lucide-react";
import { Button, Field, InfoHint, TextInput } from "../../ui";

const MAPS_KEY =
  (import.meta.env.VITE_GOOGLE_MAPS_API_KEY                      ) ??
  (import.meta.env.VITE_NEXT_PUBLIC_GOOGLE_MAPS_API_KEY                      ) ??
  "";

/* eslint-disable @typescript-eslint/no-explicit-any */
const gmaps = ()      => (globalThis       ).google?.maps;
let mapsPromise                       = null;

function loadGoogleMaps()                {
  if (!MAPS_KEY) return Promise.reject(new Error("no-key"));
  if (gmaps()) return Promise.resolve();
  if (mapsPromise) return mapsPromise;
  mapsPromise = new Promise      ((resolve, reject) => {
    const cb = `__onetapAdminMaps_${Math.random().toString(36).slice(2)}`;
    (globalThis                           )[cb] = () => {
      delete (globalThis                           )[cb];
      resolve();
    };
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(MAPS_KEY)}&libraries=places&callback=${cb}`;
    s.async = true;
    s.onerror = () => {
      mapsPromise = null;
      reject(new Error("Maps failed to load"));
    };
    document.head.appendChild(s);
  });
  return mapsPromise;
}

/**
 * Pull latitude/longitude out of whatever a user pastes: a plain "lat, lng", a
 * `google.com/maps/@lat,lng`, a `?q=lat,lng`, or the `!3dlat!4dlng` fragment in
 * a place URL. Returns null if nothing usable is in there.
 */
function parseCoords(raw        )                                      {
  const s = raw.trim();
  const inRange = (lat        , lng        ) =>
    Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
      ? { lat, lng }
      : null;

  const at = /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(s);
  if (at) return inRange(parseFloat(at[1] ), parseFloat(at[2] ));

  const q = /[?&](?:q|ll|center)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/.exec(s);
  if (q) return inRange(parseFloat(q[1] ), parseFloat(q[2] ));

  const d = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/.exec(s);
  if (d) return inRange(parseFloat(d[1] ), parseFloat(d[2] ));

  const plain = /^(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/.exec(s);
  if (plain) return inRange(parseFloat(plain[1] ), parseFloat(plain[2] ));

  return null;
}

/**
 * Set the shop's map location — the origin for every delivery-distance check.
 *
 * With a Google Maps key it's a draggable pin with address search. Without one
 * the owner pastes a Google Maps link (or coordinates) or taps "use my current
 * location"; the result is always shown as a set-location chip, never as raw
 * latitude/longitude fields.
 */
export function LocationField({ value, onChange }                                                              ) {
  const mapRef = useRef                (null);
  const markerRef = useRef     (null);
  const geocoderRef = useRef     (null);
  const searchRef = useRef                  (null);
  const [mode, setMode] = useState                              ("loading");
  const [locating, setLocating] = useState(false);
  const [mapsLink, setMapsLink] = useState("");

  const point = value.point;

  const reverse = useCallback((p                              )                  => {
    const g = geocoderRef.current;
    const fallback = `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
    if (!g) return Promise.resolve(fallback);
    return new Promise((resolve) => {
      g.geocode({ location: p }, (r                                        , s        ) => {
        resolve(s === "OK" && r?.[0] ? r[0].formatted_address : fallback);
      });
    });
  }, []);

  const apply = useCallback(
    async (p                              , text         ) => {
      markerRef.current?.setPosition(p);
      const addr = text ?? (await reverse(p));
      onChange({ point: { lat: Number(p.lat.toFixed(6)), lng: Number(p.lng.toFixed(6)) }, formattedAddress: addr });
    },
    [onChange, reverse],
  );

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then(() => {
        if (cancelled || !mapRef.current) return;
        const g = gmaps();
        const centre = point ?? { lat: 28.6139, lng: 77.209 };
        const map = new g.Map(mapRef.current, {
          center: centre,
          zoom: point ? 15 : 11,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
        });
        const marker = new g.Marker({ map, position: centre, draggable: true });
        markerRef.current = marker;
        marker.addListener("dragend", () => {
          const pos = marker.getPosition();
          if (pos) void apply({ lat: pos.lat(), lng: pos.lng() });
        });
        map.addListener("click", (e                                                       ) => {
          if (e.latLng) void apply({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        });
        geocoderRef.current = new g.Geocoder();
        if (searchRef.current && g.places) {
          const ac = new g.places.Autocomplete(searchRef.current, {
            fields: ["geometry", "formatted_address"],
            componentRestrictions: { country: "in" },
          });
          ac.addListener("place_changed", () => {
            const pl = ac.getPlace();
            const loc = pl.geometry?.location;
            if (loc) {
              const p = { lat: loc.lat(), lng: loc.lng() };
              map.panTo(p);
              map.setZoom(16);
              void apply(p, pl.formatted_address);
            }
          });
        }
        setMode("map");
      })
      .catch(() => {
        if (!cancelled) setMode("manual");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const useCurrent = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        void apply({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  return (
    <div style={{ maxWidth: 560 }}>
      <span style={{ fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        Shop location
        <InfoHint
          title="Shop location"
          text="Drop the pin exactly where the shop is. Every delivery order measures the straight-line distance from this point to the customer's address, and refuses anything outside the delivery radius. Without it, delivery can't be offered at all."
        />
      </span>

      {mode === "map" ? (
        <>
          <input ref={searchRef} style={input} placeholder="Search for the shop's address…" aria-label="Search address" />
          <div ref={mapRef} style={mapBox} />
        </>
      ) : null}

      {mode === "loading" ? (
        <div style={{ ...mapBox, display: "grid", placeItems: "center", color: "var(--color-text-muted)", fontSize: 13 }}>
          Loading map…
        </div>
      ) : null}

      {mode === "manual" ? (
        <Field
          label="Paste a Google Maps link or coordinates"
          info="Open Google Maps, right-click the shop and choose the coordinates (or copy the link), then paste it here. You can also paste plainly as '28.6367, 77.2795'."
          style={{ maxWidth: "none" }}
        >
          <TextInput
            placeholder="https://maps.google.com/…   or   28.6367, 77.2795"
            value={mapsLink}
            onChange={(e) => {
              setMapsLink(e.target.value);
              const parsed = parseCoords(e.target.value);
              if (parsed) void apply(parsed);
            }}
          />
        </Field>
      ) : null}

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
        <Button
          variant="outline"
          type="button"
          onClick={useCurrent}
          disabled={locating}
          style={{ fontSize: 12.5, padding: "6px 12px", display: "inline-flex", gap: 6, alignItems: "center" }}
        >
          <Crosshair size={13} /> {locating ? "Locating…" : "Use my current location"}
        </Button>
        {point ? (
          <span style={pinChip}>
            <MapPin size={12} />
            <span style={{ fontWeight: 600 }}>Location set</span>
          </span>
        ) : (
          <span style={{ fontSize: 12, color: "var(--tone-warning)", display: "inline-flex", alignItems: "center", gap: 4 }}>
            <MapPin size={12} /> Not set — delivery stays off until the location is set.
          </span>
        )}
      </div>

      {/* Exact coordinates — always editable, and kept in sync with the map /
          geolocation / pasted-link above. */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
        <Field
          label="Latitude"
          style={{ maxWidth: 170 }}
          info="North–south position, −90 to 90. From Google Maps, this is the first number when you right-click a spot."
        >
          <TextInput
            type="number"
            step="0.000001"
            value={point?.lat ?? ""}
            placeholder="28.6367"
            onChange={(e) => {
              const lat = e.target.value === "" ? undefined : Number(e.target.value);
              if (lat === undefined || Number.isNaN(lat)) return;
              onChange({ ...value, point: { lat, lng: point?.lng ?? 0 } });
            }}
          />
        </Field>
        <Field
          label="Longitude"
          style={{ maxWidth: 170 }}
          info="East–west position, −180 to 180. The second number in a Google Maps coordinate pair."
        >
          <TextInput
            type="number"
            step="0.000001"
            value={point?.lng ?? ""}
            placeholder="77.2795"
            onChange={(e) => {
              const lng = e.target.value === "" ? undefined : Number(e.target.value);
              if (lng === undefined || Number.isNaN(lng)) return;
              onChange({ ...value, point: { lat: point?.lat ?? 0, lng } });
            }}
          />
        </Field>
      </div>

      <Field label="Address shown to customers" style={{ maxWidth: "none", marginTop: 12 }} info="The written address printed on receipts and shown on the website. Filled in automatically when you pick a point, but you can edit it.">
        <TextInput value={value.formattedAddress} onChange={(e) => onChange({ ...value, formattedAddress: e.target.value })} />
      </Field>
    </div>
  );
}

const mapBox                = {
  width: "100%",
  height: 240,
  borderRadius: 12,
  border: "1px solid var(--color-border)",
  overflow: "hidden",
  marginTop: 8,
};
const pinChip                = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 12,
  padding: "5px 11px",
  borderRadius: 999,
  background: "var(--tone-success-wash)",
  color: "var(--tone-success)",
};
const input                = {
  width: "100%",
  font: "inherit",
  fontSize: 14,
  padding: "9px 12px",
  borderRadius: 10,
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-text)",
};
