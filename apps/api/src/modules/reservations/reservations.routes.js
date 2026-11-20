import { Router } from "express";
import { z } from "zod";
import { reservationRequestSchema, reservationStatusSchema } from "@onetap/config-schema";
import { OutletModel } from "@onetap/db";
import { requireOutletContext, requireUser } from "../../middleware/auth.js";
import { HttpError } from "../../middleware/error.js";
import { limiter } from "../../middleware/rate-limit.js";
import { currentCustomer } from "../customer/customer.routes.js";
import { outletBrand } from "../outlets/outlet-cache.js";
import { requireFeature } from "../platform/plan.service.js";
import {
  availability,
  bookingsForDay,
  cancelOwnReservation,
  createReservation,
  customerReservations,
  pendingCount,
  shapeReservation,
  updateReservation,
} from "./reservations.service.js";

/**
 * Table bookings. Public: what can be booked. Customers (signed in on the storefront): book, see and cancel their
 * own. The team (`reservation:read` / `reservation:manage`, plan feature "Table reservations"): the day's bookings,
 * confirm / decline / seat / no-show / complete, and bookings taken over the phone.
 */
export const reservationsRouter = Router();

async function publicContext(outletId) {
  const ref = await outletBrand(outletId);
  if (!ref) throw new HttpError(404, "Outlet not found");
  return { brandId: ref.brandId, outletId: ref.outletId };
}

async function teamContext(req, permission) {
  const ctx = await requireOutletContext(req, permission);
  await requireFeature(ctx.brandId, "reservations", "Table reservations");
  return ctx;
}

/* ------------------------------------------------------------------ public */

reservationsRouter.get("/availability", limiter("public-compute"), async (req, res) => {
  const q = z.object({ outletId: z.string().min(1), day: z.string().max(10).optional(), party: z.coerce.number().int().min(1).max(50).optional() }).parse(req.query);
  res.json(await availability(await publicContext(q.outletId), { dayKey: q.day, partySize: q.party }));
});

/* ---------------------------------------------------------------- customer */

async function guest(req, outletId) {
  const customer = await currentCustomer(req);
  if (!customer) throw new HttpError(401, "Sign in to book a table");
  const ctx = await publicContext(outletId);
  if (customer.brandId !== ctx.brandId) throw new HttpError(403, "Sign in again for this restaurant");
  return { customer, ctx };
}

reservationsRouter.post("/", limiter("reservation-request"), async (req, res) => {
  const body = reservationRequestSchema.parse(req.body);
  const { customer, ctx } = await guest(req, body.outletId);
  const outlet = await OutletModel.findOne({ _id: ctx.outletId, brandId: ctx.brandId }).select("blocked").lean();
  if (outlet?.blocked) throw new HttpError(423, "This outlet is temporarily unavailable.");
  const r = await createReservation(ctx, {
    at: body.at,
    partySize: body.partySize,
    name: body.name ?? customer.name ?? "",
    phone: customer.phone ?? "",
    note: body.note,
    customerId: String(customer._id),
    source: "customer",
  });
  res.status(201).json({ reservation: shapeReservation(r, { forCustomer: true }) });
});

reservationsRouter.get("/mine", limiter("customer-orders"), async (req, res) => {
  const outletId = typeof req.query.outletId === "string" ? req.query.outletId : "";
  const { customer, ctx } = await guest(req, outletId);
  res.json({ reservations: await customerReservations({ brandId: ctx.brandId, customerId: String(customer._id) }) });
});

reservationsRouter.post("/:id/cancel", limiter("customer-account"), async (req, res) => {
  const body = z.object({ outletId: z.string().min(1) }).parse(req.body);
  const { customer, ctx } = await guest(req, body.outletId);
  res.json({ reservation: await cancelOwnReservation({ brandId: ctx.brandId, customerId: String(customer._id), id: req.params.id }) });
});

/* -------------------------------------------------------------------- team */

reservationsRouter.get("/", async (req, res) => {
  const ctx = await teamContext(req, "reservation:read");
  res.json(await bookingsForDay(ctx, typeof req.query.day === "string" ? req.query.day : undefined));
});

reservationsRouter.get("/summary", async (req, res) => {
  const ctx = await teamContext(req, "reservation:read");
  res.json({ pending: await pendingCount(ctx) });
});

const staffBody = z.object({
  at: z.string().min(1),
  partySize: z.number().int().min(1).max(200),
  name: z.string().trim().min(1, "Enter the guest's name").max(80),
  phone: z.string().trim().max(20).default(""),
  note: z.string().trim().max(300).default(""),
  /** take it even though the time is full (the team knows the floor better than the numbers) */
  force: z.boolean().optional(),
});

reservationsRouter.post("/staff", async (req, res) => {
  const ctx = await teamContext(req, "reservation:manage");
  const user = requireUser(req);
  const body = staffBody.parse(req.body);
  const r = await createReservation(ctx, { ...body, source: "staff", force: body.force === true, byUserId: String(user._id) });
  res.status(201).json({ reservation: shapeReservation(r) });
});

const updateBody = z.object({
  status: reservationStatusSchema.optional(),
  tableId: z.string().nullable().optional(),
  staffNote: z.string().max(300).optional(),
  reason: z.string().max(200).optional(),
});

reservationsRouter.patch("/:id", async (req, res) => {
  const ctx = await teamContext(req, "reservation:manage");
  const user = requireUser(req);
  const r = await updateReservation(ctx, req.params.id, updateBody.parse(req.body), String(user._id));
  res.json({ reservation: shapeReservation(r) });
});
