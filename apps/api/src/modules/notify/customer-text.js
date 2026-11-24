import { smsNumber } from "@rasoipulse/config-schema";
import { logger } from "../../logger.js";
import { storePlan } from "../platform/plan.service.js";
import { queueCustomerText } from "../whatsapp/whatsapp.service.js";
import { credentialsFor } from "./notify.service.js";
import { providerFor } from "./providers/index.js";

/**
 * Send a short plain-text message to a customer — a booking confirmed, a forgotten cart — over whatever the store has:
 *
 *   "linked"  WhatsApp from the store's own linked number (plan feature "WhatsApp chat", a number linked)
 *   "sms"     the store's SMS gateway (plan feature "WhatsApp & SMS alerts", the gateway set up)
 *   "auto"    linked WhatsApp when it can, otherwise SMS
 *
 * Never throws: a message that can't go must never stop the booking or the order it is about.
 * @returns {Promise<{ ok: boolean, channel?: "linked" | "sms", reason?: string }>}
 */
export async function sendCustomerText(ctx, { phone, name = "", text, channel = "auto", source = "order" }) {
  if (!phone) return { ok: false, reason: "The customer has no phone number" };
  const reasons = [];
  if (channel === "auto" || channel === "linked") {
    const r = await queueCustomerText(ctx, { phone, name, text, source });
    if (r.ok) return { ok: true, channel: "linked" };
    reasons.push(`WhatsApp: ${r.reason}`);
  }
  if (channel === "auto" || channel === "sms") {
    const r = await sendSms(ctx, phone, text);
    if (r.ok) return { ok: true, channel: "sms" };
    reasons.push(`SMS: ${r.reason}`);
  }
  return { ok: false, reason: reasons.join(" · ") || "No way to send" };
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
