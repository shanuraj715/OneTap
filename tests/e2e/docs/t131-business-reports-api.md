# T131 — Business app server side: owners / managers / accountants may sign in, others are turned away; coupon usage, table bookings, counted stock, plain-English insights, the sales goal, the expenses ledger (+ profit & loss from it) and Excel / PDF / CSV reports hold the right numbers

**Area:** analytics · **Last result:** ✅ PASSED (94 passed, 0 failed · 2026-11-28 13:28 · headless · 5.5 s)

**Run it alone:** `node run.mjs --only t131` (add `--visible` to watch it)

## What this test does

API checks on an in-memory database with made-up orders (two outlets), coupons, bookings, dishes with counted stock and bills; every expected number is worked out in the test from that data. Sign-in to the new app (owner, manager, accountant in; waiter and cook turned away in words; the other apps' sign-ins unchanged). Coupon usage (case-insensitive codes, cancelled / unpaid / older orders left out, the previous period, unused coupons, per outlet), table bookings (guests, no-shows, advance, party sizes, busiest day), stock (out / low / fine, days left), insights, a plan without coupons or bookings leaving them out, the expenses ledger (rules, totals by category / vendor / outlet / method, the chart, corrections, deleting, who may), profit & loss from the recorded bills, real .xlsx / PDF / CSV files, the monthly goal, and the older analytics unchanged.

## Steps

1. Who may sign in to the Business app (the server decides, not the app)
2. Seeding made-up data (worked out independently below)
3. Business app options: what the plan includes and what the person may do
4. Coupon usage
5. Table reservations
6. Counted stock
7. Insights in plain words
8. A plan without coupons or bookings simply leaves them out
9. The expenses ledger
10. Profit & loss from the recorded bills
11. Reports as files: Excel and PDF
12. The monthly sales goal
13. The older analytics and the other apps are untouched

## What to expect (these must happen)

- Owners, managers and accountants sign in to the Business app; a waiter or a cook is refused with a sentence and no session is left open.
- Coupon usage, bookings, stock and expense figures equal the numbers worked out separately from the same data.
- The Excel file has a sheet for each chosen section (coupons, reservations, expenses, profit & loss) and the PDF is a real PDF.
- Profit & loss worked from the ledger = net sales − food cost − the recorded bills.

## What must NOT happen

- A cancelled, unpaid or out-of-range order must NOT count as a coupon use.
- A manager must NOT read or write the ledger, or download files.
- A plan without coupons or bookings must NOT show them (it answers enabled: false).
- The other apps' sign-ins and the store dashboard's analytics must NOT change.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (94)

**Step 1 — Who may sign in to the Business app (the server decides, not the app)**

- the owner, a manager and an accountant can sign in — _200,200,200_
- the owner's answer lists what they may do (so the app can show only that)
- waiter is turned away, in words
- cook is turned away, in words
- the other apps' sign-ins are exactly as before (a waiter still signs in to OMA, a cook to the Kitchen app)
- …and the Kitchen app still says it is for the kitchen team
- the console's app list names Rasoi Pulse Business (code BIZ); it starts private, so it is not on the website yet
- the public list still has only the staff apps — _oma,kda,rda_

**Step 2 — Seeding made-up data (worked out independently below)**

- the made-up orders, coupons and bookings are in

**Step 3 — Business app options: what the plan includes and what the person may do**

- the owner's options list the plan's features and that money, files and expenses are allowed — _["takeaway","dineInQr","analytics","coupons","reservations","feedback"]_
- …the outlets, the expense categories and the payment methods
- the report sections now include coupons, reservations and (a money figure) expenses
- a manager sees analytics but not money figures, and can't write expenses

**Step 4 — Coupon usage**

- 6 orders used a coupon in the last 7 days: ₹400 given away on ₹2,950 of sales (cancelled, unpaid and older orders left out)
- SAVE10 (also typed in lower case) was used 4 times by 3 customers: ₹200 given, ₹1,650 of sales
- WELCOME: 2 uses, ₹200 given, ₹1,300 of sales
- the most used coupon comes first
- 75% of the 8 orders used a coupon; an order with a coupon averaged ₹491.67, one without ₹500
- against the period before (1 use): all coupons up 500%, SAVE10 alone up 300%
- a coupon that is switched on but nobody used is listed as unused (a switched-off one is not) — _UNUSED5_
- by outlet: 4 uses at one, 2 at the other
- choosing only the second outlet shows only its coupon uses
- a manager can read coupon usage
- a bad or missing date range is refused (400)

**Step 5 — Table reservations**

- 4 bookings for 20 guests (average party 5): 2 came, 1 no-show, 1 cancelled
- no-show rate 25%; ₹200 advance collected, ₹100 to refund; ₹1,200 of bookings that count
- 1 booking coming up this week; 1 taken by staff; up 300% on the period before
- party sizes: one booking in each band
- the most common reason is a Birthday (2)
- the busiest day is the one with 2 bookings; the chart has a point for each of the 7 days — _Thursday_
- by outlet: 3 and 1

**Step 6 — Counted stock**

- 3 dishes are counted (1 out, 1 low), 2 are not, 1 is switched off — _{"dishes":5,"counted":3,"notCounted":2,"out":1,"low":1,"switchedOff":1}_
- the riskiest are first: out of stock, then low, then fine
- Veg Momos sells about the number of portions worked out from the last 7 days; a dish nobody ordered has no 'days left' — _2.6_
- the switched-off dish is named
- a dish whose stock is not counted is only counted, not listed

**Step 7 — Insights in plain words**

- the sales insight says sales are up 387.7% on the period before
- the best seller is named — _Veg Momos is your best seller_
- a warning says dishes are out or low, naming them
- the most used coupon is mentioned
- every insight has a title, a sentence and a tone
- with no orders in the dates it says so, instead of making things up

**Step 8 — A plan without coupons or bookings simply leaves them out**

- a store whose plan lacks coupons and reservations gets { enabled: false } (the app hides those sections)
- its options do not list coupons
- a store whose plan has no analytics is told so (403), in words — _Analytics isn't included in your plan._

**Step 9 — The expenses ledger**

- an amount of 0 is refused — _400 The amount must be more than 0_
- a negative amount is refused — _400 The amount must be more than 0_
- a fraction of a paisa is refused — _400 Use at most two decimals (paise)_
- an absurd amount is refused — _400 That amount looks too big — check the number_
- a date that is not a date is refused — _400 Use a date like 2026-11-16_
- a missing category is refused — _400 Category is required._
- an outlet that is not the store's is refused — _400 That outlet doesn't belong to your store._
- a very long note is refused — _400 Keep the note under 300 characters_
- an expense is written (rupees in, rupees out, paise kept exactly), with its outlet and who wrote it
- an expense with no outlet is a cost of the whole store
- the ledger adds up (₹36,750.50 over 4 bills) and lists the newest first — _{"amount":36750.5,"entries":4,"previous":1000,"change":3575.1,"perDay":5250.07}_
- against the period before it is compared — _3575.1_
- by category: rent first, raw materials ₹1,950.50, each with its share
- by payment method
- by vendor (the same shop typed in two ways is one vendor)
- the chart has a point a day and they add up to the total
- by outlet, with the whole-store costs on their own line
- choosing one outlet shows only its bills (the whole-store rent is left out)
- a category can be picked
- an expense can be corrected
- a bill that is not there is a 404
- a wrong bill is taken off, and the total follows (the earlier correction to ₹1,300 included)
- an accountant can write a bill
- a manager can neither read nor write the ledger (money figures) — 403
- a waiter can't read any of it (403)
- not signed in: 401

**Step 10 — Profit & loss from the recorded bills**

- the profit & loss answer carries the bills recorded for the range, by category
- worked from the ledger: net sales − 30% food cost − the recorded bills = net profit (arithmetic done separately) — _-33585 vs -33585_
- each recorded category is a line of its own
- the old way (monthly estimates typed in) still works exactly as before

**Step 11 — Reports as files: Excel and PDF**

- Excel: a real .xlsx file comes back
- …with a sheet for each section asked for, including the new ones
- the Coupon usage sheet: SAVE10 used 4 times, ₹200 given, ₹1,650 of sales — _["SAVE10",4,200,1650,412.5,3,0.5,"2026-11-27"]_
- the Expenses sheet ends with a total equal to the ledger
- PDF: a real PDF file comes back — _2461 bytes_
- CSV: the coupons table
- a manager can't download a report with money figures (403)
- …and a manager can't download any report file (files are for owners and accountants)
- a bad range in a report request is refused (400)

**Step 12 — The monthly sales goal**

- no goal yet: nothing is claimed
- the goal is saved, and 'so far this month' equals the paid orders of this month — _4760 vs 4760_
- …the percentage reached and the daily average are worked out
- …and what is needed per remaining day
- a manager can see the goal but not change it
- a negative goal is refused
- the goal can be cleared

**Step 13 — The older analytics and the other apps are untouched**

- the overview still counts the same orders and sales as before — _8/395000_
- every report section that existed before is still there
- the store dashboard (browser cookie) reads analytics exactly as before

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-28 13:28 | pass | 94 | 0 | headless | 5.5 s |
| 2026-11-28 03:16 | pass | 94 | 0 | headless | 6.9 s |
| 2026-11-28 03:16 | fail | 93 | 1 | headless | 7.0 s |
| 2026-11-28 03:16 | fail | 93 | 1 | headless | 7.2 s |
| 2026-11-28 03:16 | fail | 93 | 1 | headless | 6.9 s |
| 2026-11-28 03:16 | fail | 90 | 4 | headless | 7.6 s |
| 2026-11-28 03:15 | pass | 94 | 0 | headless | 6.8 s |
| 2026-11-28 03:15 | fail | 91 | 2 | headless | 7.6 s |
| 2026-11-28 03:05 | fail | 69 | 3 | headless | 7.8 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t131-business-reports-api.mjs`), not this page._
