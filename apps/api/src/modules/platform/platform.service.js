import { CUSTOM_PLAN_BASE, FEATURE_KEYS, hasFeature, planMarketingSchema, planOverridesSchema, planSchema, roundUpTables } from "@rasoipulse/config-schema";
import {
  BrandModel,
  MenuCategoryModel,
  MenuItemModel,
  ModifierGroupModel,
  OrderModel,
  OutletModel,
  PlanModel,
  PrinterModel,
  PrintJobModel,
  PrintTemplateModel,
  QrCardDesignModel,
  TableModel,
  TableSessionModel,
  tenantFilter,
  UserModel,
} from "@rasoipulse/db";
import { logger } from "../../logger.js";
import { HttpError } from "../../middleware/error.js";
import { dropStoreTeam } from "../../realtime/hub.js";
import { expireStore } from "../cache/cache.js";
import { savePlatformConfig } from "../cache/platform-config.js";
import { ensureOwner } from "../auth/auth.service.js";
import { hashPassword } from "../auth/password.js";
import { countActiveOutlets, countActiveUsers, countTables, invalidateStorePlan, platformSettings, storePlan } from "./plan.service.js";
import { configuredBase, normalizeHostnames, setStoreDomains, storeDomains } from "../outlets/domains.js";
import { assertStoreMayAddDomains, removeStoreSubdomain, setStoreSubdomain, subdomainInfo } from "../outlets/subdomains.js";
import { notifyWebsite } from "../site/revalidate.js";
import { enforceWhatsAppPlan } from "../whatsapp/whatsapp.service.js";

/*
 * The platform console's back end — everything here is for the platform super
 * admin only (enforced in platform.routes.js). Stores are brands; "people" are
 * users with a membership in that brand.
 */

/* -------------------------------------------------------------------- plans */

/** A custom plan stores nothing of its own — its stores' settings are all there is. */
const planData = (input) => {
  const data = planSchema.parse(input);
  if (data.custom) return { ...data, limits: { ...CUSTOM_PLAN_BASE.limits }, entitlements: { allFeatures: false, features: [], effects: [], qrCardFamilies: [] } };
  // a plan that includes every feature always carries today's full list (what the console and the website read), whatever it was saved with
  return data.entitlements.allFeatures ? { ...data, entitlements: { ...data.entitlements, features: [...FEATURE_KEYS] } } : data;
};

