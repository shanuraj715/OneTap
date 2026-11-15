import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

/**
 * Who signed in to the dashboard, and who tried to and couldn't — one row per
 * attempt. Platform-level (a sign-in isn't tied to one store), so it is NOT
 * tenant-scoped. Rows expire on their own after six months.
 */
const loginLogSchema = new Schema(
  {
    /** the account that was signed in to; absent when the email matched no account */
    userId: { type: String },
    /** what was typed, lowercased */
    email: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String },
    success: { type: Boolean, required: true },
    /** why a failed attempt failed: wrong_password · unknown_account · inactive · paused */
    reason: { type: String, default: "" },
    isSuperAdmin: { type: Boolean, default: false },
    /** "platform" = the TablePe console, "store" = a restaurant's own dashboard */
    scope: { type: String, enum: ["platform", "store", "unknown"], default: "unknown" },
    brandId: { type: String },
    /** kept as it was when the sign-in happened */
    brandName: { type: String },
    role: { type: String },
    ip: { type: String },
    userAgent: { type: String },
    /** "Chrome on macOS" — worked out from the user agent when the row is written */
    device: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// the one time index also serves "newest first" reads (an index can be read backwards)
loginLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });
loginLogSchema.index({ success: 1, createdAt: -1 });
loginLogSchema.index({ scope: 1, createdAt: -1 });

export const LoginLogModel = models.LoginLog ?? model("LoginLog", loginLogSchema);
