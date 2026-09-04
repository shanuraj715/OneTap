import mongoose, {            } from "mongoose";
                                                      
import { tenantScope } from "../tenant-scope.js";

const { Schema, model, models } = mongoose;

/* ------------------------------------------------------------------ category */

                                  
              
                  
                   
               
                    
                    
                  
                  
 

const categorySchema = new Schema                 (
  {
    name: { type: String, required: true, trim: true },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);
categorySchema.plugin(tenantScope);
categorySchema.index({ brandId: 1, outletId: 1, sortOrder: 1 });

export const MenuCategoryModel                         =
  (models.MenuCategory                                      ) ??
  model                 ("MenuCategory", categorySchema);

/* ------------------------------------------------------------ modifier group */

                                   
              
                  
                   
               
                    
                    
                    
                                                               
                  
                  
 

const modifierGroupSchema = new Schema                  (
  {
    name: { type: String, required: true, trim: true },
    required: { type: Boolean, default: false },
    minSelect: { type: Number, default: 0 },
    maxSelect: { type: Number, default: 1 },
    options: {
      type: [
        new Schema(
          {
            id: { type: String, required: true },
            label: { type: String, required: true, trim: true },
            priceDelta: { type: Number, default: 0 },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { timestamps: true },
);
modifierGroupSchema.plugin(tenantScope);
modifierGroupSchema.index({ brandId: 1, outletId: 1 });

export const ModifierGroupModel                          =
  (models.ModifierGroup                                       ) ??
  model                  ("ModifierGroup", modifierGroupSchema);

/* ---------------------------------------------------------------- menu item */

                              
              
                  
                   
                     
               
                      
                     
                 
                                               
                    
                                                           
                             
                     
                       
                    
                  
                  
 

const itemSchema = new Schema             (
  {
    categoryId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    foodType: { type: String, enum: ["veg", "non-veg", "egg"], default: "veg" },
    tags: { type: [String], default: [] },
    basePrice: { type: Number, default: 0, min: 0 },
    variants: {
      type: [
        new Schema(
          {
            id: { type: String, required: true },
            label: { type: String, required: true, trim: true },
            price: { type: Number, required: true, min: 0 },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    modifierGroupIds: { type: [String], default: [] },
    gstRatePct: { type: Number, default: 5 },
    isAvailable: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);
itemSchema.plugin(tenantScope);
itemSchema.index({ brandId: 1, outletId: 1, categoryId: 1, sortOrder: 1 });

export const MenuItemModel                     =
  (models.MenuItem                                  ) ??
  model             ("MenuItem", itemSchema);
