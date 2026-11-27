# T86 — The header menu highlights the page you're on in every header style (laptop menu and phone slide-in menu), on by default, and the owner can switch it off

**Area:** storefront · **Last result:** ✅ PASSED (81 passed, 0 failed · 2026-11-27 11:06 · headless · 44.2 s)

**Run it alone:** `node run.mjs --only t86` (add `--visible` to watch it)

## What this test does

Runs suites/header-current-page.mjs in Chrome against the bench store. The suite reads the registry, so every header style that exists is covered (the 'Minimal' one has no menu). Each style is set through the API; on the menu page 'Menu' must be the one marked link, on the account page 'My orders', on a store page that page's own link — and the marked link must really look different from the others (colour, weight, underline, fill), not only carry a hidden attribute. On a phone the same is checked in the slide-in menu (a burger-only header shows its panel on the laptop too). With 'Highlight the page you're on' switched off nothing is marked anywhere (laptop and phone); switched on again it comes back. A store that never chose gets it ON. A link the owner added is marked on the page it goes to; a link to another website or an in-page jump never is.

## Steps

1. Every header style is covered
2. header.centered
3. header.left-logo
4. header.split-nav
5. header.minimal
6. header.banner
7. header.two-row
8. header.boxed
9. header.stacked
10. header.pill-nav
11. header.floating
12. header.dark
13. header.underline
14. header.burger
15. header.tagline
16. header.call-order
17. The owner can switch it off
18. The default, and the store's own links

## What to expect (these must happen)

- In every header style with a menu: exactly the link of the current page is marked (aria-current=page) and looks different from the others, on the laptop and in the phone's slide-in menu.
- With the setting switched off, no link is marked. The default is ON.

## What must NOT happen

- More than one link must NOT be marked, and a link to another site or an in-page jump must NOT be marked.
- The marked link must NOT look identical to the others.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (81)

**Step 1 — Every header style is covered**

- the registry has 15 header styles

**Step 2 — header.centered**

- header.centered: on the menu page, "Menu" is the marked link — _["Menu"]_
- header.centered: it looks different from the other links (not just a hidden attribute)
- header.centered: on the account page it is "My orders" (and only that) — _["My orders"]_
- header.centered: on a store page it is that page's own link — _["About us"]_
- header.centered: in the phone's slide-in menu the current link is marked and stands out — _["Menu"]_

**Step 3 — header.left-logo**

- header.left-logo: on the menu page, "Menu" is the marked link — _["Menu"]_
- header.left-logo: it looks different from the other links (not just a hidden attribute)
- header.left-logo: on the account page it is "My orders" (and only that) — _["My orders"]_
- header.left-logo: on a store page it is that page's own link — _["About us"]_
- header.left-logo: in the phone's slide-in menu the current link is marked and stands out — _["Menu"]_

**Step 4 — header.split-nav**

- header.split-nav: on the menu page, "Menu" is the marked link — _["Menu"]_
- header.split-nav: it looks different from the other links (not just a hidden attribute)
- header.split-nav: on the account page it is "My orders" (and only that) — _["My orders"]_
- header.split-nav: on a store page it is that page's own link — _["About us"]_
- header.split-nav: in the phone's slide-in menu the current link is marked and stands out — _["Menu"]_

**Step 5 — header.minimal**

- header.minimal: has no menu, so there is nothing to mark

**Step 6 — header.banner**

- header.banner: on the menu page, "Menu" is the marked link — _["Menu"]_
- header.banner: it looks different from the other links (not just a hidden attribute)
- header.banner: on the account page it is "My orders" (and only that) — _["My orders"]_
- header.banner: on a store page it is that page's own link — _["About us"]_
- header.banner: in the phone's slide-in menu the current link is marked and stands out — _["Menu"]_

**Step 7 — header.two-row**

- header.two-row: on the menu page, "Menu" is the marked link — _["Menu"]_
- header.two-row: it looks different from the other links (not just a hidden attribute)
- header.two-row: on the account page it is "My orders" (and only that) — _["My orders"]_
- header.two-row: on a store page it is that page's own link — _["About us"]_
- header.two-row: in the phone's slide-in menu the current link is marked and stands out — _["Menu"]_

**Step 8 — header.boxed**

- header.boxed: on the menu page, "Menu" is the marked link — _["Menu"]_
- header.boxed: it looks different from the other links (not just a hidden attribute)
- header.boxed: on the account page it is "My orders" (and only that) — _["My orders"]_
- header.boxed: on a store page it is that page's own link — _["About us"]_
- header.boxed: in the phone's slide-in menu the current link is marked and stands out — _["Menu"]_

