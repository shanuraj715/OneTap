import { planOverridesSchema, planSchema } from "@onetap/config-schema";
import {
  BrandModel,
  MenuCategoryModel,
  MenuItemModel,
  ModifierGroupModel,
  OrderModel,
  OutletModel,
  PlanModel,
  PlatformSettingsModel,
  PrinterModel,
  PrintJobModel,
  PrintTemplateModel,
  QrCardDesignModel,
  TableModel,
  TableSessionModel,
  tenantFilter,
  UserModel,
} from "@onetap/db";
import { HttpError } from "../../middleware/error.js";
import { ensureOwner } from "../auth/auth.service.js";
import { hashPassword } from "../auth/password.js";
import { invalidateStorePlan, platformSettings, storePlan } from "./plan.service.js";
import { setStoreDomains, storeDomains } from "../outlets/domains.js";

/*
 * The platform console's back end — everything here is for the platform super
 * admin only (enforced in platform.routes.js). Stores are brands; "people" are
 * users with a membership in that brand.
 */

/* -------------------------------------------------------------------- plans */

const shapePlan = (p, storeCount = 0) => ({
  id: String(p._id),
  ...planSchema.parse({ name: p.name, description: p.description, limits: p.limits, entitlements: p.entitlements }),
  archived: Boolean(p.archived),
  storeCount,
});

export async function listPlans() {
  const [plans, counts] = await Promise.all([
    PlanModel.find({}).sort({ createdAt: 1 }).lean(),
    BrandModel.aggregate([{ $match: { planId: { $ne: null } } }, { $group: { _id: "$planId", n: { $sum: 1 } } }]),
  ]);
  const byPlan = new Map(counts.map((c) => [String(c._id), c.n]));
  return plans.map((p) => shapePlan(p, byPlan.get(String(p._id)) ?? 0));
}

export async function createPlan(input) {
  const data = planSchema.parse(input);
  const plan = await PlanModel.create(data);
  return shapePlan(plan.toObject());
}

export async function updatePlan(id, input) {
  const plan = await PlanModel.findById(id);
  if (!plan) throw new HttpError(404, "Plan not found");
  const data = planSchema.parse({
    name: input.name ?? plan.name,
    description: input.description ?? plan.description,
    limits: input.limits ?? plan.limits,
    entitlements: input.entitlements ?? plan.entitlements,
  });
  Object.assign(plan, data);
  if (input.archived !== undefined) plan.archived = Boolean(input.archived);
  plan.markModified("limits");
  plan.markModified("entitlements");
  await plan.save();
  // Every store on this plan may have just gained or lost something.
  invalidateStorePlan();
  return shapePlan(plan.toObject());
}

/* ----------------------------------------------------------------- settings */

export const getSettings = platformSettings;

export async function updateSettings({ graceDays }) {
  await PlatformSettingsModel.findOneAndUpdate(
    { key: "platform" },
    { $set: { graceDays }, $setOnInsert: { key: "platform" } },
    { upsert: true },
  );
  invalidateStorePlan();
  return platformSettings();
}

/* ------------------------------------------------------------------- stores */

/** A store's status in one word — what the stores list and overview flag. */
function statusOf(plan) {
  if (!plan.grace.over) return "ok";
  return plan.grace.ended ? "over-limit" : "grace";
}

async function storeSummary(brand) {
  const id = String(brand._id);
  const [plan, blockedOutlets, blockedPeople] = await Promise.all([
    storePlan(id),
    OutletModel.countDocuments({ brandId: id, blocked: { $ne: null } }),
    UserModel.countDocuments({ memberships: { $elemMatch: { brandId: id, blockedAt: { $ne: null } } } }),
  ]);
  return {
    id,
    name: brand.name,
    slug: brand.slug,
    ownerEmail: brand.ownerEmail,
    createdAt: brand.createdAt,
    plan: plan.plan,
    usage: plan.usage,
    max: plan.max,
    grace: plan.grace,
    status: statusOf(plan),
    blocked: { outlets: blockedOutlets, people: blockedPeople },
  };
}

export async function listStores() {
  const brands = await BrandModel.find({}).sort({ createdAt: 1 }).lean();
  return Promise.all(brands.map(storeSummary));
}

async function loadBrand(id) {
  const brand = await BrandModel.findById(id).lean();
  if (!brand) throw new HttpError(404, "Store not found");
  return brand;
}

