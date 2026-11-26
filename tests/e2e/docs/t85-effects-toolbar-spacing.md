# T85 — The storefront's category and filter strip has room inside its panel in every style effect (light and dark, laptop and phone)

**Area:** storefront · **Last result:** ✅ PASSED (105 passed, 0 failed · 2026-11-26 11:52 · headless · 1 min 10 s)

**Run it alone:** `node run.mjs --only t85` (add `--visible` to watch it)

## What this test does

Runs suites/effects-toolbar-spacing.mjs in Chrome against the bench store. For each style effect (Glass, Neumorphism, Claymorphism, Aurora, Cyberpunk, Dark Premium), in light and dark, on a laptop and a phone, the strip that holds the Veg / Non-veg filter chips and the categories is measured: the first and last controls must be at least 10px from the panel's left and right edges, there must be air above and below them, and the panel must be a finished shape (an edge all round and rounded corners). Under 'None' the strip is not a panel: it runs the width of the menu and its first chip lines up with the headings below.

## Steps

1. None
2. Glassmorphism
3. Neumorphism
4. Claymorphism
5. Aurora
6. Cyberpunk
7. Dark Premium

## What to expect (these must happen)

- In every effect, the filter chips and the category chips / button keep at least 10px from the strip's panel edges.
- The strip is drawn as a finished panel (edge all round, rounded corners) in every effect except None.

## What must NOT happen

- A chip must NOT touch or be cut by the edge of the strip's panel.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (105)

**Step 1 — None**

- None, laptop light: not drawn as a panel — the strip runs the width of the menu
- None, laptop light: the first chip lines up with the headings below it — _124px vs 124px_
- None, laptop dark: not drawn as a panel — the strip runs the width of the menu
- None, laptop dark: the first chip lines up with the headings below it — _124px vs 124px_
- None, phone light: not drawn as a panel — the strip runs the width of the menu
- None, phone light: the first chip lines up with the headings below it — _14px vs 14px_
- None, phone dark: not drawn as a panel — the strip runs the width of the menu
- None, phone dark: the first chip lines up with the headings below it — _14px vs 14px_

**Step 2 — Glassmorphism**

- Glassmorphism, laptop light: the first control is 15px from the panel's left edge (at least 10)
- Glassmorphism, laptop light: the last control is 226px from the panel's right edge (at least 10)
- Glassmorphism, laptop light: air above (11px) and below (11px) the controls
- Glassmorphism, laptop light: drawn as a finished panel — an edge all round and rounded corners — _radius 18px_
- Glassmorphism, laptop dark: the first control is 15px from the panel's left edge (at least 10)
- Glassmorphism, laptop dark: the last control is 226px from the panel's right edge (at least 10)
- Glassmorphism, laptop dark: air above (11px) and below (11px) the controls
- Glassmorphism, laptop dark: drawn as a finished panel — an edge all round and rounded corners — _radius 18px_
- Glassmorphism, phone light: the first control is 15px from the panel's left edge (at least 10)
- Glassmorphism, phone light: the last control is 15px from the panel's right edge (at least 10)
- Glassmorphism, phone light: air above (11px) and below (11px) the controls
- Glassmorphism, phone light: drawn as a finished panel — an edge all round and rounded corners — _radius 18px_
- Glassmorphism, phone dark: the first control is 15px from the panel's left edge (at least 10)
- Glassmorphism, phone dark: the last control is 15px from the panel's right edge (at least 10)
- Glassmorphism, phone dark: air above (11px) and below (11px) the controls
- Glassmorphism, phone dark: drawn as a finished panel — an edge all round and rounded corners — _radius 18px_

**Step 3 — Neumorphism**

- Neumorphism, laptop light: the first control is 15px from the panel's left edge (at least 10)
- Neumorphism, laptop light: the last control is 190px from the panel's right edge (at least 10)
- Neumorphism, laptop light: air above (11px) and below (11px) the controls
- Neumorphism, laptop light: drawn as a finished panel — an edge all round and rounded corners — _radius 18px_
- Neumorphism, laptop dark: the first control is 15px from the panel's left edge (at least 10)
- Neumorphism, laptop dark: the last control is 190px from the panel's right edge (at least 10)
- Neumorphism, laptop dark: air above (11px) and below (11px) the controls
- Neumorphism, laptop dark: drawn as a finished panel — an edge all round and rounded corners — _radius 18px_
- Neumorphism, phone light: the first control is 15px from the panel's left edge (at least 10)
- Neumorphism, phone light: the last control is 15px from the panel's right edge (at least 10)
- Neumorphism, phone light: air above (11px) and below (11px) the controls
- Neumorphism, phone light: drawn as a finished panel — an edge all round and rounded corners — _radius 18px_
- Neumorphism, phone dark: the first control is 15px from the panel's left edge (at least 10)
- Neumorphism, phone dark: the last control is 15px from the panel's right edge (at least 10)
- Neumorphism, phone dark: air above (11px) and below (11px) the controls
- Neumorphism, phone dark: drawn as a finished panel — an edge all round and rounded corners — _radius 18px_

**Step 4 — Claymorphism**

