import { PLATFORM_FEATURES, PLATFORM_FEATURE_GROUPS, expandPlatformFeatures, isPlatformFeature } from "@rasoipulse/config-schema";
import { PlatformAuditModel, PlatformRoleModel, SessionModel, UserModel } from "@rasoipulse/db";
import { HttpError } from "../../middleware/error.js";
import { hashPassword } from "../auth/password.js";

/**
 * Roles and team members of the Rasoi Pulse platform console. Everything here is for the SUPER ADMIN only (the routes check it, and so does the
 * rules table: `/roles`, `/team` and `/audit` are `null` = super admin). Nothing is ever shown or stored of a person's password but its hash.
 */

const OBJECT_ID = /^[a-f\d]{24}$/i;
const idOr404 = (id, what) => {
  if (!OBJECT_ID.test(String(id))) throw new HttpError(404, `${what} not found`);
  return String(id);
};

/** the chosen features, once each, in the order the registry lists them */
const chosen = (features) => PLATFORM_FEATURES.map((f) => f.key).filter((k) => (features ?? []).includes(k));

async function note(actor, action, target, detail = "", ip) {
  await PlatformAuditModel.create({
    actorId: String(actor._id),
    actorName: actor.name,
    action,
    targetId: target?.id ? String(target.id) : undefined,
    targetName: String(target?.name ?? "").slice(0, 120),
    detail: String(detail).slice(0, 300),
    ip: ip ? String(ip).slice(0, 64) : undefined,
  });
}

