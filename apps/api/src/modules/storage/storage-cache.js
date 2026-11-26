import { logger } from "../../logger.js";
import { providerFor } from "./providers/index.js";
import { activeConfig, listAll } from "./storage-ops.js";

/**
 * Give the pictures that are ALREADY in cloud storage a browser cache header.
 *
 * New pictures get `Cache-Control: public, max-age=31536000, immutable` when they are uploaded (providers/s3.js). The ones stored
 * before that have no cache header at all: the storage service's public address then leaves it to each browser to guess how long
 * to keep them, and many ask again on every visit. This walks the bucket and, for every picture without a long cache time, copies
 * the object onto itself with the header added (same bytes, same type, same address).
 *
 * Safe to run twice (a picture that already has a long cache time is skipped) and to stop half way. `apply: false` only counts.
 * Pictures on this server's own disk are served by the API with the same header already, so there is nothing to do for them.
 */
const IMAGE_TYPES = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif", gif: "image/gif" };
const PARALLEL = 4;
const LONG_ENOUGH = /max-age=\d{6,}/; // a day is 86400 (5 digits): six digits is more than eleven days

export async function refreshImageCacheHeaders({ apply = false, limit = Infinity, onProgress, cfg: given } = {}) {
  const cfg = given ?? (await activeConfig()); // `cfg`: a ready-made storage setting (tests); normally the one the platform has saved
  const adapter = providerFor(cfg.provider);
  const out = { provider: cfg.provider, apply, pictures: 0, notPictures: 0, already: 0, updated: 0, wouldUpdate: 0, failed: [], partial: false, skipped: null };
  if (cfg.provider === "local" || typeof adapter.setCacheControl !== "function") return { ...out, skipped: "The pictures are on this server's disk; the API already serves them with a one-year cache header." };

  const { files, partial } = await listAll(cfg);
  out.partial = partial;
  const keys = [];
  for (const key of files.keys()) {
    const ext = key.split(".").pop()?.toLowerCase() ?? "";
    if (IMAGE_TYPES[ext]) keys.push({ key, ext });
    else out.notPictures += 1;
  }
  out.pictures = keys.length;

  let next = 0;
  let attempts = 0;
  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= keys.length) return;
      const { key, ext } = keys[i];
      try {
        const head = await adapter.head(cfg, key);
        if (!head) continue; // gone since the listing
        if (LONG_ENOUGH.test(head.cacheControl ?? "")) { out.already += 1; continue; }
        if (!apply) { out.wouldUpdate += 1; continue; }
        if (attempts >= limit) continue;
        attempts += 1;
        await adapter.setCacheControl(cfg, key, { contentType: head.contentType || IMAGE_TYPES[ext] });
        out.updated += 1;
      } catch (e) {
        out.failed.push({ key, error: String(e.message ?? e).slice(0, 200) });
        logger.warn({ key, err: String(e.message ?? e) }, "could not set the cache header on a picture");
      }
      onProgress?.({ done: out.updated + out.already + out.wouldUpdate + out.failed.length, of: keys.length });
    }
  };
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  return out;
}
