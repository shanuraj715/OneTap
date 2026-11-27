# T115 — Dashboard bookings: every upcoming booking in one list (the date is only a filter, chosen with our date picker), a status changed by hand, the approve / decline / cancel message window, refunds, and a coupon type with our date and time pickers

**Area:** bookings · **Last result:** ✅ PASSED (61 passed, 0 failed · 2026-11-27 16:58 · headless · 12.1 s)

**Run it alone:** `node run.mjs --only t115` (add `--visible` to watch it)

## What this test does

Chrome against the bench dashboard (Acme Momos, Main, as the owner). Settings → Pre-orders & bookings has Usual / Shortest / Longest stay, the booking price per person per hour (starts at 0) and the WhatsApp Business template for booking updates; saving stores ₹400 as 40000 paise. The Bookings page opens on 'Upcoming': five bookings made over the next 6 days are all listed, soonest first, under one heading per day ('Tomorrow · …' first), with the counts the server gives — nobody has to change the date. There is no browser date or time box anywhere on the page. The date is only a filter, chosen on our date picker: it shows that day alone with a note and a 'Show all upcoming' button, a day with nothing says so, 'Earlier' and 'All' have their own lists. 'New booking' picks its day on the date picker too, and the new booking appears in the list. A no-show marked by mistake isn't stuck: after No-show only a 'Status' button is left, its menu offers every other status, Confirmed opens the Approve window, the history says 'Changed by hand from no-show', and a jump that skips a step (Confirmed → Completed) says it is a manual change. Approving a paid booking opens a window: no reason needed, how it will be sent ('Sent automatically through your linked WhatsApp number to +91 …' — the number the guest gave), the message already written (confirmed, ₹800 paid in advance, the remaining ₹800 at the restaurant, food and drinks paid for separately), editable; the guest's WhatsApp message goes out exactly as the team wrote it. Declining asks for a reason, says the ₹800 advance will be marked refund due, the message follows the reason and mentions the refund; un-ticking 'Tell … on WhatsApp' disables the message, changes the button to 'Decline without a message' and sends nothing; the row shows 'Refund ₹800 due' and 'Mark refunded' closes it ('Advance refunded'). Cancelling opens its own window and 'Back' changes nothing. Each booking shows its start, end and length, the occasion, the WhatsApp number and the money (₹1,600, ₹800 paid in advance, ₹800 at the restaurant); a booking made with a coupon shows '₹1,500 after the code (−₹100)'. Coupons: the form has no browser date box; 'Order types' has a 'Table booking' tick; 'From' and 'Until' are our date picker plus our time picker (Until starts at 11:59 PM, each side has Clear); the saved coupon is for table bookings with the chosen days. The component catalogue lists the Time Pickers (TP01, TP02), the searchable dropdown (DRP08) and the date pickers (DP02, DP03). Bookings left in the bench by other tests are ignored; what it changes is put back.

## Steps

1. Settings: the stay, the price, the WhatsApp Business template
2. Bookings: every upcoming booking, soonest first — no date to change
3. The date is only a filter, chosen with our date picker
4. A booking taken over the phone: the day is chosen with our date picker too
5. Changing the status by hand: a mistaken No-show is not stuck
6. Approving: tell the guest, in words that can be edited, sent automatically
7. Declining: a reason, the refund, and no message if you don't want one
8. Cancelling
9. A booking made with a coupon shows what it saved
10. Coupons: a Table booking type, and our date and time pickers
11. The component catalogue lists the new pickers

## What to expect (these must happen)

- The Bookings page opens on every upcoming booking, soonest first, grouped by day — no date has to be chosen.
- The date is only a filter, chosen on our date picker (never a browser date box); 'Show all upcoming' undoes it.
- A booking marked No-show can be changed to any other status with the 'Status' button.
- Approving, declining and cancelling open a window with a reason (decline / cancel), the message already written and editable, and the automatic way it will be sent; 'Tell … on WhatsApp' can be switched off.
- A booking shows its end, length, event, WhatsApp number, coupon and what was paid; declining a paid booking shows a refund due and 'Mark refunded' closes it.
- A coupon can be made for table bookings, with its start and end chosen on our date and time pickers.

## What must NOT happen

- No browser date, time or date-time box on the Bookings page, the New booking window or the coupon form.
- No message is sent when 'Tell … on WhatsApp' is un-ticked.
- A booking whose advance isn't due back must NOT get a refund button.
- No errors in the browser.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (61)

**Step 1 — Settings: the stay, the price, the WhatsApp Business template**

- the booking settings have Usual stay, Shortest stay and Longest stay
- …and 'Booking price per person per hour (₹)'
- …and the WhatsApp Business template for booking updates
- the price starts at 0 (no charge, so nothing is paid in advance)
- saved: ₹400 per person per hour (40000 paise), stays of 1 to 3 hours, the template name — _{"p":40000,"t":{"name":"booking_update","languageCode":"en"}}_

