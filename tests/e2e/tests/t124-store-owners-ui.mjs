// T124 — Console → Stores → a store → Owners tab: the Add-an-owner fields line up; the owner's actions stay together
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t124-store-owners-ui",
  title: "Console → a store → Owners tab: the Add-an-owner fields line up (same top edge, button level), stack on a narrow window; an owner's actions stay together",
  area: "platform",
  browser: true,
  fresh: false,
  summary: "Chrome against the bench console (super admin). Stores → a store → Owners. 'Add an owner': the Name, Email and Password boxes start on the same line and have the same height (the Password hint 'for a new login' sits under its box and pushes nobody), the 'Add owner' button is level with the boxes, they sit side by side in order with real width. On a 520 px window they stack, no two overlap, nothing sticks out and the page doesn't scroll sideways. An owner's row keeps Reset password, Deactivate and Remove together on one line on the right, inside the row; 'Reset password' opens a password box with Set (disabled until 8 characters) and Cancel, and Cancel closes it.",
  expect: [
    "The three boxes of 'Add an owner' share one top edge and height; the button is level with them.",
    "On a narrow window the fields stack with no overlap and no sideways scrolling.",
    "An owner's actions are grouped on the right of the row.",
  ],
  expectNot: [
    "The Password hint must NOT push the other boxes out of line.",
    "No field may overlap another or stick out of the window.",
    "No errors in the browser.",
  ],
};

export const run = (d) => runSuite(d, "store-owners-ui.mjs", { timeoutMs: 4 * 60_000 });
