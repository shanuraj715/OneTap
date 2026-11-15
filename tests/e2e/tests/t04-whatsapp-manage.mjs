// T04 — WhatsApp: number colours, stats + sharing chats out, clean-up by date, delete a message.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t04-whatsapp-manage",
  title: "WhatsApp management — colours, chat stats and sharing out, clean-up by date, delete a message",
  area: "whatsapp",
  browser: false,
  fresh: true,
  summary: "Runs suites/wa-ui-manage.mjs against the bench: assign a colour to each number (the 'via' chip is filled with it), see how many chats each number holds and share them out equally across numbers, clear old messages/chats by days or a date picked in a calendar, and delete a message with a confirmation box (Enter / Esc) including 'delete for everyone'.",
  expect: [
    "Each number can have a colour and its 'via' chip in the chat list and messages is filled with it.",
    "Stats show the chats held by each number, and one button spreads them equally across the chosen numbers.",
    "Clean-up removes messages or chats older than X days or than a date chosen in the date picker, after asking.",
    "Deleting a message asks for confirmation; Enter confirms, Esc cancels; 'delete for everyone' is offered for the owner's own recent messages.",
  ],
  expectNot: [
    "Esc must NOT delete anything.",
    "Clean-up must NOT touch messages newer than the chosen age or date.",
    "The browser must NOT log errors or warnings.",
  ],
};

export const run = (d) => runSuite(d, "wa-ui-manage.mjs");
