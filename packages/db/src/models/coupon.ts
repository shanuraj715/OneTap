import mongoose, { type HydratedDocument, type Model } from "mongoose";
import { DISCOUNT_TYPES, type DiscountType } from "@onetap/config-schema";
import { tenantScope } from "../tenant-scope";

const { Schema, model, models } = mongoose;

/* ---------------------------------------------------------------- coupons */

export interface CouponDoc {
  _id: string;
  brandId: string;
  outletId: string;
  /** uppercase, unique per outlet */
  code: string;
  description: string;
  discountType: DiscountType;
  value: number;
  maxDiscount: number;
  minOrderValue: number;
  validFrom: string;
  validUntil: string;
  maxRedemptions: number;
  maxPerCustomer: number;
  newCustomersOnly: boolean;
  channels: string[];
  active: boolean;
  /** total successful redemptions — incremented atomically on order placement */
  redemptionCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const couponSchema = new Schema<CouponDoc>(
  {
    code: { type: String, required: true, uppercase: true, trim: true },
    description: { type: String, default: "" },
    discountType: { type: String, enum: DISCOUNT_TYPES, required: true },
    value: { type: Number, required: true, min: 1 },
    maxDiscount: { type: Number, default: 0 },
    minOrderValue: { type: Number, default: 0 },
    validFrom: { type: String, default: "" },
    validUntil: { type: String, default: "" },
    maxRedemptions: { type: Number, default: 0 },
    maxPerCustomer: { type: Number, default: 1 },
    newCustomersOnly: { type: Boolean, default: false },
    channels: { type: [String], default: [] },
    active: { type: Boolean, default: true, index: true },
    redemptionCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);
couponSchema.plugin(tenantScope);
couponSchema.index({ brandId: 1, outletId: 1, code: 1 }, { unique: true });

export const CouponModel: Model<CouponDoc> =
  (models.Coupon as Model<CouponDoc> | undefined) ?? model<CouponDoc>("Coupon", couponSchema);

export type CouponDocument = HydratedDocument<CouponDoc>;

/* ------------------------------------------------------------- redemptions */

/**
 * One row per coupon actually applied to an order. Used to count a customer's
 * usage of a coupon, and — via the unique (couponId, orderId) index — to make
 * recording a redemption idempotent if order placement is retried.
 */
export interface CouponRedemptionDoc {
  _id: string;
  brandId: string;
  outletId: string;
  couponId: string;
  code: string;
  customerId: string | null;
  orderId: string;
  orderNumber: string;
  discount: number;
  createdAt: Date;
}

const redemptionSchema = new Schema<CouponRedemptionDoc>(
  {
    couponId: { type: String, required: true, index: true },
    code: { type: String, required: true },
    customerId: { type: String, default: null, index: true },
    orderId: { type: String, required: true },
    orderNumber: { type: String, default: "" },
    discount: { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
redemptionSchema.plugin(tenantScope);
redemptionSchema.index({ couponId: 1, orderId: 1 }, { unique: true });
redemptionSchema.index({ brandId: 1, couponId: 1, customerId: 1 });

export const CouponRedemptionModel: Model<CouponRedemptionDoc> =
  (models.CouponRedemption as Model<CouponRedemptionDoc> | undefined) ??
  model<CouponRedemptionDoc>("CouponRedemption", redemptionSchema);
