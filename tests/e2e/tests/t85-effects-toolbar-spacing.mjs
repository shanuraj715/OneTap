// T85 — The category / filter strip keeps its controls off the panel's edges in every style effect.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t85-effects-toolbar-spacing",
  title: "The storefront's category and filter strip has room inside its panel in every style effect (light and dark, laptop and phone)",
  area: "storefront",
  browser: true,
  fresh: false,
  summary: "Runs suites/effects-toolbar-spacing.mjs in Chrome against the bench store. For each style effect (Glass, Neumorphism, Claymorphism, Aurora, Cyberpunk, Dark Premium), in light and dark, on a laptop and a phone, the strip that holds the Veg / Non-veg filter chips and the categories is measured: the first and last controls must be at least 10px from the panel's left and right edges, there must be air above and below them, and the panel must be a finished shape (an edge all round and rounded corners). Under 'None' the strip is not a panel: it runs the width of the menu and its first chip lines up with the headings below.",
  expect: [
    "In every effect, the filter chips and the category chips / button keep at least 10px from the strip's panel edges.",
    "The strip is drawn as a finished panel (edge all round, rounded corners) in every effect except None.",
  ],
  expectNot: [
    "A chip must NOT touch or be cut by the edge of the strip's panel.",
  ],
};

export const run = (d) => runSuite(d, "effects-toolbar-spacing.mjs");
