// T132 — App Management: every app (the Admin and Business apps included) can be made public or private; a private app is not in the website's list
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t132-app-visibility-ui",
  title: "App Management → every app has a Public / Private button; the Admin app has its own tab and starts private (not in the website's list, its page still opens by its link)",
  area: "platform",
  browser: true,
  fresh: false,
  summary: "Chrome against the bench console (super admin) and the bench website. The staff apps start public; the Admin and Business apps start private. The Admin app's tab says Private with the link to share and a Copy button, has no Refresh interval card (it does not use it) and keeps the New version upload. Make public (after agreeing to the question) puts it in the server's public list and the tab says Public; Make private takes it out; it is kept after a reload; any app can be switched (RDA out and back); an unknown app is a 404, a value that is not true / false a 400, and someone not signed in gets 401; saving the refresh interval does not change visibility. On the website the /apps page lists OMA, KDA and RDA only, the Admin app's own page /apps/admin opens (and is noindex), and the home page does not mention the private apps.",
  expect: [
    "The Admin app has a tab in App Management with a Public / Private button; it starts private.",
    "A private app is not in the public list or on the website's /apps page, but its own page opens by its link.",
    "Make public / Make private change the public list at once, and the choice is kept.",
  ],
  expectNot: [
    "A private app must NOT appear in the website's list of apps or on its home page.",
    "The Refresh interval card must NOT show for an app that does not use it.",
    "Someone not signed in must NOT be able to change an app's visibility.",
  ],
};

export const run = (d) => runSuite(d, "app-visibility-ui.mjs", { timeoutMs: 8 * 60_000 });
