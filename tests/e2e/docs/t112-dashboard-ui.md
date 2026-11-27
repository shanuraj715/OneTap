# T112 — Dashboard: a cleaner, more modern look with a needs-attention strip, three new widgets, each role and plan sees only its own, and a clear Configure-dashboard grid

**Area:** dashboard · **Last result:** ✅ PASSED (48 passed, 0 failed · 2026-11-27 09:54 · headless · 6.7 s)

**Run it alone:** `node run.mjs --only t112` (add `--visible` to watch it)

## What this test does

Chrome against the bench. The owner's dashboard: a greeting by name, today's date and 'Updated hh:mm' with a Refresh button; a strip that says whether anything needs attention; every card has a coloured icon chip; the new Out for delivery, Table bookings and Customer rating cards sit beside the old ones; the revenue chart is drawn at the card's width and pointing at it reads out that day's revenue. With made-up numbers (the stats call is answered with them for this check only): five chips — '3 orders are over the time limit' and '2 online orders are waiting for payment' (Orders), '1 delivery is ready and waiting for a rider', '2 bookings are waiting for your yes' (Bookings), '4 messages could not be sent today' (Notifications); the revenue card says '125% of yesterday' and 'Yesterday: ₹4,000' with a little trend line; the rating card 4.5 with five stars and '12 ratings, last 30 days'; the deliveries card '1 to hand over'; the bookings card '2 need a yes'. The kitchen sees its queue and recent orders but no revenue, rating or bookings; the owner of the small Starter plan has no deliveries, bookings, rating, coins or message-failure cards. Configure dashboard: one row per widget (20), a column per role (Owner, Manager, Cashier / Staff, Kitchen, Accountant — none for the platform's super admin), Revenue for the Kitchen is a padlock saying 'Kitchen can't open Reports', the accountant is ticked; unchanged → Saved and off; unticking the manager and switching Sold out off → 'Save changes' and '19 of 20 widgets on'; Move down changes the order; Save stores it and the manager's own dashboard loses Orders today and Sold out and shows the new order; a column's all / none link ticks or clears every widget that role may be given (never the padlocked ones); 'Recommended' (with a confirm) puts everything back, waiting for Save. On the Starter plan the Deliveries switch is off and its cells say 'Not in your plan (Delivery)'. On a phone the widgets are stacked with the roles as chips, no sideways scroll, and the dashboard keeps two cards a row. The bench's dashboard settings are put back at the end.

## Steps

1. A. The owner's dashboard
2. B. Needs-attention chips and the new cards (the numbers are made up for this check)
3. C. Other roles, and a small plan
4. D. Configure dashboard
5. D2. All / none, and back to recommended
6. D3. A small plan: widgets the plan doesn't include
7. D4. On a phone

## What to expect (these must happen)

- The dashboard shows what needs attention, with each item linking to the page that fixes it.
- The kitchen sees no revenue; a small plan sees no cards for features it doesn't have.
- The Configure page shows a padlock, with the reason, where a role can't be given a widget.
- Changes made on the Configure page reach the other person's dashboard.

## What must NOT happen

- A padlocked cell must NOT be ticked by an 'all' link.
- No sideways scrolling on a phone.
- No errors in the browser.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (48)

**Step 1 — A. The owner's dashboard**

- a greeting by name, today's date and when the numbers were last updated — _Good morning, Owner Friday, November 27 — here is how the day is going. Updated 9:54 AM_
- a strip says whether anything needs attention (all clear, or what to do)
- the owner of a full plan sees the new widgets (deliveries, bookings, rating) beside the old ones — _20 widgets_
- each card has a coloured icon chip beside its title
- the revenue chart is drawn at the card's width — _671×176_
- pointing at the chart reads out that day's revenue
- …and the read-out goes away again
- the Refresh button can be pressed

**Step 2 — B. Needs-attention chips and the new cards (the numbers are made up for this check)**

- with trouble, the strip lists what needs a person
- '3 orders are over the time limit' → the Orders page — _3 orders are over the time limit_
- '2 online orders are waiting for payment' → Orders
- '1 delivery is ready and waiting for a rider'
- '2 bookings are waiting for your yes' → Bookings
- '4 messages could not be sent today' → Notifications
- the revenue card says '125% of yesterday' and what yesterday was — _Revenue today ₹5,000 Yesterday: ₹4,000 125% of yesterday_
- …with a little trend line
- the rating card shows 4.5 with five stars and '12 ratings, last 30 days'
- the deliveries card says 2 on the way, 1 to hand over
- the bookings card says '2 need a yes'

**Step 3 — C. Other roles, and a small plan**

- the kitchen sees its queue and recent orders — no revenue, rating or bookings
- the owner of the small Starter plan has no deliveries, bookings, rating, coins or message-failure cards (not in the plan)
- …but does have revenue, orders and coupons (in the plan)

**Step 4 — D. Configure dashboard**

- one row for each of the 20 widgets
- a column for each role (Owner, Manager, Cashier / Staff, Kitchen, Accountant) — and none for the platform's super admin
- Revenue for the Kitchen is a padlock that says why (they can't open Reports) — _Kitchen can't open Reports, so its numbers are not for them_
- …the accountant has a tick, the cashier a padlock
- '20 of 20 widgets on'
- nothing changed: the button says Saved and is off
- the manager is ticked for 'Orders today'
- unticking the manager turns the button to 'Save changes'
- switching 'Sold out right now' off makes it '19 of 20 widgets on'
- 'Move down' swaps the first two rows
- Save: 'Dashboard configuration saved.' and the button is back to Saved
- what was saved: the new order, no manager on Orders today, Sold out switched off — _orders-today,revenue-today_
- the manager's own dashboard now has no 'Orders today' and no 'Sold out', but still has Revenue — _revenue-today,avg-order-value-today,active-queue,missed-orders,new-customers-today_
- …and the new order is the one everyone sees

**Step 5 — D2. All / none, and back to recommended**

- pressing the Kitchen column's link ticks every widget the kitchen may be given
- …and pressing it again does the opposite — _false,false,false,false,false,false,false,false,false,false,false_
- the padlocked widgets for the kitchen are never ticked by 'all'
- 'Recommended' puts the usual order, every widget on and the usual roles back — waiting for Save — _revenue-today,orders-today_

**Step 6 — D3. A small plan: widgets the plan doesn't include**

- on the Starter plan the Deliveries switch is off and can't be turned on
- …and its role cells say 'Not in your plan (Delivery…)' — _Not in your plan (Delivery)_
- …and the row says what it needs ('needs Delivery')
- widgets the plan does include can still be switched

**Step 7 — D4. On a phone**

- on a phone the widgets are stacked (no wide grid) and the page doesn't scroll sideways — _{"rows":20,"table":false,"sideScroll":false,"locked":17}_
- …with the roles as chips and the unavailable ones marked
- the new dashboard on a phone: two cards a row, no sideways scroll — _{"cols":2,"side":false}_
- no errors or warnings in the browser

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-27 09:54 | pass | 48 | 0 | headless | 6.7 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t112-dashboard-ui.mjs`), not this page._
