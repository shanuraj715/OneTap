// T81 — Menu cards resize between 70% and 120% of their natural width; beyond that the number of cards in the row changes.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t81-storefront-card-columns",
  title: "Menu cards resize with the screen (70–120% of their natural width) and the number per row follows — '3 a row' is only a maximum, nothing is cut off, squeezed or on top of another",
  area: "storefront",
  browser: true,
  fresh: false,
  summary: "Runs suites/storefront-card-columns.mjs in Chrome against the bench store. A custom menu layout has one section per card style (ten styles) set to '3 per row', one per grid style with NO number chosen, and sections set to 2, 4 and 1. Each is measured at 390, 600 (phones), 744, 820, 930 (tablets in portrait, 930 is the width of the reported screenshot), 1024 (tablet in landscape) and 1280px. The rule: each card style has a natural width (115% of its narrowest design width); a card is drawn between 70% and 120% of it, and when a whole number of cards cannot fit inside that window the NUMBER in the row changes instead; a number chosen by the store is the most there may be. The suite carries its own copy of the rule and checks, for every style and width: the number of columns, no card outside the row or on top of another, no card below 70% of its natural width (unless it is alone in its row), cards within 120% when fewer than the chosen number are shown, cards share the whole row, the page does not scroll sideways. The reported case (image overlay, which overlapped and ran past the screen edge on a tablet) is checked by name: 2 a row at 744px, 3 at 930 / 1024 / 1280px, 1 on a phone.",
  expect: [
    "Cards are drawn between 70% and 120% of their natural width; when that is not possible the number of cards in the row changes.",
    "'3 a row' never shows more than 3; a narrower screen shows fewer. 1 a row stays 1.",
    "Cards fill the row; none is cut off, overlaps another, or makes the page scroll sideways.",
  ],
  expectNot: [
    "A card must NOT be squeezed below 70% of its natural width (unless it is alone in its row).",
    "A card must NOT be pushed past the right edge of the screen.",
  ],
};

export const run = (d) => runSuite(d, "storefront-card-columns.mjs");
