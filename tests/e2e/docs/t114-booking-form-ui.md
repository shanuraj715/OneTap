# T114 — Book a table page: open to everyone, a date picker, from/to time pickers, a searchable event list with Other, the WhatsApp number, the price — and sign-in only AFTER the form is filled

**Area:** bookings · **Last result:** ✅ PASSED (65 passed, 0 failed · 2026-11-27 16:58 · headless · 18.4 s)

**Run it alone:** `node run.mjs --only t114` (add `--visible` to watch it)

## What this test does

Chrome against the bench storefront (Acme Momos, /main) with bookings at ₹400 per person per hour, 19 of 20 seats taken tomorrow 8 PM–9:30 PM. Signed out: a notice says every request is approved by hand and the update comes on WhatsApp; there is NO sign-in card or prompt up front (a quiet line says it comes as the last step and nothing typed is lost); day, time pickers, event and WhatsApp are all there; 'To' waits for a start; the box says what it waits for; the button reads 'Continue' and, pressed on an empty form, lists what is missing without asking for a sign-in. The day is a date picker (the popover input; the calendar is the filled one): days before today and beyond the 7 days ahead can't be chosen, choosing tomorrow and OK sets it. The time: start times run 11:00 AM to 10:00 PM every 30 minutes with the full ones greyed out and not choosable; choosing 6 PM opens 'To' at the usual stay (7:30 PM · 1 hr 30 min); finish times run 1 to 4 hours later, the one that would run into the 8 PM booking is greyed out; the box shows total time and the price worked out (2 × ₹400 × 1½ h = ₹1,200: ₹600 now, ₹600 there), later finish → ₹1,600, 3 guests → ₹2,400, back to 2 keeps the times. The occasion: a searchable list (cursor in the search box, 'birth' → Birthday, no match says so, 'anni' + Enter chooses Anniversary), 'Other' last: a box for the event's name, empty is refused. WhatsApp: a short number is refused, dashes accepted. Then, with the form complete, pressing Continue shows the sign-in card ('One last step — sign in') with every answer still in place; signing in leaves the WhatsApp number typed earlier. A notice says 50% of the booking amount is paid online and the food and drinks are extra (booking amount plus what you eat and drink). A 'Have a coupon?' box lists the restaurant's table-booking offer as a chip (a food-only coupon is not listed); a food-only coupon and an unknown code are refused with a clear message and the price stays; the offer applies (−₹200: ₹1,400, ₹700 now, ₹700 + food and drinks there), is worked out again for 3 guests, and can be removed (full price back) and applied again. The button becomes 'Pay ₹700 & request booking'; paying (test gateway) shows 'Booking request received' with the range, 'Coupon … saved you ₹200', ₹700 paid, ₹700 at the restaurant, the event and the WhatsApp number; the restaurant sees it paid and waiting with the coupon; the account page lists it with its range, length, event and money. On a phone nothing scrolls sideways and the time list, calendar and event list fit the screen.

## Steps

1. A. The form is open to everyone — nothing asks for a sign-in first
2. B. The day: a date picker (popover input, filled calendar)
3. C. The time: from — to, the stay and the price
4. C2. A coupon for the booking
5. D. The occasion: a searchable list, and 'Other'
6. E. The WhatsApp number — and only then, the sign-in
7. F. Pay the advance (the test gateway) and the confirmation page
8. G. On a phone

## What to expect (these must happen)

- The whole form can be filled in without signing in; the sign-in step appears only when the form is complete, with every answer kept.
- The date, the from/to times, the total time and the estimated price are worked out as the guest chooses.
- The event is chosen from a searchable list, with 'Other' opening a box for the name.
- A booking coupon takes money off and the 50% advance follows the lower amount; the notice says food and drinks are extra.
- The 50% advance is paid and the restaurant sees the booking paid and waiting for approval.

## What must NOT happen

- No sign-in prompt before the form is filled in.
- A time the table can't take must NOT be choosable.
- A food-only coupon must NOT work on a booking.
- No sideways scrolling on a phone.
- No errors in the browser.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (65)

**Step 1 — A. The form is open to everyone — nothing asks for a sign-in first**

