import { Router } from "express";
import { z } from "zod";
import { marketingAudienceSchema, parseContacts } from "@onetap/config-schema";
import { requireOutletContext } from "../../middleware/auth.js";
import { filterOptions, previewAudience } from "./audience.js";
import * as marketing from "./marketing.service.js";

/**
 * Marketing for the store dashboard: reach customers over linked WhatsApp, SMS or the WhatsApp Business API.
 * Owner-only by default (marketing:read to look, marketing:send to send); the platform's super admin can look.
 */
export const marketingRouter = Router();

async function ctxFor(req, permission) {
  const ctx = await requireOutletContext(req, permission);
  return { ctx: { brandId: ctx.brandId, outletId: ctx.outletId }, userId: String(req.user._id ?? req.user.id) };
}

marketingRouter.get("/channels", async (req, res) => {
  const { ctx } = await ctxFor(req, "marketing:read");
  res.json({ channels: await marketing.channelStatus(ctx) });
});

/** the outlets and menu item names the filters can pick from */
marketingRouter.get("/options", async (req, res) => {
  const { ctx } = await ctxFor(req, "marketing:read");
  const outletIds = typeof req.query.outletIds === "string" && req.query.outletIds ? req.query.outletIds.split(",") : [];
  res.json(await filterOptions(ctx, outletIds));
});

/** "who would get this?" — a number, how it is made up, and a few examples */
marketingRouter.post("/audience/preview", async (req, res) => {
  const { ctx } = await ctxFor(req, "marketing:read");
  res.json(await previewAudience(ctx, marketingAudienceSchema.parse(req.body?.audience ?? {})));
});

/** check some pasted numbers without saving anything */
marketingRouter.post("/contacts/parse", async (req, res) => {
  await ctxFor(req, "marketing:read");
  const parsed = parseContacts(z.object({ text: z.string().max(400_000) }).parse(req.body).text);
  res.json({ valid: parsed.valid.length, invalid: parsed.invalid.slice(0, 30), invalidCount: parsed.invalid.length, duplicates: parsed.duplicates, sample: parsed.valid.slice(0, 8) });
});

/* ------------------------------------------------------------------- lists */

marketingRouter.get("/lists", async (req, res) => {
  const { ctx } = await ctxFor(req, "marketing:read");
  res.json({ lists: await marketing.listLists(ctx) });
});
marketingRouter.post("/lists", async (req, res) => {
  const { ctx, userId } = await ctxFor(req, "marketing:send");
  const body = z.object({ name: z.string().trim().min(1, "Give the list a name").max(80), text: z.string().max(400_000).optional() }).parse(req.body);
  res.status(201).json(await marketing.createList(ctx, body, userId));
});
marketingRouter.get("/lists/:id", async (req, res) => {
  const { ctx } = await ctxFor(req, "marketing:read");
  res.json({ list: await marketing.getList(ctx, req.params.id) });
});
marketingRouter.post("/lists/:id/contacts", async (req, res) => {
  const { ctx } = await ctxFor(req, "marketing:send");
  res.json(await marketing.addToList(ctx, req.params.id, z.object({ text: z.string().max(400_000) }).parse(req.body).text));
});
marketingRouter.delete("/lists/:id/contacts/:contactId", async (req, res) => {
  const { ctx } = await ctxFor(req, "marketing:send");
  await marketing.removeContact(ctx, req.params.id, req.params.contactId);
  res.status(204).end();
});
marketingRouter.delete("/lists/:id", async (req, res) => {
  const { ctx } = await ctxFor(req, "marketing:send");
  await marketing.deleteList(ctx, req.params.id);
  res.status(204).end();
});

/* --------------------------------------------------------------- campaigns */

marketingRouter.get("/campaigns", async (req, res) => {
  const { ctx } = await ctxFor(req, "marketing:read");
  res.json({ campaigns: await marketing.listCampaigns(ctx) });
});
marketingRouter.get("/campaigns/:id", async (req, res) => {
  const { ctx } = await ctxFor(req, "marketing:read");
  res.json({ campaign: await marketing.getCampaign(ctx, req.params.id) });
});
marketingRouter.post("/campaigns", async (req, res) => {
  const { ctx, userId } = await ctxFor(req, "marketing:send");
  res.status(201).json({ campaign: await marketing.createCampaign(ctx, req.body, userId) });
});
marketingRouter.post("/campaigns/:id/cancel", async (req, res) => {
  const { ctx } = await ctxFor(req, "marketing:send");
  await marketing.cancelCampaign(ctx, req.params.id);
  res.status(204).end();
});
