import { visibleWidgetsFor } from "@rasoipulse/config-schema";
import { Router } from "express";
import { requireOutletContext, requireUser, roleInBrand } from "../../middleware/auth.js";
import { outletConfigFor } from "../orders/orders.service.js";
import { storePlan } from "../platform/plan.service.js";
import { getDashboardStats } from "./dashboard.service.js";

export const dashboardRouter         = Router();

/**
 * The numbers behind the dashboard. Gated on `order:read` (every role with the Orders page has a dashboard), and then limited to what THIS person's
 * dashboard shows: the widgets the owner switched on for their role (Settings → Dashboard), that the role is allowed to read (revenue needs
 * `analytics:read`, coupons `coupon:read` …), and that the store's plan includes (no delivery numbers without Delivery). Only those are computed
 * and sent, so a cook calling this directly cannot read the day's revenue, and nobody is sent data for a widget they can't see.
 */
dashboardRouter.get("/stats", async (req, res) => {
  const ctx = await requireOutletContext(req, "order:read");
  const user = requireUser(req);
  const [plan, config] = await Promise.all([storePlan(ctx.brandId), outletConfigFor(ctx)]);
  const widgets = visibleWidgetsFor(config.dashboard, roleInBrand(user, ctx.brandId), plan.entitlements.features).map((w) => w.id);
  res.json(await getDashboardStats(ctx, { widgets }));
});
