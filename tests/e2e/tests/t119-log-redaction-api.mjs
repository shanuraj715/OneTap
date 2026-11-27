// T119 — The API's request log never contains a secret (session cookie, Bearer token, secret headers, Set-Cookie)
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t119-log-redaction-api",
  title: "The API's request log never contains a secret (session cookie, Bearer token, secret headers, Set-Cookie)",
  area: "security",
  browser: false,
  fresh: false,
  summary: "Starts the REAL API in production mode (plain JSON log lines on stdout) on a throwaway in-memory database and sends requests that carry a session cookie, an app's Bearer token, the website's revalidate secret, the print agent's and site secrets, an API key, and a sign-in with a wrong password; then reads everything the API wrote. None of those values is anywhere in the log; the places where they were read '[hidden]'; the harmless parts (method, address, the browser name, the answer's status) are still logged. A second check uses the same logger set-up on a small server that answers with a Set-Cookie: neither the cookie sent nor the cookie set appears, and the password typed in a sign-in body is never logged. (Before the fix, every request line held the visitor's session cookie.)",
  expect: [
    "A request's cookie, Authorization header and the other secret headers are written to the log as '[hidden]'.",
    "The Set-Cookie of an answer is written as '[hidden]'.",
    "Method, address, user-agent and status are still logged.",
  ],
  expectNot: [
    "No session cookie, Bearer token, secret header value or password may appear anywhere in the log.",
  ],
};

export const run = (d) => runSuite(d, "log-redaction-api.mjs", { timeoutMs: 3 * 60_000 });
