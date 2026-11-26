// T90 — A team member can be mapped to one or several outlets and then sees and uses only those.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t90-staff-outlet-access-api",
  title: "Team members mapped to outlets: they see (and can work in) only those outlets; nothing mapped = every outlet; the owner can change it later",
  area: "security",
  browser: false,
  fresh: false,
  summary: "Runs suites/staff-outlet-access-api.mjs on a private API with an in-memory database (no browser). A store with three outlets and a second store. Accounts are created with one outlet, several, none (= every outlet, how existing accounts work) and as kitchen; an outlet of ANOTHER store or a made-up id is refused, a repeated outlet is kept once, an owner always has every outlet. GET /api/outlets then shows each person only their outlets (the others' ids and names are nowhere in the answer, also for the staff app's Bearer sign-in); tables, orders, tables in service and pricing/placing an order are refused (403) for an outlet they were not given, allowed for their own; an unmapped person and the owner see all. The owner can add or take away outlets later — it takes effect at once without a new sign-in — an empty list means every outlet again, editing the name leaves outlets alone, the owner's own account cannot be edited from the store, and a staff member cannot change anyone's.",
  expect: [
    "A mapped person sees only their outlets and is refused (403) for any other outlet — in the dashboard and in the staff app.",
    "Nothing mapped = every outlet, so existing accounts keep working.",
    "Changing the mapping takes effect at once.",
  ],
  expectNot: [
    "Another outlet's name or id must NOT appear in a mapped person's outlet list.",
    "An outlet of another store must NOT be accepted.",
    "A made-up outlet id must NOT crash the server (500) — it is a clear 400.",
  ],
};

export const run = (d) => runSuite(d, "staff-outlet-access-api.mjs", { timeoutMs: 5 * 60_000 });
