# T97 — Kitchen app (KDA) API: only the kitchen team may sign in; a dish can be marked sold out / unavailable / available from the kitchen (with a stock number for managers); nothing the other apps or the dashboard do has changed

**Area:** kitchen · **Last result:** ✅ PASSED (34 passed, 0 failed · 2026-11-26 22:05 · headless · 4.6 s)

**Run it alone:** `node run.mjs --only t97` (add `--visible` to watch it)

## What this test does

Runs suites/kitchen-app-api.mjs on a private API with an in-memory database (no browser). Sign-in with x-app-id: kda: kitchen staff, a manager, the owner and the platform admin get in; a waiter, an accountant and an editor are turned away with a clear message (403 app_not_allowed) and the session that was just opened is ended; the same waiter and a cook still sign in to OMA exactly as before. Dishes: the list shows every dish with its state (available / sold out / unavailable, a counted dish at zero = sold out, running low flagged); the cook switches a dish sold out → unavailable → available, the staff app's 'unavailable now' list and the storefront menu follow at once and the storefront shows nothing of the kitchen's note; a waiter can't switch a dish; an unknown state is 400, a missing dish 404; a counted dish with none left stays sold out when put back (and says so), a cook can't set a number (403), the manager can (menu:update), a number for an uncounted dish is refused; the dashboard's own switch clears the kitchen's note (switched back on = available, switched off = unavailable, never a stale 'sold out'). The board is the existing one; today's summary with no orders is zeros.

## Steps

1. Who may sign in to the Kitchen app (the server decides, not the app)
2. The dishes
3. Switching a dish (the dish's own switch, so every screen obeys it)
4. Who may do what
5. The dashboard's own switch is unchanged
6. The board and the manager's numbers

## What to expect (these must happen)

- Only kitchen staff, managers, owners and the platform admin can sign in to the Kitchen app; everyone else gets a clear refusal and no session.
- A cook can mark a dish sold out, unavailable or available and every screen follows; only a manager can put a stock number on it.
- OMA's sign-in and the dashboard behave exactly as before.

## What must NOT happen

- A waiter must NOT get into the Kitchen app or switch a dish from it.
- A cook must NOT be able to change a stock count.
- The storefront menu must NOT show the kitchen's reason for a switched-off dish.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (34)

**Step 1 — Who may sign in to the Kitchen app (the server decides, not the app)**

- kitchen staff, a manager, the owner and the platform admin can sign in — _200,200,200,200_
- a cook may use the app and switch a dish, but may not edit the menu
- waiter (not kitchen) is turned away, in words
- books (not kitchen) is turned away, in words
- ed (not kitchen) is turned away, in words
- the same waiter signs in to OMA exactly as before (no app named = OMA)
- …and when OMA names itself
- a cook can still use OMA's sign-in too (nothing was taken away from anyone)
- a refused sign-in sets nothing
- …and the session each refused sign-in opened is ended (only the two OMA sign-ins of this waiter are left) — _2 session(s)_

**Step 2 — The dishes**

- the cook sees every dish with its category
- an ordinary dish: available, not counted
- a counted dish with none left shows as sold out
- a counted dish running low is flagged
- (a waiter can already read the menu, so reading the list is no new power)

**Step 3 — Switching a dish (the dish's own switch, so every screen obeys it)**

- the cook marks a dish SOLD OUT
- the staff app's 'unavailable now' list has it at once, labelled Sold out
- …then UNAVAILABLE (it can't be made today): a different state
- the list agrees
- …and AVAILABLE again
- it leaves the 'unavailable now' list
- the storefront's menu has it back, and shows nothing of the kitchen's note

**Step 4 — Who may do what**

- a waiter can NOT switch a dish from here (no menu:availability)
- an unknown state is refused
- a dish that doesn't exist is a 404
- a counted dish with none left stays sold out when put back, and says so (it needs a number)
- a cook can NOT set a stock number (that is the manager's, menu:update)
- the manager restocks it: available with 5 left
- a number for a dish that isn't counted is refused

**Step 5 — The dashboard's own switch is unchanged**

- the cook's sold-out shows
- the owner switching it back on in the dashboard puts it back (and the kitchen's note is forgotten)
- switching it OFF in the dashboard is 'unavailable' (not a stale 'sold out')

**Step 6 — The board and the manager's numbers**

- the board is the existing one, unchanged
- today's summary with no orders: zeros, no average — _{"ready":0,"averageMinutes":null,"lateCount":0,"slowest":null,"topDishes":[]}_

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-26 22:05 | pass | 34 | 0 | headless | 4.6 s |
| 2026-11-26 22:05 | fail | 33 | 1 | headless | 4.9 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t97-kitchen-app-api.mjs`), not this page._
