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
