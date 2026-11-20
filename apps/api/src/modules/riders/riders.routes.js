import { Router } from "express";
import { z } from "zod";
import { RiderModel, tenantFilter } from "@onetap/db";
import { requireOutletContext } from "../../middleware/auth.js";
import { HttpError } from "../../middleware/error.js";
import { requireFeature } from "../platform/plan.service.js";

/**
 * An outlet's delivery riders — a plain list (name + phone), not logins. Anyone who can move orders (`order:update`)
 * can see it, to hand an order to a rider; adding, editing and removing riders needs `rider:manage`. Needs the plan's
 * Delivery feature.
 */
export const ridersRouter = Router();

const shape = (r) => ({ id: String(r._id), name: r.name, phone: r.phone ?? "", isActive: r.isActive !== false, createdAt: r.createdAt });

const riderBody = z.object({
  name: z.string().trim().min(1, "Enter the rider's name").max(60),
  phone: z
    .string()
    .trim()
    .max(20)
    .refine((v) => v === "" || /^[+\d][\d\s-]{6,18}$/.test(v), "Enter a phone number like 98765 43210")
    .default(""),
  isActive: z.boolean().optional(),
});

async function context(req, permission) {
  const ctx = await requireOutletContext(req, permission);
  await requireFeature(ctx.brandId, "delivery", "Delivery");
  return ctx;
}

ridersRouter.get("/", async (req, res) => {
  const ctx = await context(req, "order:update");
  const rows = await RiderModel.find(tenantFilter(ctx)).sort({ isActive: -1, name: 1 }).lean();
  res.json({ riders: rows.map(shape) });
});

ridersRouter.post("/", async (req, res) => {
  const ctx = await context(req, "rider:manage");
  const body = riderBody.parse(req.body);
  const dupe = await RiderModel.findOne(tenantFilter(ctx, { name: new RegExp(`^${body.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") })).lean();
  if (dupe) throw new HttpError(409, `${dupe.name} is already on the list.`);
  const doc = await RiderModel.create({ brandId: ctx.brandId, outletId: ctx.outletId, name: body.name, phone: body.phone, isActive: body.isActive ?? true });
  res.status(201).json({ rider: shape(doc.toObject()) });
});

ridersRouter.patch("/:id", async (req, res) => {
  const ctx = await context(req, "rider:manage");
  const body = riderBody.partial().parse(req.body);
  if (!/^[a-f\d]{24}$/i.test(req.params.id)) throw new HttpError(404, "Rider not found");
  const doc = await RiderModel.findOneAndUpdate(tenantFilter(ctx, { _id: req.params.id }), { $set: body }, { new: true }).lean();
  if (!doc) throw new HttpError(404, "Rider not found");
  res.json({ rider: shape(doc) });
});

/** Orders keep the name and number of the rider they went out with, so removing one here changes no history. */
ridersRouter.delete("/:id", async (req, res) => {
  const ctx = await context(req, "rider:manage");
  if (!/^[a-f\d]{24}$/i.test(req.params.id)) throw new HttpError(404, "Rider not found");
  const r = await RiderModel.deleteOne(tenantFilter(ctx, { _id: req.params.id }));
  if (!r.deletedCount) throw new HttpError(404, "Rider not found");
  res.status(204).end();
});
