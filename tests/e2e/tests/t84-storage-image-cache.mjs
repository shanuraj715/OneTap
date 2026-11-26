// T84 — Pictures stored in the cloud carry a browser cache header, and the ones stored before can be given it.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t84-storage-image-cache",
  title: "Browser caching of pictures: new cloud uploads carry a one-year immutable cache header, and pictures stored earlier can be given it in place",
  area: "storage",
  browser: false,
  fresh: false,
  summary: "Runs suites/storage-image-cache.mjs against a fake S3 service (no browser, no database). A picture uploaded to the cloud is stored with 'Cache-Control: public, max-age=31536000, immutable' as part of the signed request; documents get none; a caller can still choose its own. For pictures stored before: a dry run counts those without a long cache time (none, or a short one) and changes nothing; '--limit 1' changes exactly one; the full run copies each object onto itself with the header (bytes and type unchanged, copy-source / directive / cache header signed), leaves PDFs and already-fine pictures alone, and a second run does nothing. A copy that S3 answers with 200 but an error in the body is reported as a failure while the others still succeed. Pictures on the server's own disk need nothing (the API already serves them with the same header).",
  expect: [
    "A picture uploaded to the cloud has Cache-Control: public, max-age=31536000, immutable; a PDF has none.",
    "The refresh gives every picture without a long cache time that header without changing its bytes or type, and a second run changes nothing.",
  ],
  expectNot: [
    "Documents must NOT get a public cache header.",
    "A dry run must NOT change anything.",
  ],
};

export const run = (d) => runSuite(d, "storage-image-cache.mjs");
