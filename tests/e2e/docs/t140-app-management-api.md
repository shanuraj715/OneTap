# T140 — App Management: the platform admin adds an app (a name is enough), edits its words, makes it public or private, uploads its versions and removes it; built-in apps can't be removed; nothing is hard-coded in the console

**Area:** app · **Last result:** ✅ PASSED (69 passed, 0 failed · 2026-11-28 14:24 · headless · 4.1 s)

**Run it alone:** `node run.mjs --only t140` (add `--visible` to watch it)

## What this test does

Runs suites/app-management-api.mjs on a private API with an in-memory database (no browser). The five built-in apps (Staff, Kitchen, Rider, Admin, Business) are rows in the apps collection, in order; Business and Admin start private. Only the platform admin may add, edit, remove or switch Public/Private. Adding an app with just a name makes its address and its icon code; it starts private, its page opens by link, it is not in the website's list. Bad names, addresses and codes (empty, too short/long, capitals, spaces, hyphens at the ends, an address a built-in app already has, the same address twice) are refused with a clear sentence and leave nothing behind. An edit changes the words at once and ignores a new address / 'built in' / 'public'. Public/Private moves the app in and out of the website's list. Versions can be uploaded, published and downloaded for the new app (named after it) and do not touch other apps; its refresh interval is told in x-refresh-seconds; any account may sign in from it while the Kitchen app still turns a waiter away. An app with versions can't be removed, a built-in app can't be removed, and after its versions are deleted the app can be removed and its address used again. An older database (only the old Public/Private + refresh numbers) is migrated: the choices are carried over.

## Steps

1. The built-in apps are rows in the database, in a fixed order
2. Only the platform admin adds, edits, removes
3. Add an app with just a name
4. Wrong details are refused with a clear sentence
5. Change an app's words — never its address
6. Public / private
7. Versions of an app that was added in the console
8. Refresh interval is per app, also for the new one
9. Signing in from an app that was added in the console
10. Removing an app
11. An older database: what was chosen before apps became data is kept

## What to expect (these must happen)

- A new app has an address and a code made from its name, starts private and opens by its link.
- Public/Private moves an app in and out of the website's list; the words an admin changes show at once.
- An older database keeps what was chosen (Business public, Rider private, refresh seconds).

## What must NOT happen

- A built-in app, or an app that still has versions, must NOT be removed.
- A bad or repeated address must NOT create an app.
- A store owner or a waiter must NOT add, change or remove an app.
- An edit must NOT change an app's address.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (69)

**Step 1 — The built-in apps are rows in the database, in a fixed order**

- the console lists the five built-in apps in order — _oma,kda,rda,admin,business_
- …each marked as built in
- …and they were written to the apps collection (so the console owns them from now on)
- Business and Admin start PRIVATE: not in the website's list
- …while Staff, Kitchen and Rider are public — _oma,kda,rda_

**Step 2 — Only the platform admin adds, edits, removes**

- a store owner cannot add an app — _403_
- a waiter cannot add an app — _403_
- nobody signed in cannot add an app — _401_
- …nor change one
- …nor remove one

**Step 3 — Add an app with just a name**

- the address is made from the name — _rasoi-pulse-pos_
- …and so is the code on its icon (capitals of the words) — _RPP_
- it starts PRIVATE and is not built in
- …so it is not in the website's list yet
- its own page still opens for anyone with the link (the website reads the app from here)
- …at /apps/<address>, with no versions yet — _https://site.example.test/apps/rasoi-pulse-pos_
- …and no internal fields are shown to the public
- the new app comes after the built-in ones in the console

**Step 4 — Wrong details are refused with a clear sentence**

- no name: 400
- a one-letter name: 400
- the same name (same address) again: 409 and says so — _There is already an app at the address “rasoi-pulse-pos”. Choose another address._
- an address that a built-in app already has: 409
- an address with capitals and spaces: 400
- an address that starts or ends with a hyphen: 400
- an address over 30 characters: 400
- a code over 5 characters: 400
- a code with a symbol: 400
- a name with no letters or numbers to make an address from: 400
- none of those left an app behind — _6 apps_

**Step 5 — Change an app's words — never its address**

- name changed; the code is upper-cased — _Rasoi Pulse Counter / POS_
- the public page shows the new words at once (not after the cache runs out)
- the address stayed the same
- an address, 'built in' or 'public' sent in an edit is ignored
- an edit with nothing in it: 400
- an empty name: 400
- an app that doesn't exist: 404
- a built-in app's words can be changed too (the console owns them)

**Step 6 — Public / private**

- make it public
- it is in the website's list with its name, code, page and no version yet
- …after the built-in apps
- 'public' must be true or false
- an app that doesn't exist: 404
- make it private again: gone from the list, page still opens — _200_
- the Business app can be made public (and it shows in the list)

**Step 7 — Versions of an app that was added in the console**

- a file can be uploaded and published for the new app — _201_
- …but not for an app that doesn't exist — _400_
- a phone running that app is told about its version
- …and the other apps are not affected
- its page lists the version
- the file downloads under a name that tells which app it is — _attachment; filename=rasoi-pulse-rasoi-pulse-pos-v-26.11.28-002.apk_
- a request from the app is answered normally (the refresh number is told only if set)

**Step 8 — Refresh interval is per app, also for the new one**

- its refresh interval can be set
- …and its requests are answered with that number — _30_
- an app nobody knows is told nothing
- a refresh number for an unknown app: 404

**Step 9 — Signing in from an app that was added in the console**

- any account may sign in (the new app has no role rule of its own) — _200_
- …while the built-in Kitchen app still turns a waiter away — _403_

**Step 10 — Removing an app**

- a built-in app can't be removed — it can be made private instead
- an app that doesn't exist: 404
- after its versions are deleted the app can be removed
- its page is gone (404)
- …and it is not in the console or the website's list any more
- …and its refresh setting is cleaned up too
- the same address can be used again afterwards

**Step 11 — An older database: what was chosen before apps became data is kept**

- the five built-in apps are written again, in order
- …carrying over what was chosen: Business public, Rider private
- …and the usual start for apps nobody chose for (Staff public, Admin private)
- the refresh seconds saved before are still in force
- the website's list follows — _oma,kda,business_

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-28 14:24 | pass | 69 | 0 | headless | 4.1 s |
| 2026-11-28 13:34 | fail | 69 | 1 | headless | 4.0 s |
| 2026-11-28 13:34 | pass | 69 | 0 | headless | 4.2 s |
| 2026-11-28 13:34 | fail | 66 | 3 | headless | 4.4 s |
| 2026-11-28 13:34 | fail | 67 | 2 | headless | 4.5 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t140-app-management-api.mjs`), not this page._
