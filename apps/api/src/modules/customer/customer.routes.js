import { Router,              } from "express";
import { z } from "zod";
import { OutletModel,                  } from "@onetap/db";
import { isProd } from "../../env.js";
import { HttpError } from "../../middleware/error.js";
import { customerFromToken, endCustomerSession, requestOtp, verifyOtp } from "./customer.service.js";

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

const requestBody = z.object({
  outletId: z.string().min(1),
  destination: z.string().min(3),
});

customerRouter.post("/otp/request", async (req, res) => {
  const body = requestBody.parse(req.body);
  const outlet = await outletOf(body.outletId);
  const result = await requestOtp({
    brandId: outlet.brandId,
    outletId: String(outlet._id),
    destination: body.destination,
  });
  res.json(result);
});

const verifyBody = z.object({
  outletId: z.string().min(1),
  destination: z.string().min(3),
  code: z.string().min(4).max(8),
  name: z.string().max(80).optional(),
});

customerRouter.post("/otp/verify", async (req, res) => {
  const body = verifyBody.parse(req.body);
  const outlet = await outletOf(body.outletId);

  const result = await verifyOtp({
    brandId: outlet.brandId,
    destination: body.destination,
    code: body.code,
    name: body.name,
  });

  res.cookie(CUSTOMER_COOKIE, result.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    expires: result.expiresAt,
    path: "/",
  });
  res.json({
    customer: {
      id: String(result.customer._id),
      name: result.customer.name ?? null,
      phone: result.customer.phone ?? null,
      email: result.customer.email ?? null,
      walletBalance: result.customer.walletBalance ?? 0,
    },
  });
});

customerRouter.get("/me", async (req, res) => {
  const customer = await currentCustomer(req);
  if (!customer) {
    res.json({ customer: null });
    return;
  }
  res.json({
    customer: {
      id: String(customer._id),
      name: customer.name ?? null,
      phone: customer.phone ?? null,
      email: customer.email ?? null,
      walletBalance: customer.walletBalance ?? 0,
    },
  });
});

customerRouter.post("/logout", async (req, res) => {
  await endCustomerSession((req.cookies                                      )?.[CUSTOMER_COOKIE]);
  res.clearCookie(CUSTOMER_COOKIE, { path: "/" });
  res.status(204).end();
});