- a notice at the top says every request is approved by hand and the update comes on WhatsApp
- a notice says 50% of the booking amount is paid online, the rest at the restaurant, and food and drinks are extra (booking amount + what you eat and drink)
- NO sign-in card or prompt is shown up front (the guest isn't sent away before they've seen what they're booking)
- …only a quiet line says the sign-in comes as the last step and nothing typed is lost
- the day, the time pickers, the event and the WhatsApp number are all there to fill in
- the 'To' time waits until a start time is chosen
- the booking box says what it is waiting for
- the last button reads 'Continue' (not 'Sign in')
- pressing it with the form empty points out what is missing (start time, event, WhatsApp number)
- …and still doesn't ask for a sign-in: the form isn't complete

**Step 2 — B. The day: a date picker (popover input, filled calendar)**

- the box shows today's date to begin with — _Fri, 27 Nov, 2026_
- pressing the box opens the calendar
- days before today are greyed out (can't be chosen)
- the chosen day is a solid filled circle (the 'filled' calendar), not just a ring — _rgb(198, 54, 47)_
- choosing tomorrow and pressing OK sets the day and closes the calendar — _2026-11-28_
- a day beyond how far ahead the restaurant takes bookings (7 days) can't be chosen

**Step 3 — C. The time: from — to, the stay and the price**

- the start times run from opening to the last booking (11:00 AM … 10:00 PM, every 30 minutes) — _23: 11:00 AM … 10:00 PM_
- times the table can't take 2 more are shown but greyed out (8 PM is full: 19 of 20 seats are taken then) — _8:00 true, 7:00 false_
- a greyed-out time can't be chosen
- 6:00 PM is chosen and the 'To' time opens up
- the finish time starts at the usual stay: 7:30 PM · 1 hr 30 min — _7:30 PM · 1 hr 30 min_
- the box shows the total time: 1 hr 30 min — _1 hr 30 min_
- 2 guests × ₹400 an hour × 1½ hours = ₹1,200: pay ₹600 now and ₹600 at the restaurant
- the box shows how the price was worked out
- the finish times run from 1 hour to 4 hours after the start, each with its length
- a finish time that would run into the 8 PM booking is greyed out (8:30 PM), one that stops just before it is not (8:00 PM)
- a later finish (8:00 PM): total 2 hrs, ₹1,600, ₹800 now
- 3 guests: ₹2,400, ₹1,200 now — the price follows the party
- back to 2 guests: ₹1,600 again, and the times chosen are kept

**Step 4 — C2. A coupon for the booking**

- a 'Have a coupon?' box is on the page
- the restaurant's table-booking offer is listed as a chip, the food-only coupon is not — _TBL875237_
- a food-only coupon is refused with a clear message and the price stays ₹1,600 — _This coupon can't be used on a table booking._
- an unknown code is refused with a message too — _That coupon code isn't recognised._
- pressing the offer applies it: 'you save ₹200' — _TBL875237 — you save ₹200_
- the box shows ₹1,600, the coupon − ₹200, and the booking amount after it: ₹1,400
- the 50% advance follows the lower amount: ₹700 now, ₹700 + food & drinks at the restaurant — _₹700 / ₹700 + your food & drinks_
- 3 guests: the coupon is worked out again (₹2,400 − ₹200 = ₹2,200, ₹1,100 now)
- removing the coupon gives the full price back (₹1,600, ₹800 now)
- the coupon is applied again and kept for the booking (₹700 now)

**Step 5 — D. The occasion: a searchable list, and 'Other'**

- opening the list puts the cursor in the search box
- the list has the usual occasions, with 'Other' as the last one — _16: …Casual dining (no special event), Other_
- typing 'birth' narrows it to Birthday
- a search with no match says so
- typing 'anni' and pressing Enter chooses Anniversary (keyboard works)
- no extra box while a listed event is chosen
- choosing 'Other' shows a box to type the event's name
- pressing Continue with that box empty asks for the name

**Step 6 — E. The WhatsApp number — and only then, the sign-in**

- a short WhatsApp number is refused ('10-digit') and still no sign-in is asked for
- a number typed with dashes is accepted (only digits are kept) — _9876543210_
- NOW the sign-in step appears — 'One last step' — because the form is complete
- everything is still there while signing in: times, WhatsApp, the event name, the summary
- after signing in the button offers the advance after the coupon: 'Pay ₹700 & request booking' — _Pay ₹700 & request booking_
- the sign-in card is gone and the WhatsApp number typed earlier is kept (not replaced by the sign-in number)

**Step 7 — F. Pay the advance (the test gateway) and the confirmation page**

- the page says the request was received, with the time range and the party
- …that ₹700 was paid and ₹700 is paid at the restaurant
- …and the coupon line: 'saved you ₹200' — _Coupon TBL875237 saved you ₹200._
- …the event, and that the update comes on WhatsApp at the number given
- the restaurant sees it: waiting for approval, ₹700 paid after the ₹200 coupon, the WhatsApp number, 2 hours, the note
- the account page lists it: range, length, event, '₹700 paid in advance', waiting to be confirmed

**Step 8 — G. On a phone**

- the page doesn't scroll sideways on a phone
- the time list fits inside the phone screen — _{"x":31,"y":634.625,"width":300,"height":158.78125}_
- …and so does the calendar — _{"x":31,"y":221.546875,"width":320,"height":392.796875}_
- …and the event list
- still no sideways scroll with a list open
- no errors in the browser

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-27 16:58 | pass | 65 | 0 | headless | 18.4 s |
| 2026-11-27 12:09 | pass | 65 | 0 | headless | 17.4 s |
| 2026-11-27 12:08 | pass | 65 | 0 | headless | 17.4 s |
| 2026-11-27 12:07 | fail | 64 | 1 | headless | 17.5 s |
| 2026-11-27 12:05 | pass | 65 | 0 | headless | 18.1 s |
| 2026-11-27 10:50 | fail | 52 | 1 | headless | 9.0 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t114-booking-form-ui.mjs`), not this page._
