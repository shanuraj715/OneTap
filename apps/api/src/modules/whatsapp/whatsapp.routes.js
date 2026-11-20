import { Router, raw } from "express";
import { z } from "zod";
import { WA_MAX_MEDIA_BYTES, waAccessSchema, waBroadcastSchema, waColorSchema, waMediaTypeOf, waSendSchema } from "@onetap/config-schema";
import { HttpError } from "../../middleware/error.js";
import { putFile } from "../storage/storage.service.js";
import * as wa from "./whatsapp.service.js";
import { limiter } from "../../middleware/rate-limit.js";

/**
 * WhatsApp chat for the store dashboard. Every route goes through `waContext`: the plan must include it, and the
 * signed-in person's level (owner: manage, others: what the owner gave them, super admin: read) must be enough.
 */
export const whatsappRouter = Router();

whatsappRouter.get("/me", async (req, res) => {
  const { ctx, level } = await wa.waContext(req, "read");
  const accounts = await wa.listAccounts(ctx);
  res.json({ level, accounts, anyOnline: accounts.some((a) => a.online), unreadChats: await wa.unreadChatCount(ctx) });
});

/* -------------------------------------------------------------- numbers */

const labelBody = z.object({ label: z.string().trim().min(1, "Give the number a name").max(40) });

whatsappRouter.get("/accounts", async (req, res) => {
  const { ctx, level } = await wa.waContext(req, "read");
  res.json({ accounts: await wa.listAccounts(ctx, { withQr: level === "manage" }) });
});
whatsappRouter.post("/accounts", limiter("wa-link"), async (req, res) => {
  const { ctx, userId } = await wa.waContext(req, "manage");
  const body = labelBody.extend({ color: waColorSchema.optional() }).parse(req.body);
  res.status(201).json({ account: await wa.createAccount(ctx, body, userId) });
});
whatsappRouter.get("/accounts/:id", async (req, res) => {
  const { ctx } = await wa.waContext(req, "manage");
  res.json({ account: await wa.getAccount(ctx, req.params.id) });
});
whatsappRouter.patch("/accounts/:id", async (req, res) => {
  const { ctx } = await wa.waContext(req, "manage");
  const body = z.object({ label: labelBody.shape.label.optional(), color: waColorSchema.optional() }).parse(req.body);
  res.json({ account: await wa.updateAccount(ctx, req.params.id, body) });
});

/* --------------------------------------------- stats, sharing chats, cleanup */

whatsappRouter.get("/stats", async (req, res) => {
  const { ctx } = await wa.waContext(req, "manage");
  res.json(await wa.numberStats(ctx));
});

const distributeBody = z.object({ share: z.array(z.string().max(40)).min(1).max(10), giveAway: z.array(z.string().max(40)).max(10).default([]) });
whatsappRouter.post("/distribute/preview", async (req, res) => {
  const { ctx } = await wa.waContext(req, "manage");
  res.json(await wa.previewDistribution(ctx, distributeBody.parse(req.body)));
});
whatsappRouter.post("/distribute", limiter("bulk-send"), async (req, res) => {
  const { ctx } = await wa.waContext(req, "manage");
  res.json(await wa.applyDistribution(ctx, distributeBody.parse(req.body)));
});

const cleanupBody = z.object({ before: z.string().min(8).max(40), scope: z.enum(["messages", "chats"]), accountId: z.string().max(40).optional() });
whatsappRouter.post("/cleanup/preview", async (req, res) => {
  const { ctx } = await wa.waContext(req, "manage");
  res.json(await wa.previewCleanup(ctx, cleanupBody.parse(req.body)));
});
whatsappRouter.post("/cleanup", limiter("bulk-send"), async (req, res) => {
  const { ctx } = await wa.waContext(req, "manage");
  res.json(await wa.runCleanup(ctx, cleanupBody.parse(req.body)));
});
whatsappRouter.post("/accounts/:id/relink", limiter("wa-link"), async (req, res) => {
  const { ctx } = await wa.waContext(req, "manage");
  res.json({ account: await wa.relinkAccount(ctx, req.params.id) });
});
whatsappRouter.post("/accounts/:id/unlink", limiter("wa-link"), async (req, res) => {
  const { ctx } = await wa.waContext(req, "manage");
  res.json({ account: await wa.unlinkAccount(ctx, req.params.id) });
});
whatsappRouter.delete("/accounts/:id", limiter("wa-link"), async (req, res) => {
  const { ctx } = await wa.waContext(req, "manage");
  await wa.removeAccount(ctx, req.params.id);
  res.status(204).end();
});

/* ---------------------------------------------------------------- chats */

