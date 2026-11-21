# T26 — Sign-in code — resend timer on the screen (30 s first), kept by the server: Back, reload and direct API calls can't skip it

**Area:** security · **Last result:** ✅ PASSED (20 passed, 0 failed · 2026-11-21 13:24 · headless · 37.1 s)

**Run it alone:** `node run.mjs --only t26` (add `--visible` to watch it) · starts from fresh fake data

## What this test does

In Chrome as a new customer on the Acme Momos storefront. Asking for a code starts a 30-second countdown on 'Resend code' (the button is off while it runs). Pressing Back and 'Send code' again for the same number does NOT reset it — the server refuses (429), and the screen goes straight back to typing the code already sent, with a note, and the countdown continues from where it was. A page reload does the same. A script calling the API directly for the same number — plain, as +91…, with spaces — is refused every time with a Retry-After header, while another number is not. When the 30 seconds really have passed the button comes back, a new code is sent, and the next wait is 1 minute. The new code signs the customer in. The on-screen hint no longer talks about an SMS provider.

## Steps

1. A new customer asks for a sign-in code
2. Going Back and asking again does not reset the wait
3. A page reload does not reset it either
4. Calling the API directly can't get round it
5. When the 30 seconds are really over, Resend works — and the next wait is longer
6. The new code signs the customer in

## What to expect (these must happen)

- After 'Send code' the next screen counts down from 30 s on a disabled 'Resend code (…)' button and the number ticks down.
- The hint under the boxes says codes aren't being sent for this store yet (not 'No SMS provider configured').
- Back, then 'Send code' again for the same number: the API answers 429; the screen shows the code step with the note 'A code was already sent to …', and the countdown has NOT gone back to 30.
- After a reload the same thing happens.
- Direct calls for the same number — plain, +91…, with spaces — all get 429 'Please wait …' and a Retry-After header; a different number gets a code.
- After the 30 s the button is enabled; pressing it sends a new code (200) and the next wait is 1 minute.
- The new code signs the customer in (the 'a couple more details' step opens).

## What must NOT happen

- Going Back or reloading must NOT give a fresh 30 seconds, or a second code.
- The 'Resend code' button must NOT be usable while the timer runs.
- The screen must NOT show a raw error for an early request when the earlier code is still good.
- The browser must NOT log JavaScript errors.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (20)

**Step 1 — A new customer asks for a sign-in code**

- the code step opens, and 'Resend code' counts down from about 30 seconds — _Resend code (30s)_
- the Resend button is switched off while it counts
- the hint says codes aren't being sent for this store yet — not 'No SMS provider'
- the number ticks down — _30 → 28_
- the page made one request and the server said OK — _{"n":1,"s":200,"wait":30}_

**Step 2 — Going Back and asking again does not reset the wait**

- we are back on the details step
- the server refused the second request (429, 'Please wait …', with a Retry-After) — _{"s":429,"e":"Please wait 27 seconds before asking for another code.","h":"27"}_
- …and the screen went straight back to typing the code that was already sent
- the countdown carried on (it did not go back to 30) — _28 → 27_
- there is no red error for it

**Step 3 — A page reload does not reset it either**

- a fresh page, same number: refused (429) and taken to the code step with the countdown still running — _429 · 25s_

**Step 4 — Calling the API directly can't get round it**

- the same number, however it is written, is refused every time — _429,429,429,429,429_
- each refusal carries a Retry-After header — _24,24,24,24,24_
- a different number is not held back — _200_

**Step 5 — When the 30 seconds are really over, Resend works — and the next wait is longer**

- (still waiting for the timer) — _24 s to go_
- the button comes back when the timer ends — _Resend code_
- pressing it sends a new code (200) — the second one — _200 · next wait 60s_
- the button now counts down from 1 minute — _60_
- the new code is on screen — _124092_

**Step 6 — The new code signs the customer in**

- a new customer lands on the 'a couple more details' step

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-21 13:24 | pass | 20 | 0 | headless | 37.1 s |
| 2026-11-21 04:51 | pass | 20 | 0 | headless | 36.4 s |
| 2026-11-20 05:58 | pass | 20 | 0 | headless | 36.0 s |
| 2026-11-20 04:55 | pass | 20 | 0 | headless | 39.4 s |
| 2026-11-20 00:23 | pass | 20 | 0 | headless | 36.4 s |
| 2026-11-19 23:44 | pass | 20 | 0 | headless | 35.9 s |
| 2026-11-19 23:28 | pass | 20 | 0 | headless | 38.0 s |
| 2026-11-19 13:02 | pass | 20 | 0 | headless | 35.9 s |
| 2026-11-19 12:44 | pass | 20 | 0 | headless | 39.5 s |
| 2026-11-19 11:20 | pass | 20 | 0 | headless | 36.1 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t26-signin-resend-timer.mjs`), not this page._
