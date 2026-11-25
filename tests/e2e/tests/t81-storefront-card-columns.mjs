// T81 — "N cards a row" is a maximum: fewer on a narrower screen, nothing cut off.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t81-storefront-card-columns",
  title: "Menu cards: '3 a row' shows 3 only where 3 fit — 2 on a portrait tablet, 1 on a phone — and no card is ever cut off, pushed past the screen or on top of another",
  area: "storefront",
  browser: true,
  fresh: false,
  summary: "Runs suites/storefront-card-columns.mjs in Chrome against the bench store. A custom menu layout has one section per card style (ten styles) set to '3 per row', plus sections set to 2, 4 and 1. Each is measured at 390 (phone), 744 and 820 (tablet portrait), 1024 (tablet landscape) and 1280px: the number of columns must equal what fits (the row's width divided by the card style's own minimum width, never more than the chosen number; one column on a phone), every card must stay inside its row without touching another, the cards share the whole row, and the page must not scroll sideways. The reported case (image overlay, 3 a row, which ran past the right edge on a tablet) is checked by name: 2 a row at 744 / 820px, 3 at 1024 and 1280px, 1 on a phone.",
  expect: [
    "A row holds the chosen number of cards only while each card keeps its own minimum width; otherwise fewer (3 → 2 → 1).",
    "Cards fill the row; no card is cut off or overlaps another; the page never scrolls sideways.",
    "1 a row stays 1 at every width.",
  ],
  expectNot: [
    "A card must NOT be pushed past the right edge of the screen.",
    "'3 a row' must NOT squeeze 3 cards onto a screen too narrow for them.",
  ],
};

export const run = (d) => runSuite(d, "storefront-card-columns.mjs");