whatsappRouter.get("/chats", async (req, res) => {
  const { ctx } = await wa.waContext(req, "read");
  res.json({
    chats: await wa.listChats(ctx, {
      q: String(req.query.q ?? ""),
      unread: req.query.unread === "1",
      view: String(req.query.view ?? "all"),
      accountId: String(req.query.account ?? ""),
    }),
  });
});
whatsappRouter.post("/chats", limiter("chat-send"), async (req, res) => {
  const { ctx } = await wa.waContext(req, "send");
  const body = z.object({ phone: z.string().min(5).max(30), name: z.string().max(80).optional() }).parse(req.body);
  res.status(201).json({ chat: await wa.startChat(ctx, body) });
});
whatsappRouter.get("/chats/:id", async (req, res) => {
  const { ctx } = await wa.waContext(req, "read");
  res.json({ chat: await wa.getChat(ctx, req.params.id) });
});
whatsappRouter.patch("/chats/:id", async (req, res) => {
  const { ctx } = await wa.waContext(req, "send");
  const body = z.object({ name: z.string().max(80).optional(), accountId: z.string().max(40).nullable().optional() }).parse(req.body);
  res.json({ chat: await wa.updateChat(ctx, req.params.id, body) });
});
whatsappRouter.delete("/chats/:id", limiter("destructive"), async (req, res) => {
  const { ctx } = await wa.waContext(req, "send");
  await wa.deleteChat(ctx, req.params.id);
  res.status(204).end();
});
whatsappRouter.post("/chats/:id/clear", limiter("destructive"), async (req, res) => {
  const { ctx } = await wa.waContext(req, "send");
  await wa.clearChat(ctx, req.params.id);
  res.status(204).end();
});
whatsappRouter.post("/chats/:id/read", async (req, res) => {
  const { ctx } = await wa.waContext(req, "read");
  // the platform super admin only looks: their reading doesn't clear the store's unread badges
  if (!req.user.isSuperAdmin) await wa.markRead(ctx, req.params.id);
  res.status(204).end();
});
whatsappRouter.get("/chats/:id/messages", async (req, res) => {
  const { ctx } = await wa.waContext(req, "read");
  res.json({ messages: await wa.listMessages(ctx, req.params.id, { before: typeof req.query.before === "string" ? req.query.before : undefined }) });
});
whatsappRouter.post("/chats/:id/messages", limiter("chat-send"), async (req, res) => {
  const { ctx, userId } = await wa.waContext(req, "send");
  res.status(201).json({ message: await wa.sendMessage(ctx, req.params.id, waSendSchema.parse(req.body), userId) });
});
whatsappRouter.post("/chats/:id/messages/:messageId/retry", limiter("chat-send"), async (req, res) => {
  const { ctx } = await wa.waContext(req, "send");
  await wa.retryMessage(ctx, req.params.id, req.params.messageId);
  res.status(204).end();
});
/** ?everyone=1 deletes it on WhatsApp for both sides (the worker does it); otherwise only from the dashboard. */
whatsappRouter.delete("/chats/:id/messages/:messageId", async (req, res) => {
  const { ctx } = await wa.waContext(req, "send");
  res.json(await wa.deleteMessage(ctx, req.params.id, req.params.messageId, { everyone: req.query.everyone === "1" }));
});

/** An attachment: the raw file as the body, its type in Content-Type and its name in ?name=. */
whatsappRouter.post("/media", limiter("upload"), raw({ type: () => true, limit: WA_MAX_MEDIA_BYTES + 4096 }), async (req, res) => {
  const { ctx } = await wa.waContext(req, "send");
  const body = Buffer.isBuffer(req.body) ? req.body : null;
  if (!body?.length) throw new HttpError(400, "Send the file as the request body.");
  const mime = String(req.header("content-type") ?? "application/octet-stream").split(";")[0].trim().toLowerCase();
  const fileName = String(req.query.name ?? "file").replace(/[^\w.\- ()]/g, "_").slice(0, 120);
  const ext = fileName.includes(".") ? fileName.split(".").pop() : mime.split("/")[1];
  const stored = await putFile(ctx, { body, contentType: mime, kind: "whatsapp", ext, maxBytes: WA_MAX_MEDIA_BYTES });
  res.status(201).json({ media: { url: stored.url, key: stored.key, mime, fileName, size: stored.size }, type: waMediaTypeOf(mime) });
});

/* ------------------------------------------------------------ broadcasts */

whatsappRouter.get("/broadcasts", async (req, res) => {
  const { ctx } = await wa.waContext(req, "manage");
  res.json({ broadcasts: await wa.listBroadcasts(ctx), preview: await wa.broadcastPreview(ctx) });
});
whatsappRouter.post("/broadcasts", limiter("bulk-send"), async (req, res) => {
  const { ctx, userId } = await wa.waContext(req, "manage");
  res.status(201).json({ broadcast: await wa.createBroadcast(ctx, waBroadcastSchema.parse(req.body), userId) });
});
whatsappRouter.post("/broadcasts/:id/cancel", async (req, res) => {
  const { ctx } = await wa.waContext(req, "manage");
  await wa.cancelBroadcast(ctx, req.params.id);
  res.status(204).end();
});

/* ---------------------------------------------------------------- access */

whatsappRouter.get("/access", async (req, res) => {
  const { ctx } = await wa.waContext(req, "manage");
  res.json({ access: await wa.getAccess(ctx) });
});
whatsappRouter.put("/access", async (req, res) => {
  const { ctx } = await wa.waContext(req, "manage");
  res.json({ access: await wa.setAccess(ctx, waAccessSchema.parse(req.body.access ?? req.body)) });
});
