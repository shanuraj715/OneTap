# T118 — Table bookings (the team's side): every upcoming booking in one list, a status changed by hand, an approve/decline/cancel message sent automatically, and coupons for bookings — the API

**Area:** bookings · **Last result:** ✅ PASSED (80 passed, 0 failed · 2026-11-27 12:06 · headless · 9.4 s)

**Run it alone:** `node run.mjs --only t118` (add `--visible` to watch it)

## What this test does

Runs suites/booking-manage-api.mjs against a private API on an in-memory database with a fake SMS gateway, a fake WhatsApp Business (Graph) server and a linked WhatsApp account (nothing real is messaged). The list: with no date asked for, GET /api/reservations is every upcoming booking (today onwards, across days), soonest first, with its counts — it used to be 'today only'; 'earlier' is the past, 'all' both in date order, a date filters to that day alone, an empty day is empty, an unknown scope falls back to upcoming; the kitchen still can't see bookings; a booking waiting for its advance isn't listed until paid. Changing a status by hand: a no-show can NOT go back by the usual steps (409), but by hand it can (back to confirmed), the history says it was changed by hand and from what, any status can be moved to every other in turn, the kitchen can't (403), a status that doesn't exist is refused (400); cancelling a paid booking by hand puts its advance on the refund list, bringing it back takes it off, and an advance already sent back stays 'refunded'. The message: a ready-written one for approve / decline / cancel (confirmed + what was paid + 'food and drinks are paid for separately', to the WhatsApp number given; the decline carries the reason and says the advance will be refunded), a route preview (none, SMS, WhatsApp Business, linked WhatsApp); with no way to send the booking is still answered and nothing goes out; SMS gateway → SMS; Business credentials alone aren't enough (an approved template is needed), with a template named it goes through WhatsApp Business (preferred over SMS) as that template with the team's words in its one placeholder, line breaks turned into spaces; a linked WhatsApp number is used first and queues exactly the words the team wrote to the number the guest gave; 'don't send' sends nothing; an older client with no choice still sends the usual message. Coupons: made for table bookings only when 'Table booking' is ticked (none ticked = food orders only), listed in the public offers; a food-only coupon, an unknown code and a buy-one-get-one are refused on a booking with clear words, a minimum amount is respected; the price is worked out with the coupon and the 50% advance is half of what is LEFT (₹2,000 − ₹400 → ₹800 now; the gateway is asked for ₹800); the use is counted when the booking is made, a one-use coupon can't be used twice (refused in words, never quietly booked at full price), and is given back when the advance is never paid or the guest gives up; a 100% coupon leaves nothing to pay and the booking goes straight to the team; the team and the guest see the coupon and what it took off; with no booking charge there is nothing to take off; coupons need the plan feature.

## Steps

1. The bookings list: everything upcoming, soonest first — the date is only a filter
2. Changing a status by hand
3. The message when a booking is approved, declined or cancelled
4. 3b. How it is sent — automatically: linked WhatsApp, else WhatsApp Business, else SMS
5. 3c. The team's choice: no message, the usual message, or their own
6. Coupons on table bookings
7. 4b. Booking with a coupon
8. 4c. A coupon that covers it all; a coupon given back
9. 4d. Coupons need the plan feature; a price of 0 has nothing to take off

## What to expect (these must happen)

- The default list shows every upcoming booking, soonest first, with no date chosen.
- A booking's status can be changed by hand from any status to any other, and what was paid in advance follows.
- Approving, declining and cancelling can tell the guest automatically: linked WhatsApp, else WhatsApp Business, else SMS.
- A booking coupon takes money off the booking amount and the advance is half of what is left.

## What must NOT happen

- A coupon not ticked for table bookings must NOT work on one.
- A buy-X-get-Y coupon must NOT work on a booking.
- A message must NOT be sent when the team switched it off.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (80)

**Step 1 — The bookings list: everything upcoming, soonest first — the date is only a filter**

- with no date asked for, the list is the upcoming bookings — all four, across days — _upcoming 4_
- …soonest first (tomorrow 3 PM, 8 PM, then day 5, then day 9) — _Soon Sam,Tomorrow Tara,Later Lata,Far Farid_
- …with its counts
- scope=upcoming is the same
- 'earlier' has only the booking before today
- 'all' has all five, in date order (the old one first, then the upcoming)
- a date filters to that day alone
- a day with nothing booked is empty
- an unknown scope falls back to upcoming
- no query at all: the upcoming list (it used to be 'today only')
- the kitchen still can't see bookings
- a booking waiting for its advance isn't listed
- …and shows up, waiting to be confirmed, once paid

**Step 2 — Changing a status by hand**

