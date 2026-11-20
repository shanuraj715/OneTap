import { Router } from "express";
import { z } from "zod";
import { requireOutletContext } from "../../middleware/auth.js";
import { requireFeature } from "../platform/plan.service.js";
import { listFeedback } from "./feedback.service.js";

export const feedbackRouter = Router();

/** The outlet's ratings and comments (Ratings page). Needs `feedback:read` and the plan's "Ratings & feedback". */
feedbackRouter.get("/", async (req, res) => {
  const ctx = await requireOutletContext(req, "feedback:read");
  await requireFeature(ctx.brandId, "feedback", "Ratings & feedback");
  const q = z
    .object({
      days: z.coerce.number().int().min(1).max(365).default(30),
      stars: z.string().optional(),
      withComment: z.enum(["1", "0", "true", "false"]).optional(),
      before: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(100).default(30),
    })
    .parse(req.query);
  const stars = (q.stars ?? "").split(",").map(Number).filter((n) => n >= 1 && n <= 5);
  const before = q.before ? new Date(q.before) : undefined;
  res.json(await listFeedback(ctx, { days: q.days, stars, withComment: q.withComment === "1" || q.withComment === "true", before: before && !Number.isNaN(before.getTime()) ? before : undefined, limit: q.limit }));
});
