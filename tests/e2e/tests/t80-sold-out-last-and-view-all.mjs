// T80 — Storefront menu: sold-out dishes come last in their category, and "View all" follows the Veg / Non-veg filter.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t80-sold-out-last-and-view-all",
  title: "Menu: sold-out dishes go to the end of their category, and 'View all' disappears when a filter leaves only a few dishes",
  area: "storefront",
  browser: true,
  fresh: false,
  summary: "Runs suites/storefront-sold-out-last.mjs in Chrome against the bench store (desktop 1280px and a phone 390px). A custom menu layout with eight categories is built through the API. Sold-out first: a category of 15 with two sold-out dishes shows the 13 orderable ones in their own order and the two sold-out ones last (closed, the first 6 shown are all orderable; open, …15, 02, 07 and exactly two 'Sold out' labels, also on screen); a category with nothing sold out keeps its order; a section capped at 5 dishes is filled with orderable dishes first; a price-sorted section keeps its order and its dearest (sold-out) dish drops to the end; when a dish is orderable again it returns to its place. View all: with no filter the four long categories have the button; with Veg a 15-dish category cut to 3 shows all 3 and NO button, one cut to exactly 6 has none, one cut to 7 shows 6 and 'View all (1 more)' and still opens, the button beside a title goes too, the all-veg category keeps its button; Non-veg brings 'View all (6 more)' for the 12 left; All brings every button back. The phone checks the same. Everything is removed afterwards.",
  expect: [
    "Sold-out dishes are the last cards of their category, in their own order; the dishes before them keep theirs.",
    "A capped or price-sorted section is built from orderable dishes first.",
    "After a filter, View all only shows while more dishes remain than the first-few limit (and its '(n more)' count matches).",
  ],
  expectNot: [
    "A sold-out dish must NOT take one of the first visible places while orderable dishes wait behind 'View all'.",
    "'View all' must NOT show for a category the filter has cut to the first-few limit or less.",
  ],
};

export const run = (d) => runSuite(d, "storefront-sold-out-last.mjs");
