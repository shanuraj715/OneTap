// T99 — Ordering for delivery: the place on a free map is mandatory, and the distance comes from that pin.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t99-delivery-map",
  title: "Delivery checkout: the customer must choose the place on a free map (Leaflet + OpenStreetMap, no key); the distance, delivery area and charge are measured from that pin; no pin, no order",
  area: "storefront",
  browser: true,
  fresh: false,
  summary: "Chrome against the bench's Acme store (its Connaught Place outlet delivers within 5 km). Choosing Delivery draws a map headed 'Choose your location on the map — Required' with the '© OpenStreetMap contributors' credit; the map pictures are answered locally so the test never calls OpenStreetMap, and no Google Maps or key is involved. Before a pin: a note says to place it, the order button says 'Choose location on the map' and is disabled — even after the address is typed. Tapping the map drops the pin; the quote says 'We deliver here' with the straight-line distance, and that number equals an independently computed distance between the pin and the restaurant; moving the pin (a tap or a drag) measures again from the new pin, and the check sent to the server carries exactly the pin's coordinates. A pin outside the ring says 'Delivery not available at this pin' and the button says to move it. Switching to Takeaway and back starts with no pin. The sticky bottom bar stays above the map. 'Use my current location' (mocked phone location) puts the pin on the map, with its accuracy, and can be corrected; a refused location leaves the map working. A phone-width screen has no sideways scroll. If the map pictures can't load a message says so and the location button still sets the pin. No console errors.",
  expect: [
    "Delivery asks for the place on a map, marked Required, and nothing can be ordered until the pin is placed inside the delivery area.",
    "The distance shown is measured from the chosen pin, and moving the pin re-measures.",
    "The free map shows OpenStreetMap's credit and uses no Google Maps or key.",
  ],
  expectNot: [
    "A typed address alone must NOT unlock a delivery order.",
    "A pin outside the delivery area must NOT allow the order.",
    "An old pin must NOT be kept when the customer leaves Delivery and comes back.",
    "The map must NOT cover the page's sticky bars.",
  ],
};

export const run = (d) => runSuite(d, "storefront-delivery-map.mjs", { timeoutMs: 8 * 60_000 });
