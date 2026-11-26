# T82 — A thin progress bar across the top of the storefront while the page changes — starts at once, creeps, finishes and fades when the page arrives, ignores taps that go nowhere, gives up if nothing comes

**Area:** storefront · **Last result:** ✅ PASSED (34 passed, 0 failed · 2026-11-26 11:51 · headless · 32.4 s)

**Run it alone:** `node run.mjs --only t82` (add `--visible` to watch it)

## What this test does

Runs suites/storefront-nav-progress.mjs in Chrome against the bench store, with the server's answers for the next page held back for about two seconds (a slow network). At rest there is no bar; when shown it is a 3px line fixed at the very top, the full width, above every sticky bar and pop-up, never catching a tap. A tap on a link to another page of the store (a footer page) shows it within a quarter of a second, it creeps forward without reaching the end, the old page stays until the new one arrives, then it runs to the end and fades (running → done → idle, once). Back / Forward shows it too. These do NOT start it: a link to the page you are on, a #hash link, another website, a new-tab link, a download, ctrl / ⌘ / shift / middle click, a link marked data-no-progress. A tap whose page never comes starts it and it gives up and fades within about 8 seconds. A phone shows the same full-width line. Choosing an outlet in the outlet picker (code changes the page, no link) shows the bar and finishes it.

## Steps

1. At rest the bar is not there
2. A tap on a link to another page of the store (a slow network)
3. Back
4. Taps that do NOT leave the page
5. A link whose page never comes: the bar gives up by itself
6. A phone
7. The code changes the page itself (the order bar's outlet dropdown)

## What to expect (these must happen)

- The bar shows at once after a tap on a link to another page, creeps, and finishes and fades when the page arrives.
- Back / Forward and choosing an outlet in the picker show it too.
- It gives up by itself within about 8 seconds if no page arrives.

## What must NOT happen

- A link to the current page, a #hash, an external site, a new tab or a modified click must NOT start the bar.
- The bar must NOT reach the end before the new page arrives, and must NOT block taps.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (34)

**Step 1 — At rest the bar is not there**

- a freshly opened page shows no bar — _{"state":"idle","ratio":0}_
- when it shows it is a 3px line fixed at the very top, the full width of the screen — _fixed top 0, 3px high, 1280/1280px wide_
- …above every sticky bar and pop-up of the page, and it never catches a tap — _z-index 2147483000 vs 32 highest other_

**Step 2 — A tap on a link to another page of the store (a slow network)**

- the bar is on screen at once (a quarter of a second after the tap), already a little way along — _{"state":"running","ratio":0.116}_
- …keeps creeping forward while the page is on its way, without reaching the end — _0.116 → 0.406_
- …and the old page is still showing meanwhile (the new one hasn't arrived) — _http://localhost:3170/main_
- the new page arrives
- the bar runs to the end when it does
- …then fades away and is gone
- the whole story is: running → done → idle (once) — _running → done → idle_
- when it finishes it slides all the way across the screen — _1_

**Step 3 — Back**

- Back returns to the first page
- Back also shows the bar, and it finishes — _running → done → idle_

**Step 4 — Taps that do NOT leave the page**

- a link to the page you are on: no bar
- a #hash link on this page: no bar
- a link to another website: no bar
- a link that opens a new tab: no bar
- a download link: no bar
- a ctrl-click: no bar
- a ⌘-click: no bar
- a shift-click: no bar
- a middle-click: no bar
- a link marked data-no-progress: no bar

**Step 5 — A link whose page never comes: the bar gives up by itself**

- a plain tap on a link to another page starts the bar (here nothing will load)
- after 3 seconds it is still creeping, below the end — _{"state":"running","ratio":0.691}_
- within about 8 seconds it gives up and fades away instead of hanging for ever
- (it closes with the same 'done' fade)

**Step 6 — A phone**

- on a phone the bar is across the whole top too — _390px_
- …and finishes when the page arrives

**Step 7 — The code changes the page itself (the order bar's outlet dropdown)**

- a store with more than one outlet has the outlet dropdown in the order bar
- choosing another outlet (the page is changed by the code, not by a link) shows the bar
- the other outlet's page arrives — _/second_
- …and the bar finishes — _running → done → idle_
- the browser logged no errors or warnings

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-26 11:51 | pass | 34 | 0 | headless | 32.4 s |
| 2026-11-26 10:40 | pass | 34 | 0 | headless | 28.6 s |
| 2026-11-25 12:01 | pass | 34 | 0 | headless | 27.4 s |
| 2026-11-25 10:50 | pass | 34 | 0 | headless | 30.3 s |
| 2026-11-25 10:36 | pass | 34 | 0 | headless | 30.1 s |
| 2026-11-25 10:25 | error | 30 | 0 | headless | 58.8 s |
| 2026-11-25 10:23 | fail | 28 | 2 | headless | 56.5 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t82-storefront-nav-progress.mjs`), not this page._
