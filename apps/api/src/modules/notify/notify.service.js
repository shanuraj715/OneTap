import {
  formatINR,
  NOTIFY_CHANNELS,
  NOTIFY_FIELDS,
  ORDER_STATUS_LABELS,
  outletConfigSchema,
  renderTemplate,
                          
                      
                   
} from "@onetap/config-schema";
import {
  brandFilter,
  NotificationCredentialModel,
  NotificationLogModel,
  OutletModel,
  tenantFilter,


} from "@onetap/db";
import { decryptSecret, encryptSecret, maskSecret } from "../../lib/crypto.js";
import { logger } from "../../logger.js";
import { HttpError } from "../../middleware/error.js";
import { providerFor,                        } from "./providers/index.js";

/* -------------------------------------------------------------- credentials */

async function credentialsFor(ctx               , channel                    )                             {
  const doc = await NotificationCredentialModel.findOne(brandFilter(ctx, { channel })).lean();
  if (!doc) return {};

  const creds                    = { ...(doc.publicFields ?? {}) };
  for (const [field, envelope] of Object.entries(doc.encryptedFields ?? {})) {
    try {
      creds[field] = decryptSecret(envelope);
    } catch {
      logger.error(`Could not decrypt ${channel}.${field} — was ENCRYPTION_KEY rotated?`);
      throw new HttpError(500, "Stored notification credentials could not be read");
    }
  }
  return creds;
}

/** What the admin sees: which channels are configured, secrets masked. */
export async function listNotifyConfig(ctx               ) {
  const docs = await NotificationCredentialModel.find(brandFilter(ctx)).lean();
  const byChannel = new Map(docs.map((d) => [d.channel, d]));

  return NOTIFY_CHANNELS.map((channel) => {
    const provider = providerFor(channel);
    const doc = byChannel.get(channel);
    const fields = NOTIFY_FIELDS[channel].map((f) => ({
      ...f,
      value: f.secret
        ? doc?.encryptedFields?.[f.key]
          ? maskSecret(doc.encryptedFields[f.key] .slice(-12))
          : ""
        : (doc?.publicFields?.[f.key] ?? ""),
      isSet: f.secret ? Boolean(doc?.encryptedFields?.[f.key]) : Boolean(doc?.publicFields?.[f.key]),
    }));

    return {
      channel,
      requiredFields: provider.requiredFields,
      configured: provider.requiredFields.every((k) => fields.find((f) => f.key === k)?.isSet),
      fields,
      updatedAt: doc?.updatedAt ?? null,
    };
  });
}

export async function saveNotifyCredentials(
  ctx               ,
  channel                    ,
  values                        ,
  userId        ,
) {
  const spec = NOTIFY_FIELDS[channel];
  if (!spec) throw new HttpError(400, "Unknown notification channel");

  const doc =
    (await NotificationCredentialModel.findOne(brandFilter(ctx, { channel }))) ??
    new NotificationCredentialModel({ brandId: ctx.brandId, channel });

  for (const field of spec) {
    const value = values[field.key];
    if (value === undefined) continue;

    if (field.secret) {
      // an empty string means "leave it alone"; the admin never sees the real value
      if (value === "") continue;
      doc.encryptedFields = { ...doc.encryptedFields, [field.key]: encryptSecret(value) };
    } else {
      doc.publicFields = { ...doc.publicFields, [field.key]: value };
    }
  }

  doc.updatedBy = userId;
  doc.markModified("publicFields");
  doc.markModified("encryptedFields");
  await doc.save();
}

export async function clearNotifyCredentials(ctx               , channel                    ) {
  await NotificationCredentialModel.deleteOne(brandFilter(ctx, { channel }));
}

/* ---------------------------------------------------------------- dispatch */

async function outletConfigFor(ctx               ) {
  const outlet = await OutletModel.findOne({ _id: ctx.outletId }, null, { allowGlobalQuery: true }).lean();
  if (!outlet) return null;
  return { config: outletConfigSchema.parse(outlet.config ?? {}), outletName: outlet.config?.identity?.name };
}

