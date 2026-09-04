import { z } from "zod";
import { ORDER_STATUSES } from "./order";

/**
 * Order-lifecycle alerts sent to the customer over WhatsApp or SMS — "your
 * order was accepted", "your order is ready". Deliberately separate from OTP
 * delivery (`notify.ts`), which is a different concern with its own provider.
 *
 * Credentials live in their own encrypted-at-rest collection, never in this
 * schema — this is served to the storefront as part of outlet.config, and a
 * secret must never ride along with that.
 */
export const NOTIFY_CHANNELS = ["whatsapp", "sms"] as const;
export const notifyChannelSchema = z.enum(NOTIFY_CHANNELS);
export type NotifyOrderChannel = (typeof NOTIFY_CHANNELS)[number];

export const NOTIFY_CHANNEL_LABELS: Record<NotifyOrderChannel, string> = {
  whatsapp: "WhatsApp",
  sms: "SMS",
};

/** Which order statuses can trigger a message — the same vocabulary a printer
 *  auto-fires on, so the mental model matches something already familiar. */
export const NOTIFY_EVENTS = ORDER_STATUSES;

/** The fixed, positional variables every template gets filled with, in order. */
export const NOTIFY_VARIABLES = [
  "customerName",
  "orderNumber",
  "statusLabel",
  "amount",
  "outletName",
] as const;
export type NotifyVariable = (typeof NOTIFY_VARIABLES)[number];

export const NOTIFY_VARIABLE_HINTS: Record<NotifyVariable, string> = {
  customerName: "The customer's name, or 'there' if none was given",
  orderNumber: "e.g. 0042",
  statusLabel: "e.g. Ready, Accepted",
  amount: "e.g. ₹350.00",
  outletName: "The restaurant's name",
};

/**
 * A WhatsApp Business template message. WhatsApp requires every
 * business-initiated message to use a template Meta has pre-approved — you
 * can't send free text — so this stores the template's name and language, not
 * its body. Meta fills the template's placeholders `{{1}}…{{5}}` in the order
 * it was approved with; that order must match {@link NOTIFY_VARIABLES}.
 */
export const whatsappEventTemplateSchema = z.object({
  templateName: z.string().max(120).default(""),
  languageCode: z.string().max(10).default("en"),
});
export type WhatsAppEventTemplate = z.infer<typeof whatsappEventTemplateSchema>;

/** SMS is free text (subject to the outlet's own DLT template registration in
 *  India), so the template is the literal message body with `{{var}}`
 *  placeholders the outlet writes themselves. */
export const smsEventTemplateSchema = z.object({
  /** e.g. "Hi {{customerName}}, your order #{{orderNumber}} is {{statusLabel}}." */
  body: z.string().max(320).default(""),
  /** the DLT-registered template id this body corresponds to, kept for reference */
  dltTemplateId: z.string().max(60).default(""),
});
export type SmsEventTemplate = z.infer<typeof smsEventTemplateSchema>;

const templateMap = <T extends z.ZodTypeAny>(shape: T) => z.record(z.string(), shape).default({});

export const orderNotifySettingsSchema = z.object({
  whatsapp: z
    .object({
      enabled: z.boolean().default(false),
      /** which statuses trigger a WhatsApp message */
      events: z.array(z.enum(ORDER_STATUSES)).default([]),
      templates: templateMap(whatsappEventTemplateSchema),
    })
    .default({}),
  sms: z
    .object({
      enabled: z.boolean().default(false),
      events: z.array(z.enum(ORDER_STATUSES)).default([]),
      templates: templateMap(smsEventTemplateSchema),
    })
    .default({}),
});
export type OrderNotifySettings = z.infer<typeof orderNotifySettingsSchema>;

/** Fill a template body's `{{var}}` placeholders — used for SMS, and for the
 *  admin's live preview of what a message will actually say. */
export function renderTemplate(body: string, values: Record<NotifyVariable, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (m, key: string) => values[key as NotifyVariable] ?? m);
}