const shapePlan = (p, storeCount = 0) => ({
  id: String(p._id),
  ...planData({ name: p.name, description: p.description, custom: p.custom, limits: p.limits, entitlements: p.entitlements }),
  marketing: planMarketingSchema.parse(p.marketing ?? {}),
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
  const data = planData(input);
  const plan = await PlanModel.create({ ...data, marketing: planMarketingSchema.parse(input.marketing ?? {}) });
  notifyWebsite();
  return shapePlan(plan.toObject());
}

export async function updatePlan(id, input) {
  const plan = await PlanModel.findById(id);
  if (!plan) throw new HttpError(404, "Plan not found");
  if (input.custom !== undefined && Boolean(input.custom) !== Boolean(plan.custom) && (await BrandModel.exists({ planId: String(plan._id) }))) {
    throw new HttpError(400, "Stores are on this plan, so it can't switch between custom and regular. Create a new plan instead.");
  }
  const data = planData({
    name: input.name ?? plan.name,
    description: input.description ?? plan.description,
    custom: input.custom ?? plan.custom ?? false,
    limits: input.limits ?? plan.limits,
    entitlements: input.entitlements ?? plan.entitlements,
  });
  Object.assign(plan, data);
  if (input.marketing !== undefined) {
    plan.marketing = planMarketingSchema.parse(input.marketing);
    plan.markModified("marketing");
  }
  if (input.archived !== undefined) plan.archived = Boolean(input.archived);
  plan.markModified("limits");
  plan.markModified("entitlements");
  await plan.save();
  // Every store on this plan may have just gained or lost something — and
  // the website's Pricing may show it.
  invalidateStorePlan();
  notifyWebsite();
  // if the plan just lost WhatsApp chat, every store on it loses its linked numbers right now
  for (const b of await BrandModel.find({ planId: String(plan._id) }).select("_id").lean()) {
    await enforceWhatsAppPlan(b._id).catch((e) => logger.error({ err: e, brandId: String(b._id) }, "could not unlink WhatsApp numbers after a plan change"));
  }
  return shapePlan(plan.toObject());
}

/* ----------------------------------------------------------------- settings */

/** Platform-wide settings, plus the domain store addresses are built on (a server setting: STORE_SUBDOMAIN_BASE). */
export const getSettings = async () => ({ ...(await platformSettings()), subdomainBase: configuredBase() });

export async function updateSettings({ graceDays, realtimeWebsocket }) {
  // saved through the settings snapshot, so every reader of it (plan checks, the cache) sees the change at once
  await savePlatformConfig({
    ...(graceDays !== undefined ? { graceDays } : {}),
    ...(realtimeWebsocket !== undefined ? { realtimeWebsocket } : {}),
  });
  invalidateStorePlan();
  return getSettings();
}

/* ------------------------------------------------------------------- stores */

/** A store's status in one word — what the stores list and overview flag. */
function statusOf(plan) {
  if (!plan.grace.over) return "ok";
  return plan.grace.ended ? "over-limit" : "grace";
}

/** `{ at, message }` while the platform has the store switched off, otherwise null. (Separate from `status`, which is about plan limits.) */
const shapeDisabled = (brand) => (brand.disabled ? { at: brand.disabled.at, message: brand.disabled.message ?? "" } : null);

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
    /** switched off by the platform (late payment, say) — see setStoreDisabled */
    disabled: shapeDisabled(brand),
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
    /** the plans it has left, with what it had set up on each: going back to one restores that */
    planHistory: planHistoryList(brand),
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
    /** the store's Rasoi Pulse address (acme.<base>), and whether its plan lets it have an own domain too */
    subdomain: await subdomainInfo(String(brand._id)),
    canUseOwnDomain: hasFeature(plan.entitlements, "customDomain"),
  };
}

/** Set the domains a store's storefront is served on, and its main one. */
export async function updateStoreDomains(id, input) {
  await loadBrand(id);
  await assertStoreMayAddDomains(id, normalizeHostnames(input.hostnames));
  await setStoreDomains(id, input);
  return getStore(id);
}

/** Give the store a Rasoi Pulse address, change it, or take it away (subdomains.js has the rules). */
export async function setSubdomain(id, label) {
  await loadBrand(id);
  await setStoreSubdomain(id, label);
  return getStore(id);
}

export async function removeSubdomain(id) {
  await loadBrand(id);
  await removeStoreSubdomain(id);
  return getStore(id);
}

/**
 * A store on a custom plan always carries its own limits. Any it's missing
 * are set to what it uses right now (at least the owner and one outlet, and
 * its tables rounded up to the next five), so putting a store on a custom
 * plan never pushes it over its limits.
 */
async function fillCustomLimits(brand) {
  if (!brand.planId) return;
  const plan = await PlanModel.findById(brand.planId).select("custom").lean();
  if (!plan?.custom) return;
  const o = planOverridesSchema.parse(brand.overrides ?? {});
  const missing = ["maxUsers", "multiOutlet", "maxOutlets", "maxTables"].filter((k) => o.limits[k] === undefined);
  if (!missing.length) return;
  const [users, outlets, tables] = await Promise.all([countActiveUsers(brand._id), countActiveOutlets(brand._id), countTables(brand._id)]);
  const now = { maxUsers: Math.max(1, users), multiOutlet: outlets > 1, maxOutlets: Math.max(1, outlets), maxTables: roundUpTables(tables) };
  for (const k of missing) o.limits[k] = now[k];
  brand.overrides = o;
  brand.markModified("overrides");
}

