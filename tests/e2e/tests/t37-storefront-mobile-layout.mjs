// T37 — Storefront on small screens: tighter page edges (phones and tablets) and a two-line, smaller category title on phones.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t37-storefront-mobile-layout",
  title: "Storefront — page side padding is smaller on phones and tablets (desktop unchanged); on phones a path title is two lines with a smaller View all button",
  area: "storefront",
  browser: false,
  fresh: false,
  summary: "Runs suites/storefront-mobile-layout.mjs: through the bench API it makes a category 'Mob South Indian' with 'Mob Idli & Vada' inside (5 dishes), a plain category, and a custom menu layout with two collapsible sections — one titled 'Mob South Indian › Mob Idli & Vada' with its View all button beside the title, one plain with View all at the bottom. In Chrome at desktop, tablet and phone: on tablet and phone every page-width block (menu, hero, offers, order bar, footer…) and the header sit 14px from the screen edge, while desktop keeps its 24px; on a phone the path title is on two lines — the parent small and muted ('Mob South Indian ›'), the name a little smaller than a normal heading — and the View all buttons (beside the title, and at the bottom) are smaller, with the title and button on one row and fully on screen; on tablet and desktop the title stays one line at the normal size and the button keeps its size; a plain heading is unchanged everywhere; View all still opens all 5 dishes; no sideways scroll. The test categories are removed and the layout restored at the end.",
  expect: [
    "Phones and tablets (up to 1023px): the menu, hero, offers, order bar and footer sit 14px from each screen edge, matching the header; desktop keeps 24px.",
    "Phones (up to 640px): a path title is on two lines — the parent small, the name a little smaller than normal — and View all buttons are smaller; title and button fit on one row.",
    "Tablet and desktop: the title is one line at the normal size and View all keeps its size.",
    "A heading that is not a path, and the View all behaviour, are unchanged; no sideways scroll at any size.",
  ],
  expectNot: [
    "Desktop padding must NOT change.",
    "The View all button must NOT overflow or overlap the title on a phone.",
    "A plain (non-path) heading must NOT shrink.",
    "The browser must NOT log errors or warnings.",
  ],
};

export const run = (d) => runSuite(d, "storefront-mobile-layout.mjs");
