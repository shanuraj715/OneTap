import { Router } from "express";
import { z } from "zod";
import { cartSchema } from "@rasoipulse/config-schema";
import { requireOutletContext, requireUser } from "../../middleware/auth.js";
import { wire } from "./orders.service.js";
import {
  confirmCoinsCode,
  lookupCustomer,
  placeStaffOrder,
  searchCustomers,
  sendCoinsCode,
  staffQuote,
} from "./staff-orders.service.js";
import { limiter } from "../../middleware/rate-limit.js";

/**
 * The staff "Take order" screen. Every route needs `order:create` — owners,
 * managers and staff, not the kitchen (which can move an order along but
 * can't put food on anyone's bill).
 */
export const staffOrdersRouter = Router();

const phoneParam = z.string().min(8).max(20);

/** Who a mobile number belongs to, and whether their coins can be used. */
staffOrdersRouter.get("/customer", limiter("pii-read"), async (req, res) => {
  const ctx = await requireOutletContext(req, "order:create");
  res.json(await lookupCustomer(ctx, phoneParam.parse(req.query.phone)));
});

/** Customers matching the digits typed so far — for the dropdown under the mobile field. */
staffOrdersRouter.get("/customers", limiter("pii-read"), async (req, res) => {
  const ctx = await requireOutletContext(req, "order:create");
  const q = z.string().max(20).parse(req.query.q ?? "");
  res.json({ customers: await searchCustomers(ctx, q) });
});

const quoteBody = z.object({
  cart: cartSchema,
  tableId: z.string().optional(),
  phone: phoneParam.optional(),
});

/** The live total for the order panel — priced by the server, coins included. */
staffOrdersRouter.post("/quote", async (req, res) => {
  const ctx = await requireOutletContext(req, "order:create");
  res.json(await staffQuote(ctx, quoteBody.parse(req.body)));
});

/** Text the customer a code before their coins are spent (only when the store sends SMS codes). */
staffOrdersRouter.post("/coins-code", limiter("coins-code"), async (req, res) => {
  const ctx = await requireOutletContext(req, "order:create");
  const { phone } = z.object({ phone: phoneParam }).parse(req.body);
  res.json(await sendCoinsCode(ctx, phone));
});

staffOrdersRouter.post("/coins-code/verify", limiter("coins-code"), async (req, res) => {
  const ctx = await requireOutletContext(req, "order:create");
  const { phone, code } = z.object({ phone: phoneParam, code: z.string().min(4).max(8) }).parse(req.body);
  res.json(await confirmCoinsCode(ctx, phone, code));
});

const placeBody = z.object({
  tableId: z.string().min(1),
  cart: cartSchema,
  phone: phoneParam.optional(),
  name: z.string().max(80).optional(),
  email: z.union([z.string().email("That email doesn't look right."), z.literal("")]).optional(),
  note: z.string().max(300).optional(),
  coinsApproval: z.string().max(200).optional(),
  /** the party the screen saw at this table when the order was started — null = the table was free */
  expectedSessionId: z.string().max(64).nullable().optional(),
});

/** Place the order on the table and send it straight to the kitchen. */
staffOrdersRouter.post("/", async (req, res) => {
  const ctx = await requireOutletContext(req, "order:create");
  const user = requireUser(req);
  const order = await placeStaffOrder(ctx, user, placeBody.parse(req.body));
  res.status(201).json({ order: wire(order) });
});
