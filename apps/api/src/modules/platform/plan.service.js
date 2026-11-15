import { outletLimit, resolvePlan, userLimit } from "@onetap/config-schema";
import { BrandModel, OutletModel, PlanModel, UserModel } from "@onetap/db";
import { HttpError } from "../../middleware/error.js";
import { cache } from "../cache/cache.js";
import { platformConfig } from "../cache/platform-config.js";

/**
 * What a store is allowed — its plan's limits and entitlements with the
 * store's own overrides on top — plus how much of it the store is using,
 * whether it's in a grace period after going over, and whether the platform
 * has switched the whole store off (`disabled`).
 *
 * Read on hot paths (every order, every config read on the storefront), so
 * it's cached briefly in-process and invalidated on every write that can
 * change it. A store with no plan is a legacy store: unlimited, everything
 * unlocked, never over limit.
 *
 * The lifetime here is a fixed 30 seconds, whatever the cache setting says:
 * this is also what the plan-limit checks (add an outlet, add a person) rely
 * on, and those want a short safety net on top of the explicit invalidation.
 */

const PLAN_MS = 30_000;

/** Forget what is known about one store's plan — or, with no id, every store's (a plan or the grace period changed). */
export function invalidateStorePlan(brandId) {
  if (brandId) cache.expireTag(`brand:${String(brandId)}`);
  else cache.expireTags(["ns:plan", "ns:store", "ns:site", "ns:dash"]);
}

export async function platformSettings() {
  const { graceDays } = await platformConfig();
  return { graceDays };
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

export function storePlan(brandId) {
  const key = String(brandId);
  return cache.wrap(`plan:${key}`, () => loadStorePlan(key), { maxAgeMs: PLAN_MS, tags: [`brand:${key}`, "ns:plan"] });
}

async function loadStorePlan(key) {
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

  return {
    brandId: key,
    brand: { id: key, name: brand.name, slug: brand.slug },
    plan: plan ? { id: String(plan._id), name: plan.name } : null,
    /** the look every outlet shares; null until the brand has one (outlets then use their own) */
    appearance: brand.appearance ?? null,
    /** switched off by the platform (see Brand.disabled) — `{ at, message }`, or null while the store runs */
    disabled: brand.disabled ? { at: brand.disabled.at, message: brand.disabled.message ?? "" } : null,
    limits,
    entitlements,
    usage: { users, outlets },
    max: { users: Number.isFinite(maxUsers) ? maxUsers : null, outlets: Number.isFinite(maxOutlets) ? maxOutlets : null },
    grace: { over, since, until, ended: Boolean(until && Date.now() > until.getTime()), days: settings.graceDays },
  };
}

/** What the API says (and the admin looks for) when a store's team is turned away because the store is switched off. */
export const STORE_DISABLED = { status: 403, code: "store_disabled", message: "This store is disabled. Please contact TablePe to turn it back on." };

/**
 * Turns a store's team away while the platform has the store switched off. The platform's own super admin
 * never goes through this — that's how a disabled store is inspected, edited, re-enabled or deleted.
 *
 * Read from the store's cached plan: a change made through this API process shows at once (a store write
 * drops it), and one made through another process within 30 seconds.
 */
export async function assertStoreEnabled(brandId) {
  if ((await storePlan(brandId)).disabled) {
    throw new HttpError(STORE_DISABLED.status, STORE_DISABLED.message, { code: STORE_DISABLED.code });
  }
}

/** Throws a clear 403 when a plan doesn't unlock `feature` for this store. */
export async function requireFeature(brandId, feature, label) {
  const { entitlements } = await storePlan(brandId);
  if (!entitlements.features.includes(feature)) {
    throw new HttpError(403, `${label ?? "This feature"} isn't included in your plan.`);
  }
}
