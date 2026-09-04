import mongoose, {                                   } from "mongoose";
import {
  ALIGNS,
  COLOR_MODES,
  DEFAULT_MAX_ATTEMPTS,
  PAPER_WIDTHS,
  PRINT_BLOCKS,
  PRINT_DOCS,
  PRINT_JOB_STATUSES,
  PRINT_STATIONS,
  PRINT_TARGETS,
  SIZES,
                   
                 
                  
                    
                         
                      
                    
                   
} from "@onetap/config-schema";
import { tenantScope } from "../tenant-scope.js";

const { Schema, model, models } = mongoose;

/* ---------------------------------------------------------------- printers */

                             
              
                  
                   
               
                        
                        
                      
                         
                            
                                
                        
                     
                 
                    
                      
                    
                        
                           
                           
                  
                  
 

const connection = new Schema(
  {
    host: { type: String, default: "" },
    port: { type: Number, default: 80 },
    useTls: { type: Boolean, default: false },
    deviceId: { type: String, default: "local_printer" },
    cloudPrinterId: { type: String, default: "" },
    // AES-GCM envelope, written by the API. Stripped from every response.
    cloudApiKey: { type: String, default: "" },
    agentId: { type: String, default: "" },
    queueName: { type: String, default: "" },
  },
  { _id: false },
);

const printerSchema = new Schema            (
  {
    name: { type: String, required: true, trim: true },
    station: { type: String, enum: PRINT_STATIONS, required: true, index: true },
    docType: { type: String, enum: PRINT_DOCS, required: true },
    target: { type: String, enum: PRINT_TARGETS, required: true },
    paperWidth: { type: String, enum: PAPER_WIDTHS, default: "80mm" },
    templateId: { type: String, default: null },
    connection: { type: connection, default: () => ({}) },
    // Order statuses that fire this printer with nobody pressing anything.
    autoPrintOn: { type: [String], default: [] },
    // Empty means "every channel".
    channels: { type: [String], default: [] },
    copies: { type: Number, default: 1, min: 1, max: 5 },
    cutAfter: { type: Boolean, default: true },
    openDrawer: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true, index: true },
    lastOkAt: { type: Date, default: null },
    lastErrorAt: { type: Date, default: null },
    lastError: { type: String, default: null },
  },
  { timestamps: true },
);
printerSchema.plugin(tenantScope);
printerSchema.index({ brandId: 1, outletId: 1, name: 1 }, { unique: true });

export const PrinterModel                    =
  (models.Printer                                 ) ?? model            ("Printer", printerSchema);

/* --------------------------------------------------------------- templates */

                                   
              
                  
                   
               
                        
                         
                       
                  
                       
                        
                                                                     
                        
                              
                    
                     
                  
                  
 

const blockSchema = new Schema(
  {
    key: { type: String, enum: PRINT_BLOCKS, required: true },
    enabled: { type: Boolean, default: true },
    align: { type: String, enum: ALIGNS, default: "left" },
    size: { type: String, enum: SIZES, default: "md" },
    bold: { type: Boolean, default: false },
    rule: { type: Boolean, default: false },
    text: { type: String, default: "" },
  },
  { _id: false },
);

const templateSchema = new Schema                  (
  {
    name: { type: String, required: true, trim: true },
    docType: { type: String, enum: PRINT_DOCS, required: true, index: true },
    paperWidth: { type: String, enum: PAPER_WIDTHS, default: "80mm" },
    colorMode: { type: String, enum: COLOR_MODES, default: "bw" },
    logoUrl: { type: String, default: "" },
    logoWidthPct: { type: Number, default: 55 },
    logoThreshold: { type: Number, default: 128 },
    logoRaster: {
      type: new Schema({ width: Number, height: Number, data: String }, { _id: false }),
      default: null,
    },
    blocks: { type: [blockSchema], default: [] },
    charsPerLine: { type: Number, default: null },
    feedLines: { type: Number, default: 3 },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true },
);
templateSchema.plugin(tenantScope);
templateSchema.index({ brandId: 1, outletId: 1, docType: 1 });

export const PrintTemplateModel                          =
  (models.PrintTemplate                                       ) ??
  model                  ("PrintTemplate", templateSchema);

/* -------------------------------------------------------------------- jobs */

                               
           
              
                 
                                                                               
              
              
 

                              
              
                  
                   
                    
                                                                                   
                      
                        
                      
                        
                         
                         
                             
                                                                              
                                                                          
            
                 
                 
                                                                 
                    
                                   
    
                 
                       
                      
                           
                           
                             
                                                                 
                         
                     
                           
                             
                                                                   
                           
                         
                         
                  
                  
 

const attemptSchema = new Schema              (
  { at: Date, ok: Boolean, error: String, ms: Number, by: String },
  { _id: false },
);

const jobSchema = new Schema             (
  {
    printerId: { type: String, required: true, index: true },
    printerName: { type: String, default: "" },
    station: { type: String, enum: PRINT_STATIONS, required: true },
    target: { type: String, enum: PRINT_TARGETS, required: true, index: true },
    docType: { type: String, enum: PRINT_DOCS, required: true },
    status: { type: String, enum: PRINT_JOB_STATUSES, default: "queued", index: true },
    orderId: { type: String, default: null, index: true },
    orderNumber: { type: String, default: null },
    payload: {
      text: { type: String, default: "" },
      html: { type: String, default: "" },
      escpos: { type: String },
      meta: { type: Schema.Types.Mixed },
    },
    copies: { type: Number, default: 1 },
    attemptCount: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: DEFAULT_MAX_ATTEMPTS },
    attempts: { type: [attemptSchema], default: [] },
    lastError: { type: String, default: null },
    nextAttemptAt: { type: Date, default: () => new Date(), index: true },
    idempotencyKey: { type: String, required: true },
    isReprint: { type: Boolean, default: false },
    reprintOf: { type: String, default: null },
    requestedBy: { type: String, default: null },
    claimedBy: { type: String, default: null },
    claimedAt: { type: Date, default: null },
    printedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
jobSchema.plugin(tenantScope);
jobSchema.index({ brandId: 1, outletId: 1, createdAt: -1 });
// The auto-print guard: one order fires one job per printer per trigger, even if
// the status webhook is delivered twice.
jobSchema.index({ brandId: 1, idempotencyKey: 1 }, { unique: true });
// The dispatcher's hot path.
jobSchema.index({ status: 1, nextAttemptAt: 1 });

export const PrintJobModel                     =
  (models.PrintJob                                  ) ?? model             ("PrintJob", jobSchema);

/** Live documents — these have `.save()`, unlike the plain `*Doc` shapes. */
                                                           
                                                             
                                                                       
