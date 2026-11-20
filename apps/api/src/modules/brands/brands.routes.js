import { Router } from "express";
import { z } from "zod";
import { requireSuperAdmin } from "../../middleware/auth.js";
import { createBrand, listBrands } from "./brands.service.js";
import { limiter } from "../../middleware/rate-limit.js";

export const brandsRouter = Router();

brandsRouter.get("/", async (req, res) => {
  requireSuperAdmin(req);
  res.json({ brands: await listBrands() });
});

const createBrandBody = z.object({
  brandName: z.string().min(1).max(80),
  brandSlug: z.string().min(1).max(63),
  outletName: z.string().min(1).max(80),
  outletSlug: z.string().min(1).max(63),
  /** the store's own domain(s) — needs a plan with "Own domain name" */
  hostnames: z.array(z.string().min(1)).default([]),
  /** the store's TablePe address, the part before the base domain ("acme" for acme.tablepe.in) */
  subdomain: z.string().max(60).optional(),
  ownerEmail: z.string().email(),
  ownerName: z.string().min(1),
  ownerPassword: z.string().min(8, "Use at least 8 characters"),
  /** the plan this store starts on — omit for an unlimited (no-plan) store */
  planId: z.string().min(1).nullable().optional(),
}).refine((b) => b.hostnames.length > 0 || b.subdomain?.trim(), { message: "Give the store a TablePe address or an own domain", path: ["subdomain"] });

brandsRouter.post("/", limiter("destructive"), async (req, res) => {
  requireSuperAdmin(req);
  const body = createBrandBody.parse(req.body);
  const result = await createBrand(body);
  res.status(201).json(result);
});
