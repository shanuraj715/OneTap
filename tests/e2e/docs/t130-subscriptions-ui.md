# T130 — Console → a store → Payments (write a payment down: new sale, then re-subscriptions) and the dashboard's 'Rasoi Pulse business': total sales, new sales, re-subscribed, one Day / Week / Month chart

**Area:** platform · **Last result:** ✅ PASSED (60 passed, 0 failed · 2026-11-28 02:06 · headless · 4.2 s)

**Run it alone:** `node run.mjs --only t130` (add `--visible` to watch it)

## What this test does

Chrome against the bench console (super admin). Before any payment the dashboard says so. On a store's Payments tab: the amount starts from the plan's price (₹2,499 a month; 12 months = the yearly price with 20% off; 3 months = 3 ×), a form with no amount or 0 months is off and says why, the first payment is written down as 'New sale' (with a note and who wrote it), the second is 'Re-subscribed' (paise shown), an earlier day picked with our calendar turns the oldest payment into the new sale, the same payment twice is refused, a wrong one is deleted. A second store pays once. The dashboard shows total sales, new sales, re-subscribed, paid up, latest payments, who to follow up and by plan, and ONE chart that switches Day / Week / Month against the period before (numbers equal to the API's, table twin included). A team member who can only read stores sees the payments with no form and no Delete.

## Steps

1. Before any payment: the dashboard says so, plainly
2. A store's Payments tab: nothing yet
3. The form starts from the plan's price and checks itself
4. The first payment is written down: it is the new sale
5. A second payment: a re-subscription (written with the calendar, for an earlier day it would be the new sale)
6. Picking an earlier day with our calendar: the older payment becomes the new sale
7. A refused form says why; a wrong payment is deleted
8. A second store pays once
9. 8b. A third shop paid long ago (written through the API): 400, 120 and 45 days back — so Day, Week and Month hold different numbers
10. The dashboard: total sales, new sales, re-subscribed
11. ONE chart that switches between Day, Week and Month
12. A team member who can only READ stores

## What to expect (these must happen)

- The dashboard shows total sales, new sales and re-subscribed for Rasoi Pulse itself.
- A store's first payment is the new sale; later ones are re-subscriptions; the amount starts from the plan's price.
- One chart switches between Day, Week and Month, each against the period before.
- A reader of stores sees the payments but has no form and no Delete button.

## What must NOT happen

- The business section must NOT show any store's orders or sales.
- A form with no amount or 0 months must NOT be submittable.
- The same payment must NOT be written twice.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (60)

**Step 1 — Before any payment: the dashboard says so, plainly**

- the section is headed 'Rasoi Pulse business' and says it is what shops pay you, not what they sell
- total sales ₹0, new sales 0, re-subscribed 0
- an empty-state explains how to start (open a store → Payments → write it down)
- the stores' own sales are still on the page, further down, under their own heading
- 'Who to follow up' lists shops that have no payment written down

**Step 2 — A store's Payments tab: nothing yet**

- the store says it has no payment written down yet
- the list is empty, with a hint
- the super admin sees the form

**Step 3 — The form starts from the plan's price and checks itself**

- one month: the amount box already holds the plan's monthly price (₹2,499) — _2499_
- 12 months: it holds the yearly price with the plan's 20% off (₹23,990) — _23990_
- 3 months: 3 × the monthly price — _7497_
- once someone types an amount it is not changed under them, even if the months change
- …and a button offers the plan's price for the months now chosen (6 × ₹2,499 = ₹14,994) — _Use the plan's price (₹14,994)_
- pressing it puts the plan's price back, and the button goes away
- typing exactly the plan's price needs no button
- no amount: the button is off and the line under the form says what to fix — _Type the amount that was paid, in rupees._
- 0 months: the button is off and says months must be 1 to 60
- a good form says this will count as the NEW SALE (the store's first payment) — _This will count as the NEW SALE for this store (its first payment)._

**Step 4 — The first payment is written down: it is the new sale**

- one row: ₹2,499, 'New sale', 1 month, the note and who wrote it
- the store now says 'Paid until …' with the days left and the total — _Paid until Dec 27, 2026 · 30 days left 1 payment · ₹2,499 in all_
- it was written for today by default

**Step 5 — A second payment: a re-subscription (written with the calendar, for an earlier day it would be the new sale)**

- the line under the form now says this will count as a RE-SUBSCRIPTION
- newest first: the new one is 'Re-subscribed' (₹2,499.50 — paise are shown), the first stays 'New sale'
- the total adds up (₹4,998.50) — _2 payments · ₹4,998.5 in all_

**Step 6 — Picking an earlier day with our calendar: the older payment becomes the new sale**

- dated before the first payment, the line says it would become the NEW SALE
- the ₹2,000 payment (oldest) is the one 'New sale'; the other two turned into 'Re-subscribed'

**Step 7 — A refused form says why; a wrong payment is deleted**

- writing the same payment twice is refused with a sentence, and nothing is added
- after deleting it, the first ₹2,499 payment is the 'New sale' again — _₹2,499.5 on Nov 28, 2026 Re-su \| ₹2,499 on Nov 28, 2026 New sal_

**Step 8 — A second store pays once**

- store B's first payment is a 'New sale' too

**Step 9 — 8b. A third shop paid long ago (written through the API): 400, 120 and 45 days back — so Day, Week and Month hold different numbers**

- the ₹200 payment from 400 days ago is written down — _201_
- the ₹300 payment from 120 days ago is written down — _201_
- the ₹500 payment from 45 days ago is written down — _201_

**Step 10 — The dashboard: total sales, new sales, re-subscribed**

- (the API agrees: 6,997.50 in all; 3 shops bought; 3 re-subscriptions from 2 shops) — _[6997.5,3,3,2]_
- TOTAL SALES shows ₹6,997.50 — _₹6,997.5_
- NEW SALES shows 3 shops (₹3,698) — _3_
- RE-SUBSCRIBED shows 3 payments (₹3,299.50) from 2 shops — _3_
- 2 shops are paid up now and 1 ran out (the one that paid 45 days ago for a month) — _2 / 1_
- 'Who to follow up' names the shop that ran out — _Marketing Mart Ran out Nov 13, 2026_
- 'Latest payments' lists the shops with 'New sale' / 'Re-subscribed'
- 'By plan' shows the plan with 2 shops paid up and the money taken — _Pay Plan 83566 2 shops paid up ₹6,997.5_
- the business section holds nothing about the stores' orders

**Step 11 — ONE chart that switches between Day, Week and Month**

- it opens on Month
- the three charts hold DIFFERENT numbers (so the switch can be seen to work): day 5,997.50 vs 500 before; week 6,497.50 vs 300; month 6,797.50 vs 200 — _{"day":5997.5,"week":6497.5,"month":6797.5}_
- day: the chart shows this period ₹5997.5 against ₹500 before (same as the API)
- day: the legend names both lines with their totals — _Last 30 days: ₹5,997.5 The 30 days before: ₹500_
- day: only that button is pressed
- day: the chart is drawn
- week: the chart shows this period ₹6497.5 against ₹300 before (same as the API)
- week: the legend names both lines with their totals — _Last 12 weeks: ₹6,497.5 The 12 weeks before: ₹300_
- week: only that button is pressed
- week: the chart is drawn
- month: the chart shows this period ₹6797.5 against ₹200 before (same as the API)
- month: the legend names both lines with their totals — _Last 12 months: ₹6,797.5 The 12 months before: ₹200_
- month: only that button is pressed
- month: the chart is drawn
- the table twin of the chart carries the same numbers, with the new / re-subscribed split

**Step 12 — A team member who can only READ stores**

- the reader sees the store's payments
- …but there is no form and no Delete button
- …and a sentence says why
- no errors in the browser console

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-28 02:06 | pass | 60 | 0 | headless | 4.2 s |
| 2026-11-28 02:05 | pass | 55 | 0 | headless | 4.2 s |
| 2026-11-28 02:05 | fail | 53 | 2 | headless | 3.8 s |
| 2026-11-28 02:05 | fail | 53 | 2 | headless | 5.4 s |
| 2026-11-28 02:03 | error | 26 | 0 | headless | 11.0 s |
| 2026-11-28 02:02 | fail | 12 | 6 | headless | 10.3 s |
| 2026-11-28 02:01 | fail | 20 | 3 | headless | 11.3 s |
| 2026-11-28 02:00 | fail | 20 | 3 | headless | 11.0 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t130-subscriptions-ui.mjs`), not this page._
