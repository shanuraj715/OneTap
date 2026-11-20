import { z } from "zod";

/**
 * The Kitchen Display System (KDS): the kitchen's screen at /kitchen. Orders the team has accepted show up as cards,
 * split by where each dish is made (the same "Prepared at" kitchen / bar the kitchen tickets use). The cook taps
 * Start and then Ready; when every station an order needs is ready, the order itself becomes "Ready".
 */

/** Where one station is with one order. "new" = not started. */
export const KDS_STAGES = ["new", "preparing", "ready"];
export const kdsStageSchema = z.enum(KDS_STAGES);
export const KDS_STAGE_LABELS = { new: "New", preparing: "Preparing", ready: "Ready" };

/** Which screen: one station, or everything on one screen. */
export const KDS_SCREENS = ["all", "kitchen", "bar"];
export const kdsScreenSchema = z.enum(KDS_SCREENS);

/** The furthest-behind stage of the given ones (an order is only as ready as its slowest station). */
export function slowestStage(stages) {
  if (!stages.length) return "new";
  return KDS_STAGES[Math.min(...stages.map((s) => Math.max(0, KDS_STAGES.indexOf(s))))];
}

export const kitchenDisplaySettingsSchema = z.object({
  /** tell the waiter (a bell on their Take order screen / dashboard) when the kitchen marks a dish or an order ready */
  notifyWaiter: z.boolean().default(false),
  /** a card turns amber after this many minutes without being ready … */
  warnAfterMinutes: z.number().int().min(1).max(180).default(10),
  /** … and red after this many */
  lateAfterMinutes: z.number().int().min(2).max(240).default(20),
});
