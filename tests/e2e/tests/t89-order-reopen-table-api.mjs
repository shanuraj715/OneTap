// T89 — Putting a Completed order back to Preparing seats its table again; if somebody sits there meanwhile, the operator picks another table.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t89-order-reopen-table-api",
  title: "An order put back from Completed/Cancelled to being worked on seats its table again — or asks for another table when someone else is there",
  area: "orders",
  browser: false,
  fresh: false,
  summary: "Runs suites/order-reopen-table-api.mjs on a private API with an in-memory database (no browser). A dine-in order is taken at T1, completed and paid (the table frees itself — intended), then put back to Preparing by hand. With T1 still free the party is seated again with the same session (the bug was that T1 stayed free), the answer says so, and nobody else can be seated there. With another party at T1 the change is REFUSED (409 table_taken, in words, with the free tables and their areas) and nothing changes; choosing a free table puts the order back and seats the party there (orders and the session's history follow), choosing an occupied or missing table is refused; the other party keeps T1. While the party's session is still open there is nothing to re-seat. A voided table's cancelled order is put back the same way. Staff can still make the correction.",
  expect: [
    "Putting the order back with the table free seats the party's table again (same session).",
    "With someone else at the table: 409 table_taken + free tables; the order stays Completed until a table is chosen.",
    "Choosing a free table seats the party there; the order, the session and the tables all agree.",
  ],
  expectNot: [
    "The table must NOT be left free while an order for it is being made.",
    "A refusal must NOT change the order or touch the other party's table.",
    "An occupied or missing table must NOT be accepted as the new table.",
  ],
};

export const run = (d) => runSuite(d, "order-reopen-table-api.mjs", { timeoutMs: 5 * 60_000 });
