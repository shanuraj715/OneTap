import { STORAGE_FIELDS, STORAGE_REQUIRED_FIELDS } from "@onetap/config-schema";
import { BrandModel, StorageMigrationModel } from "@onetap/db";
import { decryptSecret, encryptSecret } from "../../lib/crypto.js";
import { logger } from "../../logger.js";
import { HttpError } from "../../middleware/error.js";
import { expireEverything } from "../cache/cache.js";
import { providerFor } from "./providers/index.js";
import { applyLinkChanges, planLinkChanges } from "./storage-links.js";
import { activeConfig, configFromInput, describeStorage, listAll, storageIdentity, storageLocations } from "./storage-ops.js";
import { saveStorageConfig } from "./storage.service.js";

/**
 * Moving every file from one storage to another — this server's disk, the storage in use, or any other S3-compatible
 * bucket (Cloudflare R2, Amazon S3, DigitalOcean Spaces, Backblaze B2, MinIO).
 *
 * What a move does, in order:
 *   1. lists both places and works out what is missing at the destination (so running it again only moves what is left);
 *   2. copies each missing file and checks the copy (same size) — nothing is deleted at this point;
 *   3. rewrites the addresses stored in the database (menu pictures, logos, banners, pages, chat attachments…) from the
 *      old place to the new one, for every file that is now at the destination, and drops the API's cache;
 *   4. only if asked: deletes the old copies of the files that were verified at the destination.
 * A file that can't be copied is listed and left exactly where it was, with its old address still working.
 */

const FIELDS = STORAGE_FIELDS.s3;
const COPY_PARALLEL = 4;
const MAX_FAILURES_KEPT = 100;

const TYPES = {
  webp: "image/webp", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", avif: "image/avif", heic: "image/heic", heif: "image/heif",
  svg: "image/svg+xml", tif: "image/tiff", tiff: "image/tiff", bmp: "image/bmp", mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
  mp3: "audio/mpeg", ogg: "audio/ogg", opus: "audio/ogg", m4a: "audio/mp4", pdf: "application/pdf", txt: "text/plain", json: "application/json",
};
const contentTypeOf = (key) => TYPES[String(key).split(".").pop().toLowerCase()] ?? "application/octet-stream";

/* ---------------------------------------------------------------- the two ends */

const localCfg = async () => (await storageLocations()).locations.find((l) => l.id === "local").cfg;

/** What is kept of an end in the job record: its details, with the secret encrypted. */
function keep(cfg, type) {
  if (cfg.provider === "local") return { type: "local", provider: "local", label: describeStorage(cfg), publicFields: {}, encryptedFields: {} };
  const publicFields = {};
  const encryptedFields = {};
  for (const f of FIELDS) {
    if (!cfg[f.key]) continue;
    if (f.secret) encryptedFields[f.key] = encryptSecret(cfg[f.key]);
    else publicFields[f.key] = cfg[f.key];
  }
  return { type, provider: "s3", label: describeStorage(cfg), publicFields, encryptedFields };
}

/** An end of a job as a working config again (secrets decrypted — only inside the API). */
async function working(end) {
  if (end.provider === "local") return localCfg();
  const cfg = { provider: "s3", brandId: "platform", outletId: "probe", ...end.publicFields };
  for (const [k, envelope] of Object.entries(end.encryptedFields ?? {})) cfg[k] = decryptSecret(envelope);
  return cfg;
}

/** Turn what the console sent ({ type: "local" | "active" | "s3", values? }) into an end. */
async function resolveEnd(desc, which) {
  if (desc?.type === "local") return keep(await localCfg(), "local");
  if (desc?.type === "active") {
    const cfg = await activeConfig();
    if (cfg.provider === "local") return keep(await localCfg(), "local");
    const missing = STORAGE_REQUIRED_FIELDS.s3.filter((k) => !cfg[k]);
    if (missing.length) throw new HttpError(400, "The storage in use isn't fully set up — finish its settings first.");
    return keep(cfg, "active");
  }
  if (desc?.type === "s3") {
    const { cfg, missing } = await configFromInput({ provider: "s3", values: desc.values ?? {} });
    if (missing.length) throw new HttpError(400, `${which === "source" ? "Where the files are now" : "The destination"}: fill in ${missing.join(", ")} first.`);
    return keep(cfg, "s3");
  }
  throw new HttpError(400, `Choose ${which === "source" ? "where the files are now" : "where to move them"}.`);
}

/** The web-address prefixes a storage's files are known by (so old stored addresses can be recognised). */
function oldForms(cfg) {
  if (cfg.provider === "local") return { local: true, bases: cfg.publicBaseUrl ? [cfg.publicBaseUrl.replace(/\/$/, "")] : [] };
  const adapter = providerFor("s3");
  const cut = (url) => url.slice(0, -"/x".length);
  const bases = [cut(adapter.urlFor({ ...cfg, publicBaseUrl: undefined }, "x"))];
  if (cfg.publicBaseUrl) bases.unshift(cut(adapter.urlFor(cfg, "x")));
  return { local: false, bases };
}

