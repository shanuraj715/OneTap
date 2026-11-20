import { Router } from "express";
import { requireOutletContext } from "../../middleware/auth.js";
import { cartReminderSettings, cartReminderStats, saveCartReminderSettings } from "./carts.service.js";

/**
 * Abandoned-cart reminders — one setting for the whole store (Settings → Cart reminders), plus what they achieved.
 * `settings:update` to see or change them; changing them needs the plan's "Abandoned-cart reminders".
 */
export const cartRemindersRouter = Router();

cartRemindersRouter.get("/", async (req, res) => {
  const ctx = await requireOutletContext(req, "settings:update");
  const [settings, stats] = await Promise.all([cartReminderSettings(ctx.brandId), cartReminderStats(ctx)]);
  res.json({ ...settings, stats });
});

cartRemindersRouter.put("/", async (req, res) => {
  const ctx = await requireOutletContext(req, "settings:update");
  const saved = await saveCartReminderSettings(ctx, req.body ?? {});
  res.json({ ...saved, stats: await cartReminderStats(ctx) });
});
