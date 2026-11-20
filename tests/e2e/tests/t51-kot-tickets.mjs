// T51 — Kitchen tickets (KOT): dishes go to the printer of the station that makes them; an edited order sends a CHANGE ticket; a cancelled order sends a CANCELLED ticket.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t51-kot-tickets",
  title: "Kitchen tickets (KOT) — each dish goes to the right printer (kitchen / bar); an order edited after its ticket went out sends an 'ORDER CHANGED' ticket with only the difference; a cancelled order withdraws a waiting ticket or sends 'ORDER CANCELLED — DO NOT COOK'",
  area: "printing",
  browser: false,
  fresh: false,
  summary: "Two suites. (1) suites/kot-tickets-api.mjs (its own in-memory API, the text on every ticket is read from the saved print jobs): a Food category (kitchen by default) and a Drinks category set to Bar with Hot Drinks inside it, plus a dish that overrides its category each way; a kitchen printer, a bar printer and a counter receipt printer. Accepting an order gives the kitchen ticket ONLY the kitchen dishes and the bar ticket ONLY the bar dishes (through a sub-category, and by a dish's own setting beating its category's), with quantities and never a price, while the counter receipt keeps the whole order with prices. An order with only kitchen dishes sends nothing to the bar. A dish is never left without a ticket: with the bar printer off its dish prints on the kitchen ticket, with only a bar printer left a kitchen dish prints there, and a KOT printer at any other station (counter) is a master copy with every dish. After the tickets were printed, editing the order sends each printer an 'ORDER CHANGED' ticket with only the difference (ADD 1 x Veg Momos when 2 became 3, REMOVE 1 x Masala Chai, nothing about unchanged dishes), only to the printers that make the changed dishes (a bar-only edit leaves the kitchen alone), a printer that had nothing in the original order still hears about a dish added for it, an edit that changes nothing sends nothing, a changed kitchen note sends 'Note is now: …', and an order edited before any ticket was sent sends no change ticket (its first ticket just shows the new order). Cancelling an order: tickets already printed get a big 'ORDER CANCELLED / DO NOT COOK' ticket with that printer's dishes (once, even if the printer is also set to fire on 'cancelled'), tickets still waiting are withdrawn with no cancelled ticket, a mix of both works, and the counter receipt is untouched. Reprinting a change or cancelled ticket prints that same ticket again; printing by hand on a printer that would get nothing still prints; the print log tells normal, changed and cancelled tickets apart; a dish or category can be set to bar / kitchen / cleared through the menu API, anything else is refused; a store without the Printing feature gets no tickets. (2) suites/kot-menu-ui.mjs in Chrome as the owner of Acme Momos: Menu → a category's ⋯ → Edit… has 'Prepared at' (Same as the category it is inside / Kitchen / Bar / beverages), saves and clears; a dish's Edit form has 'Prepared at' (Same as its category / Kitchen / Bar / beverages), saves and clears; Printing → Queue labels tickets 'order changed' and 'order cancelled'. Everything made is removed.",
  expect: [
    "A kitchen ticket has only the dishes made at that printer's station; no empty tickets; a dish always gets a ticket somewhere.",
    "Editing an order after its ticket was sent prints an ORDER CHANGED ticket with only ADD / REMOVE lines, to the right printers only.",
    "Cancelling prints ORDER CANCELLED — DO NOT COOK where the order was already printed, and just withdraws tickets still waiting.",
    "The dashboard has 'Prepared at' on categories and dishes, and the Printing queue labels changed and cancelled tickets.",
  ],
  expectNot: [
    "A kitchen ticket must NOT show a price.",
    "The bar must NOT get a ticket for kitchen-only dishes (and vice versa).",
    "An edit that changes nothing must NOT print a ticket.",
    "A cancelled ticket must NOT be printed for an order the kitchen never saw.",
    "The browser must NOT log errors or warnings.",
  ],
};

export const run = async (d) => {
  await runSuite(d, "kot-tickets-api.mjs");
  await runSuite(d, "kot-menu-ui.mjs");
};
