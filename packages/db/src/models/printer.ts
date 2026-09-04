import mongoose, { type HydratedDocument, type Model } from "mongoose";
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
  type BlockConfig,
  type ColorMode,
  type PaperWidth,
  type PrintDocType,
  type PrinterConnection,
  type PrintJobStatus,
  type PrintStation,
  type PrintTarget,
} from "@onetap/config-schema";
import { tenantScope } from "../tenant-scope";

const { Schema, model, models } = mongoose;

/* ---------------------------------------------------------------- printers */

export interface PrinterDoc {
  _id: string;
  brandId: string;
  outletId: string;
  name: string;
  station: PrintStation;
  docType: PrintDocType;
  target: PrintTarget;
  paperWidth: PaperWidth;
  templateId: string | null;
  connection: PrinterConnection;
  autoPrintOn: string[];
  channels: string[];
  copies: number;
  cutAfter: boolean;
  openDrawer: boolean;
  isActive: boolean;
  lastOkAt: Date | null;
  lastErrorAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

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

const printerSchema = new Schema<PrinterDoc>(
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

export const PrinterModel: Model<PrinterDoc> =
  (models.Printer as Model<PrinterDoc> | undefined) ?? model<PrinterDoc>("Printer", printerSchema);

/* --------------------------------------------------------------- templates */

export interface PrintTemplateDoc {
  _id: string;
  brandId: string;
  outletId: string;
  name: string;
  docType: PrintDocType;
  paperWidth: PaperWidth;
  colorMode: ColorMode;
  logoUrl: string;
  logoWidthPct: number;
  logoThreshold: number;
  logoRaster: { width: number; height: number; data: string } | null;
  blocks: BlockConfig[];
  charsPerLine: number | null;
  feedLines: number;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

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

const templateSchema = new Schema<PrintTemplateDoc>(
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

export const PrintTemplateModel: Model<PrintTemplateDoc> =
  (models.PrintTemplate as Model<PrintTemplateDoc> | undefined) ??
  model<PrintTemplateDoc>("PrintTemplate", templateSchema);

/* -------------------------------------------------------------------- jobs */

export interface PrintAttempt {
  at: Date;
  ok: boolean;
  error?: string;
  /** how long the adapter took, for spotting a printer that is slowly dying */
  ms?: number;
  by?: string;
}

export interface PrintJobDoc {
  _id: string;
  brandId: string;
  outletId: string;
  printerId: string;
  /** denormalised so the queue still reads correctly after a printer is deleted */
  printerName: string;
  station: PrintStation;
  target: PrintTarget;
  docType: PrintDocType;
  status: PrintJobStatus;
  orderId: string | null;
  orderNumber: string | null;
  /** the fully rendered document — a job must print the same thing on a retry
   *  three hours later, even if the menu or the template changed since */
  payload: {
    text: string;
    html: string;
    /** base64 ESC/POS bytes, present only for thermal targets */
    escpos?: string;
    meta?: Record<string, unknown>;
  };
  copies: number;
  attemptCount: number;
  maxAttempts: number;
  attempts: PrintAttempt[];
  lastError: string | null;
  nextAttemptAt: Date | null;
  /** stops the same order double-printing on the same printer */
  idempotencyKey: string;
  isReprint: boolean;
  reprintOf: string | null;
  requestedBy: string | null;
  /** which agent/browser has this job in flight, and since when */
  claimedBy: string | null;
  claimedAt: Date | null;
  printedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const attemptSchema = new Schema<PrintAttempt>(
  { at: Date, ok: Boolean, error: String, ms: Number, by: String },
  { _id: false },
);

const jobSchema = new Schema<PrintJobDoc>(
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

export const PrintJobModel: Model<PrintJobDoc> =
  (models.PrintJob as Model<PrintJobDoc> | undefined) ?? model<PrintJobDoc>("PrintJob", jobSchema);

/** Live documents — these have `.save()`, unlike the plain `*Doc` shapes. */
export type PrinterDocument = HydratedDocument<PrinterDoc>;
export type PrintJobDocument = HydratedDocument<PrintJobDoc>;
export type PrintTemplateDocument = HydratedDocument<PrintTemplateDoc>;
