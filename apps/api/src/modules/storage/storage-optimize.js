import { randomUUID } from "node:crypto";
import { BrandModel, OutletModel, StorageMigrationModel, StorageOptimizeModel, StorageSettledModel } from "@rasoipulse/db";
import { publicApiUrl } from "../../env.js";
import { logger } from "../../logger.js";
import { HttpError } from "../../middleware/error.js";
import { expireEverything } from "../cache/cache.js";
import { providerFor } from "./providers/index.js";
import { processImage } from "./image.js";
import { applyChangesIfUnchanged, planKeyReplacements, referencedKeys } from "./storage-links.js";
import { oldForms } from "./storage-migrate.js";
import { activeConfig, describeStorage, listAll, partsOfKey, storageLocations } from "./storage-ops.js";

/**
 * Optimizing pictures that were stored without being compressed (or before the compression limits were tightened).
 *
 * A picture needs it when it is bigger than the platform's size limit (Storage → Image compression → "Target max size").
 * Scanning only looks. Optimizing does, for each chosen picture:
 *   1. reads it and runs it through the SAME compressor every new upload goes through (the saved size / quality / format);
 *   2. if the result is meaningfully smaller, saves it as a NEW file next to the old one (a new name, so browsers and CDNs
 *      never show the old, big one from their cache) and checks it;
 *   3. points every stored address / key of the old file at the new one (menu pictures, logos, banners, pages…) — only where
 *      the stored value is still the one that was planned, so a store owner's edit made meanwhile is never overwritten —
 *      and drops the API's cache;
 *   4. unless told to keep them, deletes the old big file once nothing refers to it any more.
 * A picture that can't get meaningfully smaller is left alone and remembered, so it isn't offered again and again.
 */

/** formats the compressor produces and can read back (not GIF/SVG — those aren't re-encoded by uploads either) */
const OPTIMIZABLE = new Set(["jpg", "jpeg", "png", "webp", "avif"]);
/** chat attachments are kept exactly as they were sent, by design */
const NOT_PICTURES = new Set(["whatsapp", "files"]);
/** how many pictures one scan lists (the biggest first) — run it again for the rest */
const MAX_LISTED = 3000;
/** at most two at once: the compressor has three slots for the whole server and store owners' uploads need one */
const PARALLEL = 2;
const MAX_FAILURES_KEPT = 100;
/** a result must be at least this much smaller than the original to be worth replacing it */
const WORTH_IT = 0.95;

const fingerprintOf = (p) => [p.format, p.maxDimension, p.quality, p.targetMaxKB].join("|");
const extOf = (key) => String(key).split(".").pop().toLowerCase();
const publicUrlOf = (cfg, key) => {
  const url = providerFor(cfg.provider).urlFor(cfg, key);
  return url.startsWith("/") ? `${publicApiUrl}${url}` : url;
};
const settingsOf = (p) => ({ maxDimension: p.maxDimension, quality: p.quality, format: p.format, targetMaxKB: p.targetMaxKB });

/* ---------------------------------------------------------------------- scan */

let lastScan = null;

/** What the console is shown of a scan (the lookup table stays here). */
const scanView = (s) => s && { ...s, byKey: undefined };

export const lastOptimizeScan = () => scanView(lastScan);

/**
 * Find the pictures the stores use that are bigger than the size limit. Reads the file lists and the database, never the
 * pictures themselves, and changes nothing.
 */
