# T113 — Table bookings: a start and an end time, a price, a 50% advance paid online, refunds and the WhatsApp number — the rules and the API

**Area:** bookings · **Last result:** ✅ PASSED (94 passed, 0 failed · 2026-11-27 16:57 · headless · 8.2 s)

**Run it alone:** `node run.mjs --only t113` (add `--visible` to watch it)

## What this test does

Runs suites/booking-advance-api.mjs against a private API on an in-memory database with a fake SMS gateway (the guest's updates go to the WhatsApp number — here the SMS fallback, so they can be read). The rules: a booking has a start and a finish chosen by the guest (1 hour to 4 hours by default, in 30-minute steps); the price is the outlet's rate per person per hour × guests × hours, to the whole rupee, and the guest pays HALF online and half at the restaurant (the halves always add up; an outlet with no price charges nothing); a WhatsApp number is understood however it is typed; two bookings that follow each other never count as double (peak guests at one moment). What the booking page is told: the price, the 50%, whether an advance can be taken online, the finish times for a chosen start with each one's price and whether the table is free that long. Booking rules in words: signed in only; a finish before the start, a stay shorter than the shortest or longer than the longest, a finish off the step, a finish after closing, a bad WhatsApp number and a too-long event name are all refused and leave nothing behind. A booking that costs money is created waiting for its advance: the team does not see it, the 'to confirm' badge doesn't count it, nobody is messaged — but its seats are held for 15 minutes, after which they are free again, it disappears from the guest's account, paying says it has expired and the sweep cancels it (and never shows it to the team as a cancelled booking). Paying through the test gateway: only the guest's own booking, the gateway is asked for the advance (not the whole amount), another guest can't pay or confirm it and is checked BEFORE anything is settled, a wrong signature is refused; once paid it goes to the team (still 'requested': a person approves it), the guest is told on the WhatsApp number they gave (not the sign-in number) that it was received, what for and that the advance is paid; confirming twice changes nothing. The team's decision: declining or cancelling a paid booking marks the advance as due for a refund and tells the guest; 'mark refunded' closes it (not twice, not when none is due); a no-show keeps the advance; confirming says what was paid and what is left. A guest cancelling a paid booking puts the advance on the refund list; an unpaid one is just dropped. No WhatsApp number given → the update goes to the sign-in number. No price → no payment, the usual 90 minutes. A price but only cash on → no advance, the whole amount at the restaurant. An outlet that confirms by itself confirms only after payment. An advance that arrives after the hold ran out is not lost: the booking stays cancelled and the money is marked for a refund. Orders' payment rules are untouched.

## Steps

1. The rules (the shared package)
2. A store, its settings, three guests
3. What the booking page is told
4. Booking: the rules a guest meets
5. A booking that costs money waits for its advance
6. 5b. Its seats are held — for a few minutes
7. Paying the advance (the test gateway)
8. The restaurant decides — and refunds
9. 7b. A guest cancels
10. 7c. Confirming, and a no-show keeps the advance
11. A guest signed in with one number, updates on another; the usual length; no charge
12. 8b. A price but no way to pay online: nothing is taken in advance
13. The outlet confirms by itself
14. An advance that arrives after the booking was let go
15. Orders are untouched

## What to expect (these must happen)

- A booking has a start and an end; its price and the 50% advance follow from the stay and the party.
- An unpaid booking is invisible to the team, holds its seats for 15 minutes, then is let go.
- The advance goes through the payment gateway, only for the guest's own booking, and the guest is updated on the WhatsApp number they gave.
- A declined or cancelled paid booking puts the advance on a refund list; a no-show keeps it.

## What must NOT happen

- A refused request must NOT leave a booking behind.
- Another guest must NOT be able to pay or confirm someone else's booking.
- A booking that was never paid must NOT reach the team, even as 'cancelled'.
- Money that arrives late must NOT be lost.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (94)

**Step 1 — The rules (the shared package)**

- the new settings and their starting values: stay 1 hr to 4 hrs, usual 90 min, price set by the outlet
- a booking costs nothing until the outlet sets a price (so no outlet is suddenly charging)
- durations: shortest 60, longest 240, usual 90, in 30-minute steps
- odd settings are rounded to whole steps (45 → 60, 200 → 180, 100 → 120 with 60-minute steps) — _{"step":60,"min":60,"max":180,"usual":120}_
- 4 guests for 2½ hours at ₹500 each an hour = ₹5,000: ₹2,500 now, ₹2,500 at the restaurant
- the amount and its halves are whole rupees and always add up (₹2,250 → ₹1,125 + ₹1,125)
- an odd amount (₹333) still splits into two whole-rupee parts
- rate 0: nothing to pay
- the advance is 50%
- a WhatsApp number: any way of writing a 10-digit Indian mobile is understood; short, long or not-a-mobile ones are refused
- durations are said in words (45 min, 1 hr, 2 hrs 30 min)
- a booking's time is said as a range (7:00 PM – 9:30 PM) — _7:00 PM – 9:30 PM tomorrow_
- the event list has the usual occasions; 'Other' is separate (the page adds it at the end)
- two bookings of 6 that follow each other are never more than 6 at once (the old way counted 12)
- …but one that overlaps them both makes 9
- from 9:30 PM the finish times stop at closing (10:30 PM, 11:00 PM… never later) — _10:30 PM,11:00 PM_
- each finish time carries its price (1 hour for 2 guests at ₹500 each = ₹1,000: ₹500 now, ₹500 there)

**Step 2 — A store, its settings, three guests**

- the outlet takes bookings: ₹500 per person per hour, 1 to 4 hour stays, 10 seats, the test gateway on — _200_
- the new settings are saved

**Step 3 — What the booking page is told**

- the price, 50%, and that an advance can be paid online (the test gateway) come with the times — _{"ratePaise":50000,"prepayPercent":50,"prepayAvailable":true,"gateway":"mock"}_
- …and how long a stay can be
- with no start chosen there are start times and no finish times
- choosing 7 PM gives the finish times 8:00 PM … 11:00 PM (1 to 4 hours) — _8:00 PM,8:30 PM,9:00 PM,9:30 PM,10:00 PM,10:30 PM,11:00 PM_
- 7 to 9 PM for 2 guests: ₹2,000, pay ₹1,000 now and ₹1,000 there
- for 4 guests the same stay is ₹4,000 (the price follows the party)
- a start the restaurant doesn't offer (10:30 PM is after the last start) has no finish times — _0_
- the last start (10 PM) has one finish time: closing, 11 PM
- a start that isn't a time is ignored, not an error

**Step 4 — Booking: the rules a guest meets**

- booking needs the guest to be signed in — _401_
- a finish time before the start is refused, in words
- 30 minutes is shorter than the shortest stay: 'at least 1 hr'
- 4½ hours is longer than the longest stay: 'at most 4 hrs'
- a finish time that is not on the half hour is refused
- a booking that runs past closing is refused: 'after closing'
- a WhatsApp number that isn't 10 digits is refused: 'Enter a 10-digit WhatsApp number' — _{"error":"Enter a 10-digit WhatsApp number — we'll send the update there."}_
- an event name longer than 60 characters is refused
- a party over the online limit is refused — _409_
- none of the refused requests left a booking behind

**Step 5 — A booking that costs money waits for its advance**

- Asha books 7 to 9 PM for 2: it is created and waits for the advance — _201 requested/pending_
- ₹2,000 for 2 hours: ₹1,000 now, ₹1,000 at the restaurant
- the occasion is kept
- the WhatsApp number is stored cleaned up (9876543210), apart from the number she signed in with
- the team doesn't see it yet, and the 'to confirm' badge doesn't count it
- and nobody is messaged yet
- Asha sees it on her account with a 'pay now' (canPay)

**Step 6 — 5b. Its seats are held — for a few minutes**

- while the advance is awaited, its 2 seats count: only 2 of 4 are left at 7 PM — _{"at":"2026-11-28T13:30:00.000Z","label":"7:00 PM","available":false,"seatsLeft":2}_
- after 15 minutes without payment the hold is over: the seats are free again
- …and it no longer shows on her account
- paying for it now says it has expired ('please book again') — _{"error":"This booking request has expired — please book again."}_
- the sweep lets go of it (cancelled, 'expired': 'The advance wasn't paid in time') — _1 cancelled/expired_
- …and running the sweep again does nothing more

**Step 7 — Paying the advance (the test gateway)**

- starting the payment needs a signed-in guest — _401_
- another guest can't pay for Asha's booking (403) — _403_
- an intent for an order AND a booking at once is refused (400)
- …and one for neither is refused too
- her own: the gateway is asked for ₹1,000 — the advance, not the whole amount — _200 100000_
- the payment record says it is for a booking: ₹1,000, pending
- another guest can't confirm it either — and it is NOT settled by the attempt (the owner is checked before anything is verified) — _403_
- a payment with a wrong signature is refused and the booking stays unpaid
- her real payment is accepted — _200 {"status":"paid","orderId":"6b096938bacd7443e3cef88b","subject":"reservation"}_
- the booking is now paid and waits for the restaurant (still 'requested': a person approves it)
- now the team sees it: ₹1,000 paid, the event and the WhatsApp number
- the 'to confirm' badge counts it
- Asha is told on the WHATSAPP number she gave (…43210), not the one she signed in with — _9876543210_
- the message says it was received, what for, that ₹1,000 is paid and that the restaurant will confirm on WhatsApp
- confirming it a second time changes nothing and sends no second message
- on her account: paid, nothing more to pay online, ₹1,000 left for the restaurant

**Step 8 — The restaurant decides — and refunds**

- 'refunded' is refused while no refund is due — _409_
- declining a paid booking marks its advance as DUE for a refund
- the guest is told, on WhatsApp, that the advance will be refunded
- once the money is sent back, 'mark refunded' closes it
- the booking's history shows the payment and the refund
- …and it can't be marked twice

**Step 9 — 7b. A guest cancels**

- cancelling a booking whose advance was never paid just drops it (nothing to refund)
- …and neither it nor the one that expired ever shows up to the team as a cancelled booking
- cancelling a PAID booking puts the advance on the refund list
- the team sees the refund that is due

**Step 10 — 7c. Confirming, and a no-show keeps the advance**

- the team confirms Meera's paid booking
- the message says it is confirmed, that ₹1,000 was paid, ₹1,000 is payable at the restaurant — and that food and drinks are paid for separately
- a no-show keeps the advance (nothing to refund)

**Step 11 — A guest signed in with one number, updates on another; the usual length; no charge**

- with no price, a booking without a finish time takes the usual 90 minutes and needs no payment — _201 90_
- …and goes straight to the team
- no WhatsApp number given: only the sign-in number is on it
- …so the update goes to the number she signed in with — _9811700001_
- a free booking with a finish time works too (90 minutes)

**Step 12 — 8b. A price but no way to pay online: nothing is taken in advance**

- with only cash on, the page is told no advance can be taken
- the booking is taken without an advance: the whole ₹2,000 is paid at the restaurant
- and it goes straight to the team

**Step 13 — The outlet confirms by itself**

- it waits for the advance first (not confirmed before it is paid)
- paid → confirmed straight away
- …and the confirmation goes to the guest

**Step 14 — An advance that arrives after the booking was let go**

- money that arrives after the hold ran out is not lost: the booking stays cancelled and the advance is marked due for a refund — _200 cancelled/refund_due_
- and it is not put in front of the team as a live request

**Step 15 — Orders are untouched**

- an intent for an order that isn't hers still goes through the order rules — _403_

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-27 16:57 | pass | 94 | 0 | headless | 8.2 s |
| 2026-11-27 12:06 | pass | 94 | 0 | headless | 6.9 s |
| 2026-11-27 10:50 | pass | 93 | 0 | headless | 6.1 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t113-booking-advance-api.mjs`), not this page._
