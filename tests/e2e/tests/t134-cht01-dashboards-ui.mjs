// T134 — CHT01 (the stacked area chart) in the platform dashboard (violet) and the store dashboard (green)
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t134-cht01-dashboards-ui",
  title: "CHT01 in the dashboards: the platform console's 'Where sales come from' (violet) and the store dashboard's revenue widget (green) — real layers, legend, reading on hover — and the catalogue sample unchanged (sky blue)",
  area: "dashboard",
  browser: true,
  fresh: false,
  summary: "Chrome against the bench console. The two dashboards' answers are given known numbers so each figure on screen can be checked exactly. Platform dashboard: a card 'Where sales come from' with the 12 months' total, the change this month, a legend (dine-in, takeaway, delivery, other), violet layers (not the sample's blue), a rupee axis, and a reading bubble on hover whose layers add up to its total; it hides when no month has any split sales; it fits a phone-width screen. Store dashboard: the revenue widget holds a green stacked chart of the last 14 days with a legend and the same hover reading; with no sales it falls back to the plain line chart; the other widgets are untouched. The components catalogue's CHT01 sample still reads 'Sessions 13,277 +35%' in its original blue.",
  expect: [
    "The platform dashboard has a violet stacked chart of 12 months split by order type, with a legend and a hover reading that adds up.",
    "The store dashboard's revenue widget shows a green stacked chart of 14 days with the same hover reading.",
    "The catalogue's CHT01 sample is unchanged: original sky blue and original numbers.",
  ],
  expectNot: [
    "The chart must NOT be drawn when there is nothing to stack (the plain line chart or no card shows instead).",
    "The two dashboards' charts must NOT use the sample's blue.",
    "The page must NOT scroll sideways on a phone-width screen.",
  ],
};

export const run = (d) => runSuite(d, "cht01-dashboards-ui.mjs", { timeoutMs: 8 * 60_000 });
