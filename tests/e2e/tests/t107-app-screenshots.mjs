// T107 — Tablet screenshots of the three apps on their website pages, in an Android tablet frame.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t107-app-screenshots",
  title: "Website → /apps/oma, /apps/kda, /apps/rda: real tablet screenshots in an Android tablet frame, as a tabbed gallery that works by mouse, keyboard and without script",
  area: "website",
  browser: true,
  fresh: false,
  summary: "Runs suites/app-screenshots.mjs. The pictures (taken from the real apps on an emulator by mobile-apps/screenshots/capture.mjs and listed in apps/website/src/lib/app-shots.json): all three apps have at least three, each a real WebP file 16:10 and at least 1,400 px wide, under 400 KB, not blank, with a title, a caption and a description for screen readers, listed exactly once (nothing old left in the folder). The tooling: valid JavaScript; builds go to screenshots/.build and never to an app's build-output; no signing key is handed to them; they talk to the throwaway server on localhost, which listens on 127.0.0.1 only, uses an in-memory database and never reads a .env; the emulator's size and status bar are put back; .build and raw pictures are never committed; the restaurant and phone numbers are made up. The page: a 'See it' section headed '<APP> on a tablet' between the top of the page and the install steps, one tab per screenshot named as listed, the first picture showing, a click or the arrow keys switch pictures, the chosen tab is lit in the app's own colour and the keyboard shows a focus ring, the caption follows. The Android tablet frame: an even bezel, rounded body and glass, the picture one bezel in from the edge, a front camera centred in the top bezel, power and volume buttons on the top edge, a faint glass sheen that never blocks a tap, a metal-rimmed gradient body with a shadow, and (from real pixels) a dark bezel in light and dark mode. Also: tabs switch with JavaScript switched off; at 390 px nothing sticks out sideways; dark mode text is light on dark; reduced motion stops the slide-in; no picture 404s; /apps still shows its three cards with no gallery.",
  expect: [
    "Each app's page shows its screenshots in a tabbed gallery, one big picture at a time, in an Android tablet frame.",
    "The pictures are real WebP files, 16:10, not blank, and listed in the manifest.",
    "The tooling can't touch anything real: no live server, no release key, nothing in build-output.",
  ],
  expectNot: [
    "A picture must NOT be missing, blank, oversized or left in the folder without being listed.",
    "The gallery must NOT need JavaScript, and must NOT stick out sideways on a phone.",
    "The glass overlay must NOT block clicks; no errors in the browser.",
  ],
};

export const run = (d) => runSuite(d, "app-screenshots.mjs", { timeoutMs: 12 * 60_000 });
