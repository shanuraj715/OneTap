// T143 — The website's /apps cards section: soft animated gradient circles behind glass cards, version pills, an odd card centred.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t143-website-apps-cards",
  title: "Website → /apps cards section: very faint gradient circles in the apps' colours drift behind the cards, the cards are see-through glass with a version pill, and an odd card is centred instead of left alone",
  area: "website",
  browser: true,
  fresh: false,
  summary: "Chrome against the bench website and API; it makes Business public and adds a fifth app, then puts everything back. A hidden decoration layer inside the cards section has big gradient circles (opacity 0.6 at most, in at least four different app colours, laps of 20 s or more, really moving 2.5 s later) and thin ripple rings that swell and fade. A card blurs what is behind it, the version (or 'No version published yet') is a rounded 1 px pill, and the rings in its corner breathe. Four apps are two rows of two (at 1400 and 1100 px), all one width, equal height in a row; on a phone one card per row, nothing sideways. Five apps are three then two, the last two centred under the three; the added app has its generated icon. Three apps are one row of three. With 'reduce motion' no circle, ring or card ring moves and every card is visible.",
  expect: [
    "Soft, very faint, slowly moving gradient circles in the apps' colours sit behind the cards.",
    "A card that would be alone on its row is centred; all cards in the section share one width.",
    "With 'reduce motion' nothing moves.",
  ],
  expectNot: [
    "The circles must NOT be strong or one flat colour.",
    "A lone last card must NOT sit at the left with an empty space beside it.",
    "The page must NOT scroll sideways.",
  ],
};

export const run = (d) => runSuite(d, "website-apps-cards.mjs", { timeoutMs: 10 * 60_000 });
