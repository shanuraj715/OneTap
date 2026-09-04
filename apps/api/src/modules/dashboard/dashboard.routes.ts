import { Router } from "express";
import { requireOutletContext } from "../../middleware/auth";
import { getDashboardStats } from "./dashboard.service";

export const dashboardRouter: Router = Router();

/**
 * One payload for every widget. Gated on `order:read` — every role that can
 * see the Orders page can see the dashboard's numbers; the admin's own
 * per-widget role list (Settings → Dashboard) then decides what each role's
 * dashboard actually *shows*. That's a visibility setting, not a second
 * access-control layer — a role with `order:read` could always see this data
 * via the Orders page anyway, so nothing here is exposed that wasn't already.
 */
dashboardRouter.get("/stats", async (req, res) => {
  const ctx = await requireOutletContext(req, "order:read");
  res.json(await getDashboardStats(ctx));
});
