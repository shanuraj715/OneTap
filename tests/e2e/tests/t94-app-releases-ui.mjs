// T94 — The console's "App updates" page: upload the staff app's APK, publish it, require an update, edit notes, withdraw, delete.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t94-app-releases-ui",
  title: "Console → App updates: choose an .apk, see the upload progress, publish it, make an update required, edit the notes, withdraw and delete",
  area: "app",
  browser: true,
  fresh: false,
  summary: "Runs suites/app-releases-ui.mjs in Chrome against the bench (the platform admin). The sidebar's 'App updates' opens an empty page that says no version is offered, updates are optional, and shows the download page's address. 'New version': Upload is off until a file and a version are given; a non-.apk and a file over the limit are refused at once, the version box is filled from the file name, a wrong format or a taken build number is explained and blocks the button, 'Update required' (with Publish now) warns that older phones will be blocked. On a slowed connection a progress bar counts up and 'Cancel upload' stops it and creates nothing; a whole 9 MB upload (3 pieces) ends with 'is live' and the version listed Published with its size, 0 downloads and notes; the server holds the file with its real size and SHA-256 and the website's list has it. A second version uploaded as a draft is invisible to phones, Publish offers it (optional), 'Required' makes it compulsory (the summary says everything older is stopped; an old build is refused at sign-in) and unticking undoes it. Notes can be edited and reach phones; Withdraw hides it and switches off its APK link; Publish again brings it back; the APK link downloads the exact file and the counter moves; 'File' shows the SHA-256; Delete asks first and removes the file. On a phone-sized screen nothing sticks out sideways.",
  expect: [
    "Publish/withdraw/required changes on the page change what the phone is told at once.",
    "The upload shows progress, can be cancelled, and a cancelled upload leaves nothing behind.",
    "The APK link downloads exactly what was uploaded.",
  ],
  expectNot: [
    "A non-APK, an oversized file, a malformed version or a taken build number must NOT be uploadable.",
    "A draft or withdrawn version must NOT be offered to phones or downloadable.",
    "No errors in the browser.",
  ],
};

export const run = (d) => runSuite(d, "app-releases-ui.mjs", { timeoutMs: 8 * 60_000 });
