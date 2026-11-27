# T53 — Orders that grow the business — out for delivery with a rider, pre-orders for later, stock counts, menu hours, combos and buy-X-get-Y coupons (API rules)

**Area:** orders · **Last result:** ✅ PASSED (84 passed, 0 failed · 2026-11-27 16:14 · headless · 6.7 s)

**Run it alone:** `node run.mjs --only t53` (add `--visible` to watch it)

## What this test does

Runs suites/orders-growth-api.mjs: its own in-memory API with a store on a plan that has everything and one on a Basic plan (no Pre-orders, no Delivery). Stock: an order takes counted stock at once (two lines of the same dish add up, a combo takes its parts), a refused order takes nothing, cancelling or deleting an order that was never handed over gives it back exactly once, an edit takes or gives the difference, a daily-counted dish refills on the first menu read of a new India-time day (but never over a count the owner just typed), and an online order nobody pays for within 30 minutes gives its stock back. Menu hours: a category's hours reach its dishes, outside them the dish shows when it is served (or is hidden), customers can't order it but staff can, and a pre-order is checked against its pickup time. Pre-orders: off until switched on, pickup times every 15 min from 30 min ahead within opening hours, a full time is refused and shown full, only takeaway, the plan decides, the Account page and the dashboard carry the pickup time, and the missed-order alert waits until an hour before pickup. Riders: only a delivery order goes out, managers keep the rider list, cashiers can hand an order to a rider, the customer sees the rider's name and number only while it is on the way, a switched-off or unknown rider is refused, orders keep the rider they went out with. Combos: no combo inside a combo or inside itself, savings worked out, an ordered combo carries its parts, each part prints on its own station's kitchen ticket, and a pre-order's ticket starts with PRE-ORDER and the full pickup time. Buy X get Y: the cheapest covered dishes are free, chosen categories and dishes, a cap on free dishes, helpful messages when the cart doesn't qualify, and the order gets the same discount.

## Steps

1. counted stock — orders take it, cancelling and deleting give it back
2. the daily refill, and online orders nobody paid for
3. dishes with hours (a breakfast menu)
4. pre-orders — a later pickup time for takeaway
5. out for delivery, and riders
6. combos — a dish made of other dishes
7. buy X, get Y free coupons

## What to expect (these must happen)

- Counted stock goes down with every order, can never go below zero, and comes back on cancel / delete / unpaid online orders — exactly once.
- A daily-counted dish refills itself on a new day; switching counting off works.
- A dish outside its hours shows 'Available …' and can't be ordered by customers (staff can); a pre-order for a time inside its hours can.
- Pre-orders: the right pickup times, full times refused, takeaway only, plan-gated, pickup time on the Account page and the dashboard, no early red alert.
- Only a Ready delivery order goes out for delivery, with a rider from the list or typed in; the customer sees the rider while it's on the way; completed delivery = Delivered.
- Combos price at their own price, show their savings, take their parts' stock and split onto the kitchen and bar tickets.
- Buy-1-get-1 / buy-2-get-1 give the cheapest covered dishes free, capped, with clear messages.

## What must NOT happen

- Stock must NOT go below zero, be taken by a refused order, or be given back twice.
- A takeaway or dine-in order must NOT go out for delivery; a rider who is switched off or unknown must NOT be given an order.
- A pre-order must NOT be accepted for a time that isn't offered or is full, or on a plan without Pre-orders.
- A combo must NOT contain itself or another combo.
- A buy-X-get-Y coupon must NOT make anything but the cheapest covered dishes free.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (84)

**Step 1 — counted stock — orders take it, cancelling and deleting give it back**

- a dish can be counted: the menu says 5 are left — _{"tracked":true,"left":5,"daily":null,"lowAt":3}_
- a customer orders 2 → 3 are left — _201 3_
- ordering 4 when only 3 are left is refused, saying how many are left — _409 {"error":"Only 3 Veg Momos left — reduce the quantity"}_
- …two lines of the same dish add up (2 + 2 > 3) — _409_
- a refused order takes nothing
- the last 3 sell → 0 left — _0_
- at 0 the storefront shows it as Sold out — _{"a":false,"l":"Sold out"}_
- ordering a sold-out dish is refused — _409_
- cancelling the order of 3 gives them back — _3_
- …and only once
- deleting an order that was never handed over gives its stock back too — _200 5_
- staff orders take stock too
- editing it up to 6 (only 4 + its own 1 = 5 there) is refused and changes nothing — _409 4_
- editing it up to 3 takes 2 more — _200 2_
- editing the momos out gives all 3 back — _5_

**Step 2 — the daily refill, and online orders nobody paid for**