const shapePerson = (u, brandId) => {
  const m = u.memberships.find((x) => x.brandId === brandId);
  return {
    id: String(u._id),
    name: u.name,
    email: u.email,
    role: m?.role ?? null,
    isActive: u.isActive,
    blockedAt: m?.blockedAt ?? null,
    lastLoginAt: u.lastLoginAt ?? null,
    createdAt: u.createdAt,
  };
};

export async function getStore(id) {
  const brand = await loadBrand(id);
  const [summary, plan, outlets, people] = await Promise.all([
    storeSummary(brand),
    storePlan(id),
    OutletModel.find({ brandId: String(brand._id) }).sort({ createdAt: 1 }).lean(),
    UserModel.find({ "memberships.brandId": String(brand._id) }).sort({ createdAt: 1 }).lean(),
  ]);
  return {
    ...summary,
    overrides: planOverridesSchema.parse(brand.overrides ?? {}),
    limits: plan.limits,
    entitlements: plan.entitlements,
    outlets: outlets.map((o) => ({
      id: String(o._id),
      name: o.config?.identity?.name || o.name,
      slug: o.slug,
      blocked: o.blocked ?? null,
      createdAt: o.createdAt,
    })),
    people: people.map((u) => shapePerson(u, String(brand._id))),
    domains: await storeDomains(String(brand._id)),
  };
}

/** Set the domains a store's storefront is served on, and its main one. */
export async function updateStoreDomains(id, input) {
  await loadBrand(id);
  await setStoreDomains(id, input);
  return getStore(id);
}

/** Assign a plan (or `null` for unlimited) and set this store's overrides on top of it. */
export async function setStorePlan(id, { planId, overrides }) {
  const brand = await BrandModel.findById(id);
  if (!brand) throw new HttpError(404, "Store not found");

  if (planId !== undefined) {
    if (planId !== null && planId !== brand.planId) {
      const plan = await PlanModel.findById(planId).lean();
      if (!plan) throw new HttpError(400, "That plan doesn't exist");
      if (plan.archived) throw new HttpError(400, "That plan is archived and can't be assigned");
    }
    brand.planId = planId;
  }
  if (overrides !== undefined) {
    brand.overrides = planOverridesSchema.parse(overrides);
    brand.markModified("overrides");
  }
  await brand.save();
  invalidateStorePlan(id);
  return getStore(id);
}

/* ------------------------------------------------------------- outlets */

async function loadOutlet(brandId, outletId) {
  const outlet = await OutletModel.findOne({ brandId: String(brandId), _id: outletId });
  if (!outlet) throw new HttpError(404, "Outlet not found");
  return outlet;
}

export async function setOutletBlocked(brandId, outletId, blocked, byUserId) {
  const outlet = await loadOutlet(brandId, outletId);
  outlet.blocked = blocked ? { at: new Date(), by: byUserId } : null;
  await outlet.save();
  invalidateStorePlan(brandId);
  return getStore(brandId);
}

/**
 * Permanently remove a blocked outlet. Its menu, tables, printers and QR card
 * go with it; orders and payments are KEPT for the store's records. Needs the
 * outlet's name typed back, and never removes a store's last outlet.
 */
export async function deleteBlockedOutlet(brandId, outletId, confirmName) {
  const outlet = await loadOutlet(brandId, outletId);
  if (!outlet.blocked) throw new HttpError(409, "Block the outlet before deleting it.");
  const name = outlet.config?.identity?.name || outlet.name;
  if ((confirmName ?? "").trim() !== name) throw new HttpError(400, `Type the outlet name "${name}" to confirm.`);
  if ((await OutletModel.countDocuments({ brandId: String(brandId) })) <= 1) {
    throw new HttpError(409, "A store must keep at least one outlet.");
  }

  const ctx = { brandId: String(brandId), outletId: String(outlet._id) };
  await Promise.all(
    [MenuCategoryModel, MenuItemModel, ModifierGroupModel, TableModel, TableSessionModel, PrinterModel, PrintTemplateModel, PrintJobModel, QrCardDesignModel].map(
      (M) => M.deleteMany(tenantFilter(ctx)),
    ),
  );
  await OutletModel.deleteOne({ brandId: ctx.brandId, _id: ctx.outletId });
  invalidateStorePlan(brandId);
  return getStore(brandId);
}

/* -------------------------------------------------------------- people */

