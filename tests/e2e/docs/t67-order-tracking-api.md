# T67 — Following an order — the tracking API, lateness, cancelling an order nobody accepts, and error messages that name the box

**Area:** orders · **Last result:** ✅ PASSED (50 passed, 0 failed · 2026-11-21 12:59 · headless · 6.1 s)

**Run it alone:** `node run.mjs --only t67` (add `--visible` to watch it)

## What this test does

Runs suites/order-tracking-api.mjs on its own in-memory API with two stores. GET /api/customer/orders/:id: signed-out → 401, a made-up id → 404, another customer of the store → 404, a customer of another store → 403; the owner customer gets status, history (status + time only — never which team member did it), items, money, payment and outlet; GET /api/orders/:id for a customer also hides who changed the status while the team still sees it; a change by staff shows on the very next read and the order is read from the database every time. Running late: an unaccepted order past the limit says 'accept', an accepted one past the cooking limit says 'prep', new / pre-order-for-later / finished orders and stores with the alerts off say nothing. Auto-cancel (Settings → Missed-order alerts, 0 = never): only orders nobody accepted within N minutes and not already paid online are cancelled, with the reason in the history; pre-orders, accepted and young orders and other stores are untouched; the customer's page and Account list show it as cancelled with the reason. Error messages: tables (21-character number, empty, 0 / 51 / 2.5 / text seats), duplicate table numbers ignoring capitals and spaces (create and rename), the missed-order limits and a coupon form all name the box and what is allowed.

## Steps

1. following one order (GET /api/customer/orders/:id)
2. running late
3. a missed order is cancelled when the store asks for it
4. a refused request says WHICH box is wrong

## What to expect (these must happen)

- A customer can follow only their own order; staff ids never reach a customer.
- Late and cancelled orders are described; an order nobody accepts is cancelled only when the store asked for it and it isn't paid online.
- Refused requests say which box is wrong; 'T9' and 't9' are one table.

## What must NOT happen

- A customer must NOT see another customer's or another store's order.
- An order paid online, a pre-order for later, or one that was accepted must NOT be auto-cancelled.
- A refused request must NOT say only 'Validation failed'.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (50)

**Step 1 — following one order (GET /api/customer/orders/:id)**

- without signing in there is nothing to follow — _401_
- a made-up order id is a plain 404 — _404_
- another customer of the same store can't follow it — _404_
- a customer of ANOTHER store is turned away — _403_
- …and asking through another store's outlet is refused too — _403_
- the customer follows their own order — _200 preparing_
- it says what happened, in order — _["placed","accepted","preparing"]_
- …with a time for each — and never WHICH team member did it — _["status","at"]_
- it carries the items, the money, how it is paid and the outlet
- staff details and the internal history are not sent
- GET /api/orders/:id for a customer also leaves out who changed the status — _{"status":"accepted","at":"2026-11-21T07:24:28.308Z"}_
- …while the team still sees it — _3_
- staff mark the order ready
- the customer's next look says Ready — straight away — _ready_
- …because the order itself is read from the database on every ask (never a saved copy) — _printers.find, outlets.findOne, orders.findOne, outlets.findOne, feedbacks.findOne_

**Step 2 — running late**

- an order nobody has accepted for longer than the limit (2 min) says so — _{"kind":"accept","minutes":5}_
- a new order is not 'late'
- an accepted order still not ready after the cooking limit (20 min) says so — _{"kind":"prep","minutes":25}_
- a pre-order for later today is not late while its pickup is hours away
- a finished order is never late
- with the missed-order alerts switched off the customer isn't told either

**Step 3 — a missed order is cancelled when the store asks for it**

- by default nothing is ever cancelled by itself (the setting is 0 = never)
- …an old unaccepted order just stays placed
- more than 240 minutes is refused and says which box and what the most is — _Auto cancel minutes can be at most 240._
- with 'cancel after 5 minutes' on, exactly one order is cancelled — _1_
- the unaccepted order is cancelled, and the history says why — _Nobody accepted it within 5 minutes_
- an order already paid online is left for a person
- an order younger than the limit is left alone
- an order that was accepted is left alone
- a pre-order for later is left alone (its clock starts an hour before pickup)
- another store's order is never touched (its setting is 0)
- running it again cancels nothing more
- the customer's page says it was cancelled, and why — _Nobody accepted it within 5 minutes_
- …and the Account page lists it as cancelled

**Step 4 — a refused request says WHICH box is wrong**

- a 21-character table number — _The table number can be at most 20 characters._
- no table number — _Enter the table number._
- 51 seats — _A table can have at most 50 seats._
- 0 seats is refused, not turned into 4 — _Seats must be at least 1 — a table with no seats can't be used._
- 2.5 seats — _Seats must be a whole number._
- text for seats — _Seats must be a number._
- T9 is created
- T9 again — _Table T9 already exists._
- 't9' is the same table as 'T9' (capital letters don't make a new table)
- …spaces round it don't either — _409_
- renaming a table to an existing number (in other capitals) is refused — _Table T9 already exists — table numbers don't care about capital letters._
- …but saving a table under its own number is fine
- Settings → Missed-order alerts: 241 minutes — _Accept minutes can be at most 240._
- …and 0 minutes — _Accept minutes must be at least 1._
- any other form gets a sentence about its box too — _Code can be at most 24 characters._
- (the detailed list is still sent along for anything that wants it)

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-21 12:59 | pass | 50 | 0 | headless | 6.1 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t67-order-tracking-api.mjs`), not this page._
