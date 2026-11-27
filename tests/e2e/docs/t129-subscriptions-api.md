# T129 — Rasoi Pulse's own business: payments stores made for their subscription are written down; the dashboard numbers (total sales, new sales, re-subscribed, who ran out) and the day / week / month charts are worked out from them

**Area:** platform · **Last result:** ✅ PASSED (80 passed, 0 failed · 2026-11-28 01:55 · headless · 6.5 s)

**Run it alone:** `node run.mjs --only t129` (add `--visible` to watch it)

## What this test does

API checks on an in-memory database. Five made-up stores and seven payments dated relative to today. The payment form's rules (amount, date, months, plan, note, duplicates), new sale vs re-subscription worked out from the dates (a late-written older payment, a deleted one), the days a payment covers (an early renewal carries on from where the last ended), total / new / re-subscribed / this month / who is paid up, ran out, never paid, by plan, the latest payments, and three charts (30 days, 12 weeks, 12 months) each against the period before — every expected number is worked out independently in the test from the same dates and amounts. Who may read and who may write (dashboard / store-read / store-manage roles, a restaurant owner, signed out), amounts in paise adding up exactly, and a deleted store's payments staying in the sales history.

## Steps

1. The form's rules: a payment has to be sensible
2. Writing payments down: the first is the new sale, later ones are re-subscriptions
3. New or re-subscription is worked out from the DATES — late or deleted entries don't confuse it
4. The business numbers (the dashboard)
5. The charts: day, week and month, each against the period before, worked out again independently
6. Who may see and write what
7. A deleted store's money stays in the sales figures

## What to expect (these must happen)

- Total sales is the sum of everything stores paid; new sales counts first payments; re-subscribed counts later ones.
- The first payment of a store (by its date) is the new sale, whatever order they were written in.
- Each chart (day, week, month) shows this period against the one before, and the new + re-subscribed split adds up.
- Deleting a store leaves its payments in the sales history.

## What must NOT happen

- The business numbers must NOT contain any store's orders or sales.
- A payment must NOT be accepted with a future date, zero or negative amount, bad months or a store that does not exist.
- A team member without the right access must NOT be able to read or write payments.
- Amounts must NOT drift (0.07 + 1,999.99 is exactly 2,000.06).

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (80)

**Step 1 — The form's rules: a payment has to be sensible**

- an amount of 0 is refused — _400 The amount must be more than 0_
- a negative amount is refused — _400 The amount must be more than 0_
- an amount that is not a number is refused — _400 Enter the amount in rupees_
- more than two decimals (a fraction of a paisa) is refused — _400 Use at most two decimals (paise)_
- an absurd amount is refused — _400 That amount looks too big — check the number_
- a payment dated in the future is refused (use the day the money arrived) — _400 The payment date can't be in the future — use the day the money arrived_
- a day that does not exist is refused — _400 That is not a real date_
- a date that is not a date is refused — _400 Pick the day the money arrived_
- 0 months is refused — _400 At least 1 month_
- more than 60 months is refused — _400 At most 60 months_
- half a month is refused — _400 Months must be a whole number_
- a plan that does not exist is refused — _400 That plan doesn't exist_
- a very long note is refused — _400 Keep the note under 200 characters_
- an empty form is refused, with what to fix — _400 Enter the amount in rupees_
- a store that does not exist: 404
- a store id that is not an id: 404
- nothing was written by all those refused attempts

**Step 2 — Writing payments down: the first is the new sale, later ones are re-subscriptions**