/** In words, what a saved set of per-store settings holds: the limits set by hand and the features unlocked or locked. */
export function summarizeOverrides(overrides) {
  const o = planOverridesSchema.safeParse(overrides ?? {});
  if (!o.success) return { limits: {}, unlocked: [], locked: [], empty: true };
  const limits = Object.fromEntries(Object.entries(o.data.limits).filter(([, v]) => v !== undefined));
  const unlocked = o.data.entitlements.features.unlock ?? [];
  const locked = o.data.entitlements.features.lock ?? [];
  return { limits, unlocked, locked, empty: !Object.keys(limits).length && !unlocked.length && !locked.length };
}

const historyOf = (brand) => (brand.planHistory && typeof brand.planHistory === "object" ? brand.planHistory : {});

/** The plans this store has left, newest first, with what it had set up on each (so the console can say what going back would restore). */
export const planHistoryList = (brand) =>
  Object.entries(historyOf(brand))
    .map(([planId, h]) => ({ planId, planName: h.planName ?? "", leftAt: h.leftAt ?? null, saved: summarizeOverrides(h.overrides), overrides: planOverridesSchema.catch({ limits: {}, entitlements: {} }).parse(h.overrides ?? {}) }))
    .sort((a, b) => new Date(b.leftAt ?? 0) - new Date(a.leftAt ?? 0));

/**
 * Assign a plan (or `null` for unlimited) and set this store's overrides on top of it.
 *
 * Each plan keeps its own settings for a store. When the store LEAVES a plan, what it had set up there (limits set by hand, features unlocked or
 * locked) is saved under that plan; when it comes BACK to a plan it had before, those settings are restored; a plan it never had starts clean.
 * Overrides sent with the same request always win (the admin chose them). Returns `{ store, planChange }`; `planChange` says what happened.
 */
export async function setStorePlan(id, { planId, overrides }) {
  const brand = await BrandModel.findById(id);
  if (!brand) throw new HttpError(404, "Store not found");
  let planChange = null;

  if (planId !== undefined && planId !== (brand.planId ?? null)) {
    if (planId !== null) {
      const plan = await PlanModel.findById(planId).lean();
      if (!plan) throw new HttpError(400, "That plan doesn't exist");
      if (plan.archived) throw new HttpError(400, "That plan is archived and can't be assigned");
    }
    const from = brand.planId ?? null;
    const history = { ...historyOf(brand) };
    if (from) {
      const left = await PlanModel.findById(from).select("name").lean();
      history[from] = { overrides: brand.overrides ?? {}, planName: left?.name ?? history[from]?.planName ?? "", leftAt: new Date() };
    }
    const back = planId ? history[planId] : null;
    const had = summarizeOverrides(brand.overrides);
    brand.planId = planId;
    if (overrides === undefined) brand.overrides = back ? back.overrides : {};
    brand.planHistory = history;
    brand.markModified("planHistory");
    planChange = {
      from,
      to: planId,
      savedPrevious: Boolean(from) && !had.empty, // what it had on the plan it left is kept
      restored: false, // (decided below, once the settings that will be kept are known)
      restoredFrom: back ? { planName: back.planName ?? "", leftAt: back.leftAt ?? null, saved: summarizeOverrides(back.overrides) } : null,
      clearedOnNewPlan: false,
      _had: had, // (dropped below)
      _back: back ?? null,
    };
  } else if (planId !== undefined) {
    brand.planId = planId;
  }
  if (overrides !== undefined) {
    brand.overrides = planOverridesSchema.parse(overrides);
    brand.markModified("overrides");
  }
  if (brand.isModified("overrides") || planChange) brand.markModified("overrides");
  if (planChange) {
    // What counts as "restored" is what the store ends up with, not how it got there: the console sends the settings it already filled in from
    // the saved ones, the app sends only the plan. Either way, if the store now has exactly what it had on that plan, they are back.
    const now = summarizeOverrides(brand.overrides);
    const saved = planChange._back ? summarizeOverrides(planChange._back.overrides) : null;
    const same = (a, b) => JSON.stringify([Object.entries(a.limits).sort(), [...a.unlocked].sort(), [...a.locked].sort()]) === JSON.stringify([Object.entries(b.limits).sort(), [...b.unlocked].sort(), [...b.locked].sort()]);
    planChange.restored = Boolean(saved) && !saved.empty && same(now, saved);
    planChange.clearedOnNewPlan = !planChange._back && now.empty && !planChange._had.empty; // its earlier settings do not carry over to a plan it never had
    delete planChange._had;
    delete planChange._back;
  }
  await fillCustomLimits(brand);
  await brand.save();
  invalidateStorePlan(id);
  // lost WhatsApp chat (new plan, or a lock on this store)? its linked numbers are unlinked right now
  await enforceWhatsAppPlan(id).catch((e) => logger.error({ err: e, brandId: id }, "could not unlink WhatsApp numbers after a plan change"));
  return { store: await getStore(id), planChange };
}

