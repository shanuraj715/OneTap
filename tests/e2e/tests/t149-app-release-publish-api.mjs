// T149 — Adding an app release from an APK on the machine (the publish script): same checks and storage as the console's upload.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t149-app-release-publish-api",
  title: "Publishing an app release from a file (apps/api/src/scripts/publish-app-release.js): the same checks and storage as the console's upload; draft by default, --publish, optional or --force-required, a version used once per app",
  area: "app",
  browser: false,
  fresh: false,
  summary: "Runs suites/app-release-publish-api.mjs on a private API with an in-memory database and a temporary uploads folder; the script is run as a separate process, as on the server (no browser). --dry-run says the file is an APK and stores nothing. A non-APK, a version in the wrong form, an unknown app, a missing file and missing arguments are refused with clear words and store nothing. Without --publish a release is saved as a draft (real size and SHA-256, the file under app-releases/<app>/ in the platform's storage) and is invisible to phones and the website; with --publish it is offered to phones on older builds as an OPTIONAL update, listed on the website's data, and downloads byte for byte. --force makes the update required (phones on an older build are told so). A version that already exists for the app is refused and stores no file; build numbers are per app.",
  expect: [
    "A published release reaches phones as an optional update, the website's list and a working download.",
    "A draft is saved but invisible until it is published.",
    "--force makes the update required.",
  ],
  expectNot: [
    "A file that isn't an APK must NOT be stored.",
    "A version that already exists must NOT be stored again.",
    "A release must NOT be forced unless --force is given.",
  ],
};

export const run = (d) => runSuite(d, "app-release-publish-api.mjs", { timeoutMs: 6 * 60_000 });
