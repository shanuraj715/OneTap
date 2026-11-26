// T98 — The Rider app's server side: phone + PIN sign-in, a token that opens only the rider routes, the delivery steps with the customer's code.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t98-rider-app-api",
  title: "Rider app (RDA) API: a rider signs in with their phone number and a PIN the manager sets, sees only the deliveries handed to them, marks them picked up and delivered (with the customer's 4-digit code); a new delivery order needs a map pin and gets a code; nothing else of the store opens to a rider",
  area: "delivery",
  browser: false,
  fresh: false,
  summary: "Runs suites/rider-app-api.mjs on a private API with an in-memory database (no browser). The manager gives a rider an app login (PIN 4–6 digits, stored only as a salted hash; a rider with no phone number can't have one; only 'manage riders' may). Sign-in: wrong PIN and unknown number give the same 401 (with tries left), +91 and spaces are fine, the right PIN returns a signed token; 12 wrong PINs for one number from different addresses pause it. A rider's token opens ONLY /api/rider (the dashboard's orders, rider list and kitchen board say 401; a dashboard cookie, a forged, edited or expired token are refused). Deliveries: only the rider's own (not another's, not unassigned, not takeaway), with address, pin, landmark, distance, customer phone and items — never the delivery code. Pick up: Ready → Out for delivery (history says the rider did it; others' orders are 404). Delivered: needs the customer's 4 digits; 5 wrong tries lock it (even the right code) while the manager can still complete it; an older order with no code needs none; the customer sees the code only while out for delivery. A new delivery order from a pin gets a 4-digit code and a server-measured distance; no pin is 400, a pin outside the area is 409. Handing an order to a rider works without WhatsApp. A new PIN, switching the login off, switching the rider off, removing the rider, a switched-off store, a plan without Delivery and an old app build all end or refuse the sign-in.",
  expect: [
    "A rider signs in with phone + PIN and sees only their own deliveries; they can mark an order picked up and, with the customer's code, delivered.",
    "A delivery order can't be placed without a map pin, and its distance is measured from that pin.",
    "Resetting a PIN, switching the login or the rider off, or removing the rider signs them out at once.",
  ],
  expectNot: [
    "A rider's token must NOT open anything in the dashboard, the kitchen or another rider's deliveries.",
    "The delivery code must NOT be sent to the rider or shown in the dashboard's orders.",
    "A delivery code must NOT be guessable by trying every number.",
    "The PIN must NOT be stored or returned in clear.",
  ],
};

export const run = (d) => runSuite(d, "rider-app-api.mjs", { timeoutMs: 6 * 60_000 });