**Step 9 — header.stacked**

- header.stacked: on the menu page, "Menu" is the marked link — _["Menu"]_
- header.stacked: it looks different from the other links (not just a hidden attribute)
- header.stacked: on the account page it is "My orders" (and only that) — _["My orders"]_
- header.stacked: on a store page it is that page's own link — _["About us"]_
- header.stacked: in the phone's slide-in menu the current link is marked and stands out — _["Menu"]_

**Step 10 — header.pill-nav**

- header.pill-nav: on the menu page, "Menu" is the marked link — _["Menu"]_
- header.pill-nav: it looks different from the other links (not just a hidden attribute)
- header.pill-nav: on the account page it is "My orders" (and only that) — _["My orders"]_
- header.pill-nav: on a store page it is that page's own link — _["About us"]_
- header.pill-nav: in the phone's slide-in menu the current link is marked and stands out — _["Menu"]_

**Step 11 — header.floating**

- header.floating: on the menu page, "Menu" is the marked link — _["Menu"]_
- header.floating: it looks different from the other links (not just a hidden attribute)
- header.floating: on the account page it is "My orders" (and only that) — _["My orders"]_
- header.floating: on a store page it is that page's own link — _["About us"]_
- header.floating: in the phone's slide-in menu the current link is marked and stands out — _["Menu"]_

**Step 12 — header.dark**

- header.dark: on the menu page, "Menu" is the marked link — _["Menu"]_
- header.dark: it looks different from the other links (not just a hidden attribute)
- header.dark: on the account page it is "My orders" (and only that) — _["My orders"]_
- header.dark: on a store page it is that page's own link — _["About us"]_
- header.dark: in the phone's slide-in menu the current link is marked and stands out — _["Menu"]_

**Step 13 — header.underline**

- header.underline: on the menu page, "Menu" is the marked link — _["Menu"]_
- header.underline: it looks different from the other links (not just a hidden attribute)
- header.underline: on the account page it is "My orders" (and only that) — _["My orders"]_
- header.underline: on a store page it is that page's own link — _["About us"]_
- header.underline: in the phone's slide-in menu the current link is marked and stands out — _["Menu"]_

**Step 14 — header.burger**

- header.burger: on the menu page, "Menu" is the marked link — _["Menu"]_
- header.burger: it looks different from the other links (not just a hidden attribute)
- header.burger: on the account page it is "My orders" (and only that) — _["My orders"]_
- header.burger: on a store page it is that page's own link — _["About us"]_
- header.burger: in the phone's slide-in menu the current link is marked and stands out — _["Menu"]_

**Step 15 — header.tagline**

- header.tagline: on the menu page, "Menu" is the marked link — _["Menu"]_
- header.tagline: it looks different from the other links (not just a hidden attribute)
- header.tagline: on the account page it is "My orders" (and only that) — _["My orders"]_
- header.tagline: on a store page it is that page's own link — _["About us"]_
- header.tagline: in the phone's slide-in menu the current link is marked and stands out — _["Menu"]_

**Step 16 — header.call-order**

- header.call-order: on the menu page, "Menu" is the marked link — _["Menu"]_
- header.call-order: it looks different from the other links (not just a hidden attribute)
- header.call-order: on the account page it is "My orders" (and only that) — _["My orders"]_
- header.call-order: on a store page it is that page's own link — _["About us"]_
- header.call-order: in the phone's slide-in menu the current link is marked and stands out — _["Menu"]_

**Step 17 — The owner can switch it off**

- switched off: nothing is marked on /main — _6 links, 0 marked_
- switched off: nothing is marked on /main/account — _6 links, 0 marked_
- switched off: nothing is marked on /main/about-hl — _6 links, 0 marked_
- switched off: nothing is marked in the phone's slide-in menu either
- switched back on: it is marked again — _["Menu"]_

**Step 18 — The default, and the store's own links**

- a store that never chose gets the highlight ON (the saved setting reads true) — _true_
- a link the owner added is marked on the page it goes to — _["Story"]_
- …and a link to another website or an in-page jump is never marked — _["Menu"]_
- no page errors

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-27 11:06 | pass | 81 | 0 | headless | 44.2 s |
| 2026-11-26 12:36 | pass | 81 | 0 | headless | 47.9 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t86-header-current-page.mjs`), not this page._
