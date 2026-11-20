import { Router } from "express";
import { z } from "zod";
import { coinsValuePaise, currentAge, customerAgeSchema, customerEmailSchema, customerGenderSchema, customerNameSchema, feedbackInputSchema, isProfileComplete } from "@onetap/config-schema";
import { OutletModel } from "@onetap/db";
import { isProd } from "../../env.js";
import { HttpError } from "../../middleware/error.js";
import { assertNotBlocked, blockInfo, failed, floodLimiter } from "../security/login-guard.js";
import { effectiveOutletConfig } from "../outlets/config.service.js";
import { cartLinesById, saveCart } from "../carts/carts.service.js";
import { rateOrder } from "../feedback/feedback.service.js";
import { customerOrderHistory, hideOrderFromCustomer } from "../orders/orders.service.js";
import { reorderLines } from "../orders/reorder.service.js";
import { storePlan } from "../platform/plan.service.js";
import { completeProfile, customerFromToken, endCustomerSession, requestOtp, verifyOtp } from "./customer.service.js";
import { limiter, usesPolicy } from "../../middleware/rate-limit.js";

export const CUSTOMER_COOKIE = "onetap_customer";

export const customerRouter         = Router();

/** Public route: which outlet is this diner ordering from. */
async function outletOf(outletId        ) {
  const outlet = await OutletModel.findOne({ _id: outletId }, null, { allowGlobalQuery: true }).lean();
  if (!outlet) throw new HttpError(404, "Outlet not found");
  return outlet;
}

export async function currentCustomer(req         )                              {
  const token = (req.cookies                                      )?.[CUSTOMER_COOKIE];
  return customerFromToken(token);
}

/** The shape the storefront gets back for a customer, everywhere it's returned. */
function shapeCustomer(customer) {
  return {
    id: String(customer._id),
    name: customer.name ?? null,
    phone: customer.phone ?? null,
    email: customer.email ?? null,
    gender: customer.gender ?? null,
    age: currentAge(customer),
    walletBalance: customer.walletBalance ?? 0,
    // A session from before this feature (or backfilled for someone else) can
    // be logged in and still lack gender/age — this is what tells the
    // storefront to show the "complete your profile" step before the order
    // page, rather than the coupon/coins content that needs a full profile.
    profileComplete: isProfileComplete(customer),
  };
}

const requestBody = z.object({
  outletId: z.string().min(1),
  destination: z.string().min(3),
  /** what they typed as their name — may appear in the code message ({{name}}) when we don't already know them */
  name: z.string().max(80).optional(),
});

/**
 * Brute-force protection for the 6-digit code: sign-in requests are rate limited per address, and an address that
 * keeps guessing wrong codes is blocked for longer each time (modules/security/login-guard.js).
 */
const otpFlood = floodLimiter("otp");

/** The sign-in form asks this first, so a blocked address is shown a notice instead of the form. */
customerRouter.get("/guard", async (req, res) => {
  res.json(await blockInfo(req, "customer"));
});

customerRouter.post("/otp/request", limiter("otp-send-ip"), limiter("otp-send-store"), usesPolicy("otp-resend-number"), otpFlood, async (req, res) => {
  await assertNotBlocked(req, "customer");
  const body = requestBody.parse(req.body);
  const outlet = await outletOf(body.outletId);
  const result = await requestOtp({
    brandId: outlet.brandId,
    outletId: String(outlet._id),
    destination: body.destination,
    name: body.name,
  });
  res.json(result);
});

/**
 * `name`/`gender`/`age` arrive here even though a returning customer doesn't
 * need them — the storefront's single login/signup form sends them
 * unconditionally, since it can't know in advance whether this phone already
 * has an account. The service decides whether they're required (see
 * `requireSignupFields`); a returning customer's submitted values are simply
 * ignored in favour of what's already on file.
 */
const verifyBody = z.object({
  outletId: z.string().min(1),
  destination: z.string().min(3),
  code: z.string().min(4).max(8),
  name: customerNameSchema.optional(),
  gender: customerGenderSchema.optional(),
  age: customerAgeSchema.optional(),
  email: customerEmailSchema.optional(),
});

