// T07 — favicon: a store-level setting gated by the plan, including per-store overrides.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t07-favicon-plan-rules",
  title: "Favicon — one per store, only when the plan (or a per-store override) includes it",
  area: "plans",
  browser: false,
  fresh: false,
  summary: "Runs suites/favicon-api.mjs on its own throwaway API: a store whose plan includes 'favicon' can set it; it is shared by every outlet (including new ones) because it is a store setting; a plan without it is refused with a clear message and visitors never get a stored one; unlocking the feature for ONE store through an override shows it.",
  expect: [
    "A store whose plan includes the favicon feature can set one and the public storefront config carries it.",
    "A NEW outlet of the same store has the same favicon; removing it on any outlet removes it for the store.",
    "Switching the feature on for one store (platform console override) makes its favicon appear.",
    "Other appearance saves keep working.",
  ],
  expectNot: [
    "A plan without the feature must NOT be able to set a favicon (403 'A favicon isn't included in your plan.').",
    "Visitors must NOT receive a stored favicon while the plan lacks the feature.",
  ],
};

export const run = (d) => runSuite(d, "favicon-api.mjs");
