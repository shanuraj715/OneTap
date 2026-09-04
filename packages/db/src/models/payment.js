import mongoose, {            } from "mongoose";
import { GATEWAYS, PAYMENT_STATUSES,                                  } from "@onetap/config-schema";
import { tenantScope } from "../tenant-scope.js";

const { Schema, model, models } = mongoose;

/**
 * Per-outlet gateway credentials. Deliberately NOT part of `outlet.config` —
 * that blob is served to the public storefront. Secret fields are stored
 * encrypted and never leave the API.
 */
                                       
              
                  
                   
                   
                                             
                                       
                                                    
                                          
                     
                  
                  
 

const credentialSchema = new Schema                      (
  {
    gateway: { type: String, enum: GATEWAYS, required: true },
    publicFields: { type: Schema.Types.Mixed, default: {} },
    encryptedFields: { type: Schema.Types.Mixed, default: {} },
    updatedBy: String,
  },
  { timestamps: true },
);
credentialSchema.plugin(tenantScope);
credentialSchema.index({ brandId: 1, outletId: 1, gateway: 1 }, { unique: true });

export const PaymentCredentialModel                              =
  (models.PaymentCredential                                           ) ??
  model                      ("PaymentCredential", credentialSchema);

/* ----------------------------------------------------------------- payments */

/** One payment attempt against one order. The audit trail for money. */
                             
              
                  
                   
                  
                   
                        
                      
                 
                   
                                      
                          
                                                
                            
                         
                                                                  
                                                                                                   
                  
                  
 

const paymentSchema = new Schema            (
  {
    orderId: { type: String, required: true, index: true },
    gateway: { type: String, enum: GATEWAYS, required: true },
    status: { type: String, enum: PAYMENT_STATUSES, default: "pending", index: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    gatewayOrderId: { type: String, index: true },
    gatewayPaymentId: { type: String, index: true },
    failureReason: String,
    events: {
      type: [new Schema({ at: Date, source: String, type: String, payload: Schema.Types.Mixed }, { _id: false })],
      default: [],
    },
  },
  { timestamps: true },
);
paymentSchema.plugin(tenantScope);
paymentSchema.index({ brandId: 1, outletId: 1, createdAt: -1 });

export const PaymentModel                    =
  (models.Payment                                 ) ?? model            ("Payment", paymentSchema);

/* -------------------------------------------------------- webhook idempotency */

/** Gateways retry webhooks. This makes replays cheap and safe. */
                                  
              
                   
                                                             
                  
                    
 

const webhookSchema = new Schema                 ({
  gateway: { type: String, enum: GATEWAYS, required: true },
  eventId: { type: String, required: true },
  processedAt: { type: Date, default: () => new Date() },
});
webhookSchema.index({ gateway: 1, eventId: 1 }, { unique: true });
// keep 30 days of replay protection
webhookSchema.index({ processedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

export const WebhookEventModel                         =
  (models.WebhookEvent                                      ) ??
  model                 ("WebhookEvent", webhookSchema);
