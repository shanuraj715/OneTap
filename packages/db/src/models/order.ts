import mongoose, { type Model } from "mongoose";
import {
  GATEWAYS,
  ORDER_CHANNELS,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  PLACED_BY_VALUES,
  type Gateway,
  type PaymentStatus,
  type OrderChannel,
  type OrderStatus,
  type OrderTotals,
  type PlacedBy,
  type PricedLine,
} from "@onetap/config-schema";
import { tenantScope } from "../tenant-scope";

const { Schema, model, models } = mongoose;

export interface OrderDoc {
  _id: string;
  brandId: string;
  outletId: string;
  /** human-facing, unique per outlet per day, e.g. "0007" */
  orderNumber: string;
  channel: OrderChannel;
  /** who actually placed it — a customer self-serving, or staff on their behalf */
  placedBy: PlacedBy;
  /** set only when placedBy is "staff" — a snapshot, so the name survives a later role change */
  staffId?: string;
  staffName?: string;
  status: OrderStatus;
  customer: { customerId?: string; name?: string; phone?: string; email?: string };
  /** immutable snapshot — menu edits must never rewrite history */
  lines: PricedLine[];
  totals: OrderTotals;
  pricesIncludeTax: boolean;
  payment: { gateway: Gateway; status: PaymentStatus; paymentId?: string };
  /** set for dine-in orders */
  tableId?: string;
  sessionId?: string;
  /** the coupon applied, if any — the discount itself is inside `totals` */
  couponCode?: string;
  /** where a delivery order goes, with the geocoded pin and distance */
  deliveryAddress?: {
    text: string;
    lat: number;
    lng: number;
    distanceKm: number;
    landmark?: string;
  };
  /** minutes quoted to the customer at checkout */
  etaMinutes?: number;
  note?: string;
  /**
   * Every state this order has been in. `manual` marks a status a human forced
   * rather than one the order flowed into, and `edited` marks an item change —
   * both matter when a refund or a missing dish is questioned later.
   */
  statusHistory: {
    status: OrderStatus;
    at: Date;
    by?: string;
    manual?: boolean;
    edited?: boolean;
    from?: OrderStatus;
    reason?: string;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const orderSchema = new Schema<OrderDoc>(
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

export const OrderModel: Model<OrderDoc> =
  (models.Order as Model<OrderDoc> | undefined) ?? model<OrderDoc>("Order", orderSchema);

/* ------------------------------------------------------------------ counters */

export interface CounterDoc {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<CounterDoc>({
  _id: { type: String },
  seq: { type: Number, default: 0 },
});

export const CounterModel: Model<CounterDoc> =
  (models.Counter as Model<CounterDoc> | undefined) ?? model<CounterDoc>("Counter", counterSchema);

/**
 * Atomic, gap-free sequence. Used for daily order numbers now and for GST
 * invoice numbers later, where gapless numbering is a legal requirement.
 */
export async function nextSequence(key: string): Promise<number> {
  const doc = await CounterModel.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  ).lean();
  return doc?.seq ?? 1;
}
