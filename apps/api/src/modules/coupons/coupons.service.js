import {
  couponInputSchema,
  couponSchema,
  evaluateCoupon,
              
                     
                   
                    
} from "@onetap/config-schema";
import {
  CouponModel,
  CouponRedemptionModel,
  OrderModel,
  tenantFilter,
                 
                     
} from "@onetap/db";
import { HttpError } from "../../middleware/error.js";

/* ------------------------------------------------------------------ shaping */

export function shapeCoupon(d           )         {
  return couponSchema.parse({
    id: String(d._id),
    code: d.code,
    description: d.description,
    discountType: d.discountType,
    value: d.value,
    maxDiscount: d.maxDiscount,
    minOrderValue: d.minOrderValue,
    validFrom: d.validFrom,
    validUntil: d.validUntil,
    maxRedemptions: d.maxRedemptions,
    maxPerCustomer: d.maxPerCustomer,
    newCustomersOnly: d.newCustomersOnly,
    channels: d.channels,
    active: d.active,
    redemptionCount: d.redemptionCount,
  });
}

/* -------------------------------------------------------------------- admin */

export async function listCoupons(ctx               )                    {
  const docs = await CouponModel.find(tenantFilter(ctx)).sort({ active: -1, createdAt: -1 });
  return docs.map((d) => shapeCoupon(d));
}

export async function createCoupon(ctx               , input             )                  {
  const parsed = couponInputSchema.parse(input);
  validateCouponShape(parsed);

  const dupe = await CouponModel.findOne(tenantFilter(ctx, { code: parsed.code }));
  if (dupe) throw new HttpError(409, `A coupon with code ${parsed.code} already exists`);

  const doc = await CouponModel.create({ brandId: ctx.brandId, outletId: ctx.outletId, ...parsed });
  return shapeCoupon(doc);
}

export async function updateCoupon(ctx               , id        , patch                      )                  {
  const doc = await CouponModel.findOne(tenantFilter(ctx, { _id: id }));
  if (!doc) throw new HttpError(404, "Coupon not found");

  const merged = couponInputSchema.parse({ ...shapeCoupon(doc), ...patch });
  validateCouponShape(merged);

  if (merged.code !== doc.code) {
    const dupe = await CouponModel.findOne(tenantFilter(ctx, { code: merged.code }));
    if (dupe) throw new HttpError(409, `A coupon with code ${merged.code} already exists`);
  }

  Object.assign(doc, merged);
  await doc.save();
  return shapeCoupon(doc);
}

export async function deleteCoupon(ctx               , id        )                {
  const redeemed = await CouponRedemptionModel.countDocuments(tenantFilter(ctx, { couponId: id }));
  const doc = await CouponModel.findOne(tenantFilter(ctx, { _id: id }));
  if (!doc) throw new HttpError(404, "Coupon not found");

  // A coupon that's been used is part of the order history — deactivate rather
  // than delete, so the redemption rows still resolve to something.
  if (redeemed > 0) {
    doc.active = false;
    await doc.save();
    throw new HttpError(409, `This coupon has been used ${redeemed} time(s), so it was deactivated instead of deleted.`);
  }
  await CouponModel.deleteOne(tenantFilter(ctx, { _id: id }));
}

function validateCouponShape(c             )       {
  if (c.discountType === "percent" && c.value > 100) {
    throw new HttpError(400, "A percentage discount can't be more than 100%.");
  }
  if (c.validFrom && c.validUntil && Date.parse(c.validFrom) > Date.parse(c.validUntil)) {
    throw new HttpError(400, "The 'valid from' date is after the 'valid until' date.");
  }
}

/* ---------------------------------------------------------------- customer */

;                                  
                     
               
                   
                   
                             
 

;                                                  
               
 

/**
 * The authoritative "does this coupon apply to this cart" check.
 *
 * Loads the coupon, counts how many times this customer has already used it and
 * how many orders they've completed, then runs the same pure `evaluateCoupon`
 * the storefront uses to preview. This is the answer that gets written to the
 * order.
 */
export async function checkCoupon(input                  )                       {
  const { ctx, subtotal, channel, customerId } = input;
  const code = input.code.trim().toUpperCase();

  const doc = await CouponModel.findOne(tenantFilter(ctx, { code }));
  if (!doc) return { ok: false, discount: 0, code, reason: "That coupon code isn't recognised." };

  const context                = { subtotal, channel };

  if (customerId) {
    const [customerRedemptions, completedOrders] = await Promise.all([
      CouponRedemptionModel.countDocuments(tenantFilter(ctx, { couponId: String(doc._id), customerId })),
      OrderModel.countDocuments(
        tenantFilter(ctx, {
          "customer.customerId": customerId,
          status: { $ne: "cancelled" },
        }),
      ),
    ]);
    context.customerRedemptions = customerRedemptions;
    context.customerOrderCount = completedOrders;
  }
  // With no customerId (the pre-verification preview, or a staff counter order)
  // the per-customer and first-order rules can't be checked here — they're
  // enforced at placement, which always has a verified customer. The preview
  // shows the discount optimistically rather than a confusing "sign in" wall.

  const result = evaluateCoupon(shapeCoupon(doc), context);
  return { ...result, code };
}

/**
 * Record that a coupon was applied to an order, and bump its running count.
 *
 * Idempotent: the unique (couponId, orderId) index means a retried order
 * placement records the redemption once. The count is only incremented when the
 * redemption row is actually new.
 */
export async function recordRedemption(input   
                     
               
                  
                      
                             
                   
 )                {
  const { ctx, orderId, orderNumber, customerId, discount } = input;
  const code = input.code.trim().toUpperCase();

  const coupon = await CouponModel.findOne(tenantFilter(ctx, { code }));
  if (!coupon) return;

  try {
    await CouponRedemptionModel.create({
      brandId: ctx.brandId,
      outletId: ctx.outletId,
      couponId: String(coupon._id),
      code,
      customerId: customerId ?? null,
      orderId,
      orderNumber,
      discount,
    });
    await CouponModel.updateOne(tenantFilter(ctx, { _id: String(coupon._id) }), { $inc: { redemptionCount: 1 } });
  } catch (e) {
    // 11000 = the redemption for this order already exists. Not an error.
    if ((e                     ).code !== 11000) throw e;
  }
}

/** Coupons a customer could plausibly use, for the "available offers" list. */
export async function publicCoupons(ctx               )                    {
  const now = Date.now();
  const docs = await CouponModel.find(tenantFilter(ctx, { active: true }));
  return docs
    .map((d) => shapeCoupon(d))
    .filter((c) => {
      if (c.validFrom && now < Date.parse(c.validFrom)) return false;
      if (c.validUntil && now > Date.parse(c.validUntil)) return false;
      if (c.maxRedemptions > 0 && c.redemptionCount >= c.maxRedemptions) return false;
      return true;
    });
}
