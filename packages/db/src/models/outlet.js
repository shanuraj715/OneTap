import mongoose, {            } from "mongoose";
import { defaultOutletConfig,                   } from "@onetap/config-schema";
import { tenantScope } from "../tenant-scope.js";

const { Schema, model, models } = mongoose;

                            
              
                  
                    
               
               
                                                                              
                      
                                                          
                            
                       
                  
                  
 

const outletSchema = new Schema           (
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    hostnames: { type: [String], default: [] },
    canonicalHostname: { type: String, default: "" },
    config: { type: Schema.Types.Mixed, default: () => defaultOutletConfig() },
  },
  { timestamps: true },
);

outletSchema.plugin(tenantScope);
outletSchema.index({ brandId: 1, slug: 1 }, { unique: true });
outletSchema.index({ hostnames: 1 });

export const OutletModel                   =
  (models.Outlet                                ) ?? model           ("Outlet", outletSchema);