async function loadMember(brandId, userId) {
  const user = await UserModel.findOne({ _id: userId, "memberships.brandId": String(brandId) });
  if (!user) throw new HttpError(404, "Person not found in this store");
  return { user, membership: user.memberships.find((m) => m.brandId === String(brandId)) };
}

async function activeOwnerCount(brandId, exceptUserId) {
  return UserModel.countDocuments({
    _id: { $ne: exceptUserId },
    isActive: true,
    memberships: { $elemMatch: { brandId: String(brandId), role: "owner", blockedAt: null } },
  });
}

async function assertNotLastOwner(brandId, user, membership) {
  if (membership.role === "owner" && (await activeOwnerCount(brandId, user._id)) === 0) {
    throw new HttpError(409, "A store must keep at least one active owner.");
  }
}

export async function setPersonBlocked(brandId, userId, blocked) {
  const { user, membership } = await loadMember(brandId, userId);
  if (blocked) await assertNotLastOwner(brandId, user, membership);
  membership.blockedAt = blocked ? new Date() : null;
  user.markModified("memberships");
  await user.save();
  invalidateStorePlan(brandId);
  return getStore(brandId);
}

/** Remove a blocked person's access to this store (their account stays if they belong to another). */
export async function deleteBlockedPerson(brandId, userId) {
  const { user, membership } = await loadMember(brandId, userId);
  if (!membership.blockedAt) throw new HttpError(409, "Block this person before removing them.");
  await removeMembership(brandId, user);
  return getStore(brandId);
}

async function removeMembership(brandId, user) {
  user.memberships = user.memberships.filter((m) => m.brandId !== String(brandId));
  if (user.memberships.length === 0 && !user.isSuperAdmin) await UserModel.deleteOne({ _id: user._id });
  else await user.save();
  invalidateStorePlan(brandId);
}

/* -------------------------------------------------------------- owners */

/**
 * Add an owner. A brand-new email needs a password; an email that already has
 * an account (e.g. someone who owns another store) just gains this store.
 */
export async function addOwner(brandId, { email, name, password }) {
  await loadBrand(brandId);
  const existing = await UserModel.findOne({ email: email.toLowerCase() });
  if (existing) {
    const m = existing.memberships.find((x) => x.brandId === String(brandId));
    if (m) {
      m.role = "owner";
      m.blockedAt = null;
      existing.markModified("memberships");
      await existing.save();
    } else {
      await ensureOwner({ brandId: String(brandId), email, name, password: password ?? "" });
    }
  } else {
    if (!password) throw new HttpError(400, "Set a password for this new owner (at least 8 characters).");
    await ensureOwner({ brandId: String(brandId), email, name, password });
  }
  invalidateStorePlan(brandId);
  return getStore(brandId);
}

export async function updateOwner(brandId, userId, { name, password, isActive }) {
  const { user, membership } = await loadMember(brandId, userId);
  if (membership.role !== "owner") throw new HttpError(400, "That person isn't an owner of this store.");
  if (isActive === false) await assertNotLastOwner(brandId, user, membership);
  if (name) user.name = name;
  if (password) user.passwordHash = await hashPassword(password);
  if (isActive !== undefined) user.isActive = isActive;
  await user.save();
  invalidateStorePlan(brandId);
  return getStore(brandId);
}

export async function removeOwner(brandId, userId) {
  const { user, membership } = await loadMember(brandId, userId);
  if (membership.role !== "owner") throw new HttpError(400, "That person isn't an owner of this store.");
  await assertNotLastOwner(brandId, user, membership);
  await removeMembership(brandId, user);
  return getStore(brandId);
}

/* ------------------------------------------------------------- overview */

export async function overview() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const [stores, outlets, people, ordersToday] = await Promise.all([
    listStores(),
    OutletModel.countDocuments({}).setOptions({ allowGlobalQuery: true }),
    UserModel.countDocuments({ isSuperAdmin: { $ne: true }, "memberships.0": { $exists: true } }),
    OrderModel.countDocuments({ createdAt: { $gte: start } }).setOptions({ allowGlobalQuery: true }),
  ]);
  return {
    totals: { stores: stores.length, outlets, people, ordersToday },
    attention: stores.filter((s) => s.status !== "ok"),
    byPlan: stores.reduce((acc, s) => {
      const key = s.plan?.name ?? "No plan (unlimited)";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  };
}
