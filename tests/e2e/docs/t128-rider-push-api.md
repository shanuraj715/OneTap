# T128 — Rider push notifications: a phone registers its Firebase token; a NEW hand-over pushes 'New delivery #…' (where, how far, how much) to that rider's phones only; dead tokens are forgotten; no key set up = nothing breaks

**Area:** riders · **Last result:** ✅ PASSED (38 passed, 0 failed · 2026-11-27 22:05 · headless · 10.3 s)

**Run it alone:** `node run.mjs --only t128` (add `--visible` to watch it)

## What this test does

API checks on an in-memory database, with a local stand-in for Google's token server and FCM (it verifies the service-account JWT's signature and claims). A rider's phone registers its device token (PUT /api/rider/push-token; 401 without sign-in, 400 for a nonsense token, one phone = one rider, five newest kept, DELETE on sign-out, never shown in the manager's rider list). Handing a delivery to a rider sends 'New delivery #0001' with the address, distance, total and customer, data (type, orderId, orderNumber — all text) for a tap to open it, high priority on the 'deliveries' channel with a time limit, and no delivery code. Only a NEW hand-over pushes: the same rider saved again, a rider typed in by name, taking the rider off and the rider marking it picked up themselves send nothing; moving it to another rider pushes the new one only. One access token is reused for many messages; a 401 from Google gets one fresh token and one more try. A phone Google says is UNREGISTERED is removed from the rider; a 500 is not. With no key set up (or a broken one) the hand-over works and nothing is sent.

## Steps

1. The phone asks for notifications
2. A delivery is handed to a rider → a push, with the app closed
3. Only when it is a NEW hand-over
4. The access token is kept, and renewed once if Google says it ran out
5. A phone Google says is gone is forgotten; a hiccup is not
6. No Firebase key set up: nothing breaks

## What to expect (these must happen)

- A new hand-over sends a signed, well-formed notification to the new rider's phones and nobody else's.
- Dead device tokens are removed; temporary failures are not.
- Push being off or broken never breaks a hand-over.

## What must NOT happen

- The same rider saved again, or the rider's own pickup, must NOT push.
- A device token must NOT appear in the manager's rider list.
- The delivery code must NOT be in a notification.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (38)

**Step 1 — The phone asks for notifications**

- no sign-in → refused (401)
- a token that can't be one is refused (400)
- no token is refused (400)
- a rider registers a phone (204)
- the same phone again is kept once
- a rider keeps their five newest phones — _03,04,05,06,07_
- a phone signed in as someone else moves to them (one phone, one rider)
- signing out takes the phone off
- the manager's rider list never carries a device token

**Step 2 — A delivery is handed to a rider → a push, with the app closed**

- the hand-over itself works — _HTTP 200_
- Google is asked to send a notification
- …to Ramesh's phone only, through the right Firebase project
- title: 'New delivery #0001' — _New delivery #0001_
- body: where it goes, how far, what it is worth, who for — _B-14, Sector 18, Noida · 1.3 km · ₹260 · Neha Gupta_
- data (all text): what happened, which order — so a tap can open it — _{"type":"delivery.assigned","orderId":"6b09b1561bc97536a96b7323","orderNumber":"0001"}_
- high priority (wakes a sleeping phone), on the 'deliveries' channel, with a time limit
- sent with the access token Google gave
- the sign-in request to Google was signed with the service account's key, with the right claims
- no delivery code in the notification

**Step 3 — Only when it is a NEW hand-over**

- saving the same rider again sends nothing
- a rider typed in by name (no phone app) gets no push
- moving it to another rider pushes the NEW rider
- …to Suresh's phone, not Ramesh's
- taking the rider off sends nothing
- the rider marks it picked up — _HTTP 200_
- …which does not push the rider about their own delivery

**Step 4 — The access token is kept, and renewed once if Google says it ran out**

- many messages, one sign-in to Google (the access token is reused) — _1 vs 1_
- a 401 from Google → a fresh access token and one more try → delivered
- …exactly one new sign-in to Google

**Step 5 — A phone Google says is gone is forgotten; a hiccup is not**

- the good phone still got its notification
- the dead one was tried
- …and the dead phone was removed from the rider — _10_
- a failure on Google's side does NOT remove the phone, and the hand-over still works

**Step 6 — No Firebase key set up: nothing breaks**

- push reports itself off
- the hand-over works and nothing is sent
- a phone can still register (it will be used once push is set up)
- a broken key file is 'off' too (and logged), not a crash
- …and a good one switches it on again

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-27 22:05 | pass | 38 | 0 | headless | 10.3 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t128-rider-push-api.mjs`), not this page._
