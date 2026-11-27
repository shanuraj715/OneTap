import { Router } from "express";
import { z } from "zod";
import { RiderModel, tenantFilter } from "@rasoipulse/db";
import { decryptSecret, encryptSecret } from "../../lib/crypto.js";
import { logger } from "../../logger.js";
import { limiter } from "../../middleware/rate-limit.js";
import { requireOutletContext, requireUser } from "../../middleware/auth.js";
import { HttpError } from "../../middleware/error.js";
import { requireFeature } from "../platform/plan.service.js";
import { PIN_RE, hashPin, loginPhoneOf } from "./rider-auth.js";

/**
 * An outlet's delivery riders — a list (name + phone). Anyone who can move orders (`order:update`) can see it, to hand an
 * order to a rider; adding, editing and removing riders needs `rider:manage`. A rider can also be given a login for the rider app
 * (their phone number + a PIN the manager sets: `PUT /:id/pin`; `DELETE /:id/pin` switches it off). Needs the plan's Delivery feature.
 */
export const ridersRouter = Router();

const shape = (r) => ({ id: String(r._id), name: r.name, phone: r.phone ?? "", isActive: r.isActive !== false, createdAt: r.createdAt, appLogin: Boolean(r.loginPhone), pinSetAt: r.pinSetAt ?? null, lastLoginAt: r.lastLoginAt ?? null });

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
  const set = { ...body };
  // when the rider's number changes, their app login name changes with it (and must stay a number nobody else signs in with)
  if (body.phone !== undefined) {
    const current = await RiderModel.findOne(tenantFilter(ctx, { _id: req.params.id })).lean();
    if (current?.loginPhone) {
      const login = loginPhoneOf(body.phone);
      if (!login) throw new HttpError(400, "This rider signs in to the app with their phone number: enter a 10-digit number, or switch their app login off first.");
      await assertLoginPhoneFree(login, req.params.id);
      set.loginPhone = login;
    }
  }
  const doc = await RiderModel.findOneAndUpdate(tenantFilter(ctx, { _id: req.params.id }), { $set: set }, { new: true }).lean();
  if (!doc) throw new HttpError(404, "Rider not found");
  res.json({ rider: shape(doc) });
});

/** A phone number signs in ONE rider across every store, so it can't be the login of two riders. */
async function assertLoginPhoneFree(loginPhone, exceptId) {
  const clash = await RiderModel.findOne({ loginPhone, ...(exceptId ? { _id: { $ne: exceptId } } : {}) }, null, { allowGlobalQuery: true }).select("_id").lean();
  if (clash) throw new HttpError(409, "That phone number is already used for another rider's app login. Use a different number.");
}

/**
 * Look the rider's PIN up again (the manager's "Show PIN"). It is kept twice: as a hash, which is what signing in checks, and locked with the
 * server's key, which is what lets this answer. A PIN set before the locked copy existed can't be shown: the answer says so and the manager sets a
 * new one. Never cached; each look is logged and rate limited.
 */
ridersRouter.get("/:id/pin", limiter("rider-pin-view"), async (req, res) => {
  const ctx = await context(req, "rider:manage");
  if (!/^[a-f\d]{24}$/i.test(req.params.id)) throw new HttpError(404, "Rider not found");
  const rider = await RiderModel.findOne(tenantFilter(ctx, { _id: req.params.id })).select("+pinEnc").lean();
  if (!rider) throw new HttpError(404, "Rider not found");
  res.set("Cache-Control", "no-store");
  if (!rider.loginPhone) return res.json({ appLogin: false, pin: null, reason: "no_login" });
  if (!rider.pinEnc) return res.json({ appLogin: true, pin: null, reason: "set_before" });
  let pin = null;
  try { pin = decryptSecret(rider.pinEnc); } catch { return res.json({ appLogin: true, pin: null, reason: "unreadable" }); }
  logger.info({ riderId: String(rider._id), by: String(requireUser(req)._id) }, "rider PIN looked up");
  res.json({ appLogin: true, pin, reason: null });
});

/** Turn the rider's app login on, or set a new PIN. The PIN is stored as a hash (what signing in checks) and locked with the server's key (so the manager can look it up again). */
ridersRouter.put("/:id/pin", async (req, res) => {
  const ctx = await context(req, "rider:manage");
  const { pin } = z.object({ pin: z.string().regex(PIN_RE, "The PIN is 4 to 6 digits.") }).parse(req.body);
  if (!/^[a-f\d]{24}$/i.test(req.params.id)) throw new HttpError(404, "Rider not found");
  const rider = await RiderModel.findOne(tenantFilter(ctx, { _id: req.params.id })).lean();
  if (!rider) throw new HttpError(404, "Rider not found");
  const login = loginPhoneOf(rider.phone);
  if (!login) throw new HttpError(400, "Add the rider's 10-digit phone number first: it is the name they sign in with.");
  await assertLoginPhoneFree(login, req.params.id);
  const doc = await RiderModel.findOneAndUpdate(
    tenantFilter(ctx, { _id: req.params.id }),
    { $set: { pinHash: await hashPin(pin), pinEnc: encryptSecret(pin), loginPhone: login, pinSetAt: new Date() }, $inc: { pinVersion: 1 } },
    { new: true },
  ).lean();
  res.json({ rider: shape(doc) });
});

/** Switch the app login off: the rider is signed out of the app everywhere, and can't sign in again until a new PIN is set. */
ridersRouter.delete("/:id/pin", async (req, res) => {
  const ctx = await context(req, "rider:manage");
  if (!/^[a-f\d]{24}$/i.test(req.params.id)) throw new HttpError(404, "Rider not found");
  const doc = await RiderModel.findOneAndUpdate(
    tenantFilter(ctx, { _id: req.params.id }),
    { $set: { pinHash: "", pinEnc: "", loginPhone: "", pinSetAt: null }, $inc: { pinVersion: 1 } },
    { new: true },
  ).lean();
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
