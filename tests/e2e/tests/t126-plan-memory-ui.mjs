// T126 — Console → a store → Plan & limits: the page says what the store had on each plan, and puts it back when it returns
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t126-plan-memory-ui",
  title: "Console → a store → Plan & limits: a new plan 'starts clean' and keeps the old settings; a plan it had before brings its limits back (shown before saving); Save says what happened",
  area: "platform",
  browser: true,
  fresh: false,
  summary: "Chrome against the bench console (super admin). A store on a Custom plan with 7 outlets, 12 people, 40 tables and marketing unlocked. Pick a plan it never had: a note says the plan starts clean and that the Custom settings are kept (7 outlets, 12 people, marketing); the 'had it before' note is not shown; Save answers 'Moved to … starts clean … kept' and the store has the new plan's own limits (2 outlets, 4 people). Pick the Custom plan again: a note says the store had it before and lists what it had; the limit boxes already hold 7, 12 and 40 before saving; Save answers 'is back', and the store really has them again. Picking the plan it is on shows no note. The two plans the test makes are archived and the store is put back on its own plan.",
  expect: [
    "A plan the store never had says it starts clean and that the old settings are kept.",
    "A plan it had before shows what it had, fills the limit boxes with it before saving, and Save says it is back.",
    "The saved settings are really on the store afterwards.",
  ],
  expectNot: [
    "Custom limits must NOT carry over onto a plan the store never had.",
    "No 'had it before' note for a new plan, no 'starts clean' note for an old one, and no note for the plan it is on.",
    "No errors in the browser.",
  ],
};

export const run = (d) => runSuite(d, "plan-memory-ui.mjs", { timeoutMs: 4 * 60_000 });
