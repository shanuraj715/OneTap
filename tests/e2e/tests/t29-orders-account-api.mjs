// T29 — A customer's order history and deleting an order: the API rules, on a throwaway database (no browser).
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t29-orders-account-api",
  title: "Order history for the storefront Account page, and deleting an order — who may, what it puts right, where it disappears",
  area: "orders",
  browser: false,
  fresh: false,
  summary: "Runs suites/orders-account.mjs: its own in-memory API with two stores (one whose plan has coins, one whose plan doesn't). Order history: a customer sees only their own orders for this store, newest first, with status, payment mode and state, items (with size and add-ons), totals, coins earned and the outlet — and nothing internal; paging works; another store's customer is refused; coins are reported only when the plan includes them AND the outlet has switched them on. Deleting: only the store owner and the platform super admin may — managers, cashiers and the kitchen get 403 and the order is untouched; an order paid online must be refunded first; cash and test-gateway orders can be deleted; coins the order used go back and coins it earned are taken back (never below zero, never twice); a ticket waiting to print is cancelled; the order vanishes from the orders list, its page, the customer's history and every query and report, but the record stays (marked with who and when); deleting a whole store wipes its deleted orders too.",
  expect: [
    "A signed-out visitor gets no history; a customer sees only their own orders, newest first, with the payment mode and whether it is paid, the items and the money.",
    "Paging with a date cursor returns the rest; a nonsense date is a 400; another store's customer is refused.",
    "Coins are sent only when the store's plan includes them and the outlet has them on.",
    "Only the store owner and the platform super admin can delete an order; manager, cashier and kitchen get 403 (and the order is untouched); a missing order is 404; deleting twice is 404.",
    "An order paid online (Razorpay) can't be deleted and the message says to refund it first; cash and test-gateway orders can.",
    "A customer can remove an order from their OWN account: only theirs, only their list; 401 signed out, 404 for someone else's, 403 through another store; harmless to repeat; the store still sees it (list, page, payment, coins) and the customer's own link still opens.",
    "Deleting puts coins right (used coins refunded, earned coins taken back, bounded by what is left, once) and cancels a waiting print ticket.",
    "A deleted order is gone from the dashboard list, its own page, status changes, the customer's history, plain and aggregate queries — yet still in the database, marked with when and by whom.",
    "Deleting a store removes its deleted orders as well.",
  ],
  expectNot: [
    "A customer must NOT see another customer's order, or staff-only details of their own.",
    "Coins must NOT be shown when the plan doesn't include them.",
    "A deleted order must NOT appear in any list or report, and must NOT refund or take coins twice.",
    "An order paid online must NOT be deletable.",
    "A customer hiding an order must NOT hide it from the store, change its payment or coins, or touch anyone else's order.",
    "A store's deleted orders must NOT survive the store being deleted.",
  ],
};

export const run = (d) => runSuite(d, "orders-account.mjs");
