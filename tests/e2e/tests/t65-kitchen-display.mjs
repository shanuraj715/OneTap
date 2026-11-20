// T65 — Kitchen Display System at /kitchen, plus the waiter's bell.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t65-kitchen-display",
  title: "Kitchen display (/kitchen) — orders by station, Start / Ready, late colours, and the waiter's bell (off by default)",
  area: "kitchen",
  browser: true,
  fresh: false,
  summary: "Runs suites/kitchen-display.mjs. API: an accepted order is a NEW card on the board with its table; the Kitchen and Bar screens each show only their station's dishes; each station moves new → preparing → ready on its own and the order's status follows (preparing on the first Start, ready only when EVERY station is ready, recall puts it back); the All screen marks every station at once; a station with nothing to make is refused; completed / cancelled orders leave the board; the kitchen role can read it; a store on a plan without Kitchen display gets 403. Browser: Settings → Kitchen & delivery → Kitchen display (bell switch off by default, saved when ticked); the kitchen user's /kitchen screen — NEW / PREPARING / READY lanes, station tabs (/kitchen?screen=bar), Start, Ready, Recall; with the bell off the waiter's screen shows nothing, with it on a card 'Table T4 — Order #… Everything is ready' appears on whatever page the waiter is on and can be dismissed; the sound switch is remembered; a waiting order turns amber and then red (clock fast-forwarded).",
  expect: [
    "Orders appear per station; the order is ready only when every station is ready; recall works; finished orders leave the board.",
    "The kitchen role can use /kitchen; a plan without the feature gets 403.",
    "The waiter's bell is off by default; on, it shows the table and order when the kitchen is ready.",
    "Waiting cards turn amber then red after the thresholds.",
  ],
  expectNot: [
    "The bar finishing first must NOT mark the whole order ready.",
    "With the bell off the waiter must NOT see a notification.",
    "A completed or cancelled order must NOT stay on the board.",
    "No errors in the browser.",
  ],
};

export const run = (d) => runSuite(d, "kitchen-display.mjs");
