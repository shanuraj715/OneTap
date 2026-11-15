// T03 — WhatsApp in the owner dashboard: chats, numbers, broadcast, access, order updates, roles and phone layout.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t03-whatsapp-dashboard",
  title: "WhatsApp in the dashboard — chat window, numbers, broadcast, access and phone layout",
  area: "whatsapp",
  browser: false,
  fresh: true,
  summary: "Runs suites/wa-ui-chats.mjs in a headless browser against the bench: the owner reads and sends in a chat-style screen, handles an offline number, links a number by QR, starts a broadcast, sets role access and order-update wording; a manager and a cashier see only what their role allows; the phone layout works.",
  expect: [
    "WhatsApp appears in the sidebar for the owner with an unread badge; opening a chat clears it.",
    "Photos and documents show in the chat; read messages show read ticks; sending shows the message at once with a 'waiting' clock.",
    "When a chat's number is offline the owner is asked and offered the number that is online; the choice sticks.",
    "A failed message says why and offers 'Try again'; order updates are labelled; opted-out customers are marked.",
    "The Numbers tab shows each number's state and today's allowance; adding a number goes straight to its QR with the phone steps.",
    "Broadcast shows who gets it, who is skipped and roughly how long first contacts will take.",
    "A manager can read, reply and start chats; a cashier can only read.",
    "On a phone the chat fills the screen with a way back.",
  ],
  expectNot: [
    "A manager must NOT see Numbers / Broadcast / Access.",
    "A cashier must NOT get a reply box or a 'new chat' button.",
    "The page must NOT scroll sideways on a phone, and a customer's number must NOT wrap over two lines.",
    "The browser must NOT log errors or warnings.",
  ],
};

export const run = (d) => runSuite(d, "wa-ui-chats.mjs");