- Claymorphism, laptop light: the first control is 15px from the panel's left edge (at least 10)
- Claymorphism, laptop light: the last control is 190px from the panel's right edge (at least 10)
- Claymorphism, laptop light: air above (11px) and below (11px) the controls
- Claymorphism, laptop light: drawn as a finished panel — an edge all round and rounded corners — _radius 20px_
- Claymorphism, laptop dark: the first control is 15px from the panel's left edge (at least 10)
- Claymorphism, laptop dark: the last control is 190px from the panel's right edge (at least 10)
- Claymorphism, laptop dark: air above (11px) and below (11px) the controls
- Claymorphism, laptop dark: drawn as a finished panel — an edge all round and rounded corners — _radius 20px_
- Claymorphism, phone light: the first control is 15px from the panel's left edge (at least 10)
- Claymorphism, phone light: the last control is 15px from the panel's right edge (at least 10)
- Claymorphism, phone light: air above (11px) and below (11px) the controls
- Claymorphism, phone light: drawn as a finished panel — an edge all round and rounded corners — _radius 20px_
- Claymorphism, phone dark: the first control is 15px from the panel's left edge (at least 10)
- Claymorphism, phone dark: the last control is 15px from the panel's right edge (at least 10)
- Claymorphism, phone dark: air above (11px) and below (11px) the controls
- Claymorphism, phone dark: drawn as a finished panel — an edge all round and rounded corners — _radius 20px_

**Step 5 — Aurora**

- Aurora, laptop light: the first control is 15px from the panel's left edge (at least 10)
- Aurora, laptop light: the last control is 226px from the panel's right edge (at least 10)
- Aurora, laptop light: air above (11px) and below (11px) the controls
- Aurora, laptop light: drawn as a finished panel — an edge all round and rounded corners — _radius 18px_
- Aurora, laptop dark: the first control is 15px from the panel's left edge (at least 10)
- Aurora, laptop dark: the last control is 226px from the panel's right edge (at least 10)
- Aurora, laptop dark: air above (11px) and below (11px) the controls
- Aurora, laptop dark: drawn as a finished panel — an edge all round and rounded corners — _radius 18px_
- Aurora, phone light: the first control is 15px from the panel's left edge (at least 10)
- Aurora, phone light: the last control is 15px from the panel's right edge (at least 10)
- Aurora, phone light: air above (11px) and below (11px) the controls
- Aurora, phone light: drawn as a finished panel — an edge all round and rounded corners — _radius 18px_
- Aurora, phone dark: the first control is 15px from the panel's left edge (at least 10)
- Aurora, phone dark: the last control is 15px from the panel's right edge (at least 10)
- Aurora, phone dark: air above (11px) and below (11px) the controls
- Aurora, phone dark: drawn as a finished panel — an edge all round and rounded corners — _radius 18px_

**Step 6 — Cyberpunk**

- Cyberpunk, laptop light: the first control is 15px from the panel's left edge (at least 10)
- Cyberpunk, laptop light: the last control is 226px from the panel's right edge (at least 10)
- Cyberpunk, laptop light: air above (11px) and below (11px) the controls
- Cyberpunk, laptop light: drawn as a finished panel — an edge all round and rounded corners — _radius 6px_
- Cyberpunk, laptop dark: the first control is 15px from the panel's left edge (at least 10)
- Cyberpunk, laptop dark: the last control is 226px from the panel's right edge (at least 10)
- Cyberpunk, laptop dark: air above (11px) and below (11px) the controls
- Cyberpunk, laptop dark: drawn as a finished panel — an edge all round and rounded corners — _radius 6px_
- Cyberpunk, phone light: the first control is 15px from the panel's left edge (at least 10)
- Cyberpunk, phone light: the last control is 15px from the panel's right edge (at least 10)
- Cyberpunk, phone light: air above (11px) and below (11px) the controls
- Cyberpunk, phone light: drawn as a finished panel — an edge all round and rounded corners — _radius 6px_
- Cyberpunk, phone dark: the first control is 15px from the panel's left edge (at least 10)
- Cyberpunk, phone dark: the last control is 15px from the panel's right edge (at least 10)
- Cyberpunk, phone dark: air above (11px) and below (11px) the controls
- Cyberpunk, phone dark: drawn as a finished panel — an edge all round and rounded corners — _radius 6px_

**Step 7 — Dark Premium**

- Dark Premium, laptop light: the first control is 15px from the panel's left edge (at least 10)
- Dark Premium, laptop light: the last control is 226px from the panel's right edge (at least 10)
- Dark Premium, laptop light: air above (11px) and below (11px) the controls
- Dark Premium, laptop light: drawn as a finished panel — an edge all round and rounded corners — _radius 14px_
- Dark Premium, laptop dark: the first control is 15px from the panel's left edge (at least 10)
- Dark Premium, laptop dark: the last control is 226px from the panel's right edge (at least 10)
- Dark Premium, laptop dark: air above (11px) and below (11px) the controls
- Dark Premium, laptop dark: drawn as a finished panel — an edge all round and rounded corners — _radius 14px_
- Dark Premium, phone light: the first control is 15px from the panel's left edge (at least 10)
- Dark Premium, phone light: the last control is 15px from the panel's right edge (at least 10)
- Dark Premium, phone light: air above (11px) and below (11px) the controls
- Dark Premium, phone light: drawn as a finished panel — an edge all round and rounded corners — _radius 14px_
- Dark Premium, phone dark: the first control is 15px from the panel's left edge (at least 10)
- Dark Premium, phone dark: the last control is 15px from the panel's right edge (at least 10)
- Dark Premium, phone dark: air above (11px) and below (11px) the controls
- Dark Premium, phone dark: drawn as a finished panel — an edge all round and rounded corners — _radius 14px_
- no page errors

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-26 11:52 | pass | 105 | 0 | headless | 1 min 10 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t85-effects-toolbar-spacing.mjs`), not this page._
