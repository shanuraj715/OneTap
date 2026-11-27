// T108 — Plans and their features: "includes every feature", feature dependencies, the shared presets, update-plans.js and seed-plans.js.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t108-plan-features",
  title: "Plans → Business includes every feature (also future ones), Starter gains pre-orders and ratings, features that need another are flagged, and update-plans.js brings existing plans up to date safely",
  area: "platform",
  browser: false,
  fresh: false,
  summary: "Runs suites/plan-features.mjs against a private API on an in-memory database. The rules: a table says which features need another (delivery → online payments, pre-orders → takeaway, cart reminders and marketing → WhatsApp & SMS alerts) and featureProblems() lists the mistakes in plain words. A plan with the new 'includes every feature' switch gets every feature whatever its saved list says (so features added later reach it on their own, which a plain list never did), a store can still have one locked, and a Custom plan still includes nothing. The shared presets: Starter keeps its four features and gains pre-orders and ratings (cheap for the restaurant, they win customers) but not the ones that need a team or a sender account; Business has everything, switched on. Through the console API: creating, listing and editing such a plan, bad feature keys refused, a Custom plan ignores the switch, a store on the plan has the five newest features. update-plans.js against a database laid out like production's (Starter with 4 features, Business with 13, Custom): the default run is a dry run that changes nothing and names what would change; --apply updates Starter and Business only, keeps everything a plan had, leaves Custom, limits and prices alone, is safe to repeat, never invents a missing plan, and also finds plans still called Basic / Pro. seed-plans.js: creates Starter, Business and Custom from the presets on an empty database, creates nothing twice, and doesn't add a second plan beside one with an old name.",
  expect: [
    "Business gets every feature, including ones added later; Starter gets pre-orders and ratings.",
    "A feature that needs another is flagged (delivery without online payments).",
    "update-plans.js is a dry run unless --apply is given, and only ever adds.",
  ],
  expectNot: [
    "A dry run must NOT change the database.",
    "Custom plans, limits and prices must NOT be touched by the update.",
    "A plan that doesn't exist must NOT be created by update-plans.js.",
  ],
};

export const run = (d) => runSuite(d, "plan-features.mjs", { timeoutMs: 6 * 60_000 });
