// T125 — A store's settings are kept per plan: leaving a plan saves them, coming back restores them, a new plan starts clean
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t125-plan-memory-api",
  title: "A store's settings are kept per plan: leaving a plan saves them, coming back restores them (Custom → Pro → Custom), a plan it never had starts clean",
  area: "platform",
  browser: false,
  fresh: false,
  summary: "API checks on an in-memory database. A store on a Custom plan with limits set by hand (12 people, 7 outlets, 40 tables) and features unlocked (marketing, delivery) moves to Pro: the answer says the Custom settings were saved and Pro started clean; Pro's own limits apply and nothing of Custom carries over; the store's page lists Custom among the plans it has left with what it had. Months later it goes back to Custom: the answer says the settings were restored, and the old limits and features are exactly back. A plan it never had (Basic) starts clean, and Custom and Pro are both remembered. Settings sent with the change replace what was saved and are what is saved when it leaves again; changing only the settings on the same plan is not a plan change; 'No plan' is a plan too; an unknown plan is 400; a store owner is 403.",
  expect: [
    "Leaving a plan saves the store's settings on it; coming back to that plan restores them exactly.",
    "A plan the store never had starts clean (the old plan's limits do not carry over).",
    "The answer says what happened (saved / restored / started clean) and the store's page lists the plans it has left.",
  ],
  expectNot: [
    "Custom limits must NOT carry over onto Pro.",
    "Settings given with the change must NOT be overwritten by saved ones.",
  ],
};

export const run = (d) => runSuite(d, "plan-memory-api.mjs", { timeoutMs: 3 * 60_000 });
