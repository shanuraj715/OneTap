import { Router } from "express";
import { z } from "zod";
import { notifyChannelSchema, orderStatusSchema } from "@onetap/config-schema";
import { requireOutletContext, requireUser } from "../../middleware/auth";
import {
  clearNotifyCredentials,
  listNotificationLogs,
  listNotifyConfig,
  saveNotifyCredentials,
} from "./notify.service";

export const notifyRouter: Router = Router();

/* ------------------------------------------------------------ admin config */

notifyRouter.get("/config", async (req, res) => {
  const ctx = await requireOutletContext(req, "notification-config:read");
  res.json({ channels: await listNotifyConfig(ctx) });
});

const saveBody = z.object({ values: z.record(z.string(), z.string()) });

notifyRouter.put("/config/:channel", async (req, res) => {
  const ctx = await requireOutletContext(req, "notification-config:manage");
  const user = requireUser(req);
  const channel = notifyChannelSchema.parse(req.params.channel);
  const { values } = saveBody.parse(req.body);
  await saveNotifyCredentials(ctx, channel, values, String(user._id));
  res.json({ channels: await listNotifyConfig(ctx) });
});

notifyRouter.delete("/config/:channel", async (req, res) => {
  const ctx = await requireOutletContext(req, "notification-config:manage");
  await clearNotifyCredentials(ctx, notifyChannelSchema.parse(req.params.channel));
  res.json({ channels: await listNotifyConfig(ctx) });
});

/* ------------------------------------------------------------------- logs */

notifyRouter.get("/logs", async (req, res) => {
  const ctx = await requireOutletContext(req, "notification-log:read");
  const q = req.query;
  const logs = await listNotificationLogs(ctx, {
    channel: typeof q.channel === "string" && q.channel ? notifyChannelSchema.parse(q.channel) : undefined,
    event: typeof q.event === "string" && q.event ? orderStatusSchema.parse(q.event) : undefined,
    status: typeof q.status === "string" && q.status ? (q.status as "sent" | "failed" | "skipped") : undefined,
    limit: Number(q.limit) || 100,
  });
  res.json({
    logs: logs.map((l) => ({
      id: String(l._id),
      channel: l.channel,
      event: l.event,
      orderId: l.orderId ?? null,
      orderNumber: l.orderNumber ?? null,
      to: l.to,
      status: l.status,
      error: l.error ?? null,
      providerMessageId: l.providerMessageId ?? null,
      createdAt: l.createdAt,
    })),
  });
});
