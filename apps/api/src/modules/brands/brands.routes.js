import { Router } from "express";
import { z } from "zod";
import { requireUser } from "../../middleware/auth.js";
import { HttpError } from "../../middleware/error.js";
import { createBrand, listBrands } from "./brands.service.js";

export const brandsRouter = Router();

/**
 * Brands aren't tenant-scoped (there's no brand yet to check membership
 * against), so access here is a direct isSuperAdmin check — same pattern
 * already used for other platform-wide routes (e.g. the realtime hub).
 */
function requireSuperAdmin(req) {
  const user = requireUser(req);
  if (!user.isSuperAdmin) throw new HttpError(403, "Only a platform superadmin can do this");
  return user;
}

brandsRouter.get("/", async (req, res) => {
  requireSuperAdmin(req);
  res.json({ brands: await listBrands() });
});

const createBrandBody = z.object({
  brandName: z.string().min(1).max(80),
  brandSlug: z.string().min(1).max(63),
  outletName: z.string().min(1).max(80),
  outletSlug: z.string().min(1).max(63),
  hostnames: z.array(z.string().min(1)).min(1),
  ownerEmail: z.string().email(),
  ownerName: z.string().min(1),
  ownerPassword: z.string().min(8, "Use at least 8 characters"),
});

brandsRouter.post("/", async (req, res) => {
  requireSuperAdmin(req);
  const body = createBrandBody.parse(req.body);
  const result = await createBrand(body);
  res.status(201).json(result);
});