customerRouter.post("/otp/verify", otpFlood, async (req, res) => {
  const body = verifyBody.parse(req.body);
  await assertNotBlocked(req, "customer");
  const outlet = await outletOf(body.outletId);

  let result;
  try {
    result = await verifyOtp({
      brandId: outlet.brandId,
      destination: body.destination,
      code: body.code,
      name: body.name,
      gender: body.gender,
      age: body.age,
      email: body.email,
    });
  } catch (e) {
    // only a wrong / used-up code is a guess; "enter your name" and the like are not
    if (e instanceof HttpError && /^(That code|Too many attempts)/.test(e.message)) await failed(req, "customer", e);
    throw e;
  }

  res.cookie(CUSTOMER_COOKIE, result.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    expires: result.expiresAt,
    path: "/",
  });
  res.json({ customer: shapeCustomer(result.customer) });
});

/**
 * The Account page: the signed-in customer's own orders with this store (every outlet), and their coins if the
 * store has them switched on. Only ever the caller's own — the customer comes from their sign-in cookie, never
 * from the request — and only for the store the outlet belongs to.
 */
customerRouter.get("/orders", limiter("customer-orders"), async (req, res) => {
  const customer = await currentCustomer(req);
  if (!customer) throw new HttpError(401, "Sign in to see your orders");
  const outlet = await outletOf(typeof req.query.outletId === "string" ? req.query.outletId : "");
  if (customer.brandId !== outlet.brandId) throw new HttpError(403, "Sign in again for this restaurant");

  const before = typeof req.query.before === "string" ? new Date(req.query.before) : undefined;
  if (before && Number.isNaN(before.getTime())) throw new HttpError(400, "That isn't a valid date");
  // coins are shown only when the store has them: the plan includes the feature AND the outlet has switched them on
  const [config, plan] = await Promise.all([effectiveOutletConfig({ brandId: outlet.brandId, outletId: String(outlet._id) }), storePlan(outlet.brandId)]);
  // ratings: the plan includes them AND this outlet asks for them (effectiveOutletConfig already applies the plan)
  const feedback = config.feedback ?? { enabled: false, googleReviewUrl: "", googleMinStars: 4 };
  const history = await customerOrderHistory({ brandId: outlet.brandId, customerId: String(customer._id), before, limit: Number(req.query.limit) || 15, feedbackEnabled: Boolean(feedback.enabled) });
  const enabled = plan.entitlements.features.includes("wallet") && Boolean(config.wallet?.enabled);
  const balance = customer.walletBalance ?? 0;
  res.json({
    ...history,
    customer: shapeCustomer(customer),
    coins: { enabled, balance: enabled ? balance : 0, valuePaise: enabled ? coinsValuePaise(balance, config.wallet) : 0 },
    feedback: { enabled: Boolean(feedback.enabled), googleReviewUrl: feedback.enabled ? feedback.googleReviewUrl : "", googleMinStars: feedback.googleMinStars },
  });
});

/** The signed-in customer, and the outlet they are at — refused when the two belong to different stores. */
async function customerAt(req, outletId, { signInMessage = "Sign in first" } = {}) {
  const customer = await currentCustomer(req);
  if (!customer) throw new HttpError(401, signInMessage);
  const outlet = await outletOf(outletId);
  if (customer.brandId !== outlet.brandId) throw new HttpError(403, "Sign in again for this restaurant");
  return { customer, outlet, ctx: { brandId: outlet.brandId, outletId: String(outlet._id) } };
}

/** Rate a completed order (1–5 stars, an optional comment and quick tags). Rating again within a week changes it. */
customerRouter.post("/orders/:id/feedback", limiter("customer-feedback"), async (req, res) => {
  const body = feedbackInputSchema.parse(req.body);
  const { customer, outlet } = await customerAt(req, body.outletId, { signInMessage: "Sign in to rate your order" });
  res.json(await rateOrder({ brandId: outlet.brandId, customer, orderId: req.params.id, input: body }));
});

