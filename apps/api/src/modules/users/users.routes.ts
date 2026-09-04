import { Router } from "express";
import { z } from "zod";
import { permissionsForRole, roleSchema } from "@onetap/config-schema";
import { UserModel } from "@onetap/db";
import { requireBrandContext, requireUser } from "../../middleware/auth";
import { HttpError } from "../../middleware/error";
import { hashPassword } from "../auth/password";

export const usersRouter: Router = Router();

const shape = (u: {
  _id: unknown;
  email: string;
  name: string;
  isActive: boolean;
  lastLoginAt?: Date;
  memberships: { brandId: string; role: string; outletIds: string[] }[];
}) => {
  const m = u.memberships[0];
  return {
    id: String(u._id),
    email: u.email,
    name: u.name,
    isActive: u.isActive,
    lastLoginAt: u.lastLoginAt ?? null,
    role: m?.role ?? null,
    outletIds: m?.outletIds ?? [],
    permissions: m ? permissionsForRole(m.role as never) : [],
  };
};

usersRouter.get("/", async (req, res) => {
  const { brandId } = requireBrandContext(req, "user:read");
  const users = await UserModel.find({ "memberships.brandId": brandId }).sort({ createdAt: 1 }).lean();
  res.json({ users: users.map(shape) });
});

const createBody = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8, "Use at least 8 characters"),
  role: roleSchema.exclude(["super_admin"]),
  outletIds: z.array(z.string()).optional(),
});

usersRouter.post("/", async (req, res) => {
  const { brandId } = requireBrandContext(req, "user:manage");
  const body = createBody.parse(req.body);

  if (await UserModel.exists({ email: body.email.toLowerCase() })) {
    throw new HttpError(409, "That email is already in use");
  }

  const user = await UserModel.create({
    email: body.email.toLowerCase(),
    name: body.name,
    passwordHash: await hashPassword(body.password),
    memberships: [{ brandId, role: body.role, outletIds: body.outletIds ?? [] }],
  });
  res.status(201).json({ user: shape(user.toObject()) });
});

const updateBody = z.object({
  name: z.string().min(1).optional(),
  role: roleSchema.exclude(["super_admin"]).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

usersRouter.patch("/:id", async (req, res) => {
  const { brandId } = requireBrandContext(req, "user:manage");
  const me = requireUser(req);
  const body = updateBody.parse(req.body);

  const user = await UserModel.findOne({ _id: req.params.id, "memberships.brandId": brandId });
  if (!user) throw new HttpError(404, "User not found");

  if (String(user._id) === String(me._id) && (body.role || body.isActive === false)) {
    throw new HttpError(400, "You can't change your own role or deactivate yourself");
  }

  if (body.name) user.name = body.name;
  if (body.isActive !== undefined) user.isActive = body.isActive;
  if (body.password) user.passwordHash = await hashPassword(body.password);
  if (body.role) {
    const m = user.memberships.find((x) => x.brandId === brandId);
    if (m) m.role = body.role;
    user.markModified("memberships");
  }
  await user.save();

  res.json({ user: shape(user.toObject()) });
});

usersRouter.delete("/:id", async (req, res) => {
  const { brandId } = requireBrandContext(req, "user:manage");
  const me = requireUser(req);
  if (String(me._id) === req.params.id) throw new HttpError(400, "You can't remove yourself");

  const result = await UserModel.deleteOne({ _id: req.params.id, "memberships.brandId": brandId });
  if (result.deletedCount === 0) throw new HttpError(404, "User not found");
  res.status(204).end();
});
