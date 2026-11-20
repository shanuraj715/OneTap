// T49 — The item pop-up on the storefront: picture set in with rounded corners, close button, mark + price in the title, tile choices, fixed Add row (Chrome).
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t49-storefront-item-popup",
  title: "Storefront item pop-up — the picture is set in from the edges with rounded corners and has a close button; the name has the veg mark and the price; sizes and extras are tiles that light up; the Add row stays at the bottom while the choices scroll",
  area: "storefront",
  browser: false,
  fresh: false,
  summary: "Runs suites/storefront-item-popup.mjs against the bench store in Chrome. Three add-on groups (dips, sides, drinks, with a free option) are attached to a dish with two sizes, then its pop-up is opened on a desktop and a phone: the picture does not touch the pop-up's edges (at least 12px of space left, right and top) and has rounded corners; the name has the veg / non-veg mark in front and the price beside it ('from ₹60'); 'Choose a size' says Required and each extras group says Optional; extras read '+₹30' and a free one says 'Free'; a round close button sits on the picture's top right and closes the pop-up, and so do Escape, pressing outside and Cancel. The size and extra choices are tiles: the chosen one is highlighted and choosing another moves the highlight; the Add button shows the price of the size, adds an extra's price when ticked and doubles with 'One more'; Add puts it in the cart and closes the pop-up. On a short 390×560 phone the choices scroll inside the pop-up while the Add row does not move and stays fully on screen, and the last choice can be scrolled fully into view. The dish's own add-on groups are put back and the test groups deleted.",
  expect: [
    "The picture has space around it and rounded corners; there is a round close button on it.",
    "The name has the veg / non-veg mark and the price next to it; sections say Required / Optional; free extras say Free.",
    "Chosen sizes and extras are highlighted; the Add button's total follows the choices and quantity.",
    "Escape, outside press, Cancel and the close button all close it; on a short screen the Add row stays in view while the choices scroll.",
  ],
  expectNot: [
    "The picture must NOT start exactly at the pop-up's edge.",
    "The pop-up must NOT be taller than the screen, nor hide the Add button when there are many choices.",
    "Choosing must NOT change the pop-up's size or position in a way that moves the Add button.",
    "The browser must NOT log errors or warnings.",
  ],
};

export const run = (d) => runSuite(d, "storefront-item-popup.mjs");
