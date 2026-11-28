# T148 — App Management → 'Screenshots on the website': add a screenshot, upload a picture for each device and look, get warned about a wrong shape, replace / remove pictures, hide, reorder, edit, remove; set the section's heading, intro and first device

**Area:** platform · **Last result:** ✅ PASSED (53 passed, 0 failed · 2026-11-28 15:42 · headless · 6.6 s)

**Run it alone:** `node run.mjs --only t148` (add `--visible` to watch it)

## What this test does

Chrome against the bench console (super admin) and API, on a throwaway app that is removed at the end. An app with no screenshots says so, shows the usual heading and intro as hints, a section switch and a 'View on the website' link. 'Add a screenshot' needs a title of two characters; the new one shows with six empty slots (3 devices × light / dark). Pictures are put in through each slot's file box: they show in the slot with their size and 'uploaded', the slot then offers Replace and Remove, the summary counts pictures and names the devices that will be offered, and the server holds them in the right slots. A wide picture in a phone slot is warned about ('will look squashed') and the warning goes when the right shape replaces it; a text file is refused with words that name the slot; Remove empties a slot (on the server too). Move up / down swaps (the ends are disabled, the server follows), Hide / Show marks it 'Hidden', Edit changes the words (an empty title can't be saved), Remove asks by name and Cancel changes nothing. The section's heading / intro / first device save and reach the server, switching the section off saves at once and is said in the summary, an empty heading means the usual one. At 390 px nothing runs off the screen. When pictures came with the website (OMA), they are marked as such, all load, and each has light and dark pictures.

## Steps

1. An app with no screenshots
2. Add a screenshot
3. Put pictures in the slots
4. A picture of the wrong shape is warned about
5. Not a picture, and removing a picture
6. Add another, reorder, hide
7. Edit the words
8. The section: switch, heading, intro, first device
9. Remove a screenshot
10. A phone-sized console
11. The screenshots that come with the website (an app that has them)

## What to expect (these must happen)

- A picture put in a slot shows there and is stored in the right slot; a wrong shape is warned about.
- Reorder, hide, edit, remove and the section settings all reach the server.
- Pictures that came with the website show in the console and are marked as such.

## What must NOT happen

- A file that is not a picture must NOT be stored.
- Cancel in the Remove question must NOT remove anything.
- An empty title must NOT be saved.
- The page must NOT scroll sideways on a phone-sized screen.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (53)

**Step 1 — An app with no screenshots**

- the card says there are none, and has 'Add a screenshot'
- the heading and intro boxes show the usual words as hints
- the first device is the wide tablet, and Save is off until something changes
- the section's switch is there, on
- 'View on the website' goes to the app's page, at the screenshots

**Step 2 — Add a screenshot**

- 'Add it' is off until there is a title
- …a one-letter title is not enough
- the new screenshot is in the list with its words
- …with six empty slots (3 devices × light and dark)
- the summary says it has no picture yet, so nothing is shown
- the server has it (shown, not built in)

**Step 3 — Put pictures in the slots**

- a picture goes into its slot and is shown there
- …with its size, and 'uploaded' — _Replace 1600 × 1000 · uploaded_
- …and the slot now offers Replace and Remove
- a picture of the right shape has no warning
- the summary counts the pictures and names the devices that will be offered — _1 screenshot, 3 pictures · shown on the page for tablet · wide, phone_
- the server holds the three pictures in the right slots
- …as stored files with an address

**Step 4 — A picture of the wrong shape is warned about**

- a wide picture in a phone slot says it will look squashed
- putting the right shape in its place (Replace) clears the warning
- …and the picture is the new one (replaced, not added)

**Step 5 — Not a picture, and removing a picture**

- a file that is not a picture is refused, in words that name the slot
- …and the slot stays empty
- Remove empties a slot
- …on the server too

**Step 6 — Add another, reorder, hide**

- the first can't move up and the last can't move down
- Move down swaps the two
- …and the server has the new order
- Move up swaps them back
- Hide marks the second one 'Hidden'
- …and the server has it hidden
- Show brings it back

**Step 7 — Edit the words**

- the form opens with the current words
- an empty title can't be saved
- the card shows the new words
- …and the server has them

**Step 8 — The section: switch, heading, intro, first device**

- Save turns on when something changes
- the server has the heading, the intro and the first device
- switching the section off is said in the summary
- …and saved at once
- switching it on again takes the words back
- (the heading box takes 80 characters)
- an empty heading means the usual one

**Step 9 — Remove a screenshot**

- pressing Remove asks first, by name
- Cancel changes nothing
- Remove it deletes the screenshot
- …and the list shows what is left
- (the API is still fine)

**Step 10 — A phone-sized console**

- nothing runs off the screen at 390 px — _{"over":0,"card":353}_

**Step 11 — The screenshots that come with the website (an app that has them)**

- OMA's screenshots are marked 'Came with the website' — _5 screenshots_
- …and every picture shows (they come from the website's own files) — _28 pictures_
- each has light and dark pictures, for the wide tablet, the tall tablet and the phone (where the screen exists there)
- no errors in the browser console

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-28 15:42 | pass | 53 | 0 | headless | 6.6 s |
| 2026-11-28 15:38 | pass | 53 | 0 | headless | 6.4 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t148-app-screenshots-manager-ui.mjs`), not this page._
