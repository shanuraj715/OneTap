// T148 — App Management → Screenshots (console UI): add, put pictures in slots, warnings, replace / remove, hide, reorder, edit, remove, the section's settings.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t148-app-screenshots-manager-ui",
  title: "App Management → 'Screenshots on the website': add a screenshot, upload a picture for each device and look, get warned about a wrong shape, replace / remove pictures, hide, reorder, edit, remove; set the section's heading, intro and first device",
  area: "platform",
  browser: true,
  fresh: false,
  summary: "Chrome against the bench console (super admin) and API, on a throwaway app that is removed at the end. An app with no screenshots says so, shows the usual heading and intro as hints, a section switch and a 'View on the website' link. 'Add a screenshot' needs a title of two characters; the new one shows with six empty slots (3 devices × light / dark). Pictures are put in through each slot's file box: they show in the slot with their size and 'uploaded', the slot then offers Replace and Remove, the summary counts pictures and names the devices that will be offered, and the server holds them in the right slots. A wide picture in a phone slot is warned about ('will look squashed') and the warning goes when the right shape replaces it; a text file is refused with words that name the slot; Remove empties a slot (on the server too). Move up / down swaps (the ends are disabled, the server follows), Hide / Show marks it 'Hidden', Edit changes the words (an empty title can't be saved), Remove asks by name and Cancel changes nothing. The section's heading / intro / first device save and reach the server, switching the section off saves at once and is said in the summary, an empty heading means the usual one. At 390 px nothing runs off the screen. When pictures came with the website (OMA), they are marked as such, all load, and each has light and dark pictures.",
  expect: [
    "A picture put in a slot shows there and is stored in the right slot; a wrong shape is warned about.",
    "Reorder, hide, edit, remove and the section settings all reach the server.",
    "Pictures that came with the website show in the console and are marked as such.",
  ],
  expectNot: [
    "A file that is not a picture must NOT be stored.",
    "Cancel in the Remove question must NOT remove anything.",
    "An empty title must NOT be saved.",
    "The page must NOT scroll sideways on a phone-sized screen.",
  ],
};

export const run = (d) => runSuite(d, "app-screenshots-manager-ui.mjs", { timeoutMs: 8 * 60_000 });
