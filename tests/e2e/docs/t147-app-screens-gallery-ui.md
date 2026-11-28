# T147 — Website → an app's page → 'See it': the app's screens in a tablet (wide or tall) or phone frame; light, dark or Auto (follows the browser live); flip with buttons, keys or a swipe; works on a phone

**Area:** website · **Last result:** ✅ PASSED (82 passed, 0 failed · 2026-11-28 15:38 · headless · 20.7 s)

**Run it alone:** `node run.mjs --only t147` (add `--visible` to watch it)

## What this test does

Chrome against the bench API and website; it adds a test app in the console with five screenshots (two complete, one with a light-only phone picture and no tall-tablet picture, one hidden, one with no picture) whose pictures it draws pale or dark, so the look on screen is read from the pixels; the app is removed at the end. The heading, line and device switch (three devices) and look switch (Auto / Light / Dark) show; the list has only the shown screens that have a picture for the chosen device. The frames have the right screen shapes (16:10, 5:8, 19.5:9), the phone's camera inside the screen and a tablet's in the bezel. Auto shows the browser's look and follows it live when it changes with no reload; Light / Dark override it (and say so), survive changing screens and a reload (with the device); a screen that has only one look shows it always. Next / previous wrap round, arrow keys, Home / End move the focus along, a horizontal swipe flips and a vertical drag does not; the controls are labelled for screen readers. Pictures are added to the page when wanted (2 of 3 at first). A mouse makes the device lean and it straightens again. At 390 px: no sideways scroll, controls → device → row of screens, big touch targets, caption under the device. With no script the first screen is still drawn in the browser's look (CSS only). With 'reduce motion' nothing leans or animates. The heading, line and first device written in the console show, and switching the section off removes it.

## Steps

- _(set-up)_
1. The section
2. The frame
3. Auto follows the browser, live
4. Choosing a look by hand
5. A look the screen doesn't have
6. Flipping through the screens
7. Pictures are fetched when wanted
8. A pointer leans the device (a mouse only)
9. A phone-sized screen
10. The first paint needs no script
11. Less motion
12. Switching the section off, and the words

## What to expect (these must happen)

- Auto follows the browser's light / dark live; Light and Dark override it and are remembered.
- Each device frame has the right screen shape; only the screens with a picture for the device are listed.
- On a phone-sized screen everything fits and can be touched.

## What must NOT happen

- A hidden screen, or one with no picture, must NOT be shown.
- The page must NOT scroll sideways.
- A vertical drag must NOT be taken for a swipe.
- With 'reduce motion' the device must NOT lean or animate.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (82)

**Set-up — Setup**

- (a test app is added in the console)
- (picture 1 tablet-landscape light stored)
- (picture 1 tablet-landscape dark stored)
- (picture 1 tablet-portrait light stored)
- (picture 1 tablet-portrait dark stored)
- (picture 1 phone light stored)
- (picture 1 phone dark stored)
- (picture 2 tablet-landscape light stored)
- (picture 2 tablet-landscape dark stored)
- (picture 2 tablet-portrait light stored)
- (picture 2 tablet-portrait dark stored)
- (picture 2 phone light stored)
- (picture 2 phone dark stored)
- (picture 3 tablet-landscape light stored)
- (picture 3 tablet-landscape dark stored)
- (picture 3 phone light stored)
- (picture 4 tablet-landscape light stored)
- (picture 4 tablet-landscape dark stored)
- (picture 4 tablet-portrait light stored)
- (picture 4 tablet-portrait dark stored)
- (picture 4 phone light stored)
- (picture 4 phone dark stored)

**Step 1 — The section**