/* ------------------------------------------------------------------- planning */

/** What a move would do — counts only, nothing changes. */
async function planOf(source, target, scope) {
  const srcCfg = await working(source);
  const tgtCfg = await working(target);
  if (storageIdentity(srcCfg) === storageIdentity(tgtCfg)) throw new HttpError(400, "That is the same storage — choose a different destination.");
  const prefix = scope?.brandId ? `${scope.brandId}/` : "";
  const [src, tgt] = await Promise.all([listAll(srcCfg, { prefix }), listAll(tgtCfg, { prefix })]);
  if (src.partial || tgt.partial) throw new HttpError(400, "There are too many files to move in one go — move one store at a time (choose a store).");
  const toCopy = [...src.files].filter(([key, f]) => tgt.files.get(key)?.size !== f.size).map(([key, f]) => ({ key, size: f.size }));
  const plan = {
    files: src.files.size,
    bytes: [...src.files.values()].reduce((n, f) => n + f.size, 0),
    toCopy: toCopy.length,
    toCopyBytes: toCopy.reduce((n, f) => n + f.size, 0),
    alreadyThere: src.files.size - toCopy.length,
  };
  return { srcCfg, tgtCfg, src, tgt, toCopy, plan, prefix };
}

async function scopeOf(input) {
  const brandId = input?.scope?.brandId ? String(input.scope.brandId) : "";
  if (!brandId) return {};
  const brand = brandId === "platform" ? { name: "Marketing website & platform" } : await BrandModel.findById(brandId).select("name").lean();
  if (!brand) throw new HttpError(404, "Store not found");
  return { brandId, brandName: brand.name };
}

/** Say what moving would do, without doing it: how many files and bytes, and how many stored addresses would change. */
export async function previewMove(input) {
  const [source, target, scope] = [await resolveEnd(input.source, "source"), await resolveEnd(input.target, "target"), await scopeOf(input)];
  const { srcCfg, tgtCfg, src, tgt, plan } = await planOf(source, target, scope);
  const available = new Set([...src.files.keys(), ...tgt.files.keys()]);
  const { changes } = await planLinkChanges({ old: oldForms(srcCfg), available, newUrlFor: (key) => providerFor(tgtCfg.provider).urlFor(tgtCfg, key), onlyBrandId: scope.brandId });
  return { source: { label: source.label }, target: { label: target.label }, scope, plan, linksToUpdate: changes.length };
}

/* ------------------------------------------------------------------- the job */

const view = (j) =>
  j && {
    id: String(j._id),
    status: j.status,
    stage: j.stage,
    source: { type: j.source?.type, label: j.source?.label },
    target: { type: j.target?.type, label: j.target?.label },
    scope: j.scope ?? {},
    options: j.options ?? {},
    plan: j.plan ?? {},
    progress: j.progress ?? {},
    failures: j.failures ?? [],
    error: j.error ?? "",
    cancelRequested: Boolean(j.cancelRequested),
    startedAt: j.createdAt,
    updatedAt: j.updatedAt,
    finishedAt: j.finishedAt ?? null,
  };

export async function migrationStatus() {
  await markInterruptedMoves();
  const [latest, recent] = await Promise.all([StorageMigrationModel.findOne({}).sort({ createdAt: -1 }).lean(), StorageMigrationModel.find({}).sort({ createdAt: -1 }).limit(6).lean()]);
  return { current: view(latest), history: recent.slice(1).map(view) };
}

/**
 * A restart of the API stops any move in progress. A running move writes to its record at least every 15 seconds, so one that
 * has been silent for a minute is dead — it is marked so it can simply be started again (what was copied is skipped).
 */
export async function markInterruptedMoves() {
  const r = await StorageMigrationModel.updateMany(
    { status: "running", updatedAt: { $lt: new Date(Date.now() - 60_000) } },
    { $set: { status: "interrupted", error: "The server restarted while this was running. Start it again — what was already copied is skipped.", finishedAt: new Date() } },
  );
  return r.modifiedCount;
}

export async function cancelMove(id) {
  const r = await StorageMigrationModel.updateOne({ _id: id, status: "running" }, { $set: { cancelRequested: true } });
  if (!r.matchedCount) throw new HttpError(404, "That move isn't running.");
  return migrationStatus();
}

export async function startMove(input, userId) {
  await markInterruptedMoves();
  if (await StorageMigrationModel.exists({ status: "running" })) throw new HttpError(409, "A move is already running — wait for it to finish, or cancel it.");
  const [source, target, scope] = [await resolveEnd(input.source, "source"), await resolveEnd(input.target, "target"), await scopeOf(input)];
  if (storageIdentity(await working(source)) === storageIdentity(await working(target))) throw new HttpError(400, "That is the same storage — choose a different destination.");
  const options = { deleteSource: Boolean(input.options?.deleteSource), activate: Boolean(input.options?.activate) && target.type === "s3" };
  const job = await StorageMigrationModel.create({ status: "running", stage: "listing", source, target, scope, options, startedBy: userId, progress: { done: 0, copied: 0, skipped: 0, failed: 0, bytesCopied: 0, linksUpdated: 0, deleted: 0 } });
  void runMove(String(job._id)).catch((err) => logger.error({ err }, "storage move crashed"));
  return view(job.toObject());
}

