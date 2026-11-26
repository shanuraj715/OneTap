// T86 — The header menu marks the page the visitor is on, in every header style; the owner can switch it off.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t86-header-current-page",
  title: "The header menu highlights the page you're on in every header style (laptop menu and phone slide-in menu), on by default, and the owner can switch it off",
  area: "storefront",
  browser: true,
  fresh: false,
  summary: "Runs suites/header-current-page.mjs in Chrome against the bench store. The suite reads the registry, so every header style that exists is covered (the 'Minimal' one has no menu). Each style is set through the API; on the menu page 'Menu' must be the one marked link, on the account page 'My orders', on a store page that page's own link — and the marked link must really look different from the others (colour, weight, underline, fill), not only carry a hidden attribute. On a phone the same is checked in the slide-in menu (a burger-only header shows its panel on the laptop too). With 'Highlight the page you're on' switched off nothing is marked anywhere (laptop and phone); switched on again it comes back. A store that never chose gets it ON. A link the owner added is marked on the page it goes to; a link to another website or an in-page jump never is.",
  expect: [
    "In every header style with a menu: exactly the link of the current page is marked (aria-current=page) and looks different from the others, on the laptop and in the phone's slide-in menu.",
    "With the setting switched off, no link is marked. The default is ON.",
  ],
  expectNot: [
    "More than one link must NOT be marked, and a link to another site or an in-page jump must NOT be marked.",
    "The marked link must NOT look identical to the others.",
  ],
};

export const run = (d) => runSuite(d, "header-current-page.mjs", { timeoutMs: 10 * 60_000 });