- setting today's count keeps it (the morning refill doesn't overwrite a number the owner just typed)
- on a new day the dish is refilled to its daily number when the menu is next read — _20_
- …once (reading again doesn't refill again)
- an online order waiting for payment holds its stock — _16_
- …and gives it back if nobody pays within 30 minutes — _1 20_
- …only once
- counting can be switched off again (stock: null)

**Step 3 — dishes with hours (a breakfast menu)**

- a category carries its hours in the menu
- outside its hours a dish shows when it IS available instead of a price — _Available 6:13 PM – 7:13 PM_
- …or is hidden, when the outlet chooses that
- a customer can't order it now — _409 {"error":"Poha is only available 6:13 PM – 7:13 PM"}_
- staff at the till can still sell it — _201_
- a window that starts and ends at the same time is refused — _400_
- a day that doesn't exist is refused — _400_
- a dish's own hours win over its category's

**Step 4 — pre-orders — a later pickup time for takeaway**

- off until the outlet switches pre-orders on — _{"enabled":false,"days":[]}_
- now the outlet offers pickup times, grouped by day — _Today:29 Tomorrow:95_
- …none sooner than 30 minutes from now
- …every 15 minutes
- a customer places a takeaway for a later time — _201 2026-11-27T12:00:00.000Z_
- a time that's full (1 per time here) is refused — _409_
- …and is shown as full
- a time that isn't on offer (too soon / not a slot) is refused — _409_
- only takeaway can be placed for later — _400_
- breakfast can be pre-ordered for a time when breakfast is served (hours are checked at the pickup time)
- the customer's Account page shows the pickup time
- the dashboard's order list carries it too
- a store whose plan lacks Pre-orders offers no times, even with the setting on
- a pre-order nobody has accepted doesn't turn red hours ahead of its pickup time
- …its accept clock starts an hour before pickup (30 min to go = 30 min waiting)
- an ordinary order still counts from when it was placed

**Step 5 — out for delivery, and riders**

- only a delivery order has an 'Out for delivery' step after Ready
- a takeaway order can't go out for delivery — _409_
- …or be given a rider
- a cashier can't add riders (rider list is for managers) — _403_
- a manager adds a rider — _201_
- the same name twice is refused
- a phone that isn't a number is refused
- a cashier can see the riders (to hand an order over)
- a store whose plan has no Delivery has no rider list
- handing a Ready delivery order to Ramesh marks it Out for delivery with his name and number — _200 out_for_delivery_
- the customer sees it is on its way, and who is bringing it — _{"name":"Ramesh","phone":"98765 43210"}_
- the rider can be changed (a name typed in once works too)
- a rider who isn't on the list is refused
- then it is marked delivered (a completed delivery is called Delivered)
- once delivered, the rider's number is no longer shown to the customer
- an order still being cooked can't go out yet — _409_
- a rider switched off in the list can't be given orders — _409_
- a rider can be removed
- …orders keep the rider they went out with

**Step 6 — combos — a dish made of other dishes**

- a combo is a dish with the dishes it is made of — _201_
- the storefront can show what it saves (₹130 separately, ₹110 as a combo → saves ₹20)
- a combo can't contain itself — _400_
- a combo can't contain another combo — _400_
- a dish that is part of a combo can't become a combo itself — _400_
- an ordered combo carries what it is made of
- a combo takes its parts' stock (2 combos → 2 momos) — _10 → 8_
- the KITCHEN ticket says to make the momos of the combo
- the BAR ticket says to make its chai
- a pre-order's kitchen ticket starts with PRE-ORDER and the full pickup time

**Step 7 — buy X, get Y free coupons**

- a 'buy 1 get 1 free' coupon on the Food category is created
- it reads 'Buy 1 get 1 free on chosen dishes' — _Buy 1 get 1 free on chosen dishes_
- 2 momos (₹100 each) + a chai: one momo is free — ₹100 off (the chai isn't covered)
- with only one covered dish it says to add one more — _Add 1 more of the offer's dishes to get one free._
- with none of the covered dishes it says so — _This offer is for other dishes — add one of them to use it._
- the CHEAPEST covered dish is the free one (momo ₹100 free, combo ₹110 paid) — _10000_
- 'buy 2 get 1' on chai with at most 1 free: 6 chais → 1 free (₹30) — _3000_
- an order placed with it gets the same discount — _201 10000_
- buy 0 is refused — _400_

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-27 16:14 | pass | 84 | 0 | headless | 6.7 s |
| 2026-11-27 12:08 | pass | 84 | 0 | headless | 7.3 s |
| 2026-11-27 10:53 | pass | 83 | 0 | headless | 7.2 s |
| 2026-11-21 13:08 | pass | 84 | 0 | headless | 6.1 s |
| 2026-11-21 05:02 | pass | 84 | 0 | headless | 7.7 s |
| 2026-11-21 04:20 | pass | 84 | 0 | headless | 7.6 s |
| 2026-11-21 03:21 | pass | 84 | 0 | headless | 6.7 s |
| 2026-11-20 16:15 | pass | 84 | 0 | headless | 7.3 s |
| 2026-11-20 16:13 | pass | 84 | 0 | headless | 7.0 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t53-orders-growth-api.mjs`), not this page._
