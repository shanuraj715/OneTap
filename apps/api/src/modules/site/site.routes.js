import { raw, Router } from "express";
import { z } from "zod";
import { IMAGE_RULES, LEAD_STATUSES } from "@rasoipulse/config-schema";
import { requirePlatform, requireUser } from "../../middleware/auth.js";
import { HttpError } from "../../middleware/error.js";
import { clientIp, issueChallenge } from "./guard.js";
import * as site from "./site.service.js";
import { limiter } from "../../middleware/rate-limit.js";

/* ===================================================================== public */

/**
 * What the Rasoi Pulse website reads — published content only, no login. Short
 * public cache headers on reads; the website itself also caches and is told
 * to refresh when something changes.
 */
export const siteRouter = Router();

const cacheFor = (res, seconds) => res.set("Cache-Control", `public, max-age=${seconds}, stale-while-revalidate=300`);

siteRouter.get("/settings", async (_req, res) => {
  cacheFor(res, 60);
  res.json({ settings: await site.getSiteSettings() });
});

siteRouter.get("/pages", async (_req, res) => {
  cacheFor(res, 60);
  res.json({ pages: await site.listPublishedPages() });
});

siteRouter.get("/pages/:slug", async (req, res) => {
  cacheFor(res, 60);
  res.json({ page: await site.getPublishedPage(req.params.slug) });
});

/** The main site and its contact page — for the storefront's "no restaurant at this address" page. */
siteRouter.get("/links", (_req, res) => {
  cacheFor(res, 300);
  res.json(site.siteLinks());
});

siteRouter.get("/pricing", async (_req, res) => {
  cacheFor(res, 60);
  res.json({ plans: await site.publicPricing() });
});

/** A draft, through a signed link from the console. Never cached. */
siteRouter.get("/preview/:id", async (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ page: await site.getPreviewPage(req.params.id, req.query.t) });
});

/** A fresh spam-guard challenge for the contact form to solve before it sends. Never cached. */
siteRouter.get("/challenge", limiter("site-challenge"), (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json(issueChallenge());
});

/** The contact form. */
siteRouter.post("/leads", limiter("site-lead"), async (req, res) => {
  res.status(201).json(await site.createLead(req.body ?? {}, { ip: clientIp(req) }));
});

/* =================================================================== platform */

/** The platform super admin managing the website and its enquiries. */
export const platformSiteRouter = Router();
// the website's pages, menu and settings need the "Website" feature; its enquiries (leads) the "Leads" feature
platformSiteRouter.use((req, _res, next) => {
  requirePlatform(req, /^\/leads(\/|$)/.test(req.path) ? "leads:manage" : "website:manage");
  next();
});

platformSiteRouter.get("/settings", async (_req, res) => {
  res.json({ settings: await site.getSiteSettings({ fresh: true }) });
});

platformSiteRouter.put("/settings", async (req, res) => {
  res.json({ settings: await site.saveSiteSettings(req.body ?? {}) });
});

platformSiteRouter.get("/pages", async (_req, res) => {
  res.json({ pages: await site.listPages() });
});

platformSiteRouter.post("/pages", async (req, res) => {
  res.status(201).json({ page: await site.createPage(req.body ?? {}, String(requireUser(req)._id)) });
});

platformSiteRouter.get("/pages/:id", async (req, res) => {
  res.json({ page: await site.getPage(req.params.id) });
});

platformSiteRouter.put("/pages/:id", async (req, res) => {
  res.json({ page: await site.updatePage(req.params.id, req.body ?? {}, String(requireUser(req)._id)) });
});

platformSiteRouter.post("/pages/:id/duplicate", async (req, res) => {
  res.status(201).json({ page: await site.duplicatePage(req.params.id, String(requireUser(req)._id)) });
});

platformSiteRouter.delete("/pages/:id", async (req, res) => {
  await site.deletePage(req.params.id);
  res.status(204).end();
});

platformSiteRouter.get("/pages/:id/preview-link", async (req, res) => {
  res.json(await site.previewLink(req.params.id));
});

/** Raw image bytes, as the store dashboard's uploads do. */
platformSiteRouter.post("/upload", limiter("upload"), raw({ type: () => true, limit: IMAGE_RULES.maxUploadBytes + 4096 }), async (req, res) => {
  const body = Buffer.isBuffer(req.body) ? req.body : null;
  if (!body?.length) throw new HttpError(400, "Send the image bytes as the request body.");
  res.status(201).json(await site.uploadSiteImage(body));
});

platformSiteRouter.get("/leads", async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  res.json(await site.listLeads({ status }));
});

const leadPatch = z.object({ status: z.enum(LEAD_STATUSES).optional(), note: z.string().max(2000).optional() });

platformSiteRouter.patch("/leads/:id", async (req, res) => {
  const user = requireUser(req);
  res.json({ lead: await site.updateLead(req.params.id, leadPatch.parse(req.body ?? {}), user.name) });
});
