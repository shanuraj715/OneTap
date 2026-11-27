import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

/**
 * What a store paid Rasoi Pulse for its subscription — Rasoi Pulse's OWN sales (not the orders a store takes from its customers).
 * There is no billing inside the app: the store pays outside (bank, UPI, cash) and the platform team writes the payment down, so this
 * list is a hand-kept ledger. Platform-level, not tenant-scoped.
 *
 * Whether a payment is a NEW sale or a RE-SUBSCRIPTION is not stored: the first payment of a store (by the day it was paid) is the new
 * sale, every later one is a re-subscription. Working it out when it is read keeps it right when a payment is added late or deleted.
 *
 * The store is named `storeId`, NOT `brandId`, on purpose: deleting a store removes every collection whose `brandId` is required, and a
 * payment is the product's revenue history, which must outlive the store. `storeName` is a copy of the name at the time, for the same reason.
 *
 * Money is whole paise (÷100 for rupees) so sums are exact; the API speaks rupees.
 */
const subscriptionPaymentSchema = new Schema(
  {
    storeId: { type: Schema.Types.ObjectId, required: true, index: true },
    storeName: { type: String, required: true, trim: true },
    planId: { type: Schema.Types.ObjectId, default: null },
    planName: { type: String, default: "", trim: true },
    amountPaise: { type: Number, required: true, min: 1 },
    /** how many months of service this payment bought (a yearly payment is 12) */
    months: { type: Number, required: true, min: 1, max: 60 },
    /** the day the money arrived (the start of that day in India) */
    paidOn: { type: Date, required: true, index: true },
    note: { type: String, default: "", trim: true },
    recordedById: { type: String, default: "" },
    recordedByName: { type: String, default: "" },
  },
  { timestamps: true },
);

subscriptionPaymentSchema.index({ storeId: 1, paidOn: 1 });

export const SubscriptionPaymentModel = models.SubscriptionPayment ?? model("SubscriptionPayment", subscriptionPaymentSchema);
