// T93 — The staff app's updates: upload an APK in pieces, publish it, force an update; phones ask; the website serves it.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t93-app-releases-api",
  title: "App updates: the platform admin uploads an APK in pieces and publishes it (optionally forcing an update); phones ask 'is there a newer version?'; old builds are turned away at sign-in when an update is forced",
  area: "app",
  browser: false,
  fresh: false,
  summary: "Runs suites/app-releases-api.mjs on a private API with an in-memory database and a temporary folder for the files (no browser). Only the platform admin can manage releases. An upload is split into 4 MB pieces (a wrong piece, a repeated piece, a missing piece, a too-big file, a non-.apk, a zip with no AndroidManifest.xml, a bad version and a repeated build number are all refused with clear words; pieces can arrive out of order and be re-sent). A finished upload is a draft with the file's real size and SHA-256 on disk; drafts are invisible to phones and the website. Publishing: a phone on an older build is told a newer one exists (optional), a forced release makes the update REQUIRED for every older build — including one that skipped it and sees a later optional release — with what's new listed newest first; a phone on the newest build, a newer build, or with no build number is told nothing. A forced update turns old builds away at app sign-in (426 update_required, before any password is checked) while newer builds, older apps that send no number and the dashboard sign-in are unaffected. The APK downloads byte for byte with a clear name, supports resuming (byte ranges) and counts a download once; withdrawn/draft/made-up addresses are 404. The website's list shows only published releases, newest first, with no internal fields. Notes/force/status can be changed (reaching phones at once); delete removes the file.",
  expect: [
    "A phone on an older build is told about a newer release; a forced one makes it required for every older build (even ones that skipped it).",
    "An old build is refused at sign-in (426) only while a forced update is out.",
    "The uploaded APK downloads byte for byte; drafts and withdrawn releases don't.",
  ],
  expectNot: [
    "A non-APK, an oversized file or a repeated build number must NOT become a release.",
    "A phone with an unknown build must NOT be told to update or blocked.",
    "A store owner or a waiter must NOT be able to manage releases.",
  ],
};

export const run = (d) => runSuite(d, "app-releases-api.mjs", { timeoutMs: 6 * 60_000 });
