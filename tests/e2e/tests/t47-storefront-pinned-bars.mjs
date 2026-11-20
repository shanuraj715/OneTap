// T47 — The storefront's header, order bar and category bar stay pinned to the top while the page scrolls (Chrome).
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t47-storefront-pinned-bars",
  title: "Storefront — the header, the order bar (Takeaway/Delivery + outlet) and the category/filter bar stay pinned to the top while scrolling, on phone, tablet and desktop, with every header style",
  area: "storefront",
  browser: false,
  fresh: false,
  summary: "Runs suites/storefront-pinned-bars.mjs against the bench store in Chrome. On a phone (390px), a tablet (820px) and a desktop (1440px): at the top of the page the header and the order bar sit in order and the category bar is further down; after scrolling (a little, halfway, nearly to the bottom) all THREE are pinned to the top — header at 0, the order bar flush under it, the category bar flush under that, with no gap and no overlap — and together they take only a small part of the screen. The 'isn't available from this outlet' note under the order bar is not pinned: it scrolls away. Choosing a category in the bar (chips on a wide screen, the Categories sheet on a phone/tablet) scrolls the menu to that category just UNDER the pinned bars, never hidden behind them, and jumping to the menu anchor (#menu) also lands below them. On a phone the order bar is slim: the Takeaway/Delivery switch and the outlet are on ONE row; a very narrow 320px phone shows no sideways scroll. Overlays stay above the pinned bars: the outlet dropdown opens over the category bar and its rows can be pressed, an item pop-up covers the header and the bars, and the phone menu drawer (drawn on <body>) slides in over the pinned header and locks the page behind it; Escape closes it. The customer's Account page has the pinned header too. Finally all 15 header styles are tried on a phone and a desktop: each one up to 150px tall (a fifth of the window at most) stays pinned with the order bar and the category bar flush under it; the two very tall styles (Banner, Stacked) are too big to pin, so they scroll away and the order bar and category bar still pin to the very top. The heights of every style are printed, and the pinned bars never take more than 40% (phone) or 32% (desktop) of the screen. The header style is put back at the end.",
  expect: [
    "After scrolling, the header, the order bar and the category bar are all pinned at the top, flush under each other, on a phone, a tablet and a desktop.",
    "The pinned stack is small compared with the screen; on a phone the order bar's switch and outlet share one row.",
    "The notes under the order bar scroll away; picking a category (or #menu) never leaves the heading hidden behind the pinned bars.",
    "The outlet dropdown, item pop-ups and the phone menu drawer all appear above the pinned bars.",
    "Every header style up to 150px tall stays pinned; the two very tall styles scroll away while the order bar and category bar still pin; none leaves less than 60% of the screen free.",
  ],
  expectNot: [
    "A pinned bar must NOT overlap another or leave a gap between them.",
    "A very tall header must NOT be pinned (it would cover the page).",
    "The pinned bars must NOT cover the heading you jumped to.",
    "An overlay (pop-up, drawer, dropdown) must NOT end up behind the pinned bars.",
    "The page must NOT scroll sideways on a 320px phone.",
    "The browser must NOT log errors or warnings.",
  ],
};

export const run = (d) => runSuite(d, "storefront-pinned-bars.mjs", { timeoutMs: 10 * 60_000 });
