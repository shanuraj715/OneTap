# T70 — Cache page — Admin Panel Cache and Store Cache (stores → a store → its outlets), and every Expire says what it will drop first

**Area:** platform · **Last result:** ✅ PASSED (34 passed, 0 failed · 2026-11-27 20:45 · headless · 3.4 s)

**Run it alone:** `node run.mjs --only t70` (add `--visible` to watch it)

## What this test does

Runs suites/cache-console-ui.mjs in Chrome as the platform super admin on the bench. Platform → Cache has two groups: 'Admin Panel Cache' (the items that belong to no store — listed, with its own Expire button) and 'Store Cache', folded away until opened; opened, it lists the stores that have something remembered, none of them open; picking a store opens ITS outlets only (one group per outlet, its own items listed in words, Menu among them) and a 'The whole store' group for the store's look, plan and addresses. Every Expire (this outlet, this store, the admin panel, everything) opens a window saying what will expire (the real list, grouped, with the count — equal to the number the server then reports), what stays and what happens next; Cancel expires nothing; confirming clears exactly that and reports the same number. An outlet's expiry leaves the store's own items and every other store alone; a store's expiry leaves other stores alone. Platform settings → Cache no longer has Expire buttons (it points to the Cache page); the store's own Cache tab asks with the same window.

## Steps

1. Two groups, the stores folded away
2. Store Cache → stores → a store → its outlets
3. Every Expire says first what it will drop
4. A whole store, the admin panel, everything
5. The other places

## What to expect (these must happen)

- The cache is grouped Admin Panel Cache / Store Cache → stores → a store → its outlets, folded until opened.
- Every Expire shows what it will drop (count and kinds), what stays and what happens next, before anything is dropped.
- The number in the window is the number cleared; a narrower expiry leaves everything outside it alone.

## What must NOT happen

- Expiring one outlet must NOT drop the store's own items or another store's.
- Expiring one store must NOT clear another's cache.
- Cancel must NOT expire anything.
- No errors in the browser.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (34)

**Step 1 — Two groups, the stores folded away**

- there is an 'Admin Panel Cache' group
- …and a 'Store Cache' group
- the stores are folded away until Store Cache is opened (the page is not a wall of tables)
- …the Store Cache header says it is collapsed (aria-expanded=false)
- …and says how many stores and items are inside — _Store Cache 3 stores · 10 items · 24 KB — open it to pick a store_
- Admin Panel Cache lists exactly the items that belong to no store — _1 items_
- …with its own Expire button, and one 'Expire everything' at the top

**Step 2 — Store Cache → stores → a store → its outlets**

- opening it lists the stores that have something remembered
- …none of them is open yet (no outlets shown until a store is picked)
- picking a store opens ITS outlets only (Beta Bites stays closed)
- one group per outlet that has something remembered — _Main_
- an outlet's group lists its own items (its Menu among them)
- items that are not an outlet's (look, plan, addresses) are shown apart as 'The whole store' — _1 items_

**Step 3 — Every Expire says first what it will drop**

- the outlet's dialog names the outlet — _Main_
- …the number of items in it is exactly the number listed for that outlet — _4 items · 19 KB_
- …it lists what they are, in words (Menu …)
- …and has the three parts: what will expire, what stays, what happens next
- …it says the store's look, plan and addresses stay
- Cancel expires nothing
- confirming says how many were cleared — the same number the dialog showed — _Main (Acme Momos): 4 items cleared. The next visit loads fresh data._
- that outlet's items are gone from the server
- …the store's own items stayed
- …and Beta Bites kept what it had

**Step 4 — A whole store, the admin panel, everything**

- the store's dialog counts ALL of the store's items (its outlets' and its own) — _3 items_
- confirming clears Acme Momos
- …and not one item of Beta Bites — _4 kept_
- the admin panel's dialog counts exactly the items that belong to no store — _1 item · 4.1 KB_
- …and says no store is touched
- 'Expire everything' counts everything that is listed — _7 items_
- …and says people stay signed in

**Step 5 — The other places**

- Platform settings → Cache has no Expire buttons any more (one place to expire: the Cache page)
- …it points to the Cache page instead
- the store's own page asks too (it shows the same 'what will expire' window before clearing)
- no errors in the browser

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-27 20:45 | pass | 34 | 0 | headless | 3.4 s |
| 2026-11-27 20:30 | pass | 34 | 0 | headless | 3.9 s |
| 2026-11-27 20:29 | fail | 33 | 1 | headless | 4.2 s |
| 2026-11-27 20:28 | error | 19 | 0 | headless | 12.7 s |
| 2026-11-27 20:28 | error | 19 | 0 | headless | 12.5 s |
| 2026-11-27 20:28 | fail | 18 | 1 | headless | 13.1 s |
| 2026-11-21 13:05 | pass | 12 | 0 | headless | 1.9 s |
| 2026-11-21 13:01 | error | 10 | 0 | headless | 31.8 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t70-cache-console-ui.mjs`), not this page._
