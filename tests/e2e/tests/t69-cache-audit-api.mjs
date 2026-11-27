// T69 — Cache audit.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t69-cache-audit-api",
  title: "Cache audit — what is remembered is dropped the moment it changes; orders, tables and bookings are always read live",
  area: "platform",
  browser: false,
  fresh: false,
  summary: "(Also: clearing the cache has four scopes — everything, the admin panel's own items (those that belong to no store), one store, one outlet — and the number each reports equals the list the console shows for it; an outlet of another store is refused 404, a missing outlet or an unknown scope 400, a store owner 403.) Runs suites/cache-audit-api.mjs on its own in-memory API and counts every database read a request causes. Remembered (and dropped at once on change): who is signed in — the second request reads nothing; signing out, switching a person off, changing their role and pausing their access are each effective on the very next request, an expired session is refused; the outlet check (blocking an outlet turns the team away on the very next request, unblocking lets them back); a store's settings (pickup times, delivery distance) and the offers list (a new coupon appears, a used-up or out-of-date one disappears, at once); a customer's sign-in with their coins always current and a profile change visible at once. Always live (every request reads the database): the order list, one order's status, the kitchen screen, tables, which tables are taken, running tables, bookings, booking summary, print jobs, dashboard numbers, riders — and a change is seen on the very next read. The console: sign-in items are never listed or openable, the new kinds are named, Store by store lists each store, clearing one store removes its items and leaves other stores' alone.",
  expect: [
    "Authenticated requests spend no reads on the session, the person or the outlet check once remembered.",
    "Every change that matters (sign-out, switch-off, role, pause, block, new coupon, settings, coins) shows on the very next request.",
    "Order status, tables, bookings, kitchen, dashboard numbers are read from the database on every request.",
  ],
  expectNot: [
    "A signed-out, switched-off or paused person must NOT get one more request through.",
    "Live data must NOT come from a remembered copy.",
    "Sign-in items must NOT be visible in the console.",
  ],
};

export const run = (d) => runSuite(d, "cache-audit-api.mjs");
