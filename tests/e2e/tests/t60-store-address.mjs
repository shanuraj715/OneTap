// T60 — A store opened by the platform super admin has its own address: /store/<store-name>/<store-id>/<page>.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t60-store-address",
  title: "Super admin inside a store — every page is at /store/<store-name>/<store-id>/…; the store owner keeps the plain addresses",
  area: "platform",
  browser: true,
  fresh: false,
  summary: "Runs suites/store-address-ui.mjs in Chrome on the bench. As the platform super admin: 'Open store dashboard' on a store's page lands on /store/acme-momos/<id>; the sidebar's Menu, Orders and Settings go to …/menu, …/orders, …/settings and a tab inside Settings (Payments) keeps the prefix; reloading a store page stays on it; a wrong or old name in the address is corrected to the current store name; an old plain address (/orders) goes to the store they last had open; an address carrying ANOTHER store's id shows that store (the id decides, the name follows); 'Back to my dashboard' leaves to the store's platform page and the platform console stays at /platform. As the store owner: Menu is /menu and Orders is /orders with no /store prefix, and typing a /store/… address sends them back to their own dashboard.",
  expect: [
    "Opening a store from the console puts /store/<name>/<id> in the address and every page under it keeps the prefix.",
    "A reload or a shared link stays in that store; a wrong name or another store's id is handled by the id.",
    "Leaving the store returns to the platform console.",
    "A store owner's addresses are unchanged.",
  ],
  expectNot: [
    "A store page must NOT open at a plain address for the super admin (it would be unclear which store it is).",
    "An owner must NOT be able to use the /store/… address.",
    "No errors in the browser console.",
  ],
};

export const run = (d) => runSuite(d, "store-address-ui.mjs");
