# T81 — Menu cards resize with the screen (70–120% of their natural width) and the number per row follows — '3 a row' is only a maximum, nothing is cut off, squeezed or on top of another

**Area:** storefront · **Last result:** ✅ PASSED (449 passed, 0 failed · 2026-11-26 10:37 · headless · 36.8 s)

**Run it alone:** `node run.mjs --only t81` (add `--visible` to watch it)

## What this test does

Runs suites/storefront-card-columns.mjs in Chrome against the bench store. A custom menu layout has one section per card style (ten styles) set to '3 per row', one per grid style with NO number chosen, and sections set to 2, 4 and 1. Each is measured at 390, 600 (phones), 744, 820, 930 (tablets in portrait, 930 is the width of the reported screenshot), 1024 (tablet in landscape) and 1280px. The rule: each card style has a natural width (115% of its narrowest design width); a card is drawn between 70% and 120% of it, and when a whole number of cards cannot fit inside that window the NUMBER in the row changes instead; a number chosen by the store is the most there may be. The suite carries its own copy of the rule and checks, for every style and width: the number of columns, no card outside the row or on top of another, no card below 70% of its natural width (unless it is alone in its row), cards within 120% when fewer than the chosen number are shown, cards share the whole row, the page does not scroll sideways. The reported case (image overlay, which overlapped and ran past the screen edge on a tablet) is checked by name: 2 a row at 744px, 3 at 930 / 1024 / 1280px, 1 on a phone.

## Steps

1. 390px wide (a phone)
2. 600px wide (a phone)
3. 744px wide (a tablet in portrait)
4. 820px wide (a tablet in portrait)
5. 930px wide (a tablet in landscape)
6. 1024px wide (a tablet in landscape)
7. 1280px wide (a laptop)
8. The case from the report: image overlay (C07), 3 per row, on tablets

## What to expect (these must happen)

- Cards are drawn between 70% and 120% of their natural width; when that is not possible the number of cards in the row changes.
- '3 a row' never shows more than 3; a narrower screen shows fewer. 1 a row stays 1.
- Cards fill the row; none is cut off, overlaps another, or makes the page scroll sideways.

## What must NOT happen

- A card must NOT be squeezed below 70% of its natural width (unless it is alone in its row).
- A card must NOT be pushed past the right edge of the screen.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (449)

**Step 1 — 390px wide (a phone)**

- card.row-compact, 3 per row: 1 here (natural width 368px, row 362px) — _1 columns, cards 362px = 98%_
- card.row-compact: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.row-compact: no card squeezed below 70% of its natural width — _98%_
- card.row-thumb-left, 3 per row: 1 here (natural width 391px, row 362px) — _1 columns, cards 362px = 93%_
- card.row-thumb-left: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.row-thumb-left: no card squeezed below 70% of its natural width — _93%_
- card.row-thumb-right, 3 per row: 1 here (natural width 391px, row 362px) — _1 columns, cards 362px = 93%_
- card.row-thumb-right: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.row-thumb-right: no card squeezed below 70% of its natural width — _93%_
- card.image-top, 3 per row: 1 here (natural width 276px, row 362px) — _1 columns, cards 362px = 131%_
- card.image-top: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.image-top: no card squeezed below 70% of its natural width — _131%_
- card.image-top-badge, 3 per row: 1 here (natural width 276px, row 362px) — _1 columns, cards 362px = 131%_
- card.image-top-badge: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.image-top-badge: no card squeezed below 70% of its natural width — _131%_
- card.text-above-image, 3 per row: 1 here (natural width 299px, row 362px) — _1 columns, cards 362px = 121%_
- card.text-above-image: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.text-above-image: no card squeezed below 70% of its natural width — _121%_
- card.image-overlay, 3 per row: 1 here (natural width 299px, row 362px) — _1 columns, cards 362px = 121%_
- card.image-overlay: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.image-overlay: no card squeezed below 70% of its natural width — _121%_
- card.portrait, 3 per row: 2 here (natural width 241px, row 362px) — _2 columns, cards 175px = 73%_
- card.portrait: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.portrait: no card squeezed below 70% of its natural width — _73%_
- card.portrait: with fewer than the chosen 3, the cards stay within 120% — _73%_
- card.portrait: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.circle, 3 per row: 2 here (natural width 218px, row 362px) — _2 columns, cards 175px = 80%_
- card.circle: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.circle: no card squeezed below 70% of its natural width — _80%_
- card.circle: with fewer than the chosen 3, the cards stay within 120% — _80%_
- card.circle: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.menu-line, 3 per row: 1 here (natural width 322px, row 362px) — _1 columns, cards 362px = 112%_
- card.menu-line: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.menu-line: no card squeezed below 70% of its natural width — _112%_
- card.row-compact, no number chosen: 1 here, nothing cut off or overlapping — _1 columns, cards 98% of natural_
- card.row-compact, no number chosen: every card between 70% and 120% of its natural width — _98%_
- card.row-thumb-left, no number chosen: 1 here, nothing cut off or overlapping — _1 columns, cards 93% of natural_
- card.row-thumb-left, no number chosen: every card between 70% and 120% of its natural width — _93%_
- card.row-thumb-right, no number chosen: 1 here, nothing cut off or overlapping — _1 columns, cards 93% of natural_
- card.row-thumb-right, no number chosen: every card between 70% and 120% of its natural width — _93%_
- card.image-top, no number chosen: 1 here, nothing cut off or overlapping — _1 columns, cards 131% of natural_
- card.image-top, no number chosen: every card between 70% and 120% of its natural width — _131%_
- card.image-top-badge, no number chosen: 1 here, nothing cut off or overlapping — _1 columns, cards 131% of natural_
- card.image-top-badge, no number chosen: every card between 70% and 120% of its natural width — _131%_
- card.text-above-image, no number chosen: 1 here, nothing cut off or overlapping — _1 columns, cards 121% of natural_
- card.text-above-image, no number chosen: every card between 70% and 120% of its natural width — _121%_
- card.image-overlay, no number chosen: 1 here, nothing cut off or overlapping — _1 columns, cards 121% of natural_
- card.image-overlay, no number chosen: every card between 70% and 120% of its natural width — _121%_
- card.portrait, no number chosen: 2 here, nothing cut off or overlapping — _2 columns, cards 73% of natural_
- card.portrait, no number chosen: every card between 70% and 120% of its natural width — _73%_
- card.circle, no number chosen: 2 here, nothing cut off or overlapping — _2 columns, cards 80% of natural_
- card.circle, no number chosen: every card between 70% and 120% of its natural width — _80%_
- the page does not scroll sideways

