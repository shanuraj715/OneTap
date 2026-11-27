# T54 — Bringing customers back — table bookings, ratings, order again, suggestions and abandoned-cart reminders (API rules)

**Area:** customers · **Last result:** ✅ PASSED (89 passed, 0 failed · 2026-11-27 17:00 · headless · 8.8 s)

**Run it alone:** `node run.mjs --only t54` (add `--visible` to watch it)

## What this test does

Runs suites/engagement-api.mjs: its own in-memory API, a store on a plan with everything and one on a Basic plan without Table reservations, Ratings or Cart reminders, and a fake SMS gateway on this machine. Bookings: off until switched on; days and times from opening hours with minimum notice; capacity counts every booking that overlaps (a declined one frees its seats); sign-in needed; big parties told to call; staff can overbook only on purpose; confirm → seat at a table → complete, with no skipping; cashiers see and run bookings, the kitchen doesn't; guests hold at most 3 upcoming bookings, see only their own (none of the team's notes) and cancel inside the outlet's window; auto-confirm; the plan decides. Ratings: only completed orders from the last 30 days, only your own, one per order and changeable for a week, unknown tags dropped, happy ratings offered the Google review link, the owner's summary (average, stars, comments) and filters, who may see them, the plan decides. Order again: rebuilt against today's menu — sizes, add-ons and notes kept, sold-out and deleted dishes left out with why, dropped add-ons said, priced at today's prices, nobody else's order. Suggestions: the owner's picks, nothing already in the cart, nothing sold out, nothing that needs a choice, what others ordered together, and off when switched off. Cart reminders: nothing kept while off; managers switch them on (not cashiers); sending hours that make sense; one reminder after the delay, by SMS here, saying what was left, what it's worth and linking straight to the cart (which opens on another phone with dishes only); never twice; an order afterwards counts as won back; never again within the customer's gap, outside sending hours or for a cart older than a day; stats with phone numbers partly hidden.

## Steps

1. table bookings — what can be booked
2. booking, capacity, and what the team does
3. the guest's own bookings
4. ratings — customers rate completed orders
5. order again
6. 'goes well with your order'
7. abandoned-cart reminders

## What to expect (these must happen)

- Bookings fit the outlet's capacity and hours; the team confirms, seats and completes them; guests see and cancel their own.
- Customers rate their own completed orders; the store sees the average, the stars and the comments; happy customers are offered Google.
- Order again rebuilds the cart from today's menu and says what couldn't come back.
- Suggestions are one-tap dishes the owner picked or that people order together.
- A forgotten cart gets exactly one reminder, at a sensible hour, and a later order counts as won back.

## What must NOT happen

- A booking must NOT overfill the outlet unless the team chooses to; a guest must NOT see or cancel someone else's booking.
- A rating must NOT be possible for an order that isn't completed, isn't yours, or is too old; it must NOT be changed after a week.
- Order again must NOT add dishes that are sold out or gone.
- A cart reminder must NOT be sent twice, too soon after another, outside sending hours, for an old cart, or by a store that has them off.
- A store whose plan lacks a feature must NOT be able to use it.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (89)

**Step 1 — table bookings — what can be booked**

