import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

/**
 * A client onboarding form: what a TablePe representative collected from a restaurant that wants to join, kept as a draft
 * until it is published as a store. Platform-level (like a Lead) — it exists before the store does, so it has no brand.
 *
 * `data` is the whole form, shaped by `onboardingSchema` in config-schema. The owner's password is deliberately NOT part of
 * it: it is typed when the form is published and never stored here.
 */
const onboardingSchema = new Schema(
  {
    storeName: { type: String, default: "", trim: true, index: true },
    status: { type: String, enum: ["draft", "published"], default: "draft", index: true },
    data: { type: Schema.Types.Mixed, default: () => ({}) },
    repName: { type: String, default: "" },
    /** set when the form is published: the store it created */
    brandId: { type: String, default: null, index: true },
    publishedAt: { type: Date, default: null },
    publishedBy: { type: String, default: null },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true },
);
onboardingSchema.index({ updatedAt: -1 });

export const OnboardingModel = models.Onboarding ?? model("Onboarding", onboardingSchema);

/**
 * The price list the onboarding form's estimate uses (see `pricingSchema` in config-schema). One record for the whole
 * platform; absent until someone saves it, in which case the starting prices apply.
 */
const pricingSchema = new Schema(
  {
    key: { type: String, default: "pricing", unique: true },
    data: { type: Schema.Types.Mixed, default: () => ({}) },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true },
);

export const PricingModel = models.Pricing ?? model("Pricing", pricingSchema);

