import mongoose from "mongoose";
import { RESERVATION_STATUSES } from "@onetap/config-schema";
import { tenantScope } from "../tenant-scope.js";

const { Schema, model, models } = mongoose;

/* ------------------------------------------------------------------ riders */

/** A delivery rider of one outlet. Orders keep a copy of the rider they went out with, so editing one here never rewrites history. */
const riderSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: "", trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);
riderSchema.plugin(tenantScope);
riderSchema.index({ brandId: 1, outletId: 1, name: 1 });

export const RiderModel = models.Rider ?? model("Rider", riderSchema);

/* ------------------------------------------------------------ reservations */

const reservationSchema = new Schema(
  {
    /** short number the guest and the team can say out loud — "B-0042", counting up per outlet */
    code: { type: String, required: true },
    status: { type: String, enum: RESERVATION_STATUSES, default: "requested", index: true },
    /** when the booking starts, and when its seats are free again */
    at: { type: Date, required: true, index: true },
    endsAt: { type: Date, required: true },
    partySize: { type: Number, required: true, min: 1 },
    customer: {
      customerId: { type: String, default: null, index: true },
      name: { type: String, default: "" },
      phone: { type: String, default: "" },
    },
    /** what the guest asked for ("birthday, window seat") */
    note: { type: String, default: "" },
    /** the team's own note */
    staffNote: { type: String, default: "" },
    /** the table they were given, once seated (or set ahead) */
    tableId: { type: String, default: null },
    tableNumber: { type: String, default: "" },
    /** "customer" (the storefront) or "staff" (taken over the phone) */
    source: { type: String, enum: ["customer", "staff"], default: "customer" },
    history: {
      type: [new Schema({ status: String, at: Date, by: String, reason: String }, { _id: false })],
      default: [],
    },
  },
  { timestamps: true },
);
reservationSchema.plugin(tenantScope);
reservationSchema.index({ brandId: 1, outletId: 1, at: 1 });
reservationSchema.index({ brandId: 1, outletId: 1, code: 1 }, { unique: true });

export const ReservationModel = models.Reservation ?? model("Reservation", reservationSchema);

/* ---------------------------------------------------------------- feedback */

/** A customer's rating of one order (one per order — rating again changes it). */
const feedbackSchema = new Schema(
  {
    orderId: { type: String, required: true },
    orderNumber: { type: String, default: "" },
    channel: { type: String, default: "" },
    customerId: { type: String, required: true, index: true },
    customerName: { type: String, default: "" },
    customerPhone: { type: String, default: "" },
    rating: { type: Number, required: true, min: 1, max: 5, index: true },
    comment: { type: String, default: "" },
    tags: { type: [String], default: [] },
    /** what was ordered, for reading the comment in context */
    items: { type: [String], default: [] },
    orderTotal: { type: Number, default: 0 },
  },
  { timestamps: true },
);
feedbackSchema.plugin(tenantScope);
feedbackSchema.index({ brandId: 1, orderId: 1 }, { unique: true });
feedbackSchema.index({ brandId: 1, outletId: 1, createdAt: -1 });

export const FeedbackModel = models.Feedback ?? model("Feedback", feedbackSchema);

/* ---------------------------------------------------------------- carts */

/**
 * What a signed-in customer has in their cart at one outlet — kept only so a forgotten cart can be reminded about
 * (abandoned-cart reminders). The storefront's own cart still lives in the browser; this is a copy it sends.
 */
const cartSchema = new Schema(
  {
    customerId: { type: String, required: true },
    phone: { type: String, default: "" },
    name: { type: String, default: "" },
    /** the cart's lines as the storefront has them ({ itemId, variantId, modifierOptionIds, quantity }) plus names */
    lines: { type: Schema.Types.Mixed, default: [] },
    itemCount: { type: Number, default: 0 },
    /** its value when last saved, in paise (an estimate — prices are worked out again at checkout) */
    value: { type: Number, default: 0 },
    /** when the customer last changed it */
    touchedAt: { type: Date, default: () => new Date(), index: true },
    /** "open" (waiting) · "reminded" · "ordered" (they ordered after all) · "recovered" (they ordered after the reminder) */
    status: { type: String, enum: ["open", "reminded", "ordered", "recovered"], default: "open", index: true },
    remindedAt: { type: Date, default: null },
    remindChannel: { type: String, default: "" },
    remindError: { type: String, default: "" },
    recoveredOrderId: { type: String, default: null },
    recoveredValue: { type: Number, default: 0 },
  },
  { timestamps: true },
);
cartSchema.plugin(tenantScope);
cartSchema.index({ brandId: 1, outletId: 1, customerId: 1 }, { unique: true });
cartSchema.index({ brandId: 1, customerId: 1, remindedAt: -1 });

export const CartModel = models.Cart ?? model("Cart", cartSchema);

/**
 * One reminder that went out (or failed to) — kept apart from the cart, which is reused for the customer's next cart,
 * so what reminders achieved over time (sent, won back and for how much) is never lost.
 */
const cartReminderSchema = new Schema(
  {
    cartId: { type: String, required: true },
    customerId: { type: String, required: true, index: true },
    name: { type: String, default: "" },
    phone: { type: String, default: "" },
    items: { type: String, default: "" },
    value: { type: Number, default: 0 },
    remindedAt: { type: Date, required: true, index: true },
    channel: { type: String, default: "" },
    /** "sent" · "failed" · "recovered" (they ordered within 48 hours of it) */
    status: { type: String, enum: ["sent", "failed", "recovered"], default: "sent", index: true },
    error: { type: String, default: "" },
    recoveredOrderId: { type: String, default: null },
    recoveredValue: { type: Number, default: 0 },
  },
  { timestamps: true },
);
cartReminderSchema.plugin(tenantScope);
cartReminderSchema.index({ brandId: 1, remindedAt: -1 });

export const CartReminderModel = models.CartReminder ?? model("CartReminder", cartReminderSchema);
