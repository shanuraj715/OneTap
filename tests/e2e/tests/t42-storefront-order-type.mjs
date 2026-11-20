// T42 — Storefront order bar (menu page) AND checkout page: Takeaway and Delivery are ALWAYS both shown; the one an outlet doesn't offer is disabled (Chrome).
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t42-storefront-order-type",
  title: "Storefront — the Takeaway / Delivery choice (menu page and checkout) always shows both; one the outlet doesn't offer is shown greyed out and can't be chosen",
  area: "storefront",
  browser: false,
  fresh: false,
  summary: "Runs suites/storefront-order-type.mjs against the bench stores in Chrome. A takeaway-only outlet (Acme's second outlet) shows BOTH 'Takeaway' (selected, available) and 'Delivery' (disabled, faded, 'not allowed' pointer, a tooltip, and a line under the switch saying 'Delivery isn't available from this outlet.'); pressing Delivery does nothing, the Tab key skips it, and a remembered 'delivery' from another outlet doesn't select it here. An outlet with both lets either be chosen and shows no 'isn't available' line. Beta Bites — ONE outlet, takeaway only — now shows the switch too (the bar used to be hidden when there was nothing to choose between). A delivery-only outlet shows Takeaway disabled and Delivery selected, with the line saying Takeaway isn't available. An outlet with neither takeaway nor delivery shows no switch. On a 390px phone the switch and its line fit and Delivery is still disabled. The outlet's settings are put back at the end. The same is checked on the CHECKOUT page (\"Step 4 of 4 · Review & pay\" → \"How would you like it?\"): with one dish in the cart and a signed-in customer, a takeaway-only outlet shows Takeaway (selected) and a greyed-out Delivery with a tooltip and the line 'Delivery isn't available from this outlet.' (pressing it does nothing — no delivery address or 'paid online' note — and the order can still be placed); an outlet with both lets the customer switch to Delivery and back; delivery switched on without online payment stays greyed out (delivery is prepaid); a delivery-only outlet greys out Takeaway and starts on Delivery; Delivery chosen on the menu page is already selected in checkout; it fits a 390px phone.",
  expect: [
    "Takeaway and Delivery are both always shown on the menu page's order bar (when the outlet takes online orders at all).",
    "An order type the outlet doesn't offer is disabled and visibly off, explained by a tooltip and a line under the switch; it can't be chosen by mouse, touch or keyboard, and a remembered choice for it is ignored.",
    "A store with one outlet and one choice shows the switch too.",
    "The checkout page ('How would you like it?') shows both too, for every takeaway or delivery order: the unavailable one greyed out with the reason underneath; the one chosen on the menu page is carried over.",
    "No switch at all when the outlet offers neither takeaway nor delivery.",
  ],
  expectNot: [
    "A disabled order type must NOT be selectable, nor be selected because it was remembered.",
    "The switch must NOT be hidden just because only one order type is on — on the menu page or in checkout.",
    "A disabled Delivery in checkout must NOT open the delivery address box or change the price.",
    "The browser must NOT log errors or warnings.",
  ],
};

export const run = (d) => runSuite(d, "storefront-order-type.mjs");
