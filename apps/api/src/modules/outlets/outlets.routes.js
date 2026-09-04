import { Router } from "express";
import { z } from "zod";

import { requireBrandContext, requireOutletContext } from "../../middleware/auth.js";
import { HttpError } from "../../middleware/error.js";
import {
  createOutlet,
  deleteOutlet,
  getOutletById,
  listAllOutlets,
  listOutlets,
  resolveBrandForHost,
  resolveOutlet,
  updateOutlet,
  updateOutletConfig,
} from "./outlets.service.js";

export const outletsRouter         = Router();

/** Public: resolve the outlet for a storefront request. */
outletsRouter.get("/resolve", async (req, res) => {
  const host = typeof req.query.host === "string" ? req.query.host : undefined;
  const slug = typeof req.query.slug === "string" ? req.query.slug : undefined;
  const id = typeof req.query.id === "string" && req.query.id ? req.query.id : undefined;
  const outlet = await resolveOutlet({ host, slug, id });
  if (!outlet) throw new HttpError(404, "No outlet for that host");
  res.json({ outlet });
});

/** Public: which brand a hostname belongs to, and every outlet under it — the storefront's root-page resolution. */
outletsRouter.get("/for-host", async (req, res) => {
  const host = typeof req.query.host === "string" ? req.query.host : "";
  const resolved = host ? await resolveBrandForHost(host) : null;
  if (!resolved) throw new HttpError(404, "No brand for that host");
  res.json(resolved);
});

/** Outlets the signed-in user can reach. */
outletsRouter.get("/", async (req, res) => {
  if (req.user?.isSuperAdmin) {
    res.json({ outlets: await listAllOutlets(), scope: "all" });
    return;
  }
  const { brandId } = requireBrandContext(req, "outlet:read");
  res.json({ outlets: await listOutlets({ brandId }) });
});

const createOutletBody = z.object({
  name: z.string().min(1).max(80),
  slug: z.string().min(1).max(63),
  hostnames: z.array(z.string()).optional(),
});

/** A new outlet for the caller's brand (or, for a super admin, whichever brand they've selected). */
outletsRouter.post("/", async (req, res) => {
  const ctx = requireBrandContext(req, "outlet:manage");
  const body = createOutletBody.parse(req.body);
  const outlet = await createOutlet(ctx, body);
  res.status(201).json({ outlet });
});

outletsRouter.get("/:id", async (req, res) => {
  const ctx = await requireOutletContext(req, "outlet:read");
  const outlet = await getOutletById(ctx, req.params.id);
  if (!outlet) throw new HttpError(404, "Outlet not found");
  res.json({ outlet });
});

const updateOutletBody = z.object({
  name: z.string().min(1).max(80).optional(),
  slug: z.string().min(1).max(63).optional(),
  hostnames: z.array(z.string()).optional(),
});

/** Rename an outlet, or move it to a new slug/hostname list. */
outletsRouter.patch("/:id", async (req, res) => {
  const ctx = await requireOutletContext(req, "outlet:manage");
  const body = updateOutletBody.parse(req.body);
  const outlet = await updateOutlet(ctx, req.params.id, body);
  res.json({ outlet });
});

/** Remove an outlet. Refused for a brand's last outlet, or one with order history. */
outletsRouter.delete("/:id", async (req, res) => {
  const ctx = await requireOutletContext(req, "outlet:manage");
  await deleteOutlet(ctx, req.params.id);
  res.status(204).end();
});

const configPatchSchema = z.record(z.string(), z.unknown());

/** Each config area has its own permission, so a Content Editor can't touch payments. */
const AREA_PERMISSIONS                             = {
  theme: "theme:update",
  typography: "theme:update",
  layout: "appearance:update",
  identity: "settings:update",
  // Opening hours, missed-order alerts, prep times and order handling all live
  // under settings — a content editor must not be able to switch off the alerts.
  operations: "settings:update",
  features: "settings:update",
  tax: "settings:update",
  // The menu layout is a storefront-appearance concern.
  menuLayout: "appearance:update",
  // Rates and rules, not the credentials that actually send anything.
  wallet: "settings:update",
  orderNotify: "notification-config:manage",
  capacity: "settings:update",
  dashboard: "dashboard:configure",
};

outletsRouter.patch("/:id/config", async (req, res) => {
  const patch = configPatchSchema.parse(req.body);
  const areas = Object.keys(patch);
  const needed               = areas.map((a) => AREA_PERMISSIONS[a] ?? "outlet:update");

  // Check every area the patch touches.
  let ctx = await requireOutletContext(req, needed[0]);
  for (const permission of needed.slice(1)) ctx = await requireOutletContext(req, permission);

  const config = await updateOutletConfig(ctx, req.params.id, patch);
  res.json({ config });
});
