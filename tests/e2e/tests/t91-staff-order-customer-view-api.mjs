// T91 — An order taken by staff for a number shows up for that customer on the storefront, with its status.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t91-staff-order-customer-view-api",
  title: "An order a waiter took for a customer's number shows in that customer's 'My orders' and tracking page when they sign in on the storefront with the same number",
  area: "orders",
  browser: false,
  fresh: false,
  summary: "Runs suites/staff-order-customer-view-api.mjs on a private API with an in-memory database (no browser). A waiter takes an order at a table for 9000000001; the customer signs in on the storefront with that number (no sign-up questions — the record exists) and finds the order in their orders list with its items, its status (Accepted — staff orders go straight to the kitchen) and 'not paid'; the tracking page follows the kitchen (Accepted → Ready, with the steps) and the list says paid once the waiter confirms payment; a second round at the same table appears too. Another customer sees none of it and cannot open it (404), someone not signed in gets 401, the same number written with +91 and spaces reaches the same orders, and a customer's Remove hides the order from THEIR list only.",
  expect: [
    "The customer sees the staff-taken order, its items, status and payment in My orders after signing in with the same number.",
    "The tracking page follows the status live.",
  ],
  expectNot: [
    "Another customer must NOT see or open it.",
    "Removing it from the customer's list must NOT remove it from the restaurant.",
  ],
};

export const run = (d) => runSuite(d, "staff-order-customer-view-api.mjs", { timeoutMs: 5 * 60_000 });
