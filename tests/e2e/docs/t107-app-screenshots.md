# T107 — Website → /apps/oma, /apps/kda, /apps/rda: real tablet screenshots in an Android tablet frame, as a tabbed gallery that works by mouse, keyboard and without script

**Area:** website · **Last result:** ✅ PASSED (179 passed, 0 failed · 2026-11-28 01:48 · headless · 10.4 s)

**Run it alone:** `node run.mjs --only t107` (add `--visible` to watch it)

## What this test does

Runs suites/app-screenshots.mjs. The pictures (taken from the real apps on an emulator by mobile-apps/screenshots/capture.mjs and listed in apps/website/src/lib/app-shots.json): all three apps have at least three, each a real WebP file 16:10 and at least 1,400 px wide, under 400 KB, not blank, with a title, a caption and a description for screen readers, listed exactly once (nothing old left in the folder). The tooling: valid JavaScript; builds go to screenshots/.build and never to an app's build-output; no signing key is handed to them; they talk to the throwaway server on localhost, which listens on 127.0.0.1 only, uses an in-memory database and never reads a .env; the emulator's size and status bar are put back; .build and raw pictures are never committed; the restaurant and phone numbers are made up. The page: a 'See it' section headed '<APP> on a tablet' between the top of the page and the install steps, one tab per screenshot named as listed, the first picture showing, a click or the arrow keys switch pictures, the chosen tab is lit in the app's own colour and the keyboard shows a focus ring, the caption follows. The Android tablet frame: an even bezel, rounded body and glass, the picture one bezel in from the edge, a front camera centred in the top bezel, power and volume buttons on the top edge, a faint glass sheen that never blocks a tap, a metal-rimmed gradient body with a shadow, and (from real pixels) a dark bezel in light and dark mode. Also: tabs switch with JavaScript switched off; at 390 px nothing sticks out sideways; dark mode text is light on dark; reduced motion stops the slide-in; no picture 404s; /apps still shows its three cards with no gallery.

## Steps

1. The list of screenshots and the pictures
2. The tooling that takes them
3. The gallery on each app's page
4. Works without script, on a phone, in the dark, and with reduced motion

## What to expect (these must happen)

- Each app's page shows its screenshots in a tabbed gallery, one big picture at a time, in an Android tablet frame.
- The pictures are real WebP files, 16:10, not blank, and listed in the manifest.
- The tooling can't touch anything real: no live server, no release key, nothing in build-output.

## What must NOT happen

- A picture must NOT be missing, blank, oversized or left in the folder without being listed.
- The gallery must NOT need JavaScript, and must NOT stick out sideways on a phone.
- The glass overlay must NOT block clicks; no errors in the browser.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (179)

**Step 1 — The list of screenshots and the pictures**

