// T144 — App Management → Live connection: an app uses the live connection first, or only polling; polling is always the backup.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t144-app-live-mode-api",
  title: "App Management → Live connection: the platform admin chooses, per app, whether OMA / KDA / RDA use the live connection (WebSocket) first or only ask on a timer (polling); polling stays the backup",
  area: "app",
  browser: false,
  fresh: false,
  summary: "Runs suites/app-live-mode-api.mjs on a private API with the realtime hub and real WebSocket clients (no browser). The console's app list says which apps can listen (exactly the hub's: OMA, KDA, RDA) and that each starts on the live connection; Admin and Business have no choice. Only the platform admin may change it; Business is refused with a reason, an unknown app is 404, a bad value is 400. Switching OMA to polling closes OMA's open connections at once with code 4410 and a reason, leaves KDA's alone, refuses new OMA connections with 503 (which the apps already answer by asking on their timer), keeps telling OMA its refresh seconds, and is stored with the app. Switching back lets OMA connect again with no restart; choosing the same thing again drops nobody. Apps saved before the setting existed are on the live connection.",
  expect: [
    "Polling mode closes that app's live connections and refuses new ones; the other apps are untouched.",
    "Switching back to the live connection works at once.",
    "The app is still told its refresh seconds in polling mode (the timer).",
  ],
  expectNot: [
    "A store owner must NOT change an app's mode.",
    "An app with no live connection (Business, Admin) must NOT be given the choice.",
    "Switching one app must NOT disconnect another app.",
  ],
};

export const run = (d) => runSuite(d, "app-live-mode-api.mjs", { timeoutMs: 4 * 60_000 });
