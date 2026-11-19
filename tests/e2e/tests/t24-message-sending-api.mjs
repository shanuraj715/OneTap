// T24 — Message sending: the API rules behind verification codes, on its own throwaway database (no browser).
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t24-message-sending-api",
  title: "Message sending — API rules: codes by linked WhatsApp / WhatsApp Business / SMS, never stored, never shown, capped, plan-gated",
  area: "notifications",
  browser: false,
  fresh: false,
  summary: "Runs suites/msg-api.mjs: its own in-memory API with the WhatsApp worker on and WhatsApp's connection (and an SMS gateway and Meta) replaced by stand-ins. Covers choosing and refusing a way to send codes, a code going out over each way, what is stored (the code never), who stays out of the inbox, the daily cap, a number that isn't on WhatsApp, a number that is offline, staff coin codes, plan rules, and a store that turned SMS codes on the old way.",
  expect: [
    "Before anything is chosen the code is shown on screen (as it always was).",
    "A way that can't send (no connected number, no gateway, no template, message without {{code}}, plan lacks it) is refused with a reason; 'Don't send' is always allowed; only managers of notifications can change it.",
    "Over linked WhatsApp the code goes out from the store's number in seconds, in the store's wording, and is not returned to the caller; 123456 stops working.",
    "The stored WhatsApp message never contains the code; the stranger's chat stays out of the inbox (and appears once the store really chats with them); a failed code can't be retried from the inbox.",
    "SMS goes through the gateway in the 'Code message' wording; WhatsApp Business reaches Meta with the template, language, code in {{1}} and (when ticked) the Copy-code button.",
    "A number that isn't on WhatsApp is told so; past the daily cap nothing more goes out; with the number offline the customer is asked to try later.",
    "Staff coin codes use the chosen way.",
    "A store that switched on SMS codes before this existed keeps them until its owner chooses something.",
  ],
  expectNot: [
    "A code must NOT be returned to the caller, or accepted as 123456, once a real way is chosen — even when that way is offline.",
    "The code must NOT be kept in any stored WhatsApp message.",
    "A stranger who only got a code must NOT appear in the owner's WhatsApp inbox.",
    "More codes than the daily cap must NOT go out.",
  ],
};

export const run = (d) => runSuite(d, "msg-api.mjs");
