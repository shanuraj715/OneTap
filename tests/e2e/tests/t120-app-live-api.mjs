// T120 — Staff apps (OMA, KDA, RDA): the live connection — who may listen, what they are told, who is let go (server side)
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t120-app-live-api",
  title: "Staff apps (OMA, KDA, RDA): the live connection — who may listen, what they are told, who is let go (server side)",
  area: "apps",
  browser: false,
  fresh: false,
  summary: "Runs suites/app-live-api.mjs against a private API on an in-memory database with the realtime hub attached; real WebSocket clients play the apps.",
  expect: [
    "An app connects with its Bearer sign-in (a rider with the rider's token) and gets the same role / outlet / paused-store checks as its ordinary calls.",
    "An app is told only 'changed: orders / tables / menu / deliveries', only its own kinds, only for its own outlet; a burst of changes is one message.",
    "A change made by any code (straight through the models) reaches the apps; a dish going out of its hours is noticed by the clock watcher.",
    "A signed-out person, a rider whose PIN was reset or who was switched off, and a paused store's team are let go; the platform's switch ends every connection (4410) and new ones are refused (503).",
  ],
  expectNot: [
    "No name, phone, dish, price or order id ever travels over an app's connection.",
    "A waiter must NOT be able to listen as the kitchen app, or an editor as OMA.",
    "The dashboard's own live connection (cookie, full events) must NOT change.",
  ],
};

export const run = (d) => runSuite(d, "app-live-api.mjs", { timeoutMs: 4 * 60_000 });
