import { z } from "zod";

export const DISCOUNT_TYPES = ["fixed", "percent"] as const;
export const discountTypeSchema = z.enum(DISCOUNT_TYPES);
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = {
  fixed: "Flat amount off",
  percent: "Percentage off",
};

/**
 * A coupon, as stored. `code` is matched case-insensitively but kept uppercase.
 *
 * All money is integer paise. `value` is paise for a fixed discount and whole
 * percent (1–100) for a percentage one.
 */
export const couponSchema = z.object({
  id: z.string(),
  code: z
    .string()
    .min(3)
    .max(24)
    .regex(/^[A-Z0-9_-]+$/, "Letters, digits, dash and underscore only")
    .transform((s) => s.toUpperCase()),
  description: z.string().max(160).default(""),
  discountType: discountTypeSchema,
  value: z.number().int().positive(),
  /** percent coupons only — caps the rupees a big order can save; 0 = no cap */
  maxDiscount: z.number().int().min(0).default(0),
  /** the cart's item total (pre-tax gross) must reach this before the coupon works */
  minOrderValue: z.number().int().min(0).default(0),
  /** ISO strings; empty = no bound on that side */
  validFrom: z.string().default(""),
  validUntil: z.string().default(""),
  /** total redemptions allowed across all customers; 0 = unlimited */
  maxRedemptions: z.number().int().min(0).default(0),
  /** redemptions allowed per customer; 0 = unlimited */
  maxPerCustomer: z.number().int().min(0).default(1),
  /** only a customer who has never completed an order before */
  newCustomersOnly: z.boolean().default(false),
  /** order channels the coupon applies to; empty = all */
  channels: z.array(z.string()).default([]),
  active: z.boolean().default(true),
  /** running total, maintained by the server on each redemption */
  redemptionCount: z.number().int().min(0).default(0),
});
export type Coupon = z.infer<typeof couponSchema>;

/** What the admin form submits. `redemptionCount` and `id` are server-owned. */
export const couponInputSchema = couponSchema
  .omit({ id: true, redemptionCount: true })
  .partial()
  .extend({
    code: couponSchema.shape.code,
    discountType: discountTypeSchema,
    value: z.number().int().positive(),
  });
export type CouponInput = z.infer<typeof couponInputSchema>;

/* --------------------------------------------------------------- evaluation */

export interface CouponContext {
  /** the cart's gross item total in paise — what min-order is checked against */
  subtotal: number;
  /** completed orders this customer has already placed; undefined = unknown */
  customerOrderCount?: number;
  /** how many times THIS customer has already redeemed THIS coupon */
  customerRedemptions?: number;
  channel?: string;
  now?: number;
}

export interface CouponResult {
  ok: boolean;
  /** discount in paise, always ≤ subtotal */
  discount: number;
  reason?: string;
}

/**
 * The single source of truth for whether a coupon applies and what it's worth.
 *
 * Pure and side-effect-free so the same function runs on the storefront (to
 * preview the discount) and on the server (to actually apply it) — the server's
 * answer is the one that counts, but they never disagree.
 */
export function evaluateCoupon(coupon: Coupon, ctx: CouponContext): CouponResult {
  const now = ctx.now ?? Date.now();
  const deny = (reason: string): CouponResult => ({ ok: false, discount: 0, reason });

  if (!coupon.active) return deny("This coupon is no longer active.");

  if (coupon.validFrom && now < Date.parse(coupon.validFrom)) {
    return deny("This coupon isn't valid yet.");
  }
  if (coupon.validUntil && now > Date.parse(coupon.validUntil)) {
    return deny("This coupon has expired.");
  }

  if (coupon.maxRedemptions > 0 && coupon.redemptionCount >= coupon.maxRedemptions) {
    return deny("This coupon has been fully claimed.");
  }

  if (
    coupon.maxPerCustomer > 0 &&
    ctx.customerRedemptions !== undefined &&
    ctx.customerRedemptions >= coupon.maxPerCustomer
  ) {
    return deny(
      coupon.maxPerCustomer === 1
        ? "You've already used this coupon."
        : `You've used this coupon the maximum ${coupon.maxPerCustomer} times.`,
    );
  }

  if (coupon.newCustomersOnly && (ctx.customerOrderCount ?? 0) > 0) {
    return deny("This coupon is for first orders only.");
  }

  if (coupon.channels.length && ctx.channel && !coupon.channels.includes(ctx.channel)) {
    return deny("This coupon can't be used for this kind of order.");
  }

  if (ctx.subtotal < coupon.minOrderValue) {
    const short = (coupon.minOrderValue - ctx.subtotal) / 100;
    return deny(`Add ₹${short.toFixed(0)} more to use this coupon (minimum order ₹${(coupon.minOrderValue / 100).toFixed(0)}).`);
  }

  let discount: number;
  if (coupon.discountType === "fixed") {
    discount = coupon.value;
  } else {
    discount = Math.round((ctx.subtotal * coupon.value) / 100);
    if (coupon.maxDiscount > 0) discount = Math.min(discount, coupon.maxDiscount);
  }

  // A discount can bring an order to zero but never negative.
  discount = Math.max(0, Math.min(discount, ctx.subtotal));
  if (discount === 0) return deny("This coupon doesn't reduce this order.");

  return { ok: true, discount };
}

/** Short human summary for a coupon chip — "20% off, up to ₹100". */
export function couponSummary(c: Pick<Coupon, "discountType" | "value" | "maxDiscount" | "minOrderValue">): string {
  const parts: string[] = [];
  if (c.discountType === "fixed") parts.push(`₹${(c.value / 100).toFixed(0)} off`);
  else parts.push(`${c.value}% off${c.maxDiscount ? `, up to ₹${(c.maxDiscount / 100).toFixed(0)}` : ""}`);
  if (c.minOrderValue) parts.push(`min ₹${(c.minOrderValue / 100).toFixed(0)}`);
  return parts.join(" · ");
}
