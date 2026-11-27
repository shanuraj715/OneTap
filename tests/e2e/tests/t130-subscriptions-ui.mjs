// T130 — Console: Rasoi Pulse's own sales — payments written down on a store's page, and the dashboard's "Rasoi Pulse business" section
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t130-subscriptions-ui",
  title: "Console → a store → Payments (write a payment down: new sale, then re-subscriptions) and the dashboard's 'Rasoi Pulse business': total sales, new sales, re-subscribed, one Day / Week / Month chart",
  area: "platform",
  browser: true,
  fresh: false,
  summary: "Chrome against the bench console (super admin). Before any payment the dashboard says so. On a store's Payments tab: the amount starts from the plan's price (₹2,499 a month; 12 months = the yearly price with 20% off; 3 months = 3 ×), a form with no amount or 0 months is off and says why, the first payment is written down as 'New sale' (with a note and who wrote it), the second is 'Re-subscribed' (paise shown), an earlier day picked with our calendar turns the oldest payment into the new sale, the same payment twice is refused, a wrong one is deleted. A second store pays once. The dashboard shows total sales, new sales, re-subscribed, paid up, latest payments, who to follow up and by plan, and ONE chart that switches Day / Week / Month against the period before (numbers equal to the API's, table twin included). A team member who can only read stores sees the payments with no form and no Delete.",
  expect: [
    "The dashboard shows total sales, new sales and re-subscribed for Rasoi Pulse itself.",
    "A store's first payment is the new sale; later ones are re-subscriptions; the amount starts from the plan's price.",
    "One chart switches between Day, Week and Month, each against the period before.",
    "A reader of stores sees the payments but has no form and no Delete button.",
  ],
  expectNot: [
    "The business section must NOT show any store's orders or sales.",
    "A form with no amount or 0 months must NOT be submittable.",
    "The same payment must NOT be written twice.",
  ],
};

export const run = (d) => runSuite(d, "subscriptions-ui.mjs", { timeoutMs: 8 * 60_000 });
