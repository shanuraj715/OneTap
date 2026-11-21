// T72 — The storefront menu is drawn in chunks as the diner scrolls.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t72-menu-chunks",
  title: "The storefront menu is drawn in chunks as the diner scrolls",
  area: "storefront",
  browser: true,
  fresh: false,
  summary: "Runs suites/menu-chunks-ui.mjs in Chrome on the bench storefront with 90 extra dishes in three categories (deleted again at the end). The menu opens with only the first chunk of dishes drawn (about 24) and a 'more is coming' marker; each scroll to the end draws more (never fewer) until every available dish is on the page exactly once and the marker is gone; choosing the last category jumps straight to it though it hadn't been drawn yet and rests it just under the category bar; the Veg filter shows exactly the vegetarian dishes after scrolling; a 375 px phone opens with the first chunk and scrolling brings the rest.",
  expect: [
    "The first chunk only at first; each scroll draws more until all dishes are there once; the last category is reachable at once; filters still work.",
  ],
  expectNot: [
    "No dish may be lost or drawn twice; no errors in the browser.",
  ],
};

export const run = (d) => runSuite(d, "menu-chunks-ui.mjs");
