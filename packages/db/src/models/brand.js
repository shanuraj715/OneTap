import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

/**
 * A brand is the tenant root — it is NOT tenant-scoped itself. Everything below it
 * (outlets, menu, orders, ...) carries this brand's id and goes through tenant-scope.
 */
const brandSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    ownerEmail: { type: String, required: true, lowercase: true, trim: true },
    /** the platform plan this store is on — null means a legacy store: unlimited, everything unlocked */
    planId: { type: String, default: null },
    /** per-store changes on top of the plan (see planOverridesSchema in config-schema) */
    overrides: { type: Schema.Types.Mixed, default: () => ({}) },
    /**
     * The look shared by every outlet: theme, typography, effect, layout
     * (component styles). Null until migrated — outlets then fall back to
     * their own stored values, exactly as before.
     */
    appearance: { type: Schema.Types.Mixed, default: null },
    /** when usage first went over a plan limit; cleared once back within it */
    overLimitSince: { type: Date, default: null },
  },
  { timestamps: true },
);

export const BrandModel = models.Brand ?? model("Brand", brandSchema);
