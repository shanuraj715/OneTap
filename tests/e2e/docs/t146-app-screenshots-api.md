# T146 — App Management → Screenshots (API): the platform admin adds, edits, hides, reorders and removes an app's screenshots and puts a picture in each slot (3 devices × light / dark); the website's data carries only what should be shown

**Area:** app · **Last result:** ✅ PASSED (73 passed, 0 failed · 2026-11-28 15:38 · headless · 5.1 s)

**Run it alone:** `node run.mjs --only t146` (add `--visible` to watch it)

## What this test does

Runs suites/app-screenshots-api.mjs on a private API with an in-memory database and a temporary uploads folder (no browser). The pictures that ship with the website are copied in once per app (not again after something is removed); the console gets their full address, the website's data the path. Only the platform admin can read or change anything. The section has a switch, a heading, an intro and a first device (empty words mean the usual ones; a first device with no picture falls back; switched off = no section, screenshots kept). A screenshot needs a title; a picture goes into one slot (real pictures are resized by the usual pipeline and keep their shape), replacing a picture removes the old file, a non-picture is refused with a reason, unknown devices / looks / screenshots are 400 / 404. Words can be edited, a screenshot hidden or reordered (a screenshot left out of the order keeps its place; repeated or unknown ids are ignored). Removing a picture or a screenshot (or the app) removes the files. An app can have 12 screenshots. The public data has no internal fields or storage keys, lists only the devices that have a picture and never shows a screenshot with no picture.

## Steps

1. The pictures that ship with the website are copied in once
2. Only the platform admin manages them
3. The section: switch, words, first device
4. Add a screenshot and put pictures in its slots
5. Edit the words, hide, reorder
6. Remove a picture, remove a screenshot
7. Limits
8. An app added in the console, and removing it
9. Nothing reaches the website but what should

## What to expect (these must happen)

- The built-in pictures are copied in once and never come back after being removed.
- Replacing or removing a picture, a screenshot or an app removes the stored files.
- The website's data lists only shown screenshots that have a picture, and only the devices that have one.

## What must NOT happen

- A store owner or a waiter must NOT read or change screenshots.
- A file that isn't a picture must NOT be stored.
- The website's data must NOT carry storage keys or internal fields.
- A 13th screenshot must NOT be accepted.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (73)

**Step 1 — The pictures that ship with the website are copied in once**

- OMA starts with the two screens that ship with the website, in order — _Every table at a glance\|Every order in one list_
- …marked as coming with the website, and shown
- the console gets the picture's full address (it is on another site) — _https://site.example.test/app-screens/oma-tables.tablet-landscape.light.webp_
- …and knows these are not uploaded files
- reading it again does not copy them again
- the public page data has them, with the picture's path on the website — _/app-screens/oma-tables.tablet-landscape.light.webp_
- …and lists only the devices that have a picture — _["tablet-landscape","phone"]_
- …with the usual heading and intro, and the wide tablet first — _OMA on every screen / tablet-landscape_
- …and no internal field or storage key
- an app with no screenshots has no section (null)
- (the app's own words are still in the same answer)

**Step 2 — Only the platform admin manages them**

- a store owner cannot read the list
- a store owner cannot add one
- a waiter cannot read the list
- a waiter cannot add one
- nobody signed in cannot read the list
- nobody signed in cannot add one
- a store owner cannot upload a picture
- a waiter cannot remove one
- …and nothing changed

**Step 3 — The section: switch, words, first device**

- heading, intro and first device are saved
- …and the website's data follows at once
- an empty heading means the usual one
- a heading over 80 characters: 400
- an unknown device: 400
- nothing to change: 400
- an app that doesn't exist: 404
- a first device with no picture falls back to one that has
- switched off: no section on the website, the screenshots are kept
- switched on again: they are back

**Step 4 — Add a screenshot and put pictures in its slots**

- a screenshot needs a title (2 characters at least): 400
- a title over 60 characters: 400
- added: shown, not built in, no pictures yet
- a screenshot with no picture is not shown on the website
- a picture goes into a slot — _200_
- …its real size is kept in shape (16:10), after the usual resizing — _1600×1000_
- …and the file is in the platform's storage — _1 file_
- the website now shows it, last, with the file's address
- pictures go into other slots too (dark, a phone, a tall tablet)
- …four files now — _4_
- all three devices are offered now — _["tablet-landscape","tablet-portrait","phone"]_
- …and a slot has its light and dark pictures
- putting another picture in the same slot replaces it
- …and the old file is removed from storage (still four files) — _4_
- something that is not a picture is refused with a reason (415) — _That file isn't an image we can read. Try JPEG, PNG, WebP, AVIF or HEIC._
- …and nothing was stored
- an unknown device or look: 400
- a screenshot that doesn't exist: 404
- an upload with nothing in it: 400

**Step 5 — Edit the words, hide, reorder**

- the words can be changed
- …and the website's data follows
- an empty title, or nothing to change: 400
- hidden: not on the website, still in the console
- the order can be changed
- …and the website follows it
- a screenshot left out of the list keeps its place after the ones named
- something that is not a list of ids: 400
- repeated and unknown ids are ignored

**Step 6 — Remove a picture, remove a screenshot**

- a picture can be removed from its slot
- …its file is gone from storage — _3_
- removing an empty slot: 404
- a device with no picture left is no longer offered
- removing a screenshot removes it and every file it had — _0 files left_
- removing it again: 404
- a screenshot that came with the website can be removed too
- …and it is not copied in again when the list is read again

**Step 7 — Limits**

- an app can have 12 screenshots: the 13th is refused with a reason — _An app can have 12 screenshots at most. Remove one first._

**Step 8 — An app added in the console, and removing it**

- a new app starts with no screenshots and no section
- …it can have its own, with the heading made from its code
- (one file stored for it)
- the app is removed
- …and its screenshots and files go with it — _0 files left_

**Step 9 — Nothing reaches the website but what should**

- the list of apps carries no screenshot data (it is only on an app's own page data)

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-28 15:38 | pass | 73 | 0 | headless | 5.1 s |
| 2026-11-28 15:35 | pass | 73 | 0 | headless | 4.9 s |
| 2026-11-28 15:34 | fail | 72 | 1 | headless | 5.9 s |
| 2026-11-28 15:28 | pass | 73 | 0 | headless | 4.9 s |
| 2026-11-28 14:34 | fail | 66 | 7 | headless | 7.0 s |
| 2026-11-28 14:34 | pass | 73 | 0 | headless | 5.6 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t146-app-screenshots-api.mjs`), not this page._