- there are screenshots for all three apps — _oma,kda,rda_
- OMA: at least three screenshots — _3_
- OMA: each has its own name
- oma-tables.webp is in public/app-screens
- oma-tables.webp is a real WebP file
- oma-tables.webp: the list says 1600×1000 and the picture is 1600×1000
- oma-tables.webp: a wide tablet picture (at least 1,400 px, 16:10) — _1600×1000 = 1.60_
- oma-tables.webp: small enough for a web page (under 400 KB) — _68 KB_
- oma-tables.webp: has real content on it (not a blank screen) — _42/39/29_
- oma-tables.webp: has a title, a caption and a description for screen readers
- oma-take-order.webp is in public/app-screens
- oma-take-order.webp is a real WebP file
- oma-take-order.webp: the list says 1600×1000 and the picture is 1600×1000
- oma-take-order.webp: a wide tablet picture (at least 1,400 px, 16:10) — _1600×1000 = 1.60_
- oma-take-order.webp: small enough for a web page (under 400 KB) — _80 KB_
- oma-take-order.webp: has real content on it (not a blank screen) — _47/47/38_
- oma-take-order.webp: has a title, a caption and a description for screen readers
- oma-orders.webp is in public/app-screens
- oma-orders.webp is a real WebP file
- oma-orders.webp: the list says 1600×1000 and the picture is 1600×1000
- oma-orders.webp: a wide tablet picture (at least 1,400 px, 16:10) — _1600×1000 = 1.60_
- oma-orders.webp: small enough for a web page (under 400 KB) — _58 KB_
- oma-orders.webp: has real content on it (not a blank screen) — _28/26/24_
- oma-orders.webp: has a title, a caption and a description for screen readers
- KDA: at least three screenshots — _4_
- KDA: each has its own name
- kda-board.webp is in public/app-screens
- kda-board.webp is a real WebP file
- kda-board.webp: the list says 1600×1000 and the picture is 1600×1000
- kda-board.webp: a wide tablet picture (at least 1,400 px, 16:10) — _1600×1000 = 1.60_
- kda-board.webp: small enough for a web page (under 400 KB) — _75 KB_
- kda-board.webp: has real content on it (not a blank screen) — _62/42/47_
- kda-board.webp: has a title, a caption and a description for screen readers
- kda-prep.webp is in public/app-screens
- kda-prep.webp is a real WebP file
- kda-prep.webp: the list says 1600×1000 and the picture is 1600×1000
- kda-prep.webp: a wide tablet picture (at least 1,400 px, 16:10) — _1600×1000 = 1.60_
- kda-prep.webp: small enough for a web page (under 400 KB) — _35 KB_
- kda-prep.webp: has real content on it (not a blank screen) — _23/21/21_
- kda-prep.webp: has a title, a caption and a description for screen readers
- kda-dishes.webp is in public/app-screens
- kda-dishes.webp is a real WebP file
- kda-dishes.webp: the list says 1600×1000 and the picture is 1600×1000
- kda-dishes.webp: a wide tablet picture (at least 1,400 px, 16:10) — _1600×1000 = 1.60_
- kda-dishes.webp: small enough for a web page (under 400 KB) — _40 KB_
- kda-dishes.webp: has real content on it (not a blank screen) — _29/22/24_
- kda-dishes.webp: has a title, a caption and a description for screen readers
- kda-today.webp is in public/app-screens
- kda-today.webp is a real WebP file
- kda-today.webp: the list says 1600×1000 and the picture is 1600×1000
- kda-today.webp: a wide tablet picture (at least 1,400 px, 16:10) — _1600×1000 = 1.60_
- kda-today.webp: small enough for a web page (under 400 KB) — _28 KB_
- kda-today.webp: has real content on it (not a blank screen) — _20/19/19_
- kda-today.webp: has a title, a caption and a description for screen readers
- RDA: at least three screenshots — _3_
- RDA: each has its own name
- rda-deliveries.webp is in public/app-screens
- rda-deliveries.webp is a real WebP file
- rda-deliveries.webp: the list says 1600×1000 and the picture is 1600×1000
- rda-deliveries.webp: a wide tablet picture (at least 1,400 px, 16:10) — _1600×1000 = 1.60_
- rda-deliveries.webp: small enough for a web page (under 400 KB) — _44 KB_
- rda-deliveries.webp: has real content on it (not a blank screen) — _43/50/25_
- rda-deliveries.webp: has a title, a caption and a description for screen readers
- rda-pickup.webp is in public/app-screens
- rda-pickup.webp is a real WebP file
- rda-pickup.webp: the list says 1600×1000 and the picture is 1600×1000
- rda-pickup.webp: a wide tablet picture (at least 1,400 px, 16:10) — _1600×1000 = 1.60_
- rda-pickup.webp: small enough for a web page (under 400 KB) — _40 KB_
- rda-pickup.webp: has real content on it (not a blank screen) — _40/49/25_
- rda-pickup.webp: has a title, a caption and a description for screen readers
- rda-code.webp is in public/app-screens
- rda-code.webp is a real WebP file
- rda-code.webp: the list says 1600×1000 and the picture is 1600×1000
- rda-code.webp: a wide tablet picture (at least 1,400 px, 16:10) — _1600×1000 = 1.60_
- rda-code.webp: small enough for a web page (under 400 KB) — _39 KB_
- rda-code.webp: has real content on it (not a blank screen) — _45/47/43_
- rda-code.webp: has a title, a caption and a description for screen readers
- no picture sits in the folder without being listed (so nothing old is left behind)

**Step 2 — The tooling that takes them**

