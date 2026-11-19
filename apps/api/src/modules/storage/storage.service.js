import { randomUUID } from "node:crypto";
import {
  IMAGE_FORMAT_LABELS,
  IMAGE_OUTPUT_FORMATS,
  IMAGE_RULES,
  imageProcessingSchema,
  STORAGE_FIELDS,
  STORAGE_PROVIDERS,
  STORAGE_REQUIRED_FIELDS,
} from "@onetap/config-schema";
import { BrandModel, brandFilter, PlatformStorageModel, StorageConfigModel } from "@onetap/db";
import { env, publicApiUrl } from "../../env.js";
import { decryptSecret, encryptSecret, maskSecret } from "../../lib/crypto.js";
import { logger } from "../../logger.js";
import { HttpError } from "../../middleware/error.js";
import { processImage } from "./image.js";
import { toPublicUrl } from "./upload-urls.js";
import { localUploadsPath, providerFor } from "./providers/index.js";

const UPLOADS_ROOT = localUploadsPath(env.UPLOADS_DIR);

/**
 * Where every store's uploaded images go.
 *
 * There is ONE storage configuration for the whole platform, kept in the platform console (Storage) and out of
 * every store owner's sight. Each store's files still sit under their own `<brandId>/` folder, so one bucket
 * serves everyone.
 *
 * Stores that were set up BEFORE this moved to the platform may still have a document of their own. It keeps
 * working until the platform's own configuration is first saved — nothing breaks while the move happens — and
 * the console can adopt one of them as the platform's (see `adoptStoreStorage`).
 */

/* --------------------------------------------------------------- resolution */

const PLATFORM_KEY = { key: "platform" };

/** Which settings document applies right now, and where it came from. */
async function activeDoc(ctx) {
  const platform = await PlatformStorageModel.findOne(PLATFORM_KEY).lean();
  if (platform) return { doc: platform, source: "platform" };
  // not saved yet: a store set up the old way keeps using its own until then
  const own = ctx?.brandId ? await StorageConfigModel.findOne(brandFilter(ctx)).lean() : null;
  if (own) return { doc: own, source: "store" };
  return { doc: null, source: "default" };
}

/**
 * The full, decrypted config the provider adapters + image pipeline need.
 * Never leaves the API. With nothing configured anywhere it falls back to
 * local disk with the default compression settings.
 */
export async function resolveStorage(ctx) {
  const { doc } = await activeDoc(ctx);
  const provider = doc?.provider ?? "local";

  /** @type {import("./providers/types.js").ResolvedStorage} */
  const cfg = {
    provider,
    brandId: ctx.brandId,
    outletId: ctx.outletId,
    uploadsRoot: UPLOADS_ROOT,
    publicApiUrl,
    processing: imageProcessingSchema.parse(doc?.processing ?? {}),
    ...(doc?.publicFields ?? {}),
  };

  for (const [field, envelope] of Object.entries(doc?.encryptedFields ?? {})) {
    try {
      cfg[field] = decryptSecret(envelope);
    } catch {
      logger.error(`Could not decrypt storage.${field} — was ENCRYPTION_KEY rotated?`);
      throw new HttpError(500, "Stored storage credentials could not be read");
    }
  }
  return cfg;
}

/* ------------------------------------------------------------------ config */

const isSet = (doc, f) => (f.secret ? Boolean(doc?.encryptedFields?.[f.key]) : Boolean(doc?.publicFields?.[f.key]));

/** Does this settings document have everything its provider needs? */
const isComplete = (doc) => {
  const provider = doc?.provider ?? "local";
  if (provider === "local") return true;
  return STORAGE_REQUIRED_FIELDS[provider].every((k) => isSet(doc, STORAGE_FIELDS[provider].find((f) => f.key === k) ?? { key: k }));
};

/** The labels of the required details this settings document still lacks (empty when it is usable). */
const missingLabels = (doc) => {
  const provider = doc?.provider ?? "local";
  return (STORAGE_REQUIRED_FIELDS[provider] ?? [])
    .map((k) => STORAGE_FIELDS[provider].find((f) => f.key === k) ?? { key: k, label: k })
    .filter((f) => !isSet(doc, f))
    .map((f) => f.label);
};

/** What the console sees of a settings document: active provider, fields with secrets masked, compression settings. */
function viewOf(doc) {
  const provider = doc?.provider ?? "local";

  const providers = STORAGE_PROVIDERS.map((id) => {
    const active = doc?.provider === id;
    const fields = STORAGE_FIELDS[id].map((f) => ({
      ...f,
      value: f.secret
        ? active && doc?.encryptedFields?.[f.key]
          ? maskSecret(String(doc.encryptedFields[f.key]).slice(-12))
          : ""
        : active
          ? (doc?.publicFields?.[f.key] ?? "")
          : "",
      isSet: active && isSet(doc, f),
    }));
    return {
      id,
      requiredFields: STORAGE_REQUIRED_FIELDS[id],
      fields,
      configured: id === "local" ? true : STORAGE_REQUIRED_FIELDS[id].every((k) => fields.find((f) => f.key === k)?.isSet),
    };
  });

  return {
    provider,
    updatedAt: doc?.updatedAt ?? null,
    limits: IMAGE_RULES,
    processing: imageProcessingSchema.parse(doc?.processing ?? {}),
    formats: IMAGE_OUTPUT_FORMATS.map((id) => ({ id, label: IMAGE_FORMAT_LABELS[id] })),
    providers,
  };
}

