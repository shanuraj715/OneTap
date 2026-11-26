import { clearAllBlocks, clearBlock, GUARD_SETTINGS, guardOn, listBlocks } from "../security/login-guard.js";
import { Router } from "express";
import { z } from "zod";
import { imageProcessingSchema, storageProviderSchema } from "@rasoipulse/config-schema";
import { requireBrandContext, requireSuperAdmin } from "../../middleware/auth.js";
import { HttpError } from "../../middleware/error.js";
import { checkLabel, hostStatus, probeBase, subdomainInfo } from "../outlets/subdomains.js";
import * as storage from "../storage/storage.service.js";
import * as storageMove from "../storage/storage-migrate.js";
import * as storageOps from "../storage/storage-ops.js";
import * as storageOptimize from "../storage/storage-optimize.js";
import * as ai from "../ai/ai.service.js";
import * as cacheAdmin from "./cache.service.js";
import * as cacheInspect from "./cache-inspect.service.js";
import { dashboard } from "./dashboard.service.js";
import { listLoginLogs, LOGIN_FILTERS } from "./login-logs.service.js";
import { onboardingRouter } from "../onboarding/onboarding.routes.js";
import { appReleasesAdminRouter } from "../app-releases/app-releases.routes.js";
import { sysmonRouter } from "../sysmon/sysmon.routes.js";
import * as storeDelete from "./store-delete.service.js";
import { storePlan } from "./plan.service.js";
import * as platform from "./platform.service.js";
import { limiter } from "../../middleware/rate-limit.js";

/** The platform console — Rasoi Pulse's own super admin, managing client stores. */
export const platformRouter = Router();

platformRouter.use((req, _res, next) => {
  requireSuperAdmin(req);
  next();
});

platformRouter.get("/overview", async (_req, res) => {
  res.json(await platform.overview());
});

/** The dashboard's numbers and charts. `?fresh=1` recomputes instead of using the cached copy. */
platformRouter.get("/dashboard", async (req, res) => {
  res.json(await dashboard({ fresh: req.query.fresh === "1" }));
});

