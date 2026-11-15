import { Router } from "express";
import { z } from "zod";
import { cartSchema, couponInputSchema, orderChannelSchema } from "@onetap/config-schema";
import { outletBrand } from "../outlets/outlet-cache.js";
import { requireOutletContext } from "../../middleware/auth.js";
import { requireFeature } from "../platform/plan.service.js";
import { HttpError } from "../../middleware/error.js";
import { currentCustomer } from "../customer/customer.routes.js";
import { quote } from "../orders/orders.service.js";
import {
  checkCoupon,
  createCoupon,
  deleteCoupon,
  listCoupons,
  publicCoupons,
  updateCoupon,
} from "./coupons.service.js";

export const couponsRouter         = Router();

async function publicContext(outletId        )                         {
  const ref = await outletBrand(outletId);
  if (!ref) throw new HttpError(404, "Outlet not found");
  return { brandId: ref.brandId, outletId: ref.outletId };
}

/* -------------------------------------------------------------------- admin */

couponsRouter.get("/", async (req, res) => {
  const ctx = await requireOutletContext(req, "coupon:read");
  res.json({ coupons: await listCoupons(ctx) });
});

couponsRouter.post("/", async (req, res) => {
  const ctx = await requireOutletContext(req, "coupon:manage");
  await requireFeature(ctx.brandId, "coupons", "Coupons");
  const body = couponInputSchema.parse(req.body);
  res.status(201).json({ coupon: await createCoupon(ctx, body) });
});

couponsRouter.patch("/:id", async (req, res) => {
  const ctx = await requireOutletContext(req, "coupon:manage");
  await requireFeature(ctx.brandId, "coupons", "Coupons");
  const body = couponInputSchema.partial().parse(req.body);
  res.json({ coupon: await updateCoupon(ctx, req.params.id, body) });
});

couponsRouter.delete("/:id", async (req, res) => {
  const ctx = await requireOutletContext(req, "coupon:manage");
  await requireFeature(ctx.brandId, "coupons", "Coupons");
  await deleteCoupon(ctx, req.params.id);
  res.status(204).end();
});

/* ----------------------------------------------------------------- customer */

/** Offers the storefront can advertise — active, in-window, not fully claimed. */
couponsRouter.get("/public", async (req, res) => {
  const outletId = typeof req.query.outletId === "string" ? req.query.outletId : "";
  if (!outletId) throw new HttpError(400, "outletId is required");
  const ctx = await publicContext(outletId);
  res.json({ coupons: await publicCoupons(ctx) });
});

const applyBody = z.object({
  outletId: z.string().min(1),
  code: z.string().min(1).max(24),
  cart: cartSchema,
  channel: orderChannelSchema.default("takeaway"),
});

/**
 * Preview a coupon against a real cart.
 *
 * Re-prices the cart with and without the coupon so the storefront can show the
 * exact discount and the new total, using the same engine order placement uses.
 */
couponsRouter.post("/apply", async (req, res) => {
  const body = applyBody.parse(req.body);
  const ctx = await publicContext(body.outletId);
  const customer = await currentCustomer(req);

  const bare = await quote(ctx, { lines: body.cart.lines });
  const check = await checkCoupon({
    ctx,
    code: body.code,
    subtotal: bare.totals.subtotal,
    channel: body.channel,
    customerId: customer ? String(customer._id) : null,
  });

  if (!check.ok) {
    res.json({ ok: false, reason: check.reason, totals: bare.totals });
    return;
  }

  const priced = await quote(ctx, { lines: body.cart.lines, couponCode: check.code }, { channel: body.channel });
  res.json({
    ok: true,
    code: check.code,
    discount: priced.totals.discount,
    totals: priced.totals,
  });
});