**Step 2 — 600px wide (a phone)**

- card.row-compact, 3 per row: 2 here (natural width 368px, row 572px) — _2 columns, cards 280px = 76%_
- card.row-compact: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.row-compact: no card squeezed below 70% of its natural width — _76%_
- card.row-compact: with fewer than the chosen 3, the cards stay within 120% — _76%_
- card.row-compact: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.row-thumb-left, 3 per row: 2 here (natural width 391px, row 572px) — _2 columns, cards 280px = 72%_
- card.row-thumb-left: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.row-thumb-left: no card squeezed below 70% of its natural width — _72%_
- card.row-thumb-left: with fewer than the chosen 3, the cards stay within 120% — _72%_
- card.row-thumb-left: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.row-thumb-right, 3 per row: 2 here (natural width 391px, row 572px) — _2 columns, cards 280px = 72%_
- card.row-thumb-right: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.row-thumb-right: no card squeezed below 70% of its natural width — _72%_
- card.row-thumb-right: with fewer than the chosen 3, the cards stay within 120% — _72%_
- card.row-thumb-right: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.image-top, 3 per row: 2 here (natural width 276px, row 572px) — _2 columns, cards 280px = 101%_
- card.image-top: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.image-top: no card squeezed below 70% of its natural width — _101%_
- card.image-top: with fewer than the chosen 3, the cards stay within 120% — _101%_
- card.image-top: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.image-top-badge, 3 per row: 2 here (natural width 276px, row 572px) — _2 columns, cards 280px = 101%_
- card.image-top-badge: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.image-top-badge: no card squeezed below 70% of its natural width — _101%_
- card.image-top-badge: with fewer than the chosen 3, the cards stay within 120% — _101%_
- card.image-top-badge: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.text-above-image, 3 per row: 2 here (natural width 299px, row 572px) — _2 columns, cards 280px = 94%_
- card.text-above-image: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.text-above-image: no card squeezed below 70% of its natural width — _94%_
- card.text-above-image: with fewer than the chosen 3, the cards stay within 120% — _94%_
- card.text-above-image: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.image-overlay, 3 per row: 2 here (natural width 299px, row 572px) — _2 columns, cards 280px = 94%_
- card.image-overlay: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.image-overlay: no card squeezed below 70% of its natural width — _94%_
- card.image-overlay: with fewer than the chosen 3, the cards stay within 120% — _94%_
- card.image-overlay: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.portrait, 3 per row: 2 here (natural width 241px, row 572px) — _2 columns, cards 280px = 116%_
- card.portrait: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.portrait: no card squeezed below 70% of its natural width — _116%_
- card.portrait: with fewer than the chosen 3, the cards stay within 120% — _116%_
- card.portrait: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.circle, 3 per row: 3 here (natural width 218px, row 572px) — _3 columns, cards 183px = 84%_
- card.circle: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.circle: no card squeezed below 70% of its natural width — _84%_
- card.circle: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.menu-line, 3 per row: 2 here (natural width 322px, row 572px) — _2 columns, cards 280px = 87%_
- card.menu-line: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.menu-line: no card squeezed below 70% of its natural width — _87%_
- card.menu-line: with fewer than the chosen 3, the cards stay within 120% — _87%_
- card.menu-line: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.row-compact, no number chosen: 2 here, nothing cut off or overlapping — _2 columns, cards 76% of natural_
- card.row-compact, no number chosen: every card between 70% and 120% of its natural width — _76%_
- card.row-thumb-left, no number chosen: 2 here, nothing cut off or overlapping — _2 columns, cards 72% of natural_
- card.row-thumb-left, no number chosen: every card between 70% and 120% of its natural width — _72%_
- card.row-thumb-right, no number chosen: 2 here, nothing cut off or overlapping — _2 columns, cards 72% of natural_
- card.row-thumb-right, no number chosen: every card between 70% and 120% of its natural width — _72%_
- card.image-top, no number chosen: 2 here, nothing cut off or overlapping — _2 columns, cards 101% of natural_
- card.image-top, no number chosen: every card between 70% and 120% of its natural width — _101%_
- card.image-top-badge, no number chosen: 2 here, nothing cut off or overlapping — _2 columns, cards 101% of natural_
- card.image-top-badge, no number chosen: every card between 70% and 120% of its natural width — _101%_
- card.text-above-image, no number chosen: 2 here, nothing cut off or overlapping — _2 columns, cards 94% of natural_
- card.text-above-image, no number chosen: every card between 70% and 120% of its natural width — _94%_
- card.image-overlay, no number chosen: 2 here, nothing cut off or overlapping — _2 columns, cards 94% of natural_
- card.image-overlay, no number chosen: every card between 70% and 120% of its natural width — _94%_
- card.portrait, no number chosen: 2 here, nothing cut off or overlapping — _2 columns, cards 116% of natural_
- card.portrait, no number chosen: every card between 70% and 120% of its natural width — _116%_
- card.circle, no number chosen: 3 here, nothing cut off or overlapping — _3 columns, cards 84% of natural_
- card.circle, no number chosen: every card between 70% and 120% of its natural width — _84%_
- the page does not scroll sideways

