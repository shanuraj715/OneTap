import mongoose from "mongoose";
import {
  GATEWAYS,
  ORDER_CHANNELS,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  PLACED_BY_VALUES,
} from "@onetap/config-schema";
import { tenantScope } from "../tenant-scope.js";

const { Schema, model, models } = mongoose;

const orderSchema = new Schema(
  {
    orderNumber: { type: String, required: true },
    // The `YYYYMMDD` the number was issued on — the counter that produces
    // `orderNumber` resets every day, so uniqueness has to be scoped to the
    // same day it counts within, or two orders on different days eventually
    // land on the same number and collide (see the index below).
    orderDay: { type: String, required: true },
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
    // a pre-order: the pickup time the customer chose (null = as soon as possible)
    scheduledFor: { type: Date, default: null, index: true },
    // a delivery order's rider, as they were when it was handed over (the rider list can change later)
    rider: {
      type: new Schema(
        { riderId: String, name: String, phone: String, assignedAt: Date, assignedBy: String },
        { _id: false },
      ),
      default: undefined,
    },
    // counted stock this order took off the menu (given back if it is cancelled, deleted or never paid for)
    stockHold: {
      type: new Schema({ held: Boolean, lines: [new Schema({ itemId: String, quantity: Number }, { _id: false })] }, { _id: false }),
      default: undefined,
    },
    note: String,
    // A deleted order is kept (so nothing is lost for good) but hidden from every read and write: see hideDeleted below.
    deletedAt: { type: Date },
    deletedBy: { type: String },
    deletedByName: { type: String },
    // The CUSTOMER removed this order from their own Account page. Only their list changes — the store still sees
    // the order everywhere (the orders list, reports, the table's tab), which is why this is not part of hideDeleted.
    customerHiddenAt: { type: Date },
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

/**
 * "Deleting" an order marks it (deletedAt) and every query through this model then skips it — the orders list, the
 * reports, a customer's history, a table's tab, the marketing audience — without each of them having to remember to.
 * The few places that really do need every order (wiping a whole store) say so with `{ includeDeleted: true }`.
 */
const hideDeleted = function () {
  if (this.getOptions().includeDeleted) return;
  this.where({ deletedAt: null }); // null matches "never set" as well as "set to null"
};
orderSchema.pre(
  ["find", "findOne", "findOneAndUpdate", "findOneAndDelete", "findOneAndReplace", "updateOne", "updateMany", "replaceOne", "deleteOne", "deleteMany", "countDocuments", "distinct"],
  hideDeleted,
);
orderSchema.pre("aggregate", function () {
  if (this.options?.includeDeleted) return;
  this.pipeline().unshift({ $match: { deletedAt: null } });
});
orderSchema.index({ brandId: 1, outletId: 1, createdAt: -1 });
// platform-wide reads over a date range (the console dashboard's revenue charts)
orderSchema.index({ createdAt: -1 });
orderSchema.index({ brandId: 1, outletId: 1, orderDay: 1, orderNumber: 1 }, { unique: true });

export const OrderModel = models.Order ?? model("Order", orderSchema);

/* ------------------------------------------------------------------ counters */

const counterSchema = new Schema({
  _id: { type: String },
  seq: { type: Number, default: 0 },
});

export const CounterModel = models.Counter ?? model("Counter", counterSchema);

/**
 * Atomic, gap-free sequence. Used for daily order numbers now and for GST
 * invoice numbers later, where gapless numbering is a legal requirement.
 */
export async function nextSequence(key) {
  const doc = await CounterModel.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  ).lean();
  return doc?.seq ?? 1;
}
