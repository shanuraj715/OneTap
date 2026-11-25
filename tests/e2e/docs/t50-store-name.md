# T50 — Store name — the dashboard's Business identity shows the STORE name, always disabled, with a note to contact the Rasoi Pulse admin; only the platform admin can rename the store (console → Stores → the store); renaming an outlet changes its display name

**Area:** settings · **Last result:** ✅ PASSED (31 passed, 0 failed · 2026-11-21 05:00 · headless · 10.6 s)

**Run it alone:** `node run.mjs --only t50` (add `--visible` to watch it)

## What this test does

Runs suites/store-name.mjs against the bench in Chrome. As the owner of Acme Momos, Settings → Business identity: the first box is 'Store name' (there is no 'Restaurant name' box any more) and shows the store's name; it is disabled and read-only, typing into it changes nothing, and a note under it says 'Contact the Rasoi Pulse admin to update the store name.'; saving Settings leaves the store name alone; the platform rename route refuses the owner and an owner can't slip a name into a settings save. As the platform admin, Console → Stores → the store has a 'Store name' card: the 'Rename store' button is off until the name changes (and for a blank name), the box is limited to 80 characters, pressing it trims the spaces and shows 'Store name changed.'; the page heading, the storefront's heading and header, and the owner's Settings all show the new name straight away (the owner's box still disabled); the server refuses an empty name and one over 80 characters; the admin viewing the store's own Settings is pointed to the console. Then, as the owner, Settings → Outlets → ✎ on an outlet and renaming it changes the outlet's name AND its display name (the one customers, receipts and messages show — what the old 'Restaurant name' box edited), leaves the STORE name alone, and the storefront's outlet picker shows it. The store and outlet names are put back.

## Steps

1. the store owner's Settings → Business identity
2. the platform admin renames the store in the console
3. renaming an outlet (Settings → Outlets)

## What to expect (these must happen)

- Settings → Business identity shows 'Store name' with the store's name, disabled and read-only, with a note to contact the Rasoi Pulse admin.
- Only the platform admin can rename the store (console store page); the new name shows on the storefront and in the owner's Settings immediately.
- Renaming an outlet in Settings → Outlets changes the outlet's display name everywhere; the store name is unchanged.

## What must NOT happen

- The store owner must NOT be able to change the store name — not in the box, not by saving Settings, not through the rename route.
- A blank or over-80-character name must NOT be saved.
- Renaming an outlet must NOT change the store's name.
- The browser must NOT log errors or warnings.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (31)

**Step 1 — the store owner's Settings → Business identity**

- the dashboard gets the store's name with the outlets — _Acme Momos_
- the first box is the STORE name, showing the store's name — _Acme Momos_
- it is called 'Store name' — there is no 'Restaurant name' box any more
- the box is disabled (greyed out)
- …and read-only
- a note under it says to contact the admin to update the store name
- typing in it is refused and the name is unchanged — _Acme Momos_
- saving Settings does not change the store's name
- the card still lays out cleanly
- the platform rename route refuses a store owner — _HTTP 403_
- an owner can't slip the store name into a settings save either

**Step 2 — the platform admin renames the store in the console**

- the console store page has a 'Store name' box with the current name — _Acme Momos_
- Rename store is off until the name is changed
- …and stays off for a blank name
- the name is limited to 80 characters
- changing it turns Rename store on
- pressing it shows 'Store name changed.'
- the store has the new name, with the spaces trimmed — _Acme Momos Renamed_
- the page heading shows the new name
- the server refuses an empty name and one over 80 characters — _400 / 400_
- …and the name is unchanged by those
- the storefront heading shows the new store name straight away
- …and so does the header
- the owner's Settings shows the new name, still disabled — _Acme Momos Renamed_
- the admin viewing the store's Settings is told where to rename it (the console)

**Step 3 — renaming an outlet (Settings → Outlets)**

- the outlet has its new name — _T50 Renamed Outlet_
- its display name (what customers, receipts and messages show) follows — _T50 Renamed Outlet_
- the STORE's name is not touched by renaming an outlet
- the storefront's outlet picker shows the new outlet name
- the store and outlet names are put back
- the browser logged no errors or warnings

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-21 05:00 | pass | 31 | 0 | headless | 10.6 s |
| 2026-11-21 00:36 | pass | 31 | 0 | headless | 9.4 s |
| 2026-11-20 12:09 | pass | 31 | 0 | headless | 15.7 s |
| 2026-11-20 06:08 | pass | 31 | 0 | headless | 11.2 s |
| 2026-11-20 05:36 | pass | 31 | 0 | headless | 9.0 s |
| 2026-11-20 05:30 | pass | 31 | 0 | headless | 9.1 s |
| 2026-11-20 05:14 | pass | 31 | 0 | headless | 9.1 s |
| 2026-11-20 05:04 | pass | 31 | 0 | headless | 9.0 s |
| 2026-11-20 04:31 | error | 7 | 0 | headless | 31.5 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t50-store-name.mjs`), not this page._
