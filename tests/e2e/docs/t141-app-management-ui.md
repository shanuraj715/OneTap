# T141 — App Management → 'Add an app': the super admin types a name, the address and icon code are made from it; the app starts private, opens by its link, can be edited, made public (website card with a generated icon) and removed — built-in apps can't be removed

**Area:** platform · **Last result:** ✅ PASSED (37 passed, 0 failed · 2026-11-28 16:16 · headless · 34.2 s)

**Run it alone:** `node run.mjs --only t141` (add `--visible` to watch it)

## What this test does

Chrome against the bench console (super admin) and the bench website. The five built-in apps have tabs in order; a built-in app says 'Built in', its Remove button is off with the reason, and its address is locked when editing. 'Add an app' stays off until there is a name; typing 'Rasoi Pulse POS' fills the address (rasoi-pulse-pos) and code (RPP); a bad address is explained and blocks Add; the code takes 5 characters at most. Saving adds a tab after the built-in ones, opens it, shows its words, starts it Private, with no Refresh interval card. Adding the same name again says there is already an app there and creates nothing. Editing changes the words (name, tagline) in the About card and the tab while the address stays. On the website a private app is not in /apps but its page opens by the link with the words from the console, tells search engines to skip it and has no Download button; an unknown address is a 404. Making it public puts a card in /apps with an icon generated from its code; its page shows it too. Removing it (after a question) drops the tab, the public list and the page (404). What the test adds is removed at the end.

## Steps

1. The console lists the built-in apps; they can be edited but not removed
2. Add an app: only a name is needed
3. The same address can't be used twice
4. Edit its words
5. Private: its page opens by the link, the list leaves it out
6. Public: it joins the website's list with a generated icon
7. Remove it

## What to expect (these must happen)

- Typing a name fills in the address and the code; the app starts private and its page opens by the link.
- Public puts a card with a generated icon on the website's /apps page.
- Removing an app removes its tab, its place in the list and its page.

## What must NOT happen

- A built-in app must NOT be removable.
- An address that already exists must NOT create a second app.
- A private app must NOT be in the website's list of apps.
- Editing must NOT change an app's address.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (37)

**Step 1 — The console lists the built-in apps; they can be edited but not removed**

- five tabs, in order: OMA, KDA, RDA, Admin, Business — _oma,kda,rda,admin,business_
- an 'Add an app' button is at the top
- a built-in app says 'Built in' and its Remove button is off
- …with the reason, and what to do instead (make it private)
- editing shows the address, and it can't be changed

**Step 2 — Add an app: only a name is needed**

- the Add button is off until there is a name
- the address (rasoi-pulse-pos) and the icon code (RPP) are made from the name
- …and the form says where its page will be
- a bad address (spaces, symbols) is explained and the Add button stays off
- the code box takes 5 characters at most
- the new app has its own tab after the built-in ones — _oma,kda,rda,admin,business,rasoi-pulse-pos_
- …and it is open
- the About card shows its name, code, 'Added here', tagline, audience, description and address
- it starts PRIVATE
- …and, having no versions, it can be removed
- no Refresh interval card (this app does not ask for it)
- 'New version' is there to upload its first file

**Step 3 — The same address can't be used twice**

- adding it again says there is already an app at that address — _There is already an app at the address “rasoi-pulse-pos”. Choose another address._
- …and no second tab appeared

**Step 4 — Edit its words**

- the form opens with its current words; the address is locked
- the About card shows the new words
- …and so does its tab (its new tagline, the new name on hover; the address stayed rasoi-pulse-pos)

**Step 5 — Private: its page opens by the link, the list leaves it out**

- the website's /apps page does not list it while it is private
- its own page opens by the link with the words written in the console
- …and tells search engines to skip it
- …and, with no version yet, shows no Download button
- an address that is no app says it couldn't find that page (like every unknown address on the site)

**Step 6 — Public: it joins the website's list with a generated icon**

- the server's public list has it, after the built-in apps
- the website's /apps page has a card for it
- …with its name, tagline and 'No version published yet'
- …and an icon made from its code (POS) in a colour of its own — _data:image/svg+xml;utf8,%3Csvg%20xmlns%3_
- its own page shows the same generated icon

**Step 7 — Remove it**

- the tab goes away
- …and the console shows the first app again
- the public list no longer has it
- its page on the website says it couldn't find that page now
- no errors in the browser console

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-28 16:16 | pass | 37 | 0 | headless | 34.2 s |
| 2026-11-28 15:39 | pass | 37 | 0 | headless | 34.3 s |
| 2026-11-28 15:31 | pass | 37 | 0 | headless | 1 min 8 s |
| 2026-11-28 14:25 | pass | 37 | 0 | headless | 33.8 s |
| 2026-11-28 14:24 | fail | 34 | 3 | headless | 34.0 s |
| 2026-11-28 14:16 | pass | 37 | 0 | headless | 33.9 s |
| 2026-11-28 14:02 | pass | 37 | 0 | headless | 34.3 s |
| 2026-11-28 13:47 | pass | 37 | 0 | headless | 34.1 s |
| 2026-11-28 13:45 | error | 30 | 0 | headless | 1 min 4 s |
| 2026-11-28 13:44 | fail | 29 | 1 | headless | 1 min 16 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t141-app-management-ui.mjs`), not this page._