async function runMove(id) {
  const job = await StorageMigrationModel.findById(id).lean();
  const progress = { done: 0, copied: 0, skipped: 0, failed: 0, bytesCopied: 0, linksUpdated: 0, deleted: 0 };
  const failures = [];
  let lastSave = 0;
  const save = async (extra = {}, force = false) => {
    if (!force && Date.now() - lastSave < 700) return;
    lastSave = Date.now();
    const doc = await StorageMigrationModel.findByIdAndUpdate(id, { $set: { progress: { ...progress }, failures, ...extra } }, { new: true }).select("cancelRequested").lean();
    return doc?.cancelRequested;
  };
  let cancelled = false;
  // proof of life: a move whose process died goes quiet, and can then be recognised (see markInterruptedMoves)
  const beat = setInterval(() => void StorageMigrationModel.updateOne({ _id: id }, { $set: { "progress.beat": Date.now() } }).catch(() => undefined), 15_000);
  beat.unref();

  try {
    const { srcCfg, tgtCfg, src, tgt, toCopy, plan } = await planOf(job.source, job.target, job.scope);
    const srcAdapter = providerFor(srcCfg.provider);
    const tgtAdapter = providerFor(tgtCfg.provider);
    await save({ plan, stage: "copying" }, true);

    // new uploads go to the destination from now on (the old places keep serving what is already there)
    if (job.options?.activate) {
      const values = Object.fromEntries(FIELDS.filter((f) => tgtCfg[f.key] !== undefined).map((f) => [f.key, tgtCfg[f.key]]));
      await saveStorageConfig({ provider: "s3", values }, job.startedBy);
    }

    // -- copy
    const copySet = new Set(toCopy.map((f) => f.key));
    const present = new Set([...tgt.files.keys()]); // everything that is at the destination now (and so can be linked to)
    progress.skipped = [...src.files.keys()].filter((k) => !copySet.has(k)).length; // already there, same size
    progress.done = progress.skipped;
    let next = 0;
    const worker = async () => {
      while (next < toCopy.length && !cancelled) {
        const { key, size } = toCopy[next++];
        let lastError = "";
        let ok = false;
        for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
          try {
            const body = await srcAdapter.get(srcCfg, key);
            await tgtAdapter.put(tgtCfg, { key, body, contentType: contentTypeOf(key) });
            const there = await tgtAdapter.head(tgtCfg, key);
            if (!there || there.size !== size) throw new Error(`the copy has ${there?.size ?? 0} bytes, the original ${size}`);
            ok = true;
          } catch (err) {
            lastError = err instanceof Error ? err.message : String(err);
            await new Promise((r) => setTimeout(r, 400 * attempt));
          }
        }
        if (ok) {
          present.add(key);
          progress.copied += 1;
          progress.bytesCopied += size;
        } else {
          progress.failed += 1;
          if (failures.length < MAX_FAILURES_KEPT) failures.push({ key, error: lastError });
        }
        progress.done += 1;
        if (await save()) cancelled = true;
      }
    };
    await Promise.all(Array.from({ length: COPY_PARALLEL }, worker));

    if (cancelled) {
      await save({ status: "cancelled", stage: "done", finishedAt: new Date() }, true);
      return;
    }

    // -- addresses in the database
    await save({ stage: "links" }, true);
    const { changes } = await planLinkChanges({ old: oldForms(srcCfg), available: present, newUrlFor: (key) => tgtAdapter.urlFor(tgtCfg, key), onlyBrandId: job.scope?.brandId });
    progress.linksUpdated = await applyLinkChanges(changes);
    await expireEverything(); // the API remembers pictures' addresses for a while — forget them now

    // -- the old copies (only those verified at the destination)
    if (job.options?.deleteSource) {
      await save({ stage: "cleanup" }, true);
      for (const key of present) {
        if (!src.files.has(key)) continue;
        try {
          await srcAdapter.remove(srcCfg, key);
          progress.deleted += 1;
        } catch (err) {
          if (failures.length < MAX_FAILURES_KEPT) failures.push({ key, error: `couldn't delete the old copy: ${err instanceof Error ? err.message : err}` });
        }
        if (await save()) {
          cancelled = true;
          break;
        }
      }
    }
    await save({ status: cancelled ? "cancelled" : progress.failed ? "done_with_errors" : "done", stage: "done", finishedAt: new Date() }, true);
  } catch (err) {
    logger.error({ err }, "storage move failed");
    await save({ status: "failed", error: err instanceof Error ? err.message : String(err), finishedAt: new Date() }, true).catch(() => undefined);
  } finally {
    clearInterval(beat);
  }
}