**Step 3 — 744px wide (a tablet in portrait)**

- card.row-compact, 3 per row: 2 here (natural width 368px, row 716px) — _2 columns, cards 352px = 96%_
- card.row-compact: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.row-compact: no card squeezed below 70% of its natural width — _96%_
- card.row-compact: with fewer than the chosen 3, the cards stay within 120% — _96%_
- card.row-compact: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.row-thumb-left, 3 per row: 2 here (natural width 391px, row 716px) — _2 columns, cards 352px = 90%_
- card.row-thumb-left: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.row-thumb-left: no card squeezed below 70% of its natural width — _90%_
- card.row-thumb-left: with fewer than the chosen 3, the cards stay within 120% — _90%_
- card.row-thumb-left: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.row-thumb-right, 3 per row: 2 here (natural width 391px, row 716px) — _2 columns, cards 352px = 90%_
- card.row-thumb-right: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.row-thumb-right: no card squeezed below 70% of its natural width — _90%_
- card.row-thumb-right: with fewer than the chosen 3, the cards stay within 120% — _90%_
- card.row-thumb-right: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.image-top, 3 per row: 3 here (natural width 276px, row 716px) — _3 columns, cards 231px = 84%_
- card.image-top: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.image-top: no card squeezed below 70% of its natural width — _84%_
- card.image-top: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.image-top-badge, 3 per row: 3 here (natural width 276px, row 716px) — _3 columns, cards 231px = 84%_
- card.image-top-badge: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.image-top-badge: no card squeezed below 70% of its natural width — _84%_
- card.image-top-badge: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.text-above-image, 3 per row: 2 here (natural width 299px, row 716px) — _2 columns, cards 352px = 118%_
- card.text-above-image: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.text-above-image: no card squeezed below 70% of its natural width — _118%_
- card.text-above-image: with fewer than the chosen 3, the cards stay within 120% — _118%_
- card.text-above-image: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.image-overlay, 3 per row: 2 here (natural width 299px, row 716px) — _2 columns, cards 352px = 118%_
- card.image-overlay: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.image-overlay: no card squeezed below 70% of its natural width — _118%_
- card.image-overlay: with fewer than the chosen 3, the cards stay within 120% — _118%_
- card.image-overlay: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.portrait, 3 per row: 3 here (natural width 241px, row 716px) — _3 columns, cards 231px = 96%_
- card.portrait: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.portrait: no card squeezed below 70% of its natural width — _96%_
- card.portrait: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.circle, 3 per row: 3 here (natural width 218px, row 716px) — _3 columns, cards 231px = 106%_
- card.circle: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.circle: no card squeezed below 70% of its natural width — _106%_
- card.circle: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.menu-line, 3 per row: 2 here (natural width 322px, row 716px) — _2 columns, cards 352px = 109%_
- card.menu-line: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.menu-line: no card squeezed below 70% of its natural width — _109%_
- card.menu-line: with fewer than the chosen 3, the cards stay within 120% — _109%_
- card.menu-line: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.row-compact, no number chosen: 2 here, nothing cut off or overlapping — _2 columns, cards 96% of natural_
- card.row-compact, no number chosen: every card between 70% and 120% of its natural width — _96%_
- card.row-thumb-left, no number chosen: 2 here, nothing cut off or overlapping — _2 columns, cards 90% of natural_
- card.row-thumb-left, no number chosen: every card between 70% and 120% of its natural width — _90%_
- card.row-thumb-right, no number chosen: 2 here, nothing cut off or overlapping — _2 columns, cards 90% of natural_
- card.row-thumb-right, no number chosen: every card between 70% and 120% of its natural width — _90%_
- card.image-top, no number chosen: 3 here, nothing cut off or overlapping — _3 columns, cards 84% of natural_
- card.image-top, no number chosen: every card between 70% and 120% of its natural width — _84%_
- card.image-top-badge, no number chosen: 3 here, nothing cut off or overlapping — _3 columns, cards 84% of natural_
- card.image-top-badge, no number chosen: every card between 70% and 120% of its natural width — _84%_
- card.text-above-image, no number chosen: 2 here, nothing cut off or overlapping — _2 columns, cards 118% of natural_
- card.text-above-image, no number chosen: every card between 70% and 120% of its natural width — _118%_
- card.image-overlay, no number chosen: 2 here, nothing cut off or overlapping — _2 columns, cards 118% of natural_
- card.image-overlay, no number chosen: every card between 70% and 120% of its natural width — _118%_
- card.portrait, no number chosen: 3 here, nothing cut off or overlapping — _3 columns, cards 96% of natural_
- card.portrait, no number chosen: every card between 70% and 120% of its natural width — _96%_
- card.circle, no number chosen: 3 here, nothing cut off or overlapping — _3 columns, cards 106% of natural_
- card.circle, no number chosen: every card between 70% and 120% of its natural width — _106%_
- the page does not scroll sideways
- 2 per row (image on top): 2 here — _row 716px_
- 4 per row (image on top): 3 here, nothing cut off — _row 716px_
- 1 per row stays 1 at every width

