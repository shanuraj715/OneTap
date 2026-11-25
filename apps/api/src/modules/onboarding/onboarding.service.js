import {
  CUSTOM_PLAN_ID,
  VIRTUAL_CUSTOM_PLAN,
  planMarketingSchema,
  planSchema,
  pricingSchema,
  resolvePricing,
  onboardingSchema,
  onboardingSubdomain,
  planAllowances,
  planFit,
  slugifyName,
  validateOnboarding,
} from "@rasoipulse/config-schema";
import { BrandModel, OnboardingModel, PlanModel, PricingModel, UserModel } from "@rasoipulse/db";
import { HttpError } from "../../middleware/error.js";
import { assertHostnamesFree, normalizeHostnames } from "../outlets/domains.js";
import { checkLabel } from "../outlets/subdomains.js";

/** A form as the console lists it (without the whole form). */
function row(doc, plans) {
  const data = doc.data ?? {};
  return {
    id: String(doc._id),
    storeName: doc.storeName || "(not named yet)",
    repName: doc.repName ?? "",
    status: doc.status,
    planId: data.planId ?? "",
    planName: data.planId === CUSTOM_PLAN_ID ? "Custom" : (plans.get(data.planId ?? "")?.name ?? ""),
    outlets: Array.isArray(data.outlets) ? data.outlets.length : 0,
    brandId: doc.brandId ?? null,
    publishedAt: doc.publishedAt ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

const plansById = async () => new Map((await PlanModel.find({}).lean()).map((p) => [String(p._id), p]));

export async function listForms({ status } = {}) {
  const plans = await plansById();
  const docs = await OnboardingModel.find(status ? { status } : {}).sort({ updatedAt: -1 }).lean();
  return docs.map((d) => row(d, plans));
}

const OBJECT_ID = /^[0-9a-f]{24}$/i;
async function load(id) {
  if (!OBJECT_ID.test(String(id))) throw new HttpError(404, "That form doesn't exist");
  const doc = await OnboardingModel.findById(id);
  if (!doc) throw new HttpError(404, "That form doesn't exist");
  return doc;
}

export async function getForm(id) {
  const doc = await load(id);
  const plans = await plansById();
  return { ...row(doc.toObject(), plans), data: onboardingSchema.parse(doc.data ?? {}) };
}

/** Save the form. A half-filled form is fine — only publishing needs it complete. */
export async function saveForm(id, input, userId) {
  const data = onboardingSchema.parse(input);
  let doc;
  if (id) {
    doc = await load(id);
    if (doc.status === "published") throw new HttpError(409, "This form was published as a store and can't be changed. Start a new form for another client.");
  } else {
    doc = new OnboardingModel({ createdBy: userId });
  }
  doc.data = data;
  doc.markModified("data");
  doc.storeName = data.business.storeName.trim();
  doc.repName = data.meeting.repName.trim();
  doc.updatedBy = userId;
  await doc.save();
  return getForm(String(doc._id));
}

export async function deleteForm(id) {
  const doc = await load(id);
  if (doc.status === "published") throw new HttpError(409, "A published form is kept as the record of that store and can't be deleted.");
  await doc.deleteOne();
}

/**
 * The plan record the form's plan id points at (active only), or null. The id "custom" means "the Custom plan": the real
 * one when there is one, otherwise a stand-in that publishing turns into the real thing (see `ensureCustomPlan`).
 */
export async function planOf(data) {
  if (data.planId === CUSTOM_PLAN_ID) {
    const real = await PlanModel.findOne({ custom: true, archived: { $ne: true } }).sort({ createdAt: 1 }).lean();
    return real ?? { ...VIRTUAL_CUSTOM_PLAN, _id: null };
  }
  if (!data.planId || !OBJECT_ID.test(data.planId)) return null;
  const plan = await PlanModel.findById(data.planId).lean();
  return plan && !plan.archived ? plan : null;
}

/** The Custom plan as a stored record — created the first time it is needed, so it is always there to put a store on. */
export async function ensureCustomPlan() {
  const real = await PlanModel.findOne({ custom: true, archived: { $ne: true } }).sort({ createdAt: 1 }).lean();
  if (real) return real;
  const name = (await PlanModel.exists({ name: "Custom" })) ? "Custom (per client)" : "Custom";
  const doc = await PlanModel.create({
    ...planSchema.parse({ name, description: VIRTUAL_CUSTOM_PLAN.description, custom: true }),
    marketing: planMarketingSchema.parse({ show: true, price: "Custom", period: "", pitch: "Pick only what you need — we set up your account and features for you.", order: 90 }),
  });
  return doc.toObject();
}

/* ------------------------------------------------------------------------------------------------ the price list */

export async function getPricing() {
  const doc = await PricingModel.findOne({ key: "pricing" }).lean();
  return resolvePricing(doc?.data);
}

export async function savePricing(input, userId) {
  const data = resolvePricing(pricingSchema.parse(input));
  await PricingModel.findOneAndUpdate({ key: "pricing" }, { $set: { data, updatedBy: userId }, $setOnInsert: { key: "pricing" } }, { upsert: true });
  return data;
}

/**
 * Things only the server can know: is the name, address and owner email still free?
 * `[{ path, message }]`, in the same shape as the form's own checks.
 */
export async function serverChecks(data) {
  const out = [];
  const storeSlug = slugifyName(data.business.storeName);
  if (storeSlug && (await BrandModel.exists({ slug: storeSlug }))) {
    out.push({ path: "business.storeName", message: `A store called “${storeSlug}” already exists on Rasoi Pulse — change the store's name.` });
  }
  const label = onboardingSubdomain(data);
  if (label) {
    const r = await checkLabel(label, "");
    if (!r.available) out.push({ path: "address.subdomain", message: r.reason });
  }
  const own = data.address.ownDomain.trim();
  if (own) {
    try {
      const hosts = normalizeHostnames([own]);
      await assertHostnamesFree(hosts, "");
    } catch (err) {
      out.push({ path: "address.ownDomain", message: err.message });
    }
  }
  const email = data.business.ownerEmail.trim().toLowerCase();
  if (email && (await UserModel.exists({ email }))) {
    out.push({ path: "business.ownerEmail", message: "That email already has a Rasoi Pulse account. Use a different email for this owner (it becomes their sign-in)." });
  }
  return out;
}

/** Everything the console needs to show whether the form can be published, in one call. */
export async function checkForm(id) {
  const doc = await load(id);
  const data = onboardingSchema.parse(doc.data ?? {});
  const plan = await planOf(data);
  const allow = planAllowances(plan, data);
  const errors = validateOnboarding(data);
  if (data.planId && !plan) errors.push({ path: "planId", message: "That plan is archived or no longer exists — choose another." });
  const fit = planFit(data, allow);
  const server = errors.length ? [] : await serverChecks(data);
  return { errors, server, fit, ready: errors.length === 0 && server.length === 0 && !fit.blocking && doc.status === "draft" };
}
