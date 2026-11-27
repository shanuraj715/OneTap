# T111 — Dashboard: every widget needs a permission (some a plan feature), a person is only SENT the numbers they may see, plus deliveries / bookings / rating widgets and India's day boundary

**Area:** dashboard · **Last result:** ✅ PASSED (46 passed, 0 failed · 2026-11-28 04:09 · headless · 7.0 s)

**Run it alone:** `node run.mjs --only t111` (add `--visible` to watch it)

## What this test does

Runs suites/dashboard-roles-api.mjs against a private API on an in-memory database. The rules: 20 widgets, each names a real permission (and, for coupons, coins, notifications, deliveries, bookings and ratings, a real plan feature); no widget is shown by default to a role that may not read its numbers; the content editor has no dashboard; the kitchen can't be given Revenue (needs Reports) but the accountant can; a plan without Delivery can't have the deliveries widget; a tick left on a role that may not read the numbers shows nothing; a widget switched off is gone for everyone, the platform super admin included. A store with paid, unpaid, delivery and booking data, a full plan, and an owner, manager, cashier, kitchen, accountant and editor: the owner gets today's five orders and ₹500 revenue (not the two from before India's midnight — the order a minute past midnight counts, the one a minute before does not), yesterday's ₹600 for the 'compared with yesterday' line, a 14-day trend whose last day is today in India, the hour chart on India's clock, deliveries (1 out, 1 waiting for a rider), bookings (3 today, 1 waiting for a yes, 2 still to come; tomorrow's left out), rating 4.0 from 3 ratings (the 40-day-old one is outside 30 days). The KITCHEN is sent no revenue, average or trend even though paid orders exist (those numbers are never even computed), but gets orders, queue, status and recent orders; a cashier gets the queue and bookings but no revenue; the accountant the money and the trend but no bookings and only the lists set for them; the editor gets 403. A store on a small plan gets orders and revenue but nothing about deliveries, bookings or ratings; unlocking Delivery for that store brings deliveries at once. The owner's own choices: switching widgets off stops the server computing them; ticking Revenue for the kitchen changes nothing (the permission wins); taking the kitchen off a widget stops them being sent it; every widget off still answers 200; a dashboard saved before the newest widgets existed still gets them with their defaults.

## Steps

1. The rules
2. Two stores: the full plan and a small one
3. What each role is SENT
4. The plan
5. The owner's own choices
6. A store saved before the new widgets existed

## What to expect (these must happen)

- A person is sent only the numbers behind widgets they may see (permission, plan, and the owner's own choices).
- 'Today' is India's day: the order a minute past India's midnight counts today, the one a minute before it does not.
- The kitchen cannot read the day's revenue by calling the API.

## What must NOT happen

- Ticking a role for a widget it has no permission for must NOT show it the numbers.
- A plan without Delivery / Bookings / Ratings must NOT be sent those numbers.
- A store saved before the new widgets existed must NOT lose them.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (46)

**Step 1 — The rules**

- 20 widgets, every one in the catalogue — _20_
- every widget names a permission that really exists
- …and a plan feature that really exists, when it names one
- no widget is shown BY DEFAULT to a role that may not read its numbers
- the roles that have a dashboard are those who can read orders (the content editor has none) — _super_admin,owner,manager,staff,kitchen,accountant_
- the kitchen can't be given Revenue (it needs Reports)
- …the accountant and owner can; a cashier can't
- bookings: a cashier yes, the accountant no (no access to Bookings)
- a plan without Delivery can't have the deliveries widget; asking only about the role leaves the plan out
- no role / the editor: nothing
- the recommended dashboard has every widget on
- a tick left on a role that may not read the numbers shows nothing (the permission wins over the tick)
- a widget switched off is gone for everyone, the platform's super admin included — who otherwise sees every enabled widget
- a dashboard with nothing saved shows each role the widgets it is a default for (a store's saved list is only ever added to) — _8_

**Step 3 — What each role is SENT**

- the owner's 'orders today' counts today's five (not the two from before India's midnight) — _5_
- …revenue today is ₹500 (two paid orders; the unpaid and the delivery ones aren't paid) — _50000_
- …and yesterday's ₹600 (₹400 + the ₹200 order one minute before midnight) is there for 'compared with yesterday' — _60000_
- the 14-day trend's last day is TODAY in India (right date, right money), the day before it is yesterday — _2026-11-28 50000 / 2026-11-27 60000_
- the hour chart agrees with India's clock: the order a minute past midnight is in hour 0 — _1,0,1,1,1,1_
- deliveries: 1 on its way, 1 ready and waiting for a rider — _1/1_
- bookings: 3 today (tomorrow's is left out), 1 waiting for a yes, 2 still to come — _3/1/2_
- rating: 4.0 from 3 ratings (the 40-day-old 1-star is outside the 30 days) — _4 / 3_
- the owner also gets the charts and lists
- a manager gets the same
- the KITCHEN is sent no revenue, no average and no trend — even though paid orders exist (the numbers are never computed for them) — _revenue 0, trend 0_
- …but gets what a kitchen needs: today's orders, the queue, orders by status, recent orders — _5/1_
- …nothing about customers, coins, ratings or bookings (it has no access to those pages)
- …and the deliveries on their way (the kitchen hands them over)
- a cashier: no revenue, the queue, and the bookings (they take them) — _0/1/3_
- the accountant: the money and the trend, no bookings — _50000/14/0_
- …and only the lists and charts that were set for the accountant (no recent orders or top items by default, the hour chart yes)
- the content editor has no dashboard at all (403) — _403_
- the platform's super admin sees everything that is switched on

**Step 4 — The plan**

- on the small plan the owner still gets orders and revenue
- …but nothing about deliveries (no Delivery in the plan), though delivery orders exist
- …nothing about bookings or ratings (no Table reservations / Ratings in the plan)
- unlock Delivery for that one store and its deliveries appear at once — _1_

**Step 5 — The owner's own choices**

- the owner switches Revenue, Average and the trend off — _200_
- …and the server stops computing them (revenue 0, no trend) while the rest still comes — _0/0/5_
- ticking Revenue for the kitchen and a cashier changes nothing: the permission still wins (they are sent 0) — _0/0_
- taking the kitchen off 'Orders today' stops them being sent it, the owner still gets it — _0/5_
- with every widget off, nothing is computed or sent — and the call still answers 200
- back to the recommended dashboard, everything is there again

**Step 6 — A store saved before the new widgets existed**

- a dashboard saved with only the 17 older widgets is accepted and stored as it is — _200 17_
- …and the three newest widgets still arrive for it, with their defaults (nobody has to re-save Settings to get them) — _1/3/3_
- they are appended in their catalogue order

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-28 04:09 | pass | 46 | 0 | headless | 7.0 s |
| 2026-11-27 21:03 | pass | 46 | 0 | headless | 5.5 s |
| 2026-11-27 16:42 | pass | 46 | 0 | headless | 4.6 s |
| 2026-11-27 09:54 | pass | 46 | 0 | headless | 4.6 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t111-dashboard-roles-api.mjs`), not this page._
