import { Router } from "express";
import { z } from "zod";
import { requireBrandContext, requireSuperAdmin } from "../../middleware/auth.js";
import { HttpError } from "../../middleware/error.js";
import { checkLabel, hostStatus, probeBase, subdomainInfo } from "../outlets/subdomains.js";
import { storePlan } from "./plan.service.js";
import * as platform from "./platform.service.js";

/** The platform console — TablePe's own super admin, managing client stores. */
export const platformRouter = Router();

platformRouter.use((req, _res, next) => {
  requireSuperAdmin(req);
  next();
});

platformRouter.get("/overview", async (_req, res) => {
  res.json(await platform.overview());
});

/* ------------------------------------------------------------------- plans */

platformRouter.get("/plans", async (_req, res) => {
  res.json({ plans: await platform.listPlans() });
});

platformRouter.post("/plans", async (req, res) => {
  res.status(201).json({ plan: await platform.createPlan(req.body) });
});

platformRouter.patch("/plans/:id", async (req, res) => {
  res.json({ plan: await platform.updatePlan(req.params.id, req.body ?? {}) });
});

/* ---------------------------------------------------------------- settings */

platformRouter.get("/settings", async (_req, res) => {
  res.json({ settings: await platform.getSettings() });
});

platformRouter.put("/settings", async (req, res) => {
  const body = z
    .object({ graceDays: z.number().int().min(0).max(365).optional(), subdomainBase: z.string().max(253).optional() })
    .parse(req.body);
  res.json({ settings: await platform.updateSettings(body) });
});

/* ------------------------------------------------------------------ stores */

platformRouter.get("/stores", async (_req, res) => {
  res.json({ stores: await platform.listStores() });
});

platformRouter.get("/stores/:id", async (req, res) => {
  res.json({ store: await platform.getStore(req.params.id) });
});

const planBody = z.object({
  planId: z.string().min(1).nullable().optional(),
  overrides: z.record(z.string(), z.unknown()).optional(),
});

platformRouter.patch("/stores/:id/plan", async (req, res) => {
  res.json({ store: await platform.setStorePlan(req.params.id, planBody.parse(req.body)) });
});

const domainsBody = z.object({
  hostnames: z.array(z.string().max(260)).max(20),
  primary: z.string().max(260).optional(),
});

/** The domains a store's storefront answers on (dominos.com, www.dominos.com) and its main one. */
platformRouter.put("/stores/:id/domains", async (req, res) => {
  res.json({ store: await platform.updateStoreDomains(req.params.id, domainsBody.parse(req.body)) });
});

/* -------------------------------------------------- TablePe addresses (subdomains) */

/** Is this name free, and what address would it be? Live feedback while typing. */
platformRouter.get("/subdomains/check", async (req, res) => {
  const label = typeof req.query.label === "string" ? req.query.label : "";
  const storeId = typeof req.query.storeId === "string" ? req.query.storeId : "";
  res.json(await checkLabel(label, storeId));
});

/** Does the wildcard setup (DNS + certificate + nginx) work? Tries a made-up address under the base domain. */
platformRouter.get("/subdomains/probe", async (_req, res) => {
  res.json({ status: await probeBase() });
});

platformRouter.put("/stores/:id/subdomain", async (req, res) => {
  const { label } = z.object({ label: z.string().min(1).max(60) }).parse(req.body);
  res.json({ store: await platform.setSubdomain(req.params.id, label) });
});

platformRouter.delete("/stores/:id/subdomain", async (req, res) => {
  res.json({ store: await platform.removeSubdomain(req.params.id) });
});

/** Does this store's TablePe address actually open from outside? */
platformRouter.get("/stores/:id/subdomain/status", async (req, res) => {
  const info = await subdomainInfo(req.params.id);
  if (!info.host) throw new HttpError(404, "This store has no TablePe address.");
  res.json({ status: await hostStatus(info.host) });
});

platformRouter.post("/stores/:id/outlets/:outletId/block", async (req, res) => {
  res.json({ store: await platform.setOutletBlocked(req.params.id, req.params.outletId, true, String(req.user._id)) });
});

platformRouter.post("/stores/:id/outlets/:outletId/unblock", async (req, res) => {
  res.json({ store: await platform.setOutletBlocked(req.params.id, req.params.outletId, false) });
});

platformRouter.delete("/stores/:id/outlets/:outletId", async (req, res) => {
  const { confirmName } = z.object({ confirmName: z.string() }).parse(req.body ?? {});
  res.json({ store: await platform.deleteBlockedOutlet(req.params.id, req.params.outletId, confirmName) });
});

platformRouter.post("/stores/:id/people/:userId/block", async (req, res) => {
  res.json({ store: await platform.setPersonBlocked(req.params.id, req.params.userId, true) });
});

platformRouter.post("/stores/:id/people/:userId/unblock", async (req, res) => {
  res.json({ store: await platform.setPersonBlocked(req.params.id, req.params.userId, false) });
});

platformRouter.delete("/stores/:id/people/:userId", async (req, res) => {
  res.json({ store: await platform.deleteBlockedPerson(req.params.id, req.params.userId) });
});

/* ------------------------------------------------------------------ owners */

const ownerBody = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(80),
  password: z.string().min(8, "Use at least 8 characters").optional(),
});

platformRouter.post("/stores/:id/owners", async (req, res) => {
  res.status(201).json({ store: await platform.addOwner(req.params.id, ownerBody.parse(req.body)) });
});

const ownerUpdateBody = z.object({
  name: z.string().min(1).max(80).optional(),
  password: z.string().min(8, "Use at least 8 characters").optional(),
  isActive: z.boolean().optional(),
});

platformRouter.patch("/stores/:id/owners/:userId", async (req, res) => {
  res.json({ store: await platform.updateOwner(req.params.id, req.params.userId, ownerUpdateBody.parse(req.body)) });
});

platformRouter.delete("/stores/:id/owners/:userId", async (req, res) => {
  res.json({ store: await platform.removeOwner(req.params.id, req.params.userId) });
});

/* ------------------------------------------------- store-facing (not platform) */

/**
 * What a store's own dashboard needs to know about its plan: limits, what's
 * unlocked, current usage and any grace period. Any member of the store can
 * read it — it decides which buttons are greyed out.
 */
export const storeRouter = Router();

storeRouter.get("/plan", async (req, res) => {
  const { brandId } = requireBrandContext(req);
  const { appearance: _appearance, ...plan } = await storePlan(brandId);
  res.json({ plan });
});
