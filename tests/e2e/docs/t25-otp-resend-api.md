# T25 — Code resend rule — the API makes a number wait 30 s, 1 min, 2 min, 5 min, 15 min, 1 h, then 6 h between codes, however it is called

**Area:** security · **Last result:** ✅ PASSED (43 passed, 0 failed · 2026-11-19 11:20 · headless · 4.3 s)

**Run it alone:** `node run.mjs --only t25` (add `--visible` to watch it)

## What this test does

Runs suites/otp-resend.mjs: its own in-memory API with the per-address limiter switched off, so only the resend rule is tested. Walks one number through nine codes and checks the wait after each (30 s, 1 min, 2 min, 5 min, 15 min, 1 h, 6 h, 6 h, 6 h) by pretending time has passed; asks early (even 2 seconds early) and gets 429 with 'Please wait …', the seconds left and a Retry-After header; fires 15 requests at the same moment (twice) and 100 in a row and checks exactly one code goes out; writes the same phone number as +91…, 0091…, with spaces, dashes or a leading 0 and checks it is still one number; checks other numbers, email addresses and the staff coin-code flow each have their own clock; checks the sign-in screen is told whether the code already sent is still good; signing in wipes the waits; a day of silence wipes them too; and a code the gateway could not send is not counted, leaves no unsent code behind and never replaces the code the customer already has.

## Steps

1. the schedule — every code makes the next wait longer
2. hitting the API directly — many requests at once
3. each number has its own clock
4. the screen is told what to do
5. signing in starts the number over
6. a code that could not be sent doesn't count

## What to expect (these must happen)

- Each code made the next wait longer: 30 s, 1 min, 2 min, 5 min, 15 min, 1 hour, then 6 hours for the 7th code and every one after.
- Asking too early gets 429 with 'Please wait N … before asking for another code.', the seconds left in the answer and in a Retry-After header — and no new code is created.
- Fifteen requests at the same instant (and a hundred one after another) send exactly one code.
- +91 / 0091 / spaces / dashes / a leading 0 are all the same number.
- A different number, an email address, and the staff coin-code flow each have their own clock.
- A refused request says whether the code already sent is still valid ('liveCode') so the screen can take the customer straight to typing it.
- Signing in with a code, or a day without a request, starts the number over at 30 seconds.
- A code the gateway couldn't send doesn't count: no unsent code stays, the number may try again after 30 seconds, and the next success is the first code; a failed resend leaves the earlier code working.

## What must NOT happen

- A number must NOT get a second code before its wait is over — however the request is sent or spelled.
- Parallel requests must NOT each send a code.
- A failed send must NOT push the number up the waits, or replace the code the customer already holds.
- A nonsense number must NOT leave a record behind.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (43)

**Step 1 — the schedule — every code makes the next wait longer**

- the shared schedule is 30 s, 1 min, 2 min, 5 min, 15 min, 1 hour, 6 hours — _30,60,120,300,900,3600,21600_
- code 1: sent, the next one must wait 30 seconds — asking at once is refused — _status 200/429, told 30s, left 30s, header 30, codes stored 1_
- code 2: sent, the next one must wait 1 minute — asking at once is refused — _status 200/429, told 60s, left 60s, header 60, codes stored 2_
- code 3: sent, the next one must wait 2 minutes — asking at once is refused — _status 200/429, told 120s, left 120s, header 120, codes stored 3_
- code 4: sent, the next one must wait 5 minutes — asking at once is refused — _status 200/429, told 300s, left 300s, header 300, codes stored 4_
- code 5: sent, the next one must wait 15 minutes — asking at once is refused — _status 200/429, told 900s, left 900s, header 900, codes stored 5_
- code 6: sent, the next one must wait 1 hour — asking at once is refused — _status 200/429, told 3600s, left 3600s, header 3600, codes stored 6_
- code 7: sent, the next one must wait 6 hours — asking at once is refused — _status 200/429, told 21600s, left 21600s, header 21600, codes stored 7_
- code 8: sent, the next one must wait 6 hours — asking at once is refused — _status 200/429, told 21600s, left 21600s, header 21600, codes stored 8_
- code 9: sent, the next one must wait 6 hours — asking at once is refused — _status 200/429, told 21600s, left 21600s, header 21600, codes stored 9_
- …and from the 7th code on the wait stays at 6 hours (the 8th and 9th codes too)
- the refusal says it in words: 'Please wait 6 hours before asking for another code.' — _Please wait 6 hours before asking for another code._
- even 2 seconds early is refused, and the message says how long is left — _429 Please wait 2 seconds before asking for another code._
- the moment the wait is over the next code is allowed

**Step 2 — hitting the API directly — many requests at once**

- 15 requests for a new number at the same moment: exactly ONE code is sent, 14 are refused — _200,429,429,429,429,429,429,429,429,429,429,429,429,429,429_
- …only one code exists for it
- after the wait, 15 at the same moment again: exactly one more code — _200,429,429,429,429,429,429,429,429,429,429,429,429,429,429_
- …two codes in all, and the next wait is the second step (1 minute) — _2 codes, wait 60s_
- 100 requests in a row for one number: only the first one sends a code — _1 sent_
- writing the same number another way (+91, 0091, spaces, dashes, a leading 0) does NOT get another code — _429,429,429,429,429,429,429_
- …there is still only one code for that phone

**Step 3 — each number has its own clock**

- a different number is not held back by someone else's wait
- an email address has its own clock too
- the staff coin code for a number that is waiting on a sign-in code is still allowed (separate flow) — _{"channel":"sms","devCode":"983979","resendAfterSec":30}_
- …and the coin code has the same waits (asking again at once is refused) — _429 Please wait 30 seconds before asking for another code._

**Step 4 — the screen is told what to do**

- refused too early, with the code just sent still good → 'liveCode' lets the screen take the customer straight to typing it — _{"code":"otp_wait","retryAfterSec":30,"liveCode":true,"via":null}_
- once that code has expired, 'liveCode' is false — the customer only has to wait — _{"code":"otp_wait","retryAfterSec":30,"liveCode":false,"via":null}_
- a number that isn't valid is a plain 400 and doesn't start a clock — _400_
- …nothing was recorded for it

**Step 5 — signing in starts the number over**

- (two codes so far)
- the customer signs in (dev code accepted on a store that sends nothing) — _200_
- …and the number's waits are wiped
- asking again right after signing in works, and starts at 30 seconds — _200 30_
- after a day without a request the count starts again at 30 seconds — _200 30_

**Step 6 — a code that could not be sent doesn't count**

- (the store's SMS gateway is set up and chosen)
- (…as the way codes are sent)
- the gateway is down: the customer is told the code couldn't be sent — _502 Couldn't send the code. Check the number and try again._
- …and no unsent code is left behind
- …it doesn't count as a code sent; the number can try again after 30 seconds (not at once) — _count 0, in 30s_
- trying again at once is refused
- once it works, this is the FIRST code (next wait 30 s, not 1 minute) — _200 30_
- a resend while the gateway is down fails
- …and the code the customer already had still signs them in — _200_

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-19 11:20 | pass | 43 | 0 | headless | 4.3 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t25-otp-resend-api.mjs`), not this page._
