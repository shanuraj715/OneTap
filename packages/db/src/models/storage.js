import mongoose from "mongoose";
import { STORAGE_PROVIDERS } from "@onetap/config-schema";
import { tenantScope } from "../tenant-scope.js";

const { Schema, model, models } = mongoose;

/**
 * Per-outlet image-storage configuration — mirrors {@link PaymentCredentialModel}.
 * Deliberately NOT part of `outlet.config`; that blob is served to the public
 * storefront and the secret access key must never ride along with it.
 *
 * One document per outlet: `provider` is the active store, `publicFields` holds
 * the plain settings (bucket, region, endpoint, public base URL) and
 * `encryptedFields` the secret access key. Switching provider rewrites this
 * same document.
 */
const storageConfigSchema = new Schema(
  {
    provider: { type: String, enum: STORAGE_PROVIDERS, default: "local" },
    publicFields: { type: Schema.Types.Mixed, default: {} },
    encryptedFields: { type: Schema.Types.Mixed, default: {} },
    // Image compression settings — parsed/defaulted through imageProcessingSchema
    // on the way out, so adding a knob needs no migration. Untouched by a
    // provider switch.
    processing: { type: Schema.Types.Mixed, default: {} },
    updatedBy: String,
  },
  { timestamps: true },
);
storageConfigSchema.plugin(tenantScope);
storageConfigSchema.index({ brandId: 1, outletId: 1 }, { unique: true });

export const StorageConfigModel =
  models.StorageConfig ?? model("StorageConfig", storageConfigSchema);

/**
 * The platform's ONE image-storage configuration — what every store's photos use. Only the platform's super
 * admin can see or change it (the console's Storage page); store owners never do. Each store's files still sit
 * under their own `<brandId>/` folder, so one bucket serves everyone without mixing them up.
 *
 * Same shape as a store's own document above (which exists only for stores set up before this moved to the
 * platform: it is honoured until this one is first saved, so nothing breaks during the move). Not tenant-scoped:
 * it belongs to no store. A single document, found by `key`.
 */
const platformStorageSchema = new Schema(
  {
    key: { type: String, default: "platform", unique: true },
    provider: { type: String, enum: STORAGE_PROVIDERS, default: "local" },
    publicFields: { type: Schema.Types.Mixed, default: {} },
    encryptedFields: { type: Schema.Types.Mixed, default: {} },
    processing: { type: Schema.Types.Mixed, default: {} },
    updatedBy: String,
  },
  { timestamps: true },
);

export const PlatformStorageModel =
  models.PlatformStorage ?? model("PlatformStorage", platformStorageSchema);

/**
 * One "move the files to another storage" job (platform console → Storage). Not tenant-scoped: it moves every store's files
 * (or one store's, `scope.brandId`). The destination's (or source's) secret key is kept encrypted, like the platform's own
 * storage settings, because the job keeps running after the request that started it has ended.
 *
 * `source` / `target`: { type: "local" | "active" | "s3", label, provider, publicFields, encryptedFields } — "active" is
 * resolved from the platform's storage settings when the job starts and then written here, so the record says exactly what
 * was used.
 */
const storageMigrationSchema = new Schema(
  {
    status: { type: String, enum: ["running", "done", "done_with_errors", "failed", "cancelled", "interrupted"], default: "running", index: true },
    stage: { type: String, default: "listing" }, // listing → copying → links → cleanup → done
    source: { type: Schema.Types.Mixed, default: {} },
    target: { type: Schema.Types.Mixed, default: {} },
    scope: { type: Schema.Types.Mixed, default: {} }, // { brandId?: string, brandName?: string }
    options: { type: Schema.Types.Mixed, default: {} }, // { deleteSource, activate }
    plan: { type: Schema.Types.Mixed, default: {} }, // { files, bytes, toCopy, toCopyBytes }
    progress: { type: Schema.Types.Mixed, default: {} }, // { done, copied, skipped, failed, bytesCopied, linksUpdated, deleted }
    failures: { type: [Schema.Types.Mixed], default: [] }, // first few { key, error }
    error: { type: String, default: "" },
    cancelRequested: { type: Boolean, default: false },
    startedBy: String,
    finishedAt: Date,
  },
  { timestamps: true },
);

export const StorageMigrationModel = models.StorageMigration ?? model("StorageMigration", storageMigrationSchema);

/**
 * One "optimize the pictures" job (platform console → Storage): pictures bigger than the platform's size limit are re-compressed
 * with the compression settings and the stores' picture addresses follow. Not tenant-scoped.
 *
 * `processing` is what the job ran with (the settings at the moment it started); `progress` counts what happened to each
 * picture: optimized, unchanged (could not get meaningfully smaller), failed, skipped (changed while the job ran).
 */
const storageOptimizeSchema = new Schema(
  {
    status: { type: String, enum: ["running", "done", "done_with_errors", "failed", "cancelled", "interrupted"], default: "running", index: true },
    stage: { type: String, default: "reading" }, // reading → links → cleanup → done
    options: { type: Schema.Types.Mixed, default: {} }, // { deleteOriginals }
    processing: { type: Schema.Types.Mixed, default: {} },
    plan: { type: Schema.Types.Mixed, default: {} }, // { files, bytes }
    progress: { type: Schema.Types.Mixed, default: {} }, // { done, optimized, unchanged, skipped, failed, bytesBefore, bytesAfter, linksUpdated, deleted, kept }
    failures: { type: [Schema.Types.Mixed], default: [] }, // first few { key, error }
    error: { type: String, default: "" },
    cancelRequested: { type: Boolean, default: false },
    startedBy: String,
    finishedAt: Date,
  },
  { timestamps: true },
);

export const StorageOptimizeModel = models.StorageOptimize ?? model("StorageOptimize", storageOptimizeSchema);

/**
 * Pictures that were re-compressed and could not get meaningfully smaller (a noisy photo already at the smallest size and
 * quality allowed). Remembered — per file size and compression settings — so the next scan doesn't list them again and again.
 */
const storageSettledSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    size: { type: Number, required: true },
    fingerprint: { type: String, required: true },
  },
  { timestamps: true },
);

export const StorageSettledModel = models.StorageSettled ?? model("StorageSettled", storageSettledSchema);
