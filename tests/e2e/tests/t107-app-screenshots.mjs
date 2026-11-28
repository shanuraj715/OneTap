// T107 — The screenshots that ship with the website: every app, screen, device and look has a real picture of the right shape; the tooling that takes them can't touch anything real.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t107-app-screenshots",
  title: "App screenshots (the pictures that ship with the website): OMA, KDA and RDA on a wide tablet, a tall tablet and a phone, in light and dark — real, the right shape, not blank, small; the tooling that takes them can't touch anything real",
  area: "website",
  browser: false,
  fresh: false,
  summary: "Runs suites/app-screenshots.mjs (no browser). The list the platform copies in the first time (apps/api/src/modules/app-releases/app-shots-builtin.js) covers the three apps; it agrees with the scenarios in mobile-apps/screenshots/scenarios.mjs on which screens, in which order, with which words (a description that names no device, because the website adds that); for every screen and every device the scenario runs on there is a light and a dark picture; each file is a real WebP of the right width (1600 / 1040 / 720) and the right shape for its device (16:10, 5:8, 19.5:9), under 260 KB, with real content on it, and the dark one is clearly darker than the light one; no file sits in apps/website/public/app-screens without being listed, and the old app-shots.json is gone. The tooling: valid JavaScript; builds go to screenshots/.build, never an app's build-output; no signing key is handed over; the apps point at the throwaway server on localhost, which listens on this machine only, with an in-memory database that never reads a .env; adb reverse and the emulator's screen settings are put back; every device and look starts on a freshly installed app; dark is the phone's own dark mode; the restaurant in the pictures is fictional and the phone numbers made-up.",
  expect: [
    "Every screen has a light and a dark picture for every device it was taken on, of the right shape and size.",
    "The dark picture is clearly darker than the light one.",
    "The tooling can't touch the live server, a real database or a release key.",
  ],
  expectNot: [
    "A blank or oversized picture must NOT be shipped.",
    "A picture must NOT sit in the folder without being listed.",
    "A real customer's name or number must NOT be in the made-up restaurant.",
  ],
};

export const run = (d) => runSuite(d, "app-screenshots.mjs", { timeoutMs: 6 * 60_000 });
