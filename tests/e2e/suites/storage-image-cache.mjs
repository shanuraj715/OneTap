// Browser caching of pictures. Pictures stored in the cloud (R2 / S3) used to carry NO cache header, so a browser guessed how long to keep
// them and often asked again on every visit. Now (1) a picture uploaded to the cloud is stored with `Cache-Control: public, max-age=31536000,
// immutable` (pictures only — never documents), and (2) pictures stored earlier can be given the header in place (a copy of the object onto
// itself: same bytes, same type, same address). Pure Node against a fake S3 service: no browser, no database.
import { fileURLToPath, pathToFileURL } from "node:url";
import { fakeS3 } from "../bench/fake-s3.mjs";

let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const here = (rel) => pathToFileURL(fileURLToPath(new URL(rel, import.meta.url))).href;

// the API's modules read their settings from the environment when loaded
Object.assign(process.env, {
  NODE_ENV: "test", MONGODB_URI: process.env.MONGODB_URI || "mongodb://127.0.0.1:1/none",
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || "a".repeat(48), JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "b".repeat(48), ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || "c".repeat(48),
});
const { s3Provider, IMAGE_CACHE_CONTROL, cacheControlFor } = await import(here("../../../apps/api/src/modules/storage/providers/s3.js"));
const { refreshImageCacheHeaders } = await import(here("../../../apps/api/src/modules/storage/storage-cache.js"));

const bucket = await fakeS3({ pageSize: 4 });
const cfg = { provider: "s3", endpoint: bucket.endpoint, bucket: bucket.bucket, region: "auto", accessKeyId: "AKTEST", secretAccessKey: "secret" };
const LONG = "public, max-age=31536000, immutable";
const bytes = (n) => Buffer.from(`picture-bytes-${n}`);

