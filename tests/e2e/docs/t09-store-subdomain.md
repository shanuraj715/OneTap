# T09 — Store subdomain — remove, create lifecycle.<base>, open every outlet on it, unknown addresses, rename

**Area:** domains · **Last result:** ✅ PASSED (36 passed, 0 failed · 2026-11-19 01:05 · headless · 33.0 s)

**Run it alone:** `node run.mjs --only t09` (add `--visible` to watch it)

## What this test does

Continues from t08, in Chrome. The platform removes the store's TablePe address (the customer then gets 'couldn't find a restaurant here'), tries names in the Domains tab (reserved, too short, bad characters, taken by another store, free), creates the address, and a customer's browser then opens the store's root and each outlet on it — each showing its own details and menu. A made-up outlet, a made-up subdomain and another store's outlet are all 'not found'. Renaming the address moves the store and the old address stops working.

## Steps

1. Before: the store has an address — then the platform removes it
2. In the Domains tab: which names may the store have?
3. Create the address, then a customer opens the store on it
4. Rename the address: the new one works, the old one stops

## What to expect (these must happen)

- With no TablePe address the store can't be opened on lifecycle.<base> ('We couldn't find a restaurant here').
- A free name shows 'is free'; reserved names (www, admin…), names under 3 characters, bad characters and names used by another store show a reason.
- After 'Create address', the root page and /central, /second and /third open; each outlet shows its own name and menu.
- Renaming makes the new address work and the old one stop working; renaming back restores it.

## What must NOT happen

- A reserved, malformed or already-used name must NOT be offered as free.
- An outlet that doesn't exist on the subdomain must NOT show a menu (it is a 'not found' page).
- A subdomain nobody owns must NOT render any store.
- Another store's outlet (Beta's /only) must NOT open on this store's address.
- One outlet's page must NOT show another outlet's menu items.
- The browser must NOT log JavaScript errors.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (36)

**Step 1 — Before: the store has an address — then the platform removes it**

- the store opens on its address — _HTTP 200_
- did not happen: the store still opens after its address was removed
- …the customer sees 'We couldn't find a restaurant here'

**Step 2 — In the Domains tab: which names may the store have?**

- did not happen: "www" (a reserved name) is offered as free
- …and the form says why for "www" — _kept for TablePe_
- did not happen: "admin" (a reserved name) is offered as free
- …and the form says why for "admin" — _kept for TablePe_
- did not happen: "ab" (too short) is offered as free
- …and the form says why for "ab" — _at least 3 characters_
- did not happen: "Bad_Name" (bad characters) is offered as free
- …and the form says why for "Bad_Name" — _Lowercase letters, numbers and hyphens_
- did not happen: "beta" (used by another store) is offered as free
- …and the form says why for "beta" — _already used by another store_
- "lifecycle" shows as free: lifecycle.localhost:3170 is free

**Step 3 — Create the address, then a customer opens the store on it**

- the platform creates lifecycle.localhost:3170 — _localhost:3170 Live — it opens Check again Change the _
- the address itself opens and lists every outlet to choose from — _HTTP 200_
- /central opens and shows Lifecycle Central — _HTTP 200_
- /central shows its own menu (Veg Burger, Chicken Burger)
- did not happen: /central shows another outlet's menu items
- /second opens and shows Lifecycle Second — _HTTP 200_
- /second shows its own menu (Margherita Pizza, Farmhouse Pizza)
- did not happen: /second shows another outlet's menu items
- /third opens and shows Lifecycle Third — _HTTP 200_
- /third shows its own menu (Paneer Roll, Egg Roll)
- did not happen: /third shows another outlet's menu items
- did not happen: an outlet that doesn't exist shows a menu
- …it says it couldn't find that page — _We couldn’t find that page The link may be old or have a typing mistake. Go to the menu_
- did not happen: another store's outlet (Beta's /only) opens on this store's address
- did not happen: a subdomain nobody owns shows a store
- …it says it couldn't find a restaurant there

**Step 4 — Rename the address: the new one works, the old one stops**

- renamed to lifecycle-two
- the new address opens the outlet — _HTTP 200_
- did not happen: the old address still opens the store
- set back to lifecycle.localhost:3170 for the next tests
- …and it opens again
- did not happen: the browser logged JavaScript errors

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-19 01:05 | pass | 36 | 0 | headless | 33.0 s |
| 2026-11-18 17:34 | pass | 36 | 0 | headless | 34.4 s |
| 2026-11-18 17:04 | pass | 36 | 0 | headless | 33.9 s |
| 2026-11-18 14:59 | pass | 36 | 0 | headless | 34.0 s |
| 2026-11-18 14:24 | pass | 36 | 0 | headless | 33.9 s |
| 2026-11-16 03:10 | pass | 36 | 0 | headless | 33.2 s |
| 2026-11-16 02:20 | pass | 36 | 0 | headless | 33.2 s |
| 2026-11-16 02:02 | pass | 36 | 0 | headless | 33.1 s |
| 2026-11-16 01:44 | pass | 36 | 0 | headless | 32.8 s |
| 2026-11-16 00:58 | pass | 36 | 0 | headless | 33.0 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t09-store-subdomain.mjs`), not this page._
