// T57 — The pages a payment gateway asks for (Razorpay etc.): generated from the outlet's own settings, and linked from the landing page.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t57-policy-pages",
  title: "Pages for payment-gateway activation — About, Contact, Pricing, Privacy, Terms, Refunds, Delivery — and their links on the outlet picker",
  area: "storefront",
  browser: true,
  fresh: false,
  summary: "Runs suites/policy-pages.mjs. (1) The generator apps/api/src/scripts/publish-policy-pages.js is run in-process for a delivering and a non-delivering outlet: seven valid pages each, footer-linked, written from the outlet's own phone, email, hours, delivery fee / limits / minimum order and GST setting; an outlet that doesn't deliver says so; refunds say when a cancel is possible and how long a refund takes; the privacy policy says card details are never stored; none carries a 'template' disclaimer. (2) In Chrome on the bench store (two outlets), the landing page (the outlet picker, which is all a reviewer sees at the bare address) shows the store's published pages at its foot — Privacy policy, Refunds & cancellation, About us — each linking to the outlet's own page address, and a link opens. The pages it creates are removed again.",
  expect: [
    "The generator makes the seven pages for every outlet, valid and linked in the footer, from that outlet's real settings.",
    "An outlet without delivery says it does not deliver.",
    "The landing page of a multi-outlet store links to the store's pages; a link opens the page.",
  ],
  expectNot: [
    "A published page must NOT say it is only a template.",
    "An outlet that doesn't deliver must NOT promise delivery.",
    "The bench must NOT be left with the test pages.",
  ],
};

export const run = (d) => runSuite(d, "policy-pages.mjs");
