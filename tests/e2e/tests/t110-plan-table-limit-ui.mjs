// T110 — Tables on a plan: the wide plan pop-up, the tables limit in fives, the store page, the owner's Tables page, the onboarding form.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t110-plan-table-limit-ui",
  title: "Plans: a wide New plan pop-up that needs no scrolling, a tables limit in steps of 5 (plan, store, onboarding form), and the owner's Tables page when the plan's tables are all used",
  area: "platform",
  browser: true,
  fresh: false,
  summary: "Chrome against the bench, as the platform super admin and as the Beta store's owner (Beta is on a 5-table Starter plan). Plans: the cards say '5 tables' / 'Unlimited tables'. The New plan pop-up is at least 1,200 px wide on a 1,440 px screen and shows the whole plan without scrolling (also with the website price fields open); Features, Visual effects and On the website stand side by side, and the limits are on one row (people, tables). The Tables box starts at 5 and rounds what is typed UP to the next five (12 → 15, 4 → 5, 54 → 55, 0 → 5, 7 → 10); Enter rounds it and does NOT save the plan; Unlimited switches the number off and back on. 'Include every feature' ticks and locks the list without crashing (it did crash: it used a function the pop-up didn't have). A Custom plan hides the limits. A plan is saved with 15 tables, shows '15 tables' on its card, edits to 25. The store's page shows 'Tables n / 5', its Plan & limits tab says 'From plan — 5', a 'Custom number' of 12 becomes 15 and is saved for this store only (the plan keeps 5), 'From plan' undoes it. The owner's Tables page says '3 of 5 tables used', adding the 4th updates it at once, with 5 of 5 a warning appears (and the Add table button is off) and the server refuses a 6th; after one is removed it works again, and adding the last free table brings the warning up without reloading. The onboarding form's Tables box starts at 0 and moves by five; 10 tables on Starter raises a red warning and a problem in the Plan fit panel, 'Add the extra tables for this client' turns it amber and clears the problem, typing 12 gives 15, stepping down to 0 removes it; Pro (no table limit) shows no warning; Custom has a 'Tables for this client' box starting at 5. The Price list has 'Every 5 extra tables (₹)' starting at 100.",
  expect: [
    "The New plan pop-up is wide and a normal screen shows all of it without scrolling.",
    "Wherever a table limit is typed, it is rounded UP to the next five.",
    "A store whose plan's tables are all used sees a warning and can't add a table; removing one brings it back.",
    "The onboarding form warns when the tables asked for are more than the plan allows, and lets the representative add them for this client.",
  ],
  expectNot: [
    "Pressing Enter in the tables box must NOT save the plan.",
    "'Include every feature' must NOT crash.",
    "No errors in the browser.",
  ],
};

export const run = (d) => runSuite(d, "plan-table-limit-ui.mjs", { timeoutMs: 8 * 60_000 });
