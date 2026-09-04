import {
  defaultOutletConfig,
  deepMerge,
  outletConfigSchema,
                    
} from "@onetap/config-schema";
import {
  BrandModel,
  OutletModel,
                 
                     
} from "@onetap/db";
import { HttpError } from "../../middleware/error.js";
import { ensureOwner } from "../auth/auth.service.js";
import { clearMenu, seedGazabMomosMenu } from "../menu/menu.seed.js";

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
  return outlets.map(withDefaults);
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

function demoConfig() {
  const config = defaultOutletConfig();
  config.identity.name = "Gazab Momos";
  config.identity.tagline = "Steamed, fried, kurkure — Laxmi Nagar's favourite momos";
  config.identity.address = "J & K Block, Laxmi Nagar, New Delhi 110092";
  config.identity.phone = "+91 90000 00000";
  config.identity.fssaiLicense = "12345678901234";
  config.theme.light.colorPrimary = "#C6362F";
  // dev demo: cash plus the simulated gateway, so the online flow is exercisable
  config.payments.enabled = ["cod", "mock"];
  return config;
}

/**
 * Create the Gazab Momos demo brand + outlet. Idempotent. Pass `reset` to wipe
 * and recreate (dev only) — useful after schema changes.
 */
export async function seedGazabMomos(opts                      = {}) {
  let brand = await BrandModel.findOne({ slug: "gazab-momos" });
  brand ??= await BrandModel.create({
    name: "Gazab Momos",
    slug: "gazab-momos",
    ownerEmail: "owner@gazabmomos.example",
  });
  const brandId = String(brand._id);

  const hostnames = ["gazab-momos.localhost:3070", "localhost:3070"];
  let outlet = await OutletModel.findOne({ brandId, slug: "laxmi-nagar" });

  if (outlet && opts.reset) {
    await clearMenu({ brandId, outletId: String(outlet._id) });
    await OutletModel.deleteOne({ brandId, _id: outlet._id });
    outlet = null;
  }

  if (!outlet) {
    outlet = await OutletModel.create({
      brandId,
      name: "Gazab Momos — Laxmi Nagar",
      slug: "laxmi-nagar",
      hostnames,
      canonicalHostname: "gazab-momos.localhost:3070",
      config: demoConfig(),
    });
  } else {
    // keep an existing outlet's edits, but make sure dev hostnames resolve
    const missing = hostnames.filter((h) => !outlet .hostnames.includes(h));
    if (missing.length) {
      outlet.hostnames = [...outlet.hostnames, ...missing];
      await outlet.save();
    }
  }

  const menu = await seedGazabMomosMenu({ brandId, outletId: String(outlet._id) });

  // First owner account, so the admin has something to sign in with.
  const owner = await ensureOwner({
    brandId,
    email: "owner@gazabmomos.example",
    name: "Gazab Momos Owner",
    password: "momos1234",
  });

  return {
    brand: brand.toObject(),
    outlet: outlet.toObject(),
    menuSeeded: menu.created,
    owner: { email: owner.email, password: owner.created ? "momos1234" : "(unchanged)" },
  };
}
