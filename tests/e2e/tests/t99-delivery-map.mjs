// T99 — Ordering for delivery: the place on a free map is mandatory, and the distance comes from that pin.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t99-delivery-map",
  title: "Delivery checkout: a free map with the pin FIXED in the middle and the map moved under it (one finger drags, two pinch); it starts at the customer's saved place for the outlet, else their phone's location if already allowed, else the restaurant; the distance is measured from the pin; no chosen place, no order",
  area: "storefront",
  browser: true,
  fresh: false,
  summary: "Chrome against the bench's Acme store (its Connaught Place outlet delivers within 5 km). The map pictures are answered locally so the test never calls OpenStreetMap; no Google Maps or key is involved. Choosing Delivery draws a map headed 'Choose your location on the map — Required' with a pin whose tip is exactly the map's centre, a tiny '© OpenStreetMap' credit (no 'Leaflet' label; ≤ 11 px, ≤ 9.5 px on a phone). With nothing saved and no location allowed it starts at the restaurant, the place is NOT chosen, the order button says 'Choose location on the map' and stays locked even after the address is typed. Clicking the map places nothing; zooming with + / − or Ctrl + scroll changes the zoom but is not a choice; a plain scroll over the map does not zoom. Dragging the MAP moves what is under the pin while the pin does not move on screen; the place becomes chosen, the quote says 'We deliver here' with a distance equal to an independently computed distance from the map's centre to the restaurant, and the check sent to the server carries exactly the centre's coordinates. Dragging until the pin is beyond the ring says 'Delivery not available at this pin' and locks the button. Switching to Takeaway and back starts clean; the sticky bar stays above the map. On a phone (real touch input): ONE finger moves the map without scrolling the page, pinching out zooms in and pinching in zooms out, and there is no sideways scroll. With location already allowed the map opens at the phone's location with the accuracy; without permission it stays at the restaurant and asks nothing. With a saved place for the outlet the map opens with the pin on it, the whole address (text + landmark) filled, the distance measured from it, the order ready to place; the customer can still move the map, and 'Forget it' removes the saved place. If the map pictures can't load a message says so. No console errors.",
  expect: [
    "Delivery shows a map with a fixed pin; moving the map (one finger, mouse, or pinch to zoom) changes the place under the pin.",
    "The map starts at the saved place for the outlet, else the phone's location (if allowed), else the restaurant; only the first two count as chosen.",
    "The distance shown is measured from the pin, and nothing can be ordered until the place is chosen inside the delivery area.",
  ],
  expectNot: [
    "A tap or click on the map must NOT place the pin (it is fixed).",
    "A typed address alone, or a pin left on the restaurant, must NOT unlock a delivery order.",
    "One finger on the map must NOT scroll the page behind it.",
    "The OpenStreetMap credit must NOT be large on a phone.",
  ],
};

export const run = (d) => runSuite(d, "storefront-delivery-map.mjs", { timeoutMs: 8 * 60_000 });
