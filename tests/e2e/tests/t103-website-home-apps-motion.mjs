// T103 — The marketing website's header, footer and homepage: nav, apps note, richer sections, motion, no text selection.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t103-website-home-apps-motion",
  title: "Website → header keeps to Product / Pricing / Apps / FAQ (About + Contact in the footer); homepage has a short animated 'We have apps too' note (no cards); hero backdrop fades out; livelier Features and moments; motion that stops under reduce-motion; no text selection or text cursor",
  area: "website",
  browser: true,
  fresh: false,
  summary: "Runs suites/website-home-apps-motion.mjs in Chrome against the bench API and the marketing website on :3173 (built from the current code into .bench/website — never touching apps/website/.next). The bench has no website pages, so the suite publishes its own (home with hero, product tabs, stats, features and moments; pricing, faq, about, contact) and removes them afterwards. Header: Pricing, Apps, FAQ after the Product dropdown plus the Talk to us button, no About/Contact (also in the phone menu); footer has About, Contact and Apps. Home: an 'apps' section right after the product tabs — 'We have apps too', a few words, one 'See the apps' link, an animated picture of an order ticket travelling OMA → KDA → RDA (ticket slides, dashed line marches, apps bob and ring when the ticket arrives), and NO app cards or download buttons. The hero's coloured backdrop stays inside the hero, is masked to fade out, and at the hero's bottom edge (1360 px and 390 px) the pixel colour equals the page colour (no hard line, the bug the user reported). The dark stats band has no border. Features: 56 px tinted tiles in different colours, a faint big icon per card, a drifting colour behind (masked), and a light that follows the pointer (--mx/--my, bright edge + wash, lift). Moments: small WHEN label + capitalised rest, a title without 'When' left as written, pulsing dot, two columns. Scroll-reveal: a far card starts faded and is visible once scrolled to, nothing at the top is left invisible. With reduce-motion every animation is off and everything is fully visible (the ticket rests between the first two apps). Text can't be selected (triple-click, drag, Select All select nothing) and the pointer is an arrow over text and a hand over links/buttons; typing fields and the checksum box still allow selection. /apps still shows its three cards. A 390 px screen has no sideways overflow.",
  expect: [
    "Header = Product dropdown, Pricing, Apps, FAQ, Talk to us; footer has About, Contact, Apps.",
    "The homepage's apps section sits after the product tabs, is short, links to /apps and its picture moves.",
    "At the hero's bottom edge the colour is the page colour on wide and phone screens.",
    "With reduce-motion nothing animates and everything is visible.",
    "Selecting text selects nothing; the pointer is an arrow or a hand, never the I-beam (except inside typing fields).",
  ],
  expectNot: [
    "The homepage must NOT show app cards or download buttons.",
    "About and Contact must NOT be in the header.",
    "The hero colour must NOT end in a hard line; the stats band must NOT have a thin outline.",
    "No errors in the browser; nothing off the edge on a phone.",
  ],
};

export const run = (d) => runSuite(d, "website-home-apps-motion.mjs", { timeoutMs: 8 * 60_000 });
