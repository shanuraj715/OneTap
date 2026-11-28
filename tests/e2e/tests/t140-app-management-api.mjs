// T140 — App Management is data: add an app by name, change its words, public/private, its versions, remove it; the built-in apps stay.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t140-app-management-api",
  title: "App Management: the platform admin adds an app (a name is enough), edits its words, makes it public or private, uploads its versions and removes it; built-in apps can't be removed; nothing is hard-coded in the console",
  area: "app",
  browser: false,
  fresh: false,
  summary: "Runs suites/app-management-api.mjs on a private API with an in-memory database (no browser). The five built-in apps (Staff, Kitchen, Rider, Admin, Business) are rows in the apps collection, in order; Business and Admin start private. Only the platform admin may add, edit, remove or switch Public/Private. Adding an app with just a name makes its address and its icon code; it starts private, its page opens by link, it is not in the website's list. Bad names, addresses and codes (empty, too short/long, capitals, spaces, hyphens at the ends, an address a built-in app already has, the same address twice) are refused with a clear sentence and leave nothing behind. An edit changes the words at once and ignores a new address / 'built in' / 'public'. Public/Private moves the app in and out of the website's list. Versions can be uploaded, published and downloaded for the new app (named after it) and do not touch other apps; its refresh interval is told in x-refresh-seconds; any account may sign in from it while the Kitchen app still turns a waiter away. An app with versions can't be removed, a built-in app can't be removed, and after its versions are deleted the app can be removed and its address used again. An older database (only the old Public/Private + refresh numbers) is migrated: the choices are carried over.",
  expect: [
    "A new app has an address and a code made from its name, starts private and opens by its link.",
    "Public/Private moves an app in and out of the website's list; the words an admin changes show at once.",
    "An older database keeps what was chosen (Business public, Rider private, refresh seconds).",
  ],
  expectNot: [
    "A built-in app, or an app that still has versions, must NOT be removed.",
    "A bad or repeated address must NOT create an app.",
    "A store owner or a waiter must NOT add, change or remove an app.",
    "An edit must NOT change an app's address.",
  ],
};

export const run = (d) => runSuite(d, "app-management-api.mjs", { timeoutMs: 4 * 60_000 });
