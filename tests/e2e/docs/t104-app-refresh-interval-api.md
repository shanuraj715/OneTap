# T104 — Apps → the refresh interval is one number per app (default 8 s), set by the platform admin, and announced to the app in every answer

**Area:** app · **Last result:** ✅ PASSED (34 passed, 0 failed · 2026-11-28 13:35 · headless · 3.8 s)

**Run it alone:** `node run.mjs --only t104` (add `--visible` to watch it)

## What this test does

Runs suites/app-refresh-interval-api.mjs against a private API on an in-memory database. With nothing set, every answer to OMA, KDA and RDA (requests carrying x-app-id) has x-refresh-seconds: 8, and the console's list gives the three apps at the default with the limits (3 to 600). Only the platform admin can read or change it (a store owner, a waiter and nobody signed in are refused). Setting RDA to 15 changes the very next answer to the rider app (on any route, errors too) and leaves OMA and KDA at 8; each app keeps its own number (KDA 5, OMA 600 …); it is stored as one document per app; changing it again is seen at once. Numbers below 3, above 600, fractions, text, null, missing are refused with a message a person can act on (400) and change nothing; an unknown app is 404. Requests with no app id, an unknown one, or the dashboard's own calls get no such header. The apps' jest suites compare their own limits with APP_REFRESH.

## Steps

1. Nothing set yet: every app asks every 8 seconds
2. Only the platform admin can see or change it
3. Each app has its own number: the delivery app set to 15 asks every 15 seconds
4. A change is seen at once, and again by a fresh read of the database
5. Wrong numbers are refused with a message a person can act on
6. Only mobile apps are told: the dashboard, the storefront and old builds get nothing added
7. The apps' own copy of the limits matches the server's

## What to expect (these must happen)

- Default 8 seconds for every app; each app has its own number.
- A change is announced with the very next answer, with no restart.
- Only the platform admin can change it.

## What must NOT happen

- A number outside 3–600 or a non-whole number must NOT be saved.
- The dashboard, the storefront and old app builds must NOT get the header.
- One app's number must NOT affect another's.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (34)

**Step 1 — Nothing set yet: every app asks every 8 seconds**

- oma: the answer says 8 seconds — _8_
- kda: the answer says 8 seconds — _8_
- rda: the answer says 8 seconds — _8_
- the console is told the limits (default 8, from 3 to 600) — _{"default":8,"min":3,"max":600}_
- and lists every app (the three staff apps, the Admin app and the Business app), all at the default — _[["oma",8,true],["kda",8,true],["rda",8,true],["admin",8,true],["business",8,true]]_
- with their codes (OMA, KDA, RDA, ADM, BIZ)

**Step 2 — Only the platform admin can see or change it**

- a store owner is refused (read and change) — _403/403_
- a waiter is refused (read and change) — _403/403_
- nobody signed in is refused (read and change) — _401/401_
- …and nothing changed

**Step 3 — Each app has its own number: the delivery app set to 15 asks every 15 seconds**

- saving 15 for RDA is accepted
- the very next answer to the delivery app says 15
- the order app and the kitchen app are still at 8
- the number rides on every kind of answer, e.g. the rider's delivery list (a refusal for no sign-in)
- …and on errors (404) too
- the kitchen app at 5, the order app at 600 (the largest allowed), the delivery app at 15
- the console's list shows each app's own number (the apps nobody changed stay at the default) — _[["oma",600],["kda",5],["rda",15],["admin",8],["business",8]]_

**Step 4 — A change is seen at once, and again by a fresh read of the database**

- changing 15 → 30: the next answer already says 30
- it is stored in the database (one document per app)
- setting it back to 8 works

**Step 5 — Wrong numbers are refused with a message a person can act on**

- 2 is refused (400) — _400 At least 3 seconds: asking more often than that only loads the server._
- 601 is refused (400)
- 7.5 is refused (400) — _400 Enter a whole number of seconds, from 3 to 600._
- "abc" is refused (400) — _400 Enter a whole number of seconds, from 3 to 600._
- null is refused (400) — _400 Enter a whole number of seconds, from 3 to 600._
- undefined is refused (400) — _400 Enter how many seconds to wait between refreshes._
- -4 is refused (400) — _400 At least 3 seconds: asking more often than that only loads the server._
- 0 is refused (400) — _400 At least 3 seconds: asking more often than that only loads the server._
- and the number did not change
- an app that doesn't exist is refused (404) — _404_

**Step 6 — Only mobile apps are told: the dashboard, the storefront and old builds get nothing added**

- a request with no app id has no refresh header (an old OMA build sent none)
- an unknown app id gets none either
- the dashboard's own calls carry none

**Step 7 — The apps' own copy of the limits matches the server's**

- APP_REFRESH is { default: 8, min: 3, max: 600 } (each app's jest suite compares its own config to this line)

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-28 13:35 | pass | 34 | 0 | headless | 3.8 s |
| 2026-11-28 03:11 | pass | 34 | 0 | headless | 5.8 s |
| 2026-11-28 03:10 | fail | 31 | 3 | headless | 4.5 s |
| 2026-11-27 16:42 | pass | 34 | 0 | headless | 3.7 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t104-app-refresh-interval-api.mjs`), not this page._
