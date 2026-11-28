// T142 — The coloured glow at the bottom of an app's page keeps its colour and ends softly (no straight edge under the hero).
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t142-website-hero-glow",
  title: "Website → an app's page: the purple (app-coloured) glow at the bottom of the top section is kept and fades out smoothly instead of ending in a straight line; the heartbeat line's corners are softly rounded",
  area: "website",
  browser: true,
  fresh: false,
  summary: "Chrome against the bench website, motion off, pixel-based. On an app's page (light and dark): the colour inside the top section near its bottom is clearly still tinted (the glow was not removed); the pixel rows 2 px above and 2 px below the section's bottom edge are the same colour (no step); the glow carries on below the edge and has melted into the page colour 255 px further down. On the /apps list page (light and dark) the colour is still there, the cards section has no rule above or below it and no background of its own, there is no step in colour where the top section ends and the cards begin, and the heartbeat sits low in the top section. The heartbeat line is one path drawn twice (line + glow) whose corners are curves, with round joins and ends, and still bends towards the same peak and dip points. Nothing sticks out sideways on desktop or at 390 px wide.",
  expect: [
    "The coloured glow is still visible in the lower part of the top section.",
    "There is no visible step in colour where the top section ends; the glow fades out below it.",
    "Every corner of the heartbeat line is a small curve.",
    "The top section and the cards section of /apps read as one page.",
  ],
  expectNot: [
    "The glow must NOT end in a straight line.",
    "The glow must NOT be removed or faded away inside the top section.",
    "The heartbeat line must NOT have sharp pointed corners.",
    "There must NOT be a line or a change of background colour between the top section and the cards of /apps.",
    "The page must NOT scroll sideways.",
  ],
};

export const run = (d) => runSuite(d, "website-hero-glow.mjs", { timeoutMs: 6 * 60_000 });
