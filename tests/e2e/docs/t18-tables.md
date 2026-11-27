# T18 — Tables — add a table (number, zone, seats), zones, limits and duplicates, QR panel, remove, per-outlet and per-store, who can manage

**Area:** tables · **Last result:** ✅ PASSED (56 passed, 0 failed · 2026-11-27 17:00 · headless · 44.0 s)

**Run it alone:** `node run.mjs --only t18` (add `--visible` to watch it) · starts from fresh fake data

## What this test does

In Chrome as the owner of Acme Momos. The Tables & QR page lists the seeded tables grouped by zone, all Free, with their seats. Adding a table with a number, zone and seats puts it in its zone (a new zone gets its own group), a table without a zone lands in 'Main' with the default 4 seats, spaces around the number are trimmed, and the form empties. A duplicate number is refused, an empty number can't be sent, a 21-character number or 51 seats are refused, 50 seats is fine. Each table's QR panel shows its zone, seats and status, a QR image, the address the code opens (…/t/<id>?k=<code>, different for every table) and a PNG that downloads; a free table can be removed and its code then stops working. Tables belong to one outlet (the same number can exist in the other outlet) and to one store (another store sees only its own). The kitchen can look but not add, rotate or remove; a role without table access sees a notice.

## Steps

1. The Tables & QR page lists the seeded tables by zone
2. Add a table: number, zone and seats
3. Duplicates and limits
4. A table's panel: QR image, address, download, rotate, remove
5. Remove a table: it disappears and its printed code stops working
6. Tables belong to one outlet, and to one store
7. Who may manage tables

## What to expect (these must happen)

- The Tables & QR page lists Ground floor (T1 4 seats, T2 2 seats, T3 6 seats) and Terrace (T4, T5 4 seats each), all 'Free'.
- Adding T9 / Rooftop / 6 seats shows a new 'Rooftop' group with 'T9 Free 6 seats' and empties the form (seats back to 4).
- A table added with no zone and no seats is in the 'Main' group with 4 seats; '  T11  ' is saved as 'T11'.
- A number already in use is refused with 'Table T9 already exists' and no second tile; an empty number is not submitted; 21 characters and 51 seats are refused, each saying which box is wrong; 0 seats is refused instead of becoming 4; 't9' is refused as the same table as 'T9'; 50 seats is accepted.
- A table's panel shows 'Rooftop · 6 seats · Free', a QR image, an address of the form /t/<24 hex>?k=<24 characters> that differs for every table, a 'Download PNG' that really downloads a PNG, 'Rotate code', 'Remove table' and a link to the card designer.
- Removing a free table makes its tile disappear and its old code say 'That table code isn't valid'.
- The other outlet starts with no tables and can have its own T1 without clashing with Main's T1.
- The other store (Beta Bites) lists only its own T1 and T2.
- The kitchen sees the tables but has no 'Add a table', no 'Rotate code' and no 'Remove table'; the manager and cashier can add tables; an accountant sees 'Your role can't view tables' and no Tables item.

## What must NOT happen

- A table number must NOT be saved twice in the same outlet.
- An empty number must NOT create a table.
- More than 50 seats, or a number over 20 characters, must NOT be accepted.
- A failed add must NOT empty the form or change the list.
- Tables of one store or outlet must NOT show in another.
- A role that can only look at tables must NOT be offered adding, rotating or removing.
- The browser must NOT log JavaScript errors.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (56)

**Step 1 — The Tables & QR page lists the seeded tables by zone**

- five tables: T1, T2, T3, T4, T5, all Free — _T1 Free 4 seats \| T2 Free 2 seats \| T3 Free 6 seats \| T4 Free 4 seats \| T5 Free 4 seats_
- seats are shown on each (4, 2, 6, 4, 4)
- they are grouped by zone: Ground floor (T1–T3) and Terrace (T4, T5)
- the page has the 'Tables & QR' and 'Table cards' tabs and an 'Add a table' form with Number, Zone, Seats (4 by default)

**Step 2 — Add a table: number, zone and seats**

- T9 appears as 'T9 Free 6 seats' — _T9 Free 6 seats_
- a new 'Rooftop' group holds it
- the other tables are unchanged (six in all) — _T1,T2,T3,T9,T4,T5_
- the form is emptied after a successful add (Number and Zone empty, Seats back to 4)
- a table with no zone and no seats typed is saved with the default 4 seats — _T10 Free 4 seats_
- …and sits in the 'Main' group
- spaces around a number are trimmed ('  T11  ' → T11)
- T11 joins the Rooftop group

