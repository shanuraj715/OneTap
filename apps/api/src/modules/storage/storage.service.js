import { randomUUID } from "node:crypto";
import {
  IMAGE_RULES,
  STORAGE_FIELDS,
  STORAGE_PROVIDERS,
  STORAGE_REQUIRED_FIELDS,
  STORAGE_SECRET_FIELDS,
} from "@onetap/config-schema";
import { StorageConfigModel, tenantFilter } from "@onetap/db";
import { env, publicApiUrl } from "../../env.js";
import { decryptSecret, encryptSecret, maskSecret } from "../../lib/crypto.js";
import { logger } from "../../logger.js";
import { HttpError } from "../../middleware/error.js";
import { localUploadsPath, providerFor } from "./providers/index.js";

const UPLOADS_ROOT = localUploadsPath(env.UPLOADS_DIR);
const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/* --------------------------------------------------------------- resolution */

/**
 * The full, decrypted config the provider adapters need. Never leaves the API.
 * An outlet with no document configured falls back to local disk.
 */
export async function resolveStorage(ctx) {
  const doc = await StorageConfigModel.findOne(tenantFilter(ctx)).lean();
  const provider = doc?.provider ?? "local";

  /** @type {import("./providers/types.js").ResolvedStorage} */
  const cfg = {
    provider,
    brandId: ctx.brandId,
    outletId: ctx.outletId,
    uploadsRoot: UPLOADS_ROOT,
    publicApiUrl,
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

/** What the admin sees: active provider, fields with secrets masked, ready flag. */
export async function getStorageConfig(ctx) {
  const doc = await StorageConfigModel.findOne(tenantFilter(ctx)).lean();
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
    providers,
  };
}

export async function saveStorageConfig(ctx, provider, values, userId) {
  if (!STORAGE_PROVIDERS.includes(provider)) throw new HttpError(400, "Unknown storage provider");
  const spec = STORAGE_FIELDS[provider];

  const doc =
    (await StorageConfigModel.findOne(tenantFilter(ctx))) ??
    new StorageConfigModel({ brandId: ctx.brandId, outletId: ctx.outletId });

  // Switching provider starts its config clean.
  if (doc.provider !== provider) {
    doc.provider = provider;
    doc.publicFields = {};
    doc.encryptedFields = {};
  }

  for (const field of spec) {
    const value = values[field.key];
    if (value === undefined) continue;
    if (field.secret) {
      if (value === "") continue; // empty = "leave the stored secret alone"
      doc.encryptedFields = { ...doc.encryptedFields, [field.key]: encryptSecret(value) };
    } else {
      doc.publicFields = { ...doc.publicFields, [field.key]: value.trim() };
    }
  }

  // A required secret that was cleared (sent as a single space, say) — treat blanks as unset.
  for (const key of STORAGE_SECRET_FIELDS[provider] ?? []) {
    if (values[key] === null) {
      const { [key]: _drop, ...rest } = doc.encryptedFields ?? {};
      doc.encryptedFields = rest;
    }
  }

  doc.updatedBy = userId;
  doc.markModified("publicFields");
  doc.markModified("encryptedFields");
  await doc.save();
}

export async function resetStorageConfig(ctx) {
  await StorageConfigModel.findOneAndUpdate(
    tenantFilter(ctx),
    { provider: "local", publicFields: {}, encryptedFields: {} },
    { upsert: true },
  );
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
 * Store one image and return its public URL + key. The API never decodes the
 * image — the admin resizes it on a canvas first and passes the final
 * dimensions, so no image library is needed here.
 */
export async function putImage(ctx, { body, contentType, width, height, kind = "menu-items" }) {
  if (!EXT[contentType]) {
    throw new HttpError(415, `Unsupported image type ${contentType}. Use JPEG, PNG or WebP.`);
  }
  if (!body?.length) throw new HttpError(400, "Empty upload");
  if (body.length > IMAGE_RULES.maxBytes) {
    throw new HttpError(413, `Image is too large (max ${Math.round(IMAGE_RULES.maxBytes / 1024 / 1024)} MB).`);
  }

  const cfg = await resolveStorage(ctx);
  assertUsable(cfg);

  const safeKind = /^[a-z0-9-]+$/.test(kind) ? kind : "menu-items";
  const key = `${ctx.brandId}/${ctx.outletId}/${safeKind}/${randomUUID()}.${EXT[contentType]}`;

  const provider = providerFor(cfg.provider);
  const { url } = await provider.put(cfg, { key, body, contentType });

  return {
    url,
    key,
    width: Number.isFinite(width) && width > 0 ? Math.round(width) : undefined,
    height: Number.isFinite(height) && height > 0 ? Math.round(height) : undefined,
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
