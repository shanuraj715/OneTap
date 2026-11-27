import { pino } from "pino";
import { isProd } from "./env.js";

/**
 * Things that must never reach a log file. The request logger (pino-http) writes every header of every request and answer, which includes the
 * visitor's session cookie, an app's Bearer token, the website's revalidate secret and the Set-Cookie of a sign-in. They are replaced by
 * "[hidden]" before anything is written (the value is still there for the code that needs it — only the log line is changed).
 */
export const HIDDEN_IN_LOGS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'req.headers["proxy-authorization"]',
  'req.headers["x-revalidate-secret"]',
  'req.headers["x-api-key"]',
  'req.headers["x-rasoipulse-agent"]',
  'req.headers["x-site-secret"]',
  'res.headers["set-cookie"]',
  "password",
  "*.password",
  "ownerPassword",
  "*.ownerPassword",
  "token",
  "*.token",
];

/** The one logger of the API; `createLogger(stream)` writes to a given stream instead (used by the test that checks nothing secret is logged). */
export function createLogger(stream) {
  return pino(
    {
      level: isProd ? "info" : "debug",
      redact: { paths: HIDDEN_IN_LOGS, censor: "[hidden]" },
      transport: stream || isProd ? undefined : { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } },
    },
    stream,
  );
}

export const logger = createLogger();
