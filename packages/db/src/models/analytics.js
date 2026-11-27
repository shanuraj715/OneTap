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

/**
 * The expenses ledger: a bill written down on the day it was paid (vegetables, a repair, the electricity). Money in whole paise.
 * `outletId` empty = a cost of the whole store. `day` is the Indian calendar day ("2026-11-28") so a range is a plain string comparison.
 * Tenant-scoped, so deleting a store takes its expenses with it.
 */
const expenseSchema = new Schema(
  {
    day: { type: String, required: true, index: true },
    category: { type: String, required: true, trim: true },
    label: { type: String, default: "", trim: true },
    amountPaise: { type: Number, required: true, min: 1 },
    vendor: { type: String, default: "", trim: true },
    note: { type: String, default: "", trim: true },
    paymentMode: { type: String, enum: ["cash", "upi", "card", "bank", "other"], default: "cash" },
    createdBy: { type: String, default: "" },
    createdByName: { type: String, default: "" },
  },
  { timestamps: true },
);
expenseSchema.plugin(tenantScope);
expenseSchema.index({ brandId: 1, day: -1 });
expenseSchema.index({ brandId: 1, outletId: 1, day: -1 });

export const ExpenseModel = models.Expense ?? model("Expense", expenseSchema);
