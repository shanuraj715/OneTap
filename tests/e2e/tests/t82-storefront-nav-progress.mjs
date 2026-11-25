// T82 — A progress bar at the top of the storefront while the page changes.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t82-storefront-nav-progress",
  title: "A thin progress bar across the top of the storefront while the page changes — starts at once, creeps, finishes and fades when the page arrives, ignores taps that go nowhere, gives up if nothing comes",
  area: "storefront",
  browser: true,
  fresh: false,
  summary: "Runs suites/storefront-nav-progress.mjs in Chrome against the bench store, with the server's answers for the next page held back for about two seconds (a slow network). At rest there is no bar; when shown it is a 3px line fixed at the very top, the full width, above every sticky bar and pop-up, never catching a tap. A tap on a link to another page of the store (a footer page) shows it within a quarter of a second, it creeps forward without reaching the end, the old page stays until the new one arrives, then it runs to the end and fades (running → done → idle, once). Back / Forward shows it too. These do NOT start it: a link to the page you are on, a #hash link, another website, a new-tab link, a download, ctrl / ⌘ / shift / middle click, a link marked data-no-progress. A tap whose page never comes starts it and it gives up and fades within about 8 seconds. A phone shows the same full-width line. Choosing an outlet in the outlet picker (code changes the page, no link) shows the bar and finishes it.",
  expect: [
    "The bar shows at once after a tap on a link to another page, creeps, and finishes and fades when the page arrives.",
    "Back / Forward and choosing an outlet in the picker show it too.",
    "It gives up by itself within about 8 seconds if no page arrives.",
  ],
  expectNot: [
    "A link to the current page, a #hash, an external site, a new tab or a modified click must NOT start the bar.",
    "The bar must NOT reach the end before the new page arrives, and must NOT block taps.",
  ],
};

export const run = (d) => runSuite(d, "storefront-nav-progress.mjs");
