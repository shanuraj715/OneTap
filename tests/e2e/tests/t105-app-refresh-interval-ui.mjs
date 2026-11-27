// T105 — The console's Refresh interval card: how often each mobile app asks the server for new data.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t105-app-refresh-interval-ui",
  title: "Console → App Management → Refresh interval: set how often OMA, KDA and RDA ask for new data (default 8 s, per app, 3–600), and the apps are told with their next request",
  area: "app",
  browser: true,
  fresh: false,
  summary: "Runs suites/app-refresh-interval-ui.mjs in Chrome against the bench. On App Management each app's tab has a 'Refresh interval' card: it says '<app> asks the server for new data every N seconds (the default)' and what that app's refresh covers (OMA: table board and orders, KDA: the kitchen board, RDA: new delivery requests), with a box 'Seconds between refreshes' (default 8, from 3 to 600), Save, and 'Use the default (8)'. Saving 15 for RDA shows 'RDA now asks every 15 seconds', the card stops saying 'the default', Save turns off, a reload still shows 15, and the header a phone running RDA gets (x-refresh-seconds on any answer to a request with x-app-id: rda) is 15 while OMA and KDA are still told 8. 2, 601 and 7.5 are refused in the box with a message (Save stays off) and by the server (400); an empty box just turns Save off; 3 and 600 are accepted; Enter saves; 'Use the default' only fills the box until Save is pressed; the three apps keep separate numbers (OMA 12, RDA 25, KDA 8). A 390 px screen has no sideways overflow.",
  expect: [
    "Each app's tab has its own number; the delivery app set to 15 is announced as 15.",
    "Bad numbers are explained and not saved; the edges (3 and 600) work.",
    "A saved number survives a reload; 'the default' is shown whenever the number is 8.",
  ],
  expectNot: [
    "Changing one app's number must NOT change another's.",
    "Pressing 'Use the default' must NOT save by itself.",
    "No errors in the browser; nothing off the edge on a phone.",
  ],
};

export const run = (d) => runSuite(d, "app-refresh-interval-ui.mjs", { timeoutMs: 6 * 60_000 });
