// T73 — 'Order again' says clearly which dishes couldn't be added, with space below.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t73-reorder-notice",
  title: "'Order again' says clearly which dishes couldn't be added, with space below",
  area: "storefront",
  browser: true,
  fresh: false,
  summary: "Runs suites/reorder-notice-ui.mjs in Chrome on the bench storefront. A customer's cancelled order is 'ordered again' after two of its dishes were switched off: the order page shows a bordered, raised alert with a warning icon, a title saying how many dishes couldn't be added, each dish in bold on its own line with the reason ('sold out right now'), at least 20 px of space between it and the order below, the dish that could come back is in the order, and the notice can be dismissed. The dishes are switched back on.",
  expect: [
    "The notice names every dish left out with its reason, stands out, has room below and can be dismissed.",
  ],
  expectNot: [
    "The notice must NOT be a small line of text squeezed against the order; no errors in the browser.",
  ],
};

export const run = (d) => runSuite(d, "reorder-notice-ui.mjs");
