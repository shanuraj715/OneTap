# T29 — Order history for the storefront Account page, and deleting an order — who may, what it puts right, where it disappears

**Area:** orders · **Last result:** ✅ PASSED (65 passed, 0 failed · 2026-11-21 13:09 · headless · 5.7 s)

**Run it alone:** `node run.mjs --only t29` (add `--visible` to watch it)

## What this test does

Runs suites/orders-account.mjs: its own in-memory API with two stores (one whose plan has coins, one whose plan doesn't). Order history: a customer sees only their own orders for this store, newest first, with status, payment mode and state, items (with size and add-ons), totals, coins earned and the outlet — and nothing internal; paging works; another store's customer is refused; coins are reported only when the plan includes them AND the outlet has switched them on. Deleting: only the store owner and the platform super admin may — managers, cashiers and the kitchen get 403 and the order is untouched; an order paid online must be refunded first; cash and test-gateway orders can be deleted; coins the order used go back and coins it earned are taken back (never below zero, never twice); a ticket waiting to print is cancelled; the order vanishes from the orders list, its page, the customer's history and every query and report, but the record stays (marked with who and when); deleting a whole store wipes its deleted orders too.

## Steps

1. the customer's order history
2. coins — shown only when the store has them
3. deleting an order — who may
4. deleting an order — what it puts right
5. 4b. a customer removes an order from their own account — only their list changes
6. a deleted order is gone from everywhere
7. deleting a whole store wipes its deleted orders too

## What to expect (these must happen)

- A signed-out visitor gets no history; a customer sees only their own orders, newest first, with the payment mode and whether it is paid, the items and the money.
- Paging with a date cursor returns the rest; a nonsense date is a 400; another store's customer is refused.
- Coins are sent only when the store's plan includes them and the outlet has them on.
- Only the store owner and the platform super admin can delete an order; manager, cashier and kitchen get 403 (and the order is untouched); a missing order is 404; deleting twice is 404.
- An order paid online (Razorpay) can't be deleted and the message says to refund it first; cash and test-gateway orders can.
- A customer can remove an order from their OWN account: only theirs, only their list; 401 signed out, 404 for someone else's, 403 through another store; harmless to repeat; the store still sees it (list, page, payment, coins) and the customer's own link still opens.
- Deleting puts coins right (used coins refunded, earned coins taken back, bounded by what is left, once) and cancels a waiting print ticket.
- A deleted order is gone from the dashboard list, its own page, status changes, the customer's history, plain and aggregate queries — yet still in the database, marked with when and by whom.
- Deleting a store removes its deleted orders as well.

## What must NOT happen

- A customer must NOT see another customer's order, or staff-only details of their own.
- Coins must NOT be shown when the plan doesn't include them.
- A deleted order must NOT appear in any list or report, and must NOT refund or take coins twice.
- An order paid online must NOT be deletable.
- A customer hiding an order must NOT hide it from the store, change its payment or coins, or touch anyone else's order.
- A store's deleted orders must NOT survive the store being deleted.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (65)

**Step 1 — the customer's order history**

- without signing in there is no history — _401_
- a customer sees their own three orders — _200 3_
- …newest first
- …and nobody else's order is among them
- each order carries its status and how it is paid (mode and paid / pending) — _{"s":"completed","p":{"gateway":"razorpay","status":"paid"}}_
- …the items (with size and add-ons) and the money, including coins earned
- …and which outlet it was at
- staff details, the customer record and internal history are not sent
- a customer of one store can't read orders through another store — _403_
- …each store's customers see only their own store
- paging: the first page of two says there are more — _2 2026-11-21T07:09:24.996Z_
- …the second page has the rest, and no more after it — _1 null_
- a nonsense date is a plain 400
- an outlet that doesn't exist is a 404

**Step 2 — coins — shown only when the store has them**

- coins on (plan has them, outlet switched them on): the balance and what it is worth — _{"enabled":true,"balance":70,"valuePaise":7000}_
- the outlet switched coins off: nothing about coins is sent — _{"enabled":false,"balance":0,"valuePaise":0}_
- a store whose PLAN doesn't include coins never shows them, even with a balance and the outlet setting on — _{"enabled":false,"balance":0,"valuePaise":0}_

**Step 3 — deleting an order — who may**

- a cashier can't delete an order — _403 Your role can't do this (order:delete)_
- nor can the kitchen — _403_
- another store's owner can't reach it (not found) — _404_
- nobody signed in can't delete it — _401_
- …and it is untouched so far
- a manager can't either — deleting is for the owner and the platform admin only — _403 Your role can't do this (order:delete)_
- …and the order is untouched after the manager's attempt
- the platform super admin can — _200_
- the store owner can — _200_
- deleting it again is a 404 — it is gone — _404_
- an order that never existed is a 404

**Step 4 — deleting an order — what it puts right**

- an order paid online can't be deleted — it says to refund it first
- …and nothing about it changed
- an order paid in cash can be deleted
- so can one paid through the test gateway (no real money)
- coins the order used (30) go back and coins it earned (10) are taken back: 100 → 120 — _120_
- …both are in the customer's coin history — _[["reverse",30],["revoke",10]]_
- coins already spent can't be taken twice: only the 4 left are taken back, the balance stops at 0 — _0 / 4_
- a cancelled order whose coins were already refunded doesn't refund them twice — _50_
- a print ticket still waiting for the deleted order is cancelled — _cancelled_

**Step 5 — 4b. a customer removes an order from their own account — only their list changes**

- signed out, nobody can remove anything — _401_
- another customer can't remove (or even find) someone else's order — _404_
- nor through another store — _403_
- an id that isn't an order is a plain 404
- (it is on their list before)
- the customer removes their own order — _200_
- it is gone from THEIR list — and only that one order
- removing it again is harmless
- the store owner still sees it in the orders list
- …unchanged: its payment, its totals, its coins — _200_
- the customer's coins are not touched by hiding an order — _33_
- it is marked 'hidden by the customer' — and NOT deleted — _{"hidden":true,"deleted":false}_
- their own link to it still opens (they only tidied their list) — _200_
- the store can still delete it on its own side
- (clean-up)

**Step 6 — a deleted order is gone from everywhere**

- (it is in the orders list before)
- the dashboard's orders list no longer shows it (and still shows the others)
- opening it is a 404
- it can't be moved to another status either
- the customer's own history no longer shows it
- nor their order page — _404_
- the record is kept in the database, marked with when and who deleted it (nothing is lost for good) — _Owner_
- (reports still answer) — _400_
- every ordinary query skips deleted orders; only a query that asks for them gets them — _6 of 17_
- …aggregations (reports, marketing audiences) too — _6_

**Step 7 — deleting a whole store wipes its deleted orders too**

- (Beta has an order that was deleted from its dashboard) — _2_
- the platform deletes the Beta store — _200_
- no order of it is left — not even the ones that had been deleted — _0 left_

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-21 13:09 | pass | 65 | 0 | headless | 5.7 s |
| 2026-11-21 13:08 | fail | 64 | 1 | headless | 5.8 s |
| 2026-11-21 04:52 | pass | 65 | 0 | headless | 6.4 s |
| 2026-11-20 16:03 | pass | 65 | 0 | headless | 5.6 s |
| 2026-11-20 13:17 | pass | 64 | 0 | headless | 4.9 s |
| 2026-11-20 05:59 | pass | 63 | 0 | headless | 5.3 s |
| 2026-11-20 04:56 | pass | 63 | 0 | headless | 5.1 s |
| 2026-11-20 00:24 | pass | 63 | 0 | headless | 5.3 s |
| 2026-11-19 17:49 | pass | 63 | 0 | headless | 5.2 s |
| 2026-11-19 17:43 | pass | 63 | 0 | headless | 5.2 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t29-orders-account-api.mjs`), not this page._
