import { defaultOutletConfig, isReservedOutletSlug, slugSchema } from "@onetap/config-schema";
import { BrandModel, OutletModel } from "@onetap/db";
import { HttpError } from "../../middleware/error.js";
import { ensureOwner } from "../auth/auth.service.js";

/** Every brand on the platform — for the superadmin's brand/outlet switcher. */
export async function listBrands() {
  return BrandModel.find({}).sort({ createdAt: 1 }).lean();
}

/**
 * A brand-new tenant: the Brand itself, its first Outlet, and an owner
 * account to sign into it with, in one call. This is the only place a Brand
 * ever gets created — restricted to the platform superadmin (see
 * brands.routes.js), since it's effectively onboarding a new restaurant onto
 * the platform.
 */
export async function createBrand(input) {
  const brandSlug = slugSchema.parse(input.brandSlug.toLowerCase());
  if (await BrandModel.exists({ slug: brandSlug })) {
    throw new HttpError(409, "A brand with that slug already exists");
  }

  const outletSlug = slugSchema.parse(input.outletSlug.toLowerCase());
  if (isReservedOutletSlug(outletSlug)) {
    throw new HttpError(400, `"${outletSlug}" is reserved and can't be used as an outlet slug`);
  }

  const brand = await BrandModel.create({
    name: input.brandName,
    slug: brandSlug,
    ownerEmail: input.ownerEmail.toLowerCase(),
  });

  // A brand with no outlet or no owner is useless and confusing to leave
  // behind — best-effort clean up if anything after this point fails.
  try {
    const hostnames = input.hostnames.filter(Boolean);
    const config = defaultOutletConfig();
    config.identity.name = input.outletName;

    const outlet = await OutletModel.create({
      brandId: String(brand._id),
      name: input.outletName,
      slug: outletSlug,
      hostnames,
      canonicalHostname: hostnames[0] ?? "",
      config,
    });

    const owner = await ensureOwner({
      brandId: String(brand._id),
      email: input.ownerEmail,
      name: input.ownerName,
      password: input.ownerPassword,
    });

    return { brand: brand.toObject(), outlet: outlet.toObject(), owner };
  } catch (err) {
    await BrandModel.deleteOne({ _id: brand._id }).catch(() => {});
    throw err;
  }
}
