import mongoose, {            } from "mongoose";
import { ROLES,           } from "@onetap/config-schema";

const { Schema, model, models } = mongoose;

                             
                  
             
                                          
                      
 

                          
              
                
               
                       
                                                          
                        
                            
                    
                     
                  
                  
 

/**
 * Users are NOT tenant-scoped: login looks them up by email before any tenant is
 * known. Access is granted by `memberships`, and every brand-scoped query in the
 * user service filters on those explicitly.
 */
const userSchema = new Schema         (
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    isSuperAdmin: { type: Boolean, default: false },
    memberships: {
      type: [
        new Schema            (
          {
            brandId: { type: String, required: true, index: true },
            role: { type: String, enum: ROLES, required: true },
            outletIds: { type: [String], default: [] },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

export const UserModel                 =
  (models.User                              ) ?? model         ("User", userSchema);

/* ------------------------------------------------------------------ session */

                             
              
                                                                                 
                    
                 
                  
                     
              
                  
 

const sessionSchema = new Schema            (
  {
    tokenHash: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    userAgent: { type: String },
    ip: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Mongo drops expired sessions on its own.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const SessionModel                    =
  (models.Session                                 ) ?? model            ("Session", sessionSchema);
