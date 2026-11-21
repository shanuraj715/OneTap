// T67 — Following an order.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t67-order-tracking-api",
  title: "Following an order — the tracking API, lateness, cancelling an order nobody accepts, and error messages that name the box",
  area: "orders",
  browser: false,
  fresh: false,
  summary: "Runs suites/order-tracking-api.mjs on its own in-memory API with two stores. GET /api/customer/orders/:id: signed-out → 401, a made-up id → 404, another customer of the store → 404, a customer of another store → 403; the owner customer gets status, history (status + time only — never which team member did it), items, money, payment and outlet; GET /api/orders/:id for a customer also hides who changed the status while the team still sees it; a change by staff shows on the very next read and the order is read from the database every time. Running late: an unaccepted order past the limit says 'accept', an accepted one past the cooking limit says 'prep', new / pre-order-for-later / finished orders and stores with the alerts off say nothing. Auto-cancel (Settings → Missed-order alerts, 0 = never): only orders nobody accepted within N minutes and not already paid online are cancelled, with the reason in the history; pre-orders, accepted and young orders and other stores are untouched; the customer's page and Account list show it as cancelled with the reason. Error messages: tables (21-character number, empty, 0 / 51 / 2.5 / text seats), duplicate table numbers ignoring capitals and spaces (create and rename), the missed-order limits and a coupon form all name the box and what is allowed.",
  expect: [
    "A customer can follow only their own order; staff ids never reach a customer.",
    "Late and cancelled orders are described; an order nobody accepts is cancelled only when the store asked for it and it isn't paid online.",
    "Refused requests say which box is wrong; 'T9' and 't9' are one table.",
  ],
  expectNot: [
    "A customer must NOT see another customer's or another store's order.",
    "An order paid online, a pre-order for later, or one that was accepted must NOT be auto-cancelled.",
    "A refused request must NOT say only 'Validation failed'.",
  ],
};

export const run = (d) => runSuite(d, "order-tracking-api.mjs");
