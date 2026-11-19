// T35 — Storefront: with many categories the category bar stays one short row (Chrome, three screen sizes).
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t35-storefront-category-bar",
  title: "Storefront — with 30+ categories the sticky category bar stays ONE short row that scrolls sideways, and phones keep one short bar with a Categories sheet",
  area: "storefront",
  browser: false,
  fresh: false,
  summary: "Runs suites/storefront-category-bar.mjs: adds 30 categories (one dish each) to Acme Momos' fake menu through the bench API, then in Chrome at desktop, tablet and phone sizes checks the storefront. Desktop: every category is a chip but the sticky bar is one short row (under 80 px — it used to wrap into seven rows), all chips on one line, the row scrolls sideways with no scrollbar, ‹ › buttons appear (‹ off at the start) and move it, choosing a chip far along scrolls the menu to that category just below the bar, highlights that chip and brings it into view; scrolling the page by hand moves the highlight (and the row) to the category being read. Tablet and phone: one short bar with the Veg/Egg/Non-veg filter and the Categories button on the same row, fully on screen; the sheet fits the screen, lists every category and scrolls; picking one lands just under the bar; no sideways page scroll. The 30 categories are removed at the end.",
  expect: [
    "With 30+ categories the sticky bar is one row under 80 px tall on desktop, tablet and phone; all chips on one line.",
    "Too many chips for the width: the row scrolls sideways (no scrollbar), with ‹ › buttons for a mouse.",
    "Choosing a chip scrolls to that category just under the bar; the chip is highlighted and in view; scrolling the page keeps the highlight and the row in step.",
    "Phone/tablet: filter + Categories button on one row, sheet fits the screen and scrolls, picking a category lands just under the bar.",
  ],
  expectNot: [
    "The category chips must NOT wrap into several rows or make the sticky bar tall.",
    "The page must NOT scroll sideways at any size.",
    "The highlighted chip must NOT be left hidden off to the side of the row.",
    "The browser must NOT log errors or warnings.",
  ],
};

export const run = (d) => runSuite(d, "storefront-category-bar.mjs");
