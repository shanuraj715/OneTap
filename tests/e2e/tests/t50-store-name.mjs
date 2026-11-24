// T50 — The STORE name: shown read-only in the store dashboard (contact the admin), renamed only by the platform admin; outlet rename follows to the display name (Chrome).
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t50-store-name",
  title: "Store name — the dashboard's Business identity shows the STORE name, always disabled, with a note to contact the Rasoi Pulse admin; only the platform admin can rename the store (console → Stores → the store); renaming an outlet changes its display name",
  area: "settings",
  browser: false,
  fresh: false,
  summary: "Runs suites/store-name.mjs against the bench in Chrome. As the owner of Acme Momos, Settings → Business identity: the first box is 'Store name' (there is no 'Restaurant name' box any more) and shows the store's name; it is disabled and read-only, typing into it changes nothing, and a note under it says 'Contact the Rasoi Pulse admin to update the store name.'; saving Settings leaves the store name alone; the platform rename route refuses the owner and an owner can't slip a name into a settings save. As the platform admin, Console → Stores → the store has a 'Store name' card: the 'Rename store' button is off until the name changes (and for a blank name), the box is limited to 80 characters, pressing it trims the spaces and shows 'Store name changed.'; the page heading, the storefront's heading and header, and the owner's Settings all show the new name straight away (the owner's box still disabled); the server refuses an empty name and one over 80 characters; the admin viewing the store's own Settings is pointed to the console. Then, as the owner, Settings → Outlets → ✎ on an outlet and renaming it changes the outlet's name AND its display name (the one customers, receipts and messages show — what the old 'Restaurant name' box edited), leaves the STORE name alone, and the storefront's outlet picker shows it. The store and outlet names are put back.",
  expect: [
    "Settings → Business identity shows 'Store name' with the store's name, disabled and read-only, with a note to contact the Rasoi Pulse admin.",
    "Only the platform admin can rename the store (console store page); the new name shows on the storefront and in the owner's Settings immediately.",
    "Renaming an outlet in Settings → Outlets changes the outlet's display name everywhere; the store name is unchanged.",
  ],
  expectNot: [
    "The store owner must NOT be able to change the store name — not in the box, not by saving Settings, not through the rename route.",
    "A blank or over-80-character name must NOT be saved.",
    "Renaming an outlet must NOT change the store's name.",
    "The browser must NOT log errors or warnings.",
  ],
};

export const run = (d) => runSuite(d, "store-name.mjs");
