// T127 — A printer's cloud API key never leaves the server (and no database internals leak into the printer answers)
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t127-printer-secret-api",
  title: "A printer's cloud API key never leaves the server: create, list (owner and waiter) and change answers carry only 'a key is set' and a masked tail, no stored copy, no database internals",
  area: "printing",
  browser: false,
  fresh: false,
  summary: "API checks on an in-memory database. A cloud printer is created with an API key. In the database the key is stored scrambled. The create answer, the owner's list, a waiter's list (a waiter may read printers) and the answer to a rename contain neither the key, nor the stored scrambled copy, nor any database internals ($__parent, _doc, $isNew — before the fix the printer's connection was a raw Mongoose sub-document that spread the whole printer into the answer). They say cloudApiKeySet: true and a short masked tail; the other connection fields (host, port, cloudPrinterId, agentId …) are all still there for the dashboard. Renaming the printer keeps the stored key untouched.",
  expect: [
    "No answer about a printer contains the key, its stored copy or database internals.",
    "The answers still say a key is set, with a masked tail, and keep every other connection field.",
  ],
  expectNot: [
    "A waiter's printer list must NOT carry the stored key.",
    "A rename must NOT change the stored key.",
  ],
};

export const run = (d) => runSuite(d, "printer-secret-api.mjs", { timeoutMs: 3 * 60_000 });
