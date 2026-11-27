# T110 — Plans: a wide New plan pop-up that needs no scrolling, a tables limit in steps of 5 (plan, store, onboarding form), and the owner's Tables page when the plan's tables are all used

**Area:** platform · **Last result:** 💥 ERROR (44 passed, 0 failed · 2026-11-27 09:54 · headless · 38.1 s)

**Run it alone:** `node run.mjs --only t110` (add `--visible` to watch it)

## What this test does

Chrome against the bench, as the platform super admin and as the Beta store's owner (Beta is on a 5-table Starter plan). Plans: the cards say '5 tables' / 'Unlimited tables'. The New plan pop-up is at least 1,200 px wide on a 1,440 px screen and shows the whole plan without scrolling (also with the website price fields open); Features, Visual effects and On the website stand side by side, and the limits are on one row (people, tables). The Tables box starts at 5 and rounds what is typed UP to the next five (12 → 15, 4 → 5, 54 → 55, 0 → 5, 7 → 10); Enter rounds it and does NOT save the plan; Unlimited switches the number off and back on. 'Include every feature' ticks and locks the list without crashing (it did crash: it used a function the pop-up didn't have). A Custom plan hides the limits. A plan is saved with 15 tables, shows '15 tables' on its card, edits to 25. The store's page shows 'Tables n / 5', its Plan & limits tab says 'From plan — 5', a 'Custom number' of 12 becomes 15 and is saved for this store only (the plan keeps 5), 'From plan' undoes it. The owner's Tables page says '3 of 5 tables used', adding the 4th updates it at once, with 5 of 5 a warning appears (and the Add table button is off) and the server refuses a 6th; after one is removed it works again, and adding the last free table brings the warning up without reloading. The onboarding form's Tables box starts at 0 and moves by five; 10 tables on Starter raises a red warning and a problem in the Plan fit panel, 'Add the extra tables for this client' turns it amber and clears the problem, typing 12 gives 15, stepping down to 0 removes it; Pro (no table limit) shows no warning; Custom has a 'Tables for this client' box starting at 5. The Price list has 'Every 5 extra tables (₹)' starting at 100.

## Steps

- _(set-up)_
1. A. Plans: tables on the cards, and the wide New plan pop-up
2. A2. The tables limit goes up in fives
3. A3. 'Include every feature' (this crashed before: it used a function the pop-up didn't have)
4. A4. Custom plans have no limits of their own
5. A5. Save, and edit
6. B. Console → the store → Plan & limits
7. C. The owner's Tables page when the plan's tables are all used
8. D. Onboarding form: tables

## What to expect (these must happen)

- The New plan pop-up is wide and a normal screen shows all of it without scrolling.
- Wherever a table limit is typed, it is rounded UP to the next five.
- A store whose plan's tables are all used sees a warning and can't add a table; removing one brings it back.
- The onboarding form warns when the tables asked for are more than the plan allows, and lets the representative add them for this client.

## What must NOT happen

- Pressing Enter in the tables box must NOT save the plan.
- 'Include every feature' must NOT crash.
- No errors in the browser.

## Result of the last run

**The test stopped early:** `plan-table-limit-ui.mjs exited with code 1. }  Node.js v24.3.0`

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (44)

**Set-up — Setup**

- the bench's Beta store is on a 5-table plan and has at most 3 tables to begin with — _max 5, has 2_

**Step 1 — A. Plans: tables on the cards, and the wide New plan pop-up**

- the Starter card says '… · 5 tables' — _3 people · 1 outlet (multi-outlet off) · 5 tables_
- a plan with no table limit says 'Unlimited tables'
- the pop-up is wide (at least 1,200 px on a 1,440 px screen — it used to be 720) — _1360px_
- …and a normal screen shows the whole plan without scrolling — _content 630px in 630px_
- Features, Visual effects and On the website stand side by side, level at the top — _[{"x":65,"y":391},{"x":621,"y":391},{"x":1014,"y":391}]_
- the limits are on one row: people, then tables — _[{"x":65,"y":344},{"x":399,"y":344}]_
- with the website's price fields opened too, it still fits without scrolling — _content 747px in 747px_

**Step 2 — A2. The tables limit goes up in fives**

- a new plan starts with 5 tables
- typing 12, 4, 54, 0, 20, 7 gives 15, 5, 55, 5, 20, 10 (rounded UP to the next five, never below 5) — _{"0":"5","4":"5","7":"10","12":"15","20":"20","54":"55"}_
- pressing Enter in the box rounds it (12 → 15) and does NOT save the plan
- ticking Unlimited beside Tables switches the number off
- …and un-ticking it brings back a number (5)

**Step 3 — A3. 'Include every feature' (this crashed before: it used a function the pop-up didn't have)**

- ticking it ticks every feature and locks the list (no crash) — _[{"on":true,"off":true},{"on":true,"off":true},{"on":true,"off":true}]_
- …and un-ticking it frees the list again

**Step 4 — A4. Custom plans have no limits of their own**

- ticking Custom hides the limits and the note says people, outlets and tables are set on each store

**Step 5 — A5. Save, and edit**

- the plan is saved with 15 tables — _15_
- its card says '15 tables'
- editing it shows 15 tables
- …and 25 is saved

**Step 6 — B. Console → the store → Plan & limits**

- the store's header shows 'Tables n / 5'
- the Tables limit says 'From plan — 5' to begin with
- choosing 'Custom number' starts from the plan's 5
- typing 12 gives 15 (rounded up to the next five)
- saved: this store now has 15 tables (the plan still says 5) — _15 / 15_
- the header now says 'Tables n / 15'
- 'From plan' takes the store back to the plan's 5

**Step 7 — C. The owner's Tables page when the plan's tables are all used**

- with 3 tables the page says '3 of 5 tables used (all outlets together)'
- …no warning, and Add table works
- adding the 4th table updates the count at once ('4 of 5 tables used')
- with 5 of 5 used, a warning says so, and that tables are added 5 at a time
- …and the Add table button is switched off
- …the page says '5 of 5 tables used'
- the server refuses a 6th table too (409)
- after a table is removed the warning goes and Add table works again
- adding the last free table brings the warning up straight away, without reloading the page

**Step 8 — D. Onboarding form: tables**

- the Tables box starts at 0 (not needed / not decided)
- the + button moves by five (0 → 5), and 5 fits Starter: no warning
- 10 tables on Starter: a red warning says what the plan allows and what the form has
- the Plan fit panel lists it as a problem to fix
- 'Add the extra tables for this client' turns it into a note (amber) and clears the problem
- typing 12 gives 15, and the note says 15 will be allowed
- stepping back down to 0 removes the warning
- 25 tables on a plan with no table limit (Pro here): no warning

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-27 16:42 | pass | 48 | 0 | headless | 9.3 s |
| 2026-11-27 09:54 | error | 44 | 0 | headless | 38.1 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t110-plan-table-limit-ui.mjs`), not this page._
