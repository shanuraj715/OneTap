import {
  deepMerge,
  effectAllowed,
  defaultOutletConfig,
  hasFeature,
  isReservedOutletSlug,
  outletConfigSchema,
  slugSchema,
} from "@rasoipulse/config-schema";
import {
  BrandModel,
  OrderModel,
  OutletModel,

} from "@rasoipulse/db";
import { HttpError } from "../../middleware/error.js";
import { invalidateStorePlan, storePlan } from "../platform/plan.service.js";
import { APPEARANCE_AREAS, ownerConfig } from "./config.service.js";
import { assertHostnamesFree, normalizeHostnames } from "./domains.js";
import { assertStoreMayAddDomains } from "./subdomains.js";
import { brandIdForHost, brandIdForSlug, publicOutletById, storefrontBundle } from "./outlet-cache.js";

/**
 * The Outlet model is scoped by brandId only — it IS the outlet, so it has no
 * `outletId` of its own. (Models that live *under* an outlet use `tenantFilter`,
 * which also filters by outletId.)
 */
function byBrand(ctx               , extra                          = {}) {
  return { ...extra, brandId: ctx.brandId };
}

/*
 * Every read parses the stored config, filling in any settings group the
 * outlet predates — so adding one needs no migration or backfill.
 */

/** For the admin: the owner's own settings, with the brand's shared look on top. */
async function forOwner(outlet) {
  return { ...outlet, config: await ownerConfig(outlet) };
}

/** Outlets for one brand — tenant-scoped. */
export async function listOutlets(ctx               ) {
  const [outlets, brand] = await Promise.all([
    OutletModel.find(byBrand(ctx)).sort({ createdAt: 1 }).lean(),
    BrandModel.findOne({ _id: ctx.brandId }).select("name").lean(),
  ]);
  // the STORE's name rides along: the dashboard shows it (read-only) in Settings; only the platform admin can change it
  return Promise.all(outlets.map(async (o) => ({ ...(await forOwner(o)), brandName: brand?.name ?? "" })));
}

/** Dev / super-admin view across all tenants — deliberately global. */
export async function listAllOutlets() {
  const outlets = await OutletModel.find({}, null, { allowGlobalQuery: true }).sort({ createdAt: 1 }).lean();
  const brands = await BrandModel.find({ _id: { $in: [...new Set(outlets.map((o) => o.brandId))] } }).lean();
  const brandNameById = new Map(brands.map((b) => [String(b._id), b.name]));
  return Promise.all(outlets.map(async (o) => ({ ...(await forOwner(o)), brandName: brandNameById.get(o.brandId) ?? "" })));
}

/**
 * The brand this hostname belongs to, and every outlet under it. Powers the
 * storefront root page's "no outlet in the URL yet" resolution: a
 * single-outlet brand redirects straight through with no picker shown; more
 * than one shows a picker built from this list. Served from the cache.
 */
export async function resolveBrandForHost(host        ) {
  const found = await brandIdForHost(host);
  if (!found) return null;
  const bundle = await storefrontBundle(found.brandId);
  return bundle?.forHost ?? null;
}

/**
 * A new physical location for a brand. Idempotent on slug: two outlets in
 * the same brand can never share one (matches the unique index). Hostnames
 * default to a sibling outlet's — every outlet in a brand shares the same
 * domain, distinguished by slug in the URL, not by hostname.
 */
