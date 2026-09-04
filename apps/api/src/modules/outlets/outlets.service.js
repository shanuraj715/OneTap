import {
  deepMerge,
  defaultOutletConfig,
  isReservedOutletSlug,
  outletConfigSchema,
  slugSchema,
} from "@onetap/config-schema";
import {
  BrandModel,
  OutletModel,


} from "@onetap/db";
import { HttpError } from "../../middleware/error.js";

/**
 * The Outlet model is scoped by brandId only — it IS the outlet, so it has no
 * `outletId` of its own. (Models that live *under* an outlet use `tenantFilter`,
 * which also filters by outletId.)
 */
function byBrand(ctx               , extra                          = {}) {
  return { ...extra, brandId: ctx.brandId };
}

/**
 * Fill in anything the stored config predates.
 *
 * An outlet saved before a new settings group existed has no key for it, and a
 * client reading `config.operations.sla` would get a crash rather than a
 * default. Parsing on the way out means adding a settings group needs no
 * migration and no backfill — every outlet is upgraded as it is read.
 */
function withDefaults                                (outlet   )    {
  return { ...outlet, config: outletConfigSchema.parse(outlet.config ?? {}) };
}

/** Outlets for one brand — tenant-scoped. */
export async function listOutlets(ctx               ) {
  const outlets = await OutletModel.find(byBrand(ctx)).sort({ createdAt: 1 }).lean();
  return outlets.map(withDefaults);
}

/** Dev / super-admin view across all tenants — deliberately global. */
export async function listAllOutlets() {
  const outlets = await OutletModel.find({}, null, { allowGlobalQuery: true }).sort({ createdAt: 1 }).lean();
  const brands = await BrandModel.find({ _id: { $in: [...new Set(outlets.map((o) => o.brandId))] } }).lean();
  const brandNameById = new Map(brands.map((b) => [String(b._id), b.name]));
  return outlets.map((o) => ({ ...withDefaults(o), brandName: brandNameById.get(o.brandId) ?? "" }));
}

/**
 * A new physical location for a brand. Idempotent on slug: two outlets in
 * the same brand can never share one (matches the unique index). Hostnames
 * default to a sibling outlet's — every outlet in a brand shares the same
 * domain, distinguished by slug in the URL, not by hostname.
 */
export async function createOutlet(ctx               , input                                             ) {
  const slug = slugSchema.parse(input.slug.toLowerCase());
  if (isReservedOutletSlug(slug)) {
    throw new HttpError(400, `"${slug}" is reserved and can't be used as an outlet slug`);
  }

  const existing = await OutletModel.findOne(byBrand(ctx, { slug })).lean();
  if (existing) throw new HttpError(409, "An outlet with that slug already exists for this brand");

  let hostnames = input.hostnames?.filter(Boolean) ?? [];
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
  return withDefaults(outlet.toObject());
}

export async function getOutletById(ctx               , id        ) {
  const outlet = await OutletModel.findOne(byBrand(ctx, { _id: id })).lean();
  return outlet ? withDefaults(outlet) : null;
}

/**
 * Resolve the outlet for a public storefront request — by hostname, or by
 * "brandSlug/outletSlug" for local dev. Cross-tenant lookup by nature.
 */
export async function resolveOutlet(opts   
                
                
              
 )                            {
  if (opts.id) {
    const byId = await OutletModel.findOne({ _id: opts.id }, null, { allowGlobalQuery: true }).lean();
    return byId ? (withDefaults(byId)             ) : null;
  }
  if (opts.host) {
    const byHost = await OutletModel.findOne(
      { hostnames: opts.host },
      null,
      { allowGlobalQuery: true },
    ).lean();
    if (byHost) return withDefaults(byHost)             ;
  }

  if (opts.slug?.includes("/")) {
    const [brandSlug, outletSlug] = opts.slug.split("/");
    const brand = await BrandModel.findOne({ slug: brandSlug }).lean();
    if (!brand) return null;
    const bySlug = await OutletModel.findOne(
      { brandId: String(brand._id), slug: outletSlug },
      null,
      { allowGlobalQuery: true },
    ).lean();
    return bySlug ? (withDefaults(bySlug)             ) : null;
  }

  return null;
}

/** Deep-merge a partial config patch, re-validate, and persist. */
export async function updateOutletConfig(
  ctx               ,
  id        ,
  patch         ,
)                        {
  const outlet = await OutletModel.findOne(byBrand(ctx, { _id: id }));
  if (!outlet) throw new HttpError(404, "Outlet not found");

  const current = outletConfigSchema.parse(outlet.config ?? {});
  const next = outletConfigSchema.parse(deepMerge(current, patch));

  outlet.config = next;
  outlet.markModified("config");
  await outlet.save();
  return next;
}

