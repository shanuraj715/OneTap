// T02 — WhatsApp chat: the whole API + sending worker, on its own throwaway database (no browser).
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t02-whatsapp-api",
  title: "WhatsApp chat — API rules and the careful-pace sending worker",
  area: "whatsapp",
  browser: false,
  fresh: false,
  summary: "Runs suites/wa-api.mjs: its own in-memory API with the WhatsApp worker switched on and WhatsApp's connection replaced by a stand-in. Covers who can use chat, linking numbers, chats and sending, the pacing rules, incoming messages, broadcasts, order updates, clear/delete, colours, stats, sharing chats between numbers, clean-up by age, and deleting a message for everyone.",
  expect: [
    "By default only the owner can use WhatsApp chat; the owner can hand access to other roles (read / send); super admin can see chats.",
    "Numbers link by QR, can be given an alias and colour, and a chat keeps going out through the number it started on.",
    "If a chat's number is offline the owner is offered another number, and the choice becomes that chat's number from then on.",
    "New (cold) numbers are messaged slowly: minutes apart, daily caps, quiet hours; existing chats go out at normal speed with a short typing delay.",
    "Broadcasts go to each customer once, reuse the number of an existing chat, add 'Reply STOP', and skip anyone who opted out.",
    "Order-status updates go out from the linked numbers when switched on.",
    "Chats / messages can be cleared by age or date; deleting a message can also delete it for everyone on WhatsApp.",
    "A session's keys are stored encrypted and read back intact.",
  ],
  expectNot: [
    "A role without access must NOT read or send chats.",
    "A new number must NOT be sent more than the daily cap or outside quiet hours.",
    "An opted-out customer must NOT receive broadcasts.",
    "One store's chats / numbers must NOT be visible to another store.",
    "Stored session keys must NOT be readable as plain text.",
  ],
};

// The one check that asks WhatsApp's real servers for a link QR is opt-in:  WA_REAL_QR=1 node run.mjs --only t02
export const run = (d) => runSuite(d, "wa-api.mjs", { env: { WA_REAL_QR: process.env.WA_REAL_QR ?? "" } });
