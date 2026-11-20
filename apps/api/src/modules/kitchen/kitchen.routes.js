import { Router } from "express";
import { z } from "zod";
import { kdsScreenSchema } from "@onetap/config-schema";
import { requireOutletContext, requireUser } from "../../middleware/auth.js";
import { requireFeature } from "../platform/plan.service.js";
import { listKitchenOrders, setKitchenStage } from "./kitchen.service.js";

/**
 * The kitchen display's API. Reading needs `order:read`, tapping Start / Ready needs `order:update` (the kitchen role has
 * both), and the store's plan must include "Kitchen display".
 */
export const kitchenRouter = Router();

async function context(req, permission) {
  const ctx = await requireOutletContext(req, permission);
  await requireFeature(ctx.brandId, "kitchenDisplay", "Kitchen display");
  return ctx;
}

kitchenRouter.get("/orders", async (req, res) => {
  const ctx = await context(req, "order:read");
  const screen = kdsScreenSchema.catch("all").parse(req.query.screen);
  res.json(await listKitchenOrders(ctx, screen));
});

kitchenRouter.post("/orders/:id/stage", async (req, res) => {
  const ctx = await context(req, "order:update");
  const user = requireUser(req);
  const body = z.object({ screen: kdsScreenSchema.default("all"), stage: z.enum(["preparing", "ready"]) }).parse(req.body);
  res.json({ order: await setKitchenStage(ctx, user, req.params.id, body.screen, body.stage) });
});
