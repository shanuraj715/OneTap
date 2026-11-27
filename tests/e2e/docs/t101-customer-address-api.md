# T101 — Customer: the pin and address of a delivery order are saved per outlet and read back next time; the sign-in lasts 180 days and every visit extends it

**Area:** storefront · **Last result:** ✅ PASSED (39 passed, 0 failed · 2026-11-27 10:50 · headless · 6.6 s)

**Run it alone:** `node run.mjs --only t101` (add `--visible` to watch it)

## What this test does

Runs suites/customer-address-api.mjs on a private API with an in-memory database (no browser). A customer with no history has nothing saved (and someone not signed in gets 'nothing', not an error). Placing a delivery order saves the pin and the whole address (text + landmark) for THAT outlet; ordering from a second outlet saves a second place and leaves the first untouched (two rows); ordering again from the same outlet replaces its place (still one row per outlet). A staff-placed order, a takeaway order and a refused (out-of-area) delivery save nothing. A customer can save a place by hand (PUT), impossible coordinates are 400, saving needs a sign-in, and 'forget' (DELETE) removes only their own. A customer of another store gets 403 on read/save/clear. The sign-in: a new one lasts 180 days with a matching cookie end date; a visit right after changes nothing; a visit with 100 days left pushes it back to 180 days and re-issues the same token's cookie (HttpOnly, SameSite=Lax); a sign-in whose end date has passed is not revived; signing out still removes it from the database.

## Steps

1. Nothing saved yet
2. Ordering delivery saves the place, for THAT outlet
3. A second outlet keeps its own place
4. The next order from the same outlet replaces it
5. What is NOT saved
6. Saving and clearing by hand
7. Only the customer's own, only their own store
8. The sign-in lasts, and every visit extends it

## What to expect (these must happen)

- A delivery order saves the customer's pin and address for that outlet; each outlet keeps its own; the next order from the same outlet replaces it.
- A signed-in customer stays signed in for 180 days, and each visit moves the end date out again.

## What must NOT happen

- A customer must NOT be able to read, save or clear a place at another store's outlet, or see another customer's place.
- A staff order, a takeaway order or a refused delivery must NOT save an address.
- A visit must NOT bring back a sign-in whose end date has passed.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (39)

**Step 1 — Nothing saved yet**

- a customer who never ordered delivery has no saved place
- someone not signed in gets 'nothing saved' (no error: the picker just starts at the restaurant)
- no outlet named is a 400

**Step 2 — Ordering delivery saves the place, for THAT outlet**

- a delivery order is placed from a pin on the map
- the customer who placed it is told the 4-digit delivery code right away (for the 'order placed' screen) — _1208_
- the pin AND the whole address (text and landmark) are saved for the Noida outlet
- the Delhi outlet has nothing saved yet (each outlet has its own)
- another customer's saved place is not visible to Ravi

**Step 3 — A second outlet keeps its own place**

- the same customer orders delivery from the Delhi outlet
- Delhi has its own saved place
- …and Noida's is untouched: two places for two outlets
- two rows in the database for this customer

**Step 4 — The next order from the same outlet replaces it**

- ordering again with another pin updates Noida's saved place
- still one row per outlet (used twice at Noida) — _timesUsed 2_

**Step 5 — What is NOT saved**

- (staff place a phoned-in delivery order)
- the dashboard's answer for an order does not carry the delivery code
- (a customer places a takeaway order: no delivery code)
- (a delivery order outside the area is refused)
- none of those saved anything: no customer on a staff order, no delivery on a takeaway, no order on a refused pin

**Step 6 — Saving and clearing by hand**

- a customer can save a place directly
- and it is read back
- an impossible latitude is refused
- …and an impossible longitude
- saving needs a sign-in
- 'forget my saved place' removes it
- …and only Ravi's (Asha's is still there)

**Step 7 — Only the customer's own, only their own store**

- a customer of ANOTHER store can't read this store's outlet (403)
- …nor save to it
- …nor clear it
- Asha's place is unharmed

**Step 8 — The sign-in lasts, and every visit extends it**

- a new sign-in lasts 180 days — _180.0 days_
- the cookie carries the same end date
- a visit right after signing in changes nothing (no new cookie, no write)
- a visit with 100 days left pushes it out to 180 days again — _180.0 days_
- …and the cookie is re-issued with the new end date (still HttpOnly, SameSite=Lax)
- …carrying the SAME token (nothing else changes)
- a sign-in whose end date has passed is NOT revived by a visit — _{"customer":null}_
- signing out still ends the sign-in at once
- …and removes it from the database

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-27 10:50 | pass | 39 | 0 | headless | 6.6 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t101-customer-address-api.mjs`), not this page._