/**
 * "Order again": the dishes of one of the customer's past orders, rebuilt against the outlet's menu as it is NOW —
 * what's gone, sold out or out of its hours is left out (and listed), changed add-ons are dropped. The storefront puts
 * the lines in the cart; prices are worked out fresh at checkout.
 */
customerRouter.post("/orders/:id/reorder", limiter("customer-orders"), async (req, res) => {
  const body = z.object({ outletId: z.string().min(1) }).parse(req.body);
  const { customer, outlet } = await customerAt(req, body.outletId, { signInMessage: "Sign in to order again" });
  res.json(await reorderLines({ brandId: outlet.brandId, customerId: String(customer._id), orderId: req.params.id }));
});

/* ----------------------------------------------------------- the cart's saved copy */

const cartLineBody = z.object({
  itemId: z.string().min(1).max(40),
  variantId: z.string().max(80).optional(),
  modifierOptionIds: z.array(z.string().max(80)).max(30).default([]),
  quantity: z.number().int().min(1).max(99),
});

/**
 * A signed-in customer's cart, saved whenever it changes — only kept while the store has abandoned-cart reminders on
 * (otherwise this answers `{ saved: false }` and stores nothing). An empty list removes it.
 */
customerRouter.put("/cart", limiter("cart-sync"), async (req, res) => {
  const body = z.object({ outletId: z.string().min(1), lines: z.array(cartLineBody).max(60) }).parse(req.body);
  const { customer, ctx } = await customerAt(req, body.outletId);
  res.json(await saveCart(ctx, customer, body.lines));
});

/** Public: the dishes in a saved cart, for the reminder's link opened on another phone. No personal details. */
customerRouter.get("/cart/:id", limiter("public-compute"), async (req, res) => {
  const outlet = await outletOf(typeof req.query.outletId === "string" ? req.query.outletId : "");
  res.json(await cartLinesById({ brandId: outlet.brandId, outletId: String(outlet._id) }, req.params.id));
});

/**
 * Remove one order from the customer's own Account page. Their list only: the store keeps the order (and its
 * payment, coins and place in the reports) exactly as it was.
 */
customerRouter.delete("/orders/:id", limiter("customer-account"), async (req, res) => {
  const customer = await currentCustomer(req);
  if (!customer) throw new HttpError(401, "Sign in to manage your orders");
  const outlet = await outletOf(typeof req.query.outletId === "string" ? req.query.outletId : "");
  if (customer.brandId !== outlet.brandId) throw new HttpError(403, "Sign in again for this restaurant");
  res.json(await hideOrderFromCustomer({ brandId: outlet.brandId, customerId: String(customer._id), orderId: req.params.id }));
});

customerRouter.get("/me", async (req, res) => {
  const customer = await currentCustomer(req);
  if (!customer) {
    res.json({ customer: null });
    return;
  }
  res.json({ customer: shapeCustomer(customer) });
});

const completeProfileBody = z.object({
  name: customerNameSchema.optional(),
  gender: customerGenderSchema.optional(),
  age: customerAgeSchema.optional(),
  email: customerEmailSchema.optional(),
});

/**
 * For a customer who is already logged in — a session cookie from before
 * gender/age existed — to finish their profile without going through OTP
 * again. Owning the session cookie already proves who they are.
 */
customerRouter.patch("/profile", limiter("customer-account"), async (req, res) => {
  const customer = await currentCustomer(req);
  if (!customer) throw new HttpError(401, "Sign in first");
  const body = completeProfileBody.parse(req.body);
  const updated = await completeProfile(customer, body);
  res.json({ customer: shapeCustomer(updated) });
});

customerRouter.post("/logout", limiter("customer-account"), async (req, res) => {
  await endCustomerSession((req.cookies                                      )?.[CUSTOMER_COOKIE]);
  res.clearCookie(CUSTOMER_COOKIE, { path: "/" });
  res.status(204).end();
});
