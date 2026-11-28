// T147 — The "See it" gallery on an app's page: device frames, light / dark / Auto, flipping through the screens, mobile.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t147-app-screens-gallery-ui",
  title: "Website → an app's page → 'See it': the app's screens in a tablet (wide or tall) or phone frame; light, dark or Auto (follows the browser live); flip with buttons, keys or a swipe; works on a phone",
  area: "website",
  browser: true,
  fresh: false,
  summary: "Chrome against the bench API and website; it adds a test app in the console with five screenshots (two complete, one with a light-only phone picture and no tall-tablet picture, one hidden, one with no picture) whose pictures it draws pale or dark, so the look on screen is read from the pixels; the app is removed at the end. The heading, line and device switch (three devices) and look switch (Auto / Light / Dark) show; the list has only the shown screens that have a picture for the chosen device. The frames have the right screen shapes (16:10, 5:8, 19.5:9), the phone's camera inside the screen and a tablet's in the bezel. Auto shows the browser's look and follows it live when it changes with no reload; Light / Dark override it (and say so), survive changing screens and a reload (with the device); a screen that has only one look shows it always. Next / previous wrap round, arrow keys, Home / End move the focus along, a horizontal swipe flips and a vertical drag does not; the controls are labelled for screen readers. Pictures are added to the page when wanted (2 of 3 at first). A mouse makes the device lean and it straightens again. At 390 px: no sideways scroll, controls → device → row of screens, big touch targets, caption under the device. With no script the first screen is still drawn in the browser's look (CSS only). With 'reduce motion' nothing leans or animates. The heading, line and first device written in the console show, and switching the section off removes it.",
  expect: [
    "Auto follows the browser's light / dark live; Light and Dark override it and are remembered.",
    "Each device frame has the right screen shape; only the screens with a picture for the device are listed.",
    "On a phone-sized screen everything fits and can be touched.",
  ],
  expectNot: [
    "A hidden screen, or one with no picture, must NOT be shown.",
    "The page must NOT scroll sideways.",
    "A vertical drag must NOT be taken for a swipe.",
    "With 'reduce motion' the device must NOT lean or animate.",
  ],
};

export const run = (d) => runSuite(d, "app-screens-gallery-ui.mjs", { timeoutMs: 12 * 60_000 });
