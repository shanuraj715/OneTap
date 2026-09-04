import mongoose, { type Model } from "mongoose";
import { ROLES, type Role } from "@onetap/config-schema";

const { Schema, model, models } = mongoose;

export interface Membership {
  brandId: string;
  role: Role;
  /** empty = every outlet in the brand */
  outletIds: string[];
}

export interface UserDoc {
  _id: string;
  email: string;
  name: string;
  passwordHash: string;
  /** platform staff — bypasses brand membership checks */
  isSuperAdmin: boolean;
  memberships: Membership[];
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Users are NOT tenant-scoped: login looks them up by email before any tenant is
 * known. Access is granted by `memberships`, and every brand-scoped query in the
 * user service filters on those explicitly.
 */
const userSchema = new Schema<UserDoc>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    isSuperAdmin: { type: Boolean, default: false },
    memberships: {
      type: [
        new Schema<Membership>(
          {
            brandId: { type: String, required: true, index: true },
            role: { type: String, enum: ROLES, required: true },
            outletIds: { type: [String], default: [] },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

export const UserModel: Model<UserDoc> =
  (models.User as Model<UserDoc> | undefined) ?? model<UserDoc>("User", userSchema);

/* ------------------------------------------------------------------ session */

export interface SessionDoc {
  _id: string;
  /** sha256 of the opaque token — the raw token only ever lives in the cookie */
  tokenHash: string;
  userId: string;
  expiresAt: Date;
  userAgent?: string;
  ip?: string;
  createdAt: Date;
}

const sessionSchema = new Schema<SessionDoc>(
  {
    tokenHash: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    userAgent: { type: String },
    ip: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Mongo drops expired sessions on its own.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const SessionModel: Model<SessionDoc> =
  (models.Session as Model<SessionDoc> | undefined) ?? model<SessionDoc>("Session", sessionSchema);