/** Stores that still have settings of their own (set up before storage moved to the platform) — newest first. */
async function storesWithOwnSettings() {
  const docs = await StorageConfigModel.find({}).setOptions({ allowGlobalQuery: true }).sort({ updatedAt: -1 }).lean();
  if (!docs.length) return [];
  const brands = await BrandModel.find({ _id: { $in: docs.map((d) => d.brandId) } }).select("name").lean();
  const names = new Map(brands.map((b) => [String(b._id), b.name]));
  return docs
    .filter((d) => names.has(String(d.brandId))) // a deleted store's leftovers aren't worth showing
    .map((d) => ({
      brandId: String(d.brandId),
      brandName: names.get(String(d.brandId)),
      provider: d.provider ?? "local",
      configured: isComplete(d),
      updatedAt: d.updatedAt ?? null,
    }));
}

/**
 * The platform's storage configuration, as the console shows it.
 * `saved` is false until it has been saved once; until then stores that have settings of their own still use
 * them (`inUse: "store"`), otherwise everything uses local disk (`inUse: "default"`).
 */
export async function getStorageConfig() {
  const doc = await PlatformStorageModel.findOne(PLATFORM_KEY).lean();
  const own = await storesWithOwnSettings();
  return {
    ...viewOf(doc),
    saved: Boolean(doc),
    inUse: doc ? "platform" : own.length ? "store" : "default",
    ownSettings: own,
  };
}

async function loadOrNew() {
  return (await PlatformStorageModel.findOne(PLATFORM_KEY)) ?? new PlatformStorageModel(PLATFORM_KEY);
}

export async function saveStorageConfig({ provider, values = {}, processing }, userId) {
  const doc = await loadOrNew();

  if (provider) {
    if (!STORAGE_PROVIDERS.includes(provider)) throw new HttpError(400, "Unknown storage provider");

    // Switching provider starts its credentials clean (but keeps compression settings).
    if (doc.provider !== provider || doc.isNew) {
      doc.provider = provider;
      doc.publicFields = {};
      doc.encryptedFields = {};
    }

    for (const field of STORAGE_FIELDS[provider]) {
      const value = values[field.key];
      if (value === undefined || value === null) continue;
      if (field.secret) {
        if (value === "") continue; // empty = "leave the stored secret alone"
        doc.encryptedFields = { ...doc.encryptedFields, [field.key]: encryptSecret(value) };
      } else {
        doc.publicFields = { ...doc.publicFields, [field.key]: String(value).trim() };
      }
    }
  }

  // One setting serves EVERY store, so never save one that couldn't work: a store owner would only find out when an
  // upload fails. (Nothing has been written yet — the document is saved at the end.)
  if (provider) {
    const missing = missingLabels(doc);
    if (missing.length) {
      throw new HttpError(400, `Fill in ${missing.join(", ")} first — saved without them, image uploads would stop working for every store.`);
    }
  }

  if (processing !== undefined) {
    // Merge onto whatever is stored so a partial patch is fine, then re-validate.
    doc.processing = imageProcessingSchema.parse({ ...(doc.processing ?? {}), ...processing });
  }

  doc.updatedBy = userId;
  doc.markModified("publicFields");
  doc.markModified("encryptedFields");
  doc.markModified("processing");
  await doc.save();
}

export async function resetStorageConfig(userId) {
  const doc = await loadOrNew();
  doc.provider = "local";
  doc.publicFields = {};
  doc.encryptedFields = {};
  doc.updatedBy = userId;
  // compression settings are deliberately kept
  doc.markModified("publicFields");
  doc.markModified("encryptedFields");
  await doc.save();
}

/**
 * Make one store's own storage settings the platform's. The settings are copied as they are (the secret stays
 * encrypted — it is never decrypted or shown), and from then on EVERY store uses them: the stores' own old
 * documents are ignored. Images already uploaded keep working — each one is stored with its full address.
 */
export async function adoptStoreStorage(brandId, userId) {
  const own = await StorageConfigModel.findOne({ brandId: String(brandId) }).lean();
  if (!own) throw new HttpError(404, "That store has no storage settings of its own.");
  if (!isComplete(own)) throw new HttpError(409, `That store's storage settings are incomplete (${missingLabels(own).join(", ")} missing), so they can't be used for every store.`);
  await PlatformStorageModel.findOneAndUpdate(
    PLATFORM_KEY,
    {
      $set: {
        provider: own.provider ?? "local",
        publicFields: own.publicFields ?? {},
        encryptedFields: own.encryptedFields ?? {},
        processing: own.processing ?? {},
        updatedBy: userId,
      },
    },
    { upsert: true },
  );
}

