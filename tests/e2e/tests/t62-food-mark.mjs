// T62 — The veg / egg / non-veg mark has its dot exactly in the middle of its frame, everywhere.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t62-food-mark",
  title: "The veg / non-veg mark — the dot is exactly centred in its frame on the storefront and in Take order",
  area: "storefront",
  browser: true,
  fresh: false,
  summary: "Runs suites/food-mark-ui.mjs in Chrome on the bench. On the storefront menu (normal and 2× retina screens) and in the dashboard's Take order screen, every veg / egg / non-veg mark is measured: the centre of the dot is compared with the centre of its frame (must be under 0.05 px apart), the frame must be a true square (or circle) and the dot must stay inside it.",
  expect: [
    "Every mark's dot is centred in its frame (off-centre < 0.05 px), at every size the cards use and on 1× and 2× screens.",
    "Marks are true squares and the dot never touches or crosses the frame.",
  ],
  expectNot: [
    "No mark may have its dot pushed to one side.",
    "No errors in the browser.",
  ],
};

export const run = (d) => runSuite(d, "food-mark-ui.mjs");
