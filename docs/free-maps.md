# Free maps: what the product uses, and what it costs

Nothing in Rasoi Pulse calls a paid map service. There is no Google Maps key to buy or protect.

| Where | What it does | What it uses | Cost |
| --- | --- | --- | --- |
| **Storefront, ordering for delivery** | A map with the pin fixed in the middle: the customer drags the map (one finger) and pinches to zoom until the pin is on their door (required); it starts at their saved place for the outlet, else their location if already allowed, else the restaurant; the restaurant and its delivery ring are drawn | **Leaflet** (open-source) with **OpenStreetMap** tiles | Free |
| **Distance and delivery charge** | From the chosen pin to the restaurant, in a straight line | Our own server (`POST /api/delivery/check`, the haversine formula) — no routing service | Free |
| **Rider app, directions** | The rider's own maps app opens at the customer's pin | A plain link (`https://www.google.com/maps/dir/?api=1&destination=lat,lng`, or `geo:`) | Free: a link, not the Maps API |
| **Call / WhatsApp** | `tel:` and `https://wa.me/…` links | The phone's own apps | Free |

## The one condition

OpenStreetMap's data is free to use, but its credit **"© OpenStreetMap contributors"** must stay visible on the map (the map shows it), and its
**public tile server** (`tile.openstreetmap.org`) is meant for *light* use. A restaurant with a few hundred delivery orders a day is fine; a busy
platform with thousands of map views a day should serve its own tiles.

To change where tiles come from, set `NEXT_PUBLIC_MAP_TILE_URL` for the storefront build (a `{z}/{x}/{y}` template, e.g. your own tile server
or a provider's free plan) and rebuild. Nothing else changes.

### Serving your own tiles (free, no limits)
1. Make a map file for just your cities with the free [Protomaps](https://protomaps.com) tools (`pmtiles extract` from a planet build, a few tens of MB for a handful of cities).
2. Keep the `.pmtiles` file in the storage bucket you already use and serve it, or run a tile server on the VPS (a small container; the VPS has about 2 GB RAM, so keep it to the cities you serve).
3. Point `NEXT_PUBLIC_MAP_TILE_URL` at it.
Refresh the file about once a year; roads built later won't show until you do.

## What OpenStreetMap is not as good at
Shop names, landmarks and brand-new roads are less complete than Google's. That is fine for dropping a pin; it is why the rider app hands directions to
the rider's own maps app, and why a customer also types the address in words and a landmark. Not provided at all: traffic, Street View, satellite pictures,
turn-by-turn directions inside our own screens, and "search an address as you type".
