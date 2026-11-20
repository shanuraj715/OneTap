// T41 — Storefront "View all": placed as configured from 720px wide up (any device), under the cards and centred under 720px,
// and opening/closing is animated (Chrome).
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t41-storefront-view-all",
  title: "Storefront View all — as configured from 720px wide up (tablets, narrow windows, desktops); under the cards and centred under 720px; the extra cards slide open and shut",
  area: "storefront",
  browser: false,
  fresh: false,
  summary: "Runs suites/storefront-view-all.mjs: through the bench API it makes five collapsible sections (View all configured bottom-left, bottom-centre, bottom-right, beside the title, and a 3-column grid of picture cards) and checks them in Chrome. From 720px wide up — a 1280px mouse screen, exactly 720px, a tablet in portrait (820), a narrow desktop window (900) and touch tablets in LANDSCAPE (1180 and 1366) — each button is where it was configured (left / centre / right / beside the title, with no second button under the cards). Under 720px — a phone (390 and 360) and a window 719px wide — every section has exactly ONE View all button, under the cards, in the middle; the one configured beside the title is not there. Opening and closing animate on a desktop and a phone: the clipping box's height passes through several in-between values (only growing when opening, only shrinking when closing), the leaving cards are inert while they close, the closed section is back to 3 dishes at its original height, and pressing twice quickly mid-slide ends cleanly closed. In a 3-column grid the opened cards flow on from the kept ones as one grid. With 'reduce motion' on, it opens at once. Closing a long section while scrolled far below its heading brings the heading back into view, below the pinned bars.",
  expect: [
    "720px wide and up (desktop, tablet portrait or landscape, narrow window): the View all button is exactly where the store configured it (left, centre, right, beside the title).",
    "Under 720px (a phone): one View all button per section, under the cards, centred — never beside the title.",
    "Opening and closing slide (several in-between heights); the button label and aria-expanded follow; the closed section returns to its first few cards.",
    "The opened cards continue the same grid or list; reduced-motion users get an instant change; closing scrolls a far-away heading back into view.",
  ],
  expectNot: [
    "A phone (under 720px) must NOT show the View all button beside the title or at the left/right.",
    "A tablet or window 720px or wider must NOT have its configured position overridden.",
    "The extra cards must NOT appear or vanish instantly (unless reduced motion is on).",
    "The cards leaving during a close must NOT be keyboard-focusable.",
    "The browser must NOT log errors or warnings.",
  ],
};

export const run = (d) => runSuite(d, "storefront-view-all.mjs");
