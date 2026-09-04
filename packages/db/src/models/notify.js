import mongoose, {            } from "mongoose";
import { NOTIFY_CHANNELS, ORDER_STATUSES,                                           } from "@onetap/config-schema";
import { tenantScope } from "../tenant-scope.js";

const { Schema, model, models } = mongoose;

/**
 * Per-outlet WhatsApp/SMS credentials — mirrors {@link PaymentCredentialModel}
 * exactly. Deliberately NOT part of `outlet.config`; that blob is served to the
 * public storefront and a secret must never ride along with it.
 */
                                            
              
                  
                   
                              
                                                
                                       
                                                    
                                          
                     
                  
                  
 

const credentialSchema = new Schema                           (
  {
    channel: { type: String, enum: NOTIFY_CHANNELS, required: true },
    publicFields: { type: Schema.Types.Mixed, default: {} },
    encryptedFields: { type: Schema.Types.Mixed, default: {} },
    updatedBy: String,
  },
  { timestamps: true },
);
credentialSchema.plugin(tenantScope);
credentialSchema.index({ brandId: 1, outletId: 1, channel: 1 }, { unique: true });

export const NotificationCredentialModel                                   =
  (models.NotificationCredential                                                ) ??
  model                           ("NotificationCredential", credentialSchema);

/* --------------------------------------------------------------------- logs */

export const NOTIFICATION_LOG_STATUSES = ["sent", "failed", "skipped"]         ;
                                                                               

/**
 * One row per attempted (or deliberately skipped) order-lifecycle message.
 * This IS the resilience contract: a channel that's misconfigured or a
 * provider that's down must never fail order placement or a status change —
 * it only ever produces one of these rows instead.
 */
                                     
              
                  
                   
                              
                     
                   
                       
                                                                      
             
                                
                                                                              
                 
                                                                 
                             
                  
 

const logSchema = new Schema                    (
  {
    channel: { type: String, enum: NOTIFY_CHANNELS, required: true, index: true },
    event: { type: String, enum: ORDER_STATUSES, required: true, index: true },
    orderId: { type: String, index: true },
    orderNumber: String,
    to: { type: String, default: "" },
    status: { type: String, enum: NOTIFICATION_LOG_STATUSES, required: true, index: true },
    error: String,
    providerMessageId: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
logSchema.plugin(tenantScope);
logSchema.index({ brandId: 1, outletId: 1, createdAt: -1 });
// 90 days is plenty for a "why didn't this WhatsApp go out" investigation.
logSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

export const NotificationLogModel                            =
  (models.NotificationLog                                         ) ??
  model                    ("NotificationLog", logSchema);
