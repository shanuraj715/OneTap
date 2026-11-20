// T44 — The marketing website's Product dropdown: a hovered / focused item is a neat rounded tile (Chrome).
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t44-website-product-menu",
  title: "Website header — the Product dropdown is wide, fits the window, and its hovered item is a soft rounded tile with a brand-filled icon (not a grey pill), in light and dark",
  area: "website",
  browser: false,
  fresh: false,
  summary: "Runs suites/website-product-menu.mjs: it renders the REAL website header component and loads the REAL stylesheet into Chrome (no servers needed). Hovering Product opens the six-item panel; the hovered item is filled with the soft paper colour with 12px corners and the dropdown's own padding and type — it used to wear the header links' pill shape and grey wash because `.nav a` out-ranked `.dd-item` — and its icon tile fills with the brand colour; moving the pointer moves the highlight; Tab onto an item gives the same highlight plus a focus ring; all of it again in dark mode; the header links (Pricing, FAQ…) keep their pill, and the phone Menu's Product rows are unchanged. The panel was also widened (420px → 580px, so descriptions wrap onto fewer lines) and is placed against the header row (its right edge lines up with the 'Talk to us' button) so it stays fully inside the window at 1440, 1280, 1100, 1024 and 900px; the pointer can travel from Product down to the first and last item without the panel closing, and moving away closes it. Screenshots are kept for light and dark.",
  expect: [
    "The hovered Product item is a softly rounded tile (about 12px) filled with the paper colour, inside the panel, one column wide.",
    "Its icon tile turns brand-coloured; items at rest have no background; only one item is highlighted at a time.",
    "Keyboard focus gives the same highlight and a visible ring; dark mode works too.",
    "The panel is wide (580px) with every description in at most 2 lines, and sits fully inside the window from 900px up.",
    "The panel stays open while the pointer moves from Product onto its items, and closes when the pointer leaves.",
    "Header links keep their pill shape; the phone menu is unchanged.",
  ],
  expectNot: [
    "The hovered item must NOT be a full pill (999px corners) with a grey wash.",
    "The dropdown items must NOT pick up the header links' 15px / 500 type or padding.",
    "The browser must NOT log errors or warnings.",
  ],
};

export const run = (d) => runSuite(d, "website-product-menu.mjs");