/**
 * Rename a store. The store's name is the one shown in every storefront header, on receipts and in customer messages;
 * only the platform admin can change it (there is no owner route for it). Writing the brand clears the caches that hold it.
 */
export async function renameStore(id, name) {
  const brand = await BrandModel.findById(id);
  if (!brand) throw new HttpError(404, "Store not found");
  brand.name = name;
  await brand.save();
  invalidateStorePlan(id);
  return getStore(id);
}

/* ------------------------------------------------ switching a whole store off */

const OBJECT_ID = /^[0-9a-f]{24}$/i;

/** Orders a kitchen would still be working on: not finished, not cancelled, and not an online order still waiting for its payment. */
const IN_PROGRESS = {
  status: { $in: ["placed", "accepted", "preparing", "ready", "out_for_delivery"] },
  $or: [{ "payment.gateway": "cod" }, { "payment.status": { $ne: "pending" } }],
};

async function loadStoreById(id) {
  if (!OBJECT_ID.test(String(id))) throw new HttpError(404, "Store not found");
  const brand = await BrandModel.findById(id);
  if (!brand) throw new HttpError(404, "Store not found");
  return brand;
}

/**
 * Switch a whole store off — or back on. For a store that hasn't paid: customers see "temporarily
 * unavailable" and can't order, and the store's team can't use the dashboard (they see `message`
 * instead). NOTHING is deleted; turning the store back on restores everything exactly as it was.
 *
 * Disabling a store that is already disabled only updates the message (and keeps the original date).
 * Both directions are safe to repeat.
 */
export async function setStoreDisabled(id, disabled, { message, byUserId } = {}) {
  const brand = await loadStoreById(id);
  if (disabled) {
    brand.disabled = {
      at: brand.disabled?.at ?? new Date(),
      by: brand.disabled?.by ?? byUserId,
      message: String(message ?? "").trim().slice(0, 500),
    };
  } else {
    brand.disabled = null;
  }
  await brand.save(); // a write to the store: this process drops everything cached about it at once
  invalidateStorePlan(id);
  // …and the other API processes sharing this database hear about it within ~30 seconds
  await expireStore(id);
  // its team stops receiving live orders right now, not whenever they next reconnect
  if (disabled) dropStoreTeam(String(brand._id));
  return getStore(id);
}

/** What switching a store off affects right now — shown in the confirmation. */
export async function disableSummary(id) {
  const brand = await loadStoreById(id);
  const brandId = String(brand._id);
  const [outlets, people, ordersInProgress] = await Promise.all([
    OutletModel.countDocuments({ brandId, blocked: null }),
    UserModel.countDocuments({ isActive: true, memberships: { $elemMatch: { brandId, blockedAt: null } } }),
    OrderModel.countDocuments({ brandId, ...IN_PROGRESS }),
  ]);
  return { store: { id: brandId, name: brand.name }, disabled: shapeDisabled(brand), counts: { outlets, people, ordersInProgress } };
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