/** A sample set of values for previewing a template in the admin. */
export function sampleNotifyValues(outletName: string): Record<NotifyVariable, string> {
  return {
    customerName: "Aarav",
    orderNumber: "0042",
    statusLabel: "Ready",
    amount: "₹350.00",
    outletName,
  };
}

/* -------------------------------------------------------------- credentials */

/**
 * The connection details each channel needs, in the order the admin form
 * shows them. `secret` fields are encrypted at rest and never sent back to
 * the browser; everything else is stored as plain text alongside them.
 *
 * SMS is deliberately generic rather than tied to one vendor: almost every
 * Indian SMS gateway is "call this URL with these params", but no two use the
 * same ones, so the outlet supplies its own request shape with `{{to}}`,
 * `{{message}}`, `{{senderId}}` and `{{apiKey}}` placeholders — this works with
 * MSG91, Fast2SMS, Textlocal, Twilio's SMS API, or an in-house gateway alike.
 * WhatsApp has one real direct integration (Meta's own Cloud API), so that one
 * is specific.
 */
export interface NotifyFieldSpec {
  key: string;
  label: string;
  secret: boolean;
  multiline?: boolean;
  hint?: string;
  info: string;
  placeholder?: string;
}

export const NOTIFY_FIELDS: Record<NotifyOrderChannel, NotifyFieldSpec[]> = {
  whatsapp: [
    {
      key: "phoneNumberId",
      label: "Phone number ID",
      secret: false,
      info: "From Meta for Developers → your app → WhatsApp → API Setup. Identifies which of your WhatsApp numbers sends the message.",
      placeholder: "109876543210123",
    },
    {
      key: "businessAccountId",
      label: "WhatsApp Business Account ID",
      secret: false,
      info: "Also on the API Setup page. Not required to send, but useful for support requests to Meta.",
      placeholder: "112233445566778",
    },
    {
      key: "apiVersion",
      label: "Graph API version",
      secret: false,
      hint: "Leave as the default unless Meta has told you to change it",
      info: "The Facebook Graph API version this integration talks to.",
      placeholder: "v20.0",
    },
    {
      key: "accessToken",
      label: "Permanent access token",
      secret: true,
      info: "A System User access token with whatsapp_business_messaging permission, generated in Meta Business Settings. Treat it like a password — it can send messages as your business.",
    },
  ],
  sms: [
    {
      key: "senderId",
      label: "Sender ID",
      secret: false,
      info: "The 6-character DLT-registered sender ID your messages appear from, e.g. GAZABM.",
      placeholder: "GAZABM",
    },
    {
      key: "method",
      label: "HTTP method",
      secret: false,
      hint: "GET or POST — check your gateway's API docs",
      info: "Most simple SMS APIs accept a GET request with everything in the URL. Use POST only if your gateway requires it.",
      placeholder: "GET",
    },
    {
      key: "requestUrl",
      label: "Request URL",
      secret: false,
      multiline: true,
      info: "The exact URL from your SMS gateway's API docs, with {{apiKey}}, {{to}}, {{message}} and {{senderId}} in place of the real values — they're substituted right before sending.",
      placeholder: "https://api.yourgateway.com/send?key={{apiKey}}&to={{to}}&sender={{senderId}}&message={{message}}",
    },
    {
      key: "bodyTemplate",
      label: "Request body (POST only)",
      secret: false,
      multiline: true,
      hint: "Leave blank for a GET request",
      info: "The request body your gateway expects, with the same {{placeholders}}. Only sent when the method above is POST.",
      placeholder: '{"to":"{{to}}","sender":"{{senderId}}","message":"{{message}}"}',
    },
    {
      key: "apiKey",
      label: "API key / auth token",
      secret: true,
      info: "Your SMS gateway's API key. Stored encrypted, and substituted into the URL or body wherever you wrote {{apiKey}} — never shown again after saving.",
    },
  ],
};
