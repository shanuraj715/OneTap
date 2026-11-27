import { Router } from "express";
import { z } from "zod";
import { analyticsRangeSchema, LEDGER_CATEGORIES, PAYMENT_MODES, expenseInputSchema, salesGoalSchema, permissionsForRole, DEFAULT_FOOD_COST_PCT, DEFAULT_STOCK_SAFETY_PCT, EXPORT_FORMATS, exportRequestSchema, EXPORT_SECTIONS, presetRange } from "@rasoipulse/config-schema";
import { AnalyticsProfileModel, BrandModel } from "@rasoipulse/db";
import { requireOutletContext } from "../../middleware/auth.js";
import { HttpError } from "../../middleware/error.js";
import { requireFeature, storePlan } from "../platform/plan.service.js";
import * as extra from "./analytics.extra.service.js";
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
  const { ctx, outlets, role } = await access(req, "analytics:read");
  const perms = permissionsForRole(role);
  const features = (await storePlan(ctx.brandId)).entitlements.features;
  res.json({ outlets, canFinance: perms.includes("analytics:finance"), canExport: perms.includes("analytics:export"), formats: EXPORT_FORMATS.map(({ id, label, help }) => ({ id, label, help })), sections: EXPORT_SECTIONS, defaults: { foodCostPct: DEFAULT_FOOD_COST_PCT, safetyPct: DEFAULT_STOCK_SAFETY_PCT }, features, canWriteExpenses: perms.includes("analytics:finance"), ledgerCategories: LEDGER_CATEGORIES, paymentModes: PAYMENT_MODES });
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
  const range = rangeOf(req);
  // `recorded` = the expenses written in the ledger for this range, by category (rupees): the app can work the profit out from them instead of the monthly estimates
  res.json({ ...(await svc.pnlInputs(ctx, range, ids, outlets)), recorded: await extra.recordedByCategory(ctx, range, ids) });
});

/* ---- the reports of the Rasoi Pulse Business app */

/** coupon usage ({ enabled: false } when the plan has no coupons) */
analyticsRouter.get("/coupons", async (req, res) => {
  const { ctx, ids } = await access(req, "analytics:read");
  res.json(await extra.couponsReport(ctx, rangeOf(req), ids));
});
/** table bookings ({ enabled: false } when the plan has no reservations) */
analyticsRouter.get("/reservations", async (req, res) => {
  const { ctx, ids } = await access(req, "analytics:read");
  res.json(await extra.reservationsReport(ctx, rangeOf(req), ids));
});
/** counted stock: what is left, how fast it sells, how long it lasts */
analyticsRouter.get("/inventory", async (req, res) => {
  const { ctx, ids } = await access(req, "analytics:read");
  res.json(await extra.inventoryReport(ctx, ids));
});
/** plain-English things worth knowing about the range */
analyticsRouter.get("/insights", async (req, res) => {
  const { ctx, ids } = await access(req, "analytics:read");
  res.json(await extra.insights(ctx, rangeOf(req), ids));
});

/** the monthly sales target and how this month is going against it */
analyticsRouter.get("/goals", async (req, res) => {
  const { ctx, ids } = await access(req, "analytics:read");
  res.json(await extra.goalProgress(ctx, ids));
});
analyticsRouter.put("/goals", async (req, res) => {
  const { ctx, userId, ids } = await access(req, "analytics:finance");
  await extra.setGoal(ctx, userId, salesGoalSchema.parse(req.body ?? {}).monthlySales);
  res.json(await extra.goalProgress(ctx, ids));
});

/* ---- the expenses ledger: bills written down on the day they were paid (money figures: owner and accountant) */
analyticsRouter.get("/expenses", async (req, res) => {
  const { ctx, ids } = await access(req, "analytics:finance");
  res.json(await extra.listExpenses(ctx, rangeOf(req), ids, { category: typeof req.query.category === "string" ? req.query.category : "" }));
});
analyticsRouter.post("/expenses", async (req, res) => {
  const { ctx } = await access(req, "analytics:finance");
  res.status(201).json({ expense: await extra.createExpense(ctx, req.user, expenseInputSchema.parse(req.body ?? {})) });
});
analyticsRouter.put("/expenses/:id", async (req, res) => {
  const { ctx } = await access(req, "analytics:finance");
  res.json({ expense: await extra.updateExpense(ctx, req.user, req.params.id, expenseInputSchema.parse(req.body ?? {})) });
});
analyticsRouter.delete("/expenses/:id", limiter("destructive"), async (req, res) => {
  const { ctx } = await access(req, "analytics:finance");
  res.json(await extra.deleteExpense(ctx, req.params.id));
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
  const file = `rasoipulse-${slug}-${range.from}_to_${range.to}${input.format === "csv" ? `-${input.section}` : ""}.${meta.ext}`;
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
