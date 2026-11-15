// T05 — WhatsApp chat list: "via" chips and filters.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t05-whatsapp-chat-filters",
  title: "WhatsApp chat list — 'via' chips and filters (All, Unread, Needs reply, New, No offers, by number)",
  area: "whatsapp",
  browser: false,
  fresh: true,
  summary: "Runs suites/wa-ui-filters.mjs against the bench's four seeded chats: every chat shows the number it is on as a chip (saying when that number is offline), the filters narrow the list correctly and combine, 'Clear filters' resets, and the phone layout does not scroll sideways.",
  expect: [
    "Each chat shows 'via <number>' as a rounded chip, saying when that number is offline.",
    "All lists every chat; Unread and Needs reply show only Riya Sharma; New shows chats the customer never wrote to; No offers shows the customer who sent STOP; filter by number works.",
    "Filters combine, and an empty result says 'No chats match.'; 'Clear filters' brings everything back.",
  ],
  expectNot: [
    "A filter must NOT show a chat that does not match it.",
    "The phone layout must NOT scroll sideways.",
    "The page must NOT throw JavaScript errors.",
  ],
};

export const run = (d) => runSuite(d, "wa-ui-filters.mjs");