**Step 4 — 820px wide (a tablet in portrait)**

- card.row-compact, 3 per row: 2 here (natural width 368px, row 792px) — _2 columns, cards 390px = 106%_
- card.row-compact: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.row-compact: no card squeezed below 70% of its natural width — _106%_
- card.row-compact: with fewer than the chosen 3, the cards stay within 120% — _106%_
- card.row-compact: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.row-thumb-left, 3 per row: 2 here (natural width 391px, row 792px) — _2 columns, cards 390px = 100%_
- card.row-thumb-left: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.row-thumb-left: no card squeezed below 70% of its natural width — _100%_
- card.row-thumb-left: with fewer than the chosen 3, the cards stay within 120% — _100%_
- card.row-thumb-left: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.row-thumb-right, 3 per row: 2 here (natural width 391px, row 792px) — _2 columns, cards 390px = 100%_
- card.row-thumb-right: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.row-thumb-right: no card squeezed below 70% of its natural width — _100%_
- card.row-thumb-right: with fewer than the chosen 3, the cards stay within 120% — _100%_
- card.row-thumb-right: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.image-top, 3 per row: 3 here (natural width 276px, row 792px) — _3 columns, cards 256px = 93%_
- card.image-top: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.image-top: no card squeezed below 70% of its natural width — _93%_
- card.image-top: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.image-top-badge, 3 per row: 3 here (natural width 276px, row 792px) — _3 columns, cards 256px = 93%_
- card.image-top-badge: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.image-top-badge: no card squeezed below 70% of its natural width — _93%_
- card.image-top-badge: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.text-above-image, 3 per row: 3 here (natural width 299px, row 792px) — _3 columns, cards 256px = 86%_
- card.text-above-image: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.text-above-image: no card squeezed below 70% of its natural width — _86%_
- card.text-above-image: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.image-overlay, 3 per row: 3 here (natural width 299px, row 792px) — _3 columns, cards 256px = 86%_
- card.image-overlay: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.image-overlay: no card squeezed below 70% of its natural width — _86%_
- card.image-overlay: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.portrait, 3 per row: 3 here (natural width 241px, row 792px) — _3 columns, cards 256px = 106%_
- card.portrait: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.portrait: no card squeezed below 70% of its natural width — _106%_
- card.portrait: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.circle, 3 per row: 3 here (natural width 218px, row 792px) — _3 columns, cards 256px = 117%_
- card.circle: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.circle: no card squeezed below 70% of its natural width — _117%_
- card.circle: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.menu-line, 3 per row: 3 here (natural width 322px, row 792px) — _3 columns, cards 256px = 80%_
- card.menu-line: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.menu-line: no card squeezed below 70% of its natural width — _80%_
- card.menu-line: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.row-compact, no number chosen: 2 here, nothing cut off or overlapping — _2 columns, cards 106% of natural_
- card.row-compact, no number chosen: every card between 70% and 120% of its natural width — _106%_
- card.row-thumb-left, no number chosen: 2 here, nothing cut off or overlapping — _2 columns, cards 100% of natural_
- card.row-thumb-left, no number chosen: every card between 70% and 120% of its natural width — _100%_
- card.row-thumb-right, no number chosen: 2 here, nothing cut off or overlapping — _2 columns, cards 100% of natural_
- card.row-thumb-right, no number chosen: every card between 70% and 120% of its natural width — _100%_
- card.image-top, no number chosen: 3 here, nothing cut off or overlapping — _3 columns, cards 93% of natural_
- card.image-top, no number chosen: every card between 70% and 120% of its natural width — _93%_
- card.image-top-badge, no number chosen: 3 here, nothing cut off or overlapping — _3 columns, cards 93% of natural_
- card.image-top-badge, no number chosen: every card between 70% and 120% of its natural width — _93%_
- card.text-above-image, no number chosen: 3 here, nothing cut off or overlapping — _3 columns, cards 86% of natural_
- card.text-above-image, no number chosen: every card between 70% and 120% of its natural width — _86%_
- card.image-overlay, no number chosen: 3 here, nothing cut off or overlapping — _3 columns, cards 86% of natural_
- card.image-overlay, no number chosen: every card between 70% and 120% of its natural width — _86%_
- card.portrait, no number chosen: 3 here, nothing cut off or overlapping — _3 columns, cards 106% of natural_
- card.portrait, no number chosen: every card between 70% and 120% of its natural width — _106%_
- card.circle, no number chosen: 4 here, nothing cut off or overlapping — _4 columns, cards 87% of natural_
- card.circle, no number chosen: every card between 70% and 120% of its natural width — _87%_
- the page does not scroll sideways
- 2 per row (image on top): 2 here — _row 792px_
- 4 per row (image on top): 3 here, nothing cut off — _row 792px_
- 1 per row stays 1 at every width

