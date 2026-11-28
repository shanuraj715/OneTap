// T138 — Ratings dish by dish: the customer rates the order and each dish; the store sees ratings by customer, by outlet and by dish
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t138-ratings-api",
  title: "Ratings: a customer rates the order AND each dish on its own (with notes); the store sees them by customer, by outlet and by dish (the same dish at two outlets is one row) — and who may look",
  area: "feedback",
  browser: false,
  fresh: false,
  summary: "A private API on an in-memory database with two outlets, three customers and completed orders. Rating: the order's dishes come back with their ids; the dish names are taken from the ORDER (never the phone); a dish not in the order, 0 or 6 stars, more than 30 dishes, a 201-character note, an order still cooking and someone else's order are all refused; sending no dish list leaves dish ratings alone, a shorter list replaces them, an empty list removes them. The store's views: by outlet (counts, average, stars, notes, dish ratings, happy share, all together, narrowed by outlet and by period), by customer (average, lowest, last words, sorting, search by name or phone as plain text, paging) and by dish (grouped across outlets and spellings with a per-outlet split, best / worst / most, search, the reviews of one dish). A cashier, a store without the Ratings feature and someone not signed in are refused, and another store never sees these ratings.",
  expect: [
    "Each dish of a completed order can be rated 1–5 with a short note, and the order's own rating still works.",
    "The store can see ratings by outlet, by customer and by dish, and the numbers match what the customers gave.",
    "The same dish at two outlets (and spelled differently) is one row in the by-dish view, with a split per outlet.",
  ],
  expectNot: [
    "A dish that was not in the order must NOT be ratable.",
    "A search must NOT be treated as a pattern.",
    "Another store must NOT see these ratings; a cashier must NOT see any of the views.",
  ],
};

export const run = (d) => runSuite(d, "ratings-api.mjs", { timeoutMs: 5 * 60_000 });
