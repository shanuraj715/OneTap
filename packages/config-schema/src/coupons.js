import { z } from "zod";

export const DISCOUNT_TYPES = ["fixed", "percent", "bogo"]         ;
export const discountTypeSchema = z.enum(DISCOUNT_TYPES);


export const DISCOUNT_TYPE_LABELS                               = {
  fixed: "Flat amount off",
  percent: "Percentage off",
  bogo: "Buy X, get Y free",
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
  /* ---- "buy X, get Y free" coupons only (discountType "bogo") ---- */
  /** how many the customer pays for… */
  buyQty: z.number().int().min(1).max(10).default(1),
  /** …and how many more they get free (the cheapest ones) */
  getQty: z.number().int().min(1).max(10).default(1),
  /** the dishes it works on; both lists empty = every dish */
  itemIds: z.array(z.string()).max(200).default([]),
  /** whole categories it works on (with everything inside them) */
  categoryIds: z.array(z.string()).max(100).default([]),
  /** at most this many free dishes on one order; 0 = no cap */
  maxFreeUnits: z.number().int().min(0).max(100).default(0),
});
                                                  

/** What the admin form submits. `redemptionCount` and `id` are server-owned. */
export const couponInputSchema = couponSchema
  .omit({ id: true, redemptionCount: true })
  .partial()
  .extend({
    code: couponSchema.shape.code,
    discountType: discountTypeSchema,
    value: z.number().int().positive(),
  });
                                                            

/* --------------------------------------------------------------- evaluation */

                                
                                                                                 
                   
                                                                               
                              
                                                                      
                               
                   
               
 

                               
              
                                             
                   
                  
 

/**
 * The single source of truth for whether a coupon applies and what it's worth.
 *
 * Pure and side-effect-free so the same function runs on the storefront (to
 * preview the discount) and on the server (to actually apply it) — the server's
 * answer is the one that counts, but they never disagree.
 */
export function evaluateCoupon(coupon        , ctx               )               {
  const now = ctx.now ?? Date.now();
  const deny = (reason        )               => ({ ok: false, discount: 0, reason });

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

  let discount        ;
  if (coupon.discountType === "fixed") {
    discount = coupon.value;
  } else if (coupon.discountType === "bogo") {
    const units = ctx.eligibleUnitPrices ?? [];
    const group = coupon.buyQty + coupon.getQty;
    if (units.length < group) {
      const short = group - units.length;
      return deny(
        units.length === 0
          ? "This offer is for other dishes — add one of them to use it."
          : `Add ${short} more of the offer's dishes to get ${coupon.getQty === 1 ? "one" : coupon.getQty} free.`,
      );
    }
    discount = bogoDiscount(units, coupon);
  } else {
    discount = Math.round((ctx.subtotal * coupon.value) / 100);
    if (coupon.maxDiscount > 0) discount = Math.min(discount, coupon.maxDiscount);
  }

  // A discount can bring an order to zero but never negative.
  discount = Math.max(0, Math.min(discount, ctx.subtotal));
  if (discount === 0) return deny("This coupon doesn't reduce this order.");

  return { ok: true, discount };
}

/**
 * "Buy X, get Y free": out of every X + Y eligible dishes in the cart, the Y cheapest are free. `unitPrices` is one
 * entry per eligible dish (a line of 3 is three entries), in paise. Free dishes are capped by `maxFreeUnits`.
 */
export function bogoDiscount(unitPrices, { buyQty, getQty, maxFreeUnits = 0 }) {
  const group = buyQty + getQty;
  let free = Math.floor(unitPrices.length / group) * getQty;
  if (maxFreeUnits > 0) free = Math.min(free, maxFreeUnits);
  return [...unitPrices].sort((a, b) => a - b).slice(0, free).reduce((sum, p) => sum + p, 0);
}

/**
 * The price of every dish in a priced cart that a "buy X get Y" coupon covers — one entry per unit. A coupon with no
 * dishes and no categories chosen covers the whole menu; a chosen category covers everything inside it too.
 */
export function eligibleUnitPrices(coupon, lines, menu) {
  const itemIds = new Set(coupon.itemIds ?? []);
  const catIds = new Set(coupon.categoryIds ?? []);
  const everything = itemIds.size === 0 && catIds.size === 0;
  const itemsById = new Map((menu?.items ?? []).map((i) => [i.id, i]));
  const catsById = new Map((menu?.categories ?? []).map((c) => [c.id, c]));
  const inChosenCategory = (categoryId) => {
    for (let c = catsById.get(categoryId), guard = 0; c && guard < 12; c = c.parentId ? catsById.get(c.parentId) : null, guard += 1) {
      if (catIds.has(c.id)) return true;
    }
    return false;
  };
  const out = [];
  for (const line of lines) {
    const item = itemsById.get(line.itemId);
    const covered = everything || itemIds.has(line.itemId) || (item && inChosenCategory(item.categoryId));
    if (!covered) continue;
    for (let n = 0; n < line.quantity; n += 1) out.push(line.unitPrice);
  }
  return out;
}

/** Short human summary for a coupon chip — "20% off, up to ₹100", "Buy 1 get 1 free". */
export function couponSummary(c                                                                          )         {
  const parts           = [];
  if (c.discountType === "fixed") parts.push(`₹${(c.value / 100).toFixed(0)} off`);
  else if (c.discountType === "bogo") parts.push(`Buy ${c.buyQty ?? 1} get ${c.getQty ?? 1} free${(c.itemIds?.length || c.categoryIds?.length) ? " on chosen dishes" : ""}`);
  else parts.push(`${c.value}% off${c.maxDiscount ? `, up to ₹${(c.maxDiscount / 100).toFixed(0)}` : ""}`);
  if (c.minOrderValue) parts.push(`min ₹${(c.minOrderValue / 100).toFixed(0)}`);
  return parts.join(" · ");
}
