import mongoose, {            } from "mongoose";

const { Schema, model, models } = mongoose;

/** A diner. Identified by phone or email, per brand. Not a staff user. */
                              
              
                  
                 
                 
                
                     
                     
                                                                                  
                        
                  
                  
 

const customerSchema = new Schema             (
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
