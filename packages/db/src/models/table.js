import mongoose, {            } from "mongoose";
import {
  SESSION_STATUSES,
  TABLE_STATUSES,
                     
                   
} from "@onetap/config-schema";
import { tenantScope } from "../tenant-scope.js";

const { Schema, model, models } = mongoose;

                           
              
                  
                   
                 
               
                
                      
                    
                                  
                                                              
                   
                  
                  
 

const tableSchema = new Schema          (
  {
    number: { type: String, required: true, trim: true },
    zone: { type: String, default: "" },
    seats: { type: Number, default: 4, min: 1 },
    status: { type: String, enum: TABLE_STATUSES, default: "free", index: true },
    isActive: { type: Boolean, default: true },
    activeSessionId: { type: String, default: null },
    qrSecret: { type: String, required: true },
  },
  { timestamps: true },
);
tableSchema.plugin(tenantScope);
tableSchema.index({ brandId: 1, outletId: 1, number: 1 }, { unique: true });

export const TableModel                  =
  (models.Table                               ) ?? model          ("Table", tableSchema);

/* ---------------------------------------------------------------- sessions */

/**
 * One party's stay at a table. Orders attach to the session, not the table, so
 * moving a party to another table carries the whole running tab with it.
 */
                                  
              
                  
                   
                  
                     
                        
                                                                                   
                                                                             
                 
                  
                    
                  
                  
 

const sessionSchema = new Schema                 (
  {
    tableId: { type: String, required: true, index: true },
    customerId: { type: String, required: true, index: true },
    status: { type: String, enum: SESSION_STATUSES, default: "open", index: true },
    tableHistory: {
      type: [new Schema({ tableId: String, number: String, at: Date, by: String }, { _id: false })],
      default: [],
    },
    openedAt: { type: Date, default: () => new Date() },
    closedAt: Date,
    closedBy: String,
  },
  { timestamps: true },
);
sessionSchema.plugin(tenantScope);
sessionSchema.index({ brandId: 1, outletId: 1, status: 1 });

export const TableSessionModel                         =
  (models.TableSession                                      ) ??
  model                 ("TableSession", sessionSchema);
