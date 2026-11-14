import { outletLimit, resolvePlan, userLimit } from "@onetap/config-schema";
import { BrandModel, OutletModel, PlanModel, PlatformSettingsModel, UserModel } from "@onetap/db";
import { HttpError } from "../../middleware/error.js";

/**
 * What a store is allowed — its plan's limits and entitlements with the
 * store's own overrides on top — plus how much of it the store is using and
 * whether it's in a grace period after going over.
 *
 * Read on hot paths (every order, every config read on the storefront), so
 * it's cached briefly in-process and invalidated on every write that can
 * change it. A store with no plan is a legacy store: unlimited, everything
 * unlocked, never over limit.
 */

const TTL_MS = 30_000;
const cache = new Map();

export function invalidateStorePlan(brandId) {
  if (brandId) cache.delete(String(brandId));
  else cache.clear();
}

export async function platformSettings() {
  const doc = await PlatformSettingsModel.findOne({ key: "platform" }).lean();
  return { graceDays: doc?.graceDays ?? 30, subdomainBase: doc?.subdomainBase ?? "" };
}

/** People counted toward the limit: everyone with access to the store — owners included — who isn't blocked or deactivated. */
export function countActiveUsers(brandId) {
  return UserModel.countDocuments({
    isActive: true,
    memberships: { $elemMatch: { brandId: String(brandId), blockedAt: null } },
  });
}

/** Outlets counted toward the limit: every outlet that isn't blocked. */
export function countActiveOutlets(brandId) {
  return OutletModel.countDocuments({ brandId: String(brandId), blocked: null });
}

export async function storePlan(brandId) {
  const key = String(brandId);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const brand = await BrandModel.findById(key).lean();
  if (!brand) throw new HttpError(404, "Store not found");

  const plan = brand.planId ? await PlanModel.findById(brand.planId).lean() : null;
  const { limits, entitlements } = resolvePlan(plan, brand.overrides);
  const [users, outlets, settings] = await Promise.all([countActiveUsers(key), countActiveOutlets(key), platformSettings()]);

  const maxUsers = userLimit(limits);
  const maxOutlets = outletLimit(limits);
  const over = users > maxUsers || outlets > maxOutlets;

  // Stamp the moment a store first goes over, and clear it once it's back
  // within its limits — the grace period counts from that stamp.
  let since = brand.overLimitSince ?? null;
  if (over && !since) {
    since = new Date();
    await BrandModel.updateOne({ _id: key, overLimitSince: null }, { $set: { overLimitSince: since } });
  } else if (!over && since) {
    since = null;
    await BrandModel.updateOne({ _id: key }, { $set: { overLimitSince: null } });
  }
  const until = since ? new Date(new Date(since).getTime() + settings.graceDays * 86_400_000) : null;

  const value = {
    brandId: key,
    plan: plan ? { id: String(plan._id), name: plan.name } : null,
    /** the look every outlet shares; null until the brand has one (outlets then use their own) */
    appearance: brand.appearance ?? null,
    limits,
    entitlements,
    usage: { users, outlets },
    max: { users: Number.isFinite(maxUsers) ? maxUsers : null, outlets: Number.isFinite(maxOutlets) ? maxOutlets : null },
    grace: { over, since, until, ended: Boolean(until && Date.now() > until.getTime()), days: settings.graceDays },
  };
  cache.set(key, { at: Date.now(), value });
  return value;
}

/** Throws a clear 403 when a plan doesn't unlock `feature` for this store. */
export async function requireFeature(brandId, feature, label) {
  const { entitlements } = await storePlan(brandId);
  if (!entitlements.features.includes(feature)) {
    throw new HttpError(403, `${label ?? "This feature"} isn't included in your plan.`);
  }
}
