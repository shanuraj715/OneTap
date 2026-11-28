// T136 — The web version system: one file, a script that only bumps on request, and the API's X-RasoiPulse-Version header
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t136-version-api",
  title: "Web version: version.json is the one place, `bump` refuses without --confirm, a bad version is refused in words, and the API sends X-RasoiPulse-Version on every answer (errors and pre-flights too)",
  area: "platform",
  browser: false,
  fresh: false,
  summary: "A private API on an in-memory database. The rules (v-YY.MM.DD-NNN, a new day starts at 001, the same day counts up, India's day) are checked directly; the script's show / check / bump (refused without --confirm, file untouched) is run for real; the API's health check, a 404, a 401, a sign-in and a CORS pre-flight all carry the version in the X-RasoiPulse-Version header, the health body carries it too, and a page on another address may read the header.",
  expect: [
    "version.json holds one valid version and `show` prints it.",
    "`bump` without --confirm refuses and leaves the file alone.",
    "Every API answer — even a 404, a 401 and a pre-flight — carries X-RasoiPulse-Version equal to version.json.",
  ],
  expectNot: [
    "The version must NOT change by itself (a build, a deploy or a test never bumps it).",
    "A malformed version must NOT be accepted.",
  ],
};

export const run = (d) => runSuite(d, "version-api.mjs", { timeoutMs: 3 * 60_000 });