- the heading is 'TUR on every screen', its last word in the app's colour
- …with the usual line under it
- the device switch offers the three devices (each has a picture somewhere) — _tablet-landscape,tablet-portrait,phone_
- the look switch has Auto, Light and Dark
- it opens on the wide tablet, on Auto
- the list has the three screens that are shown, in order (not the hidden one, not the one with no picture) — _Tables at a glance \| Orders in one list \| Menu with dish photos_
- the counter reads 1 / 3
- the chosen screen shows its caption
- each picture has a description that says the app, the device, the look and what is on the screen

**Step 2 — The frame**

- the wide tablet's screen is 16:10 — _1.600_
- …with the camera in the bezel, two keys on the edge and an even bezel — _{"camIn":false,"keys":2,"bezel":14}_
- the tall tablet's screen is 5:8, and the device stands upright — _0.625_
- …and only the two screens that have a picture for it are listed (1 / 2)
- the phone's screen is 19.5:9 and its camera is a punch-hole inside the screen — _0.462 dev-cam dev-cam-hole_
- …a narrow, tall device — _290×616_
- …with all three screens (the Menu one has a light picture for the phone)

**Step 3 — Auto follows the browser, live**

- the browser is light: the light picture is on the screen
- the hint says it follows the browser (light)
- the browser goes dark (nothing reloaded): the dark picture fades in
- …and the hint follows too (dark)
- back to light: the light picture again

**Step 4 — Choosing a look by hand**

- Dark shows the dark picture although the browser is light
- …and says so
- Light shows the light picture although the browser is dark
- Auto goes back to following the browser (dark)
- the chosen look stays when another screen is chosen
- the choice is remembered on this browser
- after a reload the device (phone) and the look (Light) are the ones chosen last time

**Step 5 — A look the screen doesn't have**

- the Menu screen has only a light phone picture: it is shown even when Dark is chosen
- …while the other screens do go dark

**Step 6 — Flipping through the screens**

- Next moves to the second screen
- …and its caption opens
- Next from the last screen goes round to the first
- Previous from the first goes round to the last
- the arrow keys move along the list, and the focus goes with them — _true / shot-tab-1_
- End jumps to the last
- Home jumps to the first
- a swipe to the left on the picture goes to the next screen
- …and a swipe to the right goes back
- …but scrolling the page with a finger is not mistaken for a swipe
- the controls are labelled for a screen reader (tabs, a panel tied to its tab, two radio groups)

**Step 7 — Pictures are fetched when wanted**

- at first only the first screen and the next one are on the page (2 of 3) — _2_
- …the third is added when it is wanted, and only then fetched — _4 → 6 requests_

**Step 8 — A pointer leans the device (a mouse only)**

- the device leans towards a mouse pointer — _2.80deg_
- …and stands straight again when the pointer leaves

**Step 9 — A phone-sized screen**

- nothing sticks out sideways — _0px_
- the controls come first, then the device, then the row of screens
- the device fills the width — _350px_
- the switch buttons are big enough to touch — _42,42,42,42,42,42_
- the screens are a row you can scroll sideways (when they don't fit) — _true_
- the chosen screen's caption sits under the device (not inside the chips)
- tapping a chip chooses that screen
- the phone view fits too — _290px wide, 0px over_

**Step 10 — The first paint needs no script**

- with no script the first screen is still drawn
- …in the browser's own look (dark here), chosen by CSS alone — _[["light","0"],["dark","1"]]_

**Step 11 — Less motion**

- with 'reduce motion' the device does not lean, nothing animates in and the switch thumb jumps — _{"lean":"0deg","anim":"none","thumb":"0s"}_

**Step 12 — Switching the section off, and the words**

- the heading and the line written in the console show on the page
- …and the page opens on the device chosen there (phone)
- switched off in the console: the section is not on the page
- no errors in the browser console

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-28 15:38 | pass | 82 | 0 | headless | 20.7 s |
| 2026-11-28 15:14 | fail | 26 | 3 | headless | 57.5 s |
| 2026-11-28 15:12 | error | 12 | 0 | headless | 48.0 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t147-app-screens-gallery-ui.mjs`), not this page._
