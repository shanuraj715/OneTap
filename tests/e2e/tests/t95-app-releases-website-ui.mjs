// T95 — The website's /app page: the staff app's download page follows what the console publishes.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t95-app-releases-website-ui",
  title: "Website → /app: the staff app's download page shows the latest published version, its notes and every version, and follows publish / withdraw / required in seconds",
  area: "app",
  browser: true,
  fresh: false,
  summary: "Runs suites/app-releases-website-ui.mjs in Chrome against the bench API and the marketing website on :3173 (built from the current code into .bench/website and started by the suite if needed — never touching apps/website/.next). With nothing published the page says so, offers no download, still explains the app and the install steps, has a titled tab and asks search engines not to list it. Publishing a version (through the console's API) makes a 'Download v-…' button appear that points at the API's download address, shows Android 11+ and the file size, puts the version and its notes on a receipt-style ticket and in a 'Every version' list marked Latest; the button's file is byte-for-byte the upload. A required version gets a 'Required' stamp and pill, the list is newest first with each version's own notes, and 'Check the file' reveals the SHA-256. Withdrawing a version and uploading a draft change nothing public except that the withdrawn one disappears (and its file 404s). On a 390 px screen nothing sticks out sideways. A website page can't be created at /app (reserved).",
  expect: [
    "The page follows publish / withdraw / required within seconds, without a rebuild.",
    "The download button's file is exactly what was uploaded.",
    "Required versions are visibly marked; the SHA-256 can be checked.",
  ],
  expectNot: [
    "A draft or withdrawn version must NOT be shown or downloadable.",
    "The page must NOT be indexed by search engines.",
    "No errors in the browser; nothing off the edge on a phone.",
  ],
};

export const run = (d) => runSuite(d, "app-releases-website-ui.mjs", { timeoutMs: 8 * 60_000 });
