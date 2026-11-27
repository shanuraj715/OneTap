import mongoose from "mongoose";
import { writeEvents } from "../write-events.js";

const { Schema, model, models } = mongoose;

/**
 * A role of the Rasoi Pulse team (sales, support …): a name and the platform features it holds (see config-schema/platform-access.js).
 * Platform-level — not tenant-scoped. Only the super admin makes, changes and deletes them. A change reaches everyone who holds the role
 * at once: it is announced to the sign-in cache (api/modules/cache/invalidation.js).
 */
const platformRoleSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    /** the name in lowercase, for "is there already a role called …" */
    nameKey: { type: String, required: true, unique: true, index: true },
    description: { type: String, default: "" },
    features: { type: [String], default: [] },
    createdBy: { type: String },
  },
  { timestamps: true },
);
platformRoleSchema.plugin(writeEvents, { model: "PlatformRole" });
export const PlatformRoleModel = models.PlatformRole ?? model("PlatformRole", platformRoleSchema);

/**
 * What the super admin did to roles and team members: one row per change, so there is always an answer to "who gave this person that role?".
 * Platform-level, never tenant-scoped; rows expire after a year. Nothing secret is ever stored in `detail` (never a password).
 */
const platformAuditSchema = new Schema(
  {
    actorId: { type: String, required: true },
    actorName: { type: String, default: "" },
    /** role.create · role.update · role.delete · member.create · member.update · member.password · member.delete */
    action: { type: String, required: true },
    targetId: { type: String },
    targetName: { type: String, default: "" },
    detail: { type: String, default: "" },
    ip: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
platformAuditSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });
export const PlatformAuditModel = models.PlatformAudit ?? model("PlatformAudit", platformAuditSchema);
