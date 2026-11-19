// T43 — The checkout page shows the coupon box only when the store has the Coupons feature (Chrome).
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t43-checkout-coupons",
  title: "Checkout — the coupon box is hidden when the platform locks Coupons for the store, and comes back when it is unlocked",
  area: "storefront",
  browser: false,
  fresh: false,
  summary: "Runs suites/checkout-coupons.mjs against the bench's Acme store in Chrome. With Coupons available, a signed-in customer's checkout has the 'Coupon' section (code box + Apply, and a wrong code is answered). The platform then LOCKS Coupons for the store (the same per-store feature lock as Stores → the store → Features in the console): the checkout page shows no 'Coupon' section, no code box and no Apply button on a desktop or a phone, the rest of checkout (order type, total, Place order) is untouched, and the server still refuses a code for that store. Unlocked again, the box comes straight back. The store's real overrides are put back at the end.",
  expect: [
    "A store whose plan has Coupons (or where the platform unlocked it) shows the coupon box at checkout and wrong codes get the usual message.",
    "A store with Coupons locked shows no coupon section at all at checkout — desktop or phone — and the rest of checkout works.",
    "Unlocking Coupons brings the box back.",
  ],
  expectNot: [
    "A store without Coupons must NOT show a coupon code box at checkout.",
    "The server must NOT accept a coupon for a store without the feature.",
    "The browser must NOT log errors or warnings.",
  ],
};

export const run = (d) => runSuite(d, "checkout-coupons.mjs");
