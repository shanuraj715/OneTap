# T19 — Dine-in at a table — create tables, scan the QR, order onto a running tab, staff move / settle / void, occupied tables, rotated codes, switch-off

**Area:** tables · **Last result:** ✅ PASSED (55 passed, 0 failed · 2026-11-20 00:16 · headless · 58.4 s)

**Run it alone:** `node run.mjs --only t19` (add `--visible` to watch it) · starts from fresh fake data

## What this test does

In Chrome. The owner of Acme Momos adds three tables (D1, D2, D3) and copies D1's code. A diner opens it: the menu says 'Ordering to Table D1' with no takeaway/delivery choice, the order page asks them to sign in, never asks for a table number, and sends the order 'to the kitchen' as a dine-in order on a running tab (₹70). Back on the menu the same diner still can order (₹60 more, tab ₹130) while a stranger scanning the same code is told another party is seated and can't order. The dashboard shows the party under 'Seated now' with its orders and tab; staff move the party to D2 (the orders follow, D1 needs cleaning), can't close a table that still owes money (a message says how much), confirm payment, mark the table vacant and cleaned. A second diner at D3 is voided by staff (orders cancelled, table freed) and a seated table can't be removed until then. Rotating a table's code kills the printed one, forged and unknown codes are refused, and switching Dine-in QR ordering off in Settings makes every code say table ordering is off until it is switched back on.

## Steps

1. Staff add three tables and copy the code of the first
2. A diner scans D1, signs in and sends an order to the kitchen
3. The same diner orders again: one table, one running tab
4. A stranger scanning the same code is turned away
5. Staff see the party: seated now, orders, tab
6. Staff move the party from D1 to D2
7. A table that still owes money can't be closed; confirm payment, mark vacant, mark cleaned
8. A second diner at D3; staff void the party; a seated table can't be removed
9. Rotating a code kills the printed one; forged and unknown codes are refused
10. Dine-in QR ordering switched off in Settings, and on again

## What to expect (these must happen)

- Scanning D1 shows 'Table D1', 'Ordering to Table D1' and the menu, with no Takeaway/Delivery choice.
- Checking out from a table asks the diner to sign in, shows 'Table D1 — joins your running tab', never asks for a table number, and the button says 'Send to kitchen'.
- The order is 'Order #… placed', 'Sent to the kitchen for Table D1', type 'Dine-in · Table D1', 'Running tab ₹70'.
- Back on the menu the same diner sees 'Running tab ₹70' and can order again: the second order brings the tab to ₹130, on the same table session.
- A stranger scanning D1 while it is occupied sees 'Another party is currently seated at this table' and no menu to order from; the order page says 'Another party is seated here'.
- Tables page: 'Seated now — 1', 'Table D1 … 2 orders · tab ₹130', D1 'Seated'. Orders page: both orders 'DI Table D1' for the diner. The table overview shows the diner, 'Running tab ₹130' and '₹130 unpaid'.
- Moving the party to D2: 'moved: D1 → D2', D1 'Needs cleaning', D2 'Seated', and the orders now say Table D2.
- Closing a table that still owes money is refused with 'Confirm payment before marking this table vacant — ₹130 still unpaid.'; the overview's 'Mark table as vacant' stays disabled until 'Confirm payment' ('Fully paid'); then D2 'Needs cleaning', and 'Mark cleaned' makes it 'Free'.
- A seated table can't be removed ('Close the open session before removing this table'); 'Cancel / void' cancels its orders and frees the table, after which it can be removed and its code says 'isn't valid'.
- Rotating D2's code: the old address says 'That table code has expired', the new one works; a forged code and an unknown table are refused.
- With Dine-in QR ordering switched off in Settings, a table's code says 'Table ordering is off right now … order at the counter'; switched on again it works.

## What must NOT happen

- A diner seated at a table must NOT be told that another party is seated there.
- A stranger must NOT be able to order onto an occupied table's tab.
- A table order must NOT ask for a table number or an order type.
- A table that still owes money must NOT be marked vacant.
- A voided table's orders must NOT stay open in the kitchen.
- A rotated, forged or deleted table's code must NOT open the menu.
- Dine-in must NOT work while Dine-in QR ordering is off.
- The browser must NOT log JavaScript errors.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (55)

**Step 1 — Staff add three tables and copy the code of the first**

- D1, D2 and D3 are in a 'Garden' group, Free
- each table has its own address

**Step 2 — A diner scans D1, signs in and sends an order to the kitchen**

- the code opens the menu for 'Table D1' ('Ordering to Table D1')
- did not happen: a Takeaway / Delivery choice is shown to someone at a table
- the menu has the items to add
- checkout asks the diner to sign in first (name and mobile number)
- the order page says 'Table D1' and that it joins the running tab
- did not happen: the diner is asked for a table number, or how they want it (takeaway / delivery)
- the button says 'Send to kitchen' (not 'Place order')
- 'Order #… placed' — 'Sent to the kitchen for Table D1.'
- it is a dine-in order for the table: 'Dine-in · Table D1', total ₹70, 'Running tab ₹70'

