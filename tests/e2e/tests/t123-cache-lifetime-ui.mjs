// T123 — Console → Platform settings → Cache lifetime: one input (seconds) with the time in words; no preset buttons
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t123-cache-lifetime-ui",
  title: "Console → Platform settings → Cache lifetime: one input in seconds with the time in words (900 → 15 minutes); no preset buttons",
  area: "platform",
  browser: true,
  fresh: false,
  summary: "Chrome against the bench console (super admin). A lifetime set through the API (900 s, what the Admin app writes) shows in the Platform settings → Cache box as 900 and in words as '= 15 minutes'. The six preset buttons (30 s, 1 min, 5 min, 15 min, 1 hour, Off) are gone; there is one Save button. Typing shows the words at once: 30 → 30 seconds, 60 → 1 minute, 90 → 1 minute 30 seconds, 300 → 5 minutes, 5400 → 1 hour 30 minutes, 3600 → 1 hour, 7200 → 2 hours, 86400 → 24 hours, 0 → off. 100000 (more than a day) shows '—' with Save off, and so does an empty box; the value already saved leaves Save off. Saving 1800 is what the server then holds, and after a reload the box says 1800 and '= 30 minutes'. The earlier value is put back at the end.",
  expect: [
    "The cache lifetime is one input in seconds, with the same time written in words beside it.",
    "A value set elsewhere (the app) shows up in the box and in words.",
  ],
  expectNot: [
    "No preset button (30 s, 1 min, 5 min, 15 min, 1 hour, Off) may be on the page.",
    "A value above a day, or an empty box, must NOT be saveable.",
    "No errors in the browser.",
  ],
};

export const run = (d) => runSuite(d, "cache-lifetime-ui.mjs", { timeoutMs: 4 * 60_000 });
