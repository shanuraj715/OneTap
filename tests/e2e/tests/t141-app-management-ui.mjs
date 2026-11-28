// T141 — App Management in Chrome: add an app by name, edit it, make it public (website card with a generated icon), remove it.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t141-app-management-ui",
  title: "App Management → 'Add an app': the super admin types a name, the address and icon code are made from it; the app starts private, opens by its link, can be edited, made public (website card with a generated icon) and removed — built-in apps can't be removed",
  area: "platform",
  browser: true,
  fresh: false,
  summary: "Chrome against the bench console (super admin) and the bench website. The five built-in apps have tabs in order; a built-in app says 'Built in', its Remove button is off with the reason, and its address is locked when editing. 'Add an app' stays off until there is a name; typing 'Rasoi Pulse POS' fills the address (rasoi-pulse-pos) and code (RPP); a bad address is explained and blocks Add; the code takes 5 characters at most. Saving adds a tab after the built-in ones, opens it, shows its words, starts it Private, with no Refresh interval card. Adding the same name again says there is already an app there and creates nothing. Editing changes the words (name, tagline) in the About card and the tab while the address stays. On the website a private app is not in /apps but its page opens by the link with the words from the console, tells search engines to skip it and has no Download button; an unknown address is a 404. Making it public puts a card in /apps with an icon generated from its code; its page shows it too. Removing it (after a question) drops the tab, the public list and the page (404). What the test adds is removed at the end.",
  expect: [
    "Typing a name fills in the address and the code; the app starts private and its page opens by the link.",
    "Public puts a card with a generated icon on the website's /apps page.",
    "Removing an app removes its tab, its place in the list and its page.",
  ],
  expectNot: [
    "A built-in app must NOT be removable.",
    "An address that already exists must NOT create a second app.",
    "A private app must NOT be in the website's list of apps.",
    "Editing must NOT change an app's address.",
  ],
};

export const run = (d) => runSuite(d, "app-management-ui.mjs", { timeoutMs: 8 * 60_000 });