**Step 5 — 930px wide (a tablet in landscape)**

- card.row-compact, 3 per row: 3 here (natural width 368px, row 902px) — _3 columns, cards 293px = 80%_
- card.row-compact: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.row-compact: no card squeezed below 70% of its natural width — _80%_
- card.row-compact: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.row-thumb-left, 3 per row: 2 here (natural width 391px, row 902px) — _2 columns, cards 445px = 114%_
- card.row-thumb-left: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.row-thumb-left: no card squeezed below 70% of its natural width — _114%_
- card.row-thumb-left: with fewer than the chosen 3, the cards stay within 120% — _114%_
- card.row-thumb-left: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.row-thumb-right, 3 per row: 2 here (natural width 391px, row 902px) — _2 columns, cards 445px = 114%_
- card.row-thumb-right: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.row-thumb-right: no card squeezed below 70% of its natural width — _114%_
- card.row-thumb-right: with fewer than the chosen 3, the cards stay within 120% — _114%_
- card.row-thumb-right: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.image-top, 3 per row: 3 here (natural width 276px, row 902px) — _3 columns, cards 293px = 106%_
- card.image-top: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.image-top: no card squeezed below 70% of its natural width — _106%_
- card.image-top: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.image-top-badge, 3 per row: 3 here (natural width 276px, row 902px) — _3 columns, cards 293px = 106%_
- card.image-top-badge: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.image-top-badge: no card squeezed below 70% of its natural width — _106%_
- card.image-top-badge: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.text-above-image, 3 per row: 3 here (natural width 299px, row 902px) — _3 columns, cards 293px = 98%_
- card.text-above-image: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.text-above-image: no card squeezed below 70% of its natural width — _98%_
- card.text-above-image: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.image-overlay, 3 per row: 3 here (natural width 299px, row 902px) — _3 columns, cards 293px = 98%_
- card.image-overlay: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.image-overlay: no card squeezed below 70% of its natural width — _98%_
- card.image-overlay: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.portrait, 3 per row: 3 here (natural width 241px, row 902px) — _3 columns, cards 293px = 121%_
- card.portrait: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.portrait: no card squeezed below 70% of its natural width — _121%_
- card.portrait: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.circle, 3 per row: 3 here (natural width 218px, row 902px) — _3 columns, cards 293px = 134%_
- card.circle: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.circle: no card squeezed below 70% of its natural width — _134%_
- card.circle: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.menu-line, 3 per row: 3 here (natural width 322px, row 902px) — _3 columns, cards 293px = 91%_
- card.menu-line: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.menu-line: no card squeezed below 70% of its natural width — _91%_
- card.menu-line: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.row-compact, no number chosen: 3 here, nothing cut off or overlapping — _3 columns, cards 80% of natural_
- card.row-compact, no number chosen: every card between 70% and 120% of its natural width — _80%_
- card.row-thumb-left, no number chosen: 2 here, nothing cut off or overlapping — _2 columns, cards 114% of natural_
- card.row-thumb-left, no number chosen: every card between 70% and 120% of its natural width — _114%_
- card.row-thumb-right, no number chosen: 2 here, nothing cut off or overlapping — _2 columns, cards 114% of natural_
- card.row-thumb-right, no number chosen: every card between 70% and 120% of its natural width — _114%_
- card.image-top, no number chosen: 3 here, nothing cut off or overlapping — _3 columns, cards 106% of natural_
- card.image-top, no number chosen: every card between 70% and 120% of its natural width — _106%_
- card.image-top-badge, no number chosen: 3 here, nothing cut off or overlapping — _3 columns, cards 106% of natural_
- card.image-top-badge, no number chosen: every card between 70% and 120% of its natural width — _106%_
- card.text-above-image, no number chosen: 3 here, nothing cut off or overlapping — _3 columns, cards 98% of natural_
- card.text-above-image, no number chosen: every card between 70% and 120% of its natural width — _98%_
- card.image-overlay, no number chosen: 3 here, nothing cut off or overlapping — _3 columns, cards 98% of natural_
- card.image-overlay, no number chosen: every card between 70% and 120% of its natural width — _98%_
- card.portrait, no number chosen: 4 here, nothing cut off or overlapping — _4 columns, cards 90% of natural_
- card.portrait, no number chosen: every card between 70% and 120% of its natural width — _90%_
- card.circle, no number chosen: 4 here, nothing cut off or overlapping — _4 columns, cards 99% of natural_
- card.circle, no number chosen: every card between 70% and 120% of its natural width — _99%_
- the page does not scroll sideways
- 2 per row (image on top): 2 here — _row 902px_
- 4 per row (image on top): 3 here, nothing cut off — _row 902px_
- 1 per row stays 1 at every width

