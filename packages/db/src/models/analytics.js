import mongoose from "mongoose";
import { tenantScope } from "../tenant-scope.js";

const { Schema, model, models } = mongoose;

/**
 * The expenses and settings behind a store's profit & loss calculator, when the owner chooses "Save to my store"
 * (they always live in the browser too). One record per store. `data` is what the calculator keeps:
 * { foodCostPct, safetyPct, scopes: { store: [...], <outletId>: [...] } } — amounts are monthly, in rupees.
 */
const analyticsProfileSchema = new Schema(
  {
    key: { type: String, default: "finance" },
    data: { type: Schema.Types.Mixed, default: {} },
    savedBy: { type: String },
  },
  { timestamps: true },
);
analyticsProfileSchema.plugin(tenantScope);
analyticsProfileSchema.index({ brandId: 1, key: 1 }, { unique: true });

export const AnalyticsProfileModel = models.AnalyticsProfile ?? model("AnalyticsProfile", analyticsProfileSchema);
