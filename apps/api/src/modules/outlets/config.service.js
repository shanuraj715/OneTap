import { applyEntitlements, outletConfigSchema } from "@rasoipulse/config-schema";
import { OutletModel } from "@rasoipulse/db";
import { HttpError } from "../../middleware/error.js";
import { cache } from "../cache/cache.js";
import { storePlan } from "../platform/plan.service.js";

/**
 * The parts of an outlet's config that belong to the whole brand: every
 * outlet of a store looks the same. Stored once on `Brand.appearance`; an
 * outlet's own copy of these areas is only used until the brand has one.
 */
export const APPEARANCE_AREAS = ["theme", "typography", "effect", "layout", "branding"];

const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => obj?.[k] !== undefined).map((k) => [k, obj[k]]));

export async function brandPlan(brandId) {
  try {
    return await storePlan(brandId);
  } catch {
    // An outlet whose brand can't be read keeps behaving exactly as before:
    // its own appearance, nothing locked.
    return null;
  }
}

/** `ownerConfig` for a store plan that has already been fetched. */
export function ownerConfigWith(outlet, plan) {
  const config = outletConfigSchema.parse(outlet.config ?? {});
  if (!plan?.appearance) return config;
  return outletConfigSchema.parse({ ...config, ...pick(plan.appearance, APPEARANCE_AREAS) });
}

/** `effectiveConfig` for a store plan that has already been fetched. */
export function effectiveConfigWith(outlet, plan) {
  const config = ownerConfigWith(outlet, plan);
  return plan ? applyEntitlements(config, plan.entitlements) : config;
}

/** Defaults filled in, plus the brand's shared look — the OWNER's settings, as the admin edits them. */
export async function ownerConfig(outlet) {
  return ownerConfigWith(outlet, await brandPlan(outlet.brandId));
}

/**
 * What actually applies — the owner's settings limited to what the store's
 * plan unlocks. This is what customers and every order/payment/notification
 * path act on. The stored config is never changed by this.
 */
export async function effectiveConfig(outlet) {
  return effectiveConfigWith(outlet, await brandPlan(outlet.brandId));
}

/** `effectiveConfig` for the outlet in a request context. */
export async function effectiveOutletConfig(ctx) {
  // Order placement, payments, notifications, the kitchen screen and most customer routes all ask for this. The answer
  // (settings within the plan) only changes when the outlet, its store or its plan is written to, which drops it at once;
  // 30 seconds is the longest it is reused regardless. Each caller gets its own copy, so changing it can't leak.
  const found = await cache.wrap(
    `cfg:${ctx.outletId}`,
    async () => {
      const outlet = await OutletModel.findOne({ _id: ctx.outletId }, null, { allowGlobalQuery: true }).lean();
      return outlet ? { brandId: outlet.brandId, config: await effectiveConfig(outlet) } : null;
    },
    { cacheNull: false, maxAgeMs: 30_000, tags: (v) => (v ? [`brand:${v.brandId}`, "ns:cfg"] : []) },
  );
  if (!found) throw new HttpError(404, "Outlet not found");
  return structuredClone(found.config);
}

export const OUTLET_UNAVAILABLE = "This outlet is temporarily unavailable.";

/** Customers can't order from, or sit down at, a blocked outlet — or at any outlet of a store the platform has switched off. */
export async function assertOutletOpen(outletId) {
  const outlet = await OutletModel.findOne({ _id: outletId }, null, { allowGlobalQuery: true }).select("blocked brandId").lean();
  if (!outlet) throw new HttpError(404, "Outlet not found");
  if (outlet.blocked) throw new HttpError(423, OUTLET_UNAVAILABLE);
  if ((await brandPlan(outlet.brandId))?.disabled) throw new HttpError(423, OUTLET_UNAVAILABLE);
}
