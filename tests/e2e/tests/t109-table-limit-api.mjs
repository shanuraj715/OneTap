// T109 — Tables are limited by the plan, in steps of 5.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t109-table-limit-api",
  title: "Plans limit tables, in steps of 5 (Starter 5, Business 20, Custom by hand): only 5, 10, 15 … are accepted, a store can't add a table past its limit, and the price is per block of 5",
  area: "platform",
  browser: false,
  fresh: false,
  summary: "Runs suites/table-limit-api.mjs against a private API on an in-memory database. The rules: a limit of 5, 10, 15 … is accepted, while 12, 19, 54, 7, 4, 0, 2.5 and -5 are refused with a plain message; no limit means unlimited (every plan made before this keeps working); 12 tables are 3 blocks of five and round UP to 15; the presets are Starter 5 and Business 20. Through the console API: a plan with 12 tables is refused (400), 10 is created and can be edited to 15 but not 19, a plan can still be unlimited, a Custom plan stores no limit of its own. A store on a 5-table plan: its owner adds five tables across two outlets, the sixth is refused at either outlet with a message that says what the plan allows and that tables are added 5 at a time, nothing is created by the refused requests, the store's plan answer and the console show 5 of 5, a full limit is not an 'over limit' problem; deleting a table frees its place at once, switching a table off does not. Raising the limit for one store (12 refused, 10 accepted) is seen immediately; the platform's own admin can go past the limit; a store with MORE tables than its limit keeps them all, can't add one and is NOT put into the over-limit grace period. Stores that existed before the limit (no plan, or a plan saved without it) stay unlimited. Custom plan: a store with 8 tables gets a limit of 10, one with none gets 5, a number set by hand is kept. The onboarding form: Starter with 12 tables raises a plain issue that blocks publishing until 'add for this client', which publishes the store with 15; Business allows 20 not 25; 0 tables never raises an issue; Custom publishes with what was asked rounded up; a form saved before tables existed opens fine; the overrides really give a Starter store 15 tables. The price: ₹100 for every 5 tables beyond the plan (12 charged as 15, the Price list page's number is used), Custom starts from the dearest plan and charges the blocks beyond it, 'what else would do' and 'do the prices add up' count tables.",
  expect: [
    "Only 5, 10, 15 … are accepted as a table limit; 12, 19, 54 are refused with a clear message.",
    "A store can't add a table past its plan's limit, and the message says so; removing a table frees the place at once.",
    "Stores and plans that existed before the limit stay unlimited.",
    "The price is per block of 5 tables beyond the plan.",
  ],
  expectNot: [
    "A refused request must NOT create a table.",
    "A store with more tables than its limit must NOT lose a table or be put into the over-limit grace period.",
    "A plan saved before tables had a limit must NOT suddenly cap a store.",
  ],
};

export const run = (d) => runSuite(d, "table-limit-api.mjs", { timeoutMs: 6 * 60_000 });
