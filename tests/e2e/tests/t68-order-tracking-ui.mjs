// T68 — Following an order on the storefront.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t68-order-tracking-ui",
  title: "Following an order on the storefront — a page that moves by itself, links from Order placed and Account, cancelled, someone else's link, a phone",
  area: "storefront",
  browser: true,
  fresh: false,
  summary: "Runs suites/order-tracking-ui.mjs in Chrome on the bench storefront. A signed-in customer's order page /main/order/<id>: Placed with 'waiting for the restaurant to accept' and a step bar; when staff accept it the page changes to Accepted by itself (no reload), 'Check now' looks straight away, Ready says it can be collected, 'What happened' lists each step with its time, items and total are shown, and once Completed it stops refreshing. A cancelled order says Cancelled and what that means for the money, with no progress bar. The Account page has 'Follow this order →' for an order still going; the real 'Order placed' screen (ordering on the storefront) has a 'Follow your order' button to that order's own page. Another customer opening the link sees 'We can't find that order' and nothing of it; someone not signed in is asked to sign in; on a phone the page doesn't scroll sideways.",
  expect: [
    "The order page moves by itself as staff change the status and stops when the order is finished.",
    "'Order placed' and the Account page both lead to it.",
    "Only the owner of the order sees it.",
  ],
  expectNot: [
    "Another customer's link must NOT show the order.",
    "A finished or cancelled order must NOT keep refreshing.",
    "No errors in the browser.",
  ],
};

export const run = (d) => runSuite(d, "order-tracking-ui.mjs");