**Step 6 — 1024px wide (a tablet in landscape)**

- card.row-compact, 3 per row: 3 here (natural width 368px, row 976px) — _3 columns, cards 317px = 86%_
- card.row-compact: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.row-compact: no card squeezed below 70% of its natural width — _86%_
- card.row-compact: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.row-thumb-left, 3 per row: 3 here (natural width 391px, row 976px) — _3 columns, cards 317px = 81%_
- card.row-thumb-left: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.row-thumb-left: no card squeezed below 70% of its natural width — _81%_
- card.row-thumb-left: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.row-thumb-right, 3 per row: 3 here (natural width 391px, row 976px) — _3 columns, cards 317px = 81%_
- card.row-thumb-right: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.row-thumb-right: no card squeezed below 70% of its natural width — _81%_
- card.row-thumb-right: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.image-top, 3 per row: 3 here (natural width 276px, row 976px) — _3 columns, cards 317px = 115%_
- card.image-top: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.image-top: no card squeezed below 70% of its natural width — _115%_
- card.image-top: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.image-top-badge, 3 per row: 3 here (natural width 276px, row 976px) — _3 columns, cards 317px = 115%_
- card.image-top-badge: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.image-top-badge: no card squeezed below 70% of its natural width — _115%_
- card.image-top-badge: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.text-above-image, 3 per row: 3 here (natural width 299px, row 976px) — _3 columns, cards 317px = 106%_
- card.text-above-image: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.text-above-image: no card squeezed below 70% of its natural width — _106%_
- card.text-above-image: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.image-overlay, 3 per row: 3 here (natural width 299px, row 976px) — _3 columns, cards 317px = 106%_
- card.image-overlay: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.image-overlay: no card squeezed below 70% of its natural width — _106%_
- card.image-overlay: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.portrait, 3 per row: 3 here (natural width 241px, row 976px) — _3 columns, cards 317px = 132%_
- card.portrait: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.portrait: no card squeezed below 70% of its natural width — _132%_
- card.portrait: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.circle, 3 per row: 3 here (natural width 218px, row 976px) — _3 columns, cards 317px = 146%_
- card.circle: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.circle: no card squeezed below 70% of its natural width — _146%_
- card.circle: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.menu-line, 3 per row: 3 here (natural width 322px, row 976px) — _3 columns, cards 317px = 99%_
- card.menu-line: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.menu-line: no card squeezed below 70% of its natural width — _99%_
- card.menu-line: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.row-compact, no number chosen: 3 here, nothing cut off or overlapping — _3 columns, cards 86% of natural_
- card.row-compact, no number chosen: every card between 70% and 120% of its natural width — _86%_
- card.row-thumb-left, no number chosen: 3 here, nothing cut off or overlapping — _3 columns, cards 81% of natural_
- card.row-thumb-left, no number chosen: every card between 70% and 120% of its natural width — _81%_
- card.row-thumb-right, no number chosen: 3 here, nothing cut off or overlapping — _3 columns, cards 81% of natural_
- card.row-thumb-right, no number chosen: every card between 70% and 120% of its natural width — _81%_
- card.image-top, no number chosen: 3 here, nothing cut off or overlapping — _3 columns, cards 115% of natural_
- card.image-top, no number chosen: every card between 70% and 120% of its natural width — _115%_
- card.image-top-badge, no number chosen: 3 here, nothing cut off or overlapping — _3 columns, cards 115% of natural_
- card.image-top-badge, no number chosen: every card between 70% and 120% of its natural width — _115%_
- card.text-above-image, no number chosen: 3 here, nothing cut off or overlapping — _3 columns, cards 106% of natural_
- card.text-above-image, no number chosen: every card between 70% and 120% of its natural width — _106%_
- card.image-overlay, no number chosen: 3 here, nothing cut off or overlapping — _3 columns, cards 106% of natural_
- card.image-overlay, no number chosen: every card between 70% and 120% of its natural width — _106%_
- card.portrait, no number chosen: 4 here, nothing cut off or overlapping — _4 columns, cards 98% of natural_
- card.portrait, no number chosen: every card between 70% and 120% of its natural width — _98%_
- card.circle, no number chosen: 4 here, nothing cut off or overlapping — _4 columns, cards 108% of natural_
- card.circle, no number chosen: every card between 70% and 120% of its natural width — _108%_
- the page does not scroll sideways
- 2 per row (image on top): 2 here — _row 976px_
- 4 per row (image on top): 3 here, nothing cut off — _row 976px_
- 1 per row stays 1 at every width

