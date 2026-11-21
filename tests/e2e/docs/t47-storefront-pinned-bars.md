# T47 — Storefront — the header, the order bar (Takeaway/Delivery + outlet) and the category/filter bar stay pinned to the top while scrolling, on phone, tablet and desktop, with every header style

**Area:** storefront · **Last result:** ✅ PASSED (101 passed, 0 failed · 2026-11-21 15:11 · headless · 1 min 41 s)

**Run it alone:** `node run.mjs --only t47` (add `--visible` to watch it)

## What this test does

Runs suites/storefront-pinned-bars.mjs against the bench store in Chrome. On a phone (390px), a tablet (820px) and a desktop (1440px): at the top of the page the header and the order bar sit in order and the category bar is further down; after scrolling (a little, halfway, nearly to the bottom) all THREE are pinned to the top — header at 0, the order bar flush under it, the category bar flush under that, with no gap and no overlap — and together they take only a small part of the screen. The 'isn't available from this outlet' note under the order bar is not pinned: it scrolls away. Choosing a category in the bar (chips on a wide screen, the Categories sheet on a phone/tablet) scrolls the menu to that category just UNDER the pinned bars, never hidden behind them, and jumping to the menu anchor (#menu) also lands below them. On a phone the order bar is slim: the Takeaway/Delivery switch and the outlet are on ONE row; a very narrow 320px phone shows no sideways scroll. Overlays stay above the pinned bars: the outlet dropdown opens over the category bar and its rows can be pressed, an item pop-up covers the header and the bars, and the phone menu drawer (drawn on <body>) slides in over the pinned header and locks the page behind it; Escape closes it. The customer's Account page has the pinned header too. Finally all 15 header styles are tried on a phone and a desktop: each one up to 150px tall (a fifth of the window at most) stays pinned with the order bar and the category bar flush under it; the two very tall styles (Banner, Stacked) are too big to pin, so they scroll away and the order bar and category bar still pin to the very top. The heights of every style are printed, and the pinned bars never take more than 40% (phone) or 32% (desktop) of the screen. The header style is put back at the end.

## Steps

1. phone 390px
2. tablet 820px
3. desktop 1440px
4. phone: the order bar is slim
5. overlays sit above the pinned bars
6. other pages
7. all 15 header styles, phone
8. all 15 header styles, desktop

## What to expect (these must happen)

