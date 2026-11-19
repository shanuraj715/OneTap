# T30 — Storefront Account page — 'My orders' menu link, order history with status, payment mode & state, coins; Delete order on the dashboard

**Area:** storefront · **Last result:** ✅ PASSED (41 passed, 0 failed · 2026-11-19 15:51 · headless · 42.6 s)

**Run it alone:** `node run.mjs --only t30` (add `--visible` to watch it) · starts from fresh fake data

## What this test does

In Chrome on the Acme Momos storefront. The header menu has a 'My orders' link. Signed out, it opens the Account page with a sign-in card ('Sign in to see your orders'); signing in shows 'Your account' with the customer's name and number, a 'Your coins' card (coins are on for this store) and an empty 'No orders yet'. After ordering for takeaway paying cash, the order appears with its number, date, status Placed with a one-line explanation, payment 'Pay at the counter · To pay', the total, its items, and 'View details' with the full bill. As the owner moves it to Accepted, Preparing, Ready and Completed the card follows (progress tracker while active; by itself within about 20 seconds, or on reload), the payment becomes Paid, the details say how many coins were earned and the coins card shows them. A second order that is cancelled shows Cancelled and 'Not charged'. On the dashboard Orders page the owner opens More actions → Delete order: a dialog explains it disappears from the list, the reports and the customer's history and that the coins it earned are taken back; confirming removes the row, and on the customer's Account page the order is gone and the coins are back to what they were. A cashier's More-actions menu has no Delete option. Signing out of the Account page shows the sign-in card again.

## Steps

1. The header menu has a 'My orders' link
2. Signed out, the Account page asks the visitor to sign in
3. The customer signs in and sees their account
4. The customer orders for takeaway, paying at the counter
5. The owner moves the order along; the customer's card follows
6. A second order is cancelled
7. The owner deletes the first order from the Orders page
8. On the customer's Account page the order — and its coins — are gone
9. The customer removes the cancelled order from their own account
10. A cashier is not offered 'Delete order' — and the store still has the order the customer removed
11. Signing out of the Account page

## What to expect (these must happen)

- The storefront header menu has 'My orders'; it leads to /main/account.
- Signed out, the Account page shows the sign-in card titled 'Sign in to see your orders' (not 'Sign in to order').
- Signed in: 'Your account' with name and number; a 'Your coins' card; an empty state 'No orders yet' with a 'Browse the menu' link.
- A placed order shows: number, status Placed with its sentence, 'Pay at the counter' with 'To pay', the total in rupees, the items; 'View details' shows each line and the totals.
- As the owner changes the status the card follows (Accepted, Preparing, Ready, Completed); an active order shows a progress tracker; the page refreshes by itself.
- Completed: payment says Paid; the details say how many coins were earned; the coins card shows that balance.
- A cancelled order shows Cancelled and payment 'Not charged'.
- Owner: Orders → More actions → 'Delete order' → dialog (names the order, says it disappears and which coins are taken back) → confirm removes the row; the customer's page no longer lists it and the coins balance drops back.
- The customer's own 'Remove' on an order asks first (says the restaurant keeps its record), 'Keep it' changes nothing, 'Remove' takes only that order off their list — still gone after a reload.
- The store still sees the order the customer removed (Orders page), so a customer's removal never changes the store's records.
- A cashier's More-actions menu has no 'Delete order'.
- Sign out returns to the sign-in card.

## What must NOT happen

- The Account page must NOT show anyone's orders while signed out.
- Deleting must NOT happen without pressing the red 'Delete order' button (Enter does nothing).
- A cashier must NOT be offered 'Delete order'.
- A customer removing an order from their account must NOT remove it from the store's Orders page.
- A deleted order must NOT stay on the customer's Account page, and the coins it earned must NOT stay.
- The browser must NOT log JavaScript errors.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (41)

**Step 1 — The header menu has a 'My orders' link**

- the storefront's header menu has 'My orders'
- it leads to the Account page — _http://localhost:3170/main/account_

**Step 2 — Signed out, the Account page asks the visitor to sign in**

- the sign-in card is titled 'Sign in to see your orders'
- did not happen: anyone's orders are listed
- it says the mobile number is all that's needed

**Step 3 — The customer signs in and sees their account**

- 'Your account' shows the customer's name and number
- a 'Your coins' card is there (coins are on for this store), at 0
- with no orders it says so, and offers the menu

**Step 4 — The customer orders for takeaway, paying at the counter**

- order #0001 is on the Account page, Placed
- a sentence says what happens next
- the payment shows how it is paid (at the counter) and that it still has to be — _Pay at the counter To pay_
- the total is shown in rupees — _₹120_
- the progress tracker is shown while the order is active
- 'View details' lists the items and the bill

**Step 5 — The owner moves the order along; the customer's card follows**

- (the order is on the dashboard) — _6afecd828f9a0ff6bf00cd97_
- without reloading, the page picks up 'Accepted' by itself
- after a reload it says Ready, with the pickup sentence
- Completed
- the payment now says Paid (cash taken at the counter) — _Pay at the counter Paid_
- no progress tracker any more
- the details say how many coins the order earned — _12_
- the coins card shows exactly those coins — _12 vs 12_

**Step 6 — A second order is cancelled**

- the cancelled order says Cancelled
- …and the payment says it was not charged

**Step 7 — The owner deletes the first order from the Orders page**

- 'More actions' offers 'Delete order'
- the dialog names the order and says what happens
- it says the coins it earned are taken back
- Enter does NOT delete it (only the red button does)
- the row is gone from the Orders page
- the other order is still there

**Step 8 — On the customer's Account page the order — and its coins — are gone**

- the deleted order is no longer listed
- the cancelled one still is
- the coins it earned are taken back (0 again) — _0_

**Step 9 — The customer removes the cancelled order from their own account**

- it asks first, and says the restaurant keeps its own record
- 'Keep it' changes nothing
- the card disappears from the customer's list
- with nothing left, the page says 'No orders yet'
- and it is still gone after a reload

**Step 10 — A cashier is not offered 'Delete order' — and the store still has the order the customer removed**

- the store still sees the order the customer removed from their account
- the cashier's menu has Edit and Cancel but no 'Delete order'

**Step 11 — Signing out of the Account page**

- the sign-in card is back, with no orders on screen

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-19 15:51 | pass | 41 | 0 | headless | 42.6 s |
| 2026-11-19 13:20 | pass | 41 | 0 | headless | 45.2 s |
| 2026-11-19 12:51 | pass | 41 | 0 | headless | 42.7 s |
| 2026-11-19 12:50 | fail | 40 | 1 | headless | 43.0 s |
| 2026-11-19 12:49 | error | 22 | 0 | headless | 50.8 s |
| 2026-11-19 12:48 | error | 22 | 0 | headless | 50.6 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t30-account-orders.mjs`), not this page._