**Step 7 — 1280px wide (a laptop)**

- card.row-compact, 3 per row: 3 here (natural width 368px, row 1032px) — _3 columns, cards 336px = 91%_
- card.row-compact: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.row-compact: no card squeezed below 70% of its natural width — _91%_
- card.row-compact: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.row-thumb-left, 3 per row: 3 here (natural width 391px, row 1032px) — _3 columns, cards 336px = 86%_
- card.row-thumb-left: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.row-thumb-left: no card squeezed below 70% of its natural width — _86%_
- card.row-thumb-left: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.row-thumb-right, 3 per row: 3 here (natural width 391px, row 1032px) — _3 columns, cards 336px = 86%_
- card.row-thumb-right: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.row-thumb-right: no card squeezed below 70% of its natural width — _86%_
- card.row-thumb-right: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.image-top, 3 per row: 3 here (natural width 276px, row 1032px) — _3 columns, cards 336px = 122%_
- card.image-top: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.image-top: no card squeezed below 70% of its natural width — _122%_
- card.image-top: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.image-top-badge, 3 per row: 3 here (natural width 276px, row 1032px) — _3 columns, cards 336px = 122%_
- card.image-top-badge: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.image-top-badge: no card squeezed below 70% of its natural width — _122%_
- card.image-top-badge: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.text-above-image, 3 per row: 3 here (natural width 299px, row 1032px) — _3 columns, cards 336px = 112%_
- card.text-above-image: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.text-above-image: no card squeezed below 70% of its natural width — _112%_
- card.text-above-image: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.image-overlay, 3 per row: 3 here (natural width 299px, row 1032px) — _3 columns, cards 336px = 112%_
- card.image-overlay: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.image-overlay: no card squeezed below 70% of its natural width — _112%_
- card.image-overlay: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.portrait, 3 per row: 3 here (natural width 241px, row 1032px) — _3 columns, cards 336px = 139%_
- card.portrait: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.portrait: no card squeezed below 70% of its natural width — _139%_
- card.portrait: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.circle, 3 per row: 3 here (natural width 218px, row 1032px) — _3 columns, cards 336px = 154%_
- card.circle: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.circle: no card squeezed below 70% of its natural width — _154%_
- card.circle: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.menu-line, 3 per row: 3 here (natural width 322px, row 1032px) — _3 columns, cards 336px = 104%_
- card.menu-line: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.menu-line: no card squeezed below 70% of its natural width — _104%_
- card.menu-line: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.row-compact, no number chosen: 3 here, nothing cut off or overlapping — _3 columns, cards 91% of natural_
- card.row-compact, no number chosen: every card between 70% and 120% of its natural width — _91%_
- card.row-thumb-left, no number chosen: 3 here, nothing cut off or overlapping — _3 columns, cards 86% of natural_
- card.row-thumb-left, no number chosen: every card between 70% and 120% of its natural width — _86%_
- card.row-thumb-right, no number chosen: 3 here, nothing cut off or overlapping — _3 columns, cards 86% of natural_
- card.row-thumb-right, no number chosen: every card between 70% and 120% of its natural width — _86%_
- card.image-top, no number chosen: 4 here, nothing cut off or overlapping — _4 columns, cards 90% of natural_
- card.image-top, no number chosen: every card between 70% and 120% of its natural width — _90%_
- card.image-top-badge, no number chosen: 4 here, nothing cut off or overlapping — _4 columns, cards 90% of natural_
- card.image-top-badge, no number chosen: every card between 70% and 120% of its natural width — _90%_
- card.text-above-image, no number chosen: 3 here, nothing cut off or overlapping — _3 columns, cards 112% of natural_
- card.text-above-image, no number chosen: every card between 70% and 120% of its natural width — _112%_
- card.image-overlay, no number chosen: 3 here, nothing cut off or overlapping — _3 columns, cards 112% of natural_
- card.image-overlay, no number chosen: every card between 70% and 120% of its natural width — _112%_
- card.portrait, no number chosen: 4 here, nothing cut off or overlapping — _4 columns, cards 103% of natural_
- card.portrait, no number chosen: every card between 70% and 120% of its natural width — _103%_
- card.circle, no number chosen: 5 here, nothing cut off or overlapping — _5 columns, cards 90% of natural_
- card.circle, no number chosen: every card between 70% and 120% of its natural width — _90%_
- the page does not scroll sideways
- 2 per row (image on top): 2 here — _row 1032px_
- 4 per row (image on top): 4 here, nothing cut off — _row 1032px_
- 1 per row stays 1 at every width

