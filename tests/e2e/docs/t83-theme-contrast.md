# T83 — Style effects (Glass, Neumorphism, Clay, Aurora, Cyberpunk, Dark Premium) in light and dark: no text or icon on the storefront loses contrast compared with 'None'

**Area:** storefront · **Last result:** ✅ PASSED (44 passed, 0 failed · 2026-11-27 11:05 · headless · 11 min 10 s)

**Run it alone:** `node run.mjs --only t83` (add `--visible` to watch it)

## What this test does

Runs suites/effects-contrast.mjs in Chrome against the bench store. For each effect (with its own suggested palette), in light and dark, with two brand colours (the reports' magenta, white text on buttons, on a laptop 1280px and a phone 390px; and a bright yellow, dark text on buttons, on the laptop), the storefront is scanned in many states: the home page top to bottom (header, order-type switch, filters, category chips, every card, View all, footer), the outlet list, the phone menu and category sheet, an open item pop-up, the cart bar, the checkout page, the account page, a store page and the table page. Every text and icon is listed with its real colour; then all text and icons are made invisible and the page is photographed, so the pixels really behind each one (blur, gradients, photos) give its contrast. Each element is compared with the same element under 'None' at its clearest scroll position: it is a problem when it falls below 3:1 where None does not, or below 4.5:1 where None is above it (and at least 1 point worse). Not measured: elements in the deliberate fade at the end of the scrolling category strip, elements covered by something, and the veg / egg / non-veg marks (a standard symbol that deliberately ignores the theme).

## Steps

1. magenta brand colour, laptop (1280px), light
2. magenta brand colour, laptop (1280px), dark
3. magenta brand colour, phone (390px), light
4. magenta brand colour, phone (390px), dark
5. yellow brand colour, laptop (1280px), light
6. yellow brand colour, laptop (1280px), dark

## What to expect (these must happen)

- In every effect, light and dark, on laptop and phone, no text or icon that is readable under 'None' becomes unreadable (below 3:1) or loses its 4.5:1.
- The selected Takeaway / Delivery tab, the current category chip, selected options and the active filter keep a readable label in every effect.

## What must NOT happen

- White text must NOT sit on a light effect surface (or dark on dark) because an effect replaced the background the label was designed for.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (44)

**Step 1 — magenta brand colour, laptop (1280px), light**

- magenta laptop light: every page state could be scanned
- magenta: Glassmorphism, laptop light: nothing loses contrast compared with None
- magenta: Neumorphism, laptop light: nothing loses contrast compared with None
- magenta: Claymorphism, laptop light: nothing loses contrast compared with None
- magenta: Aurora, laptop light: nothing loses contrast compared with None
- magenta: Cyberpunk, laptop light: nothing loses contrast compared with None
- magenta: Dark Premium, laptop light: nothing loses contrast compared with None

**Step 2 — magenta brand colour, laptop (1280px), dark**

- magenta laptop dark: every page state could be scanned
- magenta: Glassmorphism, laptop dark: nothing loses contrast compared with None
- magenta: Neumorphism, laptop dark: nothing loses contrast compared with None
- magenta: Claymorphism, laptop dark: nothing loses contrast compared with None
- magenta: Aurora, laptop dark: nothing loses contrast compared with None
- magenta: Cyberpunk, laptop dark: nothing loses contrast compared with None
- magenta: Dark Premium, laptop dark: nothing loses contrast compared with None

**Step 3 — magenta brand colour, phone (390px), light**

- magenta phone light: every page state could be scanned
- magenta: Glassmorphism, phone light: nothing loses contrast compared with None
- magenta: Neumorphism, phone light: nothing loses contrast compared with None
- magenta: Claymorphism, phone light: nothing loses contrast compared with None
- magenta: Aurora, phone light: nothing loses contrast compared with None
- magenta: Cyberpunk, phone light: nothing loses contrast compared with None
- magenta: Dark Premium, phone light: nothing loses contrast compared with None

**Step 4 — magenta brand colour, phone (390px), dark**

- magenta phone dark: every page state could be scanned
- magenta: Glassmorphism, phone dark: nothing loses contrast compared with None
- magenta: Neumorphism, phone dark: nothing loses contrast compared with None
- magenta: Claymorphism, phone dark: nothing loses contrast compared with None
- magenta: Aurora, phone dark: nothing loses contrast compared with None
- magenta: Cyberpunk, phone dark: nothing loses contrast compared with None
- magenta: Dark Premium, phone dark: nothing loses contrast compared with None

**Step 5 — yellow brand colour, laptop (1280px), light**

- yellow laptop light: every page state could be scanned
- yellow: Glassmorphism, laptop light: nothing loses contrast compared with None
- yellow: Neumorphism, laptop light: nothing loses contrast compared with None
- yellow: Claymorphism, laptop light: nothing loses contrast compared with None
- yellow: Aurora, laptop light: nothing loses contrast compared with None
- yellow: Cyberpunk, laptop light: nothing loses contrast compared with None
- yellow: Dark Premium, laptop light: nothing loses contrast compared with None

**Step 6 — yellow brand colour, laptop (1280px), dark**

- yellow laptop dark: every page state could be scanned
- yellow: Glassmorphism, laptop dark: nothing loses contrast compared with None
- yellow: Neumorphism, laptop dark: nothing loses contrast compared with None
- yellow: Claymorphism, laptop dark: nothing loses contrast compared with None
- yellow: Aurora, laptop dark: nothing loses contrast compared with None
- yellow: Cyberpunk, laptop dark: nothing loses contrast compared with None
- yellow: Dark Premium, laptop dark: nothing loses contrast compared with None
- the scan really looked at the page (many texts and icons measured) — _331 elements in the first reference scan_
- no page errors while scanning

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-27 11:05 | pass | 44 | 0 | headless | 11 min 10 s |
| 2026-11-26 11:59 | pass | 14 | 0 | headless | 3 min 20 s |
| 2026-11-26 11:45 | fail | 35 | 9 | headless | 11 min 31 s |
| 2026-11-26 11:32 | fail | 38 | 6 | headless | 11 min 28 s |
| 2026-11-26 11:19 | fail | 28 | 2 | headless | 7 min 37 s |
| 2026-11-26 11:08 | fail | 18 | 12 | headless | 7 min 37 s |
| 2026-11-26 10:57 | fail | 10 | 20 | headless | 7 min 30 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t83-theme-contrast.mjs`), not this page._
