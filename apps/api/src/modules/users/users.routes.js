import { Router } from "express";
import { z } from "zod";
import { permissionsForRole, roleSchema } from "@rasoipulse/config-schema";
import { OutletModel, UserModel } from "@rasoipulse/db";
import { requireBrandContext, requireUser } from "../../middleware/auth.js";
import { HttpError } from "../../middleware/error.js";
import { hashPassword } from "../auth/password.js";
import { invalidateStorePlan, storePlan } from "../platform/plan.service.js";
import { limiter } from "../../middleware/rate-limit.js";

export const usersRouter         = Router();

/** A user as seen from one store — their role and access in THAT store, not their first membership. */
const shape = (u, brandId) => {
  const m = u.memberships.find((x) => x.brandId === brandId) ?? u.memberships[0];
  return {
    id: String(u._id),
    email: u.email,
    name: u.name,
    isActive: u.isActive,
    lastLoginAt: u.lastLoginAt ?? null,
    role: m?.role ?? null,
    outletIds: m?.outletIds ?? [],
    blockedAt: m?.blockedAt ?? null,
    permissions: m ? permissionsForRole(m.role) : [],
  };
};

const membershipIn = (user, brandId) => user.memberships.find((x) => x.brandId === brandId);

/**
 * Store owners are managed by the platform (Rasoi Pulse), not from the store's
 * own dashboard — so a store can't create, promote, edit or remove an owner.
 */
function assertCanManage(me, target, brandId, nextRole) {
  if (me.isSuperAdmin) return;
  if (nextRole === "owner") throw new HttpError(403, "Store owners are added by Rasoi Pulse.");
  if (target && membershipIn(target, brandId)?.role === "owner") {
    throw new HttpError(403, "Store owners are managed by Rasoi Pulse.");
  }
}

/**
 * Which outlets a team member may work in. An empty list means every outlet of the store. The ids must be outlets of THIS store; an owner
 * always has every outlet; (Only owners and the platform admin manage people, and they have every outlet.)
 */
async function cleanOutletIds(brandId, role, wanted) {
  const ids = [...new Set((wanted ?? []).map(String))];
  if (role === "owner") return [];
  if (ids.length > 0) {
    // (an id that isn't even shaped like one can't be an outlet — and must not reach the database as a query that crashes)
    if (ids.some((id) => !/^[a-f\d]{24}$/i.test(id))) throw new HttpError(400, "One of those outlets isn't part of this store.");
    const found = await OutletModel.find({ brandId, _id: { $in: ids } }).select("_id").lean();
    if (found.length !== ids.length) throw new HttpError(400, "One of those outlets isn't part of this store.");
  }
  return ids;
}

/** Everyone counts toward the plan's people limit, owners included. The platform can always add. */
async function assertSeatFree(me, brandId) {
  if (me.isSuperAdmin) return;
  const plan = await storePlan(brandId);
  if (plan.max.users !== null && plan.usage.users >= plan.max.users) {
    throw new HttpError(409, `Your plan allows ${plan.max.users} people and all are in use. Remove someone or ask Rasoi Pulse to raise the limit.`);
  }
}

usersRouter.get("/", async (req, res) => {
  const { brandId } = await requireBrandContext(req, "user:read");
  const users = await UserModel.find({ "memberships.brandId": brandId }).sort({ createdAt: 1 }).lean();
  res.json({ users: users.map((u) => shape(u, brandId)) });
});

const createBody = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8, "Use at least 8 characters"),
  role: roleSchema.exclude(["super_admin"]),
  outletIds: z.array(z.string()).optional(),
});

usersRouter.post("/", limiter("account-write"), async (req, res) => {
  const { brandId } = await requireBrandContext(req, "user:manage");
  const me = requireUser(req);
  const body = createBody.parse(req.body);
  assertCanManage(me, null, brandId, body.role);

  if (await UserModel.exists({ email: body.email.toLowerCase() })) {
    throw new HttpError(409, "That email is already in use");
  }
  await assertSeatFree(me, brandId);
  const outletIds = await cleanOutletIds(brandId, body.role, body.outletIds);

  const user = await UserModel.create({
    email: body.email.toLowerCase(),
    name: body.name,
    passwordHash: await hashPassword(body.password),
    memberships: [{ brandId, role: body.role, outletIds }],
  });
  invalidateStorePlan(brandId);
  res.status(201).json({ user: shape(user.toObject(), brandId) });
});

const updateBody = z.object({
  name: z.string().min(1).optional(),
  role: roleSchema.exclude(["super_admin"]).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional(),
  /** the outlets this person may work in; [] = every outlet */
  outletIds: z.array(z.string()).optional(),
});

usersRouter.patch("/:id", limiter("account-write"), async (req, res) => {
  const { brandId } = await requireBrandContext(req, "user:manage");
  const me = requireUser(req);
  const body = updateBody.parse(req.body);

  const user = await UserModel.findOne({ _id: req.params.id, "memberships.brandId": brandId });
  if (!user) throw new HttpError(404, "User not found");
  assertCanManage(me, user, brandId, body.role);

  if (String(user._id) === String(me._id) && (body.role || body.isActive === false)) {
    throw new HttpError(400, "You can't change your own role or deactivate yourself");
  }
  // Switching someone back on takes a seat again.
  if (body.isActive === true && !user.isActive) await assertSeatFree(me, brandId);

  if (body.name) user.name = body.name;
  if (body.isActive !== undefined) user.isActive = body.isActive;
  if (body.password) user.passwordHash = await hashPassword(body.password);
  if (body.role || body.outletIds) {
    const m = membershipIn(user, brandId);
    if (m) {
      if (body.role) m.role = body.role;
      const role = m.role;
      if (body.outletIds) m.outletIds = await cleanOutletIds(brandId, role, body.outletIds);
      else if (role === "owner") m.outletIds = [];
    }
    user.markModified("memberships");
  }
  await user.save();
  invalidateStorePlan(brandId);

  res.json({ user: shape(user.toObject(), brandId) });
});

/**
 * Removes this person's access to THIS store. Their account only goes away
 * when they have no other store left — someone who also works for another
 * brand keeps that access.
 */
usersRouter.delete("/:id", limiter("account-write"), async (req, res) => {
  const { brandId } = await requireBrandContext(req, "user:manage");
  const me = requireUser(req);
  if (String(me._id) === req.params.id) throw new HttpError(400, "You can't remove yourself");

  const user = await UserModel.findOne({ _id: req.params.id, "memberships.brandId": brandId });
  if (!user) throw new HttpError(404, "User not found");
  assertCanManage(me, user, brandId);

  user.memberships = user.memberships.filter((m) => m.brandId !== brandId);
  if (user.memberships.length === 0 && !user.isSuperAdmin) await UserModel.deleteOne({ _id: user._id });
  else await user.save();
  invalidateStorePlan(brandId);
  res.status(204).end();
});
