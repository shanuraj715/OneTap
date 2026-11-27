# T69 — Cache audit — what is remembered is dropped the moment it changes; orders, tables and bookings are always read live

**Area:** platform · **Last result:** ✅ PASSED (69 passed, 0 failed · 2026-11-27 20:45 · headless · 12.0 s)

**Run it alone:** `node run.mjs --only t69` (add `--visible` to watch it)

## What this test does

(Also: clearing the cache has four scopes — everything, the admin panel's own items (those that belong to no store), one store, one outlet — and the number each reports equals the list the console shows for it; an outlet of another store is refused 404, a missing outlet or an unknown scope 400, a store owner 403.) Runs suites/cache-audit-api.mjs on its own in-memory API and counts every database read a request causes. Remembered (and dropped at once on change): who is signed in — the second request reads nothing; signing out, switching a person off, changing their role and pausing their access are each effective on the very next request, an expired session is refused; the outlet check (blocking an outlet turns the team away on the very next request, unblocking lets them back); a store's settings (pickup times, delivery distance) and the offers list (a new coupon appears, a used-up or out-of-date one disappears, at once); a customer's sign-in with their coins always current and a profile change visible at once. Always live (every request reads the database): the order list, one order's status, the kitchen screen, tables, which tables are taken, running tables, bookings, booking summary, print jobs, dashboard numbers, riders — and a change is seen on the very next read. The console: sign-in items are never listed or openable, the new kinds are named, Store by store lists each store, clearing one store removes its items and leaves other stores' alone.

## Steps

1. who is signed in is remembered — and forgotten at once when it changes
2. an outlet that is blocked is refused at once
3. a store's settings are remembered — and a change shows at once
4. the offers a storefront advertises
5. a customer's sign-in is remembered, their coins never late
6. things that must be LIVE are read from the database every time
7. the console's cache pages

## What to expect (these must happen)

- Authenticated requests spend no reads on the session, the person or the outlet check once remembered.
- Every change that matters (sign-out, switch-off, role, pause, block, new coupon, settings, coins) shows on the very next request.
- Order status, tables, bookings, kitchen, dashboard numbers are read from the database on every request.

## What must NOT happen

- A signed-out, switched-off or paused person must NOT get one more request through.
- Live data must NOT come from a remembered copy.
- Sign-in items must NOT be visible in the console.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (69)

**Step 1 — who is signed in is remembered — and forgotten at once when it changes**

- the first request reads the session and the person (2 reads) — _sessions.findOne, users.findOne_
- the next one reads NOTHING from the database — _0 reads_
- a dashboard read no longer spends reads on the session, the person or the outlet check — only its own data — _orders.find, orders.countDocuments_
- a second sign-in works (and is remembered too)
- signing out takes effect on the very next request
- a cashier can read orders (and is remembered)
- switching a person off locks them out on the very next request
- a manager can open the coupons (remembered)
- changing someone's role takes effect on the very next request — _403_
- the kitchen user can read orders (remembered)
- pausing a person's access takes effect on the very next request
- an owner session (remembered)
- (a change made behind the app's back — straight in the database — is only noticed after at most 30 seconds)
- …while a change made through the app is seen at once (an expired session is refused)

**Step 2 — an outlet that is blocked is refused at once**

- the outlet check is remembered (no outlet read on the second request) — _orders.find, orders.countDocuments_
- blocking the outlet turns the team away on the very next request
- unblocking lets them back in at once

**Step 3 — a store's settings are remembered — and a change shows at once**

- pickup times for a store that has none cost no database read the second time — _0 reads_
- switching pre-orders on shows pickup times on the very next request — _true 3_
- a changed delivery distance shows at once — _5 → 7_
- …and is then remembered again

**Step 4 — the offers a storefront advertises**

- the (empty) list is remembered — _0 reads_
- a new coupon appears on the very next request — _WELCOME10_
- …and the list is remembered again
- when its last use is taken it disappears from the list at once — _0_
- a coupon whose date has passed is left out (dates are checked fresh every time)

**Step 5 — a customer's sign-in is remembered, their coins never late**

- the second request spends no reads on who the customer is — _outlets.findOne, orders.find_
- (no coins yet)
- coins added to their wallet show on the very next request — _250_
- …and coins spent too
- a changed name shows at once (the profile edit works on the stored record) — _200 Asha R._
- signing out takes effect on the very next request

**Step 6 — things that must be LIVE are read from the database every time**

- the order list: every request reads orders from the database — _orders.find+orders.countDocuments / orders.find+orders.countDocuments_
- one order's status (customer): every request reads orders from the database — _orders.findOne / orders.findOne_
- the kitchen screen: every request reads orders from the database — _orders.find / orders.find_
- the tables: every request reads tables from the database — _tables.find / tables.find_
- which tables are taken (storefront): every request reads tables from the database — _tables.find / tables.find_
- running tables: every request reads tablesessions from the database — _tablesessions.find / tablesessions.find_
- the bookings: every request reads reservations from the database
- booking summary: every request reads reservations from the database — _reservations.countDocuments / reservations.countDocuments_
- print jobs: every request reads printjobs from the database — _printjobs.find / printjobs.find_
- the dashboard numbers: every request reads orders from the database
- riders: every request reads riders from the database — _riders.find / riders.find_
- an order moved by staff is seen by the customer on the very next read
- a new table is on the storefront's list at once
- a table that just got taken shows as taken on the very next read

**Step 7 — the console's cache pages**

- sign-in entries are never listed (they are about people) — _cfg,menu,outlet,outletaccess_
- the new kinds (settings, access check, offers) are listed with words, not codes — _cfg,menu,outlet,outletaccess_
- Store by store: Acme has remembered items — _{"id":"6b099e99685c6a6ca80b252f","name":"Acme","entries":4,"bytes":6928}_
- an item can be opened and read
- a sign-in item can never be opened
- clearing ONE store's cache removes its items
- …and Acme's row shrinks (or goes) in the list
- other stores keep what they had when one store is cleared — _{"id":"6b099e99685c6a6ca80b2541","name":"Beta","entries":2,"bytes":149}_
- after clearing, the store's team is not signed out and everything still works
- items that belong to no store are the console's own (dashboard, website, unknown addresses) — _dash_
- 'admin' drops exactly the items listed as belonging to no store (the number it reports = the list) — _1 vs 1_
- …they are gone from the list
- …and not one store's item was touched (all of them are still remembered) — _7 before_
- an outlet's own items are listed under it (its menu among them) — _menu, outlet, outletaccess_
- 'outlet' names the outlet and its store
- …and drops exactly that outlet's listed items (the number it reports = the list) — _3 vs 3_
- …none of that outlet's items remain
- …the store's own items (look, plan, addresses) stay — _1 items_
- …and so do every other store's outlets
- an outlet that is not in that store is refused (404), not silently ignored
- 'outlet' without an outlet is refused (400)
- an unknown scope is refused (400)
- a store owner can't expire the admin panel's cache (403)

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-27 20:45 | pass | 69 | 0 | headless | 12.0 s |
| 2026-11-27 17:01 | pass | 55 | 0 | headless | 9.9 s |
| 2026-11-27 16:45 | pass | 55 | 0 | headless | 8.6 s |
| 2026-11-27 16:16 | pass | 55 | 0 | headless | 7.8 s |
| 2026-11-27 12:08 | pass | 55 | 0 | headless | 6.4 s |
| 2026-11-27 10:54 | pass | 55 | 0 | headless | 6.8 s |
| 2026-11-27 10:02 | pass | 55 | 0 | headless | 7.4 s |
| 2026-11-27 09:59 | fail | 48 | 1 | headless | 7.0 s |
| 2026-11-21 12:59 | pass | 55 | 0 | headless | 6.3 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t69-cache-audit-api.mjs`), not this page._
