# T46 — Add-on groups — the list is multi-column (dish editor and the groups list) and a group can be edited after creation (name, option names and prices, add/remove options)

**Area:** menu · **Last result:** ✅ PASSED (50 passed, 0 failed · 2026-11-21 00:36 · headless · 16.7 s)

**Run it alone:** `node run.mjs --only t46` (add `--visible` to watch it)

## What this test does

Through the bench API it makes ~16 groups called 'T46 …' (a four-option dip group, a pick-one group, a required group, a 2-option group that is grown, a one-option group, and a dozen fillers). In Chrome as the owner of Acme Momos: (1) Menu → Veg Steamed Momos → Edit — the 'Add-on groups' tick-list runs across several columns (not one long column), nothing crosses the box's edge, stays inside the window on a phone width, says '1 option' / '4 options', and ticking two groups then saving attaches them to the dish. (2) The Add-on groups card at the bottom of the Menu page also lists the groups in columns. (3) ✎ on 'T46 Dips' opens an editor across the full width showing the name and its four options with their prices; rename it, change a price, rename an option, remove one, add one, Save — the group (same id) has the new name, the right options and prices, the options that were kept still have their ORIGINAL ids, the new one has a fresh id, the dish still has the group, and the list shows the new text. (4) Mistakes are refused with a message and change nothing: empty name, empty option name, negative price, no options at all; Cancel discards typing. (5) Rules stay right: a pick-one group stays pick-one after an option is added; a 'required, choose 1' group stays required after a rename; an 'any number' group keeps allowing any number as options are added and removed (down to one). (6) On the storefront the dish's pop-up shows the renamed group and the new prices, not the removed option. Everything made is deleted and the dish's own add-on groups are put back.

## Steps

1. The dish editor's Add-on groups list runs across several columns
2. Ticking groups and saving still attaches them
3. The groups list at the bottom of the Menu page is multi-column too
4. Editing a group: rename it, change a price, rename an option, remove one, add one
5. Mistakes are refused and change nothing; Cancel discards
6. Rules stay right after an edit
7. The storefront shows the edited group

## What to expect (these must happen)

- The dish editor's Add-on groups list uses several columns, stays inside its box and the window, and says '1 option' for one.
- The groups list under the menu is multi-column too.
- Every group has an edit (✎) button; the editor shows the group's name and options with prices and spans the full width.
- After Save the group has the new name, options and prices; kept options keep their ids, a new one gets a new id; items that use the group still do.
- Empty name / empty option name / negative price / no options are refused with a message and nothing is saved; Cancel discards.
- Pick-one stays pick-one, required stays required, 'any number' follows the number of options.
- The storefront pop-up shows the edited group.

## What must NOT happen

- An edit must NOT change the group's id or the ids of options that were kept.
- A refused save must NOT change the group.
- Editing must NOT detach the group from the dishes that use it.
- The tick-list must NOT be one long column on a wide screen.
- The browser must NOT log JavaScript errors.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (50)

**Step 1 — The dish editor's Add-on groups list runs across several columns**

- every group is listed — _16 of 16_
- the list uses several columns on a wide screen — _3 columns, 6 rows, 16 groups_
- did not happen: the list is one long column on a wide screen
- nothing crosses the edge of its box — _0 crossing_
- one option reads '1 option' — _T46 One 1 option_
- four options read '4 options'
- on a phone-width window the list stays inside its box and the window — _1 column(s), crossing 0, sideways false_

**Step 2 — Ticking groups and saving still attaches them**

- the dish now has both ticked groups — _2 groups_

**Step 3 — The groups list at the bottom of the Menu page is multi-column too**

- every group has a row — _16 of 16_
- the rows run across several columns — _3 columns, 6 rows_
- each row has an edit button — _16 buttons_

**Step 4 — Editing a group: rename it, change a price, rename an option, remove one, add one**

- the editor spans the full width of the list — _1110 of 1110_
- it shows the group's name
- it shows the four options with their prices — _[["Mint Dip","10"],["Cheese Dip","30"],["Mayo","15"],["Schezwan","20"]]_
- it says any number can be picked
- removing a row takes it out of the editor
- the editor closes after saving
- the group has the new name
- it is the same group (same id)
- it has the four options in the new order — _["Mint Dip","Cheese Dip","Mayonnaise","Garlic Dip"]_
- the prices are right (₹10, ₹35, ₹15, ₹25) — _[1000,3500,1500,2500]_
- did not happen: a kept option got a different id
- the new option has an id of its own
- it still allows any number to be picked (max follows the 4 options) — _0–4_
- did not happen: editing detached the group from the dish
- the list shows the new name and options — _T46 Dips & Sauces Mint Dip +₹10 · Cheese Dip +₹35 · Mayonnaise +₹15 · Garlic Dip +₹25 ✎ ×_

**Step 5 — Mistakes are refused and change nothing; Cancel discards**

- an empty name is refused with a message
- …and the editor stays open
- an option without a name is refused
- a negative price is refused
- all options can be taken out of the editor…
- …but a group with no options is refused
- did not happen: a refused save changed the group
- Cancel closes the editor
- …and the typing is gone
- did not happen: Cancel changed the group

**Step 6 — Rules stay right after an edit**

- a pick-one group says so — _Choose up to 1. Items that use this group keep using it._
- a third option was added — _["Mild","Medium","Hot"]_
- a pick-one group is still pick-one — _max 1_
- a required group says 'Required · choose 1' — _Required · choose 1. Items that use this group keep using it._
- it was renamed and is still required, choose 1 — _{"r":true,"min":1,"max":1}_
- it is still on the dish
- an any-number group allows any number of its four options — _4 options, max 4_
- taken down to one option it allows exactly one pick — _1 option, 0–1_
- the original last option kept its id

**Step 7 — The storefront shows the edited group**

- the pop-up shows the renamed group
- …with the new prices and options
- did not happen: the removed option is still offered
- did not happen: the old group name is still shown
- everything the test made was removed — _0 left_

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-21 00:36 | pass | 50 | 0 | headless | 16.7 s |
| 2026-11-20 16:12 | pass | 50 | 0 | headless | 16.4 s |
| 2026-11-20 11:15 | pass | 50 | 0 | headless | 17.6 s |
| 2026-11-20 06:05 | pass | 50 | 0 | headless | 17.9 s |
| 2026-11-20 05:02 | pass | 50 | 0 | headless | 16.7 s |
| 2026-11-20 02:15 | pass | 50 | 0 | headless | 16.6 s |
| 2026-11-20 02:13 | pass | 50 | 0 | headless | 17.3 s |
| 2026-11-20 02:12 | fail | 48 | 2 | headless | 1 min 2 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t46-addon-groups.mjs`), not this page._
