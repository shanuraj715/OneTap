// T145 — App Management in Chrome: tabs with the app icon across the whole width; the Live connection card (live first / polling only; polling is the backup).
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t145-app-management-tabs-live-ui",
  title: "App Management → the tabs share the whole width with the app's icon and short name; the 'Live connection' card chooses, per app, the live connection first or polling only (polling is the backup either way)",
  area: "platform",
  browser: true,
  fresh: false,
  summary: "Chrome against the bench console (super admin) and API; what it changes is put back. The five tabs are one row of equal width using almost the whole page width, each one line high with the app's own icon and its short name ('Order Management App'…), the full name on hover; on a narrow window and on a phone they wrap into more rows and nothing runs off the side. An app added in the console (no tagline) shows its name and a generated icon with its code. OMA, KDA and RDA have a 'Live connection' card, Admin and Business do not. OMA starts on 'Live connection first' (Recommended) and the card says polling is always the backup; the Refresh interval card says its seconds are the backup timer. Choosing 'Polling only' asks first (No changes nothing; Yes switches it, the server has it, the card confirms, the Refresh card says the timer is always used, KDA and RDA are untouched, it survives a reload). Choosing the live connection again needs no question.",
  expect: [
    "The tabs fill the width in one short row, each with its app icon and short name.",
    "OMA, KDA and RDA can be switched between 'live connection first' and 'polling only'; Admin and Business have no such card.",
    "Switching to polling asks first; the choice is saved and shown after a reload.",
  ],
  expectNot: [
    "The tabs must NOT run off the side of the screen, on a wide window or a phone.",
    "Answering No to the question must NOT change anything.",
    "Switching one app must NOT change another.",
  ],
};

export const run = (d) => runSuite(d, "app-management-tabs-live-ui.mjs", { timeoutMs: 8 * 60_000 });