- booking is off until the outlet switches it on — _{"enabled":false,"settings":{"minPartySize":1,"maxPartySize":10,"durationMinutes_
- now: today plus 7 days to choose from — _8 2026-11-28_
- tomorrow 7 PM is free for 4 (10 seats) — _{"at":"2026-11-28T13:30:00.000Z","label":"7:00 PM","available":true,"seatsLeft":10}_
- the guest note and party limits come with it
- nothing sooner than an hour from now is offered (minimum notice)

**Step 2 — booking, capacity, and what the team does**

- booking needs the customer to be signed in — _401_
- Asha books tomorrow 7 PM for 4 — it waits for the restaurant to confirm — _201 requested B-0001_
- 8 more at the same time don't fit (6 seats left)
- 6 at 7:30 PM fit (they overlap Asha's 4 for an hour: 10 seats) — _201_
- now 7 PM is full for anyone else
- a time that isn't one of the slots is refused — _409_
- a party bigger than the outlet takes online is told to call — _409_
- the team can't overbook by accident… — _409_
- …but can take it anyway when they choose to (confirmed at once) — _201_
- a cashier sees tomorrow's bookings: 3 bookings, 12 guests, 2 waiting — _{"bookings":3,"guests":12,"requested":2,"waitingAhead":2}_
- the kitchen doesn't see bookings
- the sidebar count: 2 waiting to be confirmed — _{"pending":2}_
- a booking can't be seated before it is confirmed — _409_
- the cashier confirms Asha's booking
- …and declines Ravi's, with a reason
- a declined booking frees its seats
- when they arrive they are seated at table 7 — _200 7_
- …and the booking is completed when they leave

**Step 3 — the guest's own bookings**

- a guest can hold at most 3 upcoming bookings — _409_
- Meera sees her 3 bookings, each cancellable — and none of the team's notes — _3_
- she cancels one
- nobody else can cancel her booking — _404_
- she books tomorrow evening — _201_
- too close to the time (inside the 2-day window), she is told to call instead — _409_
- with auto-confirm on, a booking is confirmed at once — _confirmed_
- a store whose plan lacks Table reservations can't take bookings, even with the switch on
- …and has no bookings page
- …and a booking sent anyway is refused — _403_

**Step 4 — ratings — customers rate completed orders**

- the Account page knows the store takes ratings
- a completed order can be rated; one still cooking, or older than 30 days, can't — _[true,false,false]_
- rating an order that isn't completed is refused — _409_
- rating an order from more than 30 days ago is refused — _409_
- nobody can rate someone else's order — _404_
- Asha gives 5 stars — and is offered the store's Google review page — _200 https://g.page/r/acme/review_
- a 2-star rating is not sent to Google
- her order now shows her rating (made-up tags are dropped) and that she can still change it
- rating again changes it (still one rating per order)
- …but not after a week — _409_
- the owner's Ratings page: 2 ratings, average 4.0, one 5★ and one 3★, both with comments
- each rating shows the customer, the order number and what was ordered
- it can show only the low ratings
- a cashier can't see ratings
- an accountant can
- a store whose plan lacks Ratings has no ratings page
- …and its customers can't rate — _403_
- …nor are they asked to

**Step 5 — order again**

- Asha asks to order an old order again — _200_
- the momos come back as they were: Full, 2 of them, with cheese and the kitchen note
- …and 3 chais
- the sold-out lassi and the soup that's gone are left out, with why
- an add-on that isn't offered any more is dropped, and said so
- those lines price at today's prices (₹120 + ₹20 cheese) × 2 + ₹30 × 3 — _37000_
- nobody can re-order someone else's order — _404_

**Step 6 — 'goes well with your order'**

- the owner picks what goes with momos (the dish itself and unknown dishes are dropped) — _["6b0969ea005ac69f2c92abf5","6b0969ea005ac69f2c92abfc","6b0969ea005ac69f2c92abf7"]_
- with momos in the cart: chai and lassi are suggested (the curry needs a spice choice, so it can't be one tap) — _["6b0969ea005ac69f2c92abf5","6b0969ea005ac69f2c92abf7"]_
- under the outlet's title
- nothing already in the cart is suggested
- a sold-out dish isn't suggested
- with no picks, what others often ordered with it is suggested (roll → cola, ordered together 3 times) — _[{"itemId":"6b0969ea005ac69f2c92abfa","variantId":null}]_
- switched off, nothing is suggested

**Step 7 — abandoned-cart reminders**

- while reminders are off, no cart is kept at all
- the store's settings: allowed by the plan, off, 30 minutes
- a cashier can't change them
- sending hours that end before they start are refused
- a manager switches them on for the store — _200_
- a store whose plan lacks them can't switch them on
- …and keeps no carts
- now Asha's cart is kept: 3 items worth ₹170 — _{"n":3,"v":17000}_
- nothing is sent while the cart is fresh
- 40 minutes later ONE reminder goes to Asha's number — _1 1_
- it says what she left, what it's worth, the store, and links straight to her cart
- it is never sent twice
- the cart is marked reminded (by SMS)
- the link's cart can be opened on another phone — dishes only, nothing personal
- she orders after the reminder → counted as won back, with the order's value — _recovered 3000_
- a new forgotten cart within 3 days of her last reminder is NOT reminded about
- …it is marked skipped
- outside the sending hours nothing goes out
- a cart left more than a day ago is never reminded about
- another customer's 50-minute-old cart is reminded about
- the settings page shows: 2 sent, 1 won back (with its value) and the recent ones — _{"s":2,"rec":1,"v":3000,"n":2}_
- …with phone numbers partly hidden
- an emptied cart is removed
- switched off again, carts are no longer kept

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-27 17:00 | pass | 89 | 0 | headless | 8.8 s |
| 2026-11-27 16:14 | pass | 89 | 0 | headless | 5.4 s |
| 2026-11-27 12:06 | pass | 89 | 0 | headless | 5.9 s |
| 2026-11-27 10:53 | pass | 89 | 0 | headless | 5.2 s |
| 2026-11-21 13:02 | pass | 89 | 0 | headless | 5.3 s |
| 2026-11-21 05:02 | fail | 87 | 1 | headless | 5.7 s |
| 2026-11-20 16:15 | pass | 88 | 0 | headless | 5.2 s |
| 2026-11-20 16:13 | pass | 88 | 0 | headless | 5.5 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t54-engagement-api.mjs`), not this page._
