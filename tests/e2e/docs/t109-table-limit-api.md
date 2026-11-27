# T109 — Plans limit tables, in steps of 5 (Starter 5, Business 20, Custom by hand): only 5, 10, 15 … are accepted, a store can't add a table past its limit, and the price is per block of 5

**Area:** platform · **Last result:** ✅ PASSED (63 passed, 0 failed · 2026-11-27 21:03 · headless · 6.2 s)

**Run it alone:** `node run.mjs --only t109` (add `--visible` to watch it)

## What this test does

Runs suites/table-limit-api.mjs against a private API on an in-memory database. The rules: a limit of 5, 10, 15 … is accepted, while 12, 19, 54, 7, 4, 0, 2.5 and -5 are refused with a plain message; no limit means unlimited (every plan made before this keeps working); 12 tables are 3 blocks of five and round UP to 15; the presets are Starter 5 and Business 20. Through the console API: a plan with 12 tables is refused (400), 10 is created and can be edited to 15 but not 19, a plan can still be unlimited, a Custom plan stores no limit of its own. A store on a 5-table plan: its owner adds five tables across two outlets, the sixth is refused at either outlet with a message that says what the plan allows and that tables are added 5 at a time, nothing is created by the refused requests, the store's plan answer and the console show 5 of 5, a full limit is not an 'over limit' problem; deleting a table frees its place at once, switching a table off does not. Raising the limit for one store (12 refused, 10 accepted) is seen immediately; the platform's own admin can go past the limit; a store with MORE tables than its limit keeps them all, can't add one and is NOT put into the over-limit grace period. Stores that existed before the limit (no plan, or a plan saved without it) stay unlimited. Custom plan: a store with 8 tables gets a limit of 10, one with none gets 5, a number set by hand is kept. The onboarding form: Starter with 12 tables raises a plain issue that blocks publishing until 'add for this client', which publishes the store with 15; Business allows 20 not 25; 0 tables never raises an issue; Custom publishes with what was asked rounded up; a form saved before tables existed opens fine; the overrides really give a Starter store 15 tables. The price: ₹100 for every 5 tables beyond the plan (12 charged as 15, the Price list page's number is used), Custom starts from the dearest plan and charges the blocks beyond it, 'what else would do' and 'do the prices add up' count tables.

## Steps

1. The rules: only 5, 10, 15 …
2. Plans through the console's API
3. A store with a 5-table plan
4. Raising the limit for one store, and the platform's own door
5. Stores that existed before the limit
6. The Custom plan
7. The onboarding form: plan fit
8. The price: per block of 5 tables

## What to expect (these must happen)

- Only 5, 10, 15 … are accepted as a table limit; 12, 19, 54 are refused with a clear message.
- A store can't add a table past its plan's limit, and the message says so; removing a table frees the place at once.
- Stores and plans that existed before the limit stay unlimited.
- The price is per block of 5 tables beyond the plan.

## What must NOT happen

- A refused request must NOT create a table.
- A store with more tables than its limit must NOT lose a table or be put into the over-limit grace period.
- A plan saved before tables had a limit must NOT suddenly cap a store.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (63)

**Step 1 — The rules: only 5, 10, 15 …**

- tables are sold in blocks of 5
- 5, 10, 15, 20 and 100 are accepted
- 12, 19, 54, 7, 4, 0, 2.5 and -5 are refused
- …with a plain message ("Tables go up in fives…", "at least 5") — _Tables go up in fives: 5, 10, 15, 20 … \| A plan has at least 5 tables._
- no limit (null / not given) means unlimited — how every plan made before this behaves
- 12 tables are 3 blocks of five
- a store's size rounds UP to the next five (12 → 15, 21 → 25, never below 5)
- tableLimit: Infinity when unlimited
- a plan saved before tables had a limit resolves to unlimited (nothing is cut off)
- a Custom plan has no limit of its own; the store's own number is the limit
- a store's own table limit follows the same rule (12 refused, 15 accepted)
- the shared presets: Starter 5 tables, Business 20

**Step 2 — Plans through the console's API**

- a plan with 12 tables is refused (400) — and the answer says why — _400 Tables go up in fives: 5, 10, 15, 20 …_
- a plan with 10 tables is created — _201 10_
- …and raised to 15
- editing it to 19 is refused and the plan keeps 15
- a plan can still have no table limit (unlimited)
- a Custom plan stores no limit of its own
- the list of plans shows the limit