**Step 3 — Duplicates and limits**

- a number already in use is refused: 'Table T9 already exists'
- did not happen: a second T9 was added
- a refused add leaves what was typed in the form (nothing is lost)
- did not happen: an empty number created a table
- the browser asks for the number ('Please fill out this field')
- a number of 21 characters is refused, and says why: 'The table number can be at most 20 characters.' — _The table number can be at most 20 characters._
- did not happen: the 21-character number was saved
- 51 seats is refused, and says why: 'A table can have at most 50 seats.'
- 50 seats is accepted — _BIG Free 50 seats_
- did not happen: a refused table says only 'Validation failed'
- 0 seats is refused out loud ('Seats must be a whole number, at least 1'), not turned into 4
- did not happen: Z0 was saved with a made-up 4 seats
- 't9' is the same table as 'T9': refused with 'Table T9 already exists — table numbers don't care about capital letters' — _Table T9 already exists — table numbers don't care about capital letters, so _

**Step 4 — A table's panel: QR image, address, download, rotate, remove**

- the panel says 'Table T9' and 'Rooftop · 6 seats · Free' — _Table T9 Rooftop · 6 seats · Free http://localhost:3170/t/6b0969a70293f2d05965e2_
- it shows a QR image (a real 512-pixel picture, labelled for screen readers)
- the address printed under it is /t/<id>?k=<code> on the store's own site — _http://localhost:3170/t/6b0969a70293f2d05965e212?k=aTZK6qpFdfjY76Dqa-_o5PoO_
- 'Download PNG' is named table-T9-qr.png
- …and the file that downloads is a real PNG
- 'Rotate code', 'Remove table', 'Done' and the link to the card designer are there
- every table has its own address and its own code
- 'Design a printable card' opens the Table cards page

**Step 5 — Remove a table: it disappears and its printed code stops working**

- before removing, T11's code opens its page (the storefront says 'Ordering to Table T11')
- the panel closes and T11 is gone from the page
- the other tables are still there
- the removed table's code now says 'That table code isn't valid' — _This code didn't work That table code isn't valid_
- did not happen: a removed table's code still opens the menu

**Step 6 — Tables belong to one outlet, and to one store**

- the other outlet, Second, starts with no tables
- it can have its own T1 (the same number as Main's) — _T1 Free 8 seats_
- …with a different code from Main's T1
- did not happen: Second shows any of Main's tables
- back on Main, nothing changed: the same tables, T1 still 4 seats — _8 tables_
- another store (Beta Bites) lists only its own tables: T1 and T2 — _T1,T2_
- did not happen: another store sees Acme's tables (T3, T9, T10…)
- …and its T1 has a code of its own

**Step 7 — Who may manage tables**

- the kitchen sees the tables (T1, T2, T3 …)
- did not happen: the kitchen is offered 'Add a table'
- …can open a table's QR and download it
- did not happen: the kitchen is offered Rotate code or Remove table
- the manager can add a table
- the cashier can add a table
- did not happen: an accountant has a Tables item in the sidebar
- an accountant opening /tables is told 'Your role can't view tables.'
- did not happen: an accountant sees tables or the add form
- did not happen: the browser logged JavaScript errors

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-27 17:00 | pass | 56 | 0 | headless | 44.0 s |
| 2026-11-27 16:12 | pass | 56 | 0 | headless | 42.8 s |
| 2026-11-27 09:55 | pass | 56 | 0 | headless | 43.4 s |
| 2026-11-21 04:43 | pass | 54 | 0 | headless | 44.7 s |
| 2026-11-21 04:18 | pass | 54 | 0 | headless | 42.4 s |
| 2026-11-21 03:20 | pass | 54 | 0 | headless | 42.5 s |
| 2026-11-21 00:31 | pass | 54 | 0 | headless | 43.5 s |
| 2026-11-20 11:07 | pass | 54 | 0 | headless | 43.2 s |
| 2026-11-20 05:50 | pass | 54 | 0 | headless | 43.9 s |
| 2026-11-20 04:47 | pass | 54 | 0 | headless | 44.0 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t18-tables.mjs`), not this page._
