// T61 — The dish form is a pop-up with a fixed footer; Esc closes it; photos save themselves, everything else needs Save.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t61-item-form-modal",
  title: "Edit / New item is a pop-up — fixed Save and Cancel footer, scrolling body, Esc closes — and photos are saved as they change",
  area: "menu",
  browser: true,
  fresh: false,
  summary: "Runs suites/item-form-modal-ui.mjs in Chrome on a short window (so the form must scroll). Edit opens a pop-up over the still-visible item list; its body scrolls on its own while the Save changes / Cancel footer stays exactly where it was and inside the window, and the page behind doesn't scroll; a click outside does not close it, Esc and ✕ do. Typing a new name and pressing Cancel or Esc changes nothing, typing alone saves nothing, Save changes saves it and closes the pop-up, and Save is off while the name is empty. Photos: an uploaded photo is on the dish at once without pressing Save (while a name typed in the same form is still unsaved), the Photos heading says 'Saved', a second photo and a removal are saved too, closing with Esc keeps the photos and drops the unsaved name, and reopening shows them. A NEW dish says its photos are saved when it is created, shows no 'Saved' status, a photo creates nothing by itself, cancelling deletes the photo it uploaded (404 afterwards, no item left), and Create item saves the dish with its photo. The dish and its photos are put back.",
  expect: [
    "The form is a pop-up; the footer buttons stay fixed while the body scrolls; Esc and ✕ close it, an outside click doesn't.",
    "Photos (upload, remove) are saved immediately on an existing dish; other fields only with Save; Cancel/Esc drop unsaved fields.",
    "A new dish saves its photos with Create item; cancelling leaves no orphan upload.",
  ],
  expectNot: [
    "Typing in a field must NOT save it; closing must NOT undo photos that were already saved.",
    "Cancelling a new dish must NOT leave its uploaded photo on the server.",
    "No errors in the browser console.",
  ],
};

export const run = (d) => runSuite(d, "item-form-modal-ui.mjs");
