import mongoose from "mongoose";
import { CUSTOMER_GENDERS } from "@onetap/config-schema";
import { writeEvents } from "../write-events.js";

const { Schema, model, models } = mongoose;

/**
 * A diner. Identified by phone or email, per brand. Not a staff user.
 *
 * `gender` and `age` were added after `name` — a customer who signed up
 * before this feature shipped has neither. Both stay optional at the schema
 * level for exactly that reason: `isProfileComplete()` in config-schema is
 * what decides whether a customer still needs to fill them in, not a
 * `required: true` here that would make existing rows invalid.
 */
const customerSchema = new Schema(
  {
    brandId: { type: String, required: true, index: true },
    phone: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    name: { type: String, trim: true },
    gender: { type: String, enum: CUSTOMER_GENDERS, default: null },
    age: { type: Number, min: 1, max: 120, default: null },
    /** the calendar year `age` was recorded in — what lets the age grow year by year (see currentAge) */
    ageYear: { type: Number, default: null },
    orderCount: { type: Number, default: 0 },
    lastOrderAt: Date,
    walletBalance: { type: Number, default: 0 },
    /** when this customer was last sent an abandoned-cart reminder (at most one every few days, whatever the outlet) */
    cartRemindedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
// whenever an age is set or changed, remember the year — every place that sets one goes through save()
customerSchema.pre("save", function stampAgeYear() {
  if (this.age && (this.isNew || this.isModified("age") || !this.ageYear)) this.ageYear = new Date().getFullYear();
});
customerSchema.index({ brandId: 1, phone: 1 });
customerSchema.index({ brandId: 1, email: 1 });

// who a signed-in customer is is kept for a few seconds (modules/customer) — any change to them drops it at once
customerSchema.plugin(writeEvents, { model: "Customer", brandFrom: "brandId" });
export const CustomerModel = models.Customer ?? model("Customer", customerSchema);

/* ---------------------------------------------------------------------- otp */

const otpSchema = new Schema(
  {
    brandId: { type: String, required: true, index: true },
    outletId: { type: String, required: true },
    destination: { type: String, required: true, index: true },
    channel: { type: String, enum: ["sms", "email"], required: true },
    // "login" (storefront sign-in) or "coins" (staff spending a customer's
    // coins) — each flow only ever consumes its own codes. Older rows have
    // no purpose and count as login.
    purpose: { type: String, enum: ["login", "coins"], default: "login" },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
    consumedAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OtpChallengeModel = models.OtpChallenge ?? model("OtpChallenge", otpSchema);

/**
 * How many codes a number has been sent lately, and when the next one may be requested (the resend waits in
 * config-schema/otp.js). Separate from OtpChallenge on purpose: a challenge is deleted ten minutes after it is made,
 * but the waits run for hours — and the rule has to hold for anyone who calls the API directly.
 * One row per (store, number, purpose); it is forgotten after a day without a request, or when the number signs in.
 */
const otpThrottleSchema = new Schema({
  brandId: { type: String, required: true },
  destination: { type: String, required: true },
  purpose: { type: String, enum: ["login", "coins"], default: "login" },
  /** codes actually sent in this stretch (a send that failed is given back) */
  count: { type: Number, default: 0 },
  lastSentAt: Date,
  /** no new code before this moment */
  nextAllowedAt: { type: Date, required: true },
  /** how the last code went out ("linked" | "whatsapp" | "sms") — so a screen that asks too early can say so */
  via: String,
  expiresAt: { type: Date, required: true },
});
otpThrottleSchema.index({ brandId: 1, destination: 1, purpose: 1 }, { unique: true });
otpThrottleSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OtpThrottleModel = models.OtpThrottle ?? model("OtpThrottle", otpThrottleSchema);

/* ----------------------------------------------------------- customer session */

const customerSessionSchema = new Schema(
  {
    tokenHash: { type: String, required: true, unique: true, index: true },
    customerId: { type: String, required: true },
    brandId: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
customerSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

customerSessionSchema.plugin(writeEvents, { model: "CustomerSession" });
export const CustomerSessionModel =
  models.CustomerSession ?? model("CustomerSession", customerSessionSchema);
