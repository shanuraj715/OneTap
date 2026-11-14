import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

/**
 * A platform plan — what a client store has bought. Platform-level, so NOT
 * tenant-scoped. `limits` and `entitlements` are validated by
 * `planSchema` (config-schema) in the service, the same way outlet config is.
 */
const planSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    limits: { type: Schema.Types.Mixed, default: () => ({}) },
    entitlements: { type: Schema.Types.Mixed, default: () => ({}) },
    /** how the plan appears on the TablePe website's Pricing — `planMarketingSchema` */
    marketing: { type: Schema.Types.Mixed, default: () => ({}) },
    /** archived plans stay on the stores that have them but can't be newly assigned */
    archived: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const PlanModel = models.Plan ?? model("Plan", planSchema);

/** Platform-wide settings — a single document keyed "platform". */
const platformSettingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "platform" },
    /** days a store may stay over a lowered limit before you're asked to block the extras */
    graceDays: { type: Number, default: 30, min: 0, max: 365 },
  },
  { timestamps: true },
);

export const PlatformSettingsModel = models.PlatformSettings ?? model("PlatformSettings", platformSettingsSchema);