- adb.mjs is valid JavaScript
- build.mjs is valid JavaScript
- capture.mjs is valid JavaScript
- scenarios.mjs is valid JavaScript
- serve.mjs is valid JavaScript
- builds go to screenshots/.build, never into an app's build-output folder (where real releases are)
- no signing key is handed to these builds, whatever the shell has set (they use Android's shared debug key)
- the builds are pointed at the throwaway server on localhost, not the live one
- nothing in the tooling points at the live API
- the throwaway server listens on this machine only (127.0.0.1)
- its database is in memory, and it never reads a .env (so the real database address is never seen)
- the phone reaches the server through adb reverse, which is removed again afterwards
- the emulator's screen size and clean status bar are put back when it is done
- the debug-signed builds and the huge raw pictures are never committed (.gitignore)
- OMA: the scenarios and the list agree on which screens, in which order — _tables,take-order,orders_
- KDA: the scenarios and the list agree on which screens, in which order — _board,prep,dishes,today_
- RDA: the scenarios and the list agree on which screens, in which order — _deliveries,pickup,code_
- the restaurant in the pictures is fictional (Saffron Table), not a real customer
- only made-up phone numbers are used

**Step 3 — The gallery on each app's page**

- /apps/oma: has the 'See it' section
- /apps/oma: it is headed 'OMA on a tablet'
- /apps/oma: it sits between the top of the page and the install steps
- /apps/oma: one tab per screenshot, named as listed — _Every table at a glance \| Take the order at the table \| Every order in one list_
- /apps/oma: the first picture is showing, and only that one — _[true,false,false]_
- /apps/oma: the first picture loaded at full size
- /apps/oma: the picture has a description and its size (so the page doesn't jump)
- /apps/oma: the picture sits in a rounded tablet frame
- /apps/oma: the bezel is an even 22 px all round — _[22,22,22]_
- /apps/oma: the body and the glass have rounded corners, the glass less than the body — _42 / 18_
- /apps/oma: the picture sits inside the glass, one bezel in from the edge — _22 vs 22_
- /apps/oma: a front camera in the middle of the top bezel — _x off 0.0, y 11.0, 7.9 px_
- /apps/oma: power and volume buttons stand on the top edge — _[{"above":true,"touches":true,"inside":true},{"above":true,"touches":true,"inside":true}]_
- /apps/oma: the glass has a faint sheen that never blocks a tap or click
- /apps/oma: the body is a metal-rimmed gradient with a soft shadow — _6 shadow layers_
- /apps/oma: the bezel really is dark on the page — _32/33/37_
- /apps/oma: the caption under it is the first screenshot's
- /apps/oma: clicking the second tab shows the second picture only — _[false,true,false]_
- /apps/oma: the chosen tab is lit and the others are not — _rgb(255, 255, 255) · color(srgb 0.211765 0.256941 0.604235) · rgb(255, 255, 255)_
- /apps/oma: …in the app's own colour — _color(srgb 0.211765 0.256941 0.604235) vs color(srgb 0.211765 0.256941 0.604235)_
- /apps/oma: the second picture loaded too
- /apps/oma: the arrow key moves to the next picture — _[false,false,true]_
- /apps/oma: …and back
- /apps/oma: the tab you are on with the keyboard shows a focus ring — _solid_
- /apps/kda: has the 'See it' section
- /apps/kda: it is headed 'KDA on a tablet'
- /apps/kda: it sits between the top of the page and the install steps
- /apps/kda: one tab per screenshot, named as listed — _The kitchen board \| Prep list \| Sold out in one tap \| Today at a glance_
- /apps/kda: the first picture is showing, and only that one — _[true,false,false,false]_
- /apps/kda: the first picture loaded at full size
- /apps/kda: the picture has a description and its size (so the page doesn't jump)
- /apps/kda: the picture sits in a rounded tablet frame
- /apps/kda: the bezel is an even 22 px all round — _[22,22,22]_
- /apps/kda: the body and the glass have rounded corners, the glass less than the body — _42 / 18_
- /apps/kda: the picture sits inside the glass, one bezel in from the edge — _22 vs 22_
- /apps/kda: a front camera in the middle of the top bezel — _x off 0.0, y 10.9, 7.9 px_
- /apps/kda: power and volume buttons stand on the top edge — _[{"above":true,"touches":true,"inside":true},{"above":true,"touches":true,"inside":true}]_
- /apps/kda: the glass has a faint sheen that never blocks a tap or click
- /apps/kda: the body is a metal-rimmed gradient with a soft shadow — _6 shadow layers_
- /apps/kda: the bezel really is dark on the page — _32/33/37_
- /apps/kda: the caption under it is the first screenshot's
- /apps/kda: clicking the second tab shows the second picture only — _[false,true,false,false]_
- /apps/kda: the chosen tab is lit and the others are not
- /apps/kda: …in the app's own colour — _color(srgb 0.0508235 0.465882 0.389647) vs color(srgb 0.0508235 0.465882 0.389647)_
- /apps/kda: the second picture loaded too
- /apps/kda: the arrow key moves to the next picture — _[false,false,true,false]_
- /apps/kda: …and back
- /apps/kda: the tab you are on with the keyboard shows a focus ring — _solid_
- /apps/rda: has the 'See it' section
- /apps/rda: it is headed 'RDA on a tablet'
- /apps/rda: it sits between the top of the page and the install steps
- /apps/rda: one tab per screenshot, named as listed
- /apps/rda: the first picture is showing, and only that one — _[true,false,false]_
- /apps/rda: the first picture loaded at full size
- /apps/rda: the picture has a description and its size (so the page doesn't jump)
- /apps/rda: the picture sits in a rounded tablet frame
- /apps/rda: the bezel is an even 22 px all round — _[22,22,22]_
- /apps/rda: the body and the glass have rounded corners, the glass less than the body — _42 / 18_
- /apps/rda: the picture sits inside the glass, one bezel in from the edge — _22 vs 22_
- /apps/rda: a front camera in the middle of the top bezel — _x off 0.0, y 10.9, 7.9 px_
- /apps/rda: power and volume buttons stand on the top edge — _[{"above":true,"touches":true,"inside":true},{"above":true,"touches":true,"inside":true}]_
- /apps/rda: the glass has a faint sheen that never blocks a tap or click
- /apps/rda: the body is a metal-rimmed gradient with a soft shadow — _6 shadow layers_
- /apps/rda: the bezel really is dark on the page — _32/33/37_
- /apps/rda: the caption under it is the first screenshot's
- /apps/rda: clicking the second tab shows the second picture only — _[false,true,false]_
- /apps/rda: the chosen tab is lit and the others are not — _rgb(255, 255, 255) · color(srgb 0.392471 0.259765 0.694588) · rgb(255, 255, 255)_
- /apps/rda: …in the app's own colour — _color(srgb 0.392471 0.259765 0.694588) vs color(srgb 0.392471 0.259765 0.694588)_
- /apps/rda: the second picture loaded too
- /apps/rda: the arrow key moves to the next picture — _[false,false,true]_
- /apps/rda: …and back
- /apps/rda: the tab you are on with the keyboard shows a focus ring — _solid_

**Step 4 — Works without script, on a phone, in the dark, and with reduced motion**

- with JavaScript switched off the tabs still switch the picture — _[false,false,true]_
- oma at 390 px: nothing sticks out sideways, the picture fits (348px), the tabs fit — _{"over":0,"frame":348,"tabsRight":296}_
- kda at 390 px: nothing sticks out sideways, the picture fits (346px), the tabs fit — _{"over":0,"frame":346,"tabsRight":346}_
- rda at 390 px: nothing sticks out sideways, the picture fits (347px), the tabs fit — _{"over":0,"frame":347,"tabsRight":327}_
- in dark mode the heading and the tab labels are light on the dark page
- in dark mode the tablet's bezel is still a dark frame, visible against the dark page — _43/44/49_
- with reduced motion the picture does not slide in
- every picture on the pages was served (no 404)
- the apps index still shows its three cards, without a gallery
- no errors in the browser

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-28 01:48 | pass | 179 | 0 | headless | 10.4 s |
| 2026-11-28 01:48 | error | 115 | 0 | headless | 6 min 50 s |
| 2026-11-28 01:40 | fail | 176 | 3 | headless | 6.6 s |
| 2026-11-28 01:38 | fail | 113 | 2 | headless | 20.7 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t107-app-screenshots.mjs`), not this page._
