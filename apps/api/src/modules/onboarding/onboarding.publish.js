import {
  forcedOverrides,
  lookPatch,
  onboardingOutletSlug,
  onboardingSchema,
  onboardingSubdomain,
  outletConfigPatch,
  planAllowances,
  planFit,
  slugifyName,
  validateOnboarding,
} from "@onetap/config-schema";
import { OnboardingModel } from "@onetap/db";
import { logger } from "../../logger.js";
import { HttpError } from "../../middleware/error.js";
import { createBrand } from "../brands/brands.service.js";
import { createOutlet, updateOutletConfig } from "../outlets/outlets.service.js";
import * as platform from "../platform/platform.service.js";
import { deleteStore } from "../platform/store-delete.service.js";
import { ensureCustomPlan, planOf, serverChecks } from "./onboarding.service.js";

const OBJECT_ID = /^[0-9a-f]{24}$/i;

/**
 * Turn a finished form into a real store: the brand with its first outlet and its owner, the other outlets, each outlet's own
 * settings, the plan with the per-store extras that were added for this client, the store-wide look, and the own domain if there is one.
 *
 * It either all happens or none of it does: if anything fails after the store exists, the half-built store is deleted again
 * and the form stays a draft with the reason.
 */
export async function publishForm(id, { ownerPassword }, userId) {
  if (!OBJECT_ID.test(String(id))) throw new HttpError(404, "That form doesn't exist");
  const doc = await OnboardingModel.findById(id);
  if (!doc) throw new HttpError(404, "That form doesn't exist");
  if (doc.status === "published") throw new HttpError(409, "This form has already been published as a store.");

  const data = onboardingSchema.parse(doc.data ?? {});
  let plan = await planOf(data);
  const allow = planAllowances(plan, data);

  // everything that would stop it, before anything is created
  const errors = validateOnboarding(data);
  if (data.planId && !plan) errors.push({ path: "planId", message: "That plan is archived or no longer exists — choose another." });
  if (String(ownerPassword ?? "").length < 8) errors.push({ path: "ownerPassword", message: "Give the owner a password of at least 8 characters." });
  const fit = planFit(data, allow);
  const server = errors.length ? [] : await serverChecks(data);
  if (errors.length || server.length || fit.blocking) {
    const first = errors[0]?.message ?? server[0]?.message ?? fit.issues.find((i) => !i.forced)?.message ?? "The form isn't ready to publish.";
    throw new HttpError(422, first, { errors, server, fit });
  }

  // "Custom" may only exist as a stand-in so far: the store needs the real plan to be on
  if (plan && !plan._id) plan = await ensureCustomPlan();

  const first = data.outlets[0];
  const created = await createBrand({
    brandName: data.business.storeName.trim(),
    brandSlug: slugifyName(data.business.storeName),
    outletName: first.name.trim(),
    outletSlug: onboardingOutletSlug(first),
    hostnames: [],
    subdomain: onboardingSubdomain(data),
    ownerEmail: data.business.ownerEmail.trim(),
    ownerName: data.business.ownerName.trim(),
    ownerPassword,
    planId: String(plan._id),
  });
  const brandId = String(created.brand._id);
  const ctx = { brandId };

  try {
    // 1) the plan and what was allowed beyond it — first, so the later steps (an effect, an own domain) are permitted
    const overrides = forcedOverrides(data, allow);
    const hasExtras =
      overrides.entitlements.features.unlock.length || overrides.entitlements.effects.unlock.length || Object.keys(overrides.limits).length;
    if (hasExtras) await platform.setStorePlan(brandId, { planId: String(plan._id), overrides });

    // 2) the other outlets
    const outletIds = [String(created.outlet._id)];
    for (const o of data.outlets.slice(1)) {
      const made = await createOutlet(ctx, { name: o.name.trim(), slug: onboardingOutletSlug(o) }, { asPlatform: true });
      outletIds.push(String(made._id ?? made.id));
    }

    // 3) each outlet's own settings
    for (const [i, o] of data.outlets.entries()) await updateOutletConfig(ctx, outletIds[i], outletConfigPatch(data, o));

    // 4) the look, which every outlet shares
    await updateOutletConfig(ctx, outletIds[0], lookPatch(data));

    // 5) the client's own domain, next to the TablePe address
    const own = data.address.ownDomain.trim();
    if (own) {
      const current = (await platform.getStore(brandId)).domains;
      await platform.updateStoreDomains(brandId, { hostnames: [...new Set([own, ...(current?.hostnames ?? [])])], primary: own });
    }
  } catch (err) {
    logger.error({ err, brandId, formId: id }, "publishing an onboarding form failed — removing the half-built store");
    await deleteStore(brandId, { confirmName: data.business.storeName.trim(), by: userId }).catch((e) => logger.error({ err: e, brandId }, "could not remove the half-built store"));
    throw err instanceof HttpError ? new HttpError(err.status, `Nothing was created. ${err.message}`, err.details) : new HttpError(500, "Nothing was created: something went wrong while setting up the store. Try again, or check the server log.");
  }

  doc.status = "published";
  doc.brandId = brandId;
  doc.publishedAt = new Date();
  doc.publishedBy = userId;
  await doc.save();
  return { formId: String(doc._id), store: await platform.getStore(brandId), ownerEmail: data.business.ownerEmail.trim().toLowerCase() };
}