**Step 3 — The same diner orders again: one table, one running tab**

- did not happen: the diner who is seated here is told another party is seated here
- the menu shows the running tab: 'Ordering to Table D1 · Running tab ₹70'
- the second order is ₹60 and the running tab becomes ₹130
- it is a new order number — _0001 → 0002_

**Step 4 — A stranger scanning the same code is turned away**

- they see 'Another party is currently seated at this table. Please ask a member of staff.'
- did not happen: a stranger can add items to an occupied table's tab
- going straight to its order page says 'Another party is seated here'

**Step 5 — Staff see the party: seated now, orders, tab**

- 'Seated now — 1' with 'Table D1 … 2 orders · tab ₹130'
- D1 shows as Seated, D2 and D3 Free
- the Orders page lists both: '#0001 … Dina Diner 9877712345 DI Table D1 … ₹70 Placed' and '#0002 … ₹60'
- the table overview shows D1 Seated with '₹130 · unpaid'
- its detail: Diner Dina Diner (9877712345), Running tab ₹130, ₹130 unpaid, both orders

**Step 6 — Staff move the party from D1 to D2**

- 'Seated now' says 'Table D2 … moved: D1 → D2'
- D1 'Needs cleaning', D2 'Seated', D3 still Free — _D1 Needs cleaning 2 seats \| D2 Seated 4 seats \| D3 Free 4 seats_
- the tab moved with them: still 2 orders · ₹130
- both orders on the Orders page now say Table D2

**Step 7 — A table that still owes money can't be closed; confirm payment, mark vacant, mark cleaned**

- Close is refused: 'Confirm payment before marking this table vacant — ₹130 still unpaid.'
- did not happen: the table was freed although ₹130 is unpaid
- in the overview 'Mark table as vacant' is disabled while it is unpaid
- 'Confirm payment' → the tab says 'Fully paid' and 'Confirm payment' is now disabled
- D2 is now 'Needs cleaning' and offers 'Mark cleaned'
- 'Mark cleaned' → D2 is Free again
- the Tables page has no one seated and D1, D2, D3 all Free — _D1 Free 2 seats \| D2 Free 4 seats \| D3 Free 4 seats_

**Step 8 — A second diner at D3; staff void the party; a seated table can't be removed**

- the new diner's order goes to D3 ('Sent to the kitchen for Table D3', 'Running tab ₹70')
- D3 is Seated and listed under 'Seated now'
- removing a seated table is refused: 'Close the open session before removing this table'
- did not happen: a seated table was removed
- after 'Cancel / void' the order #0003 is Cancelled — _#0003 12:15 AM Rohan Other 9877799999 DI Table D3 1 ₹70 Cancelled —_
- did not happen: the voided order is still open for the kitchen
- D3 is freed ('Needs cleaning') and nobody is seated
- now that it is free, D3 can be removed
- the removed table's code says 'That table code isn't valid' — _This code didn't work That table code isn't valid_

**Step 9 — Rotating a code kills the printed one; forged and unknown codes are refused**

- the panel shows a new code for the same table
- the old printed code says 'That table code has expired — please ask staff for a fresh one' — _This code didn't work That table code has expired — please ask staff for a fresh one_
- did not happen: the old code still opens the menu
- the new code opens the menu for D2
- a made-up code for a real table is refused
- a code for a table that doesn't exist says 'That table code isn't valid'
- did not happen: the table's address without its code opens the menu

**Step 10 — Dine-in QR ordering switched off in Settings, and on again**

- a table's code says 'Table ordering is off right now' and 'Please order at the counter.' — _Table ordering is off right now Please order at the counter._
- did not happen: the menu opens while dine-in is off
- the order page of the table says the same
- switched back on, the same code works again
- did not happen: the browser logged JavaScript errors

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-20 00:16 | pass | 55 | 0 | headless | 58.4 s |
| 2026-11-19 23:43 | pass | 55 | 0 | headless | 54.9 s |
| 2026-11-19 23:26 | pass | 55 | 0 | headless | 55.7 s |
| 2026-11-19 22:52 | pass | 55 | 0 | headless | 55.0 s |
| 2026-11-19 22:41 | pass | 55 | 0 | headless | 58.9 s |
| 2026-11-19 18:12 | pass | 55 | 0 | headless | 55.8 s |
| 2026-11-19 12:57 | pass | 55 | 0 | headless | 55.8 s |
| 2026-11-19 12:37 | pass | 55 | 0 | headless | 55.6 s |
| 2026-11-19 11:17 | pass | 55 | 0 | headless | 56.7 s |
| 2026-11-19 01:15 | pass | 55 | 0 | headless | 58.3 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t19-dine-in.mjs`), not this page._