- Sam is marked a no-show
- …and the usual steps do NOT let it go back (409) — the problem the team hit
- changed by hand, it can: back to confirmed
- the booking's history says it was changed by hand, and from what — _confirmed: \| no_show: \| confirmed:Changed by hand from no-show_
- it can be moved to every status in turn (waiting, seated, completed, declined, cancelled, no-show, confirmed)
- the kitchen can't change a status, by hand or otherwise (403)
- a status that doesn't exist is refused (400)
- cancelling a paid booking by hand puts its advance on the refund list
- bringing it back by hand takes it off that list again (the advance stays with the booking)
- if the advance was already sent back, bringing the booking back leaves it 'refunded' (the restaurant has to ask for it again)

**Step 3 — The message when a booking is approved, declined or cancelled**

- the approval message is ready: confirmed, ₹1,000 paid, 'food and drinks are paid for separately', to the WhatsApp number given
- no way to send yet: nothing linked, no Business, no SMS → channel is none
- the decline message carries the reason and says the advance will be refunded (the booking is still 'paid' here: the words are written as if it were already declined)
- …and the cancellation message too
- only approved / declined / cancelled have a message (400 for others)
- the kitchen can't read it (403)
- a booking that isn't there is a 404

**Step 4 — 3b. How it is sent — automatically: linked WhatsApp, else WhatsApp Business, else SMS**

- with no way to send, the booking is still answered and nothing goes out
- with an SMS gateway set up, the booking would go by SMS
- WhatsApp Business credentials alone aren't enough (it needs an approved template) — still SMS
- with a template named in Settings, it would go through WhatsApp Business (preferred over SMS)
- approving with a message posts to WhatsApp Business
- …as the template 'booking_update', to 91 + the WhatsApp number, with the phone number id and token — _/v20.0/PN1/messages 919876500002_
- …the team's (edited) words are the template's placeholder, with line breaks turned into spaces (Meta doesn't allow them) — _Hi Ravi, your table is confirmed — see you!_
- 
- with a WhatsApp number linked, that is used first
- declining with a message queues it on the linked WhatsApp number — exactly the words the team wrote
- …to the WhatsApp number the guest gave

**Step 5 — 3c. The team's choice: no message, the usual message, or their own**

- 'don't send' changes the status and sends nothing
- with no choice made (an older client), the usual message still goes out — as before
- 

**Step 6 — Coupons on table bookings**

- a coupon with no order type ticked is made (it works on food orders)
- a coupon for table bookings is made (channel 'booking')
- …and one for takeaway AND bookings
- …and one with a minimum amount
- …a flat ₹300 one
- …a 100% one
- …and a buy-one-get-one (which can't apply to a table)
- the public offers list says which coupons are for bookings (the storefront filters on it)
- signed out, TABLE20 on 7–9 PM for 2 (₹2,000): −₹400 = ₹1,600; ₹800 now, ₹800 there
- the code can be typed in any case
- a coupon made for food orders doesn't work on a booking, and says so — the price stays ₹2,000
- an unknown code is 'not recognised'
- a buy-one-get-one is for dishes, not a table
- a minimum amount is respected (₹9,000) — _Add ₹7000 more to use this coupon (minimum order ₹9000)._
- a flat ₹300 coupon: ₹1,700, ₹850 now
- a 100% coupon leaves nothing to pay
- a stay shorter than the shortest is refused (400)
- the same booking-only coupon is refused for a food order (it isn't ticked for takeaway)

**Step 7 — 4b. Booking with a coupon**

- Cat books with TABLE20: ₹2,000 − ₹400 = ₹1,600; the advance is 50% of what is LEFT (₹800)
- the gateway is asked for ₹800 (not ₹1,000) — _80000_
- the coupon's use is counted from the moment the booking is made
- a second booking with the same one-use coupon is refused in words ('You've already used this coupon') — never quietly booked at full price — _{"error":"You've already used this coupon.","details":{"code":"coupon_invalid"}}_
- …and Cat's coupon box says the same when she is signed in
- …while Dev can still use it
- a booking with a coupon that isn't for bookings is refused, in words
- …and nothing was created
- a coupon made for takeaway AND bookings works on a booking (10%: ₹1,800)

**Step 8 — 4c. A coupon that covers it all; a coupon given back**

- a 100% coupon: nothing to pay, so the booking goes straight to the team
- …and is in their list at once
- FLAT300 is used (1) by a booking waiting for its advance
- the advance was never paid: the booking is let go AND the coupon is given back (0 uses)
- a guest who gives up before paying gives the coupon back too
- a paid booking keeps its coupon (and the redemption)
- the team sees the coupon, what it took off and the original price
- …and so does the guest

**Step 9 — 4d. Coupons need the plan feature; a price of 0 has nothing to take off**

- with no booking charge a coupon says there's nothing to take off

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-27 12:06 | pass | 80 | 0 | headless | 9.4 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t118-booking-manage-api.mjs`), not this page._