**Step 2 — Bookings: every upcoming booking, soonest first — no date to change**

- the page opens on 'Upcoming' — no date to pick first
- the five new bookings are all listed, soonest first (tomorrow 1 PM, tomorrow 7 PM, in 2 days, in 3 days, in 6 days) — _B-0005,B-0006,B-0007,B-0004,B-0003_
- they are grouped under one heading per day, the days in order — _2026-11-28,2026-11-29,2026-11-30,2026-12-03_
- …the nearest says 'Tomorrow' — _TOMORROW · SAT 28 NOV \| SUN 29 NOV \| MON 30 NOV_
- the counts cover the whole list, as the server counts it
- there is NO browser date or time box on the page — only our own date picker

**Step 3 — The date is only a filter, chosen with our date picker**

- the box reads 'Filter by date'
- choosing a day shows just that day's bookings — _B-0004_
- …and a note says it is filtered
- …with a 'Show all upcoming' button
- it goes back to the full list
- a day with nothing booked says so
- 'Earlier' has its own list — none of tomorrow's bookings are in it
- 'All' shows everything

**Step 4 — A booking taken over the phone: the day is chosen with our date picker too**

- the New booking window has no browser date box either
- the day is set from the calendar
- the booking is made (confirmed) and shows in the list, without looking its date up

**Step 5 — Changing the status by hand: a mistaken No-show is not stuck**

- Soon Sam is marked No-show
- after that the usual buttons are gone — but there is a 'Status' button
- its menu offers every other status (all but No-show) — _Waiting to be confirmed \| Confirmed \| Seated \| Completed \| Declined \| Cancelled_
- choosing Confirmed opens the 'Approve this booking' window (the guest may be told)
- the booking is back to Confirmed — nothing is stuck
- its history says it was changed by hand — _\|  \| Changed by hand from no-show_
- a change that skips a step says it is a manual change
- …and it is done (Completed, straight from Confirmed)

**Step 6 — Approving: tell the guest, in words that can be edited, sent automatically**

- a booking shows its start, end, length, occasion and the WhatsApp number
- …and the money: ₹1,600, ₹800 paid in advance, ₹800 at the restaurant
- the window says how it will go — _linked: Sent automatically through your linked WhatsApp number to +91 9876512345._
- …automatically, and to the WhatsApp number the guest gave
- the message is already written: confirmed, ₹800 paid, ₹800 at the restaurant, food and drinks paid for separately
- approving needs no reason
- 'Tell … on WhatsApp' is ticked
- Approve & send message: the booking is confirmed
- …and the guest's WhatsApp message went out as the team wrote it, to the number they gave

**Step 7 — Declining: a reason, the refund, and no message if you don't want one**

- the decline window asks for a reason
- …and says the paid advance (₹800) will be marked for a refund
- the message follows the reason and mentions the refund of the advance
- un-ticking 'Tell …' switches the message off and the button reads 'Decline without a message'
- declined, and its advance is due for a refund
- no message was sent
- the Bookings page shows 'Refund ₹800 due' and a 'Mark refunded' button
- 'Mark refunded' closes it ('Advance refunded')

**Step 8 — Cancelling**

- cancelling opens its own window
- 'Back' changes nothing

**Step 9 — A booking made with a coupon shows what it saved**

- the row shows the amount after the coupon (₹1,500 after the code, −₹100) and the advance (₹750 paid, ₹750 at the restaurant)

**Step 10 — Coupons: a Table booking type, and our date and time pickers**

- the coupon form has no browser date, time or date-time box
- 'Order types' has a 'Table booking' tick
- 'From' is chosen on our calendar and its time box opens
- 'Until' starts at the end of the day (11:59 PM) — _11:59 PM_
- each side has a Clear button
- the coupon is saved for table bookings with its start and end from the pickers — _{"ch":["booking"],"f":"2026-11-28T03:30:00.000Z","u":"2026-12-02T18:29:00.000Z"}_
- …the days are the ones chosen on the calendars — _2026-11-28T03:30:00.000Z → 2026-12-02T18:29:00.000Z_

**Step 11 — The component catalogue lists the new pickers**

- 'Time Pickers' (TP01 popover input, TP02 inline list) is in the catalogue
- …and the searchable dropdown (DRP08)
- …beside the date pickers (DP02 filled, DP03 popover input) the booking page uses
- no errors in the browser

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-27 16:58 | pass | 61 | 0 | headless | 12.1 s |
| 2026-11-27 12:07 | pass | 61 | 0 | headless | 11.3 s |
| 2026-11-27 12:07 | pass | 61 | 0 | headless | 11.4 s |
| 2026-11-27 12:06 | fail | 60 | 1 | headless | 11.6 s |
| 2026-11-27 12:03 | pass | 60 | 0 | headless | 11.8 s |
| 2026-11-27 10:50 | pass | 19 | 0 | headless | 7.2 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t115-booking-dashboard-ui.mjs`), not this page._
