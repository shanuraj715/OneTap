// T36 — Picture addresses: the database keeps only the path, the API adds the current domain (no browser).
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t36-upload-urls-api",
  title: "Pictures are stored without a domain and get the current domain when sent out — so a new domain or machine never breaks them",
  area: "storage",
  browser: false,
  fresh: false,
  summary: "Runs suites/upload-urls.mjs: its own in-memory API whose public address is https://img.example.test. A real upload's answer carries that domain, but an item or category saved with it keeps only '/uploads/<key>' in the database, and the menu comes back with the domain again. Pictures saved the old way (from localhost, from an old domain, or with no domain) come out on the current domain with no migration. Other people's addresses (a CDN link, a look-alike /uploads/ path on another site, a path under another prefix, a data: picture, an address mentioned inside a sentence) are left exactly as they were, both stored and sent. Saving back what the dashboard received — even a localhost address the editor still held — stores only the path. The same stored data comes out on whichever domain the API is configured with. The receipt preview's logo is an absolute address. The clean-up script (normalize-upload-urls) lists, then removes, the domain from what is already stored, leaves other sites' pictures alone, and finds nothing to do the second time.",
  expect: [
    "An upload's response has the current deployment's domain; the database keeps only /uploads/<key> (items, category pictures); the menu response has the domain.",
    "Pictures saved with localhost, an old domain or no domain are returned on the current domain, with no data change.",
    "Saving an address back (with the full domain, or a localhost one) stores only the path.",
    "The same stored path comes out on any configured domain.",
    "The receipt preview's logo is an absolute address on this domain.",
    "The clean-up script's dry run changes nothing; --apply removes the domain from our pictures only; a second run does nothing.",
  ],
  expectNot: [
    "A stored picture must NOT carry a domain (localhost or otherwise) once saved through the API.",
    "The menu must NOT contain a localhost picture address.",
    "A CDN link, a look-alike path on another site, a data: picture or an address inside a sentence must NOT be rewritten.",
  ],
};

export const run = (d) => runSuite(d, "upload-urls.mjs");
