# T87 — Staff app sign-in: a session token in the answer, used as a Bearer token, with the dashboard's brute-force guards (address block, account pause, flood limit)

**Area:** security · **Last result:** ✅ PASSED (34 passed, 0 failed · 2026-11-27 17:01 · headless · 7.0 s)

**Run it alone:** `node run.mjs --only t87` (add `--visible` to watch it)

## What this test does

Runs suites/staff-app-auth-api.mjs on a private API with an in-memory database (no browser). POST /api/auth/app-login gives the session token in the answer and sets no cookie; the token then works as 'Authorization: Bearer' for /api/auth/me and the staff endpoints (tables, tables in service, menu) while the outlet still has to be named; no token / a made-up token / an expired one are 401; signing out with the token ends that session only; the dashboard's own cookie sign-in is unchanged (no token in its answer); roles are still enforced (a kitchen account may sign in but is refused when it tries to place an order, 403). The guards: a wrong password and an unknown email get the identical message; 4 wrong passwords from one address block it (even the right password is then refused with a countdown, GET /api/auth/guard says so) and the block is shared with the dashboard sign-in; wrong passwords for one account from many addresses pause that account on both routes; a burst from one address hits the login-flood limit with a Retry-After.

## Steps

1. Signing in with the app route
2. Using the token
3. Roles are still enforced
4. Signing out and expiry
5. The sign-in guards apply to the app route
6. The limits are on the route inventory

## What to expect (these must happen)

- The app route gives a token, never a cookie; the token works as a Bearer token and is dropped by signing out or expiry.
- Wrong passwords block the address and pause the account across BOTH the app and dashboard sign-in routes.

## What must NOT happen

- The app route must NOT be a way around the dashboard's brute-force guards.
- The dashboard's sign-in must NOT start returning the token in its answer.
- A wrong password and an unknown email must NOT be told apart.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (34)

**Step 1 — Signing in with the app route**

- the right email and password give a session token in the answer — _status 200_
- …and nothing is set as a cookie (the app keeps the token itself)
- the answer says who signed in, their role and what they may do (the app needs order:create and table access) — _staff_
- the session lasts days, not minutes (it is the same session the dashboard uses) — _2026-12-11T11:31:07.449Z_
- the password hash is never in the answer
- the dashboard's own sign-in is unchanged: a cookie, and no token in the answer

**Step 2 — Using the token**

- the token identifies the person on any request (GET /api/auth/me)
- …and opens the staff endpoints the app needs (the tables of their outlet) — _status 200_
- …including the tables currently in service
- …and the menu
- with no token and no cookie the same request is refused (401)
- a made-up token is refused (401)
- the outlet still has to be named (the token proves who, the header says where)
- an owner's token can do what an owner can
- (and a waiter's token is judged by the waiter's role, not refused as unsigned)

**Step 3 — Roles are still enforced**

- a kitchen account can sign in but is told it may not take orders (the app turns it away)
- …and the server refuses its order attempt (403), whatever the app does — _status 403_

**Step 4 — Signing out and expiry**

- signing out with the token answers 204
- …and that token stops working at once
- other people's tokens are untouched
- a token whose session has expired is refused
- a person can be signed in on the app and in the dashboard at the same time

**Step 5 — The sign-in guards apply to the app route**

- a wrong password and an unknown email get the very same 401 message (no hint which emails exist) — _Incorrect email or password_
- GET /api/auth/guard tells the app whether this address is blocked (so it can show a notice instead of the form)
- wrong passwords are answered 401 at first — _401,401,401,429_
- after 4 wrong passwords the address is blocked — even the RIGHT password is now refused (429) with a countdown — _429 Too many failed attempts. Try again in 5 minutes._
- the guard endpoint now says blocked, and for how long — _{"blocked":true,"retryAfterSec":300,"blockedUntil":"2026-11-27T11:36:08.172Z"}_
- the block is shared: the same address is refused on the DASHBOARD sign-in too (the app route is not a way around it) — _status 429_
- another address is not affected
- wrong passwords for one account from many different addresses pause that account — _answers 401,429, then right password: 429_
- …even with the right password, from a fresh address, on the app route — _status 429_
- …and on the dashboard route (one shared pause)
- a burst of sign-in requests from one address is stopped by the flood limit (10 a minute here) — _first 429 at request 11 of 14_
- …with the named policy login-flood and a Retry-After header — _login-flood 60_

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-27 17:01 | pass | 34 | 0 | headless | 7.0 s |
| 2026-11-27 16:46 | pass | 34 | 0 | headless | 7.1 s |
| 2026-11-26 22:10 | pass | 34 | 0 | headless | 5.0 s |
| 2026-11-26 19:25 | pass | 34 | 0 | headless | 8.3 s |
| 2026-11-26 16:49 | pass | 34 | 0 | headless | 5.2 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t87-staff-app-auth-api.mjs`), not this page._
