import { Router } from "express";
import { z } from "zod";
import { analyticsRangeSchema, permissionsForRole, DEFAULT_FOOD_COST_PCT, DEFAULT_STOCK_SAFETY_PCT, EXPORT_FORMATS, exportRequestSchema, EXPORT_SECTIONS, presetRange } from "@onetap/config-schema";
import { AnalyticsProfileModel, BrandModel } from "@onetap/db";
import { requireOutletContext } from "../../middleware/auth.js";
import { HttpError } from "../../middleware/error.js";
import { requireFeature } from "../platform/plan.service.js";
import { buildReport, toCsv, toJson, toPdf, toXlsx } from "./analytics.export.js";
import * as svc from "./analytics.service.js";
import { limiter } from "../../middleware/rate-limit.js";

/**
 * Analytics for the store dashboard. Needs the "Analytics & reports" plan feature and a role with analytics:read
 * (the owner, the accountant and managers); money figures — GST, the till, profit & loss, the saved expenses —
 * need analytics:finance (owner, accountant); files need analytics:export (owner, accountant).
 */
export const analyticsRouter = Router();
// every report runs aggregations over the store's order history
analyticsRouter.use(limiter("report"));

/** the signed-in person's role in this store */
const roleOf = (user, brandId) => (user.isSuperAdmin ? "super_admin" : (user.memberships?.find((m) => m.brandId === brandId)?.role ?? ""));

async function access(req, permission, outletsOverride) {
  const c = await requireOutletContext(req, permission);
  await requireFeature(c.brandId, "analytics", "Analytics");
  const ctx = { brandId: c.brandId, outletId: c.outletId };
  const raw = outletsOverride ?? (typeof req.query.outlets === "string" ? req.query.outlets : "");
  const wanted = raw && raw !== "all" ? raw.split(",").filter(Boolean).slice(0, 30) : [];
  const { ids, outlets } = await svc.resolveOutlets(ctx, req.user, wanted);
  return { ctx, ids, outlets, userId: String(req.user._id ?? req.user.id), role: roleOf(req.user, c.brandId) };
}

/** from & to come as ?from=2026-11-01&to=2026-11-30 (or ?preset=last30) */
function rangeOf(req) {
  const q = req.query;
  const r = q.preset ? presetRange(String(q.preset)) : { from: String(q.from ?? ""), to: String(q.to ?? "") };
  const parsed = analyticsRangeSchema.safeParse(r);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Pick a valid date range");
  return parsed.data;
}

/** who the person is for analytics: the outlets they may look at, and what they may open */
analyticsRouter.get("/options", async (req, res) => {
  const { outlets, role } = await access(req, "analytics:read");
  const perms = permissionsForRole(role);
  res.json({ outlets, canFinance: perms.includes("analytics:finance"), canExport: perms.includes("analytics:export"), formats: EXPORT_FORMATS.map(({ id, label, help }) => ({ id, label, help })), sections: EXPORT_SECTIONS, defaults: { foodCostPct: DEFAULT_FOOD_COST_PCT, safetyPct: DEFAULT_STOCK_SAFETY_PCT } });
});

analyticsRouter.get("/overview", async (req, res) => {
  const { ctx, ids } = await access(req, "analytics:read");
  res.json(await svc.overview(ctx, rangeOf(req), ids, { granularity: String(req.query.granularity ?? "") }));
});
analyticsRouter.get("/sales", async (req, res) => {
  const { ctx, ids, outlets } = await access(req, "analytics:read");
  res.json(await svc.salesReport(ctx, rangeOf(req), ids, { granularity: String(req.query.granularity ?? "") }, outlets));
});
analyticsRouter.get("/items", async (req, res) => {
  const { ctx, ids } = await access(req, "analytics:read");
  res.json(await svc.itemsReport(ctx, rangeOf(req), ids));
});
analyticsRouter.get("/stock", async (req, res) => {
  const { ctx, ids } = await access(req, "analytics:read");
  res.json(await svc.stockSuggestions(ctx, ids, { weeks: Number(req.query.weeks) || 6, safetyPct: req.query.safety === undefined ? DEFAULT_STOCK_SAFETY_PCT : Number(req.query.safety) }));
});
analyticsRouter.get("/customers", async (req, res) => {
  const { ctx, ids } = await access(req, "analytics:read");
  res.json(await svc.customersReport(ctx, rangeOf(req), ids));
});
analyticsRouter.get("/compare", async (req, res) => {
  const { ctx, ids, outlets } = await access(req, "analytics:read");
  res.json(await svc.compareOutlets(ctx, rangeOf(req), ids, outlets));
});
analyticsRouter.get("/operations", async (req, res) => {
  const { ctx, ids } = await access(req, "analytics:read");
  res.json(await svc.operationsReport(ctx, rangeOf(req), ids));
});