try {
  console.log("== New uploads");
  ok(IMAGE_CACHE_CONTROL === LONG, "the cache header for a picture is one year, public, immutable", IMAGE_CACHE_CONTROL);
  ok(cacheControlFor("image/webp") === LONG && cacheControlFor("image/png") === LONG && cacheControlFor("IMAGE/JPEG") === LONG, "any picture type gets it");
  ok(cacheControlFor("application/pdf") === undefined && cacheControlFor("audio/ogg") === undefined && cacheControlFor("") === undefined && cacheControlFor(undefined) === undefined, "documents, audio and unknown types do not");
  await s3Provider.put(cfg, { key: "b/o/menu-items/new.webp", body: bytes(1), contentType: "image/webp" });
  await s3Provider.put(cfg, { key: "b/o/files/bill.pdf", body: bytes(2), contentType: "application/pdf" });
  await s3Provider.put(cfg, { key: "b/o/menu-items/short.png", body: bytes(3), contentType: "image/png", cacheControl: "public, max-age=60" });
  ok(bucket.store.get("b/o/menu-items/new.webp").cacheControl === LONG, "a picture is stored with the long cache header", bucket.store.get("b/o/menu-items/new.webp").cacheControl);
  ok(!bucket.store.get("b/o/files/bill.pdf").cacheControl, "a PDF is stored with no cache header");
  ok(bucket.store.get("b/o/menu-items/short.png").cacheControl === "public, max-age=60", "a caller can still choose its own cache header");
  const signedPut = bucket.seen.signed[0];
  ok(signedPut.signedHeaders.includes("cache-control") && signedPut.signedHeaders.includes("content-type"), "the cache header is part of the signed request (not just added on the side)", signedPut.signedHeaders.join(";"));
  const head = await s3Provider.head(cfg, "b/o/menu-items/new.webp");
  ok(head.cacheControl === LONG && head.contentType === "image/webp" && head.size === bytes(1).length, "reading a picture back tells its type and cache header", JSON.stringify(head));

  console.log("== Pictures stored before this (no header)");
  const legacy = { "b/o/logos/a.webp": "image/webp", "b/o/logos/b.jpg": "image/jpeg", "b/o/banners/c.png": "image/png", "b/o/menu-items/d.jpeg": "image/jpeg", "b/o/menu-items/e.avif": "image/avif" };
  let n = 10;
  for (const [key, type] of Object.entries(legacy)) bucket.store.set(key, { body: bytes(n++), type, cacheControl: "", modified: new Date("2026-11-01") });
  bucket.store.set("b/o/menu-items/f.webp", { body: bytes(n++), type: "image/webp", cacheControl: "public, max-age=3600", modified: new Date("2026-11-01") }); // a short cache time
  bucket.store.set("b/o/menu-items/g.webp", { body: bytes(n++), type: "image/webp", cacheControl: LONG, modified: new Date("2026-11-01") }); // already fine
  bucket.store.set("b/o/files/h.pdf", { body: bytes(n++), type: "application/pdf", cacheControl: "", modified: new Date("2026-11-01") });
  const before = new Map([...bucket.store].map(([k, v]) => [k, { body: Buffer.from(v.body), type: v.type, cc: v.cacheControl }]));
  const needing = Object.keys(legacy).length + 2; // the five without a header + the two with a SHORT one (f.webp, and short.png from the first section)

  const dry = await refreshImageCacheHeaders({ cfg, apply: false });
  ok(dry.wouldUpdate === needing && dry.updated === 0, `a dry run counts what needs it (${needing}) and changes nothing`, JSON.stringify({ wouldUpdate: dry.wouldUpdate, updated: dry.updated }));
  ok(bucket.seen.copies === 0 && [...bucket.store].every(([k, v]) => v.cacheControl === before.get(k).cc), "…really nothing: no copy was made and no header changed");
  ok(dry.already === 2 && dry.notPictures === 2, "pictures that already have a long cache time (new.webp, g.webp) are counted as fine; the two PDFs are not pictures", `already ${dry.already}, not pictures ${dry.notPictures}`);

  console.log("== Trying one first");
  const one = await refreshImageCacheHeaders({ cfg, apply: true, limit: 1 });
  ok(one.updated === 1 && bucket.seen.copies === 1, "--limit 1 changes exactly one picture", JSON.stringify({ updated: one.updated, copies: bucket.seen.copies }));
  const changedKey = [...bucket.store].find(([k, v]) => before.get(k) && v.cacheControl === LONG && before.get(k).cc !== LONG)?.[0];
  ok(Boolean(changedKey) && Buffer.compare(bucket.store.get(changedKey).body, before.get(changedKey).body) === 0 && bucket.store.get(changedKey).type === before.get(changedKey).type, "…and its bytes and type are exactly as they were", changedKey);
  const copySigned = bucket.seen.signed.find((x) => x.signedHeaders.includes("x-amz-copy-source"));
  ok(copySigned && copySigned.signedHeaders.includes("x-amz-metadata-directive") && copySigned.signedHeaders.includes("cache-control"), "the copy request signs its copy-source, directive and cache header", copySigned?.signedHeaders.join(";"));

  console.log("== All of them");
  const all = await refreshImageCacheHeaders({ cfg, apply: true });
  ok(all.updated === needing - 1 && all.failed.length === 0, "the rest are updated, none fail", JSON.stringify({ updated: all.updated, failed: all.failed.length }));
  const afterAll = [...bucket.store];
  ok(afterAll.filter(([k]) => /\.(webp|jpg|jpeg|png|avif)$/.test(k)).every(([, v]) => v.cacheControl === LONG), "every picture now has the long cache header");
  ok(afterAll.every(([k, v]) => !before.has(k) || (Buffer.compare(v.body, before.get(k).body) === 0 && v.type === before.get(k).type)), "no picture's bytes or type changed");
  ok(!bucket.store.get("b/o/files/h.pdf").cacheControl, "the PDF was left alone");
  ok(bucket.seen.copies === needing, "pictures that were already fine were not copied again", `${bucket.seen.copies} copies for ${needing} pictures`);

  console.log("== Running it twice");
  const again = await refreshImageCacheHeaders({ cfg, apply: true });
  ok(again.updated === 0 && again.wouldUpdate === 0 && again.failed.length === 0 && bucket.seen.copies === needing, "a second run finds nothing to do and copies nothing");

  console.log("== A copy that fails");
  bucket.store.set("b/o/logos/broken.webp", { body: bytes(99), type: "image/webp", cacheControl: "", modified: new Date("2026-11-01") });
  bucket.store.set("b/o/logos/fine.webp", { body: bytes(98), type: "image/webp", cacheControl: "", modified: new Date("2026-11-01") });
  bucket.copyFail.add("b/o/logos/broken.webp");
  const bad = await refreshImageCacheHeaders({ cfg, apply: true });
  ok(bad.failed.length === 1 && bad.failed[0].key === "b/o/logos/broken.webp" && /copy failed/.test(bad.failed[0].error), "a copy that S3 answers with 200 but an error inside is reported as a failure", JSON.stringify(bad.failed));
  ok(bad.updated === 1 && bucket.store.get("b/o/logos/fine.webp").cacheControl === LONG && !bucket.store.get("b/o/logos/broken.webp").cacheControl, "…the others still get theirs, and the broken one is left as it was");

  console.log("== Pictures on this server's own disk");
  const local = await refreshImageCacheHeaders({ cfg: { provider: "local" }, apply: true });
  ok(Boolean(local.skipped) && local.updated === 0, "nothing to do: the API already serves its own uploads with a one-year cache header", local.skipped);
} finally {
  await bucket.close();
}
console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