export async function scanForOptimizing() {
  const started = Date.now();
  const { active, locations } = await storageLocations();
  const processing = settingsOf(active.processing);
  const limitBytes = processing.targetMaxKB * 1024;
  const out = {
    scannedAt: new Date().toISOString(),
    tookMs: 0,
    storage: describeStorage(active),
    processing,
    limitBytes,
    noLimit: !limitBytes,
    partial: false,
    checked: { files: 0, bytes: 0 },
    over: { files: 0, bytes: 0 },
    atLeastFrees: 0,
    settled: 0,
    pictures: [],
    more: 0,
    byKey: new Map(),
  };
  if (!limitBytes) {
    out.tookMs = Date.now() - started;
    lastScan = out;
    return scanView(out);
  }

  const listed = [];
  for (const loc of locations) listed.push({ ...loc, ...(await listAll(loc.cfg)) });
  out.partial = listed.some((l) => l.partial);

  // a picture is served from the cloud storage when it is there (a move rewrites the addresses to it), otherwise from the disk
  const home = new Map();
  for (const loc of listed.filter((l) => l.id === "local")) for (const key of loc.files.keys()) home.set(key, loc);
  for (const loc of listed.filter((l) => l.id === "cloud")) for (const key of loc.files.keys()) home.set(key, loc);

  const [referenced, settledDocs, brands, outlets] = await Promise.all([
    referencedKeys(),
    StorageSettledModel.find({ fingerprint: fingerprintOf(processing) }).lean(),
    BrandModel.find({}).select("name").lean(),
    OutletModel.find({}, null, { allowGlobalQuery: true }).select("name").lean(),
  ]);
  const settled = new Map(settledDocs.map((s) => [s.key, s.size]));
  const brandName = new Map(brands.map((b) => [String(b._id), b.name]));
  const outletName = new Map(outlets.map((o) => [String(o._id), o.name]));

  const candidates = [];
  for (const [key, loc] of home) {
    const parts = partsOfKey(key);
    if (!parts || NOT_PICTURES.has(parts.kind) || !OPTIMIZABLE.has(extOf(key)) || !referenced.has(key)) continue;
    const f = loc.files.get(key);
    out.checked.files += 1;
    out.checked.bytes += f.size;
    if (f.size <= limitBytes) continue;
    if (settled.get(key) === f.size) {
      out.settled += 1;
      continue;
    }
    candidates.push({
      key,
      size: f.size,
      kind: parts.kind,
      brandId: parts.brandId,
      brandName: parts.brandId === "platform" ? "Marketing website & platform" : (brandName.get(parts.brandId) ?? "A store"),
      outletId: parts.outletId,
      outletName: parts.outletId === "store" || parts.outletId === "website" ? "Store-wide" : (outletName.get(parts.outletId) ?? "An outlet"),
      where: loc.id,
      url: publicUrlOf(loc.cfg, key),
      modifiedAt: f.modifiedAt ?? null,
    });
  }
  candidates.sort((a, b) => b.size - a.size || a.key.localeCompare(b.key));

  out.over = { files: candidates.length, bytes: candidates.reduce((n, c) => n + c.size, 0) };
  out.atLeastFrees = candidates.reduce((n, c) => n + (c.size - limitBytes), 0); // each one ends up at or under the limit
  out.pictures = candidates.slice(0, MAX_LISTED);
  out.more = Math.max(0, candidates.length - out.pictures.length);
  out.byKey = new Map(out.pictures.map((c) => [c.key, c]));
  out.tookMs = Date.now() - started;
  lastScan = out;
  return scanView(out);
}

/* ------------------------------------------------------------------- the job */

const view = (j) =>
  j && {
    id: String(j._id),
    status: j.status,
    stage: j.stage,
    options: j.options ?? {},
    processing: j.processing ?? {},
    plan: j.plan ?? {},
    progress: j.progress ?? {},
    failures: j.failures ?? [],
    error: j.error ?? "",
    cancelRequested: Boolean(j.cancelRequested),
    startedAt: j.createdAt,
    updatedAt: j.updatedAt,
    finishedAt: j.finishedAt ?? null,
  };

export async function optimizeStatus() {
  await markInterruptedOptimizations();
  const [latest, recent] = await Promise.all([StorageOptimizeModel.findOne({}).sort({ createdAt: -1 }).lean(), StorageOptimizeModel.find({}).sort({ createdAt: -1 }).limit(6).lean()]);
  return { current: view(latest), history: recent.slice(1).map(view) };
}