export async function createOutlet(ctx               , input                                             , { asPlatform = false } = {}) {
  // The plan decides how many outlets a store may have (one, when multi-outlet
  // is off). The platform itself can always add one.
  if (!asPlatform) {
    const plan = await storePlan(ctx.brandId);
    if (!plan.limits.multiOutlet && plan.usage.outlets >= 1) {
      throw new HttpError(409, "Multiple outlets aren't included in your plan. Ask Rasoi Pulse to enable multi-outlet.");
    }
    if (plan.max.outlets !== null && plan.usage.outlets >= plan.max.outlets) {
      throw new HttpError(409, `Your plan allows ${plan.max.outlets} outlets and all are in use. Ask Rasoi Pulse to raise the limit.`);
    }
  }

  const slug = slugSchema.parse(input.slug.toLowerCase());
  if (isReservedOutletSlug(slug)) {
    throw new HttpError(400, `"${slug}" is reserved and can't be used as an outlet slug`);
  }

  const existing = await OutletModel.findOne(byBrand(ctx, { slug })).lean();
  if (existing) throw new HttpError(409, "An outlet with that slug already exists for this brand");

  let hostnames = normalizeHostnames(input.hostnames);
  await assertHostnamesFree(hostnames, ctx.brandId);
  await assertStoreMayAddDomains(ctx.brandId, hostnames);
  if (hostnames.length === 0) {
    const sibling = await OutletModel.findOne(byBrand(ctx)).sort({ createdAt: 1 }).lean();
    hostnames = sibling?.hostnames ?? [];
  }

  const config = defaultOutletConfig();
  config.identity.name = input.name;

  const outlet = await OutletModel.create({
    brandId: ctx.brandId,
    name: input.name,
    slug,
    hostnames,
    canonicalHostname: hostnames[0] ?? "",
    config,
  });
  invalidateStorePlan(ctx.brandId);
  return forOwner(outlet.toObject());
}

export async function getOutletById(ctx               , id        ) {
  const outlet = await OutletModel.findOne(byBrand(ctx, { _id: id })).lean();
  return outlet ? forOwner(outlet) : null;
}

/** Rename an outlet, or move it to a new slug/hostname list. */
export async function updateOutlet(ctx               , id        , input) {
  const outlet = await OutletModel.findOne(byBrand(ctx, { _id: id }));
  if (!outlet) throw new HttpError(404, "Outlet not found");

  if (input.slug !== undefined) {
    const slug = slugSchema.parse(input.slug.toLowerCase());
    if (isReservedOutletSlug(slug)) {
      throw new HttpError(400, `"${slug}" is reserved and can't be used as an outlet slug`);
    }
    if (slug !== outlet.slug) {
      const existing = await OutletModel.findOne(byBrand(ctx, { slug, _id: { $ne: id } })).lean();
      if (existing) throw new HttpError(409, "An outlet with that slug already exists for this brand");
    }
    outlet.slug = slug;
  }

  if (input.name !== undefined) {
    outlet.name = input.name;
    // The outlet's name is the one name the picker, receipts and messages show (Settings no longer has a second box for
    // it — "Store name" there is the whole store's), so renaming the outlet renames that display name too.
    outlet.config.identity.name = input.name;
    outlet.markModified("config");
  }

  if (input.hostnames !== undefined) {
    const hostnames = normalizeHostnames(input.hostnames);
    await assertHostnamesFree(hostnames, ctx.brandId);
    await assertStoreMayAddDomains(ctx.brandId, hostnames);
    outlet.hostnames = hostnames;
    outlet.canonicalHostname = hostnames[0] ?? "";
  }

  outlet.markModified("config");
  await outlet.save();
  return forOwner(outlet.toObject());
}

/**
 * Remove an outlet entirely. Refuses to remove a brand's last outlet (every
 * brand must have somewhere to resolve to), and refuses one with any order
 * history — the same "don't destroy real data, make them deal with it first"
 * rule menu.service.js already applies to a category with items in it.
 * Menu items, tables, printers etc. under a deleted outlet are left in
 * place rather than cascade-deleted — orphaned, but harmless, since nothing
 * can ever query them again without that outlet's id.
 */
export async function deleteOutlet(ctx               , id        ) {
  const outlet = await OutletModel.findOne(byBrand(ctx, { _id: id })).lean();
  if (!outlet) throw new HttpError(404, "Outlet not found");

  const siblingCount = await OutletModel.countDocuments(byBrand(ctx));
  if (siblingCount <= 1) {
    throw new HttpError(409, "Can't delete a brand's only outlet");
  }

  const hasOrders = await OrderModel.exists({ brandId: ctx.brandId, outletId: id });
  if (hasOrders) {
    throw new HttpError(409, "This outlet has order history and can't be deleted");
  }

  await OutletModel.deleteOne(byBrand(ctx, { _id: id }));
  invalidateStorePlan(ctx.brandId);
}

