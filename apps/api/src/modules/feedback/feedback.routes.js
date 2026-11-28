import { Router } from "express";
import { z } from "zod";
import { requireOutletContext } from "../../middleware/auth.js";
import { requireFeature } from "../platform/plan.service.js";
import { resolveOutlets } from "../analytics/analytics.service.js";
import { feedbackByCustomer, feedbackByItem, feedbackByOutlet, feedbackForItem, listFeedback } from "./feedback.service.js";

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

/**
 * The three ways of looking at ratings across the store: by outlet, by customer and by dish. Same rules as the list above (the plan's
 * "Ratings & feedback" and `feedback:read`), and `?outlets=a,b` narrows them to some of the outlets the person may see (none = all of them).
 */
async function viewOf(req) {
  const c = await requireOutletContext(req, "feedback:read");
  await requireFeature(c.brandId, "feedback", "Ratings & feedback");
  const ctx = { brandId: c.brandId, outletId: c.outletId };
  const raw = typeof req.query.outlets === "string" ? req.query.outlets : "";
  const wanted = raw && raw !== "all" ? raw.split(",").filter(Boolean).slice(0, 30) : [];
  const { ids, outlets: visible } = await resolveOutlets(ctx, req.user, wanted);
  // (`ids` is what was asked for — empty means every outlet the person may see)
  const outlets = ids.length ? visible.filter((o) => ids.includes(o.id)) : visible;
  const days = z.coerce.number().int().min(1).max(365).default(30).parse(req.query.days);
  return { ctx, outlets, days };
}

feedbackRouter.get("/by-outlet", async (req, res) => {
  const { ctx, outlets, days } = await viewOf(req);
  res.json(await feedbackByOutlet(ctx, { days, outlets }));
});

feedbackRouter.get("/by-customer", async (req, res) => {
  const { ctx, outlets, days } = await viewOf(req);
  const q = z.object({ search: z.string().max(60).default(""), sort: z.enum(["recent", "lowest", "highest", "most"]).default("recent"), page: z.coerce.number().int().min(1).max(10_000).default(1), limit: z.coerce.number().int().min(1).max(60).default(30) }).parse(req.query);
  res.json(await feedbackByCustomer(ctx, { days, outlets, ...q }));
});

feedbackRouter.get("/by-item", async (req, res) => {
  const { ctx, outlets, days } = await viewOf(req);
  const q = z.object({ search: z.string().max(60).default(""), sort: z.enum(["most", "best", "worst"]).default("most"), limit: z.coerce.number().int().min(1).max(200).default(50) }).parse(req.query);
  res.json(await feedbackByItem(ctx, { days, outlets, ...q }));
});

feedbackRouter.get("/by-item/:key", async (req, res) => {
  const { ctx, outlets, days } = await viewOf(req);
  res.json(await feedbackForItem(ctx, { key: req.params.key, days, outlets }));
});