/* ------------------------------------------------------------------ uploads */

const missingOf = (cfg) => (STORAGE_REQUIRED_FIELDS[cfg.provider] ?? []).filter((k) => !cfg[k]);

/** A store owner who hits a half-configured platform storage gets a plain message; the details are for the console. */
function assertUsable(cfg) {
  const missing = missingOf(cfg);
  if (missing.length) {
    logger.error({ provider: cfg.provider, missing }, "image storage is not fully configured");
    throw new HttpError(409, "Image uploads aren't available right now. Please contact TablePe.");
  }
}

/**
 * Compress + store one uploaded image, and return its public URL + key and the
 * final (post-processing) dimensions. Any format the image library can read is
 * accepted; the pipeline scales it to the platform's configured longest edge and
 * re-encodes it — see {@link processImage}.
 */
export async function putImage(ctx, { body, kind = "menu-items" }) {
  if (!body?.length) throw new HttpError(400, "Empty upload");
  if (body.length > IMAGE_RULES.maxUploadBytes) {
    throw new HttpError(413, `File is too large (max ${Math.round(IMAGE_RULES.maxUploadBytes / 1024 / 1024)} MB).`);
  }

  const cfg = await resolveStorage(ctx);
  assertUsable(cfg);

  const processed = await processImage(body, cfg.processing);

  const safeKind = /^[a-z0-9-]+$/.test(kind) ? kind : "menu-items";
  const key = `${ctx.brandId}/${ctx.outletId}/${safeKind}/${randomUUID()}.${processed.ext}`;

  const { url } = await providerFor(cfg.provider).put(cfg, {
    key,
    body: processed.buffer,
    contentType: processed.contentType,
  });

  logger.debug(
    { key, from: `${Math.round(processed.originalBytes / 1024)}KB`, to: `${Math.round(processed.bytes / 1024)}KB`, format: processed.format, quality: processed.quality },
    "image processed",
  );

  return {
    url,
    key,
    width: processed.width,
    height: processed.height,
    format: processed.format,
    bytes: processed.bytes,
    originalBytes: processed.originalBytes,
  };
}

/**
 * Store a file exactly as it came (chat photos, videos, documents — no re-encoding), under the store's own folder.
 * `ext` is taken from the file name or the type; the key never contains anything the caller chose verbatim.
 */
export async function putFile(ctx, { body, contentType, kind = "files", ext = "bin", maxBytes }) {
  if (!body?.length) throw new HttpError(400, "Empty upload");
  if (maxBytes && body.length > maxBytes) throw new HttpError(413, `File is too large (max ${Math.round(maxBytes / 1024 / 1024)} MB).`);
  const cfg = await resolveStorage(ctx);
  assertUsable(cfg);
  const safeKind = /^[a-z0-9-]+$/.test(kind) ? kind : "files";
  const safeExt = /^[a-z0-9]{1,8}$/i.test(ext) ? ext.toLowerCase() : "bin";
  const key = `${ctx.brandId}/${ctx.outletId ?? "store"}/${safeKind}/${randomUUID()}.${safeExt}`;
  const { url } = await providerFor(cfg.provider).put(cfg, { key, body, contentType: contentType || "application/octet-stream" });
  return { url, key, size: body.length };
}

/**
 * Read a stored file back (the WhatsApp worker sending a chat attachment). On this server's disk it is read
 * directly; elsewhere it is fetched from its public address.
 */
export async function readFile(ctx, { key, url }) {
  const cfg = await resolveStorage(ctx);
  if (cfg.provider === "local" && key && !key.includes("..")) {
    const { readFile: read } = await import("node:fs/promises");
    const { join } = await import("node:path");
    return read(join(cfg.uploadsRoot, key));
  }
  const r = await fetch(toPublicUrl(url));
  if (!r.ok) throw new Error(`couldn't fetch the file (${r.status})`);
  return Buffer.from(await r.arrayBuffer());
}

/** Best-effort delete — a missing file or a provider that has since changed must not 500. */
export async function removeObject(ctx, key) {
  if (!key) return;
  try {
    const cfg = await resolveStorage(ctx);
    await providerFor(cfg.provider).remove(cfg, key);
  } catch (err) {
    logger.warn({ err, key }, "storage object delete failed (ignored)");
  }
}

/** Round-trip a tiny object to prove the platform's credentials work. */
export async function testStorageConfig() {
  const ctx = { brandId: "platform", outletId: "probe" };
  const cfg = await resolveStorage(ctx);
  const missing = missingOf(cfg);
  if (missing.length) throw new HttpError(409, `Storage isn't fully set up — missing ${missing.join(", ")}.`);
  const provider = providerFor(cfg.provider);
  const key = `platform/.probe/${randomUUID()}.txt`;
  const started = Date.now();
  const { url } = await provider.put(cfg, { key, body: Buffer.from("tablepe storage probe"), contentType: "text/plain" });
  await provider.remove(cfg, key).catch(() => undefined);
  return { ok: true, provider: cfg.provider, ms: Date.now() - started, sampleUrl: url };
}