- After scrolling, the header, the order bar and the category bar are all pinned at the top, flush under each other, on a phone, a tablet and a desktop.
- The pinned stack is small compared with the screen; on a phone the order bar's switch and outlet share one row.
- The notes under the order bar scroll away; picking a category (or #menu) never leaves the heading hidden behind the pinned bars.
- The outlet dropdown, item pop-ups and the phone menu drawer all appear above the pinned bars.
- Every header style up to 150px tall stays pinned; the two very tall styles scroll away while the order bar and category bar still pin; none leaves less than 60% of the screen free.

## What must NOT happen

- A pinned bar must NOT overlap another or leave a gap between them.
- A very tall header must NOT be pinned (it would cover the page).
- The pinned bars must NOT cover the heading you jumped to.
- An overlay (pop-up, drawer, dropdown) must NOT end up behind the pinned bars.
- The page must NOT scroll sideways on a 320px phone.
- The browser must NOT log errors or warnings.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (101)

**Step 1 — phone 390px**

- phone 390px: the header, the order bar and the category bar are all on the page — _header 34.8+120.0, order bar 154.8+61.0, category bar 669.0+55.0_
- phone 390px: at the top of the page they sit in order, header then order bar — _header 34.8+120.0, order bar 154.8+61.0, category bar 669.0+55.0_
- phone 390px: and the category bar starts lower down (it only pins once you reach it) — _header 34.8+120.0, order bar 154.8+61.0, category bar 669.0+55.0_
- phone 390px: the page is long enough to test scrolling — _2807px of scroll_
- phone 390px: scrolled 574px — all three are pinned to the top, one under the other with no gap — _header 0.0+120.0, order bar 120.0+61.0, category bar 181.0+55.0_
- phone 390px: scrolled 1684px — all three are pinned to the top, one under the other with no gap — _header 0.0+120.0, order bar 120.0+61.0, category bar 181.0+55.0_
- phone 390px: scrolled 2767px — all three are pinned to the top, one under the other with no gap — _header 0.0+120.0, order bar 120.0+61.0, category bar 181.0+55.0_
- phone 390px: the pinned stack takes 236px of 844px — a small part of the screen — _28%_
- phone 390px: choosing a category scrolls to it just under the pinned bars (not hidden behind them) — _heading at 248px, pinned bars end at 236px_
- phone 390px: jumping to #menu leaves the menu below the pinned bars — _menu at 205px, bars end at 181px_

**Step 2 — tablet 820px**

- tablet 820px: the header, the order bar and the category bar are all on the page — _header 34.8+106.4, order bar 141.2+67.0, category bar 689.0+58.8_
- tablet 820px: at the top of the page they sit in order, header then order bar — _header 34.8+106.4, order bar 141.2+67.0, category bar 689.0+58.8_
- tablet 820px: and the category bar starts lower down (it only pins once you reach it) — _header 34.8+106.4, order bar 141.2+67.0, category bar 689.0+58.8_
- tablet 820px: the page is long enough to test scrolling — _1643px of scroll_
- tablet 820px: scrolled 601px — all three are pinned to the top, one under the other with no gap — _header 0.0+106.4, order bar 106.4+67.0, category bar 173.4+58.8_
- tablet 820px: scrolled 986px — all three are pinned to the top, one under the other with no gap — _header 0.0+106.4, order bar 106.4+67.0, category bar 173.4+58.8_
- tablet 820px: scrolled 1603px — all three are pinned to the top, one under the other with no gap — _header 0.0+106.4, order bar 106.4+67.0, category bar 173.4+58.8_
- tablet 820px: the pinned stack takes 232px of 1100px — a small part of the screen — _21%_
- tablet 820px: choosing a category scrolls to it just under the pinned bars (not hidden behind them) — _heading at 244px, pinned bars end at 232px_
- tablet 820px: jumping to #menu leaves the menu below the pinned bars — _menu at 197px, bars end at 173px_

**Step 3 — desktop 1440px**

- desktop 1440px: the header, the order bar and the category bar are all on the page — _header 34.8+106.4, order bar 141.2+67.0, category bar 693.4+53.5_
- desktop 1440px: at the top of the page they sit in order, header then order bar — _header 34.8+106.4, order bar 141.2+67.0, category bar 693.4+53.5_
- desktop 1440px: and the category bar starts lower down (it only pins once you reach it) — _header 34.8+106.4, order bar 141.2+67.0, category bar 693.4+53.5_
- desktop 1440px: the page is long enough to test scrolling — _1675px of scroll_
- desktop 1440px: scrolled 606px — all three are pinned to the top, one under the other with no gap — _header 0.0+106.4, order bar 106.4+67.0, category bar 173.4+53.5_
- desktop 1440px: scrolled 1005px — all three are pinned to the top, one under the other with no gap — _header 0.0+106.4, order bar 106.4+67.0, category bar 173.4+53.5_
- desktop 1440px: scrolled 1635px — all three are pinned to the top, one under the other with no gap — _header 0.0+106.4, order bar 106.4+67.0, category bar 173.4+53.5_
- desktop 1440px: the pinned stack takes 227px of 900px — a small part of the screen — _25%_
- desktop 1440px: choosing a category scrolls to it just under the pinned bars (not hidden behind them) — _heading at 239px, pinned bars end at 227px_
- desktop 1440px: jumping to #menu leaves the menu below the pinned bars — _menu at 197px, bars end at 173px_

**Step 4 — phone: the order bar is slim**

- phone: the order bar is slim (the Takeaway/Delivery switch and the outlet share ONE row) — _61.0px high_
- phone: the switch and the outlet are side by side — _{"n":2,"spread":0,"right":376,"width":390}_
- phone: nothing runs off the screen's edge — _{"n":2,"spread":0,"right":376,"width":390}_
- a very narrow 320px phone: no sideways scroll, the outlet may drop under the switch — _0px over, bar 113px_

**Step 5 — overlays sit above the pinned bars**

- the outlet dropdown opens over the category bar and can be pressed — _{"overTool":true,"midIn":true,"top":180}_
- an item pop-up covers the header and the bars (they do not float above it) — _{"headerCovered":true,"barCovered":true}_
- the phone menu drawer opens over the pinned header and bars — _{"onBody":true,"over":true,"scrollLocked":true}_
- and the page behind it stops scrolling — _{"onBody":true,"over":true,"scrollLocked":true}_
- Escape closes the drawer

**Step 6 — other pages**

- the customer's Account page has the pinned header too — _sticky_

**Step 7 — all 15 header styles, phone**

- phone: header style "centered" (120px) stays pinned, with the order bar and category bar under it — _header 0.0+120.0, order bar 120.0+61.0, category bar 181.0+55.0_
- phone: "centered" — the pinned bars leave most of the screen free — _236px of 844px_
- phone: header style "left-logo" (69px) stays pinned, with the order bar and category bar under it — _header 0.0+69.0, order bar 69.0+61.0, category bar 130.0+55.0_
- phone: "left-logo" — the pinned bars leave most of the screen free — _185px of 844px_
- phone: header style "split-nav" (75px) stays pinned, with the order bar and category bar under it — _header 0.0+74.6, order bar 74.6+61.0, category bar 135.6+55.0_
- phone: "split-nav" — the pinned bars leave most of the screen free — _191px of 844px_
- phone: header style "minimal" (64px) stays pinned, with the order bar and category bar under it — _header 0.0+63.6, order bar 63.6+61.0, category bar 124.6+55.0_
- phone: "minimal" — the pinned bars leave most of the screen free — _180px of 844px_
- phone: header style "banner" is 237px tall — too tall to pin: it scrolls away and the order bar and category bar still pin to the top — _header -765.2+237.0, order bar 0.0+61.0, category bar 61.0+55.0_
- phone: "banner" — the pinned bars leave most of the screen free — _116px of 844px_
- phone: header style "two-row" (128px) stays pinned, with the order bar and category bar under it — _header 0.0+128.0, order bar 128.0+61.0, category bar 189.0+55.0_
- phone: "two-row" — the pinned bars leave most of the screen free — _244px of 844px_
- phone: header style "boxed" (73px) stays pinned, with the order bar and category bar under it — _header 0.0+73.0, order bar 73.0+61.0, category bar 134.0+55.0_
- phone: "boxed" — the pinned bars leave most of the screen free — _189px of 844px_
- phone: header style "stacked" is 195px tall — too tall to pin: it scrolls away and the order bar and category bar still pin to the top — _header -765.2+194.8, order bar 0.0+61.0, category bar 61.0+55.0_
- phone: "stacked" — the pinned bars leave most of the screen free — _116px of 844px_
- phone: header style "pill-nav" (61px) stays pinned, with the order bar and category bar under it — _header 0.0+61.0, order bar 61.0+61.0, category bar 122.0+55.0_
- phone: "pill-nav" — the pinned bars leave most of the screen free — _177px of 844px_
- phone: header style "floating" (74px) stays pinned, with the order bar and category bar under it — _header 0.0+74.0, order bar 74.0+61.0, category bar 135.0+55.0_
- phone: "floating" — the pinned bars leave most of the screen free — _190px of 844px_
- phone: header style "dark" (67px) stays pinned, with the order bar and category bar under it — _header 0.0+66.8, order bar 66.8+61.0, category bar 127.8+55.0_
- phone: "dark" — the pinned bars leave most of the screen free — _183px of 844px_
- phone: header style "underline" (69px) stays pinned, with the order bar and category bar under it — _header 0.0+69.0, order bar 69.0+61.0, category bar 130.0+55.0_
- phone: "underline" — the pinned bars leave most of the screen free — _185px of 844px_
- phone: header style "burger" (64px) stays pinned, with the order bar and category bar under it — _header 0.0+63.8, order bar 63.8+61.0, category bar 124.8+55.0_
- phone: "burger" — the pinned bars leave most of the screen free — _180px of 844px_
- phone: header style "tagline" (87px) stays pinned, with the order bar and category bar under it — _header 0.0+87.0, order bar 87.0+61.0, category bar 148.0+55.0_
- phone: "tagline" — the pinned bars leave most of the screen free — _203px of 844px_
- phone: header style "call-order" (93px) stays pinned, with the order bar and category bar under it — _header 0.0+93.0, order bar 93.0+61.0, category bar 154.0+55.0_
- phone: "call-order" — the pinned bars leave most of the screen free — _209px of 844px_

**Step 8 — all 15 header styles, desktop**

- desktop: header style "centered" (106px) stays pinned, with the order bar and category bar under it — _header 0.0+106.4, order bar 106.4+67.0, category bar 173.4+53.5_
- desktop: "centered" — the pinned bars leave most of the screen free — _227px of 900px_
- desktop: header style "left-logo" (67px) stays pinned, with the order bar and category bar under it — _header 0.0+67.0, order bar 67.0+67.0, category bar 134.0+53.5_
- desktop: "left-logo" — the pinned bars leave most of the screen free — _187px of 900px_
- desktop: header style "split-nav" (75px) stays pinned, with the order bar and category bar under it — _header 0.0+74.6, order bar 74.6+67.0, category bar 141.6+53.5_
- desktop: "split-nav" — the pinned bars leave most of the screen free — _195px of 900px_
- desktop: header style "minimal" (64px) stays pinned, with the order bar and category bar under it — _header 0.0+63.6, order bar 63.6+67.0, category bar 130.6+53.5_
- desktop: "minimal" — the pinned bars leave most of the screen free — _184px of 900px_
- desktop: header style "banner" is 223px tall — too tall to pin: it scrolls away and the order bar and category bar still pin to the top — _header -765.2+223.4, order bar 0.0+67.0, category bar 67.0+53.5_
- desktop: "banner" — the pinned bars leave most of the screen free — _120px of 900px_
- desktop: header style "two-row" (114px) stays pinned, with the order bar and category bar under it — _header 0.0+114.4, order bar 114.4+67.0, category bar 181.4+53.5_
- desktop: "two-row" — the pinned bars leave most of the screen free — _235px of 900px_
- desktop: header style "boxed" (73px) stays pinned, with the order bar and category bar under it — _header 0.0+73.0, order bar 73.0+67.0, category bar 140.0+53.5_
- desktop: "boxed" — the pinned bars leave most of the screen free — _193px of 900px_
- desktop: header style "stacked" is 178px tall — too tall to pin: it scrolls away and the order bar and category bar still pin to the top — _header -765.2+178.0, order bar 0.0+67.0, category bar 67.0+53.5_
- desktop: "stacked" — the pinned bars leave most of the screen free — _120px of 900px_
- desktop: header style "pill-nav" (71px) stays pinned, with the order bar and category bar under it — _header 0.0+70.6, order bar 70.6+67.0, category bar 137.6+53.5_
- desktop: "pill-nav" — the pinned bars leave most of the screen free — _191px of 900px_
- desktop: header style "floating" (70px) stays pinned, with the order bar and category bar under it — _header 0.0+70.0, order bar 70.0+67.0, category bar 137.0+53.5_
- desktop: "floating" — the pinned bars leave most of the screen free — _190px of 900px_
- desktop: header style "dark" (67px) stays pinned, with the order bar and category bar under it — _header 0.0+66.8, order bar 66.8+67.0, category bar 133.8+53.5_
- desktop: "dark" — the pinned bars leave most of the screen free — _187px of 900px_
- desktop: header style "underline" (67px) stays pinned, with the order bar and category bar under it — _header 0.0+67.0, order bar 67.0+67.0, category bar 134.0+53.5_
- desktop: "underline" — the pinned bars leave most of the screen free — _187px of 900px_
- desktop: header style "burger" (64px) stays pinned, with the order bar and category bar under it — _header 0.0+63.8, order bar 63.8+67.0, category bar 130.8+53.5_
- desktop: "burger" — the pinned bars leave most of the screen free — _184px of 900px_
- desktop: header style "tagline" (87px) stays pinned, with the order bar and category bar under it — _header 0.0+87.0, order bar 87.0+67.0, category bar 154.0+53.5_
- desktop: "tagline" — the pinned bars leave most of the screen free — _207px of 900px_
- desktop: header style "call-order" (71px) stays pinned, with the order bar and category bar under it — _header 0.0+70.6, order bar 70.6+67.0, category bar 137.6+53.5_
- desktop: "call-order" — the pinned bars leave most of the screen free — _191px of 900px_
- the browser logged no errors or warnings

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-21 15:11 | pass | 101 | 0 | headless | 1 min 41 s |
| 2026-11-21 14:25 | pass | 101 | 0 | headless | 1 min 38 s |
| 2026-11-21 04:59 | pass | 101 | 0 | headless | 1 min 25 s |
| 2026-11-21 01:12 | pass | 101 | 0 | headless | 1 min 23 s |
| 2026-11-21 00:15 | pass | 101 | 0 | headless | 1 min 22 s |
| 2026-11-20 06:07 | pass | 101 | 0 | headless | 1 min 57 s |
| 2026-11-20 05:03 | pass | 101 | 0 | headless | 1 min 17 s |
| 2026-11-20 04:04 | pass | 101 | 0 | headless | 1 min 56 s |
| 2026-11-20 03:57 | error | 28 | 0 | headless | 50.8 s |
| 2026-11-20 03:53 | fail | 21 | 7 | headless | 51.3 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t47-storefront-pinned-bars.mjs`), not this page._
