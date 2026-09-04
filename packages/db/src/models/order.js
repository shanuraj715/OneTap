import mongoose, {            } from "mongoose";
import {
  GATEWAYS,
  ORDER_CHANNELS,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  PLACED_BY_VALUES,
               
                     
                    
                   
                   
                
                  
} from "@onetap/config-schema";
import { tenantScope } from "../tenant-scope.js";

const { Schema, model, models } = mongoose;

                           
              
                  
                   
                                                             
                      
                        
                                                                                   
                     
                                                                                                 
                   
                     
                      
                                                                                   
                                                                   
                      
                      
                            
                                                                           
                               
                   
                     
                                                                            
                      
                                                                        
                     
                 
                
                
                       
                      
    
                                                   
                      
                
     
                                                                               
                                                                               
                                                                     
     
                  
                        
             
                
                     
                     
                       
                    
      
                  
                  
 

const orderSchema = new Schema          (
  {
    orderNumber: { type: String, required: true },
    channel: { type: String, enum: ORDER_CHANNELS, required: true },
    placedBy: { type: String, enum: PLACED_BY_VALUES, default: "customer", index: true },
    staffId: { type: String },
    staffName: { type: String },
    status: { type: String, enum: ORDER_STATUSES, default: "placed", index: true },
    customer: {
      customerId: String,
      name: String,
      phone: String,
      email: String,
    },
    lines: { type: Schema.Types.Mixed, required: true },
    totals: { type: Schema.Types.Mixed, required: true },
    pricesIncludeTax: { type: Boolean, default: true },
    payment: {
      gateway: { type: String, enum: GATEWAYS, default: "cod" },
      status: { type: String, enum: PAYMENT_STATUSES, default: "pending" },
      paymentId: String,
    },
    tableId: { type: String, index: true },
    sessionId: { type: String, index: true },
    couponCode: { type: String },
    deliveryAddress: {
      type: new Schema(
        { text: String, lat: Number, lng: Number, distanceKm: Number, landmark: String },
        { _id: false },
      ),
      default: undefined,
    },
    etaMinutes: { type: Number },
    note: String,
    statusHistory: {
      type: [
        new Schema(
          {
            status: String,
            at: Date,
            by: String,
            manual: Boolean,
            edited: Boolean,
            from: String,
            reason: String,
          },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { timestamps: true },
);

orderSchema.plugin(tenantScope);
orderSchema.index({ brandId: 1, outletId: 1, createdAt: -1 });
orderSchema.index({ brandId: 1, outletId: 1, orderNumber: 1 }, { unique: true });

export const OrderModel                  =
  (models.Order                               ) ?? model          ("Order", orderSchema);

/* ------------------------------------------------------------------ counters */

                             
              
              
 

const counterSchema = new Schema            ({
  _id: { type: String },
  seq: { type: Number, default: 0 },
});

export const CounterModel                    =
  (models.Counter                                 ) ?? model            ("Counter", counterSchema);

/**
 * Atomic, gap-free sequence. Used for daily order numbers now and for GST
 * invoice numbers later, where gapless numbering is a legal requirement.
 */
export async function nextSequence(key        )                  {
  const doc = await CounterModel.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  ).lean();
  return doc?.seq ?? 1;
}
