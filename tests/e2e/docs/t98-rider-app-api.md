# T98 — Rider app (RDA) API: a rider signs in with their phone number and a PIN the manager sets, sees only the deliveries handed to them, marks them picked up and delivered (with the customer's 4-digit code); a new delivery order needs a map pin and gets a code; nothing else of the store opens to a rider

**Area:** delivery · **Last result:** ✅ PASSED (105 passed, 0 failed · 2026-11-27 22:06 · headless · 7.5 s)

**Run it alone:** `node run.mjs --only t98` (add `--visible` to watch it)

## What this test does

Runs suites/rider-app-api.mjs on a private API with an in-memory database (no browser). The manager gives a rider an app login (PIN 4–6 digits, stored only as a salted hash; a rider with no phone number can't have one; only 'manage riders' may). Sign-in: wrong PIN and unknown number give the same 401 (with tries left), +91 and spaces are fine, the right PIN returns a signed token; 12 wrong PINs for one number from different addresses pause it. A rider's token opens ONLY /api/rider (the dashboard's orders, rider list and kitchen board say 401; a dashboard cookie, a forged, edited or expired token are refused). Deliveries: only the rider's own (not another's, not unassigned, not takeaway), with address, pin, landmark, distance, customer phone and items — never the delivery code. Pick up: Ready → Out for delivery (history says the rider did it; others' orders are 404). Delivered: needs the customer's 4 digits; 5 wrong tries lock it (even the right code) while the manager can still complete it; an older order with no code needs none; the customer sees the code only while out for delivery. A new delivery order from a pin gets a 4-digit code and a server-measured distance; no pin is 400, a pin outside the area is 409. Handing an order to a rider works without WhatsApp. A new PIN, switching the login off, switching the rider off, removing the rider, a switched-off store, a plan without Delivery and an old app build all end or refuse the sign-in.

## Steps

1. The manager gives a rider an app login
2. 1b. Show PIN — the manager can look the PIN up again
3. Signing in
4. A rider's token opens the rider routes and nothing else
5. The deliveries
6. Picked up
7. Delivered, with the customer's code
8. The customer can see the code for as long as the delivery is still to come
9. A new delivery order gets a code
10. Handing an order to a rider never fails because of WhatsApp
11. Taking the login away
12. Plan, store and app version
13. Guessing PINs

## What to expect (these must happen)

- A rider signs in with phone + PIN and sees only their own deliveries; they can mark an order picked up and, with the customer's code, delivered.
- A delivery order can't be placed without a map pin, and its distance is measured from that pin.
- Resetting a PIN, switching the login or the rider off, or removing the rider signs them out at once.

## What must NOT happen

- A rider's token must NOT open anything in the dashboard, the kitchen or another rider's deliveries.
- The delivery code must NOT be sent to the rider or shown in the dashboard's orders.
- A delivery code must NOT be guessable by trying every number.
- The PIN must NOT be stored or returned in clear.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (105)

**Step 1 — The manager gives a rider an app login**

- a new rider has no app login yet
- a rider with no phone number can't be given a login (the number IS the login name)
- a PIN of "123" is refused (4 to 6 digits)
- a PIN of "1234567" is refused (4 to 6 digits)
- a PIN of "12ab" is refused (4 to 6 digits)
- a PIN of "" is refused (4 to 6 digits)
- setting a PIN turns the login on, and the answer never carries the PIN or its hash
- only a salted hash is stored, and the login name is the last 10 digits of the phone
- the rider list never carries a hash
- a person without 'manage riders' can't set a PIN

**Step 2 — 1b. Show PIN — the manager can look the PIN up again**

- the manager who set a PIN can look it up again — _{"appLogin":true,"pin":"4821","reason":null}_
- the answer says 'no-store', so no browser or proxy keeps a copy
- it is stored locked with the server's key (an AES envelope), not as digits, and differently for each rider
- the rider list never carries the PIN or its locked copy
- neither does the rider's sign-in answer nor the answer to setting a PIN
- a rider with no app login has no PIN to show — _{"appLogin":false,"pin":null,"reason":"no_login"}_
- nobody signed in: refused (401)
- a person without 'manage riders' (the kitchen) can't look a PIN up (403)
- another store's owner (whose plan has Delivery) can't read it: 404, as if the rider didn't exist — _404 {"error":"Rider not found"}_
- a store whose plan has no Delivery is turned away (403)
- an id that isn't an id is a 404
- a PIN set before PINs could be shown says so, and shows nothing — _{"appLogin":true,"pin":null,"reason":"set_before"}_
- …and setting it again makes it show from then on
- a damaged stored copy is reported as unreadable, not as a crash or a wrong PIN

**Step 3 — Signing in**

- a wrong PIN: 401, with how many tries are left — _{"error":"Incorrect phone number or PIN","details":{"attemptsLeft":4}}_
- an unknown phone number gets the SAME answer (nobody can find out who is a rider)
- a short number or PIN is refused before anything is checked
- the right PIN signs in (the number may be typed with +91 and spaces), and says who and where
- the sign-in answer has no hash
- GET /me says who is signed in

**Step 4 — A rider's token opens the rider routes and nothing else**

- the dashboard's orders say 401 to a rider's token
- …and so does the rider list
- …and the kitchen board
- no token: 401
- a dashboard cookie (even the owner's) does not open the rider routes
- a token with its signature changed is refused
- a token edited to name another rider is refused
- an expired or re-signed-by-nobody token is refused

**Step 5 — The deliveries**

- a rider sees the deliveries handed to THEM (ready, being made, out) — not another rider's, not an unassigned one, not a takeaway — _4 rows_
- each delivery has the address, the pin, the landmark, the distance, who to call and what is in the bag
- the delivery code is NEVER sent to the rider (only that one is needed)
- an older order with no code needs none
- nothing else of the order or the store leaks (no ids of the store, no totals)
- the other rider sees only theirs

**Step 6 — Picked up**

- an order still being made can't be picked up (409, in words)
- someone else's delivery is 'not found' (a rider can't tell it exists)
- an unassigned order too
- a takeaway order too
- a bad id is a 404, not an error
- picking up a Ready order sends it Out for delivery
- the order's history says the rider did it
- picking up twice is harmless
- the dashboard's orders list never shows the delivery code

**Step 7 — Delivered, with the customer's code**

- no code: asked for it, in words
- a wrong code: 409 and how many tries are left (asking for the code without typing one did not use a try)
- …and the order is still out for delivery
- the right code completes the order
- the history says who delivered it and why
- marking it again is harmless
- it moves from 'to deliver' to 'delivered today'
- five wrong guesses are each refused
- after that even the RIGHT code is refused: a code can't be guessed (the store can still mark it delivered)
- …and the manager can still complete it from the dashboard
- an older order with no code is completed without one
- another rider can't complete my delivery
- an order that was never picked up can't be marked delivered

**Step 8 — The customer can see the code for as long as the delivery is still to come**

- an Out-for-delivery order shows the customer the 4 digits and the rider
- while it is still being made the customer can already see it (so they can remember it)
- after it is delivered, no code is shown
- a cancelled delivery shows no code
- a takeaway order never has one

**Step 9 — A new delivery order gets a code**

- a delivery order is placed (from a pin on the map)
- it has a 4-digit delivery code — _6035_
- the distance was measured by the server from the chosen pin to the outlet — _1_
- a delivery order with NO pin is refused (the location is mandatory) — _400_
- a pin outside the delivery area is refused — _409_
- a takeaway order has no code

**Step 10 — Handing an order to a rider never fails because of WhatsApp**

- with no WhatsApp number linked the hand-over still works (the message to the rider is just not sent)

**Step 11 — Taking the login away**

- (the rider is signed in)
- the manager sets a new PIN
- after a reset, Show PIN shows the NEW PIN
- every earlier sign-in ends at once
- the old PIN stops working, the new one works
- a rider switched off in the list is refused, in words
- …and can't sign in either
- switched back on, the same sign-in works again
- the manager switches the app login off
- switching the login off also deletes the locked copy: nothing is left to show — _{"appLogin":false,"pin":null,"reason":"no_login"}_
- the rider is signed out everywhere and can't sign in
- turning it on again does not revive an old sign-in
- changing the rider's phone number changes the number they sign in with
- …and it can't be a number another rider signs in with
- …nor one too short to sign in with
- a rider removed from the list is signed out

**Step 12 — Plan, store and app version**

- a store whose plan has no Delivery can't even list riders (so none can get a login)
- a rider of such a store is refused at sign-in, in words — _{"error":"Delivery isn't included in your plan."}_
- a store the platform switched off turns its riders away too — _200 / 403 This store is disabled. Please contact Rasoi Pulse to turn it back on._
- …and they can't sign in either
- switched back on, the same sign-in works again
- an old build of the rider app is turned away (426) while an update is required, before any PIN is checked — _426_
- the current build signs in
- the update check knows the rider app
- …and OMA's releases are separate

**Step 13 — Guessing PINs**

- many wrong PINs for one phone number — even from different addresses — pause that login — _401,401,401,401,401,401,401,401,401,429,429,429_
- …and then even the right PIN waits

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-27 22:06 | pass | 105 | 0 | headless | 7.5 s |
| 2026-11-27 17:01 | pass | 105 | 0 | headless | 7.8 s |
| 2026-11-27 16:16 | pass | 105 | 0 | headless | 6.5 s |
| 2026-11-27 11:07 | pass | 105 | 0 | headless | 7.2 s |
| 2026-11-27 09:59 | pass | 105 | 0 | headless | 5.9 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t98-rider-app-api.mjs`), not this page._
