// T06 — storefront: store favicon, steady message bar, mobile Categories sheet and delayed eased scroll.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t06-storefront-header-categories",
  title: "Storefront — favicon, steady message bar, Categories sheet on phone/tablet, delayed smooth scroll",
  area: "storefront",
  browser: false,
  fresh: false,
  summary: "Runs suites/storefront-ui.mjs at desktop, tablet and phone sizes on Acme Momos' storefront: the store's favicon is in the page head on every outlet; the message bar keeps one height while its messages change (one has a button, one doesn't); wide screens show category chips, tablet/phone show one 'Categories' button that opens a sheet; picking a category waits half a second and then glides there, landing just below the sticky bar.",
  expect: [
    "The store's favicon is in the page head, on every outlet of the store.",
    "The message bar keeps exactly one height as its messages change, and only one message is visible at a time.",
    "Desktop: category chips and no Categories button. Tablet and phone: one Categories button, a short filter bar (under 80 px) and a sheet listing every category.",
    "Choosing a category closes the sheet, waits (nothing moves for the first moment), then scrolls with an animation (several in-between positions) and lands just below the sticky bar.",
  ],
  expectNot: [
    "The message bar must NOT change height between a message with a button and one without.",
    "The page must NOT jump immediately when a category is chosen.",
    "The page must NOT scroll sideways at any of the three sizes.",
    "The browser must NOT log errors or warnings.",
  ],
};

export const run = (d) => runSuite(d, "storefront-ui.mjs");
