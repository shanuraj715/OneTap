import { z } from "zod";

/**
 * "Message sending": which of the store's ways of sending a message each KIND of message goes out on.
 *
 * A store can have up to three ways to send:
 *   linked    its own WhatsApp number(s), scanned in like WhatsApp Web (plan feature "WhatsApp chat")
 *   whatsapp  WhatsApp Business through Meta's Cloud API — template messages only (plan feature "WhatsApp & SMS alerts")
 *   sms       its own SMS gateway (plan feature "WhatsApp & SMS alerts")
 *
 * Today one kind of message is mapped here — the verification code a customer types to sign up or sign in (and
 * the code staff ask for before spending a customer's coins). Order updates and marketing already pick their own
 * channel where they are set up, so they are not repeated here.
 *
 * Kept in one place so the API (which validates and sends) and the dashboard (which shows and edits) agree.
 */

/** the three ways a message can leave the store */
export const MESSAGE_METHODS = ["linked", "whatsapp", "sms"];

/** what a code can be mapped to — "screen" is no sending at all: the code is shown on the sign-in screen (testing only) */
export const CODE_METHODS = ["screen", ...MESSAGE_METHODS];

export const MESSAGE_METHOD_LABELS = {
  linked: "Your linked WhatsApp number",
  whatsapp: "WhatsApp Business (Meta)",
  sms: "SMS",
  screen: "Don't send (show the code on screen)",
};

/** the plan feature each method needs (the dashboard greys a method out, and the API refuses it, without it) */
export const MESSAGE_METHOD_FEATURE = {
  linked: "whatsappChat",
  whatsapp: "notifications",
  sms: "notifications",
};

/** the words sent with a code over linked WhatsApp when the store hasn't written its own */
export const DEFAULT_WA_CODE_TEMPLATE = "{{code}} is your {{store}} verification code. It is valid for 10 minutes — please don't share it with anyone.";

/** what the store's WhatsApp inbox shows in place of a code once it has gone out (a code is never kept in the chat history) */
export const WA_CODE_REDACTED = "🔒 Verification code";

export const whatsappCodeTemplateSchema = z.object({
  /** the name of the approved Meta template; its first {{1}} is filled with the code */
  name: z.string().trim().max(120).default(""),
  language: z.string().trim().min(2).max(10).default("en"),
  /** an "Authentication" template made with a Copy code button needs the code again in that button */
  copyButton: z.boolean().default(false),
});

export const codeMappingSchema = z
  .object({
    method: z.enum(CODE_METHODS),
    /** free text sent over linked WhatsApp; empty = DEFAULT_WA_CODE_TEMPLATE. Must contain {{code}} */
    linkedMessage: z.string().max(500).default(""),
    whatsappTemplate: whatsappCodeTemplateSchema.default({}),
  })
  .superRefine((v, ctx) => {
    if (v.linkedMessage.trim() && !v.linkedMessage.includes("{{code}}")) {
      ctx.addIssue({ code: "custom", path: ["linkedMessage"], message: "The message must contain {{code}} — that is where the code goes." });
    }
    if (v.method === "whatsapp" && !v.whatsappTemplate.name) {
      ctx.addIssue({ code: "custom", path: ["whatsappTemplate", "name"], message: "Enter the name of your approved WhatsApp template." });
    }
  });

export const messagingSchema = z.object({ codes: codeMappingSchema });

/** fill {{code}} and {{store}} in a code message */
export const renderCodeMessage = (template, { code, store }) =>
  String(template || DEFAULT_WA_CODE_TEMPLATE).replaceAll("{{code}}", code).replaceAll("{{store}}", store || "");
