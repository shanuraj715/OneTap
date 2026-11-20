// T66 — table auto-free on Completed (no "Needs cleaning"), phone layouts, live-updates switch, print-station chip.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t66-ops-batch",
  title: "Completed dine-in order frees the table (no Needs cleaning) · phone layouts · platform live-updates switch · print station every 8 s with check, loader and countdown",
  area: "operations",
  browser: true,
  fresh: false,
  summary: "Runs suites/ops-batch.mjs in Chrome. Tables: a dine-in order marked Completed frees its table by itself once nothing else on the table is open and everything is paid (a second open order keeps it Seated); 'needs-cleaning' is no longer a status (refused; moving a party leaves the old table Free). Phone (375 px): 'Free table for new guests' is on the Take order menu screen before any item is added and works; the dashboard shows its cards two to a row, equal height, nothing clipped, no sideways scroll (three columns on a computer); the Orders filters are ONE row that scrolls sideways, one line tall, with dropdowns still opening; the platform console's store page header keeps its three buttons in one row and the name has room. Platform: Settings → Live order updates switch — off refuses new WebSockets, an open Orders page changes to 'Refreshing every 5s' and asks the API every ~5 s; on brings Live back. Print station: the sidebar chip shows a green check and 'Print station on · next check Ns' counting down, a loader with 'Checking…' while it asks, and asks the server only every ~8 s.",
  expect: [
    "Completing the last open order of a dine-in table frees the table; another open order keeps it seated.",
    "No 'Needs cleaning' anywhere; the API refuses it.",
    "On a phone: the free-table button is on the first menu screen; dashboard cards fit; Orders filters scroll in one row; the store header fits.",
    "Live updates off → no sockets, 5-second polling; on → Live again.",
    "Print station: ≥ 8 s between server checks; green check, loader and countdown shown.",
  ],
  expectNot: [
    "A table with another order still open must NOT be freed.",
    "No page may scroll sideways on a phone; no dashboard card may clip its content.",
    "No errors in the browser.",
  ],
};

export const run = (d) => runSuite(d, "ops-batch.mjs");