async function log(
  ctx               ,
  entry   
                                
                       
                    
                        
               
                                  
                   
                               
   ,
)                {
  try {
    await NotificationLogModel.create({ brandId: ctx.brandId, outletId: ctx.outletId, ...entry });
  } catch (e) {
    // Logging must never be the thing that breaks the flow either.
    logger.error({ err: e, entry }, "failed to write notification log");
  }
}

/**
 * Send whatever WhatsApp/SMS alert the outlet has configured for this order
 * status. This is the resilience contract in full: not configured, or the
 * provider failing, is recorded as a NotificationLog row and never thrown —
 * order placement and every status change must complete regardless of
 * whether an outbound message could be sent.
 */
export async function fireOrderNotifications(ctx               , order          , status             )                {
  const outlet = await outletConfigFor(ctx);
  if (!outlet) return;
  const { config } = outlet;
  const orderId = String(order._id);
  const to = order.customer.phone ?? "";

  for (const channel of NOTIFY_CHANNELS) {
    const settings = config.orderNotify[channel];
    if (!settings.enabled) continue;
    if (!settings.events.includes(status)) continue; // not switched on for this status — not an error

    try {
      if (!to) {
        await log(ctx, { channel, event: status, orderId, orderNumber: order.orderNumber, to: "", status: "skipped", error: "The customer has no phone number on file." });
        continue;
      }

      const provider = providerFor(channel);
      const creds = await credentialsFor(ctx, channel);
      const missing = provider.requiredFields.filter((f) => !creds[f]);
      if (missing.length) {
        await log(ctx, {
          channel,
          event: status,
          orderId,
          orderNumber: order.orderNumber,
          to,
          status: "skipped",
          error: `${channel} is switched on but not fully configured (missing ${missing.join(", ")}).`,
        });
        continue;
      }

      const values                                 = {
        customerName: order.customer.name || "there",
        orderNumber: order.orderNumber,
        statusLabel: ORDER_STATUS_LABELS[status],
        amount: formatINR(order.totals.grandTotal),
        outletName: config.identity.name,
      };

      const template = settings.templates[status];
      let result;
      if (channel === "whatsapp") {
        const wa = template                                                                ;
        if (!wa?.templateName) {
          await log(ctx, { channel, event: status, orderId, orderNumber: order.orderNumber, to, status: "skipped", error: `No WhatsApp template is set for "${ORDER_STATUS_LABELS[status]}".` });
          continue;
        }
        result = await provider.send(creds, { to, event: status, values, whatsapp: { templateName: wa.templateName, languageCode: wa.languageCode || "en" } });
      } else {
        const sms = template                                 ;
        if (!sms?.body) {
          await log(ctx, { channel, event: status, orderId, orderNumber: order.orderNumber, to, status: "skipped", error: `No SMS template is set for "${ORDER_STATUS_LABELS[status]}".` });
          continue;
        }
        result = await provider.send(creds, { to, event: status, values, message: renderTemplate(sms.body, values) });
      }

      await log(ctx, {
        channel,
        event: status,
        orderId,
        orderNumber: order.orderNumber,
        to,
        status: result.ok ? "sent" : "failed",
        error: result.ok ? undefined : (result.reason ?? "The provider rejected the message"),
        providerMessageId: result.providerMessageId,
      });
    } catch (e) {
      // A bug in one channel's adapter must never stop the other channel, or
      // the caller, from proceeding.
      logger.error({ err: e, channel, orderId, status }, "notification send threw unexpectedly");
      await log(ctx, { channel, event: status, orderId, orderNumber: order.orderNumber, to, status: "failed", error: (e         ).message || "Unexpected error" });
    }
  }
}

/** The admin's Logs tab — filterable list of every notification attempt. */
export async function listNotificationLogs(
  ctx               ,
  opts                                                                                                        = {},
) {
  const filter                          = {};
  if (opts.channel) filter.channel = opts.channel;
  if (opts.event) filter.event = opts.event;
  if (opts.status) filter.status = opts.status;

  return NotificationLogModel.find(tenantFilter(ctx, filter))
    .sort({ createdAt: -1 })
    .limit(Math.min(opts.limit ?? 100, 500))
    .lean();
}
