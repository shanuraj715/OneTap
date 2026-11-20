// T63 — C07 uses the 16:9 picture; Appearance has a Picture shape field that follows the card style and can be overridden.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t63-card-picture-shape",
  title: "C07 uses the wide 16:9 picture — and Appearance has a Picture shape field per card style that resets on a new card and can be overridden",
  area: "storefront",
  browser: true,
  fresh: false,
  summary: "Runs suites/card-picture-shape-ui.mjs in Chrome on the bench store. A dish with all four picture shapes: C07 (Image overlay) shows the wide 16:9 picture in a 16:9 card. Dashboard → Appearance → Menu item cards has a 'Picture shape' field: it shows the chosen card's own shape (C07 Wide 16:9, C08 Portrait 3:4, C04 Landscape 4:3, C09 Square 1:1), changes by itself when another card is picked, can be overridden (saved, shown again after a reload, and the storefront then shows that picture — and a 4:3 box for C07), has a 'Back to the card's own' link while overridden, resets after picking another card, and says there is nothing to choose for C01 (no picture). The bench layout is put back.",
  expect: [
    "C07 shows the 16:9 picture; its Picture shape reads Wide (16:9).",
    "Picking another card changes the field to that card's own shape and drops any override.",
    "An override is saved and the storefront shows the matching picture; the 'back' link clears it.",
  ],
  expectNot: [
    "A card with no picture (C01) must NOT offer a shape.",
    "Another card style must NOT keep the previous card's override.",
    "No errors in the browser.",
  ],
};

export const run = (d) => runSuite(d, "card-picture-shape-ui.mjs");
