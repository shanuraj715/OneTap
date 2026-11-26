# T65 — Kitchen display (/kitchen) — orders by station, Start / Ready, late colours, and the waiter's bell (off by default)

**Area:** kitchen · **Last result:** ✅ PASSED (43 passed, 0 failed · 2026-11-26 22:10 · headless · 9.0 s)

**Run it alone:** `node run.mjs --only t65` (add `--visible` to watch it)

## What this test does

Runs suites/kitchen-display.mjs. API: an accepted order is a NEW card on the board with its table; the Kitchen and Bar screens each show only their station's dishes; each station moves new → preparing → ready on its own and the order's status follows (preparing on the first Start, ready only when EVERY station is ready, recall puts it back); the All screen marks every station at once; a station with nothing to make is refused; completed / cancelled orders leave the board; the kitchen role can read it; a store on a plan without Kitchen display gets 403. Browser: Settings → Kitchen & delivery → Kitchen display (bell switch off by default, saved when ticked); the kitchen user's /kitchen screen — NEW / PREPARING / READY lanes, station tabs (/kitchen?screen=bar), Start, Ready, Recall; with the bell off the waiter's screen shows nothing, with it on a card 'Table T4 — Order #… Everything is ready' appears on whatever page the waiter is on and can be dismissed; the sound switch is remembered; a waiting order turns amber and then red (clock fast-forwarded).

## Steps

1. API: the board
2. API: stations move on their own; the order follows
3. API: rules
4. Browser: the /kitchen screen
5. Browser: late orders turn amber, then red

## What to expect (these must happen)

- Orders appear per station; the order is ready only when every station is ready; recall works; finished orders leave the board.
- The kitchen role can use /kitchen; a plan without the feature gets 403.
- The waiter's bell is off by default; on, it shows the table and order when the kitchen is ready.
- Waiting cards turn amber then red after the thresholds.

## What must NOT happen

- The bar finishing first must NOT mark the whole order ready.
- With the bell off the waiter must NOT see a notification.
- A completed or cancelled order must NOT stay on the board.
- No errors in the browser.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (43)

**Step 1 — API: the board**

- the waiter's bell is OFF by default — _{"notifyWaiter":false,"warnAfterMinutes":10,"lateAfterMinutes":20}_
- a staff order is accepted and goes to the kitchen — _accepted_
- the order is on the board as a NEW card with its table and both dishes — _{"stage":"new","table":"T2","n":2}_
- it needs two stations: kitchen and bar
- the Kitchen screen shows only the kitchen dish (and its quantity)
- the Bar screen shows only the bar dish
- waiting thresholds default to amber 10 / red 20 minutes

**Step 2 — API: stations move on their own; the order follows**

- the kitchen taps Start → the order becomes 'preparing'
- kitchen shows Preparing, the bar still New, and 'All' shows the slowest (New)
- the bar finishes first — the order is NOT ready yet (the kitchen still cooks)
- when the kitchen is ready too, the order becomes 'ready'
- …and sits in the Ready lane
- Recall: the kitchen taking it back puts the order back to 'preparing'
- the 'All' screen's Ready marks every station at once
- pressing Ready twice is harmless

**Step 3 — API: rules**

- the kitchen can't mark an order that has nothing to make there — _409 This order has nothing to make at that station._
- such an order isn't on the Kitchen screen, only on the Bar's
- an unknown stage is refused
- a completed order leaves the board
- a finished order can't be moved from the kitchen screen
- a cancelled order leaves the board too
- the kitchen role can open the board
- a store whose plan has no Kitchen display is refused (403) — _403 Kitchen display isn't included in your plan._

**Step 4 — Browser: the /kitchen screen**

- Settings → Kitchen & delivery → Kitchen display: the waiter's bell switch is off
- ticking it and saving turns the bell on for the store
- the kitchen user sees the new order in the NEW lane, with its table
- the card shows the table, both dishes and which station makes each
- the Bar tab is in the address (/kitchen?screen=bar), so a bar tablet can open it directly
- the Bar screen shows only the bar dish
- Start moves the card to PREPARING
- …and the order's status is 'preparing'
- Ready moves the card to the READY lane
- with the bell OFF the waiter's screen shows nothing when the kitchen is ready
- Recall brings it back to PREPARING
- bell ON: the waiter's screen shows 'Table T4 — Order #… Everything is ready' — _Table T4 — Order #0003 Everything is ready — take it out._
- the waiter can dismiss it
- the new-order sound is on by default
- switching it off is remembered on this device after a reload

**Step 5 — Browser: late orders turn amber, then red**

- a fresh order is neutral (not amber, not red)
- after the amber time it turns amber
- after the red time it turns red
- its waiting time is shown in minutes — _2 min_
- no errors in the browser

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-26 22:10 | pass | 43 | 0 | headless | 9.0 s |
| 2026-11-21 13:14 | pass | 43 | 0 | headless | 9.1 s |
| 2026-11-21 05:03 | pass | 43 | 0 | headless | 9.8 s |
| 2026-11-21 04:20 | pass | 43 | 0 | headless | 9.2 s |
| 2026-11-21 03:33 | pass | 43 | 0 | headless | 9.8 s |
| 2026-11-21 03:32 | pass | 43 | 0 | headless | 9.3 s |
| 2026-11-21 03:32 | fail | 18 | 5 | headless | 2.1 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t65-kitchen-display.mjs`), not this page._
