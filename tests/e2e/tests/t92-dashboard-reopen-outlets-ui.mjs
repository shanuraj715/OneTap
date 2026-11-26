// T92 — Dashboard: re-seating a table when an order is put back, and giving team members outlets.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t92-dashboard-reopen-outlets-ui",
  title: "Dashboard: an order put back from Completed seats its table again (or asks which free table); Users & roles gives team members outlets",
  area: "orders",
  browser: true,
  fresh: false,
  summary: "Runs suites/dashboard-reopen-outlets-ui.mjs in Chrome against the bench. Orders: a completed, paid order at T2 is put back to Preparing from its 'Set status manually' menu — the page says 'Table T2 is seated again', T2 shows seated, no pop-up. With another party at T1, putting the first party's order back shows a pop-up that names the problem, lists the FREE tables grouped by area with their seats (the taken table is not offered), keeps the confirm button off until one is picked and changes nothing meanwhile; choosing T3 seats the party there and the order goes to Preparing; 'Leave the order as it is' changes nothing. Users & roles: a store with several outlets asks which outlets a new person works in (Add user is off until one is chosen), lists them with their outlets, saves exactly what was ticked; the mapped person's own dashboard shows nothing of the other outlet, their outlet list has just theirs and another outlet is refused (403); 'Change outlets' → All outlets takes effect at once without signing in again.",
  expect: [
    "With the table free, putting the order back seats it again and says so; with someone else there the operator picks a free table from a pop-up.",
    "A new person must be given outlets (or All outlets); the list shows them; changing them takes effect at once.",
    "A mapped person sees nothing of other outlets.",
  ],
  expectNot: [
    "The pop-up must NOT offer the taken table, and must NOT change anything before a table is chosen.",
    "Add user must NOT work with no outlet chosen in a multi-outlet store.",
    "No errors in the browser.",
  ],
};

export const run = (d) => runSuite(d, "dashboard-reopen-outlets-ui.mjs", { timeoutMs: 8 * 60_000 });
