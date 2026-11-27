// T117 — Rasoi Pulse website: About Us / Contact Us live in the footer, not the header menu; the phone menu closes after a link is pressed
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t117-website-menu-ui",
  title: 'Rasoi Pulse website: About Us / Contact Us live in the footer, not the header menu; the phone menu closes after a link is pressed',
  area: "website",
  browser: true,
  fresh: false,
  summary: "Chrome against the website built from the current code, with its own pages published for three namings: the starter names (about / contact), the console names 'About Us' / 'Contact Us' (about-us / contact-us), and pages whose address is something else but whose menu label says About Us / Contact Us. In every case: the header's menu (computer and phone) has Pricing and Apps but nothing called About or Contact; the footer's Company column has both; the 'Talk to us' button still goes to the contact page. The phone menu: pressing Menu opens it; pressing Pricing, FAQ, Apps or the 'Talk to us' button goes to the page AND closes the menu (it used to stay open on top of the new page); a link to the page that is already open closes it too; pressing outside, Escape, pressing Menu again and the browser's back button all leave it closed. With JavaScript off the menu still opens (a native <details>).",
  expect: [
    "About Us and Contact Us are not in the header menu, on a computer or a phone, whatever they are called in the console.",
    "They are in the footer's Company column, and 'Talk to us' still reaches the contact page.",
    "The phone menu closes after any link, a press outside or Escape.",
  ],
  expectNot: [
    "The menu must NOT stay open after a link is pressed.",
    "The menu must NOT stop opening when JavaScript is off.",
    "No errors in the browser.",
  ],
};

export const run = (d) => runSuite(d, "website-menu-ui.mjs", { timeoutMs: 8 * 60_000 });
