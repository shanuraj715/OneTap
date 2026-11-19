import {
  CODE_METHODS,
  DEFAULT_OTP_TEMPLATE,
  DEFAULT_WA_CODE_TEMPLATE,
  formatINR,
  MESSAGE_METHOD_FEATURE,
  messagingSchema,
  NOTIFY_CHANNELS,
  NOTIFY_FIELDS,
  ORDER_STATUS_LABELS,
  renderCodeMessage,
  renderTemplate,
                          
                      
                   
} from "@onetap/config-schema";
import {
  BrandModel,
  brandFilter,
  NotificationCredentialModel,
  NotificationLogModel,
  OutletModel,
  tenantFilter,
  WaAccountModel,


} from "@onetap/db";
import { decryptSecret, encryptSecret, maskSecret } from "../../lib/crypto.js";
import { logger } from "../../logger.js";
import { HttpError } from "../../middleware/error.js";
import { effectiveConfig } from "../outlets/config.service.js";
import { storePlan } from "../platform/plan.service.js";
import { isOnline, queueOrderUpdate, sendCodeLinked } from "../whatsapp/whatsapp.service.js";
import { providerFor,                        } from "./providers/index.js";

/* -------------------------------------------------------------- credentials */

export async function credentialsFor(ctx               , channel                    )                             {
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

/* ------------------------------------------------------- verification codes */

/**
 * How this store sends verification codes (sign-up / sign-in, and the code staff ask for before spending a
 * customer's coins). The owner maps it under Settings → Message sending. A store that never did keeps what it had
 * before the mapping existed: SMS if "Send login & coin codes by SMS" was on and the gateway is complete, else
 * nothing is sent and the code is shown on the sign-in screen.
 */
export async function codeSettings(brandId        ) {
  const ctx = { brandId: String(brandId) };
  const brand = await BrandModel.findOne({ _id: ctx.brandId }).select("name messaging").lean();
  const saved = brand?.messaging?.codes;
  if (saved && CODE_METHODS.includes(saved.method)) {
    return {
      explicit: true,
      storeName: brand?.name ?? "",
      method: saved.method,
      linkedMessage: saved.linkedMessage ?? "",
      whatsappTemplate: { name: "", language: "en", copyButton: false, ...(saved.whatsappTemplate ?? {}) },
    };
  }
  // before the mapping existed
  const creds = await credentialsFor(ctx, "sms");
  const smsReady = creds.otpEnabled === "on" && providerFor("sms").requiredFields.every((k) => Boolean(creds[k]));
  return {
    explicit: false,
    storeName: brand?.name ?? "",
    method: smsReady ? "sms" : "screen",
    linkedMessage: "",
    whatsappTemplate: { name: "", language: "en", copyButton: false },
  };
}

/**
 * The store's sender for verification codes — or null when codes aren't sent ("Don't send": the code is shown on
 * the sign-in screen, and staff can spend coins without one). Null is the signal every caller uses for "codes
 * aren't configured here".
 *
 * A mapped method is never silently swapped for another or for the on-screen code: if it can't send right now
 * (the number is offline, the gateway is incomplete…) `send` fails, and the customer is asked to try again — showing
 * the code on screen instead would let anyone sign in as anyone.
 */
export async function codeSender(brandId        ) {
  const settings = await codeSettings(brandId);
  if (settings.method === "screen") return null;
  const ctx = { brandId: String(brandId) };

  return {
    method: settings.method,
    /** → { ok, reason?, userMessage? } — never throws */
    async send(to        , code        ) {
      try {
        const result = await sendCodeBy(settings, ctx, to, code);
        if (!result.ok) logger.error({ brandId: ctx.brandId, method: settings.method, reason: result.reason }, "verification code could not be sent");
        return result;
      } catch (e) {
        logger.error({ err: e, brandId: ctx.brandId, method: settings.method }, "verification code could not be sent");
        return { ok: false, reason: (e         ).message || "unexpected error", userMessage: CODE_UNAVAILABLE };
      }
    },
  };
}

const CODE_UNAVAILABLE = "We can't send the code right now. Please try again in a few minutes.";

async function sendCodeBy(settings, ctx, to        , code        ) {
  if (settings.method === "linked") {
    return sendCodeLinked(ctx.brandId, to, renderCodeMessage(settings.linkedMessage, { code, store: settings.storeName }));
  }

  if (settings.method === "whatsapp") {
    const creds = await credentialsFor(ctx, "whatsapp");
    const provider = providerFor("whatsapp");
    const missing = provider.requiredFields.filter((f) => !creds[f]);
    if (missing.length) return { ok: false, reason: `WhatsApp Business isn't fully set up (missing ${missing.join(", ")})`, userMessage: CODE_UNAVAILABLE };
    const t = settings.whatsappTemplate;
    if (!t.name) return { ok: false, reason: "No WhatsApp template is set for codes", userMessage: CODE_UNAVAILABLE };
    const result = await provider.send(creds, {
      to,
      event: "otp",
      values: {},
      whatsapp: { templateName: t.name, languageCode: t.language || "en", params: [code], copyCode: Boolean(t.copyButton) },
    });
    return result.ok ? result : { ...result, userMessage: CODE_UNAVAILABLE };
  }

  // sms
  const creds = await credentialsFor(ctx, "sms");
  const provider = providerFor("sms");
  const missing = provider.requiredFields.filter((f) => !creds[f]);
  if (missing.length) return { ok: false, reason: `SMS isn't fully set up (missing ${missing.join(", ")})`, userMessage: CODE_UNAVAILABLE };
  const template = creds.otpTemplate?.trim() || DEFAULT_OTP_TEMPLATE;
  const message = template.replaceAll("{{code}}", code).replaceAll("{{store}}", settings.storeName);
  const result = await provider.send(creds, { to, event: "otp", values: {}, message });
  return result.ok ? result : { ...result, userMessage: "Couldn't send the code. Check the number and try again." };
}

/* ------------------------------------------------- the mapping, for the dashboard */

/** Can each method send right now? (so the dashboard can say what is missing, and the API can refuse a method that can't work) */
async function methodReadiness(ctx               ) {
  const plan = await storePlan(ctx.brandId);
  const has = (feature        ) => plan.entitlements.features.includes(feature);
  const numbers = (await WaAccountModel.find({ brandId: ctx.brandId, status: { $in: ["connected", "disconnected"] } }).sort({ createdAt: 1 }).lean()).map((a) => ({
    id: String(a._id),
    label: a.label,
    phone: a.phone ?? "",
    online: isOnline(a),
  }));
  const [waCreds, smsCreds] = await Promise.all([credentialsFor(ctx, "whatsapp"), credentialsFor(ctx, "sms")]);
  const missing = (channel                    , creds                   ) => providerFor(channel).requiredFields.filter((f) => !creds[f]);
  const waMissing = missing("whatsapp", waCreds);
  const smsMissing = missing("sms", smsCreds);

  const linked = !has(MESSAGE_METHOD_FEATURE.linked)
    ? { ok: false, reason: "WhatsApp chat isn't in this store's plan.", planLocked: true }
    : !numbers.length
      ? { ok: false, reason: "No WhatsApp number is linked yet — link one under WhatsApp → Numbers." }
      : !numbers.some((n) => n.online)
        ? { ok: false, reason: "Your linked number isn't connected right now — open WhatsApp → Numbers to reconnect it." }
        : { ok: true };
  const whatsapp = !has(MESSAGE_METHOD_FEATURE.whatsapp)
    ? { ok: false, reason: "WhatsApp & SMS alerts aren't in this store's plan.", planLocked: true }
    : waMissing.length
      ? { ok: false, reason: "WhatsApp Business isn't set up yet — add its connection details under Notifications → WhatsApp." }
      : { ok: true };
  const sms = !has(MESSAGE_METHOD_FEATURE.sms)
    ? { ok: false, reason: "WhatsApp & SMS alerts aren't in this store's plan.", planLocked: true }
    : smsMissing.length
      ? { ok: false, reason: "Your SMS gateway isn't set up yet — add its details under Notifications → SMS." }
      : { ok: true };
  return { ready: { linked, whatsapp, sms }, numbers };
}

export async function getMessaging(ctx               ) {
  const [settings, readiness] = await Promise.all([codeSettings(ctx.brandId), methodReadiness(ctx)]);
  const smsCreds = await credentialsFor(ctx, "sms");
  return {
    storeName: settings.storeName,
    codes: {
      method: settings.method,
      /** false = the store never chose; what's shown is what it already had */
      explicit: settings.explicit,
      linkedMessage: settings.linkedMessage,
      whatsappTemplate: settings.whatsappTemplate,
      smsMessage: smsCreds.otpTemplate?.trim() || "",
    },
    defaults: { linkedMessage: DEFAULT_WA_CODE_TEMPLATE, smsMessage: DEFAULT_OTP_TEMPLATE },
    ready: readiness.ready,
    numbers: readiness.numbers,
  };
}

/** Save the mapping. A method that can't send is refused — mapping codes to one would lock every new customer out. */
export async function saveMessaging(ctx               , input         ) {
  const parsed = messagingSchema.safeParse(input);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Check the details and try again.");
  const codes = parsed.data.codes;

  if (codes.method !== "screen") {
    const { ready } = await methodReadiness(ctx);
    const r = ready[codes.method];
    if (!r.ok) throw new HttpError(409, r.reason);
  }
  const clean = {
    method: codes.method,
    linkedMessage: codes.linkedMessage.trim(),
    whatsappTemplate: { name: codes.whatsappTemplate.name, language: codes.whatsappTemplate.language, copyButton: codes.whatsappTemplate.copyButton },
  };
  await BrandModel.updateOne({ _id: ctx.brandId }, { $set: { messaging: { codes: clean } } });
  return getMessaging(ctx);
}

/* ---------------------------------------------------------------- dispatch */

async function outletConfigFor(ctx               ) {
  const outlet = await OutletModel.findOne({ _id: ctx.outletId }, null, { allowGlobalQuery: true }).lean();
  if (!outlet) return null;
  return { config: await effectiveConfig(outlet), outletName: outlet.config?.identity?.name };
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
  // from the store's own linked WhatsApp numbers (plan feature "whatsappChat"; queued, never throws)
  await queueOrderUpdate(ctx, order, status, config);
  if (!(await storePlan(ctx.brandId)).entitlements.features.includes("notifications")) return;
  const orderId = String(order._id);
  const to = order.customer?.phone ?? "";

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
