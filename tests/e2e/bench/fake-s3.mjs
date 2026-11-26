import { createHash } from "node:crypto";
import { createServer } from "node:http";

/* ------------------------------------------------------------------ a stand-in for an S3-compatible service (R2, S3…) */
/**
 * A stand-in for an S3-compatible service (Cloudflare R2, Amazon S3…) for tests: path-style `/<bucket>/<key>`, PUT / GET / HEAD /
 * DELETE, CopyObject (replace headers) and ListObjectsV2 in small pages. It wants a signed request (`AWS4-HMAC-SHA256 Credential=<accessKey>/…`) for everything
 * except reading a file when `state.publicRead` is on. `fail` holds keys whose upload it refuses; `state.slow` delays every answer.
 */
export function fakeS3({ bucket = "media", accessKey = "AKTEST", publicRead = true, pageSize = 3 } = {}) {
  const store = new Map(); // key → { body, type, modified }
  const fail = new Set(); // keys whose upload is refused
  const seen = { puts: 0, lists: 0, gets: 0, heads: 0, deletes: 0, copies: 0, signed: [] }; // signed: the header names each signed PUT carried
  const copyFail = new Set(); // keys whose copy-in-place answers 200 with an <Error> inside (as S3 sometimes does)
  const state = { publicRead, slow: 0 };
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    const parts = url.pathname.split("/").filter(Boolean);
    const signed = /^AWS4-HMAC-SHA256 Credential=([^/]+)\//.exec(req.headers.authorization ?? "");
    const send = (code, body = "", headers = {}) => { res.writeHead(code, headers); res.end(body); };
    if (state.slow) await new Promise((r) => setTimeout(r, state.slow));
    if (parts[0] !== bucket) return send(404, "<Error><Code>NoSuchBucket</Code><Message>The specified bucket does not exist</Message></Error>");
    const key = decodeURIComponent(parts.slice(1).join("/"));
    const publicOk = (req.method === "GET" || req.method === "HEAD") && key && state.publicRead && !signed;
    if (!publicOk && signed?.[1] !== accessKey) return send(403, "<Error><Code>InvalidAccessKeyId</Code><Message>The access key you provided does not exist.</Message></Error>");
    if (req.method === "PUT") {
      seen.signed.push({ key, signedHeaders: /SignedHeaders=([^,]+),/.exec(req.headers.authorization ?? "")?.[1]?.split(";") ?? [] });
      const copyFrom = req.headers["x-amz-copy-source"];
      if (copyFrom) { // CopyObject: the same bytes under a key, with the headers kept or (x-amz-metadata-directive: REPLACE) replaced
        const src = store.get(decodeURIComponent(String(copyFrom)).replace(new RegExp(`^/?${bucket}/`), ""));
        if (!src) return send(404, "<Error><Code>NoSuchKey</Code><Message>The specified key does not exist.</Message></Error>");
        if (copyFail.has(key)) return send(200, "<Error><Code>InternalError</Code><Message>copy failed inside the body</Message></Error>");
        const replace = req.headers["x-amz-metadata-directive"] === "REPLACE";
        seen.copies += 1;
        store.set(key, { body: src.body, type: replace ? req.headers["content-type"] ?? "" : src.type, cacheControl: replace ? req.headers["cache-control"] ?? "" : src.cacheControl ?? "", modified: new Date() });
        return send(200, "<CopyObjectResult><ETag>x</ETag></CopyObjectResult>");
      }
      const chunks = [];
      for await (const c of req) chunks.push(c);
      if (fail.has(key)) return send(500, "<Error><Code>InternalError</Code><Message>try again later</Message></Error>");
      // the signature covers the body's SHA-256 (a streamed upload sends the one it computed): a body that doesn't match is refused, as S3 does
      const claimed = String(req.headers["x-amz-content-sha256"] ?? "");
      const actual = createHash("sha256").update(Buffer.concat(chunks)).digest("hex");
      if (claimed && claimed !== "UNSIGNED-PAYLOAD" && claimed !== actual) return send(400, "<Error><Code>XAmzContentSHA256Mismatch</Code><Message>The provided x-amz-content-sha256 header does not match what was computed.</Message></Error>");
      seen.puts += 1;
      store.set(key, { body: Buffer.concat(chunks), type: req.headers["content-type"] ?? "", cacheControl: req.headers["cache-control"] ?? "", modified: new Date() });
      return send(200);
    }
    if (req.method === "DELETE") { seen.deletes += 1; store.delete(key); return send(204); }
    if (req.method === "HEAD" || (req.method === "GET" && key)) {
      const o = store.get(key);
      if (req.method === "HEAD") seen.heads += 1; else seen.gets += 1;
      if (!o) return send(404, req.method === "HEAD" ? "" : "<Error><Code>NoSuchKey</Code></Error>");
      const range = req.method === "GET" ? /^bytes=(\d+)-(\d*)$/.exec(String(req.headers.range ?? "")) : null;
      if (range) { // one byte range, as S3 / R2 answer it
        const from = Number(range[1]), to = Math.min(o.body.length - 1, range[2] === "" ? o.body.length - 1 : Number(range[2]));
        if (from >= o.body.length) return send(416, "<Error><Code>InvalidRange</Code></Error>");
        return send(206, o.body.subarray(from, to + 1), { "content-length": to - from + 1, "content-range": `bytes ${from}-${to}/${o.body.length}`, "content-type": o.type });
      }
      return send(200, req.method === "HEAD" ? "" : o.body, { "content-length": o.body.length, "content-type": o.type, "last-modified": o.modified.toUTCString(), ...(o.cacheControl ? { "cache-control": o.cacheControl } : {}) });
    }
    if (req.method === "GET" && url.searchParams.get("list-type") === "2") {
      seen.lists += 1;
      const prefix = url.searchParams.get("prefix") ?? "";
      const after = Number(url.searchParams.get("continuation-token") ?? 0);
      const all = [...store.keys()].filter((k) => k.startsWith(prefix)).sort();
      const page = all.slice(after, after + pageSize);
      const more = after + pageSize < all.length;
      const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
      return send(200, `<?xml version="1.0"?><ListBucketResult><IsTruncated>${more}</IsTruncated>${more ? `<NextContinuationToken>${after + pageSize}</NextContinuationToken>` : ""}${page.map((k) => `<Contents><Key>${esc(k)}</Key><LastModified>${store.get(k).modified.toISOString()}</LastModified><Size>${store.get(k).body.length}</Size></Contents>`).join("")}</ListBucketResult>`, { "content-type": "application/xml" });
    }
    return send(400);
  });
  return new Promise((r) => server.listen(0, "127.0.0.1", () => r({ server, store, fail, copyFail, seen, state, bucket, port: server.address().port, endpoint: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((d) => server.close(d)) })));
}

