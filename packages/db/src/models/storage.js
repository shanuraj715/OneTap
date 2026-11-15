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
