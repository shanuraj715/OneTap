# T92 — Dashboard: an order put back from Completed seats its table again (or asks which free table); Users & roles gives team members outlets

**Area:** orders · **Last result:** ✅ PASSED (52 passed, 0 failed · 2026-11-27 10:02 · headless · 7.7 s)

**Run it alone:** `node run.mjs --only t92` (add `--visible` to watch it)

## What this test does

Runs suites/dashboard-reopen-outlets-ui.mjs in Chrome against the bench. Orders: a completed, paid order at T2 is put back to Preparing from its 'Set status manually' menu — the page says 'Table T2 is seated again', T2 shows seated, no pop-up. With another party at T1, putting the first party's order back shows a pop-up that names the problem, lists the FREE tables grouped by area with their seats (the taken table is not offered), keeps the confirm button off until one is picked and changes nothing meanwhile; choosing T3 seats the party there and the order goes to Preparing; 'Leave the order as it is' changes nothing. Users & roles: a store with several outlets asks which outlets a new person works in (Add user is off until one is chosen), lists them with their outlets, saves exactly what was ticked; the mapped person's own dashboard shows nothing of the other outlet, their outlet list has just theirs and another outlet is refused (403); 'Change outlets' → All outlets takes effect at once without signing in again.

## Steps

1. An order put back from Completed: its table is seated again
2. Somebody else is at the table: the operator picks another
3. 'Leave the order as it is'
4. Users & roles: giving a new person outlets
5. 4b. The outlet picker: a dropdown with search
6. The mapped person sees only their outlet
7. Changing a person's outlets later

## What to expect (these must happen)

- With the table free, putting the order back seats it again and says so; with someone else there the operator picks a free table from a pop-up.
- A new person must be given outlets (or All outlets); the list shows them; changing them takes effect at once.
- A mapped person sees nothing of other outlets.

## What must NOT happen

- The pop-up must NOT offer the taken table, and must NOT change anything before a table is chosen.
- Add user must NOT work with no outlet chosen in a multi-outlet store.
- No errors in the browser.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (52)

**Step 1 — An order put back from Completed: its table is seated again**

- T2 is free after the order was completed and paid
- the page says 'Table T2 is seated again'
- T2 shows SEATED (it used to stay free) — _seated_
- no pop-up was needed — the table was free

**Step 2 — Somebody else is at the table: the operator picks another**

- another party sits at T1 — _0003_
- a pop-up explains that T1 has another party
- it offers free tables (T3 yes) and not the taken T1
- the tables are grouped by area — _Ground floor \| Terrace_
- each shows its number and its seats
- the confirm button is off until a table is chosen
- NOTHING changed yet — the order is still Completed
- choosing T3 marks it
- the pop-up closes
- T3 is seated with the first party; the other party keeps T1
- the order is back to Preparing
- the page says it is a different table than before

**Step 3 — 'Leave the order as it is'**

- cancelling the pop-up leaves the order Completed

**Step 4 — Users & roles: giving a new person outlets**

- the bench store has more than one outlet — _Main, Second_
- the form asks which outlets (the store has several)
- Add user is off until an outlet is chosen
- and says why

**Step 5 — 4b. The outlet picker: a dropdown with search**

- the closed outlet box is the same height as the Role select beside it, and no taller than the text boxes — _{"select":32,"input":35,"trigger":32}_
- closed, the box says 'Choose outlets' (nothing is picked yet)
- …and there is no list of checkboxes sitting in the form any more
- clicking opens the panel and puts the cursor in the search box
- it lists an 'All outlets' row and one row for each outlet of this store — _3 rows for 2 outlets_
- the footer counts what is picked: 0 of N
- typing "SEC" keeps only outlets that match, whatever the capital letters — _Second_
- …and hides the 'All outlets' row while searching
- a search with no match says 'No outlet matches …'
- Enter in the search box ticks the first match — _Second_
- clearing the search brings every outlet back
- the footer now says 1 selected
- Clear unticks everything
- 'All outlets' shows every outlet ticked and locked
- the closed box shows an 'All outlets' chip and the warning is gone
- ArrowDown in the search box moves to the first checkbox
- Escape closes the panel and the box has the focus again
- with two outlets picked (chips) the box is still the same height as the other fields
- two picked: the closed box shows both names as chips; a click outside closes the panel — _Main Second_
- and Add user is on
- unticking one and pressing Done leaves just the other
- choosing one outlet turns Add user on
- the new person is listed with their outlet only — _Outlets: Main · Change outlets_
- saved: exactly the ticked outlet — _["6b0907869f95f01848e3f632"]_

**Step 6 — The mapped person sees only their outlet**

- nothing of "Second" is on their dashboard
- the outlet list they get has just their outlet — _Main_
- another outlet is refused outright (403) — _403_

**Step 7 — Changing a person's outlets later**

- the dialog's picker opens with the person's current outlet already ticked
- after choosing All outlets the row says All outlets — _All outlets · Change outlets_
- and they see every outlet now — without signing in again — _2_
- no errors in the browser

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-27 10:02 | pass | 52 | 0 | headless | 7.7 s |
| 2026-11-27 09:59 | fail | 51 | 1 | headless | 7.7 s |
| 2026-11-26 17:49 | pass | 30 | 0 | headless | 7.5 s |
| 2026-11-26 17:48 | error | 18 | 0 | headless | 7.2 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t92-dashboard-reopen-outlets-ui.mjs`), not this page._
