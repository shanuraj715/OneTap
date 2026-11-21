// T70 — Cache page store by store.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t70-cache-console-ui",
  title: "Cache page store by store — see what each store has remembered and clear one store's cache",
  area: "platform",
  browser: true,
  fresh: false,
  summary: "Runs suites/cache-console-ui.mjs in Chrome as the platform super admin on the bench. Platform → Cache has a 'Store by store' table: every store with something remembered has a row with its item count and size, a 'View items' button (filters the list to that store only) and a 'Clear this store's cache' button; clearing Acme says how many items it cleared, removes them on the server, leaves Beta Bites untouched, the table updates by itself and Acme's storefront still loads straight after; the store's own page (Cache tab) has the same clear button.",
  expect: [
    "Each store's remembered items are listed with a clear button; clearing one store leaves the others alone.",
  ],
  expectNot: [
    "Clearing one store must NOT clear another's cache.",
    "No errors in the browser.",
  ],
};

export const run = (d) => runSuite(d, "cache-console-ui.mjs");
