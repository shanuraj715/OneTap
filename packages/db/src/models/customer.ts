import mongoose, { type Model } from "mongoose";

const { Schema, model, models } = mongoose;

/** A diner. Identified by phone or email, per brand. Not a staff user. */
export interface CustomerDoc {
  _id: string;
  brandId: string;
  phone?: string;
  email?: string;
  name?: string;
  orderCount: number;
  lastOrderAt?: Date;
  /** the coin wallet — see @onetap/config-schema's wallet.ts for the rate math */
  walletBalance: number;
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new Schema<CustomerDoc>(
  {
    brandId: { type: String, required: true, index: true },
    phone: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    name: { type: String, trim: true },
    orderCount: { type: Number, default: 0 },
    lastOrderAt: Date,
    walletBalance: { type: Number, default: 0 },
  },
  { timestamps: true },
);
customerSchema.index({ brandId: 1, phone: 1 });
customerSchema.index({ brandId: 1, email: 1 });

export const CustomerModel: Model<CustomerDoc> =
  (models.Customer as Model<CustomerDoc> | undefined) ?? model<CustomerDoc>("Customer", customerSchema);

/* ---------------------------------------------------------------------- otp */

export interface OtpChallengeDoc {
  _id: string;
  brandId: string;
  outletId: string;
  /** phone number or email address */
  destination: string;
  channel: "sms" | "email";
  codeHash: string;
  attempts: number;
  expiresAt: Date;
  consumedAt?: Date;
  createdAt: Date;
}

const otpSchema = new Schema<OtpChallengeDoc>(
  {
    brandId: { type: String, required: true, index: true },
    outletId: { type: String, required: true },
    destination: { type: String, required: true, index: true },
    channel: { type: String, enum: ["sms", "email"], required: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
    consumedAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OtpChallengeModel: Model<OtpChallengeDoc> =
  (models.OtpChallenge as Model<OtpChallengeDoc> | undefined) ??
  model<OtpChallengeDoc>("OtpChallenge", otpSchema);

/* ----------------------------------------------------------- customer session */

export interface CustomerSessionDoc {
  _id: string;
  tokenHash: string;
  customerId: string;
  brandId: string;
  expiresAt: Date;
  createdAt: Date;
}

const customerSessionSchema = new Schema<CustomerSessionDoc>(
  {
    tokenHash: { type: String, required: true, unique: true, index: true },
    customerId: { type: String, required: true },
    brandId: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
customerSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const CustomerSessionModel: Model<CustomerSessionDoc> =
  (models.CustomerSession as Model<CustomerSessionDoc> | undefined) ??
  model<CustomerSessionDoc>("CustomerSession", customerSessionSchema);
