# T66 — Completed dine-in order frees the table (no Needs cleaning) · phone layouts · platform live-updates switch · print station every 8 s with check, loader and countdown

**Area:** operations · **Last result:** ✅ PASSED (47 passed, 0 failed · 2026-11-21 13:04 · headless · 1 min 51 s)

**Run it alone:** `node run.mjs --only t66` (add `--visible` to watch it)

## What this test does

Runs suites/ops-batch.mjs in Chrome. Tables: a dine-in order marked Completed frees its table by itself once nothing else on the table is open and everything is paid (a second open order keeps it Seated); 'needs-cleaning' is no longer a status (refused; moving a party leaves the old table Free). Phone (375 px): 'Free table for new guests' is on the Take order menu screen before any item is added and works; the dashboard shows its cards two to a row, equal height, nothing clipped, no sideways scroll (three columns on a computer); the Orders filters are ONE row that scrolls sideways, one line tall, with dropdowns still opening; the platform console's store page header keeps its three buttons in one row and the name has room. Platform: Settings → Live order updates switch — off refuses new WebSockets, an open Orders page changes to 'Refreshing every 5s' and asks the API every ~5 s; on brings Live back. Print station: the sidebar chip shows a green check and 'Print station on · next check Ns' counting down, a loader with 'Checking…' while it asks, and asks the server only every ~8 s.

## Steps

1. A completed dine-in order frees the table; no 'Needs cleaning'
2. Phone: 'Free table for new guests' is on the front screen
3. Phone: the dashboard
4. Phone: Orders filters in one scrolling row
5. Platform: live updates over a WebSocket on / off
6. Print station: 8-second checks, green check, loader, countdown
7. Print station: the platform dashboard (super admin) never prints or checks
8. Phone: the store page in the platform console

## What to expect (these must happen)

- Completing the last open order of a dine-in table frees the table; another open order keeps it seated.
- No 'Needs cleaning' anywhere; the API refuses it.
- On a phone: the free-table button is on the first menu screen; dashboard cards fit; Orders filters scroll in one row; the store header fits.
- Live updates off → no sockets, 5-second polling; on → Live again.
- Print station: ≥ 8 s between server checks; green check, loader and countdown shown.

## What must NOT happen

- A table with another order still open must NOT be freed.
- No page may scroll sideways on a phone; no dashboard card may clip its content.
- No errors in the browser.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (47)

**Step 1 — A completed dine-in order frees the table; no 'Needs cleaning'**

- the table is Seated while the order is open
- …and still Seated when the order is only Ready
- the order is marked Completed
- the table is Free again by itself — nobody had to press 'Free the table' — _free null_
- and its party session is closed
- a table with ANOTHER order still being made stays Seated when one order is completed
- …and is freed when the last one is completed
- 'needs-cleaning' is no longer a status (setting it is refused) — _400_
- moving a party leaves the old table Free (not 'needs cleaning'), the new one Seated

**Step 2 — Phone: 'Free table for new guests' is on the front screen**

- (set-up: T4 is still seated by a party with nothing open and nothing owed) — _{"paid":true,"open":0}_
- on a phone, with nothing added yet, the menu screen shows 'Free table for new guests'
- …near the top of the screen and fully inside it — _{"y":133,"w":243}_
- tapping it frees the table
- and the banner goes away

**Step 3 — Phone: the dashboard**

- the cards sit two to a row on a phone — _2 columns_
- every card is inside the screen
- nothing inside a card is clipped or overflows it
- the page doesn't scroll sideways
- cards in a row are the same height — _137 vs 137_
- on a computer it is still three columns

**Step 4 — Phone: Orders filters in one scrolling row**

- the filters are one row, wider than the screen, scrolling sideways — _{"sw":836,"cw":343,"h":35,"oneRow":true,"ox":"auto"}_
- the row is a single line tall — the order list isn't pushed down — _35px_
- the page itself doesn't scroll sideways
- the last chip (Payment pending) is reachable by scrolling the row
- a filter dropdown still opens (it isn't clipped by the scrolling row)

**Step 5 — Platform: live updates over a WebSocket on / off**

- the default: the Orders page says Live (a WebSocket)
- the platform setting is ON by default
- Platform settings → Live order updates: the switch is on
- switching it off is saved
- the page explains what off means (it updates a moment after the save)
- a new live connection is refused while it is off — _refused_
- an open Orders page switches itself to 'Refreshing every 5s' (within a minute)
- it asks the API for the order list every ~5 seconds — _2 requests in 11.5 s_
- switching it back on is saved
- the Orders page is Live again by itself

**Step 6 — Print station: 8-second checks, green check, loader, countdown**

- when idle the chip says 'Print station on' with a green check
- …and shows a countdown to the next check (just the seconds, no extra words) — _Print station on · 9s_
- the countdown goes down second by second — _9s → 7s_
- the check is green (the success colour) — _rgb(46, 125, 70)_
- while it asks the server the chip shows a loader and 'Checking…'
- the station asks the server only every ~8 s (not every 4) — _3 calls in 38 s, gaps 8,8s_

**Step 7 — Print station: the platform dashboard (super admin) never prints or checks**

- with the print station switched on in this browser, the super admin's platform dashboard makes NO print requests — _0 calls in 19 s_
- …and shows no 'Print station on' chip

**Step 8 — Phone: the store page in the platform console**

- the three buttons sit in one tidy row inside the screen — _{"oneRow":true,"maxRight":305,"vw":375,"minLeft":16}_
- the page doesn't scroll sideways
- the store name has room (it isn't squeezed into a thin column) — _343px wide_
- no errors in the browser

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-21 13:04 | pass | 47 | 0 | headless | 1 min 51 s |
| 2026-11-21 05:07 | fail | 46 | 1 | headless | 1 min 53 s |
| 2026-11-21 05:05 | fail | 46 | 1 | headless | 1 min 52 s |
| 2026-11-21 04:17 | pass | 47 | 0 | headless | 1 min 51 s |
| 2026-11-21 04:15 | fail | 46 | 1 | headless | 1 min 51 s |
| 2026-11-21 04:10 | error | 40 | 0 | headless | 1 min 14 s |
| 2026-11-21 04:08 | error | 28 | 0 | headless | 4.7 s |
| 2026-11-21 04:07 | fail | 26 | 2 | headless | 4.4 s |
| 2026-11-21 04:07 | fail | 23 | 1 | headless | 3.3 s |
| 2026-11-21 04:06 | error | 14 | 0 | headless | 32.4 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t66-ops-batch.mjs`), not this page._
