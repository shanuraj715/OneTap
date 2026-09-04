import mongoose, {            } from "mongoose";

const { Schema, model, models } = mongoose;

                           
              
               
               
                     
                  
                  
 

/**
 * A brand is the tenant root — it is NOT tenant-scoped itself. Everything below it
 * (outlets, menu, orders, ...) carries this brand's id and goes through tenant-scope.
 */
const brandSchema = new Schema          (
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    ownerEmail: { type: String, required: true, lowercase: true, trim: true },
  },
  { timestamps: true },
);

export const BrandModel                  =
  (models.Brand                               ) ?? model          ("Brand", brandSchema);