/** A restart of the API ends a running job; one silent for a minute (it writes at least every 15 seconds) is dead. */
export async function markInterruptedOptimizations() {
  const r = await StorageOptimizeModel.updateMany(
    { status: "running", updatedAt: { $lt: new Date(Date.now() - 60_000) } },
    { $set: { status: "interrupted", error: "The server restarted while this was running. Scan again — pictures that were already optimized are no longer on the list.", finishedAt: new Date() } },
  );
  return r.modifiedCount;
}

export async function cancelOptimize(id) {
  const r = await StorageOptimizeModel.updateOne({ _id: id, status: "running" }, { $set: { cancelRequested: true } });
  if (!r.matchedCount) throw new HttpError(404, "That isn't running.");
  return optimizeStatus();
}

/**
 * Start optimizing the chosen pictures of the last scan: `keys` (some of them) or `all` (every listed one, optionally of one
 * store — `brandId`). Only pictures the scan found can be chosen; nothing else can be named from outside.
 */
export async function startOptimize(input, userId) {
  await markInterruptedOptimizations();
  if (await StorageOptimizeModel.exists({ status: "running" })) throw new HttpError(409, "Pictures are already being optimized — wait for that to finish, or cancel it.");
  if (await StorageMigrationModel.exists({ status: "running" })) throw new HttpError(409, "Files are being moved right now — wait for that to finish before optimizing.");
  if (!lastScan || lastScan.noLimit) throw new HttpError(409, "Scan first — the pictures to optimize come from a scan.");

  let chosen;
  if (input.all) chosen = lastScan.pictures.filter((p) => !input.brandId || p.brandId === input.brandId);
  else chosen = [...new Set(input.keys ?? [])].map((k) => lastScan.byKey.get(k)).filter(Boolean);
  if (!chosen.length) throw new HttpError(400, "Choose at least one picture from the list (scan again if the list is old).");

  const processing = settingsOf((await activeConfig()).processing);
  const options = { deleteOriginals: input.options?.deleteOriginals !== false };
  const job = await StorageOptimizeModel.create({
    status: "running",
    stage: "reading",
    options,
    processing,
    plan: { files: chosen.length, bytes: chosen.reduce((n, c) => n + c.size, 0) },
    progress: { done: 0, optimized: 0, unchanged: 0, skipped: 0, failed: 0, bytesBefore: 0, bytesAfter: 0, linksUpdated: 0, deleted: 0, kept: 0 },
    startedBy: userId,
  });
  void runOptimize(String(job._id), chosen, processing, options).catch((err) => logger.error({ err }, "storage optimize crashed"));
  return view(job.toObject());
}