- A's first payment is written, and it is the NEW sale
- it keeps the plan (the store's current one), the store's name, who wrote it and the note
- it says when it was paid and the last day it covers (about a month later) — _2026-09-19 → 2026-10-18_
- the same payment again (same store, day, amount — a double click) is refused (409)
- the list is newest first: renewal, renewal, new — _renewal,renewal,new_
- an EARLY renewal carries on from where the last one ends — it does not waste the days still left — _2026-12-18 vs the day after 2026-12-17_
- A is paid up until about 50 days from now — _2027-01-17_
- the total A has paid is added up exactly — _7497_
- the form offers the plan's price to start from (monthly 2,499; yearly with the 20% off = 23,990) — _{"planId":"6b09e727cdea6bdffebad3b4","planName":"Pro","monthly":2499,"yearly":23990}_
- a plan can be chosen for the payment (Basic), whatever the store is on now
- D paid again today after running out: a re-subscription that starts today
- amounts in paise add up exactly (0.07 + 1,999.99 = 2,000.06, no floating-point drift) — _2000.06_
- a wrongly written payment is taken off the list
- a wrongly written payment is taken off the list
- …and the store is 'never paid' again

**Step 3 — New or re-subscription is worked out from the DATES — late or deleted entries don't confuse it**

- B's payment written LATER but dated EARLIER becomes the new sale; the one before it turns into a re-subscription
- delete it again: the remaining payment is the new sale once more
- a payment can't be deleted through another store's address (404)
- a payment id that is not an id: 404

**Step 4 — The business numbers (the dashboard)**

- the business numbers are served
- TOTAL SALES = everything stores have paid (11,996.49) over 7 payments from 4 shops — _{"sales":11996.49,"payments":7,"shops":4,"averagePerShop":2999.12}_
- NEW SALES = shops that bought for the first time: 4 shops, 5,998.49 — _{"shops":4,"amount":5998.49}_
- RE-SUBSCRIBED = later payments: 3 payments from 2 shops, 5,998 — _{"payments":3,"shops":2,"amount":5998}_
- average per shop
- this month so far counts only payments dated this month, split into new and re-subscribed
- who is paid up (acme, beta, delta), who ran out (echo), who has no payment written down (gamma), who runs out within 14 days (beta) — _{"active":3,"expired":1,"expiringSoon":1,"neverPaid":1}_
- …and names them, so they can be followed up
- by plan: Pro has 3 paying shops and 11,496.49 taken; Basic 500
- the latest payments, newest first, with the shop's name and new / re-subscription — _7 delta_
- it is the PRODUCT's business only: nothing about any store's orders or sales
- the existing dashboard numbers (the stores' own sales) are untouched

**Step 5 — The charts: day, week and month, each against the period before, worked out again independently**

- day: 30 points in each line, and the same number in the period before
- day: this period 6997.5 and the one before 0 match the payments — _expected 6997.5 / 0_
- day: the points add up to the totals
- day: in every point, new + re-subscribed = the whole
- day: the change against the period before is worked out (null%)
- week: 12 points in each line, and the same number in the period before
- week: this period 9496.5 and the one before 2499.99 match the payments — _expected 9496.5 / 2499.99_
- week: the points add up to the totals
- week: in every point, new + re-subscribed = the whole
- week: the change against the period before is worked out (279.9%)
- month: 12 points in each line, and the same number in the period before
- month: this period 11996.49 and the one before 0 match the payments — _expected 11996.49 / 0_
- month: the points add up to the totals
- month: in every point, new + re-subscribed = the whole
- month: the change against the period before is worked out (null%)
- the last day on the day chart is today: 1,000 and it is a re-subscription
- …labelled with today's date
- every point on the week chart starts on a Monday
- every point on the month chart is a month, the last one this month

**Step 6 — Who may see and write what**

- dashboard access: sees the business numbers, but not a store's payment list
- store-read access: sees a store's payment list, but not the business numbers
- neither of them can WRITE a payment (403)
- …or delete one (403)
- store-manage access can write one, and it says who did — _Mia Manager_
- …and delete one
- a restaurant owner can't see any of it (403)
- not signed in: 401

**Step 7 — A deleted store's money stays in the sales figures**

- the store 'echo' (which paid 500 once) is deleted
- …its payment is still in the database (deleting a store must not erase Rasoi Pulse's sales history)
- the totals did not change: total sales 11,996.49, 4 shops bought
- the payment is still listed, with the shop's name as it was, marked as a deleted store
- …but a deleted store is no longer counted as 'ran out'

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-28 01:55 | pass | 80 | 0 | headless | 6.5 s |
| 2026-11-28 01:55 | fail | 79 | 1 | headless | 6.7 s |
| 2026-11-28 01:54 | fail | 78 | 2 | headless | 6.5 s |
| 2026-11-28 01:54 | fail | 78 | 2 | headless | 6.4 s |
| 2026-11-28 01:54 | fail | 69 | 11 | headless | 6.3 s |
| 2026-11-28 01:54 | pass | 80 | 0 | headless | 7.4 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t129-subscriptions-api.mjs`), not this page._
