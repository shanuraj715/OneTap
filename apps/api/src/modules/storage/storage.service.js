import { randomUUID } from "node:crypto";
import {
  IMAGE_FORMAT_LABELS,
  IMAGE_OUTPUT_FORMATS,
  IMAGE_RULES,
  imageProcessingSchema,
  STORAGE_FIELDS,
  STORAGE_PROVIDERS,
  STORAGE_REQUIRED_FIELDS,
  STORAGE_SECRET_FIELDS,
} from "@onetap/config-schema";
import { brandFilter, StorageConfigModel } from "@onetap/db";
import { env, publicApiUrl } from "../../env.js";
import { decryptSecret, encryptSecret, maskSecret } from "../../lib/crypto.js";
import { logger } from "../../logger.js";
import { HttpError } from "../../middleware/error.js";
import { processImage } from "./image.js";
import { localUploadsPath, providerFor } from "./providers/index.js";

const UPLOADS_ROOT = localUploadsPath(env.UPLOADS_DIR);

/* --------------------------------------------------------------- resolution */

/**
 * The full, decrypted config the provider adapters + image pipeline need.
 * Never leaves the API. Shared by every outlet in the brand (see
 * `brandFilter`) — a brand with no document configured falls back to local
 * disk with the default compression settings.
 */
export async function resolveStorage(ctx) {
  const doc = await StorageConfigModel.findOne(brandFilter(ctx)).lean();
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

/** What the admin sees: active provider, fields with secrets masked, compression settings. */
export async function getStorageConfig(ctx) {
  const doc = await StorageConfigModel.findOne(brandFilter(ctx)).lean();
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
      isSet: active && (f.secret ? Boolean(doc?.encryptedFields?.[f.key]) : Boolean(doc?.publicFields?.[f.key])),
    }));
    return {
      id,
      requiredFields: STORAGE_REQUIRED_FIELDS[id],
      fields,
      configured:
        id === "local" ? true : STORAGE_REQUIRED_FIELDS[id].every((k) => fields.find((f) => f.key === k)?.isSet),
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

async function loadOrNew(ctx) {
  return (
    (await StorageConfigModel.findOne(brandFilter(ctx))) ??
    new StorageConfigModel({ brandId: ctx.brandId })
  );
}

export async function saveStorageConfig(ctx, { provider, values = {}, processing }, userId) {
  const doc = await loadOrNew(ctx);

  if (provider) {
    if (!STORAGE_PROVIDERS.includes(provider)) throw new HttpError(400, "Unknown storage provider");

    // Switching provider starts its credentials clean (but keeps compression settings).
    if (doc.provider !== provider) {
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

export async function resetStorageConfig(ctx) {
  const doc = await loadOrNew(ctx);
  doc.provider = "local";
  doc.publicFields = {};
  doc.encryptedFields = {};
  // compression settings are deliberately kept
  doc.markModified("publicFields");
  doc.markModified("encryptedFields");
  await doc.save();
}

/* ------------------------------------------------------------------ uploads */

function assertUsable(cfg) {
  const missing = (STORAGE_REQUIRED_FIELDS[cfg.provider] ?? []).filter((k) => !cfg[k]);
  if (missing.length) {
    throw new HttpError(
      409,
      `Image storage isn't fully configured (missing ${missing.join(", ")}). Set it up in Admin → Storage.`,
    );
  }
}

/**
 * Compress + store one uploaded image, and return its public URL + key and the
 * final (post-processing) dimensions. Any format the image library can read is
 * accepted; the pipeline scales it to the outlet's configured longest edge and
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

/** Round-trip a tiny object to prove the credentials work. */
export async function testStorageConfig(ctx) {
  const cfg = await resolveStorage(ctx);
  assertUsable(cfg);
  const provider = providerFor(cfg.provider);
  const key = `${ctx.brandId}/${ctx.outletId}/.probe/${randomUUID()}.txt`;
  const started = Date.now();
  const { url } = await provider.put(cfg, { key, body: Buffer.from("onetap storage probe"), contentType: "text/plain" });
  await provider.remove(cfg, key).catch(() => undefined);
  return { ok: true, provider: cfg.provider, ms: Date.now() - started, sampleUrl: url };
}
