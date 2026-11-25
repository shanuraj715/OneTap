import mongoose from "mongoose";

import { writeEvents } from "../write-events.js";

const { Schema, model, models } = mongoose;

/**
 * The Rasoi Pulse marketing website. Platform-level (not tenant-scoped): it's
 * Rasoi Pulse's own site, managed by the platform super admin. Section contents
 * are validated by `sitePageSchema` / `siteSettingsSchema` (config-schema) in
 * the service, so the stored shapes are Mixed here.
 */

const sitePageSchema = new Schema(
  {
    /** "home" is served at "/" */
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    title: { type: String, required: true, trim: true },
    status: { type: String, enum: ["draft", "published"], default: "draft", index: true },
    seo: { type: Schema.Types.Mixed, default: () => ({}) },
    nav: { type: Schema.Types.Mixed, default: () => ({}) },
    footerGroup: { type: String, default: "" },
    sections: { type: [Schema.Types.Mixed], default: [] },
    /** built-in pages (home, contact, privacy, terms) can be edited but not deleted */
    system: { type: Boolean, default: false },
    publishedAt: { type: Date, default: null },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true },
);

sitePageSchema.plugin(writeEvents, { model: "SitePage" });
export const SitePageModel = models.SitePage ?? model("SitePage", sitePageSchema);

const siteSettingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "site" },
    data: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true },
);

siteSettingsSchema.plugin(writeEvents, { model: "SiteSettings" });
export const SiteSettingsModel = models.SiteSettings ?? model("SiteSettings", siteSettingsSchema);

/** An enquiry from the website's contact form. */
const leadSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, default: "" },
    businessName: { type: String, default: "" },
    city: { type: String, default: "" },
    outlets: { type: String, default: "" },
    plan: { type: String, default: "" },
    message: { type: String, default: "" },
    sourcePage: { type: String, default: "" },
    utm: { type: Schema.Types.Mixed, default: () => ({}) },
    /** spam guard: a non-reversible stand-in for the sender's address, their number's last 10 digits, and the one-time token they submitted with */
    ipHash: { type: String, default: "", index: true },
    phoneKey: { type: String, default: "", index: true },
    challengeId: { type: String, index: { unique: true, sparse: true } },
    status: { type: String, enum: ["new", "contacted", "won", "lost"], default: "new", index: true },
    notes: {
      type: [
        new Schema(
          { text: { type: String, required: true }, at: { type: Date, default: () => new Date() }, by: { type: String, default: "" } },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { timestamps: true },
);
leadSchema.index({ createdAt: -1 });

export const LeadModel = models.Lead ?? model("Lead", leadSchema);
