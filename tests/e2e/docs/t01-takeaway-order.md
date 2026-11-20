# T01 — Takeaway order of at least ₹999 — customer places it, staff take it all the way to Completed

**Area:** orders · **Last result:** ✅ PASSED (45 passed, 0 failed · 2026-11-20 05:37 · headless · 32.5 s)

**Run it alone:** `node run.mjs --only t01` (add `--visible` to watch it) · starts from fresh fake data

## What this test does

A brand-new customer signs up on the Acme Momos storefront, orders 8 items (₹1,030) for takeaway paying cash at the counter; the staff dashboard receives it live and moves it Accepted → Preparing → Ready → Completed; the day's numbers and the customer's coins update.

## Steps

1. Setting the scene: at the restaurant counter the staff dashboard is open on the Orders screen
2. A customer opens the restaurant's website
3. They choose how they want their food: Takeaway
4. They browse the menu and pick items — the goal is an order of at least ₹999
5. They open the cart to check out
6. A new customer signs up: name and mobile number, then the 6-digit code
7. Signed in — the checkout page shows the order, the way to get it, and the total
8. Payment: they will pay in cash at the counter when they collect
9. They place the order
10. At the counter: the new order has arrived on the dashboard — nobody refreshed the page
11. The staff open the order to see everything in it
12. The staff confirm the order: “Accepted”
13. The kitchen starts cooking: “Preparing”
14. The food is packed: “Ready” for pick-up
15. The staff mark it “Completed” — completing also records the cash as received
16. The customer leaves with the food — the order is done and stays in the list for the records
17. Privacy: the owner of a DIFFERENT store (Beta Bites) tries to reach this order

## What to expect (these must happen)

- The customer can pick Takeaway, add items with sizes and quantities, and sees a cart total of at least ₹999.
- A new customer is asked for name + mobile, a 6-digit code (123456 on test stores), then gender and age once.
- Checkout lists exactly the picked items, offers 'Cash / pay at counter', and the amount to pay equals the cart.
- After placing, the customer sees 'Order #… placed', 'The kitchen has it.', Takeaway, cash at the counter, the same total and a ready time.
- The order shows on the staff Orders screen by itself (live), with customer, phone, type, item count, total and 'Placed'.
- Each status change (Accepted, Preparing, Ready, Completed) asks for confirmation; Enter confirms.
- Completing a cash order records the payment as paid; the status history lists all five steps.
- Dashboard home shows Revenue today = the order total and Orders today = 1.
- Loyalty coins are credited only when the order is Completed (₹1,030 → 103 coins).

## What must NOT happen

- The order must NOT be marked paid before the staff complete it (cash is collected at the counter).
- No coins may be credited when the order is merely placed.
- A takeaway order must NOT carry a delivery fee or a delivery address.
- A signed-in owner of ANOTHER store (Beta Bites) must NOT be able to list or read this order.
- The browser must NOT log JavaScript errors during the flow.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (45)

**Step 1 — Setting the scene: at the restaurant counter the staff dashboard is open on the Orders screen**

- Orders screen shows the live connection
- no orders yet

**Step 2 — A customer opens the restaurant's website**

- the storefront opens with the restaurant's offer bar

**Step 3 — They choose how they want their food: Takeaway**

- Takeaway is selected

**Step 4 — They browse the menu and pick items — the goal is an order of at least ₹999**

- the cart holds 8 items — _8 items · ₹1,030 View cart →_
- the cart total is at least ₹999 — _₹1030_

**Step 6 — A new customer signs up: name and mobile number, then the 6-digit code**

- a brand-new customer is asked for the extra details (gender, age)

**Step 7 — Signed in — the checkout page shows the order, the way to get it, and the total**

- checkout lists everything the customer picked
- checkout is on Takeaway
- did not happen: checkout asks for a delivery address on a takeaway order

**Step 8 — Payment: they will pay in cash at the counter when they collect**

