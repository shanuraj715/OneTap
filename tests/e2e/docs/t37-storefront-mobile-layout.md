# T37 — Storefront — page side padding is smaller on phones and tablets (desktop unchanged); on phones a path title is two lines with a smaller View all button

**Area:** storefront · **Last result:** ✅ PASSED (45 passed, 0 failed · 2026-11-20 06:01 · headless · 6.9 s)

**Run it alone:** `node run.mjs --only t37` (add `--visible` to watch it)

## What this test does

Runs suites/storefront-mobile-layout.mjs: through the bench API it makes a category 'Mob South Indian' with 'Mob Idli & Vada' inside (5 dishes), a plain category, and a custom menu layout with two collapsible sections — one titled 'Mob South Indian › Mob Idli & Vada' with its View all button beside the title, one plain with View all at the bottom. In Chrome at desktop, tablet and phone: on tablet and phone every page-width block (menu, hero, offers, order bar, footer…) and the header sit 14px from the screen edge, while desktop keeps its 24px; on a phone the path title is on two lines — the parent small and muted ('Mob South Indian ›'), the name a little smaller than a normal heading — the View all button is under the cards, centred, and smaller (see t41 for where it goes and how it animates); on tablet and desktop the title stays one line at the normal size and the button stays beside the title as configured (from 720px up), keeping its size; a plain heading is unchanged everywhere; View all still opens all 5 dishes; no sideways scroll. The test categories are removed and the layout restored at the end.

## Steps

1. desktop 1280px
2. tablet 820px
3. phone 390px

## What to expect (these must happen)

- Phones and tablets (up to 1023px): the menu, hero, offers, order bar and footer sit 14px from each screen edge, matching the header; desktop keeps 24px.
- Phones (up to 640px): a path title is on two lines — the parent small, the name a little smaller than normal — with the whole row to itself; the View all button is under the cards, centred, and smaller.
- Tablet and desktop: the title is one line at the normal size; View all stays beside the title (as configured, 720px and up) and keeps its size.
- A heading that is not a path, and the View all behaviour, are unchanged; no sideways scroll at any size.

## What must NOT happen

- Desktop padding must NOT change.
- The View all button must NOT sit beside the title on a phone (under 720px).
- A plain (non-path) heading must NOT shrink.
- The browser must NOT log errors or warnings.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (45)

**Step 1 — desktop 1280px**

- desktop: the menu keeps its 24px side padding — _24/24_
- desktop: none of the page blocks lost padding — _[["div",18],["section",24],["section",18],["div",24]]_
- desktop: the header is unchanged (24px) — _24_
- desktop: the first category starts 124px from the left edge
- desktop: the title stays on ONE line at the normal size — _22px / 22px_
- desktop: the button stays beside the title, as configured
- desktop: and keeps its size
- desktop: a plain heading is unchanged (22px)
- desktop: the bottom View all button keeps its size — _13.6px_
- desktop: View all still shows all 5 dishes
- desktop: no sideways scroll

**Step 2 — tablet 820px**

- tablet: the menu sits 14px from each edge (was 24) — _14/14_
- tablet: every page-width block (hero, offers, order bar, menu, footer…) uses the same 14px edge — _[["div",14],["section",14],["section",14],["div",14]]_
- tablet: the header lines up with them (14px) — _14_
- tablet: the first category starts 14px from the left edge
- tablet: the title stays on ONE line at the normal size — _22px / 22px_
- tablet: the button stays beside the title, as configured
- tablet: and keeps its size
- tablet: the filter has all four chips (All, Veg, Egg, Non-veg) — _4_
- tablet: filter chips and the Categories button are ONE row — _59px high_
- tablet: nothing is cut off or pushed off screen — _{"h":59,"n":4,"tops":1,"fits":true,"btnRight":806,"barRight":806}_
- tablet: a plain heading is unchanged (22px)
- tablet: the bottom View all button keeps its size — _13.6px_
- tablet: View all still shows all 5 dishes
- tablet: no sideways scroll

**Step 3 — phone 390px**

- phone: the menu sits 14px from each edge (was 24) — _14/14_
- phone: every page-width block (hero, offers, order bar, menu, footer…) uses the same 14px edge — _[["div",14],["section",14],["section",14],["div",14]]_
- phone: the header lines up with them (14px) — _14_
- phone: the first category starts 14px from the left edge
- phone: the title is on TWO lines — parent first, then the name — _736 / 752_
- phone: line one is the parent, line two is the category — _"Mob South Indian ›" / "Mob Idli & Vada"_
- phone: the parent is small — _11.88px_
- phone: the category name is a little smaller than a normal heading — _18.92px of 22px_
- phone: the title has the whole row to itself and fits — _149 of 390_
- phone: the button configured beside the title is NOT there — it is under the cards instead
- phone: it sits below the cards, centred on the screen — _0.0px off centre_
- phone: the filter has all four chips (All, Veg, Egg, Non-veg) — _4_
- phone: filter chips and the Categories button are ONE row — _55px high_
- phone: nothing is cut off or pushed off screen — _{"h":55,"n":4,"tops":1,"fits":true,"btnRight":376,"barRight":376}_
- phone: a plain heading is unchanged (22px)
- phone: the bottom View all button is smaller too — _12.48px_
- phone: View all still shows all 5 dishes
- phone: no sideways scroll
- the test categories are removed and the menu layout is put back — _200_
- the browser logged no errors or warnings

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-20 06:01 | pass | 45 | 0 | headless | 6.9 s |
| 2026-11-20 04:59 | pass | 45 | 0 | headless | 7.1 s |
| 2026-11-20 03:48 | pass | 45 | 0 | headless | 13.4 s |
| 2026-11-20 03:43 | fail | 21 | 3 | headless | 34.3 s |
| 2026-11-20 00:26 | pass | 45 | 0 | headless | 7.4 s |
| 2026-11-19 23:29 | pass | 45 | 0 | headless | 13.4 s |
| 2026-11-19 23:05 | pass | 45 | 0 | headless | 8.1 s |
| 2026-11-19 23:03 | pass | 45 | 0 | headless | 7.5 s |
| 2026-11-19 22:53 | pass | 45 | 0 | headless | 7.3 s |
| 2026-11-19 22:48 | pass | 45 | 0 | headless | 7.5 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t37-storefront-mobile-layout.mjs`), not this page._
