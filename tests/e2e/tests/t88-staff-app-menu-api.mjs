// T88 — The staff app loads the menu once, then asks only which dishes can't be ordered right now.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t88-staff-app-menu-api",
  title: "Staff app menu: GET /api/menu/unavailable lists only the dishes that can't be ordered right now (same rule as the order check), and the menu carries a version",
  area: "menu",
  browser: false,
  fresh: false,
  summary: "Runs suites/staff-app-menu-api.mjs on a private API with an in-memory database (no browser). A store with one of every kind of dish: plain, switched off, counted stock at zero, counted but running low, counted with plenty, outside its serving hours, and a combo with a part that is off. GET /api/menu/unavailable lists exactly the ones that can't be ordered, each with the words to show; a dish that is only running low is reported separately with how many are left; the answer is a small fraction of the whole menu. Switching a dish on or adding stock takes it off the list (and the combo that needed it); switching one off puts it on at once. A dish on the list is refused when priced for an order and one that is not on it can be priced (the same rule). The menu carries a version that does NOT change when stock counts change but DOES change with a new price or a new dish, and the unavailable answer carries the same version.",
  expect: [
    "Exactly the dishes that can't be ordered now are listed, with their labels; everything else is absent (absent = can be ordered).",
    "The list follows the restaurant: switching on / stock added removes a dish, switching off adds it.",
    "The menu version changes for a price or a new dish, not for stock counts.",
  ],
  expectNot: [
    "A dish running low or with plenty left must NOT be listed as unavailable.",
    "A dish the order check refuses must NOT be missing from the list.",
    "The whole menu must NOT be needed to know what is unavailable.",
  ],
};

export const run = (d) => runSuite(d, "staff-app-menu-api.mjs", { timeoutMs: 5 * 60_000 });
