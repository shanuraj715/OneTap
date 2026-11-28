// T146 — App screenshots on the website, managed in the console: copied in once, then owned by the console (words, pictures per device and look, order, hide, remove).
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t146-app-screenshots-api",
  title: "App Management → Screenshots (API): the platform admin adds, edits, hides, reorders and removes an app's screenshots and puts a picture in each slot (3 devices × light / dark); the website's data carries only what should be shown",
  area: "app",
  browser: false,
  fresh: false,
  summary: "Runs suites/app-screenshots-api.mjs on a private API with an in-memory database and a temporary uploads folder (no browser). The pictures that ship with the website are copied in once per app (not again after something is removed); the console gets their full address, the website's data the path. Only the platform admin can read or change anything. The section has a switch, a heading, an intro and a first device (empty words mean the usual ones; a first device with no picture falls back; switched off = no section, screenshots kept). A screenshot needs a title; a picture goes into one slot (real pictures are resized by the usual pipeline and keep their shape), replacing a picture removes the old file, a non-picture is refused with a reason, unknown devices / looks / screenshots are 400 / 404. Words can be edited, a screenshot hidden or reordered (a screenshot left out of the order keeps its place; repeated or unknown ids are ignored). Removing a picture or a screenshot (or the app) removes the files. An app can have 12 screenshots. The public data has no internal fields or storage keys, lists only the devices that have a picture and never shows a screenshot with no picture.",
  expect: [
    "The built-in pictures are copied in once and never come back after being removed.",
    "Replacing or removing a picture, a screenshot or an app removes the stored files.",
    "The website's data lists only shown screenshots that have a picture, and only the devices that have one.",
  ],
  expectNot: [
    "A store owner or a waiter must NOT read or change screenshots.",
    "A file that isn't a picture must NOT be stored.",
    "The website's data must NOT carry storage keys or internal fields.",
    "A 13th screenshot must NOT be accepted.",
  ],
};

export const run = (d) => runSuite(d, "app-screenshots-api.mjs", { timeoutMs: 5 * 60_000 });
