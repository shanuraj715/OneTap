import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

/**
 * Brute-force protection: one row per network address (per kind of sign-in) that has failed to sign in. Platform-level
 * (not tenant-scoped — an attacker isn't a store's), and it deletes itself once there is nothing left to remember.
 */
const loginGuardSchema = new Schema(
  {
    /** "staff|203.0.113.7" — the kind of sign-in and the address (IPv6 is grouped by /64) */
    key: { type: String, required: true, unique: true },
    ip: { type: String, required: true },
    /** "staff" = the dashboards (store team + platform), "customer" = a diner's one-time code */
    scope: { type: String, enum: ["staff", "customer", "staff-account"], required: true },
    /** failed attempts inside the current window */
    failures: { type: Number, default: 0 },
    windowStart: { type: Date },
    /** how many times this address has been blocked lately — decides how long the next block lasts */
    strikes: { type: Number, default: 0 },
    blockedUntil: { type: Date },
    lastBlockAt: { type: Date },
    lastAttemptAt: { type: Date },
    /** when this row can be forgotten (TTL) */
    expireAt: { type: Date },
  },
  { timestamps: true },
);
loginGuardSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

export const LoginGuardModel = models.LoginGuard ?? model("LoginGuard", loginGuardSchema);