/**
 * Resolve the outlet for a public storefront request — by hostname, or by
 * "brandSlug/outletSlug" for local dev. Cross-tenant lookup by nature.
 * Served from the cache (see outlet-cache.js).
 */
export async function resolveOutlet(opts   
                
                
              
 )                            {
  if (opts.id) return publicOutletById(opts.id);

  // Multi-outlet: every outlet in a brand shares the same domain, so a plain
  // host lookup alone can't tell them apart. Resolve the brand by host first,
  // then find the specific sibling by slug. Guarded to a bare (no "/") slug so
  // this can never collide with the "brandSlug/outletSlug" dev-fallback shape
  // below, which always has a slash.
  if (opts.host && opts.slug && !opts.slug.includes("/")) {
    const found = await brandIdForHost(opts.host);
    if (found) {
      const bundle = await storefrontBundle(found.brandId);
      return bundle?.outlets.find((o) => o.slug === opts.slug) ?? null;
    }
  }

  if (opts.host) {
    const found = await brandIdForHost(opts.host);
    if (found) {
      const bundle = await storefrontBundle(found.brandId);
      const byHost = bundle?.outlets.find((o) => o.hostnames?.includes(opts.host)) ?? bundle?.outlets[0];
      if (byHost) return byHost;
    }
  }

  if (opts.slug?.includes("/")) {
    const [brandSlug, outletSlug] = opts.slug.split("/");
    const brandId = await brandIdForSlug(brandSlug);
    if (!brandId) return null;
    const bundle = await storefrontBundle(brandId);
    return bundle?.outlets.find((o) => o.slug === outletSlug) ?? null;
  }

  return null;
}

/**
 * Deep-merge a partial config patch, re-validate, and persist.
 *
 * The appearance areas (theme, typography, effect, layout) are shared by every
 * outlet of the brand, so they're written to `Brand.appearance` — saving the
 * theme from any outlet restyles all of them. Everything else stays on the
 * outlet. The first appearance save for a brand that has none yet starts from
 * this outlet's current look, so nothing visibly changes until the owner edits.
 */
export async function updateOutletConfig(
  ctx               ,
  id        ,
  patch         ,
)                        {
  const outlet = await OutletModel.findOne(byBrand(ctx, { _id: id }));
  if (!outlet) throw new HttpError(404, "Outlet not found");

  const appearancePatch = Object.fromEntries(Object.entries(patch).filter(([k]) => APPEARANCE_AREAS.includes(k)));
  const outletPatch = Object.fromEntries(Object.entries(patch).filter(([k]) => !APPEARANCE_AREAS.includes(k)));

  if (Object.keys(outletPatch).length) {
    const current = outletConfigSchema.parse(outlet.config ?? {});
    outlet.config = outletConfigSchema.parse(deepMerge(current, outletPatch));
    outlet.markModified("config");
    await outlet.save();
  }

  if (Object.keys(appearancePatch).length) {
    const plan = await storePlan(ctx.brandId);
    const style = appearancePatch.effect?.style;
    if (style && !effectAllowed(plan.entitlements, style)) {
      throw new HttpError(403, "That effect isn't included in your plan.");
    }
    if (appearancePatch.branding?.faviconUrl && !hasFeature(plan.entitlements, "favicon")) {
      throw new HttpError(403, "A favicon isn't included in your plan.");
    }
    const brand = await BrandModel.findOne({ _id: ctx.brandId });
    const ownLook = outletConfigSchema.parse(outlet.config ?? {});
    const base = brand.appearance ?? Object.fromEntries(APPEARANCE_AREAS.map((k) => [k, ownLook[k]]));
    const merged = outletConfigSchema.parse(deepMerge({ ...ownLook, ...base }, appearancePatch));
    brand.appearance = Object.fromEntries(APPEARANCE_AREAS.map((k) => [k, merged[k]]));
    brand.markModified("appearance");
    await brand.save();
    invalidateStorePlan(ctx.brandId);
  }

  return ownerConfig(outlet.toObject());
}
