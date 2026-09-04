import mongoose, { type Model } from "mongoose";
import {
  SESSION_STATUSES,
  TABLE_STATUSES,
  type SessionStatus,
  type TableStatus,
} from "@onetap/config-schema";
import { tenantScope } from "../tenant-scope";

const { Schema, model, models } = mongoose;

export interface TableDoc {
  _id: string;
  brandId: string;
  outletId: string;
  number: string;
  zone: string;
  seats: number;
  status: TableStatus;
  isActive: boolean;
  activeSessionId?: string | null;
  /** rotated to invalidate every printed QR for this table */
  qrSecret: string;
  createdAt: Date;
  updatedAt: Date;
}

const tableSchema = new Schema<TableDoc>(
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

export const TableModel: Model<TableDoc> =
  (models.Table as Model<TableDoc> | undefined) ?? model<TableDoc>("Table", tableSchema);

/* ---------------------------------------------------------------- sessions */

/**
 * One party's stay at a table. Orders attach to the session, not the table, so
 * moving a party to another table carries the whole running tab with it.
 */
export interface TableSessionDoc {
  _id: string;
  brandId: string;
  outletId: string;
  tableId: string;
  customerId: string;
  status: SessionStatus;
  /** every table this session has occupied, oldest first — the move audit trail */
  tableHistory: { tableId: string; number: string; at: Date; by?: string }[];
  openedAt: Date;
  closedAt?: Date;
  closedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const sessionSchema = new Schema<TableSessionDoc>(
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

export const TableSessionModel: Model<TableSessionDoc> =
  (models.TableSession as Model<TableSessionDoc> | undefined) ??
  model<TableSessionDoc>("TableSession", sessionSchema);