**Step 3 — A store with a 5-table plan**

- the owner adds five tables, three at one outlet and two at the other — _201,201,201,201,201_
- a sixth table is refused at either outlet (the limit is for the whole store) — _409/409_
- …and the message says what the plan allows and that tables are added 5 at a time
- nothing was created by the refused requests
- the store's plan answer shows 5 of 5 tables in use — _[{"users":1,"outlets":2,"tables":5},{"users":5,"outlets":3,"tables":5}]_
- the console shows the same, and a full table limit is not an 'over limit' problem — _5/5 ok_
- a table is removed — _204_
- …and the room it leaves can be used again at once (the count is read fresh, not remembered) — _201_
- switching a table off doesn't free its place (it still counts); only removing it does
- removing a table keeps everything else remembered about the store (its menu etc.) — only the plan answer is renewed — _menu,outlet,outletaccess,outletaccess,plan → menu,outlet,outletaccess,outletaccess_
- …and the plan answer WAS dropped, so 'tables in use' is right at once

**Step 4 — Raising the limit for one store, and the platform's own door**

- a store's own limit of 12 is refused (fives only) — _400_
- …10 is accepted for this store
- the owner can add a sixth table straight away (the new limit is seen at once) — _201_
- the platform's own admin can add tables beyond the limit — _201/201 count 8_
- a store that has MORE than its limit keeps every table but can't add one — _409 8/5_
- …and it is NOT put into the 'over its limits' grace period (tables can't be blocked like outlets and people) — _ok over=false_
- no table was removed or switched off

**Step 5 — Stores that existed before the limit**

- a store with no plan at all can still add as many tables as it likes (7 here)
- …and so can a store on a plan saved before tables had a limit

**Step 6 — The Custom plan**

- a store with 8 tables put on Custom gets a limit that holds them, in fives (8 → 10) — _10_
- …so it has room for two more and then stops — even when three are added at the very same moment — _201,409,201_
- …and exactly 10 tables exist afterwards (the one that didn't fit was taken back out)
- a store with no tables put on Custom starts at 5 (the smallest size) — _5_
- …and the number set by hand is kept (15)

**Step 7 — The onboarding form: plan fit**

- Starter with 5 tables: fine, nothing to add
- Starter with 12 tables: an issue in plain words, and it blocks publishing
- …'add for this client' lets it through, and the store is published with 15 tables (12 rounded up to the next five) — _15_
- Business allows 20 tables, not 25
- '0 tables' (takeaway only, or not decided) never raises an issue
- Custom: the store gets what was asked for, rounded up to fives (12 → 15) even when the typed limit was lower — _15_
- Custom: the limit typed for the client (30) is what the store is published with
- a form saved before tables existed opens fine (0 tables; Custom starts at 5)
- applying those overrides to a Starter store gives it 15 tables — _200 15_

**Step 8 — The price: per block of 5 tables**

- the price list starts with ₹100 for every 5 extra tables
- Starter with 5 tables: just the plan's price (₹799) — _799_
- Starter with 15 tables: two more blocks of 5 × ₹100 = ₹200 on top (₹999) — _200 999_
- 12 tables are charged as 15: the price is always by the block of 5 — _200_
- the price per block is the one on the Price list page (₹150 → ₹300) — _300_
- Business with 25 tables: one block of 5 beyond its 20 (₹2,599) — _100 2599_
- Custom starts from the dearest plan (20 tables) and charges the blocks beyond it (30 → ₹200) — _200 \| Business plan — every feature, up to 3 outlets, 20 tables and 20 people_
- Custom with 10 tables is inside what the dearest plan already has — nothing added
- 'what else would do' knows tables: 15 tables don't fit Starter but fit Business — _Business_
- the 'do the prices add up' page counts the 15 extra tables a plan adds (3 blocks) — _tables 15, rate card 1975_

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-27 21:03 | pass | 63 | 0 | headless | 6.2 s |
| 2026-11-27 16:42 | pass | 63 | 0 | headless | 7.7 s |
| 2026-11-27 10:00 | pass | 63 | 0 | headless | 5.2 s |
| 2026-11-27 09:53 | pass | 61 | 0 | headless | 5.1 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t109-table-limit-api.mjs`), not this page._
