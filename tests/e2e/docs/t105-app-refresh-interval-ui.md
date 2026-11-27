# T105 — Console → App Management → Refresh interval: set how often OMA, KDA and RDA ask for new data (default 8 s, per app, 3–600), and the apps are told with their next request

**Area:** app · **Last result:** ✅ PASSED (35 passed, 0 failed · 2026-11-28 03:10 · headless · 4.4 s)

**Run it alone:** `node run.mjs --only t105` (add `--visible` to watch it)

## What this test does

Runs suites/app-refresh-interval-ui.mjs in Chrome against the bench. On App Management each app's tab has a 'Refresh interval' card: it says '<app> asks the server for new data every N seconds (the default)' and what that app's refresh covers (OMA: table board and orders, KDA: the kitchen board, RDA: new delivery requests), with a box 'Seconds between refreshes' (default 8, from 3 to 600), Save, and 'Use the default (8)'. Saving 15 for RDA shows 'RDA now asks every 15 seconds', the card stops saying 'the default', Save turns off, a reload still shows 15, and the header a phone running RDA gets (x-refresh-seconds on any answer to a request with x-app-id: rda) is 15 while OMA and KDA are still told 8. 2, 601 and 7.5 are refused in the box with a message (Save stays off) and by the server (400); an empty box just turns Save off; 3 and 600 are accepted; Enter saves; 'Use the default' only fills the box until Save is pressed; the three apps keep separate numbers (OMA 12, RDA 25, KDA 8). A 390 px screen has no sideways overflow.

## Steps

1. Every app starts at 8 seconds
2. The delivery app set to 15: it is saved and the server announces 15 to that app only
3. It is remembered, per app
4. Wrong numbers are stopped before they are sent, with a message
5. The edges are allowed: 3 and 600
6. Enter saves, and 'Use the default' brings back 8
7. Each app keeps its own number
8. A phone-sized screen

## What to expect (these must happen)

- Each app's tab has its own number; the delivery app set to 15 is announced as 15.
- Bad numbers are explained and not saved; the edges (3 and 600) work.
- A saved number survives a reload; 'the default' is shown whenever the number is 8.

## What must NOT happen

- Changing one app's number must NOT change another's.
- Pressing 'Use the default' must NOT save by itself.
- No errors in the browser; nothing off the edge on a phone.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (35)

**Step 1 — Every app starts at 8 seconds**

- the order app's card says 8 seconds, the default
- the box holds 8
- Save is off while nothing has changed
- and there is no 'Use the default' button while it already is the default
- the card says what the order app's refresh covers
- the delivery app's card says it covers new delivery requests
- and starts at 8 seconds as well
- the kitchen app's card is about the kitchen board

**Step 2 — The delivery app set to 15: it is saved and the server announces 15 to that app only**

- typing a new number turns Save on
- and offers 'Use the default (8)'
- a note says RDA now asks every 15 seconds
- the card now reads 15 seconds
- and no longer says it is the default
- Save goes off again (nothing left to save)
- a phone running the delivery app is now told 15
- the order app and the kitchen app are still told 8

**Step 3 — It is remembered, per app**

- after a reload the first tab (OMA) still shows 8
- the delivery app's tab shows 15

**Step 4 — Wrong numbers are stopped before they are sent, with a message**

- 2 is refused in the box (outside 3 to 600) and Save stays off — _At least 3 seconds: asking more often only loads the server._
- 601 is refused in the box (outside 3 to 600) and Save stays off — _At most 600 seconds._
- 7.5 is refused in the box (not a whole number) and Save stays off — _Enter a whole number of seconds, from 3 to 600._
- an empty box turns Save off without a scary message
- none of those reached the server
- and the server refuses them too (400) without changing anything

**Step 5 — The edges are allowed: 3 and 600**

- 3 seconds (the smallest) is accepted
- 600 seconds (the largest) is accepted

**Step 6 — Enter saves, and 'Use the default' brings back 8**

- pressing Enter in the box saves it (20)
- 'Use the default (8)' puts 8 in the box
- …but nothing is saved until Save is pressed
- Save then sets it back to 8
- and the card says it is the default again

**Step 7 — Each app keeps its own number**

- OMA 12, RDA 25, KDA 8: three separate numbers

**Step 8 — A phone-sized screen**

- nothing sticks out sideways on a 390 px screen
- the box and Save are both reachable
- no errors in the browser

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-28 03:10 | pass | 35 | 0 | headless | 4.4 s |
| 2026-11-27 16:42 | pass | 35 | 0 | headless | 3.9 s |
| 2026-11-27 16:35 | pass | 35 | 0 | headless | 4.3 s |
| 2026-11-27 16:34 | pass | 35 | 0 | headless | 4.0 s |
| 2026-11-27 16:34 | pass | 35 | 0 | headless | 6.2 s |
| 2026-11-27 16:34 | pass | 35 | 0 | headless | 5.2 s |
| 2026-11-27 16:33 | fail | 34 | 1 | headless | 4.4 s |
| 2026-11-27 16:33 | fail | 34 | 1 | headless | 7.9 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t105-app-refresh-interval-ui.mjs`), not this page._
