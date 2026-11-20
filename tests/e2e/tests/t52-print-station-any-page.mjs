// T52 — The print station works from every dashboard page, not just Printing (Chrome).
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t52-print-station-any-page",
  title: "Print station — a computer switched on as a print station prints tickets from ANY dashboard page (Orders, Menu, Dashboard…), once, and only when it is switched on and the plan has Printing",
  area: "printing",
  browser: false,
  fresh: false,
  summary: "Runs suites/print-station-any-page.mjs in Chrome as the owner of Acme Momos with a kitchen KOT printer on the 'This browser' target (auto-print on accepted). A new device is not a print station and the sidebar shows nothing. On the Printing page 'Use this computer as a print station' is ticked: the sidebar then says 'Print station on'. With the browser on the Orders page, then the Menu page, then the Dashboard, a new order is placed and accepted each time and its kitchen ticket is printed by this computer within a few seconds without going near Printing (the browser's print is stubbed, and the job turns 'printed'). On a page that is not Printing the browser checks for tickets about every 8 seconds — one poller, not two. Switching it off removes the marker and the browser makes NO print checks; a ticket made meanwhile waits in the queue and is printed from the Orders page as soon as the station is switched back on. It is remembered after a reload. A store on a plan without Printing (Beta Bites) never checks and shows no marker, even if the device was switched on before. The test printer and orders are removed.",
  expect: [
    "Once switched on, the device prints tickets from any dashboard page and shows 'Print station on' in the sidebar.",
    "Only one check about every 8 seconds; none when it is off; none for a store without Printing.",
    "Tickets queued while it was off are printed when it is switched back on; the setting survives a reload.",
  ],
  expectNot: [
    "A new device must NOT be a print station by itself.",
    "A store without the Printing feature must NOT poll for print jobs.",
    "Two pollers must NOT run at once (a ticket would still print once, but the server would be asked twice as often).",
    "The browser must NOT log errors or warnings.",
  ],
};

export const run = (d) => runSuite(d, "print-station-any-page.mjs");