/* ---- money figures: owner and accountant */
analyticsRouter.get("/gst", async (req, res) => {
  const { ctx, ids } = await access(req, "analytics:finance");
  res.json(await svc.gstReport(ctx, rangeOf(req), ids));
});
analyticsRouter.get("/cash", async (req, res) => {
  const { ctx, ids } = await access(req, "analytics:finance");
  res.json(await svc.cashClose(ctx, rangeOf(req), ids));
});
analyticsRouter.get("/pnl", async (req, res) => {
  const { ctx, ids, outlets } = await access(req, "analytics:finance");
  res.json(await svc.pnlInputs(ctx, rangeOf(req), ids, outlets));
});

/** the expenses the owner chose to "Save to my store" */
analyticsRouter.get("/profile", async (req, res) => {
  const { ctx } = await access(req, "analytics:finance");
  const row = await AnalyticsProfileModel.findOne({ brandId: ctx.brandId, key: "finance" }).lean();
  res.json({ profile: row ? { data: row.data, savedAt: row.updatedAt } : null });
});
const profileBody = z.object({
  foodCostPct: z.number().min(0).max(100),
  safetyPct: z.number().min(0).max(100).optional(),
  scopes: z.record(z.string().max(40), z.array(z.object({ key: z.string().max(40), label: z.string().max(80), monthly: z.number().min(0).max(1e9) })).max(60)),
});
analyticsRouter.put("/profile", async (req, res) => {
  const { ctx, userId } = await access(req, "analytics:finance");
  const data = profileBody.parse(req.body?.data ?? req.body);
  const row = await AnalyticsProfileModel.findOneAndUpdate({ brandId: ctx.brandId, key: "finance" }, { $set: { data, savedBy: userId } }, { upsert: true, new: true }).lean();
  res.json({ profile: { data: row.data, savedAt: row.updatedAt } });
});

/* ---- files */
analyticsRouter.post("/export", limiter("export"), async (req, res) => {
  const input = exportRequestSchema.parse(req.body);
  const range = analyticsRangeSchema.parse({ from: input.from, to: input.to });
  const { ctx, ids, outlets, role } = await access(req, "analytics:export", input.outletIds.join(",") || "all");
  const canFinance = permissionsForRole(role).includes("analytics:finance");
  const wantsMoney = input.sections.some((id) => EXPORT_SECTIONS.find((x) => x.id === id)?.finance || id === "gst") || (input.format === "csv" && (input.section === "pnl" || input.section === "gst"));
  if (wantsMoney && !canFinance) throw new HttpError(403, "Your role can't export money figures like GST or profit & loss.");
  const report = await buildReport(ctx, { ...input, ...range, outletIds: ids }, outlets, { canFinance });
  const brand = await BrandModel.findById(ctx.brandId).select("name").lean();
  const slug = String(brand?.name ?? "store").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const meta = EXPORT_FORMATS.find((f) => f.id === input.format);
  const file = `tablepe-${slug}-${range.from}_to_${range.to}${input.format === "csv" ? `-${input.section}` : ""}.${meta.ext}`;
  let body;
  if (input.format === "xlsx") body = await toXlsx(report);
  else if (input.format === "pdf") body = await toPdf(report);
  else if (input.format === "json") body = Buffer.from(toJson(report));
  else {
    const section = report.sections[0];
    if (!section) throw new HttpError(400, "That section isn't available.");
    body = Buffer.from(toCsv(section));
  }
  res.set({ "content-type": `${meta.mime}${input.format === "csv" || input.format === "json" ? "; charset=utf-8" : ""}`, "content-disposition": `attachment; filename="${file}"`, "cache-control": "no-store", "access-control-expose-headers": "content-disposition" });
  res.send(body);
});
