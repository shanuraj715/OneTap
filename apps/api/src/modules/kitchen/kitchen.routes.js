import { Router } from "express";
import { z } from "zod";
import { kdsScreenSchema } from "@rasoipulse/config-schema";
import { requireOutletContext, requireUser } from "../../middleware/auth.js";
import { requireFeature } from "../platform/plan.service.js";
import { ITEM_STATES, kitchenSummary, listKitchenItems, listKitchenOrders, setItemState, setKitchenStage } from "./kitchen.service.js";

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

/** The manager's numbers for today (orders made ready, how long they took, what was cooked most). */
kitchenRouter.get("/summary", async (req, res) => {
  const ctx = await context(req, "order:read");
  res.json(await kitchenSummary(ctx));
});

/* Dishes — sold out / unavailable / available. Needs only `menu:read` to look and `menu:availability` to switch (the kitchen role has both);
   these are ordinary menu actions, so they don't need the "Kitchen display" plan feature. Putting a number on a counted dish is `menu:update`. */
kitchenRouter.get("/items", async (req, res) => {
  const ctx = await requireOutletContext(req, "menu:read");
  res.json(await listKitchenItems(ctx));
});

kitchenRouter.post("/items/:id/availability", async (req, res) => {
  const ctx = await requireOutletContext(req, "menu:availability");
  const body = z.object({ state: z.enum(ITEM_STATES), left: z.number().int().min(0).max(100000).optional() }).parse(req.body);
  if (body.left !== undefined) await requireOutletContext(req, "menu:update"); // a stock count is the manager's, not the cook's
  res.json({ item: await setItemState(ctx, requireUser(req), req.params.id, body.state, body.left) });
});