**Step 8 — The case from the report: image overlay (C07), 3 per row, on tablets**

- phone (390px): 1 a row — _1_
- tablet in portrait (744px): 2 a row — three would be squeezed below 70% — _2, cards 118%_
- 930px wide (the report's screenshot): 3 a row, all inside the row (they used to overlap and run past the edge) — _3 columns, cards 293px_
- tablet in landscape and laptop: 3 a row
- from a tablet up, the cards are never smaller than 70% of their natural width
- the test category is removed and the menu layout is put back — _200_
- the browser logged no errors or warnings

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-26 10:37 | pass | 449 | 0 | headless | 36.8 s |
| 2026-11-26 10:35 | fail | 431 | 18 | headless | 38.3 s |
| 2026-11-26 10:31 | fail | 446 | 3 | headless | 40.9 s |
| 2026-11-25 12:01 | pass | 163 | 0 | headless | 15.9 s |
| 2026-11-25 10:50 | pass | 163 | 0 | headless | 18.2 s |
| 2026-11-25 10:43 | pass | 163 | 0 | headless | 21.7 s |
| 2026-11-25 10:40 | fail | 161 | 2 | headless | 19.4 s |
| 2026-11-25 10:35 | pass | 163 | 0 | headless | 17.6 s |
| 2026-11-25 10:29 | fail | 144 | 19 | headless | 17.1 s |
| 2026-11-25 10:23 | pass | 163 | 0 | headless | 19.0 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t81-storefront-card-columns.mjs`), not this page._
