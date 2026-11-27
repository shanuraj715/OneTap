import mongoose from "mongoose";
import { RESERVATION_PAYMENT_STATUSES, RESERVATION_STATUSES } from "@rasoipulse/config-schema";
import { tenantScope } from "../tenant-scope.js";

const { Schema, model, models } = mongoose;

/* ------------------------------------------------------------------ riders */

/** A delivery rider of one outlet. Orders keep a copy of the rider they went out with, so editing one here never rewrites history. */
const riderSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: "", trim: true },
    isActive: { type: Boolean, default: true },
    // The rider app's sign-in (phone + a 4–6 digit PIN the manager sets). `pinHash` is a salted scrypt hash, never the PIN;
    // `loginPhone` = the last 10 digits of the phone, the name the rider signs in with (only set while the app login is on);
    // `pinVersion` goes up whenever the PIN is set again or the login is switched off, which ends every sign-in made before.
    pinHash: { type: String, default: "", select: false },
    // The same PIN, locked with the server's key (AES-256-GCM, like the payment secrets), so the manager who set it can look it up again and
    // tell it to the rider once more. It is the only way a PIN can be shown later; a PIN set before this field existed has none ("" = can't be
    // shown: set a new PIN). Never returned by any list, only by the manager's own "Show PIN" call.
    pinEnc: { type: String, default: "", select: false },
    loginPhone: { type: String, default: "", index: true },
    pinVersion: { type: Number, default: 0 },
    pinSetAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
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
      /** where the restaurant updates the guest (10 digits); empty = use `phone` */
      whatsapp: { type: String, default: "" },
    },
    /** what the booking is for — "Birthday", or whatever the guest typed after choosing "Other" */
    event: { type: String, default: "" },
    /** what it costs, fixed when it was booked: rate per person per hour, minutes, the amount, the half paid online and the half paid at the restaurant (all paise) */
    pricing: {
      ratePaise: { type: Number, default: 0 },
      minutes: { type: Number, default: 0 },
      /** the price of the stay before a coupon, the coupon used and what it took off; `amountPaise` is what is left to pay */
      grossPaise: { type: Number, default: 0 },
      discountPaise: { type: Number, default: 0 },
      couponCode: { type: String, default: "" },
      amountPaise: { type: Number, default: 0 },
      prepayPaise: { type: Number, default: 0 },
      remainingPaise: { type: Number, default: 0 },
    },
    /** the advance: none (nothing to pay), pending (waiting for the guest to pay — the seats are held a few minutes), paid, refund_due (it was paid and the booking won't happen) or refunded */
    payment: {
      status: { type: String, enum: RESERVATION_PAYMENT_STATUSES, default: "none" },
      paymentId: { type: String, default: "" },
      paidAt: { type: Date, default: null },
      refundedAt: { type: Date, default: null },
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
// the sweep that lets go of bookings whose advance was never paid
reservationSchema.index({ "payment.status": 1, createdAt: 1 });

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
