// T48 — No "Order takeaway" button under the store name; card C02 (Thumbnail left) has the price after the veg/non-veg mark and full-width text; every card style cuts a description at one line with an ellipsis (Chrome).
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t48-hero-button-card-c02",
  title: "Storefront — no 'Order takeaway' button at the top; card C02 (Thumbnail left) shows the price right after the veg / non-veg mark with full-width title and description; every item card cuts its description at one line with an ellipsis",
  area: "storefront",
  browser: false,
  fresh: false,
  summary: "Runs suites/storefront-hero-card-c02.mjs against the bench store in Chrome. Menu page of an outlet on a desktop, on a phone and the other outlet: the area under the store name has no button or link, the words 'Order takeaway' appear nowhere, and the Takeaway / Delivery order bar is still there. Then two test dishes (one with a long name, a long description and the 'spicy' tag; one non-veg) are put in a category and the outlet's item card style is set to C02 'Thumbnail left' through the API: on a desktop and a phone each card shows the veg / non-veg mark, then the PRICE on the same line right after it, then the 'spicy' tag; the price is no longer alone at the right edge of the card; the title and the description run to the card's right padding (the full width left after the 72×72 picture); the long description wraps over several lines in that wide column; no sideways scroll. Then, with the same long description (about 570 characters) and a short one ('Crispy wings.'), EVERY item card style is tried on a desktop — C01 to C11: the long description is held to ONE line (CSS line clamp of 1, the rest cut off so the … shows), the short one is left on one line, and the two styles that show no description (C08 portrait, C09 circle) stay without; the dish pop-up that opens when a dish is chosen still shows the whole description. The test dishes are deleted and the card style put back.",
  expect: [
    "No button or link under the store name at the top of the menu page, and no 'Order takeaway' text anywhere; the order bar is still there.",
    "Card C02: the price is on the first line right after the veg / non-veg mark (tags after it), the title and description take the card's full width, the thumbnail is unchanged.",
    "On every card style that shows a description it is ONE line, ending with an ellipsis when longer; the dish pop-up still shows all of it.",
  ],
  expectNot: [
    "The price must NOT sit alone at the right edge of a C02 card.",
    "The title / description must NOT be narrowed by a price column.",
    "A description must NOT run to a second line on any item card.",
    "A short description must NOT be altered.",
    "The browser must NOT log errors or warnings.",
  ],
};

export const run = (d) => runSuite(d, "storefront-hero-card-c02.mjs");
