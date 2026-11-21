import { createHash, createHmac } from "node:crypto";

/**
 * A tiny S3 client — just PUT and DELETE, signed with AWS Signature V4 by hand.
 *
 * The repo already hand-rolls its crypto (AES-GCM envelopes, webhook signature
 * checks, ESC/POS), so pulling in the ~20 MB AWS SDK for two requests would be
 * out of character. SigV4 is a well-specified four-step HMAC chain; this is it.
 *
 * Works with anything S3-compatible: AWS S3, Cloudflare R2, DigitalOcean
 * Spaces, Backblaze B2, MinIO. Non-AWS services set an `endpoint` and we use
 * path-style addressing; AWS itself uses virtual-hosted style.
 */

const sha256hex = (data) => createHash("sha256").update(data).digest("hex");
const hmac = (key, data) => createHmac("sha256", key).update(data).digest();

/** Encode a key for the request path — keep the slashes, encode each segment. */
function encodeKey(key) {
  return key
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/");
}

/** Resolve host + request path for a bucket/key, AWS vs S3-compatible. An empty key addresses the bucket itself (listing). */
function endpointFor(cfg, key) {
  const encoded = encodeKey(key);
  if (cfg.endpoint) {
    const u = new URL(cfg.endpoint);
    return { host: u.host, protocol: u.protocol, path: encoded ? `/${cfg.bucket}/${encoded}` : `/${cfg.bucket}` };
  }
  const region = cfg.region || "us-east-1";
  const host = region === "us-east-1" ? `${cfg.bucket}.s3.amazonaws.com` : `${cfg.bucket}.s3.${region}.amazonaws.com`;
  return { host, protocol: "https:", path: `/${encoded}` };
}

/** RFC 3986 percent-encoding, as the S3 signature wants it (encodeURIComponent leaves  ! ' ( ) *  alone). */
const rfc3986 = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
const canonicalQuery = (query) =>
  Object.entries(query ?? {})
    .map(([k, v]) => [rfc3986(k), rfc3986(String(v))])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

/** (exported for tests: `now` fixes the clock so a signature can be compared with the one AWS documents) */
export function signedRequest(cfg, { method, key, body, contentType, query, now: at }) {
  const { host, protocol, path } = endpointFor(cfg, key);
  const region = cfg.region || "us-east-1";
  const now = at ?? new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256hex(body ?? Buffer.alloc(0));

  const headers = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  if (contentType) headers["content-type"] = contentType;

  const signedHeaderNames = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaderNames.map((h) => `${h}:${headers[h]}\n`).join("");
  const signedHeaders = signedHeaderNames.join(";");

  const queryString = canonicalQuery(query);
  const canonicalRequest = [method, path, queryString, canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256hex(canonicalRequest)].join("\n");

  const kDate = hmac(`AWS4${cfg.secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");

  headers.Authorization =
    `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return { url: `${protocol}//${host}${path}${queryString ? `?${queryString}` : ""}`, headers };
}

async function s3Fetch(cfg, opts) {
  const { url, headers } = signedRequest(cfg, opts);
  const res = await fetch(url, { method: opts.method, headers, body: opts.body });
  if (!res.ok && !(opts.method === "DELETE" && res.status === 404) && !(opts.method === "HEAD" && res.status === 404)) {
    const text = await res.text().catch(() => "");
    const detail = text.match(/<Message>([^<]+)<\/Message>/)?.[1] || text.slice(0, 200) || res.statusText;
    throw new Error(`S3 ${opts.method} failed (${res.status}): ${detail}`);
  }
  return res;
}

/** @type {import("./types.js").StorageAdapter} */
export const s3Provider = {
  id: "s3",

  async put(cfg, { key, body, contentType }) {
    await s3Fetch(cfg, { method: "PUT", key, body, contentType });

    const base = cfg.publicBaseUrl?.replace(/\/$/, "");
    if (base) return { key, url: `${base}/${encodeKey(key)}` };

    const { protocol, host, path } = endpointFor(cfg, key);
    return { key, url: `${protocol}//${host}${path}` };
  },

  async remove(cfg, key) {
    await s3Fetch(cfg, { method: "DELETE", key });
  },

  /** The file's bytes. */
  async get(cfg, key) {
    const res = await s3Fetch(cfg, { method: "GET", key });
    return Buffer.from(await res.arrayBuffer());
  },

  /** `{ size, modifiedAt }`, or null when there is no such file. */
  async head(cfg, key) {
    const res = await s3Fetch(cfg, { method: "HEAD", key });
    if (res.status === 404) return null;
    const modified = res.headers.get("last-modified");
    return { size: Number(res.headers.get("content-length") ?? 0), modifiedAt: modified ? new Date(modified) : null };
  },

  /** Every object in the bucket (or under `prefix`), one `{ key, size, modifiedAt }` at a time — 1000 per request. */
  async *list(cfg, { prefix = "" } = {}) {
    let token;
    do {
      const query = { "list-type": 2, "max-keys": 1000, ...(prefix ? { prefix } : {}), ...(token ? { "continuation-token": token } : {}) };
      const res = await s3Fetch(cfg, { method: "GET", key: "", query });
      const xml = await res.text();
      for (const block of xml.match(/<Contents>[\s\S]*?<\/Contents>/g) ?? []) {
        const key = unxml(block.match(/<Key>([\s\S]*?)<\/Key>/)?.[1] ?? "");
        if (!key || key.endsWith("/")) continue; // a "folder" marker, not a file
        yield { key, size: Number(block.match(/<Size>(\d+)<\/Size>/)?.[1] ?? 0), modifiedAt: new Date(block.match(/<LastModified>([^<]+)<\/LastModified>/)?.[1] ?? 0) };
      }
      token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? unxml(xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/)?.[1] ?? "") || undefined : undefined;
    } while (token);
  },

  /** The address a stored file is opened from (what is kept in the database for it). */
  urlFor(cfg, key) {
    const base = cfg.publicBaseUrl?.replace(/\/$/, "");
    if (base) return `${base}/${encodeKey(key)}`;
    const { protocol, host, path } = endpointFor(cfg, key);
    return `${protocol}//${host}${path}`;
  },
};

const unxml = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
