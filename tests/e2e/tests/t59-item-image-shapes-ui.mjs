// T59 — A dish's pictures in four shapes: the dashboard form and what each storefront card style shows.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t59-item-image-shapes-ui",
  title: "Dish photos in four shapes — the dish form's four sections (upload, replace, trim warning, paste into the chosen one, remove) and the picture each card style shows",
  area: "menu",
  browser: true,
  fresh: false,
  summary: "Runs suites/item-image-shapes-ui.mjs in Chrome on the bench store (Acme Momos, Main). Dashboard: Menu → a dish → Edit shows four sections — Square 1:1 (marked Default, holding the dish's own pictures), Landscape 4:3, Wide 16:9 and Portrait 3:4 — the last three start empty. A real PNG is uploaded into each (its 'Add' tile then goes: one picture per shape); choosing another landscape picture replaces the first; a square picture put in the landscape section says 'not 4:3 — its edges are trimmed', and putting a real 4:3 one back clears the note. Ctrl/⌘+V is aimed at the square section until another section is clicked, and a pasted picture goes into the clicked (portrait) section. Saving stores 1 landscape + 1 wide + 1 portrait next to the dish's own squares, which are exactly the files it had (same order), and the wide and tall files really are wide and tall; reopening shows each in its own section; removing the wide one brings its 'Add' tile back and saves. Storefront: a dish with all four pictures and one with only a square picture are shown with each card style — C02 C03 C09 the square, C04 C05 C07 the landscape, C06 C11 the wide, C08 the portrait — and the square-only dish shows its square picture on every one; the dish pop-up shows the wide picture (the square-only dish still shows its square). Everything is put back — the dish's own pictures exactly as they were.",
  expect: [
    "Four photo sections; one picture per non-square shape; replace works; the trim warning appears only for a wrong shape.",
    "Paste goes to the section last clicked; the square set is untouched by it.",
    "Saved shapes are right and the dish's square pictures are unchanged.",
    "Each card style shows the picture of its shape, and the square one when its shape is missing.",
  ],
  expectNot: [
    "The dish's own square pictures must NOT change, move or disappear.",
    "No errors in the browser console.",
  ],
};

export const run = (d) => runSuite(d, "item-image-shapes-ui.mjs");
