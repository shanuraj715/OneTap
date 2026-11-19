# T15 — Sign-in protection — wrong guesses block the network, blocks grow longer, a blocked network sees no login form, the platform can unblock

**Area:** security · **Last result:** ✅ PASSED (28 passed, 0 failed · 2026-11-19 01:11 · headless · 34.0 s)

**Run it alone:** `node run.mjs --only t15` (add `--visible` to watch it) · starts from fresh fake data

## What this test does

In Chrome. Three wrong passwords on the dashboard login block the attacker's network address: the page swaps the form for 'Sign-in is paused' with a countdown, a reload still shows no form, and even the right password can't be tried. Another address signs in normally. When the first block ends the form comes back; a second round of wrong guesses blocks for longer (6 s then 12 s here; minutes to a day on a real server). The platform console's Security page lists the address with how many times it was blocked and an Unblock button that lifts it at once. The same happens on the storefront for wrong customer codes, without affecting other customers.

## Steps

1. The attacker guesses wrong passwords on the dashboard login
2. A blocked address can't get back to the form by reloading, or sign in with the right password
3. Someone at a different address signs in normally at the same time
4. When the block ends the form comes back by itself, and the next block is longer
5. The platform console lists the blocked address and can unblock it
6. On the storefront: wrong customer codes block that network, and only that network
7. Dashboard and customer blocks are separate, and the platform can lift the customer block too

## What to expect (these must happen)

- Each wrong password says how many attempts are left; the last wrong one swaps the form for a 'Sign-in is paused' notice with a countdown.
- A blocked address sees the notice (no email/password boxes) even after a reload — the right password cannot even be tried.
- A different address signs in normally at the same time.
- When the countdown ends the sign-in form returns by itself.
- A second block lasts longer than the first.
- Platform console → Security lists the address (blocked, times blocked) and Unblock lifts it at once.
- On the storefront, wrong customer codes block that network the same way, others are unaffected, and the platform can unblock it.

## What must NOT happen

- A blocked address must NOT be shown the sign-in form, and the correct password must NOT sign it in.
- One address being blocked must NOT block anyone else.
- A second block must NOT be the same length as (or shorter than) the first.
- A blocked dashboard address must NOT stop that same address's customers' codes, and the other way round (separate counters).
- The browser must NOT log JavaScript errors.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (28)

**Step 1 — The attacker guesses wrong passwords on the dashboard login**

- a fresh address sees the normal sign-in form
- 1st wrong password: 'Incorrect email or password' and 2 attempts left — _2 attempts left before sign-in is paused for a while_
- 2nd wrong password: 1 attempt left
- 3rd wrong password: the form is replaced by 'Sign-in is paused' with a countdown — _6 s left_
- did not happen: the sign-in form is still shown to the blocked address

**Step 2 — A blocked address can't get back to the form by reloading, or sign in with the right password**

- did not happen: after a reload the blocked address sees the sign-in form
- …the notice and countdown are still there
- did not happen: going straight to a dashboard page gets the attacker a sign-in form

**Step 3 — Someone at a different address signs in normally at the same time**

- another address still sees the normal form
- …and the owner signs in with the right password

**Step 4 — When the block ends the form comes back by itself, and the next block is longer**

- the form comes back once the countdown reaches zero
- the second block is longer than the first (6 s → 12 s) — _6 → 12_
- did not happen: the second block is the same length as the first

**Step 5 — The platform console lists the blocked address and can unblock it**

- Security lists the address as Blocked, for Dashboards, blocked twice — _203.0.113.50 Dashboards Blocked · 10 seconds left 0 2 19 Nov, 1:11:12 am Unblock_
- …and explains the rules (3 wrong tries, longer each time)
- did not happen: the address is still listed as blocked after Unblock
- the unblocked address sees the sign-in form again at once — _TablePe admin Sign in to manage your restaurant. Email Password Sign in_

**Step 6 — On the storefront: wrong customer codes block that network, and only that network**

- wrong code 1: 'That code isn't right'
- wrong code 2: 'That code isn't right'
- the 3rd wrong code swaps the sign-in form for 'Sign-in is paused'
- did not happen: the code boxes are still shown to the blocked address
- did not happen: after a reload the blocked address can type another code
- another customer's address still gets the normal sign-in form
- did not happen: another customer's address is shown the paused notice

**Step 7 — Dashboard and customer blocks are separate, and the platform can lift the customer block too**

- Security lists the storefront block as 'Customer codes'
- did not happen: the dashboard login of that address was blocked by the customer-code guesses
- 'Unblock everyone' clears the list
- did not happen: the browser logged JavaScript errors

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-19 11:13 | pass | 28 | 0 | headless | 33.2 s |
| 2026-11-19 01:11 | pass | 28 | 0 | headless | 34.0 s |
| 2026-11-18 17:40 | pass | 28 | 0 | headless | 34.7 s |
| 2026-11-18 17:10 | pass | 28 | 0 | headless | 34.9 s |
| 2026-11-18 15:05 | pass | 28 | 0 | headless | 33.5 s |
| 2026-11-18 14:30 | pass | 28 | 0 | headless | 34.5 s |
| 2026-11-16 03:16 | pass | 28 | 0 | headless | 35.1 s |
| 2026-11-16 02:26 | pass | 28 | 0 | headless | 34.7 s |
| 2026-11-16 01:47 | pass | 28 | 0 | headless | 34.3 s |
| 2026-11-16 01:37 | pass | 28 | 0 | headless | 33.7 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t15-login-protection.mjs`), not this page._
