// T78 — The storefront's tab title is the store's name.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t78-storefront-title",
  title: "The storefront's browser-tab title is the store's name (and follows a rename)",
  area: "storefront",
  browser: true,
  fresh: false,
  summary: "Runs suites/storefront-title-ui.mjs in Chrome against the bench store. The platform admin renames the store ('Title Test Cafe'); the home page's tab title is exactly that name and exactly the words of the big heading on the page (it used to be one fixed product name for every store), the page description talks about the store and not about the platform. Renaming again ('Renamed Again Co') shows in the tab and heading on the very next visit. Every outlet of the store has the same title; the Account page ('Your account — <store>') and a store page ('<page> — <store>') keep naming the store; a table's QR page is 'Table <number> — <store>' and a wrong code gets a plain title. A store with several outlets shows the picker with the store's name as its title. The store gets its old name back at the end.",
  expect: [
    "The tab title of the home page, every outlet, the table page and the outlet picker is the store's name.",
    "A rename shows in the tab on the next visit.",
    "Inner pages still read '<page> — <store>'.",
  ],
  expectNot: [
    "No store page may show the one fixed product name in the tab.",
    "A wrong table code must NOT reveal the store's name.",
  ],
};

export const run = (d) => runSuite(d, "storefront-title-ui.mjs");