/** Who signed in to the dashboards, and who tried and failed. ?filter=all|success|failed|platform|stores&cursor=<id>&limit=25 */
platformRouter.get("/login-logs", async (req, res) => {
  const query = z
    .object({
      filter: z.enum(Object.keys(LOGIN_FILTERS)).default("all"),
      cursor: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(100).default(25),
    })
    .parse(req.query);
  res.json(await listLoginLogs(query));
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

/* ---------------------------------------------------------------- security */

/** Network addresses that are blocked from signing in, or being watched after failed attempts. */
platformRouter.get("/security/blocks", async (_req, res) => {
  res.json({ blocks: await listBlocks(), settings: GUARD_SETTINGS, enabled: guardOn });
});
platformRouter.delete("/security/blocks/:id", async (req, res) => {
  await clearBlock(req.params.id);
  res.status(204).end();
});
platformRouter.delete("/security/blocks", async (_req, res) => {
  await clearAllBlocks();
  res.status(204).end();
});

platformRouter.get("/settings", async (_req, res) => {
  res.json({ settings: await platform.getSettings() });
});

platformRouter.put("/settings", async (req, res) => {
  const body = z
    .object({ graceDays: z.number().int().min(0).max(365).optional(), realtimeWebsocket: z.boolean().optional() })
    .refine((b) => b.graceDays !== undefined || b.realtimeWebsocket !== undefined, "Nothing to change.")
    .parse(req.body);
  res.json({ settings: await platform.updateSettings(body) });
});

/* ----------------------------------------------------------------- storage */

/**
 * Where every store's images are kept — this server's disk, or an S3-compatible bucket — and how they are
 * compressed. One setting for the whole platform; store owners never see it. Secrets are encrypted and never
 * sent back.
 */
/** The storage settings as the console shows them, plus what to call the storage in use ("Cloudflare R2 · my-bucket"). */
const storageView = async () => ({ ...(await storage.getStorageConfig()), inUseLabel: storageOps.describeStorage(await storageOps.activeConfig()) });

platformRouter.get("/storage", async (_req, res) => {
  res.json(await storageView());
});

const storageBody = z.object({
  provider: storageProviderSchema.optional(),
  values: z.record(z.string(), z.string().nullable()).optional(),
  processing: imageProcessingSchema.partial().optional(),
});

platformRouter.put("/storage", limiter("secrets"), async (req, res) => {
  const body = storageBody.parse(req.body);
  if (!body.provider && !body.processing) throw new HttpError(400, "Nothing to save");
  await storage.saveStorageConfig(body, String(requireSuperAdmin(req)._id));
  res.json(await storageView());
});

/** Back to this server's disk (compression settings are kept). */
platformRouter.delete("/storage", limiter("secrets"), async (req, res) => {
  await storage.resetStorageConfig(String(requireSuperAdmin(req)._id));
  res.json(await storageView());
});

/**
 * Try a storage WITHOUT switching it on: with `{ provider, values }` it tries those details (a blank secret keeps the saved
 * one); with no body it tries what is saved and in use.
 */
const testBody = z.object({ provider: storageProviderSchema, values: z.record(z.string(), z.string().nullable()).optional() }).partial();
platformRouter.post("/storage/test", limiter("secrets"), async (req, res) => {
  const body = testBody.parse(req.body ?? {});
  try {
    res.json(await storageOps.testStorage(body.provider ? { provider: body.provider, values: body.values ?? {} } : undefined));
  } catch (err) {
    // A bad key or an unreachable bucket is the point of this endpoint — report it, don't 500.
    if (err instanceof HttpError) throw err;
    throw new HttpError(400, err instanceof Error ? err.message : "Storage test failed");
  }
});

/** What is stored where — per place, store, outlet and kind — and how it compares with what the stores use. */
platformRouter.get("/storage/usage", async (_req, res) => {
  res.json({ usage: storageOps.lastStorageScan() });
});
platformRouter.post("/storage/usage/scan", limiter("secrets"), async (_req, res) => {
  res.json({ usage: await storageOps.scanStorage() });
});

/* Moving the files to another storage (this server's disk ⇄ any S3-compatible bucket). */
const endBody = z.object({ type: z.enum(["local", "active", "s3"]), values: z.record(z.string(), z.string().nullable()).optional() });
const moveBody = z.object({
  source: endBody,
  target: endBody,
  scope: z.object({ brandId: z.string().min(1).max(40).optional() }).optional(),
  options: z.object({ deleteSource: z.boolean().optional(), activate: z.boolean().optional() }).optional(),
});
platformRouter.get("/storage/move", async (_req, res) => {
  res.json(await storageMove.migrationStatus());
});
platformRouter.post("/storage/move/preview", limiter("secrets"), async (req, res) => {
  res.json({ preview: await storageMove.previewMove(moveBody.parse(req.body)) });
});
platformRouter.post("/storage/move", limiter("secrets"), async (req, res) => {
  res.status(202).json({ move: await storageMove.startMove(moveBody.parse(req.body), String(requireSuperAdmin(req)._id)) });
});
platformRouter.post("/storage/move/:id/cancel", async (req, res) => {
  res.json(await storageMove.cancelMove(req.params.id));
});

/* Optimizing pictures that are bigger than the size limit (compress them with the saved compression settings). */
const optimizeBody = z.object({
  keys: z.array(z.string().min(1).max(300)).max(5000).optional(),
  all: z.boolean().optional(),
  brandId: z.string().min(1).max(40).optional(),
  options: z.object({ deleteOriginals: z.boolean().optional() }).optional(),
});
platformRouter.get("/storage/optimize", async (_req, res) => {
  res.json(await storageOptimize.optimizeStatus());
});
platformRouter.get("/storage/optimize/scan", async (_req, res) => {
  res.json({ scan: storageOptimize.lastOptimizeScan() });
});
platformRouter.post("/storage/optimize/scan", limiter("storage-heavy"), async (_req, res) => {
  res.json({ scan: await storageOptimize.scanForOptimizing() });
});
platformRouter.post("/storage/optimize", limiter("storage-heavy"), async (req, res) => {
  res.status(202).json({ job: await storageOptimize.startOptimize(optimizeBody.parse(req.body), String(requireSuperAdmin(req)._id)) });
});
platformRouter.post("/storage/optimize/:id/cancel", async (req, res) => {
  res.json(await storageOptimize.cancelOptimize(req.params.id));
});

/* ----------------------------------------------------------------- AI pictures */

/**
 * The Gemini API keys that make dish pictures (several: each key has its own usage limit, so pictures are spread
 * over them), and which model they use. Only the super admin sees or changes this; the keys are encrypted and never
 * sent back — only a masked hint is.
 */
platformRouter.get("/ai", async (req, res) => {
  requireSuperAdmin(req);
  res.json(await ai.getAiSettings());
});

platformRouter.put("/ai", limiter("secrets"), async (req, res) => {
  const body = z.object({ model: z.string().min(1).max(80) }).parse(req.body);
  res.json(await ai.saveAiModel(body.model, String(requireSuperAdmin(req)._id)));
});

platformRouter.post("/ai/keys", limiter("secrets"), async (req, res) => {
  const body = z.object({ label: z.string().max(60).optional(), apiKey: z.string().min(1).max(300) }).parse(req.body);
  res.status(201).json(await ai.addAiKey(body, String(requireSuperAdmin(req)._id)));
});

platformRouter.patch("/ai/keys/:id", limiter("secrets"), async (req, res) => {
  const body = z.object({ label: z.string().max(60).optional(), enabled: z.boolean().optional() }).parse(req.body);
  res.json(await ai.updateAiKey(req.params.id, body, String(requireSuperAdmin(req)._id)));
});

platformRouter.delete("/ai/keys/:id", limiter("secrets"), async (req, res) => {
  res.json(await ai.removeAiKey(req.params.id, String(requireSuperAdmin(req)._id)));
});

/** Free: asks Google for a model list with this one key — no picture is made. */
platformRouter.post("/ai/keys/:id/test", limiter("secrets"), async (req, res) => {
  requireSuperAdmin(req);
  res.json(await ai.testAiKey(req.params.id));
});

/** Use one store's own (older) storage settings as the platform's. The secret stays encrypted. */
platformRouter.post("/storage/adopt/:brandId", limiter("secrets"), async (req, res) => {
  await storage.adoptStoreStorage(req.params.brandId, String(requireSuperAdmin(req)._id));
  res.json(await storageView());
});

/* ------------------------------------------------------------------ server */

/** CPU, memory, disk, network, processes and a 0–10 health score for the machine this API runs on. */
platformRouter.use("/server", sysmonRouter);
platformRouter.use("/onboarding", onboardingRouter);
// the staff app's releases: upload an APK, publish it, force an update
platformRouter.use("/app-releases", appReleasesAdminRouter);

/* ------------------------------------------------------------------- cache */

platformRouter.get("/cache", async (_req, res) => {
  res.json({ cache: await cacheAdmin.cacheOverview() });
});

platformRouter.put("/cache/settings", async (req, res) => {
  const body = z.object({ ttlSeconds: z.number().int().min(0).max(86_400) }).parse(req.body);
  res.json({ cache: await cacheAdmin.setCacheTtl(body.ttlSeconds) });
});

/** Expire everything, or just one store's cache: { scope: "all" } or { scope: "store", storeId }. */
platformRouter.post("/cache/expire", async (req, res) => {
  const body = z
    .discriminatedUnion("scope", [z.object({ scope: z.literal("all") }), z.object({ scope: z.literal("store"), storeId: z.string().min(1) })])
    .parse(req.body);
  const result = await cacheAdmin.expireCache(body);
  res.json({ result, cache: await cacheAdmin.cacheOverview() });
});

platformRouter.get("/stores/:id/cache", async (req, res) => {
  res.json({ cache: await cacheAdmin.storeCache(req.params.id) });
});

/** Everything cached right now (no data, just what/for whom/how old). Looking never changes the cache. */
platformRouter.get("/cache/entries", async (_req, res) => {
  res.json(await cacheInspect.listEntries());
});

/** One cached item with its data — `?key=menu:<store>:<outlet>`. Secret-looking fields are hidden. */
platformRouter.get("/cache/entry", async (req, res) => {
  const { key } = z.object({ key: z.string().min(1).max(400) }).parse(req.query);
  res.json({ entry: await cacheInspect.getEntry(key) });
});

/* ------------------------------------------------------------------ stores */

platformRouter.get("/stores", async (_req, res) => {
  res.json({ stores: await platform.listStores() });
});

platformRouter.get("/stores/:id", async (req, res) => {
  res.json({ store: await platform.getStore(req.params.id) });
});

/** What deleting this store would remove — shown in the confirmation. */
platformRouter.get("/stores/:id/deletion-summary", async (req, res) => {
  res.json(await storeDelete.deletionSummary(req.params.id));
});

/** Delete a store and everything it owns. The body must carry the store's exact name. */
platformRouter.delete("/stores/:id", limiter("destructive"), async (req, res) => {
  const body = z.object({ confirmName: z.string() }).parse(req.body ?? {});
  const user = requireSuperAdmin(req);
  res.json(await storeDelete.deleteStore(req.params.id, { confirmName: body.confirmName, by: user.email }));
});

/** What switching this store off affects right now (people, outlets, orders in progress) — shown in the confirmation. */
platformRouter.get("/stores/:id/disable-summary", async (req, res) => {
  res.json(await platform.disableSummary(req.params.id));
});

/**
 * Switch the whole store off — for a late or missing payment. Customers can't order and the store's team can't
 * use the dashboard, but NOTHING is deleted. The optional message is what the team sees. Disabling a store
 * that is already disabled only updates the message.
 */
platformRouter.post("/stores/:id/disable", limiter("destructive"), async (req, res) => {
  const { message } = z.object({ message: z.string().max(500, "Keep the message under 500 characters").optional() }).parse(req.body ?? {});
  const user = requireSuperAdmin(req);
  res.json({ store: await platform.setStoreDisabled(req.params.id, true, { message, byUserId: String(user._id) }) });
});

/** Turn a disabled store back on, exactly as it was. */
platformRouter.post("/stores/:id/enable", limiter("destructive"), async (req, res) => {
  res.json({ store: await platform.setStoreDisabled(req.params.id, false) });
});

const renameBody = z.object({ name: z.string().trim().min(1, "Give the store a name").max(80, "The store name can be at most 80 characters") });

/** Change a store's name — the platform admin only (this router is), never the store's own owner. */
platformRouter.patch("/stores/:id", async (req, res) => {
  res.json({ store: await platform.renameStore(req.params.id, renameBody.parse(req.body).name) });
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

/* -------------------------------------------------- Rasoi Pulse addresses (subdomains) */

/** Is this name free, and what address would it be? Live feedback while typing. */
platformRouter.get("/subdomains/check", async (req, res) => {
  const label = typeof req.query.label === "string" ? req.query.label : "";
  const storeId = typeof req.query.storeId === "string" ? req.query.storeId : "";
  res.json(await checkLabel(label, storeId));
});

/** Does the wildcard setup (DNS + certificate + nginx) work? Tries a made-up address under the base domain. */
platformRouter.get("/subdomains/probe", limiter("outbound-fetch"), async (_req, res) => {
  res.json({ status: await probeBase() });
});

platformRouter.put("/stores/:id/subdomain", async (req, res) => {
  const { label } = z.object({ label: z.string().min(1).max(60) }).parse(req.body);
  res.json({ store: await platform.setSubdomain(req.params.id, label) });
});

platformRouter.delete("/stores/:id/subdomain", async (req, res) => {
  res.json({ store: await platform.removeSubdomain(req.params.id) });
});

/** Does this store's Rasoi Pulse address actually open from outside? */
platformRouter.get("/stores/:id/subdomain/status", limiter("outbound-fetch"), async (req, res) => {
  const info = await subdomainInfo(req.params.id);
  if (!info.host) throw new HttpError(404, "This store has no Rasoi Pulse address.");
  res.json({ status: await hostStatus(info.host) });
});

platformRouter.post("/stores/:id/outlets/:outletId/block", async (req, res) => {
  res.json({ store: await platform.setOutletBlocked(req.params.id, req.params.outletId, true, String(req.user._id)) });
});

platformRouter.post("/stores/:id/outlets/:outletId/unblock", async (req, res) => {
  res.json({ store: await platform.setOutletBlocked(req.params.id, req.params.outletId, false) });
});

platformRouter.delete("/stores/:id/outlets/:outletId", limiter("destructive"), async (req, res) => {
  const { confirmName } = z.object({ confirmName: z.string() }).parse(req.body ?? {});
  res.json({ store: await platform.deleteBlockedOutlet(req.params.id, req.params.outletId, confirmName) });
});

platformRouter.post("/stores/:id/people/:userId/block", limiter("account-write"), async (req, res) => {
  res.json({ store: await platform.setPersonBlocked(req.params.id, req.params.userId, true) });
});

platformRouter.post("/stores/:id/people/:userId/unblock", limiter("account-write"), async (req, res) => {
  res.json({ store: await platform.setPersonBlocked(req.params.id, req.params.userId, false) });
});

platformRouter.delete("/stores/:id/people/:userId", limiter("account-write"), async (req, res) => {
  res.json({ store: await platform.deleteBlockedPerson(req.params.id, req.params.userId) });
});

/* ------------------------------------------------------------------ owners */

const ownerBody = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(80),
  password: z.string().min(8, "Use at least 8 characters").optional(),
});

platformRouter.post("/stores/:id/owners", limiter("account-write"), async (req, res) => {
  res.status(201).json({ store: await platform.addOwner(req.params.id, ownerBody.parse(req.body)) });
});

const ownerUpdateBody = z.object({
  name: z.string().min(1).max(80).optional(),
  password: z.string().min(8, "Use at least 8 characters").optional(),
  isActive: z.boolean().optional(),
});

platformRouter.patch("/stores/:id/owners/:userId", limiter("account-write"), async (req, res) => {
  res.json({ store: await platform.updateOwner(req.params.id, req.params.userId, ownerUpdateBody.parse(req.body)) });
});

platformRouter.delete("/stores/:id/owners/:userId", limiter("account-write"), async (req, res) => {
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
  const { brandId } = await requireBrandContext(req);
  const { appearance: _appearance, ...plan } = await storePlan(brandId);
  res.json({ plan });
});
