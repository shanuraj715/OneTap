import { normalizeWaPhone, smsNumber } from "@rasoipulse/config-schema";
import { WaAccountModel, WaChatModel } from "@rasoipulse/db";
import { logger } from "../../logger.js";
import { storePlan } from "../platform/plan.service.js";
import { isOnline, queueCustomerText } from "../whatsapp/whatsapp.service.js";
import { credentialsFor } from "./notify.service.js";
import { providerFor } from "./providers/index.js";

/**
 * Send a short plain-text message to a customer — a booking confirmed, a forgotten cart — over whatever the store has:
 *
 *   "linked"    WhatsApp from the store's own linked number (plan feature "WhatsApp chat", a number linked)
 *   "business"  WhatsApp Business (Meta's Cloud API) with the approved template in `business` — { name, languageCode }, one {{1}} placeholder that gets the text
 *               (plan feature "WhatsApp & SMS alerts", the gateway set up)
 *   "sms"       the store's SMS gateway (plan feature "WhatsApp & SMS alerts", the gateway set up)
 *   "auto"      the first of those that can: linked WhatsApp, then WhatsApp Business (only when a template is given), then SMS
 *
 * Never throws: a message that can't go must never stop the booking or the order it is about.
 * @returns {Promise<{ ok: boolean, channel?: "linked" | "business" | "sms", reason?: string }>}
 */
export async function sendCustomerText(ctx, { phone, name = "", text, channel = "auto", source = "order", business = null }) {
  if (!phone) return { ok: false, reason: "The customer has no phone number" };
  const reasons = [];
  if (channel === "auto" || channel === "linked") {
    const r = await queueCustomerText(ctx, { phone, name, text, source });
    if (r.ok) return { ok: true, channel: "linked" };
    reasons.push(`WhatsApp: ${r.reason}`);
  }
  if ((channel === "auto" && business?.name) || channel === "business") {
    const r = await sendBusinessWhatsApp(ctx, phone, text, business);
    if (r.ok) return { ok: true, channel: "business" };
    reasons.push(`WhatsApp Business: ${r.reason}`);
  }
  if (channel === "auto" || channel === "sms") {
    const r = await sendSms(ctx, phone, text);
    if (r.ok) return { ok: true, channel: "sms" };
    reasons.push(`SMS: ${r.reason}`);
  }
  return { ok: false, reason: reasons.join(" · ") || "No way to send" };
}

/**
 * Which way a message to a guest would go right now, without sending anything: `{ channel, label }` (channel null = no way to send). The same order
 * as `sendCustomerText` with "auto". A linked number that is not online at this moment still counts: the message waits in its queue.
 */
export async function customerTextRoute(ctx, { business = null, phone = "" } = {}) {
  try {
    const features = (await storePlan(ctx.brandId)).entitlements.features;
    if (features.includes("whatsappChat")) {
      // the same test `queueCustomerText` makes: a linked number that is online now — or an earlier chat with this guest that already belongs to a number
      const accounts = await WaAccountModel.find({ brandId: ctx.brandId, status: { $in: ["connected", "disconnected"] } }).lean();
      const chat = phone && accounts.length ? await WaChatModel.findOne({ brandId: ctx.brandId, phone: normalizeWaPhone(phone) ?? "" }).select("accountId").lean() : null;
      if (accounts.some(isOnline) || (chat?.accountId && accounts.some((a) => String(a._id) === String(chat.accountId)))) return { channel: "linked", label: "your linked WhatsApp number" };
    }
    if (features.includes("notifications")) {
      if (business?.name) {
        const creds = await credentialsFor(ctx, "whatsapp");
        if (providerFor("whatsapp").requiredFields.every((f) => creds[f])) return { channel: "business", label: "WhatsApp Business" };
      }
      const sms = await credentialsFor(ctx, "sms");
      if (providerFor("sms").requiredFields.every((f) => sms[f])) return { channel: "sms", label: "SMS" };
    }
  } catch (err) {
    logger.error({ err }, "customer text: couldn't work out how a message would go");
  }
  return { channel: null, label: "" };
}

async function sendBusinessWhatsApp(ctx, phone, text, business) {
  try {
    if (!(await storePlan(ctx.brandId)).entitlements.features.includes("notifications")) return { ok: false, reason: "WhatsApp Business isn't in the store's plan" };
    if (!business?.name) return { ok: false, reason: "no WhatsApp template is set for booking updates" };
    const creds = await credentialsFor(ctx, "whatsapp");
    const provider = providerFor("whatsapp");
    const missing = provider.requiredFields.filter((f) => !creds[f]);
    if (missing.length) return { ok: false, reason: "WhatsApp Business isn't set up" };
    // Meta does not allow line breaks inside a template's placeholder
    const line = String(text).replace(/\s*\n+\s*/g, " ").slice(0, 1000);
    const result = await provider.send(creds, { to: phone, event: "message", values: {}, message: line, whatsapp: { templateName: business.name, languageCode: business.languageCode || "en", params: [line] } });
    return result.ok ? { ok: true } : { ok: false, reason: result.reason ?? "WhatsApp refused it" };
  } catch (err) {
    logger.error({ err }, "whatsapp business: couldn't send a customer message");
    return { ok: false, reason: err?.message || "unexpected error" };
  }
}

async function sendSms(ctx, phone, text) {
  try {
    if (!(await storePlan(ctx.brandId)).entitlements.features.includes("notifications")) return { ok: false, reason: "SMS isn't in the store's plan" };
    const creds = await credentialsFor(ctx, "sms");
    const provider = providerFor("sms");
    const missing = provider.requiredFields.filter((f) => !creds[f]);
    if (missing.length) return { ok: false, reason: "the SMS gateway isn't set up" };
    const result = await provider.send(creds, { to: smsNumber(phone), event: "message", values: {}, message: text });
    return result.ok ? { ok: true } : { ok: false, reason: result.reason ?? "the gateway refused it" };
  } catch (err) {
    logger.error({ err }, "sms: couldn't send a customer message");
    return { ok: false, reason: err?.message || "unexpected error" };
  }
}