- 'Cash / pay at counter' is selected
- the amount to pay is at least ₹999 and equals the cart — _₹1030 (cart bar said ₹1030)_

**Step 9 — They place the order**

- confirmation says the kitchen has it
- confirmation says Takeaway and cash at the counter
- confirmation shows the same total
- confirmation quotes a ready time
- the server has exactly this one order for the store — _1 order(s)_
- did not happen: the order is already marked paid at placement
- did not happen: the takeaway order carries a delivery fee
- did not happen: the takeaway order carries a delivery address
- the new customer was saved with the details they gave
- did not happen: coins are credited before the order is completed

**Step 10 — At the counter: the new order has arrived on the dashboard — nobody refreshed the page**

- the order appeared on the dashboard by itself, instantly (live connection)
- the row shows the customer, phone, type, item count, total and 'Placed' — _ #0001 05:37 AM Rohan Mehta 9811122233 TA 8 ₹1,030 Placed 0m Accepted_

**Step 11 — The staff open the order to see everything in it**

- details show the customer's name, phone and email
- details show Takeaway, placed by Customer, cash at counter, payment pending
- details list the exact items and sizes

**Step 12 — The staff confirm the order: “Accepted”**

- asks to confirm: "Mark order #0001 as Accepted?"
- status is now Accepted

**Step 13 — The kitchen starts cooking: “Preparing”**

- asks to confirm: "Mark order #0001 as Preparing?"
- status is now Preparing

**Step 14 — The food is packed: “Ready” for pick-up**

- asks to confirm: "Mark order #0001 as Ready?"
- status is now Ready

**Step 15 — The staff mark it “Completed” — completing also records the cash as received**

- asks to confirm: "Mark order #0001 as Completed?"
- status is now Completed
- payment is now recorded as paid (cash collected)
- status history lists every step: Placed, Accepted, Preparing, Ready, Completed

**Step 16 — The customer leaves with the food — the order is done and stays in the list for the records**

- the customer earned loyalty coins only now, at completion (₹1,030 → 103 coins) — _103 coins_
- the Dashboard home shows Revenue today ₹1,030, 1 order today

**Step 17 — Privacy: the owner of a DIFFERENT store (Beta Bites) tries to reach this order**

- did not happen: Beta's owner lists Acme's orders
- did not happen: Beta's own order list shows Acme's order
- (control) Acme's own owner can still read the order by its id — _HTTP 200_
- did not happen: Beta's owner reads Acme's order by its id
- did not happen: Beta's owner changes the status of Acme's order
- did not happen: the browser logged JavaScript errors during the flow

### 🔎 Findings (not a pass/fail, but you should know)

- The customer has NO order-tracking page: their confirmation screen never moves past “Order #… placed”, even when the order is Ready. Progress only reaches them through WhatsApp/SMS alerts, which are off by default. (GET /api/orders/:id already lets a signed-in customer read their own order, so a tracking page is feasible.)

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-20 10:53 | pass | 45 | 0 | headless | 32.6 s |
| 2026-11-20 05:37 | pass | 45 | 0 | headless | 32.5 s |
| 2026-11-20 04:35 | pass | 45 | 0 | headless | 32.6 s |
| 2026-11-20 04:09 | pass | 45 | 0 | headless | 35.6 s |
| 2026-11-20 00:01 | pass | 45 | 0 | headless | 33.4 s |
| 2026-11-19 23:42 | pass | 45 | 0 | headless | 32.4 s |
| 2026-11-19 23:20 | pass | 45 | 0 | headless | 33.0 s |
| 2026-11-19 23:06 | pass | 45 | 0 | headless | 32.9 s |
| 2026-11-19 22:50 | pass | 45 | 0 | headless | 32.7 s |
| 2026-11-19 22:39 | pass | 45 | 0 | headless | 36.3 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t01-takeaway-order.mjs`), not this page._