async function runOptimize(id, chosen, processing, options) {
  const progress = { done: 0, optimized: 0, unchanged: 0, skipped: 0, failed: 0, bytesBefore: 0, bytesAfter: 0, linksUpdated: 0, deleted: 0, kept: 0 };
  const failures = [];
  let lastSave = 0;
  const save = async (extra = {}, force = false) => {
    if (!force && Date.now() - lastSave < 700) return;
    lastSave = Date.now();
    const doc = await StorageOptimizeModel.findByIdAndUpdate(id, { $set: { progress: { ...progress }, failures, ...extra } }, { new: true }).select("cancelRequested").lean();
    return doc?.cancelRequested;
  };
  let cancelled = false;
  const beat = setInterval(() => void StorageOptimizeModel.updateOne({ _id: id }, { $set: { "progress.beat": Date.now() } }).catch(() => undefined), 15_000);
  beat.unref();

  try {
    const { locations } = await storageLocations();
    const cfgOf = Object.fromEntries(locations.map((l) => [l.id, l.cfg]));
    const fingerprint = fingerprintOf(processing);
    /** old key → the new file that replaces it */
    const replacements = new Map();

    // -- compress each picture into a new file
    let next = 0;
    const worker = async () => {
      while (next < chosen.length && !cancelled) {
        const item = chosen[next++];
        const cfg = cfgOf[item.where];
        let lastError = "";
        let finished = false;
        if (!cfg) lastError = "that storage isn't available any more";
        for (let attempt = 1; cfg && attempt <= 2 && !finished; attempt++) {
          let newKey = "";
          try {
            const adapter = providerFor(cfg.provider);
            const body = await adapter.get(cfg, item.key);
            const made = await processImage(body, processing);
            if (made.bytes > body.length * WORTH_IT) {
              // it can't get meaningfully smaller with these settings: leave it, and don't offer it again
              await StorageSettledModel.updateOne({ key: item.key }, { $set: { size: body.length, fingerprint } }, { upsert: true });
              progress.unchanged += 1;
              finished = true;
              break;
            }
            const parts = partsOfKey(item.key);
            newKey = `${parts.brandId}/${parts.outletId}/${parts.kind}/${randomUUID()}.${made.ext}`;
            await adapter.put(cfg, { key: newKey, body: made.buffer, contentType: made.contentType });
            const there = await adapter.head(cfg, newKey);
            if (!there || there.size !== made.bytes) throw new Error(`the new file has ${there?.size ?? 0} bytes, expected ${made.bytes}`);
            replacements.set(item.key, { key: newKey, url: adapter.urlFor(cfg, newKey), forms: oldForms(cfg), width: made.width, height: made.height, where: item.where, oldSize: body.length, newSize: made.bytes });
            finished = true;
          } catch (err) {
            lastError = (err instanceof Error ? err.message : String(err)).replace(/ Try JPEG.*$/, ""); // (that hint is for someone uploading)
            if (newKey) await providerFor(cfg.provider).remove(cfg, newKey).catch(() => undefined);
            if (err instanceof HttpError) break; // not an image we can read — trying again won't change that
            await new Promise((r) => setTimeout(r, 400 * attempt));
          }
        }
        if (!finished) {
          progress.failed += 1;
          if (failures.length < MAX_FAILURES_KEPT) failures.push({ key: item.key, error: lastError });
        }
        progress.done += 1;
        if (await save()) cancelled = true;
      }
    };
    await Promise.all(Array.from({ length: PARALLEL }, worker));

    // -- the addresses in the database (also for what was finished before a cancel: those new files are real and should be used)
    if (replacements.size) {
      await save({ stage: "links" }, true);
      const { changes } = await planKeyReplacements({ replacements });
      const r = await applyChangesIfUnchanged(changes);
      progress.linksUpdated = r.changed;
      await expireEverything(); // the API remembers pictures' addresses for a while — forget them now

      // -- what really took, and the old files nothing refers to any more
      await save({ stage: "cleanup" }, true);
      const refs = await referencedKeys();
      for (const [oldKey, rep] of replacements) {
        const cfg = cfgOf[rep.where];
        const adapter = providerFor(cfg.provider);
        if (refs.has(rep.key)) {
          progress.optimized += 1;
          progress.bytesBefore += rep.oldSize;
          progress.bytesAfter += rep.newSize;
          if (options.deleteOriginals) {
            if (refs.has(oldKey)) progress.kept += 1; // something still shows it — keep it
            else {
              try {
                await adapter.remove(cfg, oldKey);
                progress.deleted += 1;
              } catch (err) {
                if (failures.length < MAX_FAILURES_KEPT) failures.push({ key: oldKey, error: `couldn't delete the old file: ${err instanceof Error ? err.message : err}` });
              }
            }
          }
        } else {
          // the store changed or removed that picture while this ran — the new file isn't used by anything
          await adapter.remove(cfg, rep.key).catch(() => undefined);
          progress.skipped += 1;
        }
      }
    }
    await save({ status: cancelled ? "cancelled" : progress.failed ? "done_with_errors" : "done", stage: "done", finishedAt: new Date() }, true);
  } catch (err) {
    logger.error({ err }, "storage optimize failed");
    await save({ status: "failed", error: err instanceof Error ? err.message : String(err), finishedAt: new Date() }, true).catch(() => undefined);
  } finally {
    clearInterval(beat);
  }
}
