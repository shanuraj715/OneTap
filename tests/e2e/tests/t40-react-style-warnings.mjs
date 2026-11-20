// T40 — The storefront menu produces no React development warnings (style mix-ups) while it is used (Chrome, React dev build).
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t40-react-style-warnings",
  title: "Storefront menu — no React warnings (e.g. \"Removing a style property during rerender (borderColor) when a conflicting property is set (border)\") while scrolling, filtering and expanding",
  area: "storefront",
  browser: false,
  fresh: false,
  summary: "Runs suites/react-style-warnings.mjs. Every other test uses the PRODUCTION build, which stays silent about style mistakes that React's DEVELOPMENT build (what `next dev` shows as the red error overlay) reports. So this bundles the real storefront menu component with React's development build, opens it in Chrome and drives it like a visitor — reads down 14 categories (the highlighted category chip changes many times), switches the Veg/Egg/Non-veg filter, clicks a category chip, scrolls the chip row, then switches to the custom layout with a path title ('South Indian › Dosa') and opens View all — and fails on any React warning or console error. It exists because a highlighted chip that added and removed `borderColor` on top of a `border` shorthand triggered that warning on every scroll.",
  expect: [
    "While the menu is scrolled, filtered, jumped around and expanded, React's development build reports no warnings and nothing is logged as an error.",
    "The highlighted category chip changes many times during the scroll (so the warning-prone path really ran).",
  ],
  expectNot: [
    "A style property must NOT be removed on a re-render while a conflicting shorthand (border) is set.",
    "The menu must NOT log a React warning or a console error.",
  ],
};

export const run = (d) => runSuite(d, "react-style-warnings.mjs");
