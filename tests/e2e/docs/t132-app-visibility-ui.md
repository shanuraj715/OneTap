# T132 — App Management → every app has a Public / Private button; the Admin app has its own tab and starts private (not in the website's list, its page still opens by its link)

**Area:** platform · **Last result:** ✅ PASSED (31 passed, 0 failed · 2026-11-28 14:24 · headless · 2.1 s)

**Run it alone:** `node run.mjs --only t132` (add `--visible` to watch it)

## What this test does

Chrome against the bench console (super admin) and the bench website. The staff apps start public; the Admin and Business apps start private. The Admin app's tab says Private with the link to share and a Copy button, has no Refresh interval card (it does not use it) and keeps the New version upload. Make public (after agreeing to the question) puts it in the server's public list and the tab says Public; Make private takes it out; it is kept after a reload; any app can be switched (RDA out and back); an unknown app is a 404, a value that is not true / false a 400, and someone not signed in gets 401; saving the refresh interval does not change visibility. On the website the /apps page lists OMA, KDA and RDA only, the Admin app's own page /apps/admin opens (and is noindex), and the home page does not mention the private apps.

## Steps

1. The server: who is public to begin with
2. The console: a tab for the Admin app with a Public / Private button
3. Make public, then private again
4. A staff app can be made private too (and back)
5. The website: the list leaves it out, its own page still opens

## What to expect (these must happen)

- The Admin app has a tab in App Management with a Public / Private button; it starts private.
- A private app is not in the public list or on the website's /apps page, but its own page opens by its link.
- Make public / Make private change the public list at once, and the choice is kept.

## What must NOT happen

- A private app must NOT appear in the website's list of apps or on its home page.
- The Refresh interval card must NOT show for an app that does not use it.
- Someone not signed in must NOT be able to change an app's visibility.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (31)

**Step 1 — The server: who is public to begin with**

- the public list has the staff apps (OMA, KDA, RDA) and NOT the Admin or Business app — _oma,kda,rda_
- the console's app list has the Admin and Business apps too
- settings: the staff apps are public, the Admin and Business apps private
- …each says what its default is, its page address, and whether the refresh interval applies to it
- a private app's own page data is still available (so its page opens for anyone with the link) and says it is not listed

**Step 2 — The console: a tab for the Admin app with a Public / Private button**

- App Management has a tab for every app, the Admin app and the Business app included — _oma,kda,rda,admin,business_
- the Admin app's tab is named (its short name, and the full name on hover)
- OMA's tab: Public, the button says 'Make private', no link box
- …and OMA still has its Refresh interval card
- the Admin tab says Private: not in the list of apps on the website
- …with a 'Make public' button
- …and the link to share with the team, with a Copy button
- the Refresh interval card is not shown for the Admin app (it does not use that setting)
- the upload of a new version is there as for the other apps

**Step 3 — Make public, then private again**

- pressing Make public (and agreeing to the question) turns it Public; the link box goes
- the server's public list now has the Admin app
- …and its page data says listed
- after a reload it is still Public (the choice was saved)
- the staff apps are still in the list
- Make private takes it out of the public list again

**Step 4 — A staff app can be made private too (and back)**

- any app can be made private: RDA leaves the list, the others stay
- …and public again
- an app that doesn't exist is a 404; something that is not true / false is a 400
- someone not signed in can't change it (401)
- saving the refresh interval does not change who is public

**Step 5 — The website: the list leaves it out, its own page still opens**

- the website's /apps page lists the three staff apps
- …and does NOT list the Admin or Business app
- the Admin app's own page opens by its link (200), and tells search engines to skip it
- it says who the app is for
- the home page does not mention the private apps either
- no errors in the browser console

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-28 14:24 | pass | 31 | 0 | headless | 2.1 s |
| 2026-11-28 14:23 | fail | 30 | 1 | headless | 15.9 s |
| 2026-11-28 13:48 | pass | 31 | 0 | headless | 1.7 s |
| 2026-11-28 13:36 | pass | 31 | 0 | headless | 1.7 s |
| 2026-11-28 03:10 | pass | 31 | 0 | headless | 2.4 s |
| 2026-11-28 03:09 | fail | 30 | 1 | headless | 2.4 s |
| 2026-11-28 03:09 | fail | 27 | 4 | headless | 2.8 s |
| 2026-11-28 03:09 | pass | 31 | 0 | headless | 20.1 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t132-app-visibility-ui.mjs`), not this page._
