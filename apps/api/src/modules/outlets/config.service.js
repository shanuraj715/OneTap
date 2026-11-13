import { applyEntitlements, outletConfigSchema } from "@onetap/config-schema";
import { OutletModel } from "@onetap/db";
import { HttpError } from "../../middleware/error.js";
import { storePlan } from "../platform/plan.service.js";

/**
 * The parts of an outlet's config that belong to the whole brand: every
 * outlet of a store looks the same. Stored once on `Brand.appearance`; an
 * outlet's own copy of these areas is only used until the brand has one.
 */
export const APPEARANCE_AREAS = ["theme", "typography", "effect", "layout"];

const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => obj?.[k] !== undefined).map((k) => [k, obj[k]]));

async function brandPlan(brandId) {
  try {
    return await storePlan(brandId);
  } catch {
    // An outlet whose brand can't be read keeps behaving exactly as before:
    // its own appearance, nothing locked.
    return null;
  }
}

/** Defaults filled in, plus the brand's shared look — the OWNER's settings, as the admin edits them. */
export async function ownerConfig(outlet) {
  const config = outletConfigSchema.parse(outlet.config ?? {});
  const plan = await brandPlan(outlet.brandId);
  if (!plan?.appearance) return config;
  return outletConfigSchema.parse({ ...config, ...pick(plan.appearance, APPEARANCE_AREAS) });
}

/**
 * What actually applies — the owner's settings limited to what the store's
 * plan unlocks. This is what customers and every order/payment/notification
 * path act on. The stored config is never changed by this.
 */
export async function effectiveConfig(outlet) {
  const config = await ownerConfig(outlet);
  const plan = await brandPlan(outlet.brandId);
  return plan ? applyEntitlements(config, plan.entitlements) : config;
}

/** `effectiveConfig` for the outlet in a request context. */
export async function effectiveOutletConfig(ctx) {
  const outlet = await OutletModel.findOne({ _id: ctx.outletId }, null, { allowGlobalQuery: true }).lean();
  if (!outlet) throw new HttpError(404, "Outlet not found");
  return effectiveConfig(outlet);
}

export const OUTLET_UNAVAILABLE = "This outlet is temporarily unavailable.";

/** Customers can't order from, or sit down at, a blocked outlet. */
export async function assertOutletOpen(outletId) {
  const outlet = await OutletModel.findOne({ _id: outletId }, null, { allowGlobalQuery: true }).select("blocked").lean();
  if (!outlet) throw new HttpError(404, "Outlet not found");
  if (outlet.blocked) throw new HttpError(423, OUTLET_UNAVAILABLE);
}
