// T64 — Two staff taking an order for the same table: only one gets it; the other can move to a free table.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t64-table-conflict",
  title: "Two staff taking an order for the same table — the second is told the table is no longer free and can move the order to a free table",
  area: "tables",
  browser: true,
  fresh: false,
  summary: "Runs suites/table-conflict.mjs. API: two orders for one FREE table sent at the very same moment — exactly one is accepted, the other refused (409, code table_taken), only ONE party is seated and one order exists. The order carries the party the screen saw at that table (null = free): an order started on a free table is refused once the table is taken; adding to the party that really is there still works; a different or vanished party is refused; a free table still free takes the order; an older screen that sends nothing is unchanged. Browser: a waiter picks T4, adds a dish and types a number; another waiter sends an order for T4 first; pressing Send shows 'Table T4 is no longer free' with the free tables as buttons (the taken one is not offered), nothing is sent to T4, Send stays off; choosing T5 moves the order there with the typed customer number, and sending lands it on T5 while T4 keeps only the first order.",
  expect: [
    "Of two simultaneous orders for one free table exactly one is accepted; one party at the table.",
    "The second waiter sees 'no longer free' with free tables to move to; moving keeps the items and the customer's number; the order lands on the new table.",
    "Adding to the party that is really at the table still works; older screens still work.",
  ],
  expectNot: [
    "Two parties must NOT end up on one table; the refused order must NOT be sent to the taken table.",
    "The Send button must NOT work while the table is taken.",
    "No errors in the browser.",
  ],
};

export const run = (d) => runSuite(d, "table-conflict.mjs");
