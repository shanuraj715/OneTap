import { Router } from "express";
import { z } from "zod";
import { currentAge, customerAgeSchema, customerEmailSchema, customerGenderSchema, customerNameSchema, isProfileComplete } from "@onetap/config-schema";
import { OutletModel } from "@onetap/db";
import { isProd } from "../../env.js";
import { HttpError } from "../../middleware/error.js";
import { assertNotBlocked, blockInfo, failed, floodLimiter } from "../security/login-guard.js";
import { completeProfile, customerFromToken, endCustomerSession, requestOtp, verifyOtp } from "./customer.service.js";

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

customerRouter.post("/otp/request", otpFlood, async (req, res) => {
  await assertNotBlocked(req, "customer");
  const body = requestBody.parse(req.body);
  const outlet = await outletOf(body.outletId);
  const result = await requestOtp({
    brandId: outlet.brandId,
    outletId: String(outlet._id),
    destination: body.destination,
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
customerRouter.patch("/profile", async (req, res) => {
  const customer = await currentCustomer(req);
  if (!customer) throw new HttpError(401, "Sign in first");
  const body = completeProfileBody.parse(req.body);
  const updated = await completeProfile(customer, body);
  res.json({ customer: shapeCustomer(updated) });
});

customerRouter.post("/logout", async (req, res) => {
  await endCustomerSession((req.cookies                                      )?.[CUSTOMER_COOKIE]);
  res.clearCookie(CUSTOMER_COOKIE, { path: "/" });
  res.status(204).end();
});