const shapeRole = (r, members = 0) => ({
  id: String(r._id),
  name: r.name,
  description: r.description ?? "",
  /** what the super admin ticked */
  features: chosen(r.features),
  /** what the people holding the role can really do (a ticked feature brings others along) */
  effective: expandPlatformFeatures(r.features),
  members,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

/* ------------------------------------------------------------------- roles */

export async function listRoles() {
  const [roles, counts] = await Promise.all([
    PlatformRoleModel.find().sort({ nameKey: 1 }).lean(),
    UserModel.aggregate([{ $match: { platformRoleId: { $ne: null } } }, { $group: { _id: "$platformRoleId", n: { $sum: 1 } } }]),
  ]);
  const byRole = new Map(counts.map((c) => [c._id, c.n]));
  return {
    roles: roles.map((r) => shapeRole(r, byRole.get(String(r._id)) ?? 0)),
    features: PLATFORM_FEATURES,
    groups: PLATFORM_FEATURE_GROUPS,
  };
}

export async function createRole(input, actor, ip) {
  const nameKey = input.name.toLowerCase();
  if (await PlatformRoleModel.exists({ nameKey })) throw new HttpError(409, "There is already a role with that name.");
  const role = await PlatformRoleModel.create({ name: input.name, nameKey, description: input.description ?? "", features: chosen(input.features), createdBy: String(actor._id) });
  await note(actor, "role.create", { id: role._id, name: role.name }, `features: ${chosen(input.features).join(", ") || "none"}`, ip);
  return shapeRole(role.toObject(), 0);
}

export async function updateRole(id, input, actor, ip) {
  const role = await PlatformRoleModel.findById(idOr404(id, "Role"));
  if (!role) throw new HttpError(404, "Role not found");
  const nameKey = input.name.toLowerCase();
  if (nameKey !== role.nameKey && (await PlatformRoleModel.exists({ nameKey, _id: { $ne: role._id } }))) throw new HttpError(409, "There is already a role with that name.");
  const before = chosen(role.features);
  role.name = input.name;
  role.nameKey = nameKey;
  role.description = input.description ?? "";
  role.features = chosen(input.features);
  await role.save();
  const added = chosen(input.features).filter((f) => !before.includes(f));
  const removed = before.filter((f) => !chosen(input.features).includes(f));
  await note(actor, "role.update", { id: role._id, name: role.name }, `added: ${added.join(", ") || "none"}; removed: ${removed.join(", ") || "none"}`, ip);
  const members = await UserModel.countDocuments({ platformRoleId: String(role._id) });
  return shapeRole(role.toObject(), members);
}

export async function deleteRole(id, actor, ip) {
  const role = await PlatformRoleModel.findById(idOr404(id, "Role"));
  if (!role) throw new HttpError(404, "Role not found");
  const members = await UserModel.countDocuments({ platformRoleId: String(role._id) });
  if (members > 0) throw new HttpError(409, `${members} ${members === 1 ? "person has" : "people have"} this role. Move them to another role first.`, { code: "role_in_use", members });
  await role.deleteOne();
  await note(actor, "role.delete", { id: role._id, name: role.name }, "", ip);
}

/* ------------------------------------------------------------ team members */

const shapeMember = (u, roles) => ({
  id: String(u._id),
  name: u.name,
  email: u.email,
  isActive: u.isActive,
  roleId: u.platformRoleId,
  roleName: roles.get(u.platformRoleId)?.name ?? "(role deleted)",
  lastLoginAt: u.lastLoginAt ?? null,
  createdAt: u.createdAt,
});

export async function listMembers() {
  const [users, roles] = await Promise.all([
    UserModel.find({ platformRoleId: { $ne: null }, isSuperAdmin: { $ne: true } }).select("-passwordHash").sort({ name: 1 }).lean(),
    PlatformRoleModel.find().lean(),
  ]);
  const map = new Map(roles.map((r) => [String(r._id), r]));
  return users.map((u) => shapeMember(u, map));
}

async function roleOrThrow(roleId) {
  const role = OBJECT_ID.test(String(roleId)) ? await PlatformRoleModel.findById(roleId).lean() : null;
  if (!role) throw new HttpError(400, "That role doesn't exist.");
  return role;
}

export async function createMember(input, actor, ip) {
  const role = await roleOrThrow(input.roleId);
  if (await UserModel.exists({ email: input.email })) throw new HttpError(409, "That email address is already in use.");
  const user = await UserModel.create({
    email: input.email,
    name: input.name,
    passwordHash: await hashPassword(input.password),
    isSuperAdmin: false,
    memberships: [], // a team member has no store: nothing of any restaurant is open to them
    platformRoleId: String(role._id),
  });
  await note(actor, "member.create", { id: user._id, name: user.name }, `${user.email} · role ${role.name}`, ip);
  return shapeMember(user.toObject(), new Map([[String(role._id), role]]));
}

/** The team member behind an id — never the super admin and never a restaurant's staff, whatever id is sent. */
async function memberOrThrow(id) {
  const user = await UserModel.findOne({ _id: idOr404(id, "Team member"), platformRoleId: { $ne: null }, isSuperAdmin: { $ne: true } });
  if (!user) throw new HttpError(404, "Team member not found");
  return user;
}

export async function updateMember(id, patch, actor, ip) {
  const user = await memberOrThrow(id);
  const details = [];
  let roleDoc = null;
  if (patch.name !== undefined && patch.name !== user.name) { user.name = patch.name; details.push("name"); }
  if (patch.roleId !== undefined && patch.roleId !== user.platformRoleId) {
    roleDoc = await roleOrThrow(patch.roleId);
    user.platformRoleId = String(roleDoc._id);
    details.push(`role → ${roleDoc.name}`);
  }
  if (patch.isActive !== undefined && patch.isActive !== user.isActive) { user.isActive = patch.isActive; details.push(patch.isActive ? "switched on" : "switched off"); }
  const resetPassword = patch.password !== undefined;
  if (resetPassword) user.passwordHash = await hashPassword(patch.password);
  await user.save();
  // a new password, or a person switched off: every sign-in of theirs ends now
  if (resetPassword || patch.isActive === false) await SessionModel.deleteMany({ userId: String(user._id) });
  await note(actor, resetPassword ? "member.password" : "member.update", { id: user._id, name: user.name }, details.join("; ") || (resetPassword ? "password reset" : "no change"), ip);
  const roles = new Map((await PlatformRoleModel.find().lean()).map((r) => [String(r._id), r]));
  return shapeMember(user.toObject(), roles);
}

export async function deleteMember(id, actor, ip) {
  const user = await memberOrThrow(id);
  await SessionModel.deleteMany({ userId: String(user._id) });
  await user.deleteOne();
  await note(actor, "member.delete", { id: user._id, name: user.name }, user.email, ip);
}

/* ------------------------------------------------------------------ the log */

export async function listAudit(limit = 50) {
  const rows = await PlatformAuditModel.find().sort({ createdAt: -1 }).limit(Math.min(200, Math.max(1, limit))).lean();
  return rows.map((r) => ({ id: String(r._id), at: r.createdAt, actor: r.actorName, action: r.action, target: r.targetName, detail: r.detail }));
}

export { isPlatformFeature };
