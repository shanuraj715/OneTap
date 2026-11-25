// T79 — Secrets already stored in the database stay readable (the encryption "salt" must never be renamed with the product).
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t79-stored-secrets",
  title: "Stored secrets stay readable — a secret locked before the Rasoi Pulse rename still opens, and old and new builds read each other's secrets",
  area: "security",
  browser: false,
  fresh: false,
  summary: "Runs suites/stored-secrets.mjs (no browser, no database). It carries one secret locked with the ORIGINAL key text ('onetap.payment-credentials.v1', written by an independent copy of the algorithm) and checks that apps/api/src/lib/crypto.js opens it; that the test value really does NOT open with the renamed text (so a rename would be noticed); that a secret the app locks today opens again and also opens with the original text (so a rollback to an older build still reads it); and that a secret locked with the renamed text is refused. Written after the product rename changed that text and would have made every stored gateway key, R2/S3 key, AI key, SMS / WhatsApp Business token, printer key and linked WhatsApp session unreadable.",
  expect: [
    "A secret locked with the original text opens in the app.",
    "A secret the app locks today also opens with the original text.",
  ],
  expectNot: [
    "A rename of the product must NOT change the text that the secrets' key is made from.",
    "A secret locked with the renamed text must NOT be accepted.",
  ],
};

export const run = (d) => runSuite(d, "stored-secrets.mjs");
