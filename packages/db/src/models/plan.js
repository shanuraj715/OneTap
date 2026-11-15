import mongoose from "mongoose";

import { writeEvents } from "../write-events.js";

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
    /** includes nothing by itself — each store's limits and features are set by hand */
    custom: { type: Boolean, default: false },
    limits: { type: Schema.Types.Mixed, default: () => ({}) },
    entitlements: { type: Schema.Types.Mixed, default: () => ({}) },
    /** how the plan appears on the TablePe website's Pricing — `planMarketingSchema` */
    marketing: { type: Schema.Types.Mixed, default: () => ({}) },
    /** archived plans stay on the stores that have them but can't be newly assigned */
    archived: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// a plan edit changes what every store on it may do, and what the website's Pricing shows
planSchema.plugin(writeEvents, { model: "Plan" });

export const PlanModel = models.Plan ?? model("Plan", planSchema);

/** Platform-wide settings — a single document keyed "platform". */
const platformSettingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "platform" },
    /** days a store may stay over a lowered limit before you're asked to block the extras */
    graceDays: { type: Number, default: 30, min: 0, max: 365 },
    /**
     * How long the API may reuse what it has read from the database (a store's
     * look, menu, addresses…) before reading it again. Seconds; 0 turns the cache off.
     */
    cacheTtlSeconds: { type: Number, default: 300, min: 0, max: 86400 },
    /**
     * "Expire the cache" requests, kept here so every API process sharing this
     * database hears about them (each checks every few seconds). All stores:
     */
    cacheExpiredAt: { type: Date, default: null },
    /** …or one store: { [brandId]: when } */
    cacheStoreExpiredAt: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true },
);

// the grace period matters to every store's plan status; the cache bookkeeping fields change nothing that is cached
platformSettingsSchema.plugin(writeEvents, { model: "PlatformSettings", ignore: ["cacheTtlSeconds", "cacheExpiredAt", "cacheStoreExpiredAt", "key"] });

export const PlatformSettingsModel = models.PlatformSettings ?? model("PlatformSettings", platformSettingsSchema);
