// T71 — Moving between the pages of the storefront never reloads the app.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t71-soft-navigation",
  title: "Storefront links move between pages without reloading the app (header, Order button, footer pages, message bar, phone menu)",
  area: "storefront",
  browser: true,
  fresh: false,
  summary: "Runs suites/soft-navigation-ui.mjs in Chrome on the bench storefront. A marker is put on the window before each click; a real page load would wipe it. The header's 'My orders' and 'Menu', a footer page link, the message bar's link, the header's Order button and (on a 375 px phone) the menu drawer's 'My orders' all change the page and keep the marker — and the browser reports exactly one page load for the whole desktop walk. On the menu page 'Menu' stays an in-page jump (#menu).",
  expect: [
    "Clicking any link to another page of the store changes the page and the marker survives (no reload).",
    "The whole walk is one page load.",
  ],
  expectNot: [
    "No link to another page of the store may reload the whole app.",
    "No errors in the browser.",
  ],
};

export const run = (d) => runSuite(d, "soft-navigation-ui.mjs");
