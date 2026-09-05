import mongoose from "mongoose";
import { CUSTOMER_GENDERS } from "@onetap/config-schema";

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
    orderCount: { type: Number, default: 0 },
    lastOrderAt: Date,
    walletBalance: { type: Number, default: 0 },
  },
  { timestamps: true },
);
customerSchema.index({ brandId: 1, phone: 1 });
customerSchema.index({ brandId: 1, email: 1 });

export const CustomerModel                     =
  (models.Customer                                  ) ?? model             ("Customer", customerSchema);

/* ---------------------------------------------------------------------- otp */

                                  
              
                  
                   
                                      
                      
                           
                   
                   
                  
                    
                  
 

const otpSchema = new Schema                 (
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

export const OtpChallengeModel                         =
  (models.OtpChallenge                                      ) ??
  model                 ("OtpChallenge", otpSchema);

/* ----------------------------------------------------------- customer session */

                                     
              
                    
                     
                  
                  
                  
 

const customerSessionSchema = new Schema                    (
  {
    tokenHash: { type: String, required: true, unique: true, index: true },
    customerId: { type: String, required: true },
    brandId: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
customerSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const CustomerSessionModel                            =
  (models.CustomerSession                                         ) ??
  model                    ("CustomerSession", customerSessionSchema);
