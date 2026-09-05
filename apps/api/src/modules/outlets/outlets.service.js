import {
  deepMerge,
  defaultOutletConfig,
  isReservedOutletSlug,
  outletConfigSchema,
  slugSchema,
} from "@onetap/config-schema";
import {
  BrandModel,
  OrderModel,
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

/** Every outlet for one brand — public, unauthenticated (powers the storefront's outlet picker). */
export async function listOutletsForBrand(brandId        ) {
  const outlets = await OutletModel.find({ brandId }, null, { allowGlobalQuery: true }).sort({ createdAt: 1 }).lean();
  return outlets.map(withDefaults);
}

/**
 * The brand this hostname belongs to, and every outlet under it. Powers the
 * storefront root page's "no outlet in the URL yet" resolution: a
 * single-outlet brand redirects straight through with no picker shown; more
 * than one shows a picker built from this list.
 */
export async function resolveBrandForHost(host        ) {
  const anchor = await OutletModel.findOne({ hostnames: host }, null, { allowGlobalQuery: true }).lean();
  if (!anchor) return null;

  const brand = await BrandModel.findOne({ _id: anchor.brandId }).lean();
  if (!brand) return null;

  const outlets = await listOutletsForBrand(anchor.brandId);
  return {
    brand: { id: String(brand._id), name: brand.name, slug: brand.slug },
    outlets: outlets.map((o) => ({
      id: String(o._id),
      slug: o.slug,
      name: o.config.identity.name || o.name,
      address: o.config.identity.address || "",
      // null until the owner drops the map pin — lets the picker fall back to
      // the manual list for any outlet distance can't be computed for.
      location: o.config.identity.location?.point ?? null,
    })),
  };
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
    // The outlet's own name is what the picker/switcher fall back to when
    // the config hasn't set a storefront-facing name of its own.
    if (!outlet.config.identity.name) outlet.config.identity.name = input.name;
  }

  if (input.hostnames !== undefined) {
    const hostnames = input.hostnames.filter(Boolean);
    outlet.hostnames = hostnames;
    outlet.canonicalHostname = hostnames[0] ?? "";
  }

  outlet.markModified("config");
  await outlet.save();
  return withDefaults(outlet.toObject());
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

  // Multi-outlet: every outlet in a brand shares the same domain, so a plain
  // host lookup alone can't tell them apart. Resolve an "anchor" outlet by
  // host first (any outlet in the brand has the same hostnames), then find
  // the specific sibling by slug. Guarded to a bare (no "/") slug so this
  // can never collide with the "brandSlug/outletSlug" dev-fallback shape
  // below, which always has a slash.
  if (opts.host && opts.slug && !opts.slug.includes("/")) {
    const anchor = await OutletModel.findOne({ hostnames: opts.host }, null, { allowGlobalQuery: true }).lean();
    if (anchor) {
      const sibling = await OutletModel.findOne(
        { brandId: anchor.brandId, slug: opts.slug },
        null,
        { allowGlobalQuery: true },
      ).lean();
      return sibling ? (withDefaults(sibling)             ) : null;
    }
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

